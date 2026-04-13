const cron = require('node-cron');
const { query } = require('../database/db');
const { checkEndpoint } = require('./checker');
const { sendFollowupAlert } = require('./emailService');

let schedulerTask = null;
let followupTask = null;
let isRunning = false;

async function checkFollowupIncidents() {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const result = await query(`
            SELECT i.*, m.name as monitor_name, m.url as monitor_url, m.locations
            FROM incidents i
            JOIN monitors m ON i.monitor_id = m.id
            WHERE i.is_resolved = false 
            AND i.resolved_at IS NULL
            AND i.followup_count < 7
            AND (i.last_followup_sent IS NULL OR i.last_followup_sent < $1)
            AND i.started_at < $1
        `, [twentyFourHoursAgo]);

        if (result.rows.length === 0) {
            return;
        }

        console.log(`[FOLLOWUP] Processing ${result.rows.length} incidents for follow-up emails`);

        for (const incident of result.rows) {
            const monitor = {
                id: incident.monitor_id,
                name: incident.monitor_name,
                url: incident.monitor_url,
                locations: incident.affected_locations || ['primary']
            };

            await sendFollowupAlert(monitor, incident);

            await query(`
                UPDATE incidents 
                SET last_followup_sent = NOW(),
                    followup_count = followup_count + 1
                WHERE id = $1
            `, [incident.id]);

            console.log(`[FOLLOWUP] Sent followup #${incident.followup_count + 1} for incident ${incident.id}`);
        }
    } catch (error) {
        console.error('[FOLLOWUP] Error checking followup incidents:', error);
    }
}

async function startScheduler() {
    console.log('Starting monitor scheduler...');

    // Run every minute
    schedulerTask = cron.schedule('* * * * *', async () => {
        if (isRunning) {
            console.log('Scheduler: previous run still in progress, skipping...');
            return;
        }

        isRunning = true;
        const startTime = Date.now();

        try {
            // Get all active, non-paused monitors
            const monitorsResult = await query(`
                SELECT m.*,
                    (SELECT MAX(mc.checked_at) 
                     FROM monitor_checks mc 
                     WHERE mc.monitor_id = m.id) as last_checked_at
                FROM monitors m
                WHERE m.is_active = true AND m.is_paused = false
            `);

            const monitors = monitorsResult.rows;
            const now = new Date();

            // Filter monitors that are due for a check
            const dueMonitors = monitors.filter(monitor => {
                if (!monitor.last_checked_at) {
                    return true; // Never checked, should check now
                }

                const lastCheck = new Date(monitor.last_checked_at);
                const intervalMs = (monitor.interval_seconds || 300) * 1000;
                const nextCheckTime = new Date(lastCheck.getTime() + intervalMs);

                return now >= nextCheckTime;
            });

            if (dueMonitors.length === 0) {
                console.log(`Scheduler tick: No monitors due for check`);
                return;
            }

            console.log(`\nScheduler tick - checking ${dueMonitors.length} due monitors at ${now.toISOString()}`);

            // Check each due monitor
            for (const monitor of dueMonitors) {
                try {
                    console.log(`  Checking: ${monitor.name} (every ${monitor.interval_seconds}s)`);
                    await checkEndpoint(monitor);
                } catch (error) {
                    console.error(`  Error checking ${monitor.name}:`, error.message);
                }
            }

            const duration = Date.now() - startTime;
            console.log(`Scheduler tick completed: ${dueMonitors.length} monitors checked in ${duration}ms\n`);

        } catch (error) {
            console.error('Scheduler error:', error);
        } finally {
            isRunning = false;
        }
    });

    // Run follow-up check every 5 minutes
    followupTask = cron.schedule('*/5 * * * *', async () => {
        console.log('[FOLLOWUP] Checking for incident follow-ups...');
        await checkFollowupIncidents();
    });

    console.log('Monitor scheduler started (runs every minute)');
    console.log('Follow-up scheduler started (runs every 5 minutes)');
    return schedulerTask;
}

function stopScheduler() {
    if (schedulerTask) {
        schedulerTask.stop();
        console.log('Monitor scheduler stopped');
    }
}

async function runNow() {
    console.log('Manual scheduler run triggered...');
    
    const monitorsResult = await query(`
        SELECT m.*,
            (SELECT MAX(mc.checked_at) 
             FROM monitor_checks mc 
             WHERE mc.monitor_id = m.id) as last_checked_at
        FROM monitors m
        WHERE m.is_active = true AND m.is_paused = false
    `);

    const monitors = monitorsResult.rows;
    console.log(`Checking all ${monitors.length} active monitors...`);

    for (const monitor of monitors) {
        try {
            await checkEndpoint(monitor);
        } catch (error) {
            console.error(`Error checking ${monitor.name}:`, error.message);
        }
    }

    return monitors.length;
}

module.exports = {
    startScheduler,
    stopScheduler,
    runNow
};
