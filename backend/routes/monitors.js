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
        const { tag } = req.query;
        
        let whereClause = 'WHERE m.user_id = $1';
        const params = [req.user.userId];
        
        if (tag) {
            whereClause += ' AND $2 = ANY(m.tags)';
            params.push(tag);
        }

        const result = await query(`
            SELECT 
                m.id, m.name, m.url, m.method, m.status, m.is_paused, m.is_active,
                m.interval_seconds, m.timeout_seconds, m.locations,
                m.expected_status_code, m.response_must_contain, m.max_response_ms,
                m.sla_target, m.tags,
                m.created_at, m.updated_at,
                (
                    SELECT json_build_object(
                        'status_code', mc.status_code,
                        'response_time_ms', mc.response_time_ms,
                        'is_successful', mc.is_successful,
                        'error_message', mc.error_message,
                        'checked_at', mc.checked_at,
                        'grade', mc.grade,
                        'grade_score', mc.grade_score,
                        'dns_time_ms', mc.dns_time_ms,
                        'connect_time_ms', mc.connect_time_ms,
                        'tls_time_ms', mc.tls_time_ms,
                        'ttfb_ms', mc.ttfb_ms,
                        'response_size_bytes', mc.response_size_bytes
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
            ${whereClause}
            ORDER BY m.created_at DESC
        `, params);

        res.json({ monitors: result.rows });
    } catch (error) {
        next(error);
    }
});

