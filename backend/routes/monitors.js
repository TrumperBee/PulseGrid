const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');
const { checkEndpoint, runMonitorCheck } = require('../services/checker');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/monitors - Get all monitors for user
router.get('/', async (req, res, next) => {
    try {
        const result = await query(`
            SELECT 
                m.id, m.name, m.url, m.method, m.status, m.is_paused, m.is_active,
                m.interval_seconds, m.timeout_seconds, m.locations,
                m.expected_status_code, m.response_must_contain, m.max_response_ms,
                m.created_at, m.updated_at,
                (
                    SELECT json_build_object(
                        'status_code', mc.status_code,
                        'response_time_ms', mc.response_time_ms,
                        'is_successful', mc.is_successful,
                        'error_message', mc.error_message,
                        'checked_at', mc.checked_at
                    )
                    FROM monitor_checks mc
                    WHERE mc.monitor_id = m.id
                    ORDER BY mc.checked_at DESC
                    LIMIT 1
                ) as last_check,
                (
                    SELECT COUNT(*)::int
                    FROM incidents i
                    WHERE i.monitor_id = m.id
                    AND i.created_at > NOW() - INTERVAL '30 days'
                ) as incident_count_30d
            FROM monitors m
            WHERE m.user_id = $1
            ORDER BY m.created_at DESC
        `, [req.user.userId]);

        res.json({ monitors: result.rows });
    } catch (error) {
        next(error);
    }
});

