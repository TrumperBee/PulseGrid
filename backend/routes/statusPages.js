const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get all status pages
router.get('/', async (req, res) => {
    try {
        const result = await query(
            `SELECT sp.*, 
                    (SELECT COUNT(*) FROM subscribers WHERE status_page_id = sp.id) as subscriber_count,
                    (SELECT COUNT(*) FROM status_page_monitors WHERE status_page_id = sp.id) as monitor_count
             FROM status_pages sp
             WHERE sp.user_id = $1
             ORDER BY sp.created_at DESC`,
            [req.user.userId]
        );

        res.json({
            statusPages: result.rows.map(sp => ({
                id: sp.id,
                name: sp.name,
                slug: sp.slug,
                customDomain: sp.custom_domain,
                brandColor: sp.brand_color,
                isPublished: sp.is_published,
                subscriberCount: parseInt(sp.subscriber_count),
                monitorCount: parseInt(sp.monitor_count),
                createdAt: sp.created_at
            }))
        });
    } catch (error) {
        console.error('Get status pages error:', error);
        res.status(500).json({ error: 'Failed to get status pages' });
    }
});

// Create status page
router.post('/', async (req, res) => {
    try {
        const { name, slug, customDomain, brandColor, showResponseTimes, allowSubscriptions, showIncidentHistory } = req.body;

        if (!name || !slug) {
            return res.status(400).json({ error: 'Name and slug are required' });
        }

        const slugPattern = /^[a-z0-9-]+$/;
        if (!slugPattern.test(slug)) {
            return res.status(400).json({ error: 'Slug can only contain lowercase letters, numbers, and hyphens' });
        }

        const result = await query(
            `INSERT INTO status_pages (user_id, name, slug, custom_domain, brand_color, show_response_times, allow_subscriptions, show_incident_history)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [req.user.userId, name, slug, customDomain, brandColor || '#00F5FF', showResponseTimes !== false, allowSubscriptions !== false, showIncidentHistory !== false]
        );

        res.status(201).json({ message: 'Status page created', statusPage: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'A status page with this slug already exists' });
        }
        console.error('Create status page error:', error);
        res.status(500).json({ error: 'Failed to create status page' });
    }
});

// Get status page with monitors
router.get('/:id', async (req, res) => {
    try {
        const pageResult = await query(
            'SELECT * FROM status_pages WHERE id = $1',
            [req.params.id]
        );

        if (pageResult.rows.length === 0) {
            return res.status(404).json({ error: 'Status page not found' });
        }

        const monitorsResult = await query(
            `SELECT m.id, m.name, m.url, m.is_active, m.is_paused,
                    spm.display_name,
                    (SELECT is_successful FROM monitor_checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as last_status,
                    (SELECT response_time_ms FROM monitor_checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as last_response
             FROM status_page_monitors spm
             JOIN monitors m ON spm.monitor_id = m.id
             WHERE spm.status_page_id = $1`,
            [req.params.id]
        );

        const incidentsResult = await query(
            `SELECT i.* FROM incidents i
             JOIN status_page_monitors spm ON i.monitor_id = spm.monitor_id
             WHERE spm.status_page_id = $1 AND i.is_resolved = false
             ORDER BY i.started_at DESC
             LIMIT 10`,
            [req.params.id]
        );

        const page = pageResult.rows[0];
        res.json({
            id: page.id,
            name: page.name,
            slug: page.slug,
            customDomain: page.custom_domain,
            brandColor: page.brand_color,
            showResponseTimes: page.show_response_times,
            allowSubscriptions: page.allow_subscriptions,
            showIncidentHistory: page.show_incident_history,
            isPublished: page.is_published,
            monitors: monitorsResult.rows.map(m => ({
                id: m.id,
                name: m.display_name || m.name,
                status: m.is_paused ? 'paused' : m.last_status === false ? 'down' : m.last_status === null ? 'unknown' : 'up',
                responseTime: m.last_response
            })),
            activeIncidents: incidentsResult.rows
        });
    } catch (error) {
        console.error('Get status page error:', error);
        res.status(500).json({ error: 'Failed to get status page' });
    }
});

// Update status page
router.put('/:id', async (req, res) => {
    try {
        const { name, customDomain, brandColor, showResponseTimes, allowSubscriptions, showIncidentHistory, isPublished } = req.body;

        const result = await query(
            `UPDATE status_pages SET 
                name = COALESCE($1, name),
                custom_domain = COALESCE($2, custom_domain),
                brand_color = COALESCE($3, brand_color),
                show_response_times = COALESCE($4, show_response_times),
                allow_subscriptions = COALESCE($5, allow_subscriptions),
                show_incident_history = COALESCE($6, show_incident_history),
                is_published = COALESCE($7, is_published)
             WHERE id = $8 AND user_id = $9
             RETURNING *`,
            [name, customDomain, brandColor, showResponseTimes, allowSubscriptions, showIncidentHistory, isPublished, req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Status page not found' });
        }

        res.json({ message: 'Status page updated', statusPage: result.rows[0] });
    } catch (error) {
        console.error('Update status page error:', error);
        res.status(500).json({ error: 'Failed to update status page' });
    }
});

// Add monitor to status page
router.post('/:id/monitors', async (req, res) => {
    try {
        const { monitorId, displayName } = req.body;

        await query(
            `INSERT INTO status_page_monitors (status_page_id, monitor_id, display_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (status_page_id, monitor_id) DO UPDATE SET display_name = $3`,
            [req.params.id, monitorId, displayName]
        );

        res.json({ message: 'Monitor added to status page' });
    } catch (error) {
        console.error('Add monitor to status page error:', error);
        res.status(500).json({ error: 'Failed to add monitor' });
    }
});

// Remove monitor from status page
router.delete('/:id/monitors/:monitorId', async (req, res) => {
    try {
        await query(
            'DELETE FROM status_page_monitors WHERE status_page_id = $1 AND monitor_id = $2',
            [req.params.id, req.params.monitorId]
        );

        res.json({ message: 'Monitor removed from status page' });
    } catch (error) {
        console.error('Remove monitor error:', error);
        res.status(500).json({ error: 'Failed to remove monitor' });
    }
});

// Delete status page
router.delete('/:id', async (req, res) => {
    try {
        const result = await query(
            'DELETE FROM status_pages WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Status page not found' });
        }

        res.json({ message: 'Status page deleted' });
    } catch (error) {
        console.error('Delete status page error:', error);
        res.status(500).json({ error: 'Failed to delete status page' });
    }
});

// Public endpoint - no auth required
router.get('/public/:slug', async (req, res) => {
    try {
        const pageResult = await query(
            `SELECT * FROM status_pages WHERE slug = $1 AND is_published = true`,
            [req.params.slug]
        );

        if (pageResult.rows.length === 0) {
            return res.status(404).json({ error: 'Status page not found' });
        }

        const page = pageResult.rows[0];

        const monitorsResult = await query(
            `SELECT m.id, m.name, m.url,
                    (SELECT is_successful FROM monitor_checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as last_status,
                    (SELECT response_time_ms FROM monitor_checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as last_response,
                    (SELECT COUNT(*) FROM monitor_checks WHERE monitor_id = m.id AND checked_at > NOW() - INTERVAL '90 days' AND is_successful = true) as uptime_checks,
                    (SELECT COUNT(*) FROM monitor_checks WHERE monitor_id = m.id AND checked_at > NOW() - INTERVAL '90 days') as total_checks
             FROM status_page_monitors spm
             JOIN monitors m ON spm.monitor_id = m.id
             WHERE spm.status_page_id = $1`,
            [page.id]
        );

        const incidentsResult = page.show_incident_history ? await query(
            `SELECT i.started_at, i.resolved_at, i.failure_reason, m.name as monitor_name
             FROM incidents i
             JOIN status_page_monitors spm ON i.monitor_id = spm.monitor_id
             WHERE spm.status_page_id = $1
             ORDER BY i.started_at DESC
             LIMIT 10`,
            [page.id]
        ) : { rows: [] };

        const overallStatus = monitorsResult.rows.some(m => m.last_status === false) ? 'partial' : 'operational';

        res.json({
            name: page.name,
            brandColor: page.brand_color,
            status: overallStatus,
            monitors: monitorsResult.rows.map(m => ({
                name: m.name,
                status: m.last_status === false ? 'down' : 'up',
                responseTime: page.show_response_times ? m.last_response : null,
                uptime: m.total_checks > 0 ? Math.round((m.uptime_checks / m.total_checks) * 10000) / 100 : 100
            })),
            incidents: incidentsResult.rows,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Get public status page error:', error);
        res.status(500).json({ error: 'Failed to get status page' });
    }
});

module.exports = router;