// GET /api/monitors/tags - Get all unique tags for user
router.get('/tags', async (req, res, next) => {
    try {
        const result = await query(`
            SELECT DISTINCT unnest(tags) as tag
            FROM monitors
            WHERE user_id = $1 AND array_length(tags, 1) > 0
            ORDER BY tag
        `, [req.user.userId]);

        res.json({ tags: result.rows.map(r => r.tag) });
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
            max_response_ms = 3000, sla_target = 99.90, tags = []
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
        const tagsArr = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);

        const result = await query(`
            INSERT INTO monitors (
                user_id, name, url, method, headers, body,
                auth_type, auth_value, interval_seconds, timeout_seconds,
                locations, expected_status_code, response_must_contain,
                response_must_not_contain, max_response_ms, sla_target, tags
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        `, [
            req.user.userId, name, url, method, headersJson, body,
            auth_type, auth_value, interval_seconds, timeout_seconds,
            locationsArr, expected_status_code, response_must_contain,
            response_must_not_contain, max_response_ms, sla_target, tagsArr
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
            response_must_not_contain, max_response_ms, is_active,
            sla_target, tags
        } = req.body;

        const headersJson = headers ? (typeof headers === 'string' ? headers : JSON.stringify(headers)) : null;
        const tagsArr = tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean)) : null;

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
                sla_target = COALESCE($16, sla_target),
                tags = COALESCE($17, tags),
                updated_at = NOW()
            WHERE id = $18 AND user_id = $19
            RETURNING *
        `, [
            name, url, method, headersJson, body,
            auth_type, auth_value, interval_seconds, timeout_seconds,
            locations, expected_status_code, response_must_contain,
            response_must_not_contain, max_response_ms, is_active,
            sla_target, tagsArr,
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
            ttfb_ms: checkResult.ttfb,
            grade: checkResult.grade,
            grade_score: checkResult.gradeScore,
            response_size_bytes: checkResult.responseSize,
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

// GET /api/monitors/:id/sla - Get SLA stats for monitor
router.get('/:id/sla', async (req, res, next) => {
    try {
        const monitorResult = await query(
            'SELECT sla_target FROM monitors WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (monitorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        const slaTarget = parseFloat(monitorResult.rows[0].sla_target) || 99.90;

        const statsResult = await query(`
            SELECT 
                COUNT(*)::int as total_checks,
                COUNT(*) FILTER (WHERE is_successful = true)::int as successful_checks,
                COUNT(*) FILTER (WHERE is_successful = false)::int as failed_checks
            FROM monitor_checks
            WHERE monitor_id = $1
            AND checked_at >= DATE_TRUNC('month', NOW())
        `, [req.params.id]);

        const currentMonth = new Date();
        const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
        const currentDay = currentMonth.getDate();
        const totalMinutesInMonth = daysInMonth * 24 * 60;
        const elapsedMinutes = currentDay * 24 * 60;

        const stats = statsResult.rows[0];
        const uptimePercentage = stats.total_checks > 0 
            ? ((stats.successful_checks / stats.total_checks) * 100).toFixed(2) 
            : 100;

        const slaMinutes = (slaTarget / 100) * elapsedMinutes;
        const usedMinutes = (parseFloat(uptimePercentage) / 100) * elapsedMinutes;
        const allowedDowntime = totalMinutesInMonth - slaMinutes;
        const downtimeUsed = elapsedMinutes - usedMinutes;
        const downtimeRemaining = allowedDowntime - downtimeUsed;

        const slaMet = parseFloat(uptimePercentage) >= slaTarget;

        const formatMinutes = (mins) => {
            const hours = Math.floor(mins / 60);
            const minutes = Math.round(mins % 60);
            return `${hours}h ${minutes}m`;
        };

        res.json({
            sla_target: slaTarget,
            current_month_uptime: parseFloat(uptimePercentage),
            sla_met: slaMet,
            total_checks: stats.total_checks,
            successful_checks: stats.successful_checks,
            failed_checks: stats.failed_checks,
            downtime_used_seconds: Math.round(downtimeUsed * 60),
            downtime_remaining_seconds: Math.round(downtimeRemaining * 60),
            downtime_used_formatted: formatMinutes(downtimeUsed),
            downtime_remaining_formatted: formatMinutes(Math.max(0, downtimeRemaining)),
            allowed_downtime_formatted: formatMinutes(allowedDowntime)
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/monitors/bulk - Bulk actions
router.post('/bulk', async (req, res, next) => {
    try {
        const { ids, action } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Monitor IDs are required' });
        }

        if (!['pause', 'resume', 'delete'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Use: pause, resume, delete' });
        }

        const idsParam = ids.join(',');
        let result;

        switch (action) {
            case 'pause':
                result = await query(`
                    UPDATE monitors SET is_paused = true, updated_at = NOW()
                    WHERE id = ANY($1) AND user_id = $2
                    RETURNING id
                `, [ids, req.user.userId]);
                break;
            case 'resume':
                result = await query(`
                    UPDATE monitors SET is_paused = false, updated_at = NOW()
                    WHERE id = ANY($1) AND user_id = $2
                    RETURNING id
                `, [ids, req.user.userId]);
                break;
            case 'delete':
                result = await query(`
                    DELETE FROM monitors WHERE id = ANY($1) AND user_id = $2 RETURNING id
                `, [ids, req.user.userId]);
                break;
        }

        res.json({
            message: `Successfully ${action}ed ${result.rows.length} monitors`,
            affected: result.rows.length
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/monitors/:id/response-history - Get response history
router.get('/:id/response-history', async (req, res, next) => {
    try {
        const monitorResult = await query(
            'SELECT id FROM monitors WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (monitorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        const result = await query(`
            SELECT 
                id,
                status_code,
                response_time_ms,
                response_preview,
                is_successful,
                checked_at
            FROM monitor_checks
            WHERE monitor_id = $1
            ORDER BY checked_at DESC
            LIMIT 10
        `, [req.params.id]);

        res.json({
            history: result.rows
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/monitors/:id/sla-history - Get SLA history
router.get('/:id/sla-history', async (req, res, next) => {
    try {
        const monitorResult = await query(
            'SELECT id, sla_target FROM monitors WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (monitorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        const result = await query(`
            SELECT 
                DATE_TRUNC('month', checked_at) as month,
                COUNT(*)::int as total_checks,
                COUNT(*) FILTER (WHERE is_successful = true)::int as successful_checks,
                ROUND(
                    COUNT(*) FILTER (WHERE is_successful = true)::NUMERIC / 
                    NULLIF(COUNT(*), 0) * 100, 
                    2
                ) as uptime_percentage
            FROM monitor_checks
            WHERE monitor_id = $1
            AND checked_at >= NOW() - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', checked_at)
            ORDER BY month DESC
        `, [req.params.id]);

        res.json({
            sla_target: monitorResult.rows[0].sla_target,
            history: result.rows
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
