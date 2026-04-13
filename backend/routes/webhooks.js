const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get webhook history
router.get('/deliveries', async (req, res) => {
    try {
        const result = await query(
            `SELECT wd.*, ac.value as webhook_url
             FROM webhook_deliveries wd
             JOIN alert_contacts ac ON wd.alert_contact_id = ac.id
             JOIN monitors m ON ac.monitor_id = m.id
             WHERE m.user_id = $1
             ORDER BY wd.delivered_at DESC
             LIMIT 100`,
            [req.user.userId]
        );

        res.json({
            deliveries: result.rows.map(d => ({
                id: d.id,
                webhookUrl: d.value,
                payload: d.payload,
                responseStatus: d.response_status,
                responseBody: d.response_body,
                isSuccess: d.is_success,
                deliveredAt: d.delivered_at
            }))
        });
    } catch (error) {
        console.error('Get webhook history error:', error);
        res.status(500).json({ error: 'Failed to get webhook history' });
    }
});

// Test webhook
router.post('/test', async (req, res) => {
    try {
        const { webhookUrl } = req.body;

        if (!webhookUrl) {
            return res.status(400).json({ error: 'webhookUrl is required' });
        }

        const axios = require('axios');
        
        const payload = {
            event: 'test',
            message: 'This is a test webhook from PulseGrid',
            timestamp: new Date().toISOString()
        };

        let response;
        try {
            response = await axios.post(webhookUrl, payload, {
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });

            res.json({
                success: true,
                statusCode: response.status,
                message: 'Webhook delivered successfully'
            });
        } catch (error) {
            res.json({
                success: false,
                statusCode: error.response?.status || 0,
                message: error.message
            });
        }
    } catch (error) {
        console.error('Test webhook error:', error);
        res.status(500).json({ error: 'Failed to test webhook' });
    }
});

module.exports = router;
