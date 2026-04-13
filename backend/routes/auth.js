const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

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
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await query(
            `INSERT INTO users (email, password_hash, full_name, plan) 
             VALUES ($1, $2, $3, 'free') 
             RETURNING id, email, full_name, plan, created_at`,
            [email.toLowerCase(), passwordHash, full_name]
        );

        const user = result.rows[0];
        const token = jwt.sign(
            { userId: user.id, email: user.email, plan: user.plan },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Registration successful',
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                plan: user.plan
            },
            token
        });
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
            `SELECT id, email, password_hash, full_name, company_name, plan, timezone, language 
             FROM users WHERE email = $1`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
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
                plan: user.plan
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
