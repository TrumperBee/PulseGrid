const axios = require('axios');
const https = require('https');
const { query } = require('../database/db');

// Main function to check a single endpoint
async function checkEndpoint(monitor) {
    const startTime = Date.now();
    
    const result = {
        statusCode: null,
        isSuccessful: false,
        error: null,
        responseTime: 0,
        dnsTime: null,
        connectTime: null,
        tlsTime: null,
        ttfb: null,
        responseBody: '',
        checkedAt: new Date().toISOString()
    };

    // Parse headers
    let headers = {};
    try {
        headers = typeof monitor.headers === 'string' ? JSON.parse(monitor.headers) : (monitor.headers || {});
    } catch (e) {
        headers = {};
    }

    // Add auth header based on auth_type
    if (monitor.auth_type === 'bearer' && monitor.auth_value) {
        headers['Authorization'] = `Bearer ${monitor.auth_value}`;
    } else if (monitor.auth_type === 'apikey' && monitor.auth_value) {
        try {
            const apiKeyConfig = typeof monitor.auth_value === 'string' 
                ? JSON.parse(monitor.auth_value) 
                : monitor.auth_value;
            headers[apiKeyConfig.headerName || 'X-API-Key'] = apiKeyConfig.value || monitor.auth_value;
        } catch (e) {
            headers['X-API-Key'] = monitor.auth_value;
        }
    } else if (monitor.auth_type === 'basic' && monitor.auth_value) {
        headers['Authorization'] = `Basic ${Buffer.from(monitor.auth_value).toString('base64')}`;
    }

    const timeoutMs = (monitor.timeout_seconds || 30) * 1000;
    const httpsAgent = new https.Agent({
        timeout: timeoutMs,
        rejectUnauthorized: false
    });

    const checkStart = Date.now();

    try {
        const response = await axios({
            method: monitor.method || 'GET',
            url: monitor.url,
            headers,
            data: monitor.body,
            timeout: timeoutMs,
            httpsAgent,
            validateStatus: () => true,
            maxRedirects: 5
        });

        result.responseTime = Date.now() - checkStart;
        result.statusCode = response.status;
        result.responseBody = typeof response.data === 'string' 
            ? response.data.substring(0, 500) 
            : JSON.stringify(response.data).substring(0, 500);

        // Check for x-response-time header
        if (response.headers['x-response-time']) {
            result.ttfb = parseInt(response.headers['x-response-time']);
        }

        // Validate response
        let isValid = true;
        let validationError = null;

        // Check status code
        if (monitor.expected_status_code && response.status !== monitor.expected_status_code) {
            isValid = false;
            validationError = `Expected status ${monitor.expected_status_code}, got ${response.status}`;
        }

        // Check response must contain
        if (isValid && monitor.response_must_contain) {
            if (!result.responseBody.includes(monitor.response_must_contain)) {
                isValid = false;
                validationError = `Response does not contain expected text: "${monitor.response_must_contain}"`;
            }
        }

        // Check response must not contain
        if (isValid && monitor.response_must_not_contain) {
            if (result.responseBody.includes(monitor.response_must_not_contain)) {
                isValid = false;
                validationError = `Response contains forbidden text: "${monitor.response_must_not_contain}"`;
            }
        }

        // Check max response time
        if (isValid && monitor.max_response_ms && result.responseTime > monitor.max_response_ms) {
            isValid = false;
            validationError = `Response time ${result.responseTime}ms exceeded threshold of ${monitor.max_response_ms}ms`;
        }

        result.isSuccessful = isValid;
        if (!isValid && !result.error) {
            result.error = validationError;
        }

    } catch (error) {
        result.responseTime = Date.now() - checkStart;
        
        if (error.code === 'ENOTFOUND') {
            result.error = 'DNS resolution failed - domain not found';
        } else if (error.code === 'ECONNREFUSED') {
            result.error = 'Connection refused - server not accepting connections';
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            result.error = `Timeout: no response within ${monitor.timeout_seconds || 30}s`;
        } else if (error.code === 'CERT_HAS_EXPIRED') {
            result.error = 'SSL certificate has expired';
        } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
            result.error = 'SSL certificate error';
        } else if (error.message) {
            result.error = error.message.substring(0, 200);
        } else {
            result.error = 'Unknown error';
        }
        
        result.isSuccessful = false;
    }

    // Insert check result into database
    try {
        await query(`
            INSERT INTO monitor_checks (
                monitor_id, location, status_code, response_time_ms,
                is_successful, error_message, response_body_preview,
                dns_time_ms, connect_time_ms, tls_time_ms, ttfb_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            monitor.id,
            'primary',
            result.statusCode,
            result.responseTime,
            result.isSuccessful,
            result.error,
            result.responseBody.substring(0, 500),
            result.dnsTime,
            result.connectTime,
            result.tlsTime,
            result.ttfb
        ]);
    } catch (dbError) {
        console.error('Failed to save check result:', dbError.message);
    }

    // Update monitor status
    try {
        const newStatus = result.isSuccessful 
            ? (result.responseTime > (monitor.max_response_ms || 3000) ? 'slow' : 'up')
            : 'down';
            
        await query(`
            UPDATE monitors SET 
                status = $1,
                last_check_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
        `, [newStatus, monitor.id]);
    } catch (dbError) {
        console.error('Failed to update monitor status:', dbError.message);
    }

    return result;
}

// Run check for a specific monitor by ID
async function runMonitorCheck(monitorId) {
    try {
        const result = await query('SELECT * FROM monitors WHERE id = $1', [monitorId]);
        
        if (result.rows.length === 0) {
            console.log(`Monitor ${monitorId} not found`);
            return null;
        }

        const monitor = result.rows[0];
        
        if (!monitor.is_active || monitor.is_paused) {
            console.log(`Monitor ${monitorId} is paused or inactive`);
            return null;
        }

        console.log(`Checking monitor: ${monitor.name} (${monitor.url})`);
        const checkResult = await checkEndpoint(monitor);

        // Check if we need to trigger/resolve incidents
        const lastThreeChecks = await query(`
            SELECT is_successful FROM monitor_checks 
            WHERE monitor_id = $1 
            ORDER BY checked_at DESC LIMIT 3
        `, [monitorId]);

        // If last 3 checks are all failures, create incident
        if (lastThreeChecks.rows.length >= 3 && 
            lastThreeChecks.rows.every(c => !c.is_successful)) {
            await handleIncident(monitor, checkResult);
        }

        // If previous was down but now is up, resolve incident
        if (checkResult.isSuccessful && monitor.status === 'down') {
            await resolveIncident(monitor);
            await sendRecoveryAlert(monitor);
        }

        return checkResult;
    } catch (error) {
        console.error(`Error running check for monitor ${monitorId}:`, error);
        return null;
    }
}

// Handle new incident
async function handleIncident(monitor, checkResult) {
    try {
        // Check if there's already an open incident
        const existingIncident = await query(`
            SELECT id FROM incidents 
            WHERE monitor_id = $1 AND resolved_at IS NULL
        `, [monitor.id]);

        if (existingIncident.rows.length > 0) {
            console.log(`Incident already open for monitor ${monitor.id}`);
            return;
        }

        // Create new incident
        await query(`
            INSERT INTO incidents (
                monitor_id, status, failure_reason, started_at
            ) VALUES ($1, 'investigating', $2, NOW())
        `, [monitor.id, checkResult.error || 'Service unavailable']);

        console.log(`Created incident for monitor: ${monitor.name}`);

        // Send alerts
        await sendDownAlerts(monitor, checkResult);

    } catch (error) {
        console.error('Error creating incident:', error);
    }
}

// Resolve open incident
async function resolveIncident(monitor) {
    try {
        const result = await query(`
            UPDATE incidents 
            SET status = 'resolved', 
                resolved_at = NOW(),
                duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int
            WHERE monitor_id = $1 AND resolved_at IS NULL
            RETURNING *
        `, [monitor.id]);

        if (result.rows.length > 0) {
            console.log(`Resolved incident for monitor: ${monitor.name}`);
        }
    } catch (error) {
        console.error('Error resolving incident:', error);
    }
}

// Send down alerts
async function sendDownAlerts(monitor, checkResult) {
    try {
        // Get alert contacts for this user's monitors
        const contacts = await query(`
            SELECT ac.*, u.email, u.full_name, u.timezone
            FROM alert_contacts ac
            JOIN users u ON u.id = ac.user_id
            JOIN monitors m ON m.user_id = u.id
            WHERE m.id = $1 AND ac.is_active = true
        `, [monitor.id]);

        for (const contact of contacts.rows) {
            console.log(`[ALERT] Would send down alert to ${contact.channel}: ${contact.value}`);
            
            // In production, call actual alert service
            // await alertService.send(contact, 'down', monitor, checkResult);
        }
    } catch (error) {
        console.error('Error sending down alerts:', error);
    }
}

// Send recovery alert
async function sendRecoveryAlert(monitor) {
    try {
        const contacts = await query(`
            SELECT ac.*, u.email, u.full_name
            FROM alert_contacts ac
            JOIN users u ON u.id = ac.user_id
            JOIN monitors m ON m.user_id = u.id
            WHERE m.id = $1 AND ac.is_active = true AND ac.notify_on_recovery = true
        `, [monitor.id]);

        for (const contact of contacts.rows) {
            console.log(`[ALERT] Would send recovery alert to ${contact.channel}: ${contact.value}`);
        }
    } catch (error) {
        console.error('Error sending recovery alerts:', error);
    }
}

// Run checks for all active monitors
async function runAllActiveMonitors() {
    try {
        const result = await query(`
            SELECT * FROM monitors 
            WHERE is_active = true AND is_paused = false
        `);

        const monitors = result.rows;
        console.log(`\n=== Checking ${monitors.length} active monitors at ${new Date().toISOString()} ===`);

        for (const monitor of monitors) {
            await checkEndpoint(monitor);
        }

        console.log(`=== Completed checking ${monitors.length} monitors ===\n`);
        return monitors.length;
    } catch (error) {
        console.error('Error running all active monitors:', error);
        return 0;
    }
}

module.exports = {
    checkEndpoint,
    runMonitorCheck,
    handleIncident,
    resolveIncident,
    runAllActiveMonitors
};
