const nodemailer = require('nodemailer');
const crypto = require('crypto');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@pulsegrid.io';
const APP_URL = process.env.APP_URL || 'https://pulsegrid.io';
const API_URL = process.env.API_URL || 'https://api.pulsegrid.io';

function generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function sendVerificationEmail(email, token, fullName) {
    try {
        const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
        
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
        
        <!-- Content -->
        <div style="background-color: #12121a; padding: 30px; border-left: 1px solid #2a2a3a; border-right: 1px solid #2a2a3a;">
            <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px;">Welcome to PulseGrid${fullName ? `, ${fullName}` : ''}!</h2>
            
            <p style="margin: 0 0 20px; color: #9ca3af; font-size: 16px; line-height: 1.6;">
                Thanks for signing up. Please verify your email address by clicking the button below.
            </p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #00F5FF 0%, #00c4cc 100%); color: #0a0a0f; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none;">
                    Verify Email Address →
                </a>
            </div>
            
            <p style="margin: 0 0 16px; color: #9ca3af; font-size: 14px;">
                Or copy and paste this link into your browser:
            </p>
            <p style="margin: 0; color: #00F5FF; font-size: 12px; word-break: break-all; font-family: monospace;">
                ${verifyUrl}
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #0a0a0f; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #2a2a3a;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
                If you didn't create an account with PulseGrid, you can safely ignore this email.
            </p>
            <p style="margin: 8px 0 0; color: #4b5563; font-size: 11px;">
                © ${new Date().getFullYear()} PulseGrid. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>`;

        const mailOptions = {
            from: `PulseGrid <${FROM_EMAIL}>`,
            to: email,
            subject: 'Verify your PulseGrid account',
            html
        };

        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.log(`[EMAIL] SMTP not configured. Verification URL: ${verifyUrl}`);
            return { sent: false, reason: 'SMTP not configured' };
        }

        await transporter.sendMail(mailOptions);
        console.log(`[EMAIL] Verification email sent to ${email}`);
        return { sent: true };
    } catch (error) {
        console.error(`[EMAIL] Failed to send verification email to ${email}:`, error.message);
        return { sent: false, reason: error.message };
    }
}

async function sendPasswordResetEmail(email, token, fullName) {
    try {
        const resetUrl = `${APP_URL}/reset-password?token=${token}`;
        
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
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">PulseGrid</h1>
            <p style="margin: 8px 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">Password Reset Request</p>
        </div>
        
        <!-- Content -->
        <div style="background-color: #12121a; padding: 30px; border-left: 1px solid #2a2a3a; border-right: 1px solid #2a2a3a;">
            <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px;">Reset your password${fullName ? `, ${fullName}` : ''}</h2>
            
            <p style="margin: 0 0 20px; color: #9ca3af; font-size: 16px; line-height: 1.6;">
                We received a request to reset your PulseGrid password. Click the button below to choose a new one.
            </p>
            
            <div style="background-color: #1a1a24; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #9ca3af; font-size: 14px;">
                    <strong style="color: #f59e0b;">This link expires in 1 hour.</strong> If you didn't request this, you can safely ignore this email.
                </p>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none;">
                    Reset Password →
                </a>
            </div>
            
            <p style="margin: 0 0 16px; color: #9ca3af; font-size: 14px;">
                Or copy and paste this link into your browser:
            </p>
            <p style="margin: 0; color: #f59e0b; font-size: 12px; word-break: break-all; font-family: monospace;">
                ${resetUrl}
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #0a0a0f; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #2a2a3a;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
                If you didn't request a password reset, your account is still secure.
            </p>
        </div>
    </div>
</body>
</html>`;

        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.log(`[EMAIL] SMTP not configured. Reset URL: ${resetUrl}`);
            return { sent: false, reason: 'SMTP not configured' };
        }

        await transporter.sendMail({
            from: `PulseGrid <${FROM_EMAIL}>`,
            to: email,
            subject: 'Reset your PulseGrid password',
            html
        });

        console.log(`[EMAIL] Password reset email sent to ${email}`);
        return { sent: true };
    } catch (error) {
        console.error(`[EMAIL] Failed to send reset email to ${email}:`, error.message);
        return { sent: false, reason: error.message };
    }
}

module.exports = {
    generateVerificationToken,
    sendVerificationEmail,
    sendPasswordResetEmail
};
