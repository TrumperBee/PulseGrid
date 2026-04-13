require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function setup() {
    console.log('='.repeat(50));
    console.log('PulseGrid Database Setup');
    console.log('='.repeat(50));
    console.log('');

    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('yourpassword')) {
        console.error('ERROR: Please configure your database in backend/.env');
        console.error('Update DATABASE_URL with your PostgreSQL credentials.');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        // Test connection
        console.log('Connecting to PostgreSQL...');
        await pool.query('SELECT NOW()');
        console.log('Connected successfully!');
        console.log('');

        // Read and execute schema
        console.log('Running schema.sql...');
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('Schema created successfully!');
        console.log('');

        console.log('');
        console.log('='.repeat(50));
        console.log('SETUP COMPLETE!');
        console.log('='.repeat(50));
        console.log('');
        console.log('Database schema is ready.');
        console.log('Users can now sign up through the application.');
        console.log('');
        console.log('To start the backend:');
        console.log('  cd backend');
        console.log('  node server.js');
        console.log('');
        console.log('To start the frontend:');
        console.log('  node server.js');
        console.log('');
        console.log('Then open: http://localhost:3000');
        console.log('='.repeat(50));

    } catch (error) {
        console.error('Setup failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

setup();
