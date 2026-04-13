const nodemailer = require('nodemailer');
const { query } = require('../database/db');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const FROM_EMAIL = process.env.FROM_EMAIL || 'alerts@pulsegrid.io';
const APP_URL = process.env.APP_URL || 'https://pulsegrid.io';
const API_URL = process.env.API_URL || 'https://api.pulsegrid.io';

const LOCATION_FLAGS = {
    nairobi: '🇰🇪',
    frankfurt: '🇩🇪',
    newyork: '🇺🇸'
};

const LOCATION_NAMES = {
    nairobi: 'Nairobi, KE',
    frankfurt: 'Frankfurt, DE',
    newyork: 'New York, US'
};

function formatDuration(seconds) {
    if (!seconds || seconds < 60) return `${seconds || 0} seconds`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return `${days}d ${remainingHours}h`;
    }
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m ${secs}s`;
}

function getTimeInTimezone(date, timezone) {
    return new Date(date).toLocaleString('en-US', {
        timeZone: timezone || 'Africa/Nairobi',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

function getErrorType(errorMessage) {
    if (!errorMessage) return 'Unknown error';
    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) return 'Timeout';
    if (errorMessage.includes('ECONNREFUSED')) return 'Connection Refused';
    if (errorMessage.includes('ENOTFOUND')) return 'DNS Resolution Failed';
    if (errorMessage.includes('certificate') || errorMessage.includes('CERT')) return 'SSL Certificate Error';
    if (errorMessage.includes('status') || errorMessage.includes('Expected')) return 'Wrong Status Code';
    if (errorMessage.includes('does not contain') || errorMessage.includes('contains forbidden')) return 'Response Validation Failed';
    return 'Service Unavailable';
}

async function sendDownAlert(monitor, incident, checkResult) {
    try {
        const contacts = await query(`
            SELECT ac.*, u.email, u.full_name, u.timezone
            FROM alert_contacts ac
            JOIN users u ON u.id = ac.user_id
            WHERE ac.monitor_id = $1 AND ac.is_active = true AND ac.channel = 'email'
        `, [monitor.id]);

        if (contacts.rows.length === 0) {
            console.log(`No email contacts for monitor ${monitor.id}`);
            return;
        }

        const errorType = getErrorType(checkResult.error);
        const affectedLocations = incident.affected_locations || ['nairobi'];
        const locationsHtml = affectedLocations.map(loc => 
            `<span style="margin-right: 8px; font-size: 18px;">${LOCATION_FLAGS[loc] || '🌍'} ${LOCATION_NAMES[loc] || loc}</span>`
        ).join(' ');

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #00F5FF 0%, #00c4cc 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; color: #0a0a0f; font-size: 24px; font-weight: 700;">PulseGrid</h1>
            <p style="margin: 8px 0 0; color: #0a0a0f; font-size: 14px; opacity: 0.8;">API Monitoring Platform</p>
        </div>
        
        <!-- Alert Badge -->
        <div style="background-color: #1a1a24; padding: 30px; text-align: center; border-left: 1px solid #2a2a3a; border-right: 1px solid #2a2a3a;">
            <div style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 32px; border-radius: 8px; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                🚨 SERVICE DOWN
            </div>
            <p style="color: #9ca3af; margin-top: 16px; font-size: 14px;">An incident has been detected with your monitored endpoint</p>
        </div>
        
        <!-- Content -->
        <div style="background-color: #12121a; padding: 30px; border-left: 1px solid #2a2a3a; border-right: 1px solid #2a2a3a;">
            <!-- Monitor Info -->
            <div style="background-color: #1a1a24; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 20px;">${monitor.name}</h2>
                <p style="margin: 0; color: #00F5FF; font-family: monospace; font-size: 14px;">${monitor.url}</p>
            </div>
            
            <!-- Details Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                <div style="background-color: #1a1a24; padding: 16px; border-radius: 8px;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Started At</p>
                    <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 500;">${getTimeInTimezone(incident.started_at, 'Africa/Nairobi')}</p>
                    <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px;">EAT (UTC+3)</p>
                </div>
                <div style="background-color: #1a1a24; padding: 16px; border-radius: 8px;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Failure Reason</p>
                    <p style="margin: 0; color: #ef4444; font-size: 14px; font-weight: 500;">${errorType}</p>
                    <p style="margin: 4px 0 0; color: #9ca3af; font-size: 12px;">${checkResult.error || 'No response received'}</p>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                <div style="background-color: #1a1a24; padding: 16px; border-radius: 8px;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Response Time</p>
                    <p style="margin: 0; color: #ef4444; font-size: 24px; font-weight: 700; font-family: monospace;">${checkResult.responseTime || 'N/A'} <span style="font-size: 14px; color: #6b7280;">ms</span></p>
                </div>
                <div style="background-color: #1a1a24; padding: 16px; border-radius: 8px;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Status Code</p>
                    <p style="margin: 0; color: #ef4444; font-size: 24px; font-weight: 700; font-family: monospace;">${checkResult.statusCode || 'N/A'}</p>
                </div>
            </div>
            
            <!-- Locations -->
            <div style="background-color: #1a1a24; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                <p style="margin: 0 0 12px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Affected Locations</p>
                <div>${locationsHtml}</div>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${APP_URL}/monitors/${monitor.id}" style="display: inline-block; background: linear-gradient(135deg, #00F5FF 0%, #00c4cc 100%); color: #0a0a0f; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none;">
                    View on PulseGrid →
                </a>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #0a0a0f; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #2a2a3a;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
                You're receiving this because you set up alerts for this monitor on PulseGrid.
            </p>
            <p style="margin: 8px 0 0; color: #4b5563; font-size: 11px;">
                To manage your alert preferences, visit your <a href="${APP_URL}/settings/notifications" style="color: #00F5FF;">notification settings</a>.
            </p>
        </div>
    </div>
</body>
</html>`;

        const subject = `🚨 [PulseGrid Alert] ${monitor.name} is DOWN`;

        for (const contact of contacts.rows) {
            try {
                await transporter.sendMail({
                    from: `PulseGrid Alerts <${FROM_EMAIL}>`,
                    to: contact.value,
                    subject,
                    html
                });
                console.log(`[EMAIL] Down alert sent to ${contact.value} for monitor ${monitor.name}`);
            } catch (emailError) {
                console.error(`[EMAIL] Failed to send down alert to ${contact.value}:`, emailError.message);
            }
        }
    } catch (error) {
        console.error('[EMAIL] Error sending down alert:', error);
    }
}

