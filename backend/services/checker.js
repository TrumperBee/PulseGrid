const axios = require('axios');
const https = require('https');
const { query } = require('../database/db');
const { sendDownAlert, sendRecoveryAlert } = require('./emailService');

function calculateGrade(responseTime, uptime, variance) {
    const rtScore = responseTime < 200 ? 40 : 
                    responseTime < 500 ? 30 : 
                    responseTime < 1000 ? 20 : 
                    responseTime < 2000 ? 10 : 0;
    
    const upScore = uptime >= 100 ? 40 : 
                    uptime >= 99.9 ? 35 : 
                    uptime >= 99.5 ? 25 : 
                    uptime >= 99 ? 15 : 0;
    
    const varScore = variance < 10 ? 20 : 
                      variance < 25 ? 15 : 
                      variance < 50 ? 10 : 5;
    
    const total = rtScore + upScore + varScore;
    
    if (total >= 90) return { grade: 'A', score: total };
    if (total >= 75) return { grade: 'B', score: total };
    if (total >= 60) return { grade: 'C', score: total };
    if (total >= 40) return { grade: 'D', score: total };
    return { grade: 'F', score: total };
}

async function getMonitorUptime(monitorId, days = 30) {
    try {
        const result = await query(`
            SELECT 
                COUNT(*) FILTER (WHERE is_successful = true) as success_count,
                COUNT(*) as total_count,
                STDDEV(response_time_ms) as variance
            FROM monitor_checks 
            WHERE monitor_id = $1 
            AND checked_at >= NOW() - INTERVAL '${days} days'
        `, [monitorId]);
        
        if (result.rows.length === 0 || result.rows[0].total_count === '0') {
            return { uptime: 100, variance: 0 };
        }
        
        const row = result.rows[0];
        const uptime = (parseInt(row.success_count) / parseInt(row.total_count)) * 100;
        const variance = parseFloat(row.variance) || 0;
        
        return { uptime: uptime.toFixed(2), variance: Math.round(variance) };
    } catch (error) {
        return { uptime: 100, variance: 0 };
    }
}

async function getRecentResponseTime(monitorId) {
    try {
        const result = await query(`
            SELECT AVG(response_time_ms) as avg_time
            FROM monitor_checks 
            WHERE monitor_id = $1 
            AND checked_at >= NOW() - INTERVAL '24 hours'
        `, [monitorId]);
        
        return result.rows[0]?.avg_time || 0;
    } catch (error) {
        return 0;
    }
}

async function getResponseSize(response) {
    try {
        if (typeof response.data === 'string') {
            return Buffer.byteLength(response.data, 'utf8');
        }
        return Buffer.byteLength(JSON.stringify(response.data), 'utf8');
    } catch (e) {
        return 0;
    }
}

