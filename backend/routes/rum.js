const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const crypto = require('crypto');

const MAX_REQUESTS_PER_MINUTE = 100;

const rateLimits = new Map();

function checkRateLimit(monitorId, ip) {
    const key = `${monitorId}:${ip}`;
    const now = Date.now();
    const windowStart = now - 60000;

    if (!rateLimits.has(key)) {
        rateLimits.set(key, { count: 1, windowStart: now });
        return true;
    }

    const limit = rateLimits.get(key);
    if (now - limit.windowStart > 60000) {
        limit.count = 1;
        limit.windowStart = now;
        return true;
    }

    if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
        return false;
    }

    limit.count++;
    return true;
}

function getOrCreateSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

router.post('/:monitorId', optionalAuth, async (req, res) => {
    const { monitorId } = req.params;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';

    if (!checkRateLimit(monitorId, ip)) {
        return res.status(429).json({ error: 'Rate limit exceeded. Max 100 requests per minute per monitor.' });
    }

    try {
        const { loadTime, url, referrer, timestamp } = req.body;

        if (!loadTime || typeof loadTime !== 'number') {
            return res.status(400).json({ error: 'loadTime is required and must be a number' });
        }

        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'url is required and must be a string' });
        }

        const monitorResult = await query(
            'SELECT id, user_id FROM monitors WHERE id = $1',
            [monitorId]
        );

        if (monitorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        const sessionId = req.body.sessionId || getOrCreateSessionId();

        const country = req.headers['cf-ipcountry'] || 
                        req.headers['x-vercel-ip-country'] || 
                        'unknown';

        await query(`
            INSERT INTO rum_events (
                monitor_id, load_time_ms, url, referrer, user_agent,
                country, ip_address, session_id, timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            monitorId,
            loadTime,
            url.substring(0, 2048),
            referrer ? referrer.substring(0, 2048) : null,
            userAgent.substring(0, 512),
            country,
            ip,
            sessionId,
            timestamp ? new Date(timestamp) : new Date()
        ]);

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        await query(`
            INSERT INTO rum_sessions (session_id, monitor_id, last_pageview_at, country, ip_address)
            VALUES ($1, $2, NOW(), $3, $4)
            ON CONFLICT (session_id) DO UPDATE SET
                last_pageview_at = NOW(),
                pageview_count = rum_sessions.pageview_count + 1
        `, [sessionId, monitorId, country, ip]);

        res.json({ 
            success: true, 
            sessionId,
            message: 'RUM event recorded'
        });
    } catch (error) {
        console.error('RUM POST error:', error);
        res.status(500).json({ error: 'Failed to record RUM event' });
    }
});

router.get('/:monitorId/stats', authMiddleware, async (req, res) => {
    const { monitorId } = req.params;

    try {
        const monitorResult = await query(
            'SELECT id, user_id FROM monitors WHERE id = $1 AND user_id = $2',
            [monitorId, req.user.userId]
        );

        if (monitorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        const statsResult = await query(`
            SELECT 
                COUNT(*)::int as total_events,
                AVG(load_time_ms)::int as avg_load_time_ms,
                MIN(load_time_ms)::int as min_load_time_ms,
                MAX(load_time_ms)::int as max_load_time_ms,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY load_time_ms) as p50_load_time_ms,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY load_time_ms) as p95_load_time_ms,
                COUNT(DISTINCT session_id)::int as unique_sessions
            FROM rum_events
            WHERE monitor_id = $1 AND timestamp >= $2
        `, [monitorId, twentyFourHoursAgo]);

        const pageviews24h = await query(`
            SELECT COUNT(*)::int as count
            FROM rum_events
            WHERE monitor_id = $1 AND timestamp >= $2
        `, [monitorId, twentyFourHoursAgo]);

        const pageviews1h = await query(`
            SELECT COUNT(*)::int as count
            FROM rum_events
            WHERE monitor_id = $1 AND timestamp >= $2
        `, [monitorId, oneHourAgo]);

        const activeSessions = await query(`
            SELECT COUNT(DISTINCT session_id)::int as count
            FROM rum_sessions
            WHERE monitor_id = $1 AND last_pageview_at >= $2
        `, [monitorId, fiveMinutesAgo]);

        const sessionStats = await query(`
            SELECT 
                COUNT(*)::int as total_sessions,
                COUNT(*) FILTER (WHERE pageview_count = 1)::int as bounce_sessions
            FROM rum_sessions
            WHERE monitor_id = $1 AND first_pageview_at >= $2
        `, [monitorId, twentyFourHoursAgo]);

        const satisfactionResult = await query(`
            SELECT 
                COUNT(*) FILTER (WHERE load_time_ms < 500)::int as satisfied,
                COUNT(*) FILTER (WHERE load_time_ms >= 500 AND load_time_ms <= 2000)::int as tolerating,
                COUNT(*) FILTER (WHERE load_time_ms > 2000)::int as frustrated,
                COUNT(*)::int as total
            FROM rum_events
            WHERE monitor_id = $1 AND timestamp >= $2
        `, [monitorId, twentyFourHoursAgo]);

        const stats = statsResult.rows[0];
        const satisfaction = satisfactionResult.rows[0];
        const sessions = sessionStats.rows[0];

        const totalEvents = parseInt(stats.total_events) || 0;
        const satisfied = parseInt(satisfaction.satisfied) || 0;
        const tolerating = parseInt(satisfaction.tolerating) || 0;
        const frustrated = parseInt(satisfaction.frustrated) || 0;

        const apdexScore = totalEvents > 0 
            ? ((satisfied + tolerating / 2) / totalEvents).toFixed(2)
            : '1.00';

        const bounceRate = sessions.total_sessions > 0
            ? ((sessions.bounce_sessions / sessions.total_sessions) * 100).toFixed(1)
            : '0.0';

        res.json({
            avg_load_time_ms: parseInt(stats.avg_load_time_ms) || 0,
            min_load_time_ms: parseInt(stats.min_load_time_ms) || 0,
            max_load_time_ms: parseInt(stats.max_load_time_ms) || 0,
            p50_load_time_ms: parseInt(stats.p50_load_time_ms) || 0,
            p95_load_time_ms: parseInt(stats.p95_load_time_ms) || 0,
            pageviews_last_24h: pageviews24h.rows[0].count,
            pageviews_last_hour: pageviews1h.rows[0].count,
            active_sessions_5min: activeSessions.rows[0].count,
            unique_sessions_24h: stats.unique_sessions || 0,
            bounce_rate: bounceRate,
            apdex_score: parseFloat(apdexScore),
            satisfaction: {
                satisfied,
                tolerating,
                frustrated,
                total: totalEvents
            }
        });
    } catch (error) {
        console.error('RUM stats error:', error);
        res.status(500).json({ error: 'Failed to get RUM stats' });
    }
});

router.get('/:monitorId/timeseries', authMiddleware, async (req, res) => {
    const { monitorId } = req.params;
    const { period = '24h' } = req.query;

    let interval, startTime;
    switch (period) {
        case '1h':
            interval = '5 minutes';
            startTime = new Date(Date.now() - 60 * 60 * 1000);
            break;
        case '24h':
            interval = '30 minutes';
            startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            interval = '6 hours';
            startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            break;
        default:
            interval = '30 minutes';
            startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    try {
        const monitorResult = await query(
            'SELECT id, user_id FROM monitors WHERE id = $1 AND user_id = $2',
            [monitorId, req.user.userId]
        );

        if (monitorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Monitor not found' });
        }

        const result = await query(`
            SELECT 
                time_bucket($1, timestamp) as bucket,
                AVG(load_time_ms)::int as avg_load_time,
                COUNT(*)::int as pageviews,
                COUNT(DISTINCT session_id)::int as sessions
            FROM rum_events
            WHERE monitor_id = $2 AND timestamp >= $3
            GROUP BY bucket
            ORDER BY bucket ASC
        `, [interval, monitorId, startTime]);

        res.json({
            period,
            interval,
            data: result.rows.map(row => ({
                timestamp: row.bucket,
                avg_load_time_ms: row.avg_load_time,
                pageviews: row.pageviews,
                sessions: row.sessions
            }))
        });
    } catch (error) {
        console.error('RUM timeseries error:', error);
        res.status(500).json({ error: 'Failed to get RUM timeseries' });
    }
});

router.get('/:monitorId/top-pages', authMiddleware, async (req, res) => {
    const { monitorId } = req.params;

    try {
        const result = await query(`
            SELECT 
                url,
                COUNT(*)::int as pageviews,
                AVG(load_time_ms)::int as avg_load_time,
                COUNT(DISTINCT session_id)::int as unique_visitors
            FROM rum_events
            WHERE monitor_id = $1 AND timestamp >= NOW() - INTERVAL '24 hours'
            GROUP BY url
            ORDER BY pageviews DESC
            LIMIT 20
        `, [monitorId]);

        res.json({ pages: result.rows });
    } catch (error) {
        console.error('RUM top pages error:', error);
        res.status(500).json({ error: 'Failed to get top pages' });
    }
});

setInterval(() => {
    const now = Date.now();
    const cutoff = now - 3600000;
    for (const [key, value] of rateLimits.entries()) {
        if (value.windowStart < cutoff) {
            rateLimits.delete(key);
        }
    }
}, 60000);

module.exports = router;
