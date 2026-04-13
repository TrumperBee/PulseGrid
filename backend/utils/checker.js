const axios = require('axios');
const https = require('https');

async function performCheck(monitor, location) {
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
        responseBody: ''
    };

    const headers = typeof monitor.headers === 'string' ? JSON.parse(monitor.headers) : (monitor.headers || {});
    
    const authHeaders = getAuthHeaders(monitor);
    Object.assign(headers, authHeaders);

    const agent = new https.Agent({
        timeout: (monitor.timeout_seconds || 30) * 1000
    });

    try {
        const response = await axios({
            method: monitor.method || 'GET',
            url: monitor.url,
            headers,
            data: monitor.body,
            timeout: (monitor.timeout_seconds || 30) * 1000,
            httpsAgent: agent,
            validateStatus: () => true
        });

        result.statusCode = response.status;
        result.responseBody = typeof response.data === 'string' 
            ? response.data.substring(0, 500) 
            : JSON.stringify(response.data).substring(0, 500);
        
        result.responseTime = Date.now() - startTime;
        
        if (response.headers['x-response-time']) {
            result.ttfb = parseInt(response.headers['x-response-time']);
        }

        if (monitor.expected_status_code && response.status !== monitor.expected_status_code) {
            result.error = `Expected status ${monitor.expected_status_code}, got ${response.status}`;
            result.isSuccessful = false;
        } else if (monitor.response_must_contain && !response.data.includes(monitor.response_must_contain)) {
            result.error = `Response does not contain expected text: ${monitor.response_must_contain}`;
            result.isSuccessful = false;
        } else if (monitor.response_must_not_contain && response.data.includes(monitor.response_must_not_contain)) {
            result.error = `Response contains forbidden text: ${monitor.response_must_not_contain}`;
            result.isSuccessful = false;
        } else {
            result.isSuccessful = response.status >= 200 && response.status < 400;
        }

        if (result.responseTime > (monitor.max_response_ms || 3000)) {
            result.error = `Response time ${result.responseTime}ms exceeded threshold of ${monitor.max_response_ms || 3000}ms`;
            result.isSuccessful = false;
        }

    } catch (error) {
        result.responseTime = Date.now() - startTime;
        
        if (error.code === 'ENOTFOUND') {
            result.error = 'DNS resolution failed - domain not found';
        } else if (error.code === 'ECONNREFUSED') {
            result.error = 'Connection refused - server not accepting connections';
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            result.error = 'Connection timeout';
        } else if (error.code === 'CERT_HAS_EXPIRED') {
            result.error = 'SSL certificate has expired';
        } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
            result.error = 'SSL certificate verification failed';
        } else if (error.message) {
            result.error = error.message.substring(0, 200);
        } else {
            result.error = 'Unknown error';
        }
        
        result.isSuccessful = false;
    }

    return result;
}

function getAuthHeaders(monitor) {
    const headers = {};

    switch (monitor.auth_type) {
        case 'bearer':
            headers['Authorization'] = `Bearer ${monitor.auth_value}`;
            break;
        case 'apikey':
            headers[monitor.api_key_header || 'X-API-Key'] = monitor.auth_value;
            break;
        case 'basic':
            const credentials = Buffer.from(monitor.auth_value).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
            break;
    }

    return headers;
}

function getLocationCoords(location) {
    const locations = {
        nairobi: { name: 'Nairobi, Kenya', lat: -1.2921, lon: 36.8219 },
        frankfurt: { name: 'Frankfurt, Germany', lat: 50.1109, lon: 8.6821 },
        newyork: { name: 'New York, USA', lat: 40.7128, lon: -74.0060 },
        london: { name: 'London, UK', lat: 51.5074, lon: -0.1278 },
        singapore: { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
        sydney: { name: 'Sydney, Australia', lat: -33.8688, lon: 151.2093 },
        saopaulo: { name: 'Sao Paulo, Brazil', lat: -23.5505, lon: -46.6333 }
    };

    return locations[location] || locations.nairobi;
}

module.exports = {
    performCheck,
    getAuthHeaders,
    getLocationCoords
};
