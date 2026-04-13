require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { testConnection, healthCheck } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

app.get('/api/health', async (req, res) => {
    const dbHealth = await healthCheck();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbHealth,
        version: '1.0.0'
    });
});

app.get('/api', (req, res) => {
    res.json({
        name: 'PulseGrid API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            monitors: '/api/monitors',
            checks: '/api/checks',
            incidents: '/api/incidents',
            stats: '/api/stats',
            statusPages: '/api/status-pages',
            alerts: '/api/alerts',
            users: '/api/users',
            reports: '/api/reports'
        }
    });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/monitors', require('./routes/monitors'));
app.use('/api/monitors', require('./routes/alertContacts'));
app.use('/api/checks', require('./routes/checks'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/status-pages', require('./routes/statusPages'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/webhooks', require('./routes/webhooks'));

app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} does not exist`,
        suggestion: 'Visit /api for available endpoints'
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Internal Server Error';
    
    res.status(statusCode).json({
        error: err.name || 'Error',
        message: message,
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
            path: req.path,
            method: req.method
        })
    });
});

app.listen(PORT, async () => {
    console.log('='.repeat(50));
    console.log('PulseGrid Backend Server');
    console.log('='.repeat(50));
    console.log(`Port: ${PORT}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    console.log(`API Base: http://localhost:${PORT}/api`);
    console.log('='.repeat(50));
    
    await testConnection();
    
    const { startScheduler, runNow } = require('./services/scheduler');
    startScheduler();
    
    setTimeout(() => {
        console.log('Running initial check...');
        runNow();
    }, 3000);
    
    console.log('='.repeat(50));
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

module.exports = app;
