const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');
const { generateVerificationToken, sendVerificationEmail, sendPasswordResetEmail } = require('../services/verificationEmail');

// Signup - Register new user
router.post('/signup', async (req, res, next) => {
    try {
        const { email, password, full_name } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ error: 'Email, password, and full_name are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const existingUser = await query(
            'SELECT id, is_verified FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            if (!existingUser.rows[0].is_verified) {
                const token = generateVerificationToken();
                await query(
                    `UPDATE users SET verification_token = $1, verification_sent_at = NOW() WHERE email = $2`,
                    [token, email.toLowerCase()]
                );
                await sendVerificationEmail(email, token, full_name);
                return res.status(200).json({
                    message: 'Verification email resent. Please check your inbox.',
                    email
                });
            }
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const verificationToken = generateVerificationToken();

        const result = await query(
            `INSERT INTO users (email, password_hash, full_name, plan, verification_token, verification_sent_at) 
             VALUES ($1, $2, $3, 'free', $4, NOW()) 
             RETURNING id, email, full_name, plan, created_at, is_verified`,
            [email.toLowerCase(), passwordHash, full_name, verificationToken]
        );

        const user = result.rows[0];
        
        const emailResult = await sendVerificationEmail(email, verificationToken, full_name);
        
        if (!emailResult.sent) {
            console.log(`[AUTH] Could not send verification email: ${emailResult.reason}`);
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, plan: user.plan },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: emailResult.sent ? 'Registration successful. Please check your email to verify your account.' : 'Registration successful',
            emailSent: emailResult.sent,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                plan: user.plan,
                is_verified: user.is_verified
            },
            token
        });
    } catch (error) {
        next(error);
    }
});

// Verify email
router.get('/verify-email', async (req, res, next) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: 'Verification token is required' });
        }

        const result = await query(
            `SELECT id, email, full_name, verification_sent_at FROM users 
             WHERE verification_token = $1 AND is_verified = false`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        const user = result.rows[0];
        
        if (user.verification_sent_at) {
            const sentAt = new Date(user.verification_sent_at);
            const now = new Date();
            const hoursDiff = (now - sentAt) / (1000 * 60 * 60);
            if (hoursDiff > 24) {
                return res.status(400).json({ error: 'Verification link has expired. Please request a new one.' });
            }
        }

        await query(
            `UPDATE users SET is_verified = true, verification_token = NULL WHERE id = $1`,
            [user.id]
        );

        const jwtToken = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Email verified successfully!',
            token: jwtToken
        });
    } catch (error) {
        next(error);
    }
});

// Resend verification email
router.post('/resend-verification', async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const result = await query(
            `SELECT id, email, full_name, is_verified, verification_sent_at FROM users WHERE email = $1`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No account found with this email' });
        }

        const user = result.rows[0];

        if (user.is_verified) {
            return res.status(400).json({ error: 'This email is already verified' });
        }

        if (user.verification_sent_at) {
            const sentAt = new Date(user.verification_sent_at);
            const now = new Date();
            const secondsDiff = (now - sentAt) / 1000;
            if (secondsDiff < 60) {
                const remainingSeconds = Math.ceil(60 - secondsDiff);
                return res.status(429).json({ 
                    error: `Please wait ${remainingSeconds} seconds before requesting another verification email`,
                    retryAfter: remainingSeconds
                });
            }
        }

        const token = generateVerificationToken();
        await query(
            `UPDATE users SET verification_token = $1, verification_sent_at = NOW() WHERE id = $2`,
            [token, user.id]
        );

        const emailResult = await sendVerificationEmail(email, token, user.full_name);
        
        if (!emailResult.sent) {
            return res.status(500).json({ error: 'Failed to send verification email. Please try again later.' });
        }

        res.json({ message: 'Verification email sent successfully', email });
    } catch (error) {
        next(error);
    }
});

// Forgot password
router.post('/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const result = await query(
            `SELECT id, email, full_name FROM users WHERE email = $1 AND is_verified = true`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
        }

        const user = result.rows[0];
        const token = generateVerificationToken();
        
        await query(
            `UPDATE users SET verification_token = $1, verification_sent_at = NOW() WHERE id = $2`,
            [token, user.id]
        );

        await sendPasswordResetEmail(email, token, user.full_name);

        res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
    } catch (error) {
        next(error);
    }
});

// Reset password
router.post('/reset-password', async (req, res, next) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const result = await query(
            `SELECT id, email, verification_sent_at FROM users WHERE verification_token = $1`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const user = result.rows[0];
        
        if (user.verification_sent_at) {
            const sentAt = new Date(user.verification_sent_at);
            const now = new Date();
            const hoursDiff = (now - sentAt) / (1000 * 60 * 60);
            if (hoursDiff > 1) {
                return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
            }
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await query(
            `UPDATE users SET password_hash = $1, verification_token = NULL, verification_sent_at = NULL WHERE id = $2`,
            [passwordHash, user.id]
        );

        res.json({ message: 'Password reset successfully. You can now sign in.' });
    } catch (error) {
        next(error);
    }
});

// Register alias for /signup
router.post('/register', async (req, res, next) => {
    req.body.full_name = req.body.fullName;
    req.body.fullName = undefined;
    return router.stack.find(r => r.route && r.route.path === '/signup').route.stack[0].handle(req, res, next);
});

// Login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await query(
            `SELECT id, email, password_hash, full_name, company_name, plan, timezone, language, is_verified
             FROM users WHERE email = $1`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        
        if (!user.is_verified) {
            return res.status(403).json({ 
                error: 'Please verify your email before signing in',
                emailVerified: false,
                email: user.email
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, plan: user.plan },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                company_name: user.company_name,
                plan: user.plan,
                is_verified: user.is_verified
            },
            token
        });
    } catch (error) {
        next(error);
    }
});

// Get current user
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, email, full_name, company_name, plan, created_at
             FROM users WHERE id = $1`,
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        res.json({
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            company_name: user.company_name,
            plan: user.plan,
            created_at: user.created_at
        });
    } catch (error) {
        next(error);
    }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res, next) => {
    try {
        const { full_name, company_name } = req.body;

        const result = await query(
            `UPDATE users SET 
                full_name = COALESCE($1, full_name),
                company_name = COALESCE($2, company_name),
                updated_at = NOW()
             WHERE id = $3
             RETURNING id, email, full_name, company_name, plan, created_at`,
            [full_name, company_name, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                company_name: user.company_name,
                plan: user.plan
            }
        });
    } catch (error) {
        next(error);
    }
});

// Change password
router.post('/change-password', authMiddleware, async (req, res, next) => {
    try {
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'current_password and new_password are required' });
        }

        if (new_password.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        const userResult = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isValid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const newHash = await bcrypt.hash(new_password, 10);
        await query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [newHash, req.user.userId]
        );

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        next(error);
    }
});

// Alias for change-password
router.put('/password', authMiddleware, async (req, res, next) => {
    req.body.current_password = req.body.currentPassword;
    req.body.new_password = req.body.newPassword;
    return router.stack.find(r => r.route && r.route.path === '/change-password').route.stack[0].handle(req, res, next);
});

// Verify token
router.get('/verify', authMiddleware, async (req, res) => {
    res.json({ valid: true, userId: req.user.userId });
});

module.exports = router;