async function sendRecoveryAlert(monitor, incident) {
    try {
        const contacts = await query(`
            SELECT ac.*, u.email, u.full_name, u.timezone
            FROM alert_contacts ac
            JOIN users u ON u.id = ac.user_id
            WHERE ac.monitor_id = $1 AND ac.is_active = true AND ac.channel = 'email' AND ac.notify_on_recovery = true
        `, [monitor.id]);

        if (contacts.rows.length === 0) {
            console.log(`No recovery email contacts for monitor ${monitor.id}`);
            return;
        }

        const downtimeDuration = incident.duration_seconds || 0;
        const resolvedAt = incident.resolved_at || new Date();

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">PulseGrid</h1>
            <p style="margin: 8px 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">All Systems Operational</p>
        </div>
        
        <!-- Alert Badge -->
        <div style="background-color: #1a1a24; padding: 30px; text-align: center; border-left: 1px solid #2a2a3a; border-right: 1px solid #2a2a3a;">
            <div style="display: inline-block; background-color: #22c55e; color: white; padding: 12px 32px; border-radius: 8px; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                ✅ SERVICE RECOVERED
            </div>
            <p style="color: #9ca3af; margin-top: 16px; font-size: 14px;">Your monitored endpoint is responding normally</p>
        </div>
        
        <!-- Content -->
        <div style="background-color: #12121a; padding: 30px; border-left: 1px solid #2a2a3a; border-right: 1px solid #2a2a3a;">
            <!-- Monitor Info -->
            <div style="background-color: #1a1a24; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 20px;">${monitor.name}</h2>
                <p style="margin: 0; color: #22c55e; font-family: monospace; font-size: 14px;">${monitor.url}</p>
            </div>
            
            <!-- Details Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                <div style="background-color: #1a1a24; padding: 16px; border-radius: 8px;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Downtime Duration</p>
                    <p style="margin: 0; color: #f59e0b; font-size: 20px; font-weight: 700;">${formatDuration(downtimeDuration)}</p>
                </div>
                <div style="background-color: #1a1a24; padding: 16px; border-radius: 8px;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Recovered At</p>
                    <p style="margin: 0; color: #22c55e; font-size: 16px; font-weight: 500;">${getTimeInTimezone(resolvedAt, 'Africa/Nairobi')}</p>
                    <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px;">EAT (UTC+3)</p>
                </div>
            </div>
            
            <div style="background-color: #1a1a24; padding: 16px; border-radius: 8px; border-left: 4px solid #22c55e;">
                <p style="margin: 0; color: #9ca3af; font-size: 14px;">
                    <span style="color: #22c55e; font-weight: 600;">✓ All systems normal</span> — Your endpoint is now responding correctly.
                </p>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${APP_URL}/monitors/${monitor.id}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none;">
                    View Incident Details →
                </a>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #0a0a0f; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #2a2a3a;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
                You're receiving this because you set up recovery alerts for this monitor on PulseGrid.
            </p>
        </div>
    </div>
</body>
</html>`;

        const subject = `✅ [PulseGrid] ${monitor.name} has recovered`;

        for (const contact of contacts.rows) {
            try {
                await transporter.sendMail({
                    from: `PulseGrid Alerts <${FROM_EMAIL}>`,
                    to: contact.value,
                    subject,
                    html
                });
                console.log(`[EMAIL] Recovery alert sent to ${contact.value} for monitor ${monitor.name}`);
            } catch (emailError) {
                console.error(`[EMAIL] Failed to send recovery alert to ${contact.value}:`, emailError.message);
            }
        }
    } catch (error) {
        console.error('[EMAIL] Error sending recovery alert:', error);
    }
}

async function sendFollowupAlert(monitor, incident) {
    try {
        const contacts = await query(`
            SELECT ac.*, u.email, u.full_name, u.timezone
            FROM alert_contacts ac
            JOIN users u ON u.id = ac.user_id
            WHERE ac.monitor_id = $1 AND ac.is_active = true AND ac.channel = 'email'
        `, [monitor.id]);

        if (contacts.rows.length === 0) return;

        const downtimeDuration = Math.floor((Date.now() - new Date(incident.started_at).getTime()) / 1000);
        const hours = Math.floor(downtimeDuration / 3600);

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">⏰ Follow-up Alert</h1>
            <p style="margin: 8px 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">${hours} hours of downtime</p>
        </div>
        
        <!-- Content -->
        <div style="background-color: #12121a; padding: 30px; border-left: 1px solid #2a2a3a; border-right: 1px solid #2a2a3a;">
            <p style="color: #9ca3af; margin: 0 0 20px; font-size: 16px; line-height: 1.6;">
                This is a reminder that <strong style="color: #ffffff;">${monitor.name}</strong> has been down for over <strong style="color: #f59e0b;">${hours} hours</strong>.
            </p>
            
            <!-- Details -->
            <div style="background-color: #1a1a24; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <div style="margin-bottom: 16px;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Total Downtime</p>
                    <p style="margin: 0; color: #ef4444; font-size: 20px; font-weight: 700;">${formatDuration(downtimeDuration)}</p>
                </div>
                <div style="margin-bottom: 16px;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Incident Started</p>
                    <p style="margin: 0; color: #ffffff; font-size: 14px;">${getTimeInTimezone(incident.started_at, 'Africa/Nairobi')}</p>
                </div>
                <div>
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Follow-up #</p>
                    <p style="margin: 0; color: #f59e0b; font-size: 14px;">${incident.followup_count || 1} of 7</p>
                </div>
            </div>
            
            <!-- Recommendations -->
            <div style="background-color: #1a1a24; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
                <h3 style="margin: 0 0 12px; color: #f59e0b; font-size: 16px;">Recommended Actions</h3>
                <ul style="margin: 0; padding-left: 20px; color: #9ca3af; font-size: 14px; line-height: 1.8;">
                    <li>Check your server logs for error messages</li>
                    <li>Review your hosting provider's status page</li>
                    <li>Verify your server is running and has not been stopped</li>
                    <li>Check if your domain/SSL certificates have expired</li>
                    <li>Ensure your API has not hit rate limits</li>
                    <li>Contact your hosting provider if issues persist</li>
                </ul>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${APP_URL}/monitors/${monitor.id}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none;">
                    View Incident Details →
                </a>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #0a0a0f; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #2a2a3a;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
                Follow-up alerts are sent every 24 hours until the incident is resolved (max 7).
            </p>
        </div>
    </div>
</body>
</html>`;

        const subject = `⏰ [PulseGrid] ${monitor.name} has been DOWN for ${hours} hours`;

        for (const contact of contacts.rows) {
            try {
                await transporter.sendMail({
                    from: `PulseGrid Alerts <${FROM_EMAIL}>`,
                    to: contact.value,
                    subject,
                    html
                });
                console.log(`[EMAIL] Followup #${incident.followup_count} sent to ${contact.value} for monitor ${monitor.name}`);
            } catch (emailError) {
                console.error(`[EMAIL] Failed to send followup to ${contact.value}:`, emailError.message);
            }
        }
    } catch (error) {
        console.error('[EMAIL] Error sending followup alert:', error);
    }
}

module.exports = {
    sendDownAlert,
    sendRecoveryAlert,
    sendFollowupAlert,
    formatDuration
};
