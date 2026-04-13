const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/incidents - List all incidents
router.get('/', async (req, res, next) => {
    try {
        const { monitor_id, status } = req.query;

        let queryStr = `
            SELECT 
                i.id,
                i.monitor_id,
                m.name as monitor_name,
                m.url as monitor_url,
                i.status,
                i.started_at,
                i.resolved_at,
                i.duration_seconds,
                i.failure_reason,
                i.affected_locations,
                i.created_at
            FROM incidents i
            JOIN monitors m ON m.id = i.monitor_id
            WHERE m.user_id = $1
        `;
        
        const params = [req.user.userId];
        
        if (monitor_id) {
            params.push(monitor_id);
            queryStr += ` AND i.monitor_id = $${params.length}`;
        }
        
        if (status === 'resolved') {
            queryStr += ` AND i.resolved_at IS NOT NULL`;
        } else if (status === 'ongoing') {
            queryStr += ` AND i.resolved_at IS NULL`;
        }
        
        queryStr += ` ORDER BY i.started_at DESC LIMIT 100`;

        const result = await query(queryStr, params);

        res.json({
            incidents: result.rows.map(i => ({
                id: i.id,
                monitor_id: i.monitor_id,
                monitor_name: i.monitor_name,
                monitor_url: i.monitor_url,
                status: i.resolved_at ? 'resolved' : 'ongoing',
                started_at: i.started_at,
                resolved_at: i.resolved_at,
                duration_seconds: i.duration_seconds,
                failure_reason: i.failure_reason,
                affected_locations: i.affected_locations,
                is_resolved: i.resolved_at !== null
            }))
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/incidents/:id - Get single incident
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await query(`
            SELECT 
                i.*,
                m.name as monitor_name,
                m.url as monitor_url
            FROM incidents i
            JOIN monitors m ON m.id = i.monitor_id
            WHERE i.id = $1 AND m.user_id = $2
        `, [id, req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Incident not found' });
        }

        const incident = result.rows[0];

        // Get checks during the incident window
        const checksQuery = `
            SELECT 
                mc.checked_at,
                mc.status_code,
                mc.response_time_ms,
                mc.is_successful,
                mc.error_message,
                mc.location
            FROM monitor_checks mc
            WHERE mc.monitor_id = $1
            AND mc.checked_at >= $2
            AND mc.checked_at <= COALESCE($3, NOW())
            ORDER BY mc.checked_at DESC
            LIMIT 50
        `;

        const checksResult = await query(checksQuery, [
            incident.monitor_id,
            incident.started_at,
            incident.resolved_at
        ]);

        res.json({
            incident: {
                id: incident.id,
                monitor_id: incident.monitor_id,
                monitor_name: incident.monitor_name,
                monitor_url: incident.monitor_url,
                status: incident.resolved_at ? 'resolved' : 'ongoing',
                started_at: incident.started_at,
                resolved_at: incident.resolved_at,
                duration_seconds: incident.duration_seconds,
                failure_reason: incident.failure_reason,
                affected_locations: incident.affected_locations,
                is_resolved: incident.resolved_at !== null,
                created_at: incident.created_at
            },
            related_checks: checksResult.rows
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
