const nodemailer = require('nodemailer');

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

async function sendEmail({ to, subject, html, text }) {
    try {
        const transport = getTransporter();
        
        const info = await transport.sendMail({
            from: process.env.EMAIL_FROM || 'PulseGrid <noreply@pulsegrid.io>',
            to,
            subject,
            html,
            text
        });
        
        console.log(`Email sent to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
}

async function sendDownAlert(contact, monitor, incident) {
    const subject = `[PulseGrid] ${monitor.name} is DOWN`;
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; background: #050508; color: #E8E8F0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #FF3366; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; color: white; }
            .content { background: #0D0D18; padding: 30px; border: 1px solid #1A1A2E; }
            .stat { display: inline-block; width: 45%; padding: 15px; margin: 5px; background: #0A0A12; border-radius: 8px; text-align: center; }
            .stat-value { font-size: 24px; font-weight: bold; color: #00F5FF; }
            .stat-label { font-size: 12px; color: #6B6B8A; }
            .error-box { background: rgba(255,51,102,0.1); border: 1px solid #FF3366; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #00F5FF; color: black; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #6B6B8A; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Service Down Alert</h1>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>We're sorry to inform you that <strong>${monitor.name}</strong> is currently <span style="color: #FF3366;">DOWN</span>.</p>
                
                <div class="error-box">
                    <strong>Error:</strong> ${incident.reason || 'Connection failed'}
                </div>
                
                <div style="margin: 20px 0;">
                    <div class="stat">
                        <div class="stat-value">${monitor.url}</div>
                        <div class="stat-label">URL</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${incident.startedAt || new Date().toISOString()}</div>
                        <div class="stat-label">Started At</div>
                    </div>
                </div>
                
                <p style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/monitors/${monitor.id}" class="button">View Monitor</a>
                </p>
                
                <p style="margin-top: 30px;">
                    Our team is automatically investigating this issue. You'll receive another notification when the service recovers.
                </p>
            </div>
            <div class="footer">
                <p>PulseGrid - API Monitoring from Nairobi, Kenya</p>
                <p>This alert was sent because you have email notifications enabled for ${contact.email}</p>
            </div>
        </div>
    </body>
    </html>
    `;
    
    const text = `
PulseGrid Alert: ${monitor.name} is DOWN

Hello,

We're sorry to inform you that ${monitor.name} is currently DOWN.

URL: ${monitor.url}
Error: ${incident.reason || 'Connection failed'}
Started At: ${incident.startedAt || new Date().toISOString()}

Our team is automatically investigating this issue. You'll receive another notification when the service recovers.

View Monitor: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/monitors/${monitor.id}

---
PulseGrid - API Monitoring from Nairobi, Kenya
    `;
    
    return sendEmail({
        to: contact.email,
        subject,
        html,
        text
    });
}

async function sendRecoveryAlert(contact, monitor, checkResult) {
    const subject = `[PulseGrid] ${monitor.name} has recovered`;
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; background: #050508; color: #E8E8F0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #39FF14; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; color: black; }
            .content { background: #0D0D18; padding: 30px; border: 1px solid #1A1A2E; }
            .stat { display: inline-block; width: 45%; padding: 15px; margin: 5px; background: #0A0A12; border-radius: 8px; text-align: center; }
            .stat-value { font-size: 24px; font-weight: bold; color: #39FF14; }
            .stat-label { font-size: 12px; color: #6B6B8A; }
            .button { display: inline-block; background: #00F5FF; color: black; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #6B6B8A; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Service Recovered</h1>
            </div>
            <div class="content">
                <p>Great news! <strong>${monitor.name}</strong> is back <span style="color: #39FF14;">ONLINE</span>.</p>
                
                <div style="margin: 20px 0;">
                    <div class="stat">
                        <div class="stat-value">${checkResult.statusCode || 'OK'}</div>
                        <div class="stat-label">Status Code</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${checkResult.responseTime}ms</div>
                        <div class="stat-label">Response Time</div>
                    </div>
                </div>
                
                <p style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/monitors/${monitor.id}" class="button">View Monitor</a>
                </p>
            </div>
            <div class="footer">
                <p>PulseGrid - API Monitoring from Nairobi, Kenya</p>
            </div>
        </div>
    </body>
    </html>
    `;
    
    const text = `
PulseGrid: ${monitor.name} has recovered

Great news! ${monitor.name} is back ONLINE.

Status Code: ${checkResult.statusCode || 'OK'}
Response Time: ${checkResult.responseTime}ms

View Monitor: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/monitors/${monitor.id}

---
PulseGrid - API Monitoring from Nairobi, Kenya
    `;
    
    return sendEmail({
        to: contact.email,
        subject,
        html,
        text
    });
}

async function sendWeeklyReport(contact, reportData) {
    const subject = `[PulseGrid] Weekly API Status Report`;
    
    const uptimeRows = reportData.monitors.map(m => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #1A1A2E;">${m.name}</td>
            <td style="padding: 12px; border-bottom: 1px solid #1A1A2E; text-align: center; color: ${m.uptime >= 99 ? '#39FF14' : m.uptime >= 95 ? '#FFB800' : '#FF3366'};">${m.uptime}%</td>
            <td style="padding: 12px; border-bottom: 1px solid #1A1A2E; text-align: center;">${m.avgResponse}ms</td>
            <td style="padding: 12px; border-bottom: 1px solid #1A1A2E; text-align: center;">${m.incidents}</td>
        </tr>
    `).join('');
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; background: #050508; color: #E8E8F0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #00F5FF, #39FF14); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; color: black; font-size: 24px; }
            .content { background: #0D0D18; padding: 30px; border: 1px solid #1A1A2E; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { padding: 12px; background: #0A0A12; text-align: left; }
            .button { display: inline-block; background: #00F5FF; color: black; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #6B6B8A; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Weekly API Status Report</h1>
                <p style="margin: 10px 0 0 0; color: #050508;">${reportData.dateRange}</p>
            </div>
            <div class="content">
                <h2 style="color: #00F5FF;">Overall Summary</h2>
                <div style="display: flex; gap: 20px; margin: 20px 0;">
                    <div style="flex: 1; background: #0A0A12; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 32px; font-weight: bold; color: #39FF14;">${reportData.overallUptime}%</div>
                        <div style="color: #6B6B8A;">Average Uptime</div>
                    </div>
                    <div style="flex: 1; background: #0A0A12; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 32px; font-weight: bold; color: #00F5FF;">${reportData.totalChecks.toLocaleString()}</div>
                        <div style="color: #6B6B8A;">Total Checks</div>
                    </div>
                    <div style="flex: 1; background: #0A0A12; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 32px; font-weight: bold; color: #FFB800;">${reportData.totalIncidents}</div>
                        <div style="color: #6B6B8A;">Incidents</div>
                    </div>
                </div>
                
                <h2 style="color: #00F5FF;">Monitor Performance</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Monitor</th>
                            <th style="text-align: center;">Uptime</th>
                            <th style="text-align: center;">Avg Response</th>
                            <th style="text-align: center;">Incidents</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${uptimeRows}
                    </tbody>
                </table>
                
                <p style="text-align: center; margin-top: 30px;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/reports" class="button">View Full Report</a>
                </p>
            </div>
            <div class="footer">
                <p>PulseGrid - API Monitoring from Nairobi, Kenya</p>
                <p>You're receiving this because you have weekly reports enabled.</p>
            </div>
        </div>
    </body>
    </html>
    `;
    
    const text = `
PulseGrid Weekly API Status Report - ${reportData.dateRange}

Overall Summary:
- Average Uptime: ${reportData.overallUptime}%
- Total Checks: ${reportData.totalChecks.toLocaleString()}
- Total Incidents: ${reportData.totalIncidents}

Monitor Performance:
${reportData.monitors.map(m => `- ${m.name}: ${m.uptime}% uptime, ${m.avgResponse}ms avg response, ${m.incidents} incidents`).join('\n')}

View Full Report: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/reports

---
PulseGrid - API Monitoring from Nairobi, Kenya
    `;
    
    return sendEmail({
        to: contact.email,
        subject,
        html,
        text
    });
}

module.exports = {
    sendEmail,
    sendDownAlert,
    sendRecoveryAlert,
    sendWeeklyReport
};