// POST /api/monitors - Create new monitor
router.post('/', async (req, res, next) => {
    try {
        const {
            name, url, method = 'GET', headers = {},
            body, auth_type = 'none', auth_value,
            interval_seconds = 300, timeout_seconds = 30,
            locations = ['nairobi'], expected_status_code = 200,
            response_must_contain, response_must_not_contain,
            max_response_ms = 3000
        } = req.body;

        // Validate required fields
        if (!name || !url) {
            return res.status(400).json({ error: 'Name and URL are required' });
        }

        // Validate URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return res.status(400).json({ error: 'URL must start with http:// or https://' });
        }

        // Check plan limits
        const userPlan = req.user.plan || 'free';
        const planLimits = { free: 5, starter: 20, pro: 100, enterprise: 1000 };
        const maxMonitors = planLimits[userPlan] || 5;

        const countResult = await query(
            'SELECT COUNT(*)::int as count FROM monitors WHERE user_id = $1',
            [req.user.userId]
        );

        if (countResult.rows[0].count >= maxMonitors) {
            return res.status(403).json({ 
                error: `Plan limit reached. Upgrade to add more monitors.`,
                plan: userPlan,
                maxMonitors
            });
        }

        // Insert monitor
        const headersJson = typeof headers === 'string' ? headers : JSON.stringify(headers);
        const locationsArr = Array.isArray(locations) ? locations : [locations];

        const result = await query(`
            INSERT INTO monitors (
                user_id, name, url, method, headers, body,
                auth_type, auth_value, interval_seconds, timeout_seconds,
                locations, expected_status_code, response_must_contain,
                response_must_not_contain, max_response_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [
            req.user.userId, name, url, method, headersJson, body,
            auth_type, auth_value, interval_seconds, timeout_seconds,
            locationsArr, expected_status_code, response_must_contain,
            response_must_not_contain, max_response_ms
        ]);

        const monitor = result.rows[0];

        // Immediately trigger one check
        try {
            await runMonitorCheck(monitor.id);
        } catch (checkError) {
            console.error('Initial check failed:', checkError.message);
        }

        // Get updated monitor with check result
        const updatedResult = await query(
            'SELECT * FROM monitors WHERE id = $1',
            [monitor.id]
        );

        res.status(201).json({
            message: 'Monitor created',
            monitor: updatedResult.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/monitors/:id - Get single monitor
router.get('/:id', async (req, res, next) => {
    try {
        const result = await query(`
            SELECT m.*,
                (SELECT json_agg(mc.* ORDER BY mc.checked_at DESC)
                 FROM monitor_checks mc WHERE mc.monitor_id = m.id LIMIT 100) as checks,
                (SELECT json_agg(i.* ORDER BY i.created_at DESC)
                 FROM incidents i WHERE i.monitor_id = m.id LIMIT 50) as incidents
            FROM monitors m
            WHERE m.id = $1 AND m.user_id = $2
        `, [req.params.id, req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        res.json({ monitor: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// PUT /api/monitors/:id - Update monitor
router.put('/:id', async (req, res, next) => {
    try {
        // Verify ownership
        const checkOwner = await query(
            'SELECT id FROM monitors WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (checkOwner.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        const {
            name, url, method, headers, body,
            auth_type, auth_value, interval_seconds, timeout_seconds,
            locations, expected_status_code, response_must_contain,
            response_must_not_contain, max_response_ms, is_active
        } = req.body;

        const headersJson = headers ? (typeof headers === 'string' ? headers : JSON.stringify(headers)) : null;

        const result = await query(`
            UPDATE monitors SET
                name = COALESCE($1, name),
                url = COALESCE($2, url),
                method = COALESCE($3, method),
                headers = COALESCE($4, headers),
                body = COALESCE($5, body),
                auth_type = COALESCE($6, auth_type),
                auth_value = COALESCE($7, auth_value),
                interval_seconds = COALESCE($8, interval_seconds),
                timeout_seconds = COALESCE($9, timeout_seconds),
                locations = COALESCE($10, locations),
                expected_status_code = COALESCE($11, expected_status_code),
                response_must_contain = COALESCE($12, response_must_contain),
                response_must_not_contain = COALESCE($13, response_must_not_contain),
                max_response_ms = COALESCE($14, max_response_ms),
                is_active = COALESCE($15, is_active),
                updated_at = NOW()
            WHERE id = $16 AND user_id = $17
            RETURNING *
        `, [
            name, url, method, headersJson, body,
            auth_type, auth_value, interval_seconds, timeout_seconds,
            locations, expected_status_code, response_must_contain,
            response_must_not_contain, max_response_ms, is_active,
            req.params.id, req.user.userId
        ]);

        res.json({
            message: 'Monitor updated',
            monitor: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/monitors/:id - Delete monitor
router.delete('/:id', async (req, res, next) => {
    try {
        // Verify ownership
        const result = await query(
            'DELETE FROM monitors WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        // CASCADE will delete related checks and incidents
        res.json({ message: 'Monitor deleted' });
    } catch (error) {
        next(error);
    }
});

// POST /api/monitors/:id/test - Run immediate test
router.post('/:id/test', async (req, res, next) => {
    try {
        // Verify ownership
        const monitorResult = await query(
            'SELECT * FROM monitors WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (monitorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        const monitor = monitorResult.rows[0];
        
        // Run the check
        const checkResult = await checkEndpoint(monitor);

        res.json({
            status_code: checkResult.statusCode,
            response_time_ms: checkResult.responseTime,
            is_successful: checkResult.isSuccessful,
            error_message: checkResult.error,
            response_body_preview: checkResult.responseBody,
            dns_time_ms: checkResult.dnsTime,
            connect_time_ms: checkResult.connectTime,
            tls_time_ms: checkResult.tlsTime,
            checked_at: checkResult.checkedAt
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/monitors/:id/pause - Pause monitor
router.post('/:id/pause', async (req, res, next) => {
    try {
        const result = await query(`
            UPDATE monitors SET is_paused = true, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `, [req.params.id, req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        res.json({ message: 'Monitor paused', monitor: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// POST /api/monitors/:id/resume - Resume monitor
router.post('/:id/resume', async (req, res, next) => {
    try {
        const result = await query(`
            UPDATE monitors SET is_paused = false, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `, [req.params.id, req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        res.json({ message: 'Monitor resumed', monitor: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