// Main function to check a single endpoint
async function checkEndpoint(monitor) {
    const startTime = Date.now();
    
    const result = {
        statusCode: null,
        isSuccessful: false,
        error: null,
        responseTime: 0,
        dnsTime: null,
        connectTime: null,
        tlsTime: null,
        ttfb: null,
        responseBody: '',
        responseSize: 0,
        checkedAt: new Date().toISOString(),
        grade: 'F',
        gradeScore: 0
    };

    // Parse headers
    let headers = {};
    try {
        headers = typeof monitor.headers === 'string' ? JSON.parse(monitor.headers) : (monitor.headers || {});
    } catch (e) {
        headers = {};
    }

    // Add auth header based on auth_type
    if (monitor.auth_type === 'bearer' && monitor.auth_value) {
        headers['Authorization'] = `Bearer ${monitor.auth_value}`;
    } else if (monitor.auth_type === 'apikey' && monitor.auth_value) {
        try {
            const apiKeyConfig = typeof monitor.auth_value === 'string' 
                ? JSON.parse(monitor.auth_value) 
                : monitor.auth_value;
            headers[apiKeyConfig.headerName || 'X-API-Key'] = apiKeyConfig.value || monitor.auth_value;
        } catch (e) {
            headers['X-API-Key'] = monitor.auth_value;
        }
    } else if (monitor.auth_type === 'basic' && monitor.auth_value) {
        headers['Authorization'] = `Basic ${Buffer.from(monitor.auth_value).toString('base64')}`;
    }

    const timeoutMs = (monitor.timeout_seconds || 30) * 1000;
    const httpsAgent = new https.Agent({
        timeout: timeoutMs,
        rejectUnauthorized: false
    });

    const checkStart = Date.now();

    try {
        const response = await axios({
            method: monitor.method || 'GET',
            url: monitor.url,
            headers,
            data: monitor.body,
            timeout: timeoutMs,
            httpsAgent,
            validateStatus: () => true,
            maxRedirects: 5
        });

        result.responseTime = Date.now() - checkStart;
        result.statusCode = response.status;
        result.responseBody = typeof response.data === 'string' 
            ? response.data.substring(0, 500) 
            : JSON.stringify(response.data).substring(0, 500);
        result.responseSize = await getResponseSize(response);

        // Estimate timing phases (simplified for Node.js axios)
        const totalTime = result.responseTime;
        result.ttfb = Math.round(totalTime * 0.3);
        result.connectTime = Math.round(totalTime * 0.1);
        result.tlsTime = monitor.url.startsWith('https') ? Math.round(totalTime * 0.15) : null;
        result.dnsTime = Math.round(totalTime * 0.05);

        // Check for x-response-time header
        if (response.headers['x-response-time']) {
            result.ttfb = parseInt(response.headers['x-response-time']);
        }

        // Validate response
        let isValid = true;
        let validationError = null;

        // Check status code
        if (monitor.expected_status_code && response.status !== monitor.expected_status_code) {
            isValid = false;
            validationError = `Expected status ${monitor.expected_status_code}, got ${response.status}`;
        }

        // Check response must contain
        if (isValid && monitor.response_must_contain) {
            if (!result.responseBody.includes(monitor.response_must_contain)) {
                isValid = false;
                validationError = `Response does not contain expected text: "${monitor.response_must_contain}"`;
            }
        }

        // Check response must not contain
        if (isValid && monitor.response_must_not_contain) {
            if (result.responseBody.includes(monitor.response_must_not_contain)) {
                isValid = false;
                validationError = `Response contains forbidden text: "${monitor.response_must_not_contain}"`;
            }
        }

        // Check max response time
        if (isValid && monitor.max_response_ms && result.responseTime > monitor.max_response_ms) {
            isValid = false;
            validationError = `Response time ${result.responseTime}ms exceeded threshold of ${monitor.max_response_ms}ms`;
        }

        result.isSuccessful = isValid;
        if (!isValid && !result.error) {
            result.error = validationError;
        }

    } catch (error) {
        result.responseTime = Date.now() - checkStart;
        
        if (error.code === 'ENOTFOUND') {
            result.error = 'DNS resolution failed - domain not found';
        } else if (error.code === 'ECONNREFUSED') {
            result.error = 'Connection refused - server not accepting connections';
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            result.error = `Timeout: no response within ${monitor.timeout_seconds || 30}s`;
        } else if (error.code === 'CERT_HAS_EXPIRED') {
            result.error = 'SSL certificate has expired';
        } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
            result.error = 'SSL certificate error';
        } else if (error.message) {
            result.error = error.message.substring(0, 200);
        } else {
            result.error = 'Unknown error';
        }
        
        result.isSuccessful = false;
    }

    // Insert check result into database
    try {
        const { uptime, variance } = await getMonitorUptime(monitor.id);
        const recentResponseTime = await getRecentResponseTime(monitor.id);
        const avgResponse = recentResponseTime || result.responseTime;
        const gradeResult = calculateGrade(avgResponse, parseFloat(uptime), variance);
        
        result.grade = gradeResult.grade;
        result.gradeScore = gradeResult.score;
        
        await query(`
            INSERT INTO monitor_checks (
                monitor_id, location, status_code, response_time_ms,
                is_successful, error_message, response_body_preview,
                dns_time_ms, connect_time_ms, tls_time_ms, ttfb_ms,
                response_size_bytes, grade, grade_score
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
            monitor.id,
            'primary',
            result.statusCode,
            result.responseTime,
            result.isSuccessful,
            result.error,
            result.responseBody.substring(0, 500),
            result.dnsTime,
            result.connectTime,
            result.tlsTime,
            result.ttfb,
            result.responseSize,
            result.grade,
            result.gradeScore
        ]);
    } catch (dbError) {
        console.error('Failed to save check result:', dbError.message);
    }

    // Update monitor status
    try {
        const newStatus = result.isSuccessful 
            ? (result.responseTime > (monitor.max_response_ms || 3000) ? 'slow' : 'up')
            : 'down';
            
        await query(`
            UPDATE monitors SET 
                status = $1,
                last_check_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
        `, [newStatus, monitor.id]);
    } catch (dbError) {
        console.error('Failed to update monitor status:', dbError.message);
    }

    return result;
}

// Run check for a specific monitor by ID
async function runMonitorCheck(monitorId) {
    try {
        const result = await query('SELECT * FROM monitors WHERE id = $1', [monitorId]);
        
        if (result.rows.length === 0) {
            console.log(`Monitor ${monitorId} not found`);
            return null;
        }

        const monitor = result.rows[0];
        
        if (!monitor.is_active || monitor.is_paused) {
            console.log(`Monitor ${monitorId} is paused or inactive`);
            return null;
        }

        console.log(`Checking monitor: ${monitor.name} (${monitor.url})`);
        const checkResult = await checkEndpoint(monitor);

        // Check if we need to trigger/resolve incidents
        const lastThreeChecks = await query(`
            SELECT is_successful FROM monitor_checks 
            WHERE monitor_id = $1 
            ORDER BY checked_at DESC LIMIT 3
        `, [monitorId]);

        // If last 3 checks are all failures, create incident
        if (lastThreeChecks.rows.length >= 3 && 
            lastThreeChecks.rows.every(c => !c.is_successful)) {
            await handleIncident(monitor, checkResult);
        }

        // If previous was down but now is up, resolve incident
        if (checkResult.isSuccessful && monitor.status === 'down') {
            await resolveIncident(monitor);
            await sendRecoveryAlert(monitor);
        }

        return checkResult;
    } catch (error) {
        console.error(`Error running check for monitor ${monitorId}:`, error);
        return null;
    }
}

// Handle new incident
async function handleIncident(monitor, checkResult) {
    try {
        // Check if there's already an open incident
        const existingIncident = await query(`
            SELECT id FROM incidents 
            WHERE monitor_id = $1 AND resolved_at IS NULL
        `, [monitor.id]);

        if (existingIncident.rows.length > 0) {
            console.log(`Incident already open for monitor ${monitor.id}`);
            return null;
        }

        // Create new incident
        const incidentResult = await query(`
            INSERT INTO incidents (
                monitor_id, status, failure_reason, started_at, affected_locations
            ) VALUES ($1, 'investigating', $2, NOW(), $3)
            RETURNING *
        `, [monitor.id, checkResult.error || 'Service unavailable', monitor.locations || ['primary']]);

        const incident = incidentResult.rows[0];
        console.log(`Created incident for monitor: ${monitor.name}`);

        // Send email alert
        await sendDownAlert(monitor, incident, checkResult);

        return incident;
    } catch (error) {
        console.error('Error creating incident:', error);
        return null;
    }
}

// Resolve open incident
async function resolveIncident(monitor) {
    try {
        const result = await query(`
            UPDATE incidents 
            SET status = 'resolved', 
                resolved_at = NOW(),
                duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int
            WHERE monitor_id = $1 AND resolved_at IS NULL
            RETURNING *
        `, [monitor.id]);

        if (result.rows.length > 0) {
            const incident = result.rows[0];
            console.log(`Resolved incident for monitor: ${monitor.name}`);
            
            // Send recovery email
            await sendRecoveryAlert(monitor, incident);
        }
    } catch (error) {
        console.error('Error resolving incident:', error);
    }
}



// Run checks for all active monitors
async function runAllActiveMonitors() {
    try {
        const result = await query(`
            SELECT * FROM monitors 
            WHERE is_active = true AND is_paused = false
        `);

        const monitors = result.rows;
        console.log(`\n=== Checking ${monitors.length} active monitors at ${new Date().toISOString()} ===`);

        for (const monitor of monitors) {
            await checkEndpoint(monitor);
        }

        console.log(`=== Completed checking ${monitors.length} monitors ===\n`);
        return monitors.length;
    } catch (error) {
        console.error('Error running all active monitors:', error);
        return 0;
    }
}

module.exports = {
    checkEndpoint,
    runMonitorCheck,
    handleIncident,
    resolveIncident,
    runAllActiveMonitors,
    calculateGrade,
    getMonitorUptime
};
