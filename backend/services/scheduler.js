const cron = require('node-cron');
const { query } = require('../database/db');
const { checkEndpoint } = require('./checker');

let schedulerTask = null;
let isRunning = false;

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

    console.log('Monitor scheduler started (runs every minute)');
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
