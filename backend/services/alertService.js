const nodemailer = require('nodemailer');
const axios = require('axios');
const { query } = require('../database/db');

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT || '587'),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }
    return transporter;
}

async function sendAlerts(monitor, checkResult, eventType) {
    try {
        const contacts = await query(`
            SELECT ac.*, u.email as user_email, u.full_name
            FROM alert_contacts ac
            JOIN users u ON u.id = ac.user_id
            JOIN monitors m ON m.user_id = u.id
            WHERE m.id = $1 AND ac.is_active = true
        `, [monitor.id]);

        for (const contact of contacts.rows) {
            try {
                switch (contact.channel) {
                    case 'email':
                        await sendEmailAlert(contact, monitor, checkResult, eventType);
                        break;
                    case 'slack':
                        await sendSlackAlert(contact, monitor, checkResult, eventType);
                        break;
                    case 'discord':
                        await sendDiscordAlert(contact, monitor, checkResult, eventType);
                        break;
                    case 'webhook':
                        await sendWebhookAlert(contact, monitor, checkResult, eventType);
                        break;
                    case 'sms':
                        console.log(`[SMS] Would send SMS to ${contact.value}`);
                        break;
                }
            } catch (error) {
                console.error(`Failed to send ${contact.channel} alert:`, error.message);
            }
        }
    } catch (error) {
        console.error('Error fetching alert contacts:', error);
    }
}

