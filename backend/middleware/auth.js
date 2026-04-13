const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
            userId: decoded.userId,
            email: decoded.email
        };
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please login again.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        return res.status(401).json({ error: 'Authentication failed' });
    }
}

function apiKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
        return res.status(401).json({ error: 'API key required. Include X-API-Key header.' });
    }

    const crypto = require('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const { query } = require('../database/db');
    
    query(
        'SELECT user_id FROM api_keys WHERE key_hash = $1 AND is_active = true',
        [keyHash]
    ).then(result => {
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        query(
            'UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1',
            [keyHash]
        );

        req.user = { userId: result.rows[0].user_id };
        next();
    }).catch(error => {
        console.error('API key auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    });
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return next();
    }

    try {
        const decoded = jwt.verify(parts[1], process.env.JWT_SECRET);
        req.user = {
            userId: decoded.userId,
            email: decoded.email
        };
    } catch (error) {
        // Token invalid but that's okay for optional auth
    }

    next();
}

module.exports = {
    authMiddleware,
    apiKeyAuth,
    optionalAuth
};
