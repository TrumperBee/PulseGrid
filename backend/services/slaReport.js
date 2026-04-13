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

const FROM_EMAIL = process.env.FROM_EMAIL || 'reports@pulsegrid.io';
const APP_URL = process.env.APP_URL || 'https://pulsegrid.io';

async function generateSLAReport(userId, month, year) {
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    
    const result = await query(`
        SELECT 
            m.id as monitor_id,
            m.name as monitor_name,
            m.sla_target,
            COUNT(*)::int as total_checks,
            COUNT(*) FILTER (WHERE mc.is_successful = true)::int as successful_checks,
            COUNT(*) FILTER (WHERE mc.is_successful = false)::int as failed_checks,
            ROUND(
                COUNT(*) FILTER (WHERE mc.is_successful = true)::NUMERIC / 
                NULLIF(COUNT(*), 0) * 100, 
                2
            ) as uptime_percentage
        FROM monitors m
        LEFT JOIN monitor_checks mc ON m.id = mc.monitor_id
            AND mc.checked_at >= $2
            AND mc.checked_at <= $3
        WHERE m.user_id = $1
        GROUP BY m.id, m.name, m.sla_target
        ORDER BY m.name
    `, [userId, periodStart, periodEnd]);

    return result.rows.map(row => ({
        ...row,
        sla_met: parseFloat(row.uptime_percentage || 100) >= parseFloat(row.sla_target)
    }));
}

async function sendMonthlySLAReport() {
    try {
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const month = lastMonth.getMonth() + 1;
        const year = lastMonth.getFullYear();
        const monthName = lastMonth.toLocaleString('en', { month: 'long' });

        const usersResult = await query(`
            SELECT DISTINCT u.id, u.email, u.full_name, u.timezone
            FROM users u
            JOIN monitors m ON m.user_id = u.id
            WHERE u.email_alerts_down = true OR u.plan IN ('pro', 'enterprise')
        `);

        for (const user of usersResult.rows) {
            try {
                const report = await generateSLAReport(user.id, month, year);
                
                if (report.length === 0) continue;

                const tableRows = report.map(m => `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #2a2a3a;">${m.monitor_name}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: center; font-family: monospace;">${m.uptime_percentage || 100}%</td>
                        <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: center; font-family: monospace;">${m.sla_target}%</td>
                        <td style="padding: 12px; border-bottom: 1px solid #2a2a3a; text-align: center;">
                            <span style="
                                padding: 4px 12px;
                                border-radius: 4px;
                                font-size: 12px;
                                font-weight: 600;
                                ${m.sla_met 
                                    ? 'background: rgba(34, 197, 94, 0.2); color: #22c55e;' 
                                    : 'background: rgba(239, 68, 68, 0.2); color: #ef4444;'}
                            ">
                                ${m.sla_met ? '✅ SLA MET' : '❌ SLA BREACHED'}
                            </span>
                        </td>
                    </tr>
                `).join('');

                const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #00F5FF 0%, #00c4cc 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; color: #0a0a0f; font-size: 24px; font-weight: 700;">📊 Monthly Uptime Report</h1>
            <p style="margin: 8px 0 0; color: #0a0a0f; font-size: 16px; opacity: 0.9;">${monthName} ${year}</p>
        </div>
        
        <!-- Content -->
        <div style="background-color: #12121a; padding: 30px; border-left: 1px solid #2a2a3a; border-right: 1px solid #2a2a3a;">
            <p style="margin: 0 0 20px; color: #9ca3af; font-size: 14px;">
                Hello${user.full_name ? ` ${user.full_name}` : ''}, here's your uptime report for ${monthName} ${year}.
            </p>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background-color: #1a1a24;">
                        <th style="padding: 12px; text-align: left; color: #9ca3af; font-size: 12px; text-transform: uppercase;">Monitor</th>
                        <th style="padding: 12px; text-align: center; color: #9ca3af; font-size: 12px; text-transform: uppercase;">Uptime</th>
                        <th style="padding: 12px; text-align: center; color: #9ca3af; font-size: 12px; text-transform: uppercase;">Target</th>
                        <th style="padding: 12px; text-align: center; color: #9ca3af; font-size: 12px; text-transform: uppercase;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            
            <div style="background-color: #1a1a24; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 12px; color: #ffffff; font-size: 14px;">Summary</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <p style="margin: 0; color: #6b7280; font-size: 12px;">Total Monitors</p>
                        <p style="margin: 4px 0 0; color: #ffffff; font-size: 18px; font-weight: 600;">${report.length}</p>
                    </div>
                    <div>
                        <p style="margin: 0; color: #6b7280; font-size: 12px;">SLA Met</p>
                        <p style="margin: 4px 0 0; color: #22c55e; font-size: 18px; font-weight: 600;">${report.filter(r => r.sla_met).length}</p>
                    </div>
                    <div>
                        <p style="margin: 0; color: #6b7280; font-size: 12px;">Total Checks</p>
                        <p style="margin: 4px 0 0; color: #ffffff; font-size: 18px; font-weight: 600;">${report.reduce((sum, r) => sum + parseInt(r.total_checks), 0)}</p>
                    </div>
                    <div>
                        <p style="margin: 0; color: #6b7280; font-size: 12px;">SLA Breached</p>
                        <p style="margin: 4px 0 0; color: #ef4444; font-size: 18px; font-weight: 600;">${report.filter(r => !r.sla_met).length}</p>
                    </div>
                </div>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 20px 0;">
                <a href="${APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #00F5FF 0%, #00c4cc 100%); color: #0a0a0f; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none;">
                    View Full Dashboard →
                </a>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #0a0a0f; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #2a2a3a;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
                This report was automatically generated by PulseGrid.
            </p>
            <p style="margin: 8px 0 0; color: #4b5563; font-size: 11px;">
                To manage your notification preferences, visit your <a href="${APP_URL}/settings/notifications" style="color: #00F5FF;">settings</a>.
            </p>
        </div>
    </div>
</body>
</html>`;

                if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
                    console.log(`[SLA REPORT] SMTP not configured. Would send report to ${user.email}`);
                    continue;
                }

                await transporter.sendMail({
                    from: `PulseGrid Reports <${FROM_EMAIL}>`,
                    to: user.email,
                    subject: `[PulseGrid] Monthly Uptime Report — ${monthName} ${year}`,
                    html
                });

                console.log(`[SLA REPORT] Sent monthly report to ${user.email}`);
            } catch (userError) {
                console.error(`[SLA REPORT] Error sending report to ${user.email}:`, userError.message);
            }
        }
    } catch (error) {
        console.error('[SLA REPORT] Error generating monthly reports:', error);
    }
}

module.exports = {
    generateSLAReport,
    sendMonthlySLAReport
};
