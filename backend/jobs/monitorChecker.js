const cron = require('node-cron');
const db = require('../database/db');
const { performCheck } = require('../utils/checker');

let isRunning = false;

async function checkAllMonitors() {
    if (isRunning) {
        console.log('Monitor check already in progress, skipping...');
        return;
    }
    
    isRunning = true;
    const startTime = Date.now();
    
    try {
        const monitors = await db.query(`
            SELECT id, url, method, headers, body, expected_status_code, 
                   response_must_contain, response_must_not_contain, 
                   max_response_ms, timeout_seconds, auth_type, auth_value,
                   api_key_header, status
            FROM monitors 
            WHERE status IN ('up', 'down', 'slow') AND is_paused = false
        `);
        
        console.log(`\n[${new Date().toISOString()}] Starting monitor check for ${monitors.rows.length} monitors...`);
        
        for (const monitor of monitors.rows) {
            await checkMonitor(monitor);
        }
        
        const duration = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] Monitor check completed in ${duration}ms\n`);
        
    } catch (error) {
        console.error('Error in monitor check job:', error);
    } finally {
        isRunning = false;
    }
}

async function checkMonitor(monitor) {
    const checkStart = Date.now();
    const location = 'nairobi';
    
    try {
        const result = await performCheck(monitor, location);
        const responseTime = result.responseTime;
        
        const status = determineStatus(result, monitor);
        const previousStatus = monitor.status;
        
        await db.query(`
            INSERT INTO checks (monitor_id, status_code, is_successful, error_message, 
                              response_time_ms, dns_time_ms, connect_time_ms, tls_time_ms, 
                              ttfb_ms, response_body, check_location)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            monitor.id,
            result.statusCode,
            result.isSuccessful,
            result.error,
            result.responseTime,
            result.dnsTime,
            result.connectTime,
            result.tlsTime,
            result.ttfb,
            result.responseBody,
            location
        ]);
        
        await db.query(`
            UPDATE monitors 
            SET status = $1, 
                avg_response = GREATEST(0, (avg_response * 0.7) + ($2 * 0.3)),
                last_check_at = NOW(),
                updated_at = NOW()
            WHERE id = $3
        `, [status, responseTime, monitor.id]);
        
        if (status === 'down' && previousStatus !== 'down') {
            await createIncident(monitor.id, result.error);
        } else if (status === 'up' && previousStatus === 'down') {
            await resolveIncident(monitor.id);
            await sendRecoveryAlert(monitor, result);
        } else if (status !== 'up' && status !== 'down' && status !== 'slow') {
            console.log(`  Monitor ${monitor.id}: Unexpected status ${status}`);
        }
        
        console.log(`  ✓ ${monitor.url} [${result.statusCode || 'ERR'}] ${responseTime}ms - ${status}`);
        
    } catch (error) {
        console.error(`  ✗ Error checking monitor ${monitor.id}:`, error.message);
    }
}

function determineStatus(result, monitor) {
    if (!result.isSuccessful) {
        return 'down';
    }
    
    if (result.responseTime > (monitor.max_response_ms || 3000)) {
        return 'slow';
    }
    
    return 'up';
}

async function createIncident(monitorId, reason) {
    try {
        const activeIncident = await db.query(`
            SELECT id FROM incidents 
            WHERE monitor_id = $1 AND status = 'investigating'
            ORDER BY created_at DESC LIMIT 1
        `, [monitorId]);
        
        if (activeIncident.rows.length > 0) {
            return;
        }
        
        const monitor = await db.query(`SELECT name, url FROM monitors WHERE id = $1`, [monitorId]);
        
        const incidentId = await db.query(`
            INSERT INTO incidents (monitor_id, status, reason, started_at)
            VALUES ($1, 'investigating', $2, NOW())
            RETURNING id
        `, [monitorId, reason || 'Monitor check failed']);
        
        console.log(`  ⚠ Created incident for monitor ${monitorId}: ${reason}`);
        
        await sendDownAlert(monitor.rows[0], reason);
        
    } catch (error) {
        console.error('Error creating incident:', error);
    }
}

async function resolveIncident(monitorId) {
    try {
        await db.query(`
            UPDATE incidents 
            SET status = 'resolved', resolved_at = NOW()
            WHERE monitor_id = $1 AND status = 'investigating'
        `, [monitorId]);
        
        console.log(`  ✓ Resolved incident for monitor ${monitorId}`);
        
    } catch (error) {
        console.error('Error resolving incident:', error);
    }
}

async function sendDownAlert(monitor, reason) {
    try {
        const contacts = await db.query(`
            SELECT ac.*, u.email 
            FROM alert_contacts ac
            JOIN users u ON u.id = ac.user_id
            JOIN monitors m ON m.user_id = u.id
            WHERE m.id = $1 AND ac.is_active = true
        `, [monitor.id]);
        
        for (const contact of contacts.rows) {
            if (contact.email_alerts && contact.email) {
                console.log(`  Would send email alert to ${contact.email}`);
            }
            if (contact.sms_alerts && contact.phone) {
                console.log(`  Would send SMS alert to ${contact.phone}`);
            }
            if (contact.webhook_url) {
                console.log(`  Would send webhook to ${contact.webhook_url}`);
            }
        }
        
    } catch (error) {
        console.error('Error sending down alert:', error);
    }
}

async function sendRecoveryAlert(monitor, result) {
    try {
        const contacts = await db.query(`
            SELECT ac.*, u.email 
            FROM alert_contacts ac
            JOIN users u ON u.id = ac.user_id
            JOIN monitors m ON m.user_id = u.id
            WHERE m.id = $1 AND ac.is_active = true AND ac.notify_on_recovery = true
        `, [monitor.id]);
        
        for (const contact of contacts.rows) {
            console.log(`  Would send recovery notification to ${contact.email || contact.phone}`);
        }
        
    } catch (error) {
        console.error('Error sending recovery alert:', error);
    }
}

function start() {
    cron.schedule('* * * * *', () => {
        console.log('\n⏰ Running scheduled monitor check...');
        checkAllMonitors();
    });
    
    setTimeout(() => {
        console.log('\n🚀 Initial monitor check on startup...');
        checkAllMonitors();
    }, 5000);
    
    console.log('✓ Monitor checker job scheduled (every minute)');
}

function stop() {
    console.log('Stopping monitor checker...');
}

module.exports = {
    start,
    stop,
    checkAllMonitors,
    checkMonitor
};
