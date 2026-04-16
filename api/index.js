const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'pulsegrid-secret-key';

function authMiddleware(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No authorization header' });
        return null;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
        return null;
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const path = req.query.path || '';
    const method = req.method;

    // Auth routes
    if (path === 'auth/login' && method === 'POST') {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, plan: user.plan },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.full_name,
                plan: user.plan
            },
            token
        });
    }

    if (path === 'auth/signup' && method === 'POST') {
        const { email, password, name } = req.body;

        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase())
            .single();

        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const { data: user, error } = await supabase
            .from('users')
            .insert({
                email: email.toLowerCase(),
                password_hash: passwordHash,
                full_name: name,
                plan: 'free',
                is_verified: true
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, plan: user.plan },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(201).json({
            message: 'Registration successful',
            user: { id: user.id, email: user.email, name: user.full_name, plan: user.plan },
            token
        });
    }

    // Monitors routes
    if (path === 'monitors' && method === 'GET') {
        const user = authMiddleware(req, res);
        if (!user) return;

        const { data: monitors, error } = await supabase
            .from('monitors')
            .select('*')
            .eq('user_id', user.userId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.json({ monitors: monitors || [] });
    }

    if (path === 'monitors' && method === 'POST') {
        const user = authMiddleware(req, res);
        if (!user) return;

        const { name, url } = req.body;

        if (!name || !url) {
            return res.status(400).json({ error: 'Name and URL required' });
        }

        const { data: monitor, error } = await supabase
            .from('monitors')
            .insert({
                user_id: user.userId,
                name,
                url,
                method: req.body.method || 'GET',
                interval_seconds: req.body.interval || 60,
                timeout_seconds: req.body.timeout || 30,
                locations: req.body.locations || ['nairobi'],
                status: 'up',
                is_active: true,
                is_paused: false
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(201).json({ monitor });
    }

    if (path.startsWith('monitors/') && path.endsWith('/test') && method === 'POST') {
        const user = authMiddleware(req, res);
        if (!user) return;

        const monitorId = path.split('/')[1];
        
        // Simple health check simulation
        const responseTime = Math.floor(Math.random() * 500) + 100;
        
        return res.json({
            status_code: 200,
            response_time_ms: responseTime,
            is_successful: true,
            checked_at: new Date().toISOString()
        });
    }

    // Incidents
    if (path === 'incidents' && method === 'GET') {
        const user = authMiddleware(req, res);
        if (!user) return;

        const { data: incidents, error } = await supabase
            .from('incidents')
            .select('*')
            .in('monitor_id', 
                (await supabase.from('monitors').select('id').eq('user_id', user.userId)).data?.map(m => m.id) || []
            )
            .order('created_at', { ascending: false })
            .limit(50);

        return res.json({ incidents: incidents || [] });
    }

    // Stats
    if (path === 'stats/overview' && method === 'GET') {
        const user = authMiddleware(req, res);
        if (!user) return;

        const { data: monitors } = await supabase
            .from('monitors')
            .select('*')
            .eq('user_id', user.userId);

        const total = monitors?.length || 0;
        const up = monitors?.filter(m => m.status === 'up' && !m.is_paused).length || 0;
        const down = monitors?.filter(m => m.status !== 'up' && !m.is_paused).length || 0;

        return res.json({
            total_monitors: total,
            monitors_up: up,
            monitors_down: down,
            avg_response_ms: 200
        });
    }

    // Status pages
    if (path === 'status-pages' && method === 'GET') {
        const user = authMiddleware(req, res);
        if (!user) return;

        const { data: pages, error } = await supabase
            .from('status_pages')
            .select('*')
            .eq('user_id', user.userId)
            .order('created_at', { ascending: false });

        return res.json({ statusPages: pages || [] });
    }

    // Health check
    if (path === 'health' && method === 'GET') {
        return res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }

    res.status(404).json({ error: 'Not found' });
};
