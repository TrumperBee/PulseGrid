const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get reports
router.get('/', async (req, res) => {
    try {
        const { type } = req.query;
        
        let sql = 'SELECT * FROM reports WHERE user_id = $1';
        const params = [req.user.userId];

        if (type) {
            sql += ' AND type = $2';
            params.push(type);
        }

        sql += ' ORDER BY generated_at DESC LIMIT 50';

        const result = await query(sql, params);

        res.json({
            reports: result.rows.map(r => ({
                id: r.id,
                type: r.type,
                periodStart: r.period_start,
                periodEnd: r.period_end,
                data: r.data,
                generatedAt: r.generated_at
            }))
        });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Failed to get reports' });
    }
});

// Generate daily summary report
router.post('/generate/daily', async (req, res) => {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const startDate = new Date(yesterday.setHours(0, 0, 0, 0));
        const endDate = new Date(yesterday.setHours(23, 59, 59, 999));

        const stats = await query(
            `SELECT 
                m.id as monitor_id,
                m.name,
                COUNT(CASE WHEN mc.is_successful = true THEN 1 END) as successful,
                COUNT(mc.id) as total,
                AVG(mc.response_time_ms)::INTEGER as avg_response,
                MAX(mc.response_time_ms) as max_response
             FROM monitors m
             LEFT JOIN monitor_checks mc ON m.id = mc.monitor_id 
                AND mc.checked_at >= $1 AND mc.checked_at <= $2
             WHERE m.user_id = $3 AND m.is_active = true
             GROUP BY m.id, m.name`,
            [startDate, endDate, req.user.userId]
        );

        const incidentCount = await query(
            `SELECT COUNT(*) as count FROM incidents i
             JOIN monitors m ON i.monitor_id = m.id
             WHERE m.user_id = $1 AND i.started_at >= $2 AND i.started_at <= $3`,
            [req.user.userId, startDate, endDate]
        );

        const data = {
            date: startDate.toISOString().split('T')[0],
            monitors: stats.rows,
            totalIncidents: parseInt(incidentCount.rows[0].count),
            summary: {
                totalChecks: stats.rows.reduce((sum, m) => sum + parseInt(m.total || 0), 0),
                successfulChecks: stats.rows.reduce((sum, m) => sum + parseInt(m.successful || 0), 0),
                avgResponse: Math.round(stats.rows.reduce((sum, m) => sum + parseInt(m.avg_response || 0), 0) / (stats.rows.length || 1))
            }
        };

        const result = await query(
            `INSERT INTO reports (user_id, type, period_start, period_end, data)
             VALUES ($1, 'daily', $2, $3, $4)
             RETURNING *`,
            [req.user.userId, startDate, endDate, JSON.stringify(data)]
        );

        res.json({ message: 'Daily report generated', report: result.rows[0] });
    } catch (error) {
        console.error('Generate daily report error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Generate weekly report
router.post('/generate/weekly', async (req, res) => {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const stats = await query(
            `SELECT 
                m.id as monitor_id,
                m.name,
                COUNT(CASE WHEN mc.is_successful = true THEN 1 END) as successful,
                COUNT(mc.id) as total,
                AVG(mc.response_time_ms)::INTEGER as avg_response
             FROM monitors m
             LEFT JOIN monitor_checks mc ON m.id = mc.monitor_id 
                AND mc.checked_at >= $1 AND mc.checked_at <= $2
             WHERE m.user_id = $3 AND m.is_active = true
             GROUP BY m.id, m.name`,
            [startDate, endDate, req.user.userId]
        );

        const incidents = await query(
            `SELECT i.*, m.name as monitor_name FROM incidents i
             JOIN monitors m ON i.monitor_id = m.id
             WHERE m.user_id = $1 AND i.started_at >= $2 AND i.started_at <= $3`,
            [req.user.userId, startDate, endDate]
        );

        const data = {
            period: '7 days',
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            monitors: stats.rows,
            incidents: incidents.rows,
            summary: {
                totalChecks: stats.rows.reduce((sum, m) => sum + parseInt(m.total || 0), 0),
                successfulChecks: stats.rows.reduce((sum, m) => sum + parseInt(m.successful || 0), 0),
                uptime: stats.rows.length > 0 ? Math.round(
                    stats.rows.reduce((sum, m) => sum + (parseInt(m.successful || 0) / parseInt(m.total || 1) * 100), 0)
                ) / stats.rows.length : 100
            }
        };

        const result = await query(
            `INSERT INTO reports (user_id, type, period_start, period_end, data)
             VALUES ($1, 'weekly', $2, $3, $4)
             RETURNING *`,
            [req.user.userId, startDate, endDate, JSON.stringify(data)]
        );

        res.json({ message: 'Weekly report generated', report: result.rows[0] });
    } catch (error) {
        console.error('Generate weekly report error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Download report
router.get('/:id/download', async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }

        const report = result.rows[0];

        const reportContent = generateReportText(report);

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${report.type}-report-${report.period_start?.toISOString().split('T')[0] || 'export'}.txt"`);
        res.send(reportContent);
    } catch (error) {
        console.error('Download report error:', error);
        res.status(500).json({ error: 'Failed to download report' });
    }
});

function generateReportText(report) {
    const data = report.data;
    let text = '';

    text += '═══════════════════════════════════════════════════════════\n';
    text += '                    PULSEGRID REPORT\n';
    text += '═══════════════════════════════════════════════════════════\n\n';

    if (report.type === 'daily') {
        text += `Daily Summary - ${data.date}\n`;
        text += '───────────────────────────────────────────────────\n\n';
    } else if (report.type === 'weekly') {
        text += `Weekly Report - ${data.startDate} to ${data.endDate}\n`;
        text += '───────────────────────────────────────────────────\n\n';
    }

    text += 'MONITOR PERFORMANCE\n';
    text += '───────────────────────────────────────────────────\n';
    
    if (data.monitors && data.monitors.length > 0) {
        data.monitors.forEach(m => {
            const uptime = m.total > 0 ? ((m.successful / m.total) * 100).toFixed(2) : '100.00';
            text += `\n${m.name}\n`;
            text += `  Uptime: ${uptime}%\n`;
            text += `  Avg Response: ${m.avg_response || 0}ms\n`;
            text += `  Total Checks: ${m.total || 0}\n`;
        });
    }

    if (data.summary) {
        text += '\nOVERALL SUMMARY\n';
        text += '───────────────────────────────────────────────────\n';
        text += `Total Checks: ${data.summary.totalChecks || 0}\n`;
        text += `Successful: ${data.summary.successfulChecks || 0}\n`;
        if (data.summary.uptime) text += `Average Uptime: ${data.summary.uptime.toFixed(2)}%\n`;
    }

    text += '\n═══════════════════════════════════════════════════════════\n';
    text += `Generated: ${new Date().toISOString()}\n`;
    text += '═══════════════════════════════════════════════════════════\n';

    return text;
}

module.exports = router;
