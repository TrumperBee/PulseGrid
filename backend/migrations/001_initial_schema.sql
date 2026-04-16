-- Initial database schema for PulseGrid
-- Run: psql -U postgres -d pulsegrid -f "C:\Projects\PulseGrid\backend\migrations\001_initial_schema.sql"

-- Drop existing tables if any
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS monitor_checks CASCADE;
DROP TABLE IF EXISTS monitor_locations CASCADE;
DROP TABLE IF EXISTS monitors CASCADE;
DROP TABLE IF EXISTS status_page_monitors CASCADE;
DROP TABLE IF EXISTS status_pages CASCADE;
DROP TABLE IF EXISTS alert_contacts CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS users CASCADE;

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
    interval INTEGER DEFAULT 60,
    timeout INTEGER DEFAULT 30,
    status VARCHAR(20) DEFAULT 'up',
    uptime DECIMAL(5,2) DEFAULT 100.00,
    avg_response INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_paused BOOLEAN DEFAULT false,
    locations VARCHAR(255) DEFAULT 'KE,DE,US',
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

-- Checks table (named monitor_checks for scheduler compatibility)
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
    is_successful BOOLEAN DEFAULT false,
    error_message TEXT,
    response_body_preview TEXT,
    response_size_bytes INTEGER DEFAULT 0,
    grade VARCHAR(2),
    grade_score INTEGER DEFAULT 0,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Incidents table
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
    reason VARCHAR(255),
    status VARCHAR(20) DEFAULT 'ongoing',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    location VARCHAR(50),
    is_resolved BOOLEAN DEFAULT false,
    followup_count INTEGER DEFAULT 0,
    last_followup_sent TIMESTAMP
);

-- Alert contacts table
CREATE TABLE alert_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    value VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Status pages table
CREATE TABLE status_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    subdomain VARCHAR(100),
    brand_color VARCHAR(20) DEFAULT '#00F5FF',
    logo TEXT,
    custom_domain VARCHAR(255),
    show_response_times BOOLEAN DEFAULT true,
    allow_subscriptions BOOLEAN DEFAULT true,
    show_incident_history BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Status page monitors
CREATE TABLE status_page_monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_page_id UUID REFERENCES status_pages(id) ON DELETE CASCADE,
    monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE
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

-- Insert sample data (password: password123)
INSERT INTO users (id, email, password_hash, full_name, company_name, plan, is_verified) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 'demo@pulsegrid.io', '$2a$10$jt5WhQGIcrg02Sepsw9GYuDbrE4VOqDP.xMfLruLxqzlTTOdNElpK', 'Demo User', 'PulseGrid Demo', 'free', true);

INSERT INTO monitors (id, user_id, name, url, status, uptime, avg_response) VALUES 
    ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Tournament API', 'https://api.tournament.com/health', 'up', 99.87, 245),
    ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Payment Gateway', 'https://pay.gateway.com/check', 'up', 100.00, 3421),
    ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Auth Service', 'https://auth.service.com/health', 'slow', 98.20, 287),
    ('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', 'CDN Health', 'https://cdn.health.net/status', 'up', 100.00, 89);

INSERT INTO monitor_checks (monitor_id, location, status_code, response_time_ms, is_successful) VALUES
    ('660e8400-e29b-41d4-a716-446655440001', 'KE', 200, 245, true),
    ('660e8400-e29b-41d4-a716-446655440002', 'KE', 200, 3421, true),
    ('660e8400-e29b-41d4-a716-446655440003', 'KE', 200, 287, true),
    ('660e8400-e29b-41d4-a716-446655440004', 'KE', 200, 89, true);

INSERT INTO incidents (monitor_id, reason, status, location, is_resolved) VALUES
    ('660e8400-e29b-41d4-a716-446655440001', 'High latency detected', 'resolved', 'KE', true),
    ('660e8400-e29b-41d4-a716-446655440003', 'Connection timeout', 'ongoing', 'KE', false);
