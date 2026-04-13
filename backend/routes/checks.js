const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get checks for a monitor
router.get('/monitor/:monitorId', async (req, res) => {
    try {
        const { period = '24h' } = req.query;
        let interval;
        
        switch (period) {
            case '1h': interval = '1 hour'; break;
            case '24h': interval = '24 hours'; break;
            case '7d': interval = '7 days'; break;
            case '30d': interval = '30 days'; break;
            default: interval = '24 hours';
        }

        const result = await query(
            `SELECT mc.* FROM monitor_checks mc
             JOIN monitors m ON mc.monitor_id = m.id
             WHERE mc.monitor_id = $1 AND m.user_id = $2 AND mc.checked_at > NOW() - INTERVAL '${interval}'
             ORDER BY mc.checked_at DESC
             LIMIT 1000`,
            [req.params.monitorId, req.user.userId]
        );

        res.json({
            checks: result.rows.map(c => ({
                id: c.id,
                location: c.location,
                statusCode: c.status_code,
                responseTime: c.response_time_ms,
                isSuccessful: c.is_successful,
                error: c.error_message,
                checkedAt: c.checked_at,
                grade: c.grade,
                gradeScore: c.grade_score,
                dnsTime: c.dns_time_ms,
                connectTime: c.connect_time_ms,
                tlsTime: c.tls_time_ms,
                ttfb: c.ttfb_ms,
                responseSize: c.response_size_bytes
            }))
        });
    } catch (error) {
        console.error('Get checks error:', error);
        res.status(500).json({ error: 'Failed to get checks' });
    }
});

// Get all recent checks
router.get('/', async (req, res) => {
    try {
        const result = await query(
            `SELECT mc.*, m.name as monitor_name 
             FROM monitor_checks mc
             JOIN monitors m ON mc.monitor_id = m.id
             WHERE m.user_id = $1
             ORDER BY mc.checked_at DESC
             LIMIT 100`,
            [req.user.userId]
        );

        res.json({
            checks: result.rows.map(c => ({
                id: c.id,
                monitorId: c.monitor_id,
                monitorName: c.monitor_name,
                location: c.location,
                statusCode: c.status_code,
                responseTime: c.response_time_ms,
                isSuccessful: c.is_successful,
                error: c.error_message,
                checkedAt: c.checked_at,
                grade: c.grade,
                gradeScore: c.grade_score,
                dnsTime: c.dns_time_ms,
                connectTime: c.connect_time_ms,
                tlsTime: c.tls_time_ms,
                ttfb: c.ttfb_ms,
                responseSize: c.response_size_bytes
            }))
        });
    } catch (error) {
        console.error('Get checks error:', error);
        res.status(500).json({ error: 'Failed to get checks' });
    }
});

module.exports = router;
