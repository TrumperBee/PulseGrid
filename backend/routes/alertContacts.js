const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/monitors/:id/alerts - Get alert contacts for a monitor
router.get('/:id/alerts', async (req, res, next) => {
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
                ac.id,
                ac.channel,
                ac.value,
                ac.is_active,
                ac.notify_on_recovery,
                ac.created_at
            FROM alert_contacts ac
            JOIN monitors m ON m.user_id = ac.user_id
            WHERE m.id = $1
            ORDER BY ac.created_at DESC
        `, [id]);

        res.json({
            alert_contacts: result.rows.map(ac => ({
                id: ac.id,
                channel: ac.channel,
                value: ac.value,
                is_active: ac.is_active,
                notify_on_recovery: ac.notify_on_recovery,
                created_at: ac.created_at
            }))
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/monitors/:id/alerts - Create alert contact
router.post('/:id/alerts', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { channel, value, notify_on_recovery = true } = req.body;

        // Validate required fields
        if (!channel) {
            return res.status(400).json({ error: 'Channel is required' });
        }

        // Validate channel type
        const validChannels = ['email', 'sms', 'slack', 'discord', 'webhook'];
        if (!validChannels.includes(channel)) {
            return res.status(400).json({ 
                error: `Invalid channel. Must be one of: ${validChannels.join(', ')}` 
            });
        }

        // Validate value
        if (!value) {
            return res.status(400).json({ error: 'Value is required' });
        }

        // Validate email format if channel is email
        if (channel === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }
        }

        // Verify monitor belongs to user and get user_id
        const monitorResult = await query(
            'SELECT id, user_id FROM monitors WHERE id = $1 AND user_id = $2',
            [id, req.user.userId]
        );

        if (monitorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        const userId = monitorResult.rows[0].user_id;

        // Insert alert contact
        const result = await query(`
            INSERT INTO alert_contacts (user_id, channel, value, notify_on_recovery)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [userId, channel, value, notify_on_recovery]);

        const contact = result.rows[0];

        res.status(201).json({
            message: 'Alert contact created',
            alert_contact: {
                id: contact.id,
                channel: contact.channel,
                value: contact.value,
                is_active: contact.is_active,
                notify_on_recovery: contact.notify_on_recovery,
                created_at: contact.created_at
            }
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/monitors/:id/alerts/:contactId - Delete alert contact
router.delete('/:id/alerts/:contactId', async (req, res, next) => {
    try {
        const { id, contactId } = req.params;

        // Verify monitor belongs to user
        const monitorCheck = await query(
            'SELECT user_id FROM monitors WHERE id = $1 AND user_id = $2',
            [id, req.user.userId]
        );

        if (monitorCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        // Delete alert contact
        const result = await query(`
            DELETE FROM alert_contacts 
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `, [contactId, req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Alert contact not found' });
        }

        res.json({ message: 'Alert contact removed' });
    } catch (error) {
        next(error);
    }
});

// PUT /api/monitors/:id/alerts/:contactId - Update alert contact
router.put('/:id/alerts/:contactId', async (req, res, next) => {
    try {
        const { id, contactId } = req.params;
        const { is_active, notify_on_recovery } = req.body;

        // Verify monitor belongs to user
        const monitorCheck = await query(
            'SELECT user_id FROM monitors WHERE id = $1 AND user_id = $2',
            [id, req.user.userId]
        );

        if (monitorCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        const result = await query(`
            UPDATE alert_contacts SET
                is_active = COALESCE($1, is_active),
                notify_on_recovery = COALESCE($2, notify_on_recovery)
            WHERE id = $3 AND user_id = $4
            RETURNING *
        `, [is_active, notify_on_recovery, contactId, req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Alert contact not found' });
        }

        res.json({
            message: 'Alert contact updated',
            alert_contact: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
