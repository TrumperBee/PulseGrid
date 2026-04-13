require('dotenv').config();

const USE_MOCK_DB = process.env.USE_MOCK_DB === 'true' || !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('yourpassword');

let pool = null;
let MockDB = null;

if (!USE_MOCK_DB) {
    const { Pool } = require('pg');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    pool.on('connect', () => {
        console.log('New database connection established');
    });

    pool.on('error', (err) => {
        console.error('Unexpected database error:', err);
    });
} else {
    console.log('Using MOCK database (PostgreSQL not available)');
    MockDB = {
        users: [],
        monitors: [],
        checks: [],
        incidents: [],
        alertContacts: [],
        statusPages: [],
        apiKeys: [],
        nextId: () => require('uuid').v4()
    };
}

async function query(text, params) {
    const start = Date.now();
    
    if (USE_MOCK_DB) {
        return mockQuery(text, params);
    }
    
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log(`Query: ${duration}ms`);
        return result;
    } catch (error) {
        console.error('Query error:', error.message);
        throw error;
    }
}

function mockQuery(text, params) {
    const now = new Date().toISOString();
    const lowerText = text.toLowerCase().trim();
    
    if (lowerText.startsWith('select now()')) {
        return { rows: [{ current_time: now, pg_version: 'Mock PostgreSQL 1.0' }], rowCount: 1 };
    }
    
    if (lowerText === 'select 1') {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    
    if (lowerText.includes('from users') && !lowerText.includes('insert')) {
        if (lowerText.includes('where email')) {
            const email = params?.[0];
            const user = MockDB.users.find(u => u.email === email);
            return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
        }
        return { rows: MockDB.users, rowCount: MockDB.users.length };
    }
    
    if (lowerText.startsWith('insert into users')) {
        const user = {
            id: MockDB.nextId(),
            email: params[0],
            password_hash: params[1],
            full_name: params[2] || null,
            company_name: params[3] || null,
            plan: 'free',
            timezone: 'Africa/Nairobi',
            created_at: now,
            updated_at: now
        };
        MockDB.users.push(user);
        return { rows: [user], rowCount: 1 };
    }
    
    if (lowerText.startsWith('select') && lowerText.includes('from monitors')) {
        const userId = params?.[0];
        let monitors = MockDB.monitors;
        if (userId) {
            monitors = monitors.filter(m => m.user_id === userId);
        }
        return { rows: monitors, rowCount: monitors.length };
    }
    
    if (lowerText.startsWith('insert into monitors')) {
        const monitor = {
            id: MockDB.nextId(),
            user_id: params[0],
            name: params[1],
            url: params[2],
            method: params[3] || 'GET',
            status: 'up',
            is_paused: false,
            created_at: now,
            updated_at: now
        };
        MockDB.monitors.push(monitor);
        return { rows: [monitor], rowCount: 1 };
    }
    
    if (lowerText.startsWith('insert into incidents')) {
        const incident = {
            id: MockDB.nextId(),
            monitor_id: params[0],
            status: params[1] || 'investigating',
            reason: params[2],
            started_at: now,
            created_at: now
        };
        MockDB.incidents.push(incident);
        return { rows: [incident], rowCount: 1 };
    }
    
    if (lowerText.startsWith('select') && lowerText.includes('from incidents')) {
        return { rows: MockDB.incidents, rowCount: MockDB.incidents.length };
    }
    
    if (lowerText.startsWith('insert into alert_contacts')) {
        const contact = {
            id: MockDB.nextId(),
            user_id: params[0],
            channel: params[1],
            value: params[2],
            is_active: true,
            created_at: now
        };
        MockDB.alertContacts.push(contact);
        return { rows: [contact], rowCount: 1 };
    }
    
    return { rows: [], rowCount: 0 };
}

async function getClient() {
    if (USE_MOCK_DB) {
        return {
            query: mockQuery,
            release: () => {}
        };
    }
    return pool.connect();
}

async function transaction(callback) {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        if (!USE_MOCK_DB) await client.query('COMMIT');
        return result;
    } catch (error) {
        if (!USE_MOCK_DB) await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function testConnection() {
    if (USE_MOCK_DB) {
        console.log('Mock database initialized');
        return true;
    }
    
    try {
        const result = await query('SELECT NOW() as current_time, version() as pg_version');
        console.log('Database connected successfully!');
        return true;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        return false;
    }
}

async function healthCheck() {
    if (USE_MOCK_DB) {
        return { status: 'healthy', mode: 'mock', timestamp: new Date().toISOString() };
    }
    
    try {
        await query('SELECT 1');
        return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
        return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
}

module.exports = {
    query,
    getClient,
    transaction,
    testConnection,
    healthCheck,
    pool
};