async function sendEmailAlert(contact, monitor, checkResult, eventType) {
    const isDown = eventType === 'down';
    const now = new Date();
    const eatTime = now.toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });

    const subject = isDown 
        ? `[PulseGrid] ${monitor.name} is DOWN`
        : `[PulseGrid] ${monitor.name} has recovered`;

    const headerColor = isDown ? '#FF3366' : '#39FF14';
    const headerText = isDown ? 'Your API is not responding' : 'Your API is back online';
    const icon = isDown ? '[!]' : '[OK]';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; background: #050508; color: #E8E8F0; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: ${headerColor}; padding: 20px; text-align: center; }
            .header h1 { margin: 0; color: ${isDown ? 'white' : 'black'}; font-size: 24px; }
            .content { background: #0D0D18; padding: 30px; border: 1px solid #1A1A2E; }
            .stat { display: inline-block; width: 45%; padding: 15px; margin: 5px; background: #0A0A12; border-radius: 8px; text-align: center; }
            .stat-value { font-size: 20px; font-weight: bold; color: #00F5FF; }
            .stat-label { font-size: 12px; color: #6B6B8A; }
            .alert-box { background: ${isDown ? 'rgba(255,51,102,0.1)' : 'rgba(57,255,20,0.1)'}; border: 1px solid ${headerColor}; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #00F5FF; color: black; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #6B6B8A; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${icon} ${headerText}</h1>
            </div>
            <div class="content">
                <p>Hello ${contact.full_name || 'there'},</p>
                <p>${isDown ? 'We detected an issue with your API monitoring.' : 'Great news! Your API is back online.'}</p>
                
                <div class="alert-box">
                    <strong>Monitor:</strong> ${monitor.name}<br/>
                    <strong>URL:</strong> ${monitor.url}<br/>
                    ${isDown && checkResult ? `<strong>Reason:</strong> ${checkResult.error || 'Unknown error'}<br/>` : ''}
                </div>
                
                <div style="margin: 20px 0;">
                    <div class="stat">
                        <div class="stat-value">${monitor.name}</div>
                        <div class="stat-label">Monitor</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${checkResult?.response_time_ms || 'N/A'}ms</div>
                        <div class="stat-label">Response Time</div>
                    </div>
                </div>
                
                <p style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/monitors/${monitor.id}" class="button">View on PulseGrid</a>
                </p>
                
                <p style="margin-top: 30px; color: #6B6B8A; font-size: 12px;">
                    Time: ${eatTime} (EAT)<br/>
                    You're receiving this because you set up alerts on PulseGrid.
                </p>
            </div>
            <div class="footer">
                <p>PulseGrid - API Monitoring from Nairobi, Kenya</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = isDown
        ? `[PulseGrid] ${monitor.name} is DOWN\n\nMonitor: ${monitor.name}\nURL: ${monitor.url}\nReason: ${checkResult?.error || 'Unknown'}\nTime: ${eatTime}\n\nView: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/monitors/${monitor.id}`
        : `[PulseGrid] ${monitor.name} has recovered\n\nYour API is back online.\nMonitor: ${monitor.name}\nURL: ${monitor.url}\nTime: ${eatTime}`;

    const emailTo = contact.value || contact.user_email;
    
    if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your@gmail.com') {
        console.log(`[EMAIL] Would send to ${emailTo}: ${subject}`);
        return { success: true, mock: true };
    }

    try {
        await getTransporter().sendMail({
            from: process.env.EMAIL_FROM || 'PulseGrid <noreply@pulsegrid.io>',
            to: emailTo,
            subject,
            html,
            text
        });
        console.log(`[EMAIL] Sent alert to ${emailTo}`);
        return { success: true };
    } catch (error) {
        console.error(`[EMAIL] Failed to send to ${emailTo}:`, error.message);
        return { success: false, error: error.message };
    }
}

async function sendSlackAlert(contact, monitor, checkResult, eventType) {
    const isDown = eventType === 'down';
    const color = isDown ? '#FF3366' : '#39FF14';
    const emoji = isDown ? '[!]' : '[OK]';
    
    const payload = {
        attachments: [{
            color,
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `${emoji} *${monitor.name}* is ${isDown ? 'DOWN' : 'recovered'}\nURL: \`${monitor.url}\`${isDown && checkResult ? `\nReason: ${checkResult.error || 'Unknown'}` : ''}`
                    }
                },
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: `Monitored by PulseGrid | ${new Date().toISOString()}`
                        }
                    ]
                }
            ]
        }]
    };

    try {
        await axios.post(contact.value, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[SLACK] Sent alert for ${monitor.name}`);
        return { success: true };
    } catch (error) {
        console.error(`[SLACK] Failed:`, error.message);
        return { success: false, error: error.message };
    }
}

async function sendDiscordAlert(contact, monitor, checkResult, eventType) {
    const isDown = eventType === 'down';
    const color = isDown ? 16711680 : 65280;
    
    const payload = {
       embeds: [{
            title: isDown ? `[!] Monitor Down` : `[OK] Monitor Recovered`,
            description: `**${monitor.name}**\n${monitor.url}`,
            color,
            fields: isDown && checkResult ? [
                {
                    name: 'Reason',
                    value: checkResult.error || 'Unknown error',
                    inline: true
                },
                {
                    name: 'Response Time',
                    value: `${checkResult.response_time_ms || 'N/A'}ms`,
                    inline: true
                }
            ] : [],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'PulseGrid API Monitoring'
            }
        }]
    };

    try {
        await axios.post(contact.value, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[DISCORD] Sent alert for ${monitor.name}`);
        return { success: true };
    } catch (error) {
        console.error(`[DISCORD] Failed:`, error.message);
        return { success: false, error: error.message };
    }
}

async function sendWebhookAlert(contact, monitor, checkResult, eventType) {
    const payload = {
        event: isDown ? 'monitor.down' : 'monitor.recovered',
        monitor: {
            id: monitor.id,
            name: monitor.name,
            url: monitor.url
        },
        checkResult,
        timestamp: new Date().toISOString()
    };

    try {
        await axios.post(contact.value, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        console.log(`[WEBHOOK] Sent alert for ${monitor.name}`);
        return { success: true };
    } catch (error) {
        console.error(`[WEBHOOK] Failed:`, error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendAlerts,
    sendEmailAlert,
    sendSlackAlert,
    sendDiscordAlert,
    sendWebhookAlert
};
