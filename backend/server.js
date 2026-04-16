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

// Migration endpoint - run once to set up database
app.post('/api/migrate', async (req, res) => {
    const { query } = require('./database/db');
    const migrationSQL = `
        -- Drop existing tables
        DROP TABLE IF EXISTS incidents CASCADE;
        DROP TABLE IF EXISTS monitor_checks CASCADE;
        DROP TABLE IF EXISTS monitor_locations CASCADE;
        DROP TABLE IF EXISTS monitors CASCADE;
        DROP TABLE IF EXISTS status_page_monitors CASCADE;
        DROP TABLE IF EXISTS status_pages CASCADE;
        DROP TABLE IF EXISTS alert_contacts CASCADE;
        DROP TABLE IF EXISTS api_keys CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TABLE IF EXISTS rum_events CASCADE;
        DROP TABLE IF EXISTS rum_sessions CASCADE;
        DROP TABLE IF EXISTS subscribers CASCADE;

        -- Users table
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            company_name VARCHAR(255),
            timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
            language VARCHAR(10) DEFAULT 'en',
            plan VARCHAR(50) DEFAULT 'free',
            is_verified BOOLEAN DEFAULT true,
            verification_token VARCHAR(255),
            verification_sent_at TIMESTAMP,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Monitors table
        CREATE TABLE monitors (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            url VARCHAR(500) NOT NULL,
            method VARCHAR(10) DEFAULT 'GET',
            headers JSONB DEFAULT '{}',
            body TEXT,
            auth_type VARCHAR(20) DEFAULT 'none',
            auth_value VARCHAR(255),
            interval_seconds INTEGER DEFAULT 60,
            timeout_seconds INTEGER DEFAULT 30,
            locations TEXT[] DEFAULT ARRAY['nairobi'],
            expected_status_code INTEGER DEFAULT 200,
            response_must_contain TEXT,
            response_must_not_contain TEXT,
            max_response_ms INTEGER DEFAULT 3000,
            status VARCHAR(20) DEFAULT 'up',
            is_paused BOOLEAN DEFAULT false,
            is_active BOOLEAN DEFAULT true,
            sla_target DECIMAL(5,2) DEFAULT 99.90,
            tags TEXT[] DEFAULT ARRAY[]::TEXT[],
            last_check_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Monitor locations table
        CREATE TABLE monitor_locations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
            location VARCHAR(50) NOT NULL,
            enabled BOOLEAN DEFAULT true
        );

        -- Monitor checks table
        CREATE TABLE monitor_checks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
            location VARCHAR(50) NOT NULL,
            status_code INTEGER,
            response_time_ms INTEGER,
            dns_time_ms INTEGER DEFAULT 0,
            connect_time_ms INTEGER DEFAULT 0,
            tls_time_ms INTEGER DEFAULT 0,
            ttfb_ms INTEGER DEFAULT 0,
            response_size_bytes INTEGER DEFAULT 0,
            is_successful BOOLEAN DEFAULT false,
            error_message TEXT,
            response_preview TEXT,
            grade VARCHAR(2),
            grade_score INTEGER DEFAULT 0,
            checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Incidents table
        CREATE TABLE incidents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
            reason VARCHAR(255),
            severity VARCHAR(20) DEFAULT 'medium',
            status VARCHAR(20) DEFAULT 'ongoing',
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP,
            location VARCHAR(50),
            affected_locations TEXT[],
            is_resolved BOOLEAN DEFAULT false,
            followup_count INTEGER DEFAULT 0,
            last_followup_sent TIMESTAMP,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Alert contacts table
        CREATE TABLE alert_contacts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(20) NOT NULL,
            value VARCHAR(255) NOT NULL,
            name VARCHAR(100),
            enabled BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Status pages table
        CREATE TABLE status_pages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(100) UNIQUE NOT NULL,
            custom_domain VARCHAR(255),
            brand_color VARCHAR(20) DEFAULT '#00F5FF',
            logo TEXT,
            show_response_times BOOLEAN DEFAULT true,
            allow_subscriptions BOOLEAN DEFAULT true,
            show_incident_history BOOLEAN DEFAULT true,
            is_published BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Status page monitors
        CREATE TABLE status_page_monitors (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            status_page_id UUID REFERENCES status_pages(id) ON DELETE CASCADE,
            monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
            display_name VARCHAR(255),
            UNIQUE(status_page_id, monitor_id)
        );

        -- Subscribers
        CREATE TABLE subscribers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            status_page_id UUID REFERENCES status_pages(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            confirmed BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- API keys table
        CREATE TABLE api_keys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            key_name VARCHAR(100),
            key_prefix VARCHAR(20) NOT NULL,
            key_hash VARCHAR(255) NOT NULL,
            last_used TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- RUM events
        CREATE TABLE rum_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
            session_id VARCHAR(100),
            url TEXT,
            load_time_ms INTEGER,
            dns_time_ms INTEGER,
            tcp_time_ms INTEGER,
            ttfb_ms INTEGER,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- RUM sessions
        CREATE TABLE rum_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
            session_id VARCHAR(100),
            user_agent TEXT,
            ip_address VARCHAR(50),
            country VARCHAR(50),
            city VARCHAR(100),
            first_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_pageview_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Insert demo user (password: password123)
        INSERT INTO users (id, email, password_hash, full_name, company_name, plan, is_verified) VALUES 
        ('550e8400-e29b-41d4-a716-446655440000', 'demo@pulsegrid.io', '$2a$10$jt5WhQGIcrg02Sepsw9GYuDbrE4VOqDP.xMfLruLxqzlTTOdNElpK', 'Demo User', 'PulseGrid Demo', 'free', true);

        -- Insert sample monitors
        INSERT INTO monitors (id, user_id, name, url, status, locations, interval_seconds) VALUES 
        ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Tournament API', 'https://api.tournament.com/health', 'up', ARRAY['nairobi'], 60),
        ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Payment Gateway', 'https://pay.gateway.com/check', 'up', ARRAY['nairobi'], 60),
        ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Auth Service', 'https://auth.service.com/health', 'up', ARRAY['nairobi'], 60),
        ('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', 'CDN Health', 'https://cdn.health.net/status', 'up', ARRAY['nairobi'], 60);

        -- Insert sample checks
        INSERT INTO monitor_checks (monitor_id, location, status_code, response_time_ms, is_successful) VALUES
        ('660e8400-e29b-41d4-a716-446655440001', 'nairobi', 200, 245, true),
        ('660e8400-e29b-41d4-a716-446655440002', 'nairobi', 200, 3421, true),
        ('660e8400-e29b-41d4-a716-446655440003', 'nairobi', 200, 287, true),
        ('660e8400-e29b-41d4-a716-446655440004', 'nairobi', 200, 89, true);

        -- Insert sample incidents
        INSERT INTO incidents (monitor_id, reason, status, location, is_resolved) VALUES
        ('660e8400-e29b-41d4-a716-446655440001', 'High latency detected', 'resolved', 'nairobi', true),
        ('660e8400-e29b-41d4-a716-446655440003', 'Connection timeout', 'ongoing', 'nairobi', false);
    `;
    
    try {
        await query(migrationSQL);
        res.json({ success: true, message: 'Migration completed successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
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
            reports: '/api/reports',
            rum: '/api/rum'
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
app.use('/api/rum', require('./routes/rum'));

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
