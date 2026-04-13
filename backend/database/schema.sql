-- PulseGrid Database Schema
-- Run this with: psql -d pulsegrid -f database/schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables (in reverse dependency order) for clean setup
DROP TABLE IF EXISTS alert_contacts CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS monitor_checks CASCADE;
DROP TABLE IF EXISTS monitors CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS user_plan CASCADE;
DROP TYPE IF EXISTS alert_channel CASCADE;
DROP TYPE IF EXISTS incident_severity CASCADE;

-- Create enum types
CREATE TYPE user_plan AS ENUM ('free', 'starter', 'pro', 'enterprise');
CREATE TYPE alert_channel AS ENUM ('email', 'sms', 'slack', 'discord', 'webhook');
CREATE TYPE incident_severity AS ENUM ('critical', 'high', 'medium', 'low');

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    company_name VARCHAR(255),
    plan user_plan DEFAULT 'free',
    timezone VARCHAR(100) DEFAULT 'Africa/Nairobi',
    language VARCHAR(10) DEFAULT 'en',
    email_alerts_down BOOLEAN DEFAULT true,
    email_alerts_recover BOOLEAN DEFAULT true,
    daily_digest BOOLEAN DEFAULT true,
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '23:00',
    quiet_hours_end TIME DEFAULT '07:00',
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    verification_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- MONITORS TABLE
-- ============================================
CREATE TABLE monitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    method VARCHAR(10) DEFAULT 'GET',
    headers JSONB DEFAULT '{}',
    body TEXT,
    auth_type VARCHAR(20) DEFAULT 'none',
    auth_value TEXT,
    interval_seconds INTEGER DEFAULT 300,
    timeout_seconds INTEGER DEFAULT 30,
    locations TEXT[] DEFAULT ARRAY['nairobi', 'frankfurt', 'newyork'],
    expected_status_code INTEGER DEFAULT 200,
    response_must_contain TEXT,
    response_must_not_contain TEXT,
    max_response_ms INTEGER DEFAULT 3000,
    status VARCHAR(20) DEFAULT 'up',
    last_check_at TIMESTAMP WITH TIME ZONE,
    avg_response INTEGER DEFAULT 0,
    sla_target DECIMAL(5,2) DEFAULT 99.90,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_paused BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- MONITOR CHECKS TABLE (historical check results)
-- ============================================
CREATE TABLE monitor_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    location VARCHAR(50),
    status_code INTEGER,
    response_time_ms INTEGER,
    is_successful BOOLEAN,
    error_message TEXT,
    response_body_preview TEXT,
    dns_time_ms INTEGER,
    connect_time_ms INTEGER,
    tls_time_ms INTEGER,
    ttfb_ms INTEGER,
    content_transfer_ms INTEGER,
    response_size_bytes INTEGER DEFAULT 0,
    grade CHAR(1),
    grade_score INTEGER,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INCIDENTS TABLE
-- ============================================
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'investigating',
    severity incident_severity DEFAULT 'medium',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    affected_locations TEXT[],
    failure_reason TEXT,
    is_resolved BOOLEAN DEFAULT false,
    last_followup_sent TIMESTAMP WITH TIME ZONE,
    followup_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ALERT CONTACTS TABLE
-- ============================================
CREATE TABLE alert_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    notify_on_recovery BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STATUS PAGES TABLE
-- ============================================
CREATE TABLE status_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    custom_domain VARCHAR(255),
    brand_color VARCHAR(7) DEFAULT '#00F5FF',
    logo_url TEXT,
    show_response_times BOOLEAN DEFAULT true,
    allow_subscriptions BOOLEAN DEFAULT true,
    show_incident_history BOOLEAN DEFAULT true,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STATUS PAGE MONITORS (many-to-many)
-- ============================================
CREATE TABLE status_page_monitors (
    status_page_id UUID REFERENCES status_pages(id) ON DELETE CASCADE,
    monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    PRIMARY KEY (status_page_id, monitor_id)
);

-- ============================================
-- MAINTENANCE WINDOWS TABLE
-- ============================================
CREATE TABLE maintenance_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status_page_id UUID REFERENCES status_pages(id) ON DELETE CASCADE,
    title VARCHAR(255),
    message TEXT,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SUBSCRIBERS TABLE (status page email subscriptions)
-- ============================================
CREATE TABLE subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    confirmed BOOLEAN DEFAULT false,
    confirm_token VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- WEBHOOK DELIVERIES TABLE (log webhook attempts)
-- ============================================
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_contact_id UUID REFERENCES alert_contacts(id) ON DELETE CASCADE,
    payload JSONB,
    response_status INTEGER,
    response_body TEXT,
    is_success BOOLEAN,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- API KEYS TABLE
-- ============================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    name VARCHAR(255),
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- ============================================
-- TEAM MEMBERS TABLE
-- ============================================
CREATE TABLE team_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'viewer',
    invite_token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    accepted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- REPORTS TABLE
-- ============================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    period_start DATE,
    period_end DATE,
    data JSONB,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- RUM EVENTS TABLE (Real User Monitoring)
-- ============================================
CREATE TABLE rum_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    load_time_ms INTEGER NOT NULL,
    url TEXT NOT NULL,
    referrer TEXT,
    user_agent TEXT,
    country VARCHAR(50),
    ip_address VARCHAR(45),
    session_id VARCHAR(64),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- RUM SESSIONS TABLE (for bounce rate calculation)
