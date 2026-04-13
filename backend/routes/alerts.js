const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get alerts for a monitor
router.get('/monitor/:monitorId', async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM alert_contacts 
             WHERE monitor_id = $1 AND is_active = true
             ORDER BY created_at`,
            [req.params.monitorId]
        );

        res.json({
            alerts: result.rows.map(a => ({
                id: a.id,
                channel: a.channel,
                value: a.value,
                createdAt: a.created_at
            }))
        });
    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({ error: 'Failed to get alerts' });
    }
});

// Add alert contact
router.post('/', async (req, res) => {
    try {
        const { monitorId, channel, value } = req.body;

        if (!monitorId || !channel || !value) {
            return res.status(400).json({ error: 'monitorId, channel, and value are required' });
        }

        const result = await query(
            `INSERT INTO alert_contacts (monitor_id, channel, value)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [monitorId, channel, value]
        );

        res.status(201).json({
            message: 'Alert contact added',
            alert: result.rows[0]
        });
    } catch (error) {
        console.error('Add alert error:', error);
        res.status(500).json({ error: 'Failed to add alert' });
    }
});

// Update alert
router.put('/:id', async (req, res) => {
    try {
        const { value, isActive } = req.body;

        const result = await query(
            `UPDATE alert_contacts SET 
                value = COALESCE($1, value),
                is_active = COALESCE($2, is_active)
             WHERE id = $3
             RETURNING *`,
            [value, isActive, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        res.json({ message: 'Alert updated', alert: result.rows[0] });
    } catch (error) {
        console.error('Update alert error:', error);
        res.status(500).json({ error: 'Failed to update alert' });
    }
});

// Delete alert
router.delete('/:id', async (req, res) => {
    try {
        const result = await query(
            'DELETE FROM alert_contacts WHERE id = $1 RETURNING id',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        res.json({ message: 'Alert deleted' });
    } catch (error) {
        console.error('Delete alert error:', error);
        res.status(500).json({ error: 'Failed to delete alert' });
    }
});

module.exports = router;
