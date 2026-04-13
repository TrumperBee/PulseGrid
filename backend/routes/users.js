const express = require('express');
const router = express.Router();
const { query, transaction } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get user settings
router.get('/settings', async (req, res) => {
    try {
        const result = await query(
            `SELECT email_alerts_down, email_alerts_recover, daily_digest,
                    quiet_hours_enabled, quiet_hours_start, quiet_hours_end
             FROM users WHERE id = $1`,
            [req.user.userId]
        );

        const u = result.rows[0];
        res.json({
            emailAlertsDown: u.email_alerts_down,
            emailAlertsRecover: u.email_alerts_recover,
            dailyDigest: u.daily_digest,
            quietHoursEnabled: u.quiet_hours_enabled,
            quietHoursStart: u.quiet_hours_start,
            quietHoursEnd: u.quiet_hours_end
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// Update notification settings
router.put('/settings/notifications', async (req, res) => {
    try {
        const { emailAlertsDown, emailAlertsRecover, dailyDigest } = req.body;

        await query(
            `UPDATE users SET 
                email_alerts_down = COALESCE($1, email_alerts_down),
                email_alerts_recover = COALESCE($2, email_alerts_recover),
                daily_digest = COALESCE($3, daily_digest)
             WHERE id = $4`,
            [emailAlertsDown, emailAlertsRecover, dailyDigest, req.user.userId]
        );

        res.json({ message: 'Notification settings updated' });
    } catch (error) {
        console.error('Update notifications error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Update quiet hours
router.put('/settings/quiet-hours', async (req, res) => {
    try {
        const { enabled, start, end } = req.body;

        await query(
            `UPDATE users SET 
                quiet_hours_enabled = COALESCE($1, quiet_hours_enabled),
                quiet_hours_start = COALESCE($2, quiet_hours_start),
                quiet_hours_end = COALESCE($3, quiet_hours_end)
             WHERE id = $4`,
            [enabled, start, end, req.user.userId]
        );

        res.json({ message: 'Quiet hours updated' });
    } catch (error) {
        console.error('Update quiet hours error:', error);
        res.status(500).json({ error: 'Failed to update quiet hours' });
    }
});

// Get API key
router.get('/api-key', async (req, res) => {
    try {
        const result = await query(
            `SELECT id, key_prefix, name, last_used_at, created_at
             FROM api_keys WHERE user_id = $1 AND is_active = true
             ORDER BY created_at DESC LIMIT 1`,
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.json({ apiKey: null });
        }

        const key = result.rows[0];
        res.json({
            apiKey: {
                id: key.id,
                prefix: key.key_prefix + '...',
                name: key.name,
                lastUsedAt: key.last_used_at,
                createdAt: key.created_at
            }
        });
    } catch (error) {
        console.error('Get API key error:', error);
        res.status(500).json({ error: 'Failed to get API key' });
    }
});

// Generate API key
router.post('/api-key', async (req, res) => {
    try {
        const { v4: uuidv4 } = require('uuid');
        const crypto = require('crypto');
        
        const rawKey = 'pg_' + crypto.randomBytes(24).toString('hex');
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        const keyPrefix = rawKey.substring(0, 11);

        await query(
            `UPDATE api_keys SET is_active = false WHERE user_id = $1`,
            [req.user.userId]
        );

        const result = await query(
            `INSERT INTO api_keys (user_id, key_hash, key_prefix, name)
             VALUES ($1, $2, $3, $4)
             RETURNING id, key_prefix, created_at`,
            [req.user.userId, keyHash, keyPrefix, 'Default API Key']
        );

        res.json({
            message: 'API key generated. Save this now - it won\'t be shown again!',
            apiKey: rawKey,
            id: result.rows[0].id
        });
    } catch (error) {
        console.error('Generate API key error:', error);
        res.status(500).json({ error: 'Failed to generate API key' });
    }
});

// Get team invites
router.get('/team', async (req, res) => {
    try {
        const result = await query(
            `SELECT ti.*, u.full_name as inviter_name
             FROM team_invites ti
             JOIN users u ON ti.user_id = u.id
             WHERE ti.user_id = $1
             ORDER BY ti.created_at DESC`,
            [req.user.userId]
        );

        res.json({
            invites: result.rows.map(i => ({
                id: i.id,
                email: i.email,
                role: i.role,
                status: i.accepted ? 'accepted' : 'pending',
                expiresAt: i.expires_at,
                createdAt: i.created_at
            }))
        });
    } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({ error: 'Failed to get team invites' });
    }
});

// Invite team member
router.post('/team/invite', async (req, res) => {
    try {
        const { email, role = 'viewer' } = req.body;
        const { v4: uuidv4 } = require('uuid');

        const inviteToken = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await query(
            `INSERT INTO team_invites (user_id, email, role, invite_token, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [req.user.userId, email, role, inviteToken, expiresAt]
        );

        res.json({
            message: 'Invitation sent',
            inviteLink: `${process.env.FRONTEND_URL}/invite/${inviteToken}`
        });
    } catch (error) {
        console.error('Invite error:', error);
        res.status(500).json({ error: 'Failed to send invitation' });
    }
});

module.exports = router;