-- ============================================
CREATE TABLE rum_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(64) UNIQUE NOT NULL,
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    first_pageview_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_pageview_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    pageview_count INTEGER DEFAULT 1,
    country VARCHAR(50),
    ip_address VARCHAR(45)
);

-- ============================================
-- RESPONSE HISTORY TABLE (last 5 responses per monitor)
-- ============================================
CREATE TABLE response_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status_code INTEGER,
    response_time_ms INTEGER,
    response_preview TEXT,
    is_successful BOOLEAN,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SLA REPORTS TABLE
-- ============================================
CREATE TABLE sla_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    monitor_id UUID REFERENCES monitors(id) ON DELETE SET NULL,
    period_month DATE NOT NULL,
    uptime_percentage DECIMAL(5,2),
    total_checks INTEGER,
    successful_checks INTEGER,
    failed_checks INTEGER,
    total_downtime_seconds INTEGER,
    sla_met BOOLEAN,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(monitor_id, period_month)
);

-- ============================================
-- INDEXES (for query performance)
-- ============================================
CREATE INDEX idx_monitors_user_id ON monitors(user_id);
CREATE INDEX idx_monitors_is_active ON monitors(is_active);
CREATE INDEX idx_monitors_tags ON monitors USING GIN(tags);
CREATE INDEX idx_monitor_checks_monitor_id ON monitor_checks(monitor_id);
CREATE INDEX idx_monitor_checks_checked_at ON monitor_checks(checked_at);
CREATE INDEX idx_monitor_checks_location ON monitor_checks(location);
CREATE INDEX idx_incidents_monitor_id ON incidents(monitor_id);
CREATE INDEX idx_incidents_is_resolved ON incidents(is_resolved);
CREATE INDEX idx_incidents_started_at ON incidents(started_at);
CREATE INDEX idx_alert_contacts_monitor_id ON alert_contacts(monitor_id);
CREATE INDEX idx_status_pages_user_id ON status_pages(user_id);
CREATE INDEX idx_subscribers_status_page_id ON subscribers(status_page_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_rum_events_monitor_id ON rum_events(monitor_id);
CREATE INDEX idx_rum_events_timestamp ON rum_events(timestamp);
CREATE INDEX idx_rum_events_session_id ON rum_events(session_id);
CREATE INDEX idx_rum_sessions_monitor_id ON rum_sessions(monitor_id);
CREATE INDEX idx_rum_sessions_last_pageview ON rum_sessions(last_pageview_at);
CREATE INDEX idx_response_history_monitor_id ON response_history(monitor_id);
CREATE INDEX idx_sla_reports_user_id ON sla_reports(user_id);
CREATE INDEX idx_sla_reports_period ON sla_reports(period_month);

-- ============================================
-- TRIGGER for updated_at auto-update
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monitors_updated_at BEFORE UPDATE ON monitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_status_pages_updated_at BEFORE UPDATE ON status_pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS for common queries
-- ============================================

-- Recent checks with response times
CREATE OR REPLACE VIEW recent_checks AS
SELECT 
    mc.*,
    m.name as monitor_name,
    m.url as monitor_url,
    u.id as user_id
FROM monitor_checks mc
JOIN monitors m ON mc.monitor_id = m.id
JOIN users u ON m.user_id = u.id
ORDER BY mc.checked_at DESC;

-- Active incidents with monitor details
CREATE OR REPLACE VIEW active_incidents AS
SELECT 
    i.*,
    m.name as monitor_name,
    m.url as monitor_url,
    u.id as user_id,
    u.email as user_email
FROM incidents i
JOIN monitors m ON i.monitor_id = m.id
JOIN users u ON m.user_id = u.id
WHERE i.is_resolved = false;

-- Uptime stats per monitor (last 30 days)
CREATE OR REPLACE VIEW uptime_stats_30d AS
SELECT 
    m.id as monitor_id,
    m.name,
    COUNT(CASE WHEN mc.is_successful = true THEN 1 END) as successful_checks,
    COUNT(*) as total_checks,
    ROUND(
        COUNT(CASE WHEN mc.is_successful = true THEN 1 END)::NUMERIC / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) as uptime_percentage,
    AVG(mc.response_time_ms) as avg_response_time,
    MAX(mc.checked_at) as last_check_at
FROM monitors m
LEFT JOIN monitor_checks mc ON m.id = mc.monitor_id 
    AND mc.checked_at > NOW() - INTERVAL '30 days'
WHERE m.is_active = true
GROUP BY m.id, m.name;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE users IS 'PulseGrid user accounts';
COMMENT ON TABLE monitors IS 'API endpoints being monitored';
COMMENT ON TABLE monitor_checks IS 'Historical record of each check performed';
COMMENT ON TABLE incidents IS 'Downtime incidents tracked per monitor';
COMMENT ON TABLE alert_contacts IS 'Notification channels per monitor (email, SMS, webhook)';
COMMENT ON TABLE status_pages IS 'Public status pages users can create';
COMMENT ON TABLE subscribers IS 'Email subscriptions for status pages';

COMMENT ON COLUMN users.plan IS 'Subscription tier: free, starter, pro, enterprise';
COMMENT ON COLUMN monitors.locations IS 'Geographic regions to check from: nairobi, frankfurt, newyork';
COMMENT ON COLUMN monitors.auth_type IS 'Authentication type: none, bearer, apikey, basic';
COMMENT ON COLUMN monitor_checks.ttfb_ms IS 'Time to first byte in milliseconds';
