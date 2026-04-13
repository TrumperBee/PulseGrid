const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/stats/monitors/:id - Get stats for a monitor
router.get('/monitors/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { period = '24h', location } = req.query;

        // Verify monitor belongs to user
        const monitorCheck = await query(
            'SELECT id, name FROM monitors WHERE id = $1 AND user_id = $2',
            [id, req.user.userId]
        );

        if (monitorCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        // Calculate period start
        let interval;
        switch (period) {
            case '7d': interval = '7 days'; break;
            case '30d': interval = '30 days'; break;
            default: interval = '24 hours';
        }

        let queryStr = `
            SELECT 
                checked_at,
                response_time_ms,
                status_code,
                is_successful,
                location,
                error_message
            FROM monitor_checks
            WHERE monitor_id = $1
            AND checked_at > NOW() - INTERVAL '${interval}'
        `;
        
        const params = [id];
        
        if (location) {
            queryStr += ` AND location = $2`;
            params.push(location);
        }
        
        queryStr += ` ORDER BY checked_at DESC`;

        const result = await query(queryStr, params);

        const checks = result.rows;
        const totalChecks = checks.length;
        const failedChecks = checks.filter(c => !c.is_successful).length;
        const successfulChecks = totalChecks - failedChecks;
        
        const uptimePercentage = totalChecks > 0 
            ? Math.round((successfulChecks / totalChecks) * 10000) / 100 
            : 100;

        const responseTimes = checks.filter(c => c.response_time_ms !== null).map(c => c.response_time_ms);
        const avgResponseMs = responseTimes.length > 0
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : null;

        res.json({
            period,
            uptime_percentage: uptimePercentage,
            avg_response_ms: avgResponseMs,
            total_checks: totalChecks,
            successful_checks: successfulChecks,
            failed_checks: failedChecks,
            checks: checks.map(c => ({
                checked_at: c.checked_at,
                response_time_ms: c.response_time_ms,
                status_code: c.status_code,
                is_successful: c.is_successful,
                location: c.location,
                error_message: c.error_message
            }))
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/stats/monitors/:id/uptime-history - Get 90-day uptime history
router.get('/monitors/:id/uptime-history', async (req, res, next) => {
    try {
        const { id } = req.params;

        // Verify monitor belongs to user
        const monitorCheck = await query(
            'SELECT id FROM monitors WHERE id = $1 AND user_id = $2',
            [id, req.user.userId]
        );

        if (monitorCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        const result = await query(`
            SELECT 
                DATE(checked_at) as date,
                COUNT(*) as total_checks,
                SUM(CASE WHEN is_successful THEN 1 ELSE 0 END) as successful_checks,
                SUM(CASE WHEN NOT is_successful THEN 1 ELSE 0 END) as failed_checks,
                ROUND(
                    SUM(CASE WHEN is_successful THEN 1 ELSE 0 END)::numeric / 
                    COUNT(*)::numeric * 100, 
                    2
                ) as uptime_percentage
            FROM monitor_checks
            WHERE monitor_id = $1
            AND checked_at > NOW() - INTERVAL '90 days'
            GROUP BY DATE(checked_at)
            ORDER BY date DESC
        `, [id]);

        // Fill in missing days with 100% if no checks
        const today = new Date();
        const historyMap = new Map();
        
        result.rows.forEach(row => {
            historyMap.set(row.date.toISOString().split('T')[0], row);
        });

        const history = [];
        for (let i = 0; i < 90; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            if (historyMap.has(dateStr)) {
                const row = historyMap.get(dateStr);
                history.push({
                    date: dateStr,
                    uptime_percentage: parseFloat(row.uptime_percentage) || 100,
                    total_checks: parseInt(row.total_checks),
                    failed_checks: parseInt(row.failed_checks)
                });
            } else {
                history.push({
                    date: dateStr,
                    uptime_percentage: 100,
                    total_checks: 0,
                    failed_checks: 0
                });
            }
        }

        res.json({ history });
    } catch (error) {
        next(error);
    }
});

// GET /api/stats/overview - Dashboard overview
router.get('/overview', async (req, res, next) => {
    try {
        // Get all monitors for user
        const monitorsResult = await query(`
            SELECT 
                id, name, status, is_paused, is_active,
                (
                    SELECT AVG(response_time_ms)::int
                    FROM monitor_checks mc
                    WHERE mc.monitor_id = monitors.id
                    AND mc.checked_at > NOW() - INTERVAL '24 hours'
                ) as avg_response_24h
            FROM monitors
            WHERE user_id = $1
        `, [req.user.userId]);

        const monitors = monitorsResult.rows;

        // Get incidents today
        const incidentsResult = await query(`
            SELECT COUNT(*)::int as count
            FROM incidents i
            JOIN monitors m ON m.id = i.monitor_id
            WHERE m.user_id = $1
            AND i.started_at > NOW() - INTERVAL '24 hours'
        `, [req.user.userId]);

        const totalMonitors = monitors.length;
        const monitorsUp = monitors.filter(m => m.status === 'up' && !m.is_paused).length;
        const monitorsDown = monitors.filter(m => m.status === 'down' && !m.is_paused).length;
        const monitorsSlow = monitors.filter(m => m.status === 'slow' && !m.is_paused).length;
        const monitorsPaused = monitors.filter(m => m.is_paused).length;

        const avgResponseTimes = monitors
            .filter(m => m.avg_response_24h !== null)
            .map(m => m.avg_response_24h);
        
        const avgResponseMs = avgResponseTimes.length > 0
            ? Math.round(avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length)
            : null;

        res.json({
            total_monitors: totalMonitors,
            monitors_up: monitorsUp,
            monitors_down: monitorsDown,
            monitors_slow: monitorsSlow,
            monitors_paused: monitorsPaused,
            avg_response_ms: avgResponseMs,
            incidents_today: incidentsResult.rows[0].count
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
