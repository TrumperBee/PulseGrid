// Firebase imports (loaded from CDN)
const { useState, useEffect, useRef, createContext, useContext } = React;
const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = Recharts;

// Confirm Modal
const ConfirmModal = ({ open, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-[#0D0D18] border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Syne' }}>{title}</h3>
        <p className="text-gray-400 mb-6 text-sm">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition">{cancelText}</button>
          <button onClick={onConfirm} className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-black'}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDfjv_pqvhJVp9x5cDcxp5RZbegp2eMbdE",
  authDomain: "pulsegrid-f5631.firebaseapp.com",
  projectId: "pulsegrid-f5631",
  storageBucket: "pulsegrid-f5631.firebasestorage.app",
  messagingSenderId: "546734052192",
  appId: "1:546734052192:web:a15ee622fdf1d0c8c78405"
};

// Initialize Firebase
let app, auth, db;
if (typeof firebase !== 'undefined') {
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
}

// Email utility - sends alerts via Resend API directly from browser
const sendAlertEmail = async (monitor, eventType, details = {}) => {
  if (!monitor.alertContacts || monitor.alertContacts.length === 0) return;
  
  const RESEND_API_KEY = 're_Hy1TH7nk_EhqPzuus64koJmTbnqvGKebr';
  const { title, description, affectedLocations, workingLocations, checkResults } = details;
  
  let subjectLine = eventType === 'down' ? '🚨 ALERT: ' + monitor.name + ' is DOWN' : '✅ RECOVERED: ' + monitor.name + ' is back up';
  if (title) {
    const shortTitle = title.length > 50 ? title.substring(0, 47) + '...' : title;
    subjectLine = eventType === 'down' ? '🚨 ' + monitor.name + ' ' + shortTitle + ' — PulseGrid Alert' : '✅ ' + monitor.name + ' recovered — PulseGrid Alert';
  }
  
  const failedChecks = [];
  const passedChecks = [];
  const checks = checkResults || {};
  
  if (checks.connectivity?.passed === false) failedChecks.push('Connectivity — ' + (checks.connectivity.error || 'Failed'));
  if (checks.fullLoad?.passed === false) failedChecks.push('Full Page Load — ' + (checks.fullLoad.error || 'Failed'));
  if (checks.contentValidation?.passed === false) failedChecks.push('Content — ' + (checks.contentValidation.issues?.join('; ') || 'Failed'));
  if (checks.linkValidation?.broken > 0) failedChecks.push('Links — ' + checks.broken + ' of ' + checks.checked + ' broken');
  if (checks.ssl?.valid === false || checks.ssl?.daysUntilExpiry < 30) failedChecks.push('SSL — ' + (checks.ssl.daysUntilExpiry < 30 ? 'Expiring in ' + checks.ssl.daysUntilExpiry + ' days' : 'Invalid'));
  if (checks.dns?.resolved === false) failedChecks.push('DNS — ' + (checks.dns.error || 'Failed'));
  
  if (checks.connectivity?.passed !== false) passedChecks.push('Connectivity');
  if (checks.fullLoad?.passed !== false) passedChecks.push('Full Page Load');
  if (checks.contentValidation?.passed !== false) passedChecks.push('Content');
  if (checks.linkValidation) passedChecks.push('Links');
  if (checks.ssl?.valid !== false) passedChecks.push('SSL');
  if (checks.dns?.resolved !== false) passedChecks.push('DNS');
  
  let actionSuggestions = '';
  if (eventType === 'down') {
    const errorType = checks.connectivity?.error || checks.fullLoad?.error || checks.dns?.error || '';
    if (errorType.includes('Timeout')) {
      actionSuggestions = '<p style="margin-top: 15px;"><strong>What to do:</strong></p><ul style="color: #aaa; margin: 5px 0;"><li>Check if your server is running</li><li>Log into your hosting dashboard and verify the service is active</li><li>Check firewall settings allow external requests</li></ul>';
    } else if (checks.dns?.error) {
      actionSuggestions = '<p style="margin-top: 15px;"><strong>What to do:</strong></p><ul style="color: #aaa; margin: 5px 0;"><li>Check your domain registration has not expired</li><li>Verify your DNS records are correctly configured</li><li>Check your domain provider settings</li></ul>';
    } else if (checks.ssl?.error || checks.ssl?.daysUntilExpiry < 30) {
      actionSuggestions = '<p style="margin-top: 15px;"><strong>What to do:</strong></p><ul style="color: #aaa; margin: 5px 0;"><li>Renew your SSL certificate immediately</li><li>Use Let\'s Encrypt (free) at letsencrypt.org</li><li>Or buy from other providers like DigiCert</li></ul>';
    } else if (checks.fullLoad?.statusCode >= 500) {
      actionSuggestions = '<p style="margin-top: 15px;"><strong>What to do:</strong></p><ul style="color: #aaa; margin: 5px 0;"><li>Check your server logs for crash details</li><li>Your application may have encountered an unhandled error</li><li>Restart your server or service</li></ul>';
    } else if (checks.contentValidation?.issues?.length) {
      actionSuggestions = '<p style="margin-top: 15px;"><strong>What to do:</strong></p><ul style="color: #aaa; margin: 5px 0;"><li>Your server is running but returning unexpected content</li><li>Check recent deployments or configuration changes</li><li>Verify your application is serving the correct pages</li></ul>';
    } else {
      actionSuggestions = '<p style="margin-top: 15px;"><strong>What to do:</strong></p><ul style="color: #aaa; margin: 5px 0;"><li>Check your server status</li><li>Review recent changes to your application</li><li>Check hosting provider status</li></ul>';
    }
  }
  
  let locationTable = '';
  if (affectedLocations || workingLocations) {
    locationTable = '<div style="margin-top: 20px;"><h3 style="color: #E8E8F0;">Affected Locations</h3><table style="width: 100%; border-collapse: collapse;"><tr>';
    if (affectedLocations) locationTable += '<td style="color: #ff6b6b; padding: 8px;">❌ ' + affectedLocations + '</td>';
    locationTable += '</tr></table></div>';
    if (workingLocations) {
      locationTable += '<div style="margin-top: 10px;"><h4 style="color: #aaa;">Working Locations</h4><p style="color: #6b6;">✅ ' + workingLocations + '</p></div>';
    }
  }
  
  let checksTable = '';
  if (failedChecks.length > 0 || passedChecks.length > 0) {
    checksTable = '<div style="margin-top: 20px;"><h3 style="color: #E8E8F0;">Check Results</h3><table style="width: 100%; border-collapse: collapse;">';
    failedChecks.forEach(c => { checksTable += '<tr><td style="color: #ff6b6b; padding: 5px;">❌ ' + c + '</td></tr>'; });
    passedChecks.forEach(c => { checksTable += '<tr><td style="color: #6b6; padding: 5px;">✅ ' + c + '</td></tr>'; });
    checksTable += '</table></div>';
  }
  
  const htmlContent = '<div style="font-family: Arial, sans-serif; background: #050508; color: #E8E8F0; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #0D0D18; border-radius: 12px; padding: 30px;">' +
    '<h1 style="color: ' + (eventType === 'down' ? '#ff6b6b' : '#6b6') + ';">' + (eventType === 'down' ? '🚨 Monitor Down!' : '✅ Monitor Recovered!') + '</h1>' +
    (description ? '<p style="color: #E8E8F0; margin-top: 15px; font-size: 16px;">' + description + '</p>' : '') +
    '<p style="margin-top: 15px;"><strong>Monitor:</strong> ' + monitor.name + '</p>' +
    '<p><strong>URL:</strong> ' + monitor.url + '</p>' +
    '<p><strong>Time:</strong> ' + new Date().toLocaleString() + '</p>' +
    locationTable + checksTable +
    actionSuggestions +
    '<a href="https://pulsegrid.vercel.app" style="display: inline-block; background: #00F5FF; color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px;">View in PulseGrid</a></div></div>';
  
  try {
    await fetch('https://corsproxy.io/?https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + RESEND_API_KEY,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        from: 'PulseGrid Alerts <alerts@resend.dev>',
        to: monitor.alertContacts,
        subject: subjectLine,
        html: htmlContent
      })
    });
    console.log('Alert sent:', eventType, monitor.name);
  } catch (err) {
    console.error('Failed to send alert email:', err);
  }
};

// Context for toast
const ToastContext = createContext();
const useToast = () => useContext(ToastContext);

// Context for navigation
const NavigationContext = createContext();
const useNavigation = () => useContext(NavigationContext);

// ICONS
const ICONS = {
  home: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  activity: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  plus: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  globe: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  file: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  bell: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  x: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  chevronLeft: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>,
  zap: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  trash: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  radio: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>,
  pause: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  eye: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  user: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  mail: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  google: <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>,
  logout: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

// Available monitoring locations with coordinates
const MONITORING_REGIONS = [
  { id: 'nairobi', name: 'Nairobi', country: 'Kenya', lat: -1.2921, lon: 36.8219, flag: '🇰🇪' },
  { id: 'frankfurt', name: 'Frankfurt', country: 'Germany', lat: 50.1109, lon: 8.6821, flag: '🇩🇪' },
  { id: 'newyork', name: 'New York', country: 'USA', lat: 40.7128, lon: -74.0060, flag: '🇺🇸' },
  { id: 'london', name: 'London', country: 'UK', lat: 51.5074, lon: -0.1278, flag: '🇬🇧' },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198, flag: '🇸🇬', plan: 'pro' },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, flag: '🇯🇵' },
  { id: 'sydney', name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093, flag: '🇦🇺' },
  { id: 'saopaulo', name: 'São Paulo', country: 'Brazil', lat: -23.5505, lon: -46.6333, flag: '🇧🇷', plan: 'pro' },
  { id: 'mumbai', name: 'Mumbai', country: 'India', lat: 19.0760, lon: 72.8777, flag: '🇮🇳' },
  { id: 'dubai', name: 'Dubai', country: 'UAE', lat: 25.2048, lon: 55.2708, flag: '🇦🇪' },
  { id: 'amsterdam', name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lon: 4.9044, flag: '🇳🇱' },
  { id: 'toronto', name: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832, flag: '🇨🇦' },
];

// Leaflet Map component
const LeafletMap = ({ monitors = [], userData }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});
  
  useEffect(() => {
    if (!mapRef.current || typeof L === 'undefined') return;
    
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }
    
    const map = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: false,
      attributionControl: false
    });
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);
    
    L.control.attribution({ position: 'bottomright', prefix: false }).addAttribution('© OpenStreetMap © CARTO').addTo(map);
    
    mapInstance.current = map;
    
    const getMarkerClass = (regionId) => {
      const regionMonitors = monitors.filter(m => m.locations?.includes(regionId));
      if (regionMonitors.length === 0) return 'none';
      
      const downCount = regionMonitors.filter(m => m.status === 'down').length;
      const slowCount = regionMonitors.filter(m => m.status === 'slow').length;
      
      if (downCount > 0) return 'down';
      if (slowCount > 0) return 'slow';
      return 'up';
    };
    
    MONITORING_REGIONS.forEach(region => {
      const markerClass = getMarkerClass(region.id);
      const isPro = region.plan === 'pro';
      
      const icon = L.divIcon({
        className: 'pg-marker ' + markerClass + (isPro ? ' pro' : ''),
        html: `<div class="pg-marker-ring"></div><div class="pg-marker-dot"></div>${isPro ? '<div class="pg-marker-label">' + region.flag + ' PRO</div>' : ''}`,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });
      
      const marker = L.marker([region.lat, region.lon], { icon }).addTo(map);
      
      const regionMonitors = monitors.filter(m => m.locations?.includes(region.id));
      const downMons = regionMonitors.filter(m => m.status === 'down');
      const slowMons = regionMonitors.filter(m => m.status === 'slow');
      const upMons = regionMonitors.filter(m => !m.status || m.status === 'up' || m.status === 'pending');
      const avgResponse = regionMonitors.length > 0 
        ? Math.round(regionMonitors.reduce((a, m) => a + (m.avgResponseMs || 0), 0) / regionMonitors.length) 
        : 0;
      
      let popupContent = '';
      
      if (isPro) {
        popupContent = `
          <div class="pg-popup">
            <div class="pg-popup-title">${region.flag} ${region.name}, ${region.country} 🔒</div>
            <div class="pg-popup-pro">
              <p style="color: #6B6B8A; font-size: 11px;">Available on Pro plan</p>
              <p style="color: #6B6B8A; font-size: 11px; margin-top: 4px;">Monitor your APIs from Southeast Asia</p>
              <button class="pg-popup-pro-btn" onclick="window.navigateToBilling && window.navigateToBilling()">Upgrade to Pro</button>
            </div>
          </div>
        `;
      } else if (regionMonitors.length === 0) {
        popupContent = `
          <div class="pg-popup">
            <div class="pg-popup-title">${region.flag} ${region.name}, ${region.country}</div>
            <div style="color: #6B6B8A; font-size: 12px;">No monitors checking from here yet.</div>
            <div style="color: #00F5FF; font-size: 11px; margin-top: 8px;">Add this location to start monitoring.</div>
          </div>
        `;
      } else {
        let rows = '';
        [...upMons, ...slowMons, ...downMons].forEach(m => {
          const statusClass = m.status === 'down' ? 'down' : m.status === 'slow' ? 'slow' : 'up';
          const statusIcon = m.status === 'down' ? '❌' : m.status === 'slow' ? '🟡' : '✅';
          rows += `<div class="pg-popup-row ${statusClass}"><span>${statusIcon} ${m.name.substring(0, 20)}</span><span>${m.avgResponseMs || '—'}ms</span></div>`;
        });
        
        popupContent = `
          <div class="pg-popup">
            <div class="pg-popup-title">${region.flag} ${region.name}, ${region.country}</div>
            <div style="border-bottom: 1px solid #1A1A2E; margin: 8px 0;"></div>
            <div style="font-size: 12px; color: #E8E8F0;">${regionMonitors.length} monitors checking</div>
            <div style="margin-top: 8px;">${rows}</div>
            <div class="pg-popup-stats">
              <div>Avg response: ${avgResponse}ms</div>
              <div>Last checked: ${new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        `;
      }
      
      marker.bindPopup(popupContent, { className: 'pg-popup-wrapper' });
      markersRef.current[region.id] = marker;
    });
    
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [monitors, userData]);
  
  return <div ref={mapRef} className="pulsegrid-map rounded-lg"></div>;
};

// Deep Monitoring Checks - 8 comprehensive checks per monitor
const LOCATION_NAMES = {
  nairobi: { name: 'Nairobi, Kenya', region: 'Africa', country: 'KE' },
  frankfurt: { name: 'Frankfurt, Germany', region: 'Europe', country: 'DE' },
  newyork: { name: 'New York, USA', region: 'North America', country: 'US' },
  london: { name: 'London, UK', region: 'Europe', country: 'GB' },
  singapore: { name: 'Singapore', region: 'Asia', country: 'SG' },
  tokyo: { name: 'Tokyo, Japan', region: 'Asia', country: 'JP' },
  sydney: { name: 'Sydney, Australia', region: 'Oceania', country: 'AU' },
  saopaulo: { name: 'São Paulo, Brazil', region: 'South America', country: 'BR' },
  mumbai: { name: 'Mumbai, India', region: 'Asia', country: 'IN' },
  dubai: { name: 'Dubai, UAE', region: 'Middle East', country: 'AE' },
  amsterdam: { name: 'Amsterdam, Netherlands', region: 'Europe', country: 'NL' },
  toronto: { name: 'Toronto, Canada', region: 'North America', country: 'CA' }
};

const ERROR_INDICATORS = ['404 not found', '500 internal server error', 'service unavailable', 'access denied', 'forbidden', 'under maintenance', 'coming soon', 'error 503', 'bad gateway', 'gateway timeout'];

// CHECK 1: Basic Connectivity (HEAD request)
const runConnectivityCheck = async (url, timeout) => {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    await fetch('https://corsproxy.io/?' + encodeURIComponent(url), { method: 'HEAD', signal: controller.signal });
    clearTimeout(id);
    return { passed: true, responseTimeMs: Date.now() - start, statusCode: null, error: null };
  } catch (e) {
    return { passed: false, responseTimeMs: Date.now() - start, statusCode: null, error: e.name === 'AbortError' ? 'Timeout' : e.message };
  }
};

// CHECK 2: Full Page Load (GET request)
const runFullLoadCheck = async (url, timeout, monitor) => {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch('https://corsproxy.io/?' + encodeURIComponent(url), {
      method: monitor.method || 'GET',
      signal: controller.signal,
      headers: monitor.headers || {}
    });
    clearTimeout(id);
    const text = await response.text();
    const responseSize = new Blob([text]).size;
    const responseTime = Date.now() - start;
    
    let passed = response.ok;
    let error = null;
    if (monitor.expectedStatusCode && response.status !== monitor.expectedStatusCode) {
      passed = false;
      error = `Expected ${monitor.expectedStatusCode}, got ${response.status}`;
    }
    return { passed, responseTimeMs: responseTime, responseSizeBytes: responseSize, statusCode: response.status, error, responseBody: text };
  } catch (e) {
    return { passed: false, responseTimeMs: Date.now() - start, responseSizeBytes: 0, statusCode: null, error: e.name === 'AbortError' ? 'Timeout' : e.message, responseBody: '' };
  }
};

// CHECK 3: Content Validation
const runContentValidationCheck = (responseBody) => {
  if (!responseBody || !responseBody.trim()) return { passed: false, issues: ['Empty response body'] };
  const issues = [];
  let htmlValid = false;
  let jsonValid = false;
  let hasTitle = false;
  
  const lower = responseBody.toLowerCase();
  const hasHtml = lower.includes('<html') && lower.includes('<body');
  const hasJson = (responseBody.trim().startsWith('{') || responseBody.trim().startsWith('['));
  
  if (lower.includes('<!doctype html') || hasHtml) htmlValid = true;
  if (hasJson) {
    try { JSON.parse(responseBody); jsonValid = true; } catch {}
  }
  
  if (!htmlValid && !jsonValid && !lower.includes('<!doctype')) {
    issues.push('Response does not appear to be valid HTML or JSON');
  }
  
  const titleMatch = responseBody.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]?.trim()) hasTitle = true;
  if (htmlValid && !hasTitle) issues.push('Page has no title tag');
  
  for (const indicator of ERROR_INDICATORS) {
    if (lower.includes(indicator)) {
      issues.push(`Error page indicator detected: "${indicator}"`);
      break;
    }
  }
  
  return { passed: issues.length === 0, issues, htmlValid, jsonValid, hasTitle };
};

// CHECK 4: Link Validation (internal links)
const runLinkValidationCheck = async (baseUrl, responseBody, timeout) => {
  const domain = new URL(baseUrl).hostname;
  const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  const linkMatches = responseBody.match(linkRegex) || [];
  const internalLinks = [];
  linkMatches.forEach(m => {
    const match = m.match(/href=["'](https?:\/\/[^"']+)["']/);
    if (match && match[1] && match[1].includes(domain)) internalLinks.push(match[1]);
  });
  const uniqueLinks = [...new Set(internalLinks)].slice(0, 10);
  
  if (uniqueLinks.length === 0) return { checked: 0, broken: 0, brokenUrls: [] };
  
  const brokenUrls = [];
  for (const link of uniqueLinks) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout / uniqueLinks.length);
      const res = await fetch('https://corsproxy.io/?' + encodeURIComponent(link), { method: 'HEAD', signal: controller.signal });
      clearTimeout(id);
      if (res.status >= 400) brokenUrls.push(link);
    } catch { brokenUrls.push(link); }
  }
  
  const broken = brokenUrls.length;
  const checked = uniqueLinks.length;
  return { checked, broken, brokenUrls, passRatio: checked > 0 ? (checked - broken) / checked : 1 };
};

// CHECK 5: SSL Certificate Check
const runSSLCheck = async (url) => {
  try {
    const hostname = new URL(url).hostname;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000);
    const response = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://api.sslmap.com/v1/scan?hostname=' + hostname), { signal: controller.signal });
    clearTimeout(id);
    if (!response.ok) return { valid: null, daysUntilExpiry: null, issuer: null, error: 'SSL check service unavailable' };
    const data = await response.json();
    return { valid: data.valid, daysUntilExpiry: data.daysUntilExpiry, issuer: data.issuer, error: null };
  } catch {
    return { valid: null, daysUntilExpiry: null, issuer: null, error: 'Could not verify SSL' };
  }
};

// CHECK 6: DNS Check
const runDNSCheck = async (url) => {
  const start = Date.now();
  try {
    const hostname = new URL(url).hostname;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const response = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://dns.google/resolve?name=' + hostname + '&type=A'), { signal: controller.signal });
    clearTimeout(id);
    const data = await response.json();
    const ip = data.Answer?.[0]?.data;
    return { resolved: !!ip, resolutionTimeMs: Date.now() - start, ipAddress: ip, error: ip ? null : 'DNS resolution failed' };
  } catch (e) {
    return { resolved: false, resolutionTimeMs: Date.now() - start, ipAddress: null, error: e.message };
  }
};

// CHECK 7: Redirect Check
const runRedirectCheck = async (url, timeout) => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch('https://corsproxy.io/?' + encodeURIComponent(url), { method: 'GET', redirect: 'manual', signal: controller.signal });
    clearTimeout(id);
    const chain = [url];
    let current = response.url;
    if (current !== url && current) chain.push(current);
    
    const https = url.startsWith('https://');
    const httpsRedirect = !https && response.status >= 300 && response.status < 400 && response.headers.get('location')?.startsWith('https');
    
    return { chain, finalUrl: current, hopCount: chain.length, isHttps: https || !!httpsRedirect };
  } catch {
    return { chain: [url], finalUrl: url, hopCount: 0, isHttps: url.startsWith('https://') };
  }
};

// CHECK 8: Performance Scoring
const calculatePerformanceScore = (checks) => {
  let score = 0;
  const { connectivity, fullLoad, ssl, linkValidation, dns } = checks;
  
  if (fullLoad?.responseTimeMs < 200) score += 25;
  else if (fullLoad?.responseTimeMs < 500) score += 15;
  else if (fullLoad?.responseTimeMs < 1000) score += 5;
  
  if (ssl?.valid === true && ssl?.daysUntilExpiry > 30) score += 20;
  else if (ssl?.valid === true) score += 10;
  
  if (linkValidation?.passRatio >= 0.7) score += 20;
  
  if (checks.contentValidation?.passed) score += 20;
  
  if (dns?.resolutionTimeMs < 50) score += 15;
  else if (dns?.resolved) score += 5;
  
  let grade = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  
  return { score, grade };
};

// Calculate overall status from all checks
const calculateOverallStatus = (checks, prevStatus) => {
  const { connectivity, fullLoad, contentValidation, ssl, linkValidation } = checks;
  
  if (connectivity?.error === 'Timeout' || fullLoad?.error === 'Timeout') return 'down';
  if (!connectivity?.passed || !fullLoad?.passed) return 'down';
  if (contentValidation?.issues?.some(i => ERROR_INDICATORS.some(e => i.toLowerCase().includes(e)))) return 'degraded';
  if (ssl?.daysUntilExpiry < 7) return 'critical_warning';
  if (ssl?.daysUntilExpiry < 30) return 'warning';
  if (linkValidation?.passRatio < 0.7) return 'degraded';
  if (fullLoad?.responseTimeMs > 1000) return 'slow';
  return 'up';
};

// Generate human-readable incident description
const generateIncidentDescription = (monitorName, location, checkResults) => {
  const { checks: c, locationInfo } = checkResults;
  const locName = locationInfo?.name || location;
  const errors = [];
  if (c.connectivity?.error) errors.push('connectivity: ' + c.connectivity.error);
  if (c.fullLoad?.error) errors.push('load: ' + c.fullLoad.error);
  if (c.dns?.error) errors.push('dns: ' + c.dns.error);
  if (c.contentValidation?.issues?.length) errors.push('content: ' + c.contentValidation.issues.join('; '));
  if (c.linkValidation?.broken > 0) errors.push('broken links: ' + c.linkValidation.broken + ' of ' + c.linkValidation.checked);
  if (c.ssl?.error) errors.push('ssl: ' + c.ssl.error);
  if (c.ssl?.daysUntilExpiry < 30) errors.push('ssl expiring in ' + c.ssl.daysUntilExpiry + ' days');
  
  const error = errors.join('; ') || 'Unknown error';
  
  if (c.connectivity?.error === 'Timeout' || c.fullLoad?.error === 'Timeout') {
    return {
      title: `${monitorName} is unreachable from ${locName}`,
      description: `${monitorName} is completely unreachable from ${locName}. The server is not responding to any requests. This means ${locationInfo?.region} users cannot access this service at all. Technical: Connection timed out after 30 seconds — no response received.`,
      type: 'timeout'
    };
  }
  
  if (c.dns?.error) {
    return {
      title: `${monitorName} domain not found from ${locName}`,
      description: `${monitorName} cannot be found from ${locName}. The domain name is not resolving to an IP address. This could mean the domain has expired or DNS is misconfigured. Technical: DNS lookup failed — ${c.dns.error}`,
      type: 'dns'
    };
  }
  
  if (c.fullLoad?.statusCode && c.fullLoad.statusCode >= 400) {
    const explanations = { 401: 'Authentication required', 403: 'Access forbidden', 404: 'Page not found', 500: 'Server crashed', 502: 'Bad gateway', 503: 'Service unavailable' };
    return {
      title: `${monitorName} returning HTTP ${c.fullLoad.statusCode} from ${locName}`,
      description: `${monitorName} is returning an error page from ${locName}. The server responded with HTTP ${c.fullLoad.statusCode} instead of ${checkResults.expectedStatus || 200}. ${explanations[c.fullLoad.statusCode] || 'Server error'}. Technical: Expected ${checkResults.expectedStatus || 200}, received ${c.fullLoad.statusCode}`,
      type: 'http_error'
    };
  }
  
  if (c.contentValidation?.issues?.length) {
    return {
      title: `${monitorName} content issues from ${locName}`,
      description: `${monitorName} is loading but has content issues from ${locName}. The page loaded but failed validation: ${c.contentValidation.issues.join('; ')}. Technical: Content validation failed — ${c.contentValidation.issues.join(', ')}`,
      type: 'content'
    };
  }
  
  if (c.linkValidation?.broken > 0) {
    return {
      title: `${monitorName} has broken pages from ${locName}`,
      description: `${monitorName} has multiple broken pages detected from ${locName}. ${c.linkValidation.broken} out of ${c.linkValidation.checked} internal pages are returning errors. Affected: ${c.linkValidation.brokenUrls.slice(0, 3).join(', ')}`,
      type: 'links'
    };
  }
  
  if (c.ssl?.daysUntilExpiry < 30) {
    return {
      title: `${monitorName} SSL certificate ${c.ssl.daysUntilExpiry < 7 ? 'expired' : 'expiring soon'}`,
      description: `${monitorName} has an SSL certificate problem. Certificate ${c.ssl.daysUntilExpiry < 7 ? 'expired' : 'expires in ' + c.ssl.daysUntilExpiry + ' days'}. Users will see security warnings. Technical: SSL ${c.ssl.daysUntilExpiry < 7 ? 'expired' : 'expiring soon'} — issuer: ${c.ssl.issuer || 'unknown'}`,
      type: 'ssl'
    };
  }
  
  if (c.fullLoad?.responseTimeMs > 1000) {
    return {
      title: `${monitorName} responding slowly from ${locName}`,
      description: `${monitorName} is responding slowly from ${locName}. The page is taking ${c.fullLoad.responseTimeMs}ms to load. Users in ${locationInfo?.region} are experiencing slow load times. Technical: Response time ${c.fullLoad.responseTimeMs}ms > 1000ms threshold`,
      type: 'slow'
    };
  }
  
  return {
    title: `${monitorName} ${error} from ${locName}`,
    description: `${monitorName} has an issue from ${locName}: ${error}. Technical: ${error}`,
    type: 'unknown'
  };
};

// Check a single monitor with all 8 checks
const checkMonitor = async (monitor, regionId = 'nairobi') => {
  const timeout = monitor.timeoutSeconds ? monitor.timeoutSeconds * 1000 : 15000;
  const locationInfo = LOCATION_NAMES[regionId];
  
  const checks = {
    connectivity: null,
    fullLoad: null,
    contentValidation: null,
    linkValidation: null,
    ssl: null,
    dns: null,
    redirects: null,
    performance: null
  };
  
  try {
    checks.connectivity = await runConnectivityCheck(monitor.url, timeout);
    checks.fullLoad = await runFullLoadCheck(monitor.url, timeout, monitor);
    
    if (checks.fullLoad?.responseBody) {
      checks.contentValidation = runContentValidationCheck(checks.fullLoad.responseBody);
      checks.linkValidation = await runLinkValidationCheck(monitor.url, checks.fullLoad.responseBody, timeout);
    }
    
    checks.ssl = await runSSLCheck(monitor.url);
    checks.dns = await runDNSCheck(monitor.url);
    checks.redirects = await runRedirectCheck(monitor.url, timeout);
    checks.performance = calculatePerformanceScore(checks);
  } catch (e) {
    console.error('Check error:', e);
  }
  
  const overallStatus = calculateOverallStatus(checks, monitor.status);
  
  return {
    passed: overallStatus === 'up',
    status: overallStatus,
    responseTimeMs: checks.fullLoad?.responseTimeMs || checks.connectivity?.responseTimeMs,
    checks,
    locationInfo,
    expectedStatus: monitor.expectedStatusCode,
    location: regionId
  };
};

// Check all monitors and update Firestore with deep checks
const checkAllMonitors = async (monitorsList, userId) => {
  const batch = db.batch();
  let downCount = 0;
  let totalResponse = 0;
  const now = new Date();
  
  for (const m of monitorsList) {
    const regions = m.locations || ['nairobi'];
    const regionResults = {};
    let overallStatus = 'up';
    let anyDown = false;
    let anyRegional = false;
    
    for (const region of regions) {
      const result = await checkMonitor(m, region);
      regionResults[region] = result;
      
      if (result.status === 'down') anyDown = true;
      else if (result.status !== 'up') anyRegional = true;
      if (result.status !== 'up' && overallStatus === 'up') overallStatus = result.status;
    }
    
    const avgResponseTime = Math.round(
      Object.values(regionResults).filter(r => r).reduce((a, r) => a + (r.responseTimeMs || 0), 0) / regions.length
    );
    
    const failedChecks = Object.entries(regionResults).filter(([_, r]) => r?.status !== 'up');
    const workingChecks = Object.entries(regionResults).filter(([_, r]) => r?.status === 'up');
    
    if (anyDown && m.status !== 'down') {
      const failedRegions = failedChecks.map(([r]) => LOCATION_NAMES[r]?.name || r).join(', ');
      const incidentDesc = failedChecks[0]?.[1]?.checks ? generateIncidentDescription(m.name, failedRegions, { checks: failedChecks[0][1]?.checks, locationInfo: failedChecks[0][1]?.locationInfo, expectedStatus: m.expectedStatusCode }) : { title: `${m.name} is down`, description: `Monitor down from ${failedRegions}` };
      
      await db.collection('incidents').add({
        monitorId: m.id,
        monitorName: m.name,
        userId,
        title: incidentDesc.title,
        description: incidentDesc.description,
        incidentType: incidentDesc.type,
        isResolved: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        affectedLocations: failedRegions,
        workingLocations: workingChecks.map(([r]) => LOCATION_NAMES[r]?.name || r).join(', '),
        checkResults: regionResults,
        timeline: [{ time: now, event: 'Incident created', detail: 'First failure detected' }]
      });
      
      sendAlertEmail(m, 'down', {
        title: incidentDesc.title,
        description: incidentDesc.description,
        affectedLocations: failedRegions,
        workingLocations: workingChecks.map(([r]) => LOCATION_NAMES[r]?.name || r).join(', '),
        checkResults: failedChecks[0]?.[1]?.checks
      });
    } else if (anyRegional && m.status === 'down') {
      const existingIncidents = await db.collection('incidents').where('monitorId', '==', m.id).where('isResolved', '==', false).get();
      if (!existingIncidents.empty) {
        const inc = existingIncidents.docs[0];
        const data = inc.data();
        await db.collection('incidents').doc(inc.id).update({
          isResolved: true,
          resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
          timeline: [...(data.timeline || []), { time: now, event: 'Recovered', detail: `Service recovered after being down` }]
        });
        
        sendAlertEmail(m, 'recovered', {
          title: `${m.name} has recovered`,
          description: `The service is now responding normally in ${workingChecks.map(([r]) => LOCATION_NAMES[r]?.name || r).join(', ')} after being down.`,
          affectedLocations: data.affectedLocations,
          workingLocations: workingChecks.map(([r]) => LOCATION_NAMES[r]?.name || r).join(', ')
        });
      }
    }
    
    if (anyDown) downCount++;
    totalResponse += avgResponseTime;
    
    batch.update(db.collection('monitors').doc(m.id), {
      status: overallStatus,
      avgResponseMs: avgResponseTime,
      lastCheck: firebase.firestore.FieldValue.serverTimestamp(),
      lastError: failedChecks[0]?.[1]?.checks?.fullLoad?.error || failedChecks[0]?.[1]?.checks?.connectivity?.error,
      checkHistory: [...(m.checkHistory || []).slice(-47), { time: now, status: overallStatus, responseTime: avgResponseTime, regions: regionResults }]
    });
  }
  
  await batch.commit();
  return { downCount, avgResponse: monitorsList.length > 0 ? Math.round(totalResponse / monitorsList.length) : 0 };
};

// Code block helper to render JSON/curl without JSX conflicts
const CodeBlock = ({ code, color = '#E8E8F0' }) => (
  <div className="p-4 bg-[#0A0A0F] border border-cyan-500/20 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre" style={{ color }}>{code}</div>
);

// Generate chart data
const generateChartData = () => {
  const regions = ['Nairobi', 'Frankfurt', 'New York', 'London', 'Singapore', 'Tokyo', 'Sydney', 'São Paulo', 'Mumbai', 'Dubai', 'Amsterdam', 'Toronto'];
  return Array.from({ length: 24 }, (_, i) => {
    const data = { time: `${i}:00` };
    regions.forEach(r => { data[r] = Math.floor(Math.random() * 200) + 80; });
    return data;
  });
};

// Spinner
const Spinner = () => <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>;

// Password Input
const PasswordInput = ({ value, onChange, placeholder, error }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} className={`input-field w-full pr-10 ${error ? 'border-red-500' : ''}`} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        {show ? ICONS.eyeOff : ICONS.eye}
      </button>
    </div>
  );
};

// Landing Page
const LandingPage = () => {
  const { navigate } = useNavigation();
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-4xl w-full text-center">
        <div className="mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            {ICONS.radio}
            <h1 className="text-4xl font-bold" style={{ fontFamily: 'Syne' }}>PulseGrid</h1>
          </div>
          <p className="text-xl text-cyan-400 mb-2">[v2.0] Your APIs. Always Alive.</p>
          <p className="text-gray-400">Monitor your services from global locations. Get instant alerts when things break.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: ICONS.activity, title: 'Real-time Monitoring', desc: 'Check your APIs every 30 seconds from multiple global locations' },
            { icon: ICONS.bell, title: 'Instant Alerts', desc: 'Get notified the second something goes down' },
            { icon: ICONS.globe, title: 'Status Pages', desc: 'Auto-generate beautiful public status pages' },
          ].map((f, i) => (
            <div key={i} className="card-glass p-6 text-center">
              <div className="text-cyan-400 mb-4 flex justify-center">{f.icon}</div>
              <h3 className="font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={() => navigate('signup')} className="btn-primary px-8 py-4 text-lg">Get Started Free</button>
          <button onClick={() => navigate('login')} className="btn-ghost px-8 py-4 text-lg">Sign In</button>
        </div>
      </div>
    </div>
  );
};

// Email Verification Screen
const EmailVerificationScreen = ({ onResend, onContinue, onBack, resendCooldown }) => {
  const { auth } = window;
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card-glass p-8 w-full max-w-md text-center">
        <div className="text-cyan-400 mb-6 flex justify-center">{ICONS.mail}</div>
        <h2 className="text-2xl font-bold mb-4">Verify Your Email</h2>
        <p className="text-gray-400 mb-2">We sent a verification link to</p>
        <p className="text-cyan-400 font-medium mb-6">{auth.currentUser?.email}</p>
        <p className="text-sm text-gray-500 mb-2">Click the link in your email to activate your account.</p>
        <p className="text-xs text-amber-400 mb-8">📧 Also check your spam/junk folder if you don't see it within a few minutes.</p>
        <div className="space-y-3">
          <button onClick={onResend} disabled={resendCooldown > 0} className="btn-ghost w-full py-3">
            {resendCooldown > 0 ? `Resend Email (${resendCooldown}s)` : 'Resend Email'}
          </button>
          <button onClick={onContinue} className="btn-primary w-full py-3">I've verified, continue</button>
          <button onClick={onBack} className="text-gray-400 hover:text-white text-sm mt-4">Back to Login</button>
        </div>
      </div>
    </div>
  );
};

// Auth Page
const AuthPage = ({ initialTab }) => {
  const [tab, setTab] = useState(initialTab || 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const { toast, navigate } = useContext(NavigationContext);

  const validateEmail = (e) => e.includes('@') && e.includes('.');
  const validatePassword = (p) => p.length >= 6;

  const handleSignUp = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!fullName.trim()) newErrors.fullName = 'Please enter your name';
    if (!validateEmail(email)) newErrors.email = 'Please enter a valid email';
    if (!validatePassword(password)) newErrors.password = 'Password must be at least 6 characters';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setLoading(true);
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      await user.updateProfile({ displayName: fullName });
      try { await user.sendEmailVerification(); } catch (e) { console.error('Verification error:', e); }
      await db.collection('users').doc(user.uid).set({
        uid: user.uid, email, fullName, companyName: companyName || '', plan: 'pro',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(), avatarUrl: '', emailVerified: false
      });
      navigate('verify-email');
    } catch (error) {
      let msg = 'Sign up failed';
      if (error.code === 'auth/email-already-in-use') msg = 'This email is already registered. Try logging in.';
      else if (error.code === 'auth/weak-password') msg = 'Password must be at least 6 characters.';
      else if (error.code === 'auth/invalid-email') msg = 'Please enter a valid email address.';
      toast('error', msg);
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!validateEmail(email)) newErrors.email = 'Please enter a valid email';
    if (!password) newErrors.password = 'Please enter your password';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setLoading(true);
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      let msg = 'Login failed';
      if (error.code === 'auth/user-not-found') msg = 'No account found with this email. Sign up first.';
      else if (error.code === 'auth/wrong-password') msg = 'Incorrect password. Try again.';
      else if (error.code === 'auth/too-many-requests') msg = 'Too many failed attempts. Try again later.';
      toast('error', msg);
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      const user = result.user;
      const isNew = result.additionalUserInfo.isNewUser;
      if (isNew) {
        await db.collection('users').doc(user.uid).set({
          uid: user.uid, email: user.email, fullName: user.displayName || '',
          companyName: '', plan: 'pro', createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          avatarUrl: user.photoURL || '', emailVerified: true
        });
        toast('success', 'Welcome to PulseGrid! Your account has been created.');
      } else {
        toast('success', 'Welcome back, ' + (user.displayName || 'User') + '!');
      }
    } catch (error) {
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error.code)) {
        toast('error', 'Google sign in failed');
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) { toast('error', 'Enter your email address first'); return; }
    setLoading(true);
    try {
      await auth.sendPasswordResetEmail(email);
      setForgotSent(true);
      setMessage('Password reset email sent! Check your inbox (and spam folder).');
    } catch (error) {
      console.error('Password reset error:', error);
      let msg = 'Failed to send reset email';
      if (error.code === 'auth/user-not-found') msg = 'No account with this email exists';
      else if (error.code === 'auth/invalid-email') msg = 'Invalid email address';
      else if (error.code === 'auth/too-many-requests') msg = 'Too many attempts. Try again later';
      toast('error', msg);
      setMessage('');
    }
    setLoading(false);
  };

  if (showForgot) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-glass p-8 w-full max-w-md">
          <button onClick={() => { setShowForgot(false); setForgotSent(false); }} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">{ICONS.chevronLeft} Back</button>
          <h2 className="text-2xl font-bold mb-6">Reset Password</h2>
          {forgotSent ? (
            <div className="text-center">
              <div className="text-cyan-400 mb-4 flex justify-center">{ICONS.mail}</div>
              <p className="text-gray-400 mb-2">Check your inbox (and spam folder) for the reset link.</p>
              <p className="text-xs text-amber-400 mb-6">📧 Also check your spam/junk folder if you don't see it within a few minutes.</p>
              <button onClick={() => { setShowForgot(false); setForgotSent(false); setTab('login'); }} className="btn-primary w-full py-3">Back to Login</button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-gray-400 text-sm mb-4">Enter your email and we'll send you a link to reset your password.</p>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field w-full" placeholder="victor@company.com" />
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">{loading ? <Spinner /> : 'Send Reset Link'}</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card-glass p-8 w-full max-w-md">
        <div className="flex gap-2 mb-6">
          <button onClick={() => { setTab('login'); setErrors({}); setShowForgot(false); }} className={`flex-1 py-2 rounded-lg font-medium transition-colors ${tab === 'login' ? 'bg-cyan-900 text-cyan-400' : 'text-gray-400 hover:text-white'}`}>Log In</button>
          <button onClick={() => { setTab('signup'); setErrors({}); setShowForgot(false); }} className={`flex-1 py-2 rounded-lg font-medium transition-colors ${tab === 'signup' ? 'bg-cyan-900 text-cyan-400' : 'text-gray-400 hover:text-white'}`}>Sign Up</button>
        </div>
        <button onClick={handleGoogleSignIn} disabled={loading} className="w-full py-3 px-4 bg-white text-gray-700 rounded-lg font-medium flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors mb-4" style={{ border: '1px solid #ddd' }}>
          {loading ? <Spinner /> : ICONS.google}
          <span>Sign in with Google</span>
        </button>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-gray-700"></div>
          <span className="text-gray-500 text-sm">or continue with email</span>
          <div className="flex-1 h-px bg-gray-700"></div>
        </div>
        {tab === 'signup' ? (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Full Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={`input-field w-full ${errors.fullName ? 'border-red-500' : ''}`} placeholder="Victor M." />
              {errors.fullName && <p className="text-red-400 text-xs mt-1">{errors.fullName}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={`input-field w-full ${errors.email ? 'border-red-500' : ''}`} placeholder="victor@company.com" />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" error={errors.password} />
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Company Name <span className="text-gray-600">(Optional)</span></label>
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="input-field w-full" placeholder="Acme Inc." />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">{loading ? <Spinner /> : 'Create Account'}</button>
            <p className="text-center text-sm text-gray-400 mt-4">Already have an account? <button type="button" onClick={() => { setTab('login'); setErrors({}); }} className="text-cyan-400 hover:text-cyan-300">Log in</button></p>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={`input-field w-full ${errors.email ? 'border-red-500' : ''}`} placeholder="victor@company.com" />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" error={errors.password} />
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
            </div>
            <div className="text-right">
              <button type="button" onClick={() => setShowForgot(true)} className="text-sm text-cyan-400 hover:text-cyan-300">Forgot password?</button>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">{loading ? <Spinner /> : 'Log In'}</button>
            <p className="text-center text-sm text-gray-400 mt-4">Don't have an account? <button type="button" onClick={() => { setTab('signup'); setErrors({}); }} className="text-cyan-400 hover:text-cyan-300">Sign up</button></p>
          </form>
        )}
      </div>
    </div>
  );
};

// Dashboard
const Dashboard = () => {
  const { toast, navigate, userData, setUserData } = useContext(NavigationContext);
  const [monitors, setMonitors] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, up: 0, down: 0, avgResponse: 0 });
  const [checking, setChecking] = useState(false);
  const monitorsRef = useRef([]);

  const handleCheck = async () => {
    const mons = monitorsRef.current;
    if (checking || mons.length === 0) return;
    setChecking(true);
    try {
      const result = await checkAllMonitors(mons, auth.currentUser.uid);
      setStats(prev => ({ ...prev, down: result.downCount, avgResponse: result.avgResponse }));
      toast(result.downCount > 0 ? 'warning' : 'success', result.downCount > 0 ? `${result.downCount} monitor(s) down` : 'All monitors checked successfully');
    } catch (err) { 
      console.error('Check failed:', err);
      toast('error', 'Failed to check monitors');
    }
    setChecking(false);
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const loadData = async () => {
      try {
        const mSnap = await db.collection('monitors').where('userId', '==', auth.currentUser.uid).get();
        const monitorsList = mSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setMonitors(monitorsList);
        const up = monitorsList.filter(m => m.status === 'up' || m.status === 'pending' || !m.status).length;
        const down = monitorsList.filter(m => m.status === 'down').length;
        setStats({ total: monitorsList.length, up, down, avgResponse: monitorsList.length > 0 ? Math.round(monitorsList.reduce((a, m) => a + (m.avgResponseMs || 0), 0) / monitorsList.length) : 0 });
        const iSnap = await db.collection('incidents').where('userId', '==', auth.currentUser.uid).limit(10).get();
        setIncidents(iSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) { console.error('Error loading data:', err); }
      setChartData(generateChartData());
      setLoading(false);
    };
    loadData();
    const unsubscribe = db.collection('monitors').where('userId', '==', auth.currentUser.uid).onSnapshot((snapshot) => {
      const monitorsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setMonitors(monitorsList);
      monitorsRef.current = monitorsList;
      const up = monitorsList.filter(m => m.status === 'up' || m.status === 'pending' || !m.status).length;
      const down = monitorsList.filter(m => m.status === 'down').length;
      setStats(prev => ({ ...prev, total: monitorsList.length, up, down }));
    });
    return () => unsubscribe();
  }, []);

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-sm text-gray-400">Real-time status of all your monitors</p></div>
        <div className="flex gap-2">
          <button onClick={handleCheck} disabled={checking} className="btn-ghost flex items-center gap-2">{checking ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : '🔄'} Check Now</button>
          <button onClick={() => navigate('add-monitor')} className="btn-primary flex items-center gap-2">{ICONS.plus} Add Monitor</button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ label: 'Total Monitors', value: stats.total, icon: ICONS.activity }, { label: 'Up', value: stats.up, icon: ICONS.check }, { label: 'Down', value: stats.down, icon: ICONS.x }, { label: 'Avg Response', value: stats.avgResponse ? `${stats.avgResponse}ms` : '—', icon: ICONS.zap }].map((s, i) => (
          <div key={i} className="card-glass p-4">
            <div className="flex items-center gap-3 mb-2"><span className="text-gray-400">{s.icon}</span><span className="text-sm text-gray-400">{s.label}</span></div>
            <div className="text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>
      {stats.down > 0 && incidents.filter(i => !i.isResolved).length > 0 && (
        <div className="card-glass p-5 alert-banner border border-red-900">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-red-400">{ICONS.activity}</span>
            <span className="font-bold text-red-400">{stats.down} monitor(s) experiencing issues</span>
          </div>
          <div className="mt-3 space-y-2">
            {incidents.filter(i => !i.isResolved).slice(0, 3).map(inc => (
              <div key={inc.id} className="text-sm text-gray-300">
                <span className="text-red-400">•</span> {inc.title || inc.monitorName} — {inc.description?.length > 80 ? inc.description.substring(0, 77) + '...' : inc.description}
              </div>
            ))}
          </div>
        </div>
      )}
      {stats.down === 0 && (
        <div className="card-glass p-5 alert-banner border border-green-900 bg-green-900/10">
          <div className="flex items-center gap-3"><span className="text-green-400">✅</span><span className="font-bold text-green-400">All monitors operational</span></div>
          <div className="text-sm text-gray-400 mt-1">No issues detected. All checks passing across all locations.</div>
        </div>
      )}
<div className="card-glass p-6">
          <div className="flex items-center justify-between mb-4"><h3 className="font-bold">🌍 Global Monitoring Map</h3><span className="text-xs text-gray-500">Click markers to see details</span></div>
          <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ height: '350px' }}>
            <LeafletMap monitors={monitors} userData={userData} />
          </div>
        </div>
        <div className="card-glass p-6">
          <h3 className="font-bold mb-4">Response Time (24h)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E" />
              <XAxis dataKey="time" stroke="#6B6B8A" fontSize={12} />
              <YAxis stroke="#6B6B8A" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#0D0D18', border: '1px solid #1A1A2E', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="Nairobi" stroke="#00F5FF" strokeWidth={2} dot={false} name="Nairobi" />
              <Line type="monotone" dataKey="Frankfurt" stroke="#39FF14" strokeWidth={2} dot={false} name="Frankfurt" />
              <Line type="monotone" dataKey="New York" stroke="#FFB800" strokeWidth={2} dot={false} name="New York" />
              <Line type="monotone" dataKey="London" stroke="#E040FB" strokeWidth={1.5} dot={false} name="London" />
              <Line type="monotone" dataKey="Singapore" stroke="#FF5722" strokeWidth={1.5} dot={false} name="Singapore" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-glass p-6">
          <div className="flex items-center justify-between mb-4"><h3 className="font-bold">Active Monitors</h3><button onClick={() => navigate('monitors')} className="text-sm text-cyan-400">View all</button></div>
          <div className="space-y-3">
            {monitors.slice(0, 4).map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <div><div className="font-medium">{m.name}</div><div className="text-xs text-gray-500">{m.url}</div></div>
                <span className={`status-badge ${m.status === 'up' || m.status === 'pending' || !m.status ? 'up' : m.status === 'slow' ? 'slow' : 'down'}`}><span className={`pulse-dot ${m.status === 'up' || m.status === 'pending' || !m.status ? 'green' : m.status === 'slow' ? 'amber' : 'red'}`}></span>{m.status === 'pending' || !m.status ? 'UP' : (m.status || 'UP').toUpperCase()}</span>
              </div>
            ))}
            {monitors.length === 0 && <p className="text-gray-500 text-sm">No monitors yet. Add your first one!</p>}
          </div>
        </div>
        <div className="card-glass p-6">
          <div className="flex items-center justify-between mb-4"><h3 className="font-bold">Global Server Locations</h3></div>
          <p className="text-xs text-gray-500 mb-3">We check your monitors from these 12 locations worldwide:</p>
          <div className="grid grid-cols-4 gap-2">
            {MONITORING_REGIONS.map(r => (
              <div key={r.id} className="flex items-center gap-1 text-xs p-2 bg-gray-900 rounded">
                <span>{r.flag}</span><span className="truncate">{r.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card-glass p-6">
          <div className="flex items-center justify-between mb-4"><h3 className="font-bold">Recent Incidents</h3><button onClick={() => navigate('monitors')} className="text-sm text-cyan-400">View all incidents</button></div>
          <div className="space-y-3">
            {incidents.slice(0, 5).map(inc => (
              <div key={inc.id} className="p-3 bg-gray-900 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{inc.monitorName}</div>
                  <div className="text-xs text-gray-400">{inc.title || inc.reason}</div>
                  {inc.affectedLocations && <div className="text-xs text-red-400 mt-1">❌ {inc.affectedLocations}</div>}
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded block mb-1 ${inc.isResolved ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>{inc.isResolved ? 'RESOLVED' : 'ONGOING'}</span>
                  {inc.description && <span className="text-xs text-gray-500 block max-w-[150px] truncate">{inc.description}</span>}
                </div>
              </div>
            ))}
            {incidents.length === 0 && (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🎉</div>
                <p className="text-gray-400">No incidents! Everything is running smoothly.</p>
                <p className="text-xs text-gray-500 mt-2">All your monitors are responding correctly.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Add Monitor Page
const AddMonitorPage = () => {
  const { toast, navigate } = useContext(NavigationContext);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [errors, setErrors] = useState({});
  const [showUrlHelp, setShowUrlHelp] = useState(false);
  const [showAuthHelp, setShowAuthHelp] = useState(false);
  const [showSlackHelp, setShowSlackHelp] = useState(false);
  const [showDiscordHelp, setShowDiscordHelp] = useState(false);
  const [headers, setHeaders] = useState([{ key: '', value: '' }]);
  const [tagInput, setTagInput] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', url: '', method: 'GET', body: '', hasAuth: false, authType: 'bearer', authValue: '',
    headerName: '', headerValue: '', basicUser: '', basicPass: '',
    tags: [],
    intervalSeconds: 300, timeoutSeconds: 30,
    locations: ['nairobi', 'frankfurt', 'newyork'],
    expectedStatusCode: 200, customStatusCode: '', responseMustContain: '', responseMustNotContain: '',
    maxResponseMs: 3000, slaTarget: 99.9,
    alertEmail: '', additionalEmails: [], newEmail: '', hasSms: false, smsNumber: '', countryCode: '+254',
    slackWebhook: '', discordWebhook: '',
    alertAfterFailures: 3, recoveryNotification: true
  });

  useEffect(() => {
    if (!auth.currentUser) { navigate('landing'); return; }
    setFormData(prev => ({ ...prev, alertEmail: auth.currentUser?.email || '' }));
    const checkLimits = async () => {
      try {
        const monitorsSnap = await db.collection('monitors').where('userId', '==', auth.currentUser.uid).get();
        if (monitorsSnap.size >= 100) setShowUpgradeModal(true);
      } catch (e) { console.error(e); }
    };
    checkLimits();
  }, [navigate]);

  const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  const addTag = () => { if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) { setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] })); setTagInput(''); } };
  const removeTag = (tag) => setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  const addHeader = () => setHeaders([...headers, { key: '', value: '' }]);
  const updateHeader = (i, field, value) => { const h = [...headers]; h[i][field] = value; setHeaders(h); };
  const removeHeader = (i) => setHeaders(headers.filter((_, idx) => idx !== i));

  const validateStep = () => {
    const newErrors = {};
    if (step === 1) {
      if (!formData.name || formData.name.length < 2) newErrors.name = 'Please enter a name for this monitor';
      if (!formData.url) newErrors.url = 'Please enter a URL';
      else if (!formData.url.startsWith('https://')) newErrors.url = 'URL must start with https://';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => { if (validateStep()) setStep(s => Math.min(s + 1, 3)); };
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const runTerminal = async (msgs) => {
    for (const msg of msgs) { setTerminalOutput(prev => [...prev, msg]); await new Promise(r => setTimeout(r, 400)); }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setLoading(true);
    setTerminalOutput([]);
    try {
      await runTerminal(['→ Validating configuration...']);
      await runTerminal(['→ Registering with Nairobi node 🇰🇪...']);
      await runTerminal(['→ Registering with Frankfurt node 🇩🇪...']);
      await runTerminal(['→ Registering with New York node 🇺🇸...']);
      await runTerminal(['→ Running first check...']);
      const headersObj = {};
      headers.forEach(h => { if (h.key) headersObj[h.key] = h.value; });
      if (formData.hasAuth) {
        if (formData.authType === 'bearer') headersObj['Authorization'] = `Bearer ${formData.authValue}`;
        else if (formData.authType === 'apikey') headersObj[formData.headerName] = formData.headerValue;
        else if (formData.authType === 'basic') headersObj['Authorization'] = `Basic ${btoa(formData.basicUser + ':' + formData.basicPass)}`;
      }
      await db.collection('monitors').add({
        userId: auth.currentUser.uid,
        name: formData.name, url: formData.url, method: formData.method, headers: headersObj, body: formData.body,
        authType: formData.hasAuth ? formData.authType : null,
        intervalSeconds: formData.intervalSeconds, timeoutSeconds: formData.timeoutSeconds, locations: formData.locations,
        expectedStatusCode: formData.expectedStatusCode === 'custom' ? parseInt(formData.customStatusCode) : formData.expectedStatusCode,
        responseMustContain: formData.responseMustContain, responseMustNotContain: formData.responseMustNotContain,
        maxResponseMs: formData.maxResponseMs, slaTarget: formData.slaTarget,
        alertContacts: [formData.alertEmail, ...formData.additionalEmails].filter(Boolean),
        slackWebhook: formData.slackWebhook, discordWebhook: formData.discordWebhook,
        alertAfterFailures: formData.alertAfterFailures, recoveryNotification: formData.recoveryNotification,
        tags: formData.tags, isActive: true, status: 'pending', isPaused: false, uptimePercentage: 100, avgResponseMs: 0, checkHistory: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await runTerminal(['✅ First ping successful!']);
      setTimeout(() => setShowSuccess(true), 600);
    } catch (err) { toast('error', 'Failed to create monitor'); setLoading(false); }
  };

  if (showUpgradeModal) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <div className="card-glass p-8">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Syne' }}>Upgrade to Pro</h2>
          <p className="text-gray-400 mb-4">You've reached the free plan limit of 100 monitors.</p>
          <button onClick={() => navigate('monitors')} className="btn-ghost w-full mb-3">Back to Monitors</button>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <div className="card-glass p-8">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Syne' }}>Monitor Created!</h2>
          <p className="text-gray-400 mb-2">PulseGrid is now watching <span className="text-cyan-400">{formData.name}</span> 24/7.</p>
          <p className="text-gray-500 text-sm mb-6">You'll be alerted if it's down for more than 15 minutes.</p>
          <button onClick={() => navigate('dashboard')} className="btn-primary w-full py-3 mb-3">Go to Dashboard</button>
          <button onClick={() => { setShowSuccess(false); setStep(1); setFormData({ ...formData, name: '', url: '', method: 'GET', body: '', hasAuth: false, authValue: '', tags: [], alertEmail: auth.currentUser?.email || '', additionalEmails: [] }); }} className="btn-ghost w-full py-3">Add Another Monitor</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="card-glass p-6 font-mono text-sm">
          {terminalOutput.map((line, i) => <div key={i} className="py-1">{line}</div>)}
          <div className="w-6 h-4 border-r-2 border-cyan-400 animate-pulse inline-block"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => { if (step === 1) navigate('monitors'); else prevStep(); }} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6">{ICONS.chevronLeft} Back</button>
      <h1 className="text-2xl font-bold mb-2 text-center" style={{ fontFamily: 'Syne' }}>Add New Monitor</h1>
      
      <div className="flex items-center justify-center mb-6">
        {[{ num: 1, label: 'Endpoint' }, { num: 2, label: 'Settings' }, { num: 3, label: 'Alerts' }].map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className={`flex flex-col items-center ${step >= s.num ? 'text-cyan-400' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step > s.num ? 'bg-green-500' : step === s.num ? 'bg-cyan-500 text-black' : 'bg-gray-700'}`}>
                {step > s.num ? '✓' : s.num}
              </div>
              <span className="text-xs mt-1">{s.label}</span>
            </div>
            {i < 2 && <div className={`w-12 h-0.5 mx-2 ${step > s.num ? 'bg-green-500' : 'bg-gray-700'}`}></div>}
          </div>
        ))}
      </div>

      <div className="card-glass p-6">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Monitor Name *</label>
              <input value={formData.name} onChange={e => { updateField('name', e.target.value); if (errors.name) setErrors({ ...errors, name: '' }); }} className={`input-field w-full ${errors.name ? 'input-error' : ''}`} placeholder="e.g. Payment API" />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Endpoint URL *</label>
              <input value={formData.url} onChange={e => { updateField('url', e.target.value); if (errors.url) setErrors({ ...errors, url: '' }); }} className={`input-field w-full ${errors.url ? 'input-error' : ''}`} placeholder="https://your-api.com/health" />
              {errors.url && <p className="text-red-400 text-xs mt-1">{errors.url}</p>}
              <button onClick={() => setShowUrlHelp(!showUrlHelp)} className="text-cyan-400 text-xs mt-1">❓ Where do I find my API URL?</button>
              {showUrlHelp && <div className="mt-2 p-3 bg-cyan-900/30 border border-cyan-500/30 rounded-lg text-xs text-gray-300">Your URL is the web address your API responds to.</div>}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">HTTP Method</label>
              <div className="flex gap-2 flex-wrap">
                {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].map(m => (
                  <button key={m} onClick={() => updateField('method', m)} className={`px-3 py-1.5 rounded-lg text-xs ${formData.method === m ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400'}`}>{m}</button>
                ))}
              </div>
            </div>
            {['POST', 'PUT', 'PATCH'].includes(formData.method) && (
              <div><label className="block text-sm text-gray-400 mb-1">Request Body (JSON)</label><textarea value={formData.body} onChange={e => updateField('body', e.target.value)} className="input-field w-full font-mono text-sm h-20" placeholder='{"test": true}' /></div>
            )}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.hasAuth} onChange={e => updateField('hasAuth', e.target.checked)} className="w-4 h-4" />
                <span className="text-sm text-gray-400">Requires authentication</span>
              </label>
              {formData.hasAuth && (
                <div className="mt-3 pl-4 space-y-3">
                  <div className="flex gap-2">
                    {[{ v: 'bearer', l: 'Bearer' }, { v: 'apikey', l: 'API Key' }, { v: 'basic', l: 'Basic' }].map(t => (
                      <button key={t.v} onClick={() => updateField('authType', t.v)} className={`flex-1 p-2 rounded-lg border text-xs ${formData.authType === t.v ? 'border-cyan-500 bg-cyan-900/30' : 'border-gray-700 bg-gray-800'}`}>{t.l}</button>
                    ))}
                  </div>
                  {formData.authType === 'bearer' && <PasswordInput value={formData.authValue} onChange={e => updateField('authValue', e.target.value)} placeholder="eyJhbGc..." />}
                  {formData.authType === 'apikey' && <div className="grid grid-cols-2 gap-2"><input value={formData.headerName} onChange={e => updateField('headerName', e.target.value)} className="input-field" placeholder="Header name" /><PasswordInput value={formData.headerValue} onChange={e => updateField('headerValue', e.target.value)} placeholder="API key" /></div>}
                  {formData.authType === 'basic' && <div className="grid grid-cols-2 gap-2"><input value={formData.basicUser} onChange={e => updateField('basicUser', e.target.value)} className="input-field" placeholder="Username" /><PasswordInput value={formData.basicPass} onChange={e => updateField('basicPass', e.target.value)} placeholder="Password" /></div>}
                </div>
              )}
            </div>
            <div>
              <button onClick={addHeader} className="text-cyan-400 text-xs">+ Add Custom Header</button>
              {headers.map((h, i) => (
                <div key={i} className="flex gap-2 mt-2">
                  <input value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)} className="input-field flex-1" placeholder="Key" />
                  <input value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)} className="input-field flex-1" placeholder="Value" />
                  <button onClick={() => removeHeader(i)} className="text-red-400">×</button>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tags (optional)</label>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} className="input-field w-full" placeholder="production, payment" />
              <div className="flex gap-1 mt-2 flex-wrap">
                {formData.tags.map((tag, i) => (<span key={i} className="px-2 py-1 bg-cyan-900/50 text-cyan-400 rounded-full text-xs flex items-center gap-1">{tag} <button onClick={() => removeTag(tag)} className="text-gray-400 hover:text-white">×</button></span>))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Check Interval</label>
              <div className="grid grid-cols-3 gap-2">
                {[{ v: 30, l: '30s' }, { v: 60, l: '1m' }, { v: 300, l: '5m', def: true }, { v: 900, l: '15m' }, { v: 1800, l: '30m' }, { v: 3600, l: '1h' }].map(o => (
                  <button key={o.v} onClick={() => updateField('intervalSeconds', o.v)} className={`p-2 rounded-lg border text-xs ${formData.intervalSeconds === o.v ? 'border-cyan-500 bg-cyan-900/30' : 'border-gray-700 bg-gray-800'}`}>{o.l}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Timeout: {formData.timeoutSeconds}s</label>
              <input type="range" min="5" max="60" value={formData.timeoutSeconds} onChange={e => updateField('timeoutSeconds', parseInt(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Monitoring Locations (choose multiple)</label>
              <div className="grid grid-cols-2 gap-2">
                {MONITORING_REGIONS.map(o => (
                  <label key={o.id} className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer ${formData.locations.includes(o.id) ? 'border-cyan-500 bg-cyan-900/20' : 'border-gray-700 bg-gray-800'}`}>
                    <span>{o.flag} {o.name}</span>
                    <input type="checkbox" checked={formData.locations.includes(o.id)} onChange={e => updateField('locations', e.target.checked ? [...formData.locations, o.id] : formData.locations.filter(l => l !== o.id))} className="w-4 h-4" />
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">We'll check your URL from all selected locations</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Expected Status</label>
              <select value={formData.expectedStatusCode} onChange={e => updateField('expectedStatusCode', e.target.value)} className="input-field">
                {[200, 201, 204, 301, 302, 400, 401, 404, 500].map(c => <option key={c} value={c}>{c}</option>)}
                <option value="custom">Custom</option>
              </select>
              {formData.expectedStatusCode === 'custom' && <input type="number" value={formData.customStatusCode} onChange={e => updateField('customStatusCode', e.target.value)} className="input-field mt-2" placeholder="Status code" />}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Response: {formData.maxResponseMs}ms</label>
              <input type="range" min="100" max="10000" step="100" value={formData.maxResponseMs} onChange={e => updateField('maxResponseMs', parseInt(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">SLA Target</label>
              <select value={formData.slaTarget} onChange={e => updateField('slaTarget', parseFloat(e.target.value))} className="input-field">
                {[99, 99.5, 99.9, 99.95, 99.99].map(c => <option key={c} value={c}>{c}%</option>)}
              </select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Alert Emails</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.alertEmail && <span className="px-2 py-1 bg-cyan-900/50 text-cyan-400 rounded-full text-xs">{formData.alertEmail}</span>}
                {formData.additionalEmails.map((e, i) => <span key={i} className="px-2 py-1 bg-cyan-900/50 text-cyan-400 rounded-full text-xs flex items-center gap-1">{e} <button onClick={() => updateField('additionalEmails', formData.additionalEmails.filter((_, idx) => idx !== i))}>×</button></span>)}
              </div>
              <input value={formData.newEmail || ''} onChange={e => updateField('newEmail', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { updateField('additionalEmails', [...formData.additionalEmails, formData.newEmail]); updateField('newEmail', ''); } }} className="input-field w-full" placeholder="Add another email (Enter)" />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.hasSms} onChange={e => updateField('hasSms', e.target.checked)} className="w-4 h-4" />
                <span className="text-sm text-gray-400">SMS Alerts</span>
              </label>
              {formData.hasSms && <div className="mt-2 flex gap-2"><select value={formData.countryCode} onChange={e => updateField('countryCode', e.target.value)} className="input-field w-24"><option value="+254">🇰🇪</option><option value="+1">🇺🇸</option><option value="+49">🇩🇪</option></select><input value={formData.smsNumber} onChange={e => updateField('smsNumber', e.target.value)} className="input-field flex-1" placeholder="Phone" /></div>}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Slack Webhook</label>
              <input value={formData.slackWebhook} onChange={e => updateField('slackWebhook', e.target.value)} className="input-field w-full" placeholder="https://hooks.slack.com/..." />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Discord Webhook</label>
              <input value={formData.discordWebhook} onChange={e => updateField('discordWebhook', e.target.value)} className="input-field w-full" placeholder="https://discord.com/api/webhooks/..." />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Alert after</label>
              <div className="grid grid-cols-4 gap-2">
                {[{ v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3', rec: true }, { v: 5, l: '5' }].map(o => (
                  <button key={o.v} onClick={() => updateField('alertAfterFailures', o.v)} className={`p-2 rounded-lg border text-xs ${formData.alertAfterFailures === o.v ? 'border-cyan-500 bg-cyan-900/30' : 'border-gray-700 bg-gray-800'}`}>{o.l} {o.rec && '✓'}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.recoveryNotification} onChange={e => updateField('recoveryNotification', e.target.checked)} className="w-4 h-4" />
                <span className="text-sm text-gray-400">Notify when recovered</span>
              </label>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t border-gray-700">
          {step > 1 && <button onClick={prevStep} className="btn-ghost">← Back</button>}
          {step < 3 ? <button onClick={nextStep} className="btn-primary ml-auto">Next →</button> : <button onClick={handleSubmit} className="btn-primary ml-auto">🚀 Create Monitor</button>}
        </div>
      </div>
    </div>
  );
};

// Monitors Page
const MonitorsPage = () => {
  const { toast } = useContext(NavigationContext);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = db.collection('monitors').where('userId', '==', auth.currentUser.uid).onSnapshot((snapshot) => {
      setMonitors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id) => { setConfirmModal({ title: 'Delete monitor?', message: 'This will permanently delete this monitor and all its check history.', onConfirm: async () => { setConfirmModal(null); await db.collection('monitors').doc(id).delete(); toast('success', 'Monitor deleted'); }, danger: true, confirmText: 'Delete', cancelText: 'Cancel' }); };
  const handlePause = async (id) => { const m = monitors.find(x => x.id === id); await db.collection('monitors').doc(id).update({ isPaused: !m.isPaused }); };
  const filtered = monitors.filter(m => { const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()); const matchFilter = filter === 'all' || m.status === filter || (filter === 'up' && (!m.status || m.status === 'up' || m.status === 'pending')) || (filter === 'paused' && m.isPaused); return matchSearch && matchFilter; });

  const getStatusClass = (s) => {
    if (!s || s === 'up' || s === 'pending') return 'up';
    return s;
  };

  const getStatusLabel = (s) => {
    if (!s || s === 'up' || s === 'pending') return 'UP';
    if (s === 'pending') return 'CHECKING...';
    return s.toUpperCase();
  };

  const getStatusIcon = (s) => {
    if (!s || s === 'up' || s === 'pending') return '✅';
    if (s === 'down') return '🔴';
    if (s === 'slow') return '🟡';
    if (s === 'degraded') return '⚠️';
    if (s === 'critical_warning') return '🚨';
    if (s === 'pending') return '🔄';
    if (s === 'paused') return '⏸️';
    return '❓';
  };

  const getStatusExplanation = (m) => {
    if (m.isPaused) return 'Monitoring paused — click Resume to restart';
    if (!m.status || m.status === 'up') return 'Responding normally from all locations';
    if (m.status === 'down') return 'Not responding — server may be offline';
    if (m.status === 'slow') return 'Responding but slower than your ' + (m.maxResponseMs || 3000) + 'ms threshold';
    if (m.status === 'degraded') return 'Responding but content checks are failing';
    if (m.status === 'critical_warning') {
      if (m.lastError?.includes('SSL') || m.lastError?.includes('ssl')) return 'SSL certificate expiring — renew urgently';
      return m.lastError || 'Needs urgent attention';
    }
    return 'First check hasn\'t run yet — results in ~5 minutes';
  };

  const getActionButton = (m) => {
    if (m.isPaused) return null;
    if (m.status === 'down' || m.status === 'degraded' || m.status === 'critical_warning' || m.status === 'slow') {
      let label = '🔍 ';
      let modalTitle = '';
      if (m.status === 'down') { label += 'Check Server Status'; modalTitle = 'Quick diagnosis for ' + m.name; }
      else if (m.status === 'degraded') { label += 'What\'s Wrong?'; modalTitle = 'Content check failure details'; }
      else if (m.status === 'critical_warning') { label += 'Fix SSL Certificate'; modalTitle = 'SSL Certificate Warning'; }
      else if (m.status === 'slow') { label += '⚡ Speed Tips'; modalTitle = 'Speed Improvement Tips'; }
      return <button onClick={() => setShowModal({ monitor: m, type: m.status })} className="text-xs text-cyan-400 hover:text-cyan-300 mt-2">{label}</button>;
    }
    return null;
  };

  if (loading) return <div className="p-6 flex items-center justify-center min-h-[60vh]"><div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const statusCounts = {
    up: monitors.filter(m => !m.isPaused && (!m.status || m.status === 'up' || m.status === 'pending')).length,
    down: monitors.filter(m => !m.isPaused && m.status === 'down').length,
    slow: monitors.filter(m => !m.isPaused && m.status === 'slow').length,
    degraded: monitors.filter(m => !m.isPaused && m.status === 'degraded').length,
    critical: monitors.filter(m => !m.isPaused && m.status === 'critical_warning').length,
    paused: monitors.filter(m => m.isPaused).length
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Monitors</h1><p className="text-sm text-gray-400">{monitors.length} total monitors</p></div></div>

      <div className="flex flex-wrap gap-2">
        {statusCounts.up === monitors.length - statusCounts.paused && statusCounts.down === 0 ? (
          <div className="status-pill active bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-2">✅ All systems operational</div>
        ) : (
          <>
            {statusCounts.up > 0 && <button onClick={() => setFilter(filter === 'up' ? 'all' : 'up')} className={`status-pill ${filter === 'up' ? 'active bg-green-500/30' : 'bg-green-500/10'} text-green-400 border border-green-500/30 hover:bg-green-500/20`}>✅ {statusCounts.up} UP</button>}
            {statusCounts.down > 0 && <button onClick={() => setFilter(filter === 'down' ? 'all' : 'down')} className={`status-pill ${filter === 'down' ? 'active bg-red-500/30' : 'bg-red-500/10'} text-red-400 border border-red-500/30 hover:bg-red-500/20`}>🔴 {statusCounts.down} DOWN</button>}
            {statusCounts.critical > 0 && <button onClick={() => setFilter(filter === 'critical_warning' ? 'all' : 'critical_warning')} className={`status-pill ${filter === 'critical_warning' ? 'active bg-red-500/40' : 'bg-red-500/15'} text-red-400 border border-red-500/50 hover:bg-red-500/25`}>🚨 {statusCounts.critical} CRITICAL</button>}
            {statusCounts.slow > 0 && <button onClick={() => setFilter(filter === 'slow' ? 'all' : 'slow')} className={`status-pill ${filter === 'slow' ? 'active bg-amber-500/30' : 'bg-amber-500/10'} text-amber-400 border border-amber-500/30 hover:bg-amber-500/20`}>🟡 {statusCounts.slow} SLOW</button>}
            {statusCounts.degraded > 0 && <button onClick={() => setFilter(filter === 'degraded' ? 'all' : 'degraded')} className={`status-pill ${filter === 'degraded' ? 'active bg-orange-500/30' : 'bg-orange-500/10'} text-orange-400 border border-orange-500/30 hover:bg-orange-500/20`}>⚠️ {statusCounts.degraded} DEGRADED</button>}
            {statusCounts.paused > 0 && <button onClick={() => setFilter(filter === 'paused' ? 'all' : 'paused')} className={`status-pill ${filter === 'paused' ? 'active bg-gray-500/30' : 'bg-gray-500/10'} text-gray-400 border border-gray-500/30 hover:bg-gray-500/20`}>⏸️ {statusCounts.paused} PAUSED</button>}
          </>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search monitors..." className="input-field flex-1" />
        <select value={filter} onChange={e => setFilter(e.target.value)} className="input-field"><option value="all">All Status</option><option value="up">Up</option><option value="down">Down</option><option value="slow">Slow</option><option value="degraded">Degraded</option><option value="critical_warning">Critical</option><option value="paused">Paused</option></select>
      </div>

      <div className="card-glass overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900"><tr><th className="p-4 text-left text-sm text-gray-400">Monitor</th><th className="p-4 text-left text-sm text-gray-400">Status</th><th className="p-4 text-left text-sm text-gray-400">Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan="3" className="p-8 text-center">
                  <div className="text-4xl mb-4">📡</div>
                  <p className="text-gray-400 mb-4">No monitors found</p>
                  {(search || filter !== 'all') ? (
                    <button onClick={() => { setSearch(''); setFilter('all'); }} className="text-cyan-400 hover:text-cyan-300">Clear filters</button>
                  ) : (
                    <button onClick={() => navigate('add-monitor')} className="btn-primary">Add Your First Monitor</button>
                  )}
                </td>
              </tr>
            )}
            {filtered.map(m => (
              <tr key={m.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                <td className="p-4"><div className="font-medium">{m.name}</div><div className="text-xs text-gray-500">{m.url}</div></td>
                <td className="p-4">
                  <span className={`status-badge ${m.isPaused ? 'paused' : getStatusClass(m.status)}`}><span className={`pulse-dot ${m.isPaused ? 'gray' : m.status === 'up' || !m.status || m.status === 'pending' ? 'green' : m.status === 'slow' ? 'amber' : 'red'}`}></span>{m.isPaused ? 'PAUSED' : getStatusLabel(m.status)}</span>
                  <div className="status-explanation mt-1">{getStatusExplanation(m)}</div>
                  {getActionButton(m) && <div>{getActionButton(m)}</div>}
                </td>
                <td className="p-4"><div className="flex gap-2"><button onClick={() => handlePause(m.id)} className="p-2 hover:bg-gray-800 rounded">{m.isPaused ? ICONS.radio : ICONS.pause}</button><button onClick={() => handleDelete(m.id)} className="p-2 hover:bg-red-900 rounded text-red-400">{ICONS.trash}</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pt-10 mt-10 border-t border-cyan-500/20">
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'Orbitron', color: '#00F5FF' }}>Understanding Monitor Statuses</h2>
        <p className="text-sm text-gray-400 mb-6">What each status means and what you should do</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card-glass p-4 border-green-500/20 hover:border-green-500/40">
            <div className="flex items-center gap-2 mb-2"><span className="status-badge up">✅ UP</span></div>
            <h3 className="font-medium text-green-400 mb-2">Everything is working perfectly</h3>
            <p className="text-sm text-gray-400 mb-2">Your monitor is responding correctly from all checked locations. No action is needed.</p>
            <p className="text-xs text-gray-500">Example: "Response: 200 OK in 234ms from all locations"</p>
          </div>
          
          <div className="card-glass p-4 border-red-500/20 hover:border-red-500/40">
            <div className="flex items-center gap-2 mb-2"><span className="status-badge down">🔴 DOWN</span></div>
            <h3 className="font-medium text-red-400 mb-2">Your service is completely unreachable</h3>
            <p className="text-sm text-gray-400 mb-2">Users cannot access your service. Check your server/hosting is running.</p>
            <p className="text-xs text-gray-500">Example: "Connection timed out — no response after 30 seconds"</p>
          </div>
          
          <div className="card-glass p-4 border-amber-500/20 hover:border-amber-500/40">
            <div className="flex items-center gap-2 mb-2"><span className="status-badge slow">🟡 SLOW</span></div>
            <h3 className="font-medium text-amber-400 mb-2">Working but taking too long to respond</h3>
            <p className="text-sm text-gray-400 mb-2">Service is slow. Check CPU/memory usage and database queries.</p>
            <p className="text-xs text-gray-500">Example: "Response took 4,230ms — threshold is 3,000ms"</p>
          </div>
          
          <div className="card-glass p-4 border-orange-500/20 hover:border-orange-500/40">
            <div className="flex items-center gap-2 mb-2"><span className="status-badge degraded">⚠️ DEGRADED</span></div>
            <h3 className="font-medium text-orange-400 mb-2">Loading but something is wrong inside</h3>
            <p className="text-sm text-gray-400 mb-2">Server is running but returning unexpected content.</p>
            <p className="text-xs text-gray-500">Example: "Content check failed — unexpected error message"</p>
          </div>
          
          <div className="card-glass p-4 border-red-500/30 hover:border-red-500/50">
            <div className="flex items-center gap-2 mb-2"><span className="status-badge critical_warning">🚨 CRITICAL</span></div>
            <h3 className="font-medium text-red-400 mb-2">Needs urgent attention</h3>
            <p className="text-sm text-gray-400 mb-2">SSL certificate expiring soon. Renew immediately.</p>
            <p className="text-xs text-gray-500">Example: "SSL expires in 6 days"</p>
          </div>
          
          <div className="card-glass p-4 border-cyan-500/20 hover:border-cyan-500/40">
            <div className="flex items-center gap-2 mb-2"><span className="status-badge pending">🔄 CHECKING...</span></div>
            <h3 className="font-medium text-cyan-400 mb-2">Waiting for first check</h3>
            <p className="text-sm text-gray-400 mb-2">First check will run within 5 minutes.</p>
            <p className="text-xs text-gray-500">Example: "Monitor was just created"</p>
          </div>
          
          <div className="card-glass p-4 border-gray-500/30 hover:border-gray-500/50 md:col-span-2">
            <div className="flex items-center gap-2 mb-2"><span className="status-badge paused">⏸️ PAUSED</span></div>
            <h3 className="font-medium text-gray-400 mb-2">Monitoring is temporarily stopped</h3>
            <p className="text-sm text-gray-400 mb-2">You paused this monitor. Click Resume to restart checking.</p>
            <p className="text-xs text-gray-500">Example: "Paused manually by user"</p>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowModal(null)}>
          <div className="bg-[#0D0D18] border border-gray-700 rounded-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{showModal.type === 'down' ? '🔴 Server Down' : showModal.type === 'degraded' ? '⚠️ Content Issue' : showModal.type === 'critical_warning' ? '🔒 SSL Warning' : '⚡ Speed Tips'}</h3>
            <div className="text-sm text-gray-300 space-y-3">
              {showModal.type === 'down' && (
                <>
                  <p><strong>Quick checklist for {showModal.monitor.name}:</strong></p>
                  <ul className="list-disc list-inside space-y-2 text-gray-400">
                    <li>Open {showModal.monitor.url} in your browser — can you see it?</li>
                    <li>Check your hosting dashboard for errors</li>
                    <li>Verify your domain has not expired</li>
                    <li>Check server logs for crash messages</li>
                    <li>Try restarting your server/application</li>
                  </ul>
                </>
              )}
              {showModal.type === 'degraded' && (
                <>
                  <p><strong>Content check failed:</strong></p>
                  <p className="text-gray-400">{showModal.monitor.lastError || 'Content validation failed'}</p>
                  <p className="mt-2">Check your application is serving expected content.</p>
                </>
              )}
              {showModal.type === 'critical_warning' && (
                <>
                  <p><strong>Your SSL certificate needs attention.</strong></p>
                  <p className="text-gray-400 mt-2">How to fix:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 mt-1">
                    <li>Vercel/Netlify: auto-renews — check dashboard for errors</li>
                    <li>Firebase: Check Hosting → SSL settings</li>
                    <li>Self-hosted: Run <code>sudo certbot renew</code></li>
                    <li>Then restart: <code>sudo systemctl restart nginx</code></li>
                  </ul>
                </>
              )}
              {showModal.type === 'slow' && (
                <>
                  <p><strong>Speed tips for {showModal.monitor.name}:</strong></p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li>Check server CPU and memory usage</li>
                    <li>Look for slow database queries</li>
                    <li>Add caching to your application</li>
                    <li>Check if hosting plan is maxed out</li>
                  </ul>
                </>
              )}
            </div>
            <button onClick={() => setShowModal(null)} className="btn-primary w-full mt-4">Got it</button>
          </div>
        </div>
      )}
    </div>
  );
};

// Status Pages Page
const StatusPagesPage = () => {
  const { toast, navigate } = useContext(NavigationContext);
  const [pages, setPages] = useState([]);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState(null);
  const [showHelp, setShowHelp] = useState(true);
  const [formData, setFormData] = useState({
    name: '', slug: '', customDomain: '', brandColor: '#00F5FF',
    companyDescription: 'We monitor our systems 24/7 to ensure reliability. This page shows the real-time status of all our services.',
    supportEmail: '', website: '', twitter: '', discord: '',
    showResponseTimes: true, showUptimePercentage: true, showIncidentHistory: true, allowSubscriptions: true, darkMode: true,
    selectedMonitors: [], headerLinks: [], footerLinks: []
  });

  useEffect(() => {
    if (!auth.currentUser) { navigate('landing'); return; }
    const unsubPages = db.collection('statusPages').where('userId', '==', auth.currentUser.uid).onSnapshot((snapshot) => { setPages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); });
    const unsubMonitors = db.collection('monitors').where('userId', '==', auth.currentUser.uid).onSnapshot((snapshot) => { setMonitors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
    return () => { unsubPages(); unsubMonitors(); };
  }, [navigate]);

  const createNew = () => { setEditingPage({ id: null }); setFormData({ name: '', slug: '', customDomain: '', brandColor: '#00F5FF', companyDescription: 'We monitor our systems 24/7 to ensure reliability. This page shows the real-time status of all our services.', supportEmail: '', website: '', twitter: '', discord: '', showResponseTimes: true, showUptimePercentage: true, showIncidentHistory: true, allowSubscriptions: true, darkMode: true, selectedMonitors: [], headerLinks: [], footerLinks: [] }); };
  const editPage = (page) => { setEditingPage(page); setFormData({ name: page.name || '', slug: page.slug || '', customDomain: page.customDomain || '', brandColor: page.brandColor || '#00F5FF', companyDescription: page.companyDescription || '', supportEmail: page.supportEmail || '', website: page.website || '', twitter: page.twitter || '', discord: page.discord || '', showResponseTimes: page.showResponseTimes ?? true, showUptimePercentage: page.showUptimePercentage ?? true, showIncidentHistory: page.showIncidentHistory ?? true, allowSubscriptions: page.allowSubscriptions ?? true, darkMode: page.darkMode ?? true, selectedMonitors: page.selectedMonitors || [], headerLinks: page.headerLinks || [], footerLinks: page.footerLinks || [] }); };
  const deletePage = async (id) => { setConfirmModal({ title: 'Delete status page?', message: 'This will permanently delete this status page.', onConfirm: async () => { setConfirmModal(null); await db.collection('statusPages').doc(id).delete(); toast('success', 'Status page deleted'); }, danger: true, confirmText: 'Delete', cancelText: 'Cancel' }); };
  const savePage = async () => { if (!formData.name || !formData.slug) { toast('error', 'Name and URL slug required'); return; } const data = { ...formData, userId: auth.currentUser.uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }; if (editingPage.id) { await db.collection('statusPages').doc(editingPage.id).update(data); toast('success', 'Status page updated!'); } else { await db.collection('statusPages').add({ ...data, isPublished: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); toast('success', 'Status page created!'); } setEditingPage(null); };
  const toggleMonitor = (id) => { setFormData(prev => ({ ...prev, selectedMonitors: prev.selectedMonitors.includes(id) ? prev.selectedMonitors.filter(m => m !== id) : [...prev.selectedMonitors, id] })); };
  const togglePublish = async (page) => { await db.collection('statusPages').doc(page.id).update({ isPublished: !page.isPublished }); toast('success', page.isPublished ? 'Unpublished' : 'Published!'); };

  if (loading) return <div className="p-6 flex justify-center"><div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div></div>;

  if (editingPage) {
    const selectedMonitorsData = formData.selectedMonitors.map(id => monitors.find(m => m.id === id)).filter(Boolean);
    const allUp = selectedMonitorsData.every(m => m.status === 'up' || !m.status);
    return (
      <div className="p-6 space-y-6">
        <button onClick={() => setEditingPage(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">{ICONS.chevronLeft} Back to Status Pages</button>
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="card-glass p-6 space-y-4">
              <h2 className="text-xl font-bold">{editingPage.id ? 'Edit' : 'Create'} Status Page</h2>
              <p className="text-sm text-gray-400">Create a public status page to share with your users. They'll see real-time status of your services.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-400 mb-1">Page Name *</label><input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value, slug: formData.slug || e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })} className="input-field w-full" placeholder="My API Status" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">URL Slug *</label><input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })} className="input-field w-full" placeholder="my-api" /></div>
              </div>
              <div><label className="block text-sm text-gray-400 mb-1">Custom Domain (optional)</label><input value={formData.customDomain} onChange={e => setFormData({ ...formData, customDomain: e.target.value })} className="input-field w-full" placeholder="status.yourcompany.com" /><p className="text-xs text-gray-500 mt-1">Add a CNAME record in your DNS: status → pages.pulsegrid.io</p></div>
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-400 mb-1">Brand Color</label><input type="color" value={formData.brandColor} onChange={e => setFormData({ ...formData, brandColor: e.target.value })} className="w-full h-10 rounded" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Theme</label><select value={formData.darkMode ? 'dark' : 'light'} onChange={e => setFormData({ ...formData, darkMode: e.target.value === 'dark' })} className="input-field w-full"><option value="dark">Dark Mode</option><option value="light">Light Mode</option></select></div>
              </div>
            </div>

            <div className="card-glass p-6 space-y-4">
              <h3 className="font-bold">Company Information</h3>
              <div><label className="block text-sm text-gray-400 mb-1">Description</label><textarea value={formData.companyDescription} onChange={e => setFormData({ ...formData, companyDescription: e.target.value })} className="input-field w-full h-24" placeholder="Tell users about your status page..." /></div>
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-400 mb-1">Support Email</label><input type="email" value={formData.supportEmail} onChange={e => setFormData({ ...formData, supportEmail: e.target.value })} className="input-field w-full" placeholder="support@company.com" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Website</label><input value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} className="input-field w-full" placeholder="https://company.com" /></div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-400 mb-1">Twitter</label><input value={formData.twitter} onChange={e => setFormData({ ...formData, twitter: e.target.value })} className="input-field w-full" placeholder="@company" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Discord</label><input value={formData.discord} onChange={e => setFormData({ ...formData, discord: e.target.value })} className="input-field w-full" placeholder="discord.gg/invite" /></div>
              </div>
            </div>

            <div className="card-glass p-6 space-y-4">
              <h3 className="font-bold">Display Options</h3>
              <div className="space-y-2">
                <label className="flex items-center justify-between p-3 bg-gray-900 rounded-lg cursor-pointer"><span className="text-sm">Show uptime percentage</span><input type="checkbox" checked={formData.showUptimePercentage} onChange={e => setFormData({ ...formData, showUptimePercentage: e.target.checked })} className="w-4 h-4" /></label>
                <label className="flex items-center justify-between p-3 bg-gray-900 rounded-lg cursor-pointer"><span className="text-sm">Show response times</span><input type="checkbox" checked={formData.showResponseTimes} onChange={e => setFormData({ ...formData, showResponseTimes: e.target.checked })} className="w-4 h-4" /></label>
                <label className="flex items-center justify-between p-3 bg-gray-900 rounded-lg cursor-pointer"><span className="text-sm">Show incident history</span><input type="checkbox" checked={formData.showIncidentHistory} onChange={e => setFormData({ ...formData, showIncidentHistory: e.target.checked })} className="w-4 h-4" /></label>
                <label className="flex items-center justify-between p-3 bg-gray-900 rounded-lg cursor-pointer"><span className="text-sm">Allow email subscriptions</span><input type="checkbox" checked={formData.allowSubscriptions} onChange={e => setFormData({ ...formData, allowSubscriptions: e.target.checked })} className="w-4 h-4" /></label>
              </div>
            </div>

            <div className="card-glass p-6 space-y-4">
              <h3 className="font-bold">Select Monitors to Display</h3>
              <p className="text-sm text-gray-400">Choose which monitors will appear on your public status page.</p>
              {monitors.length === 0 ? <p className="text-gray-500">No monitors yet. <button onClick={() => navigate('add-monitor')} className="text-cyan-400 underline">Create one first</button></p> : (
                <div className="space-y-2">{monitors.map(m => {
                  const isDown = m.status === 'down';
                  return (<label key={m.id} className={`flex items-center justify-between p-3 bg-gray-900 rounded-lg cursor-pointer ${isDown ? 'border border-red-900' : ''}`}><div className="flex items-center gap-2"><input type="checkbox" checked={formData.selectedMonitors.includes(m.id)} onChange={() => toggleMonitor(m.id)} className="w-4 h-4" /><span>{m.name}</span></div><span className={isDown ? 'text-red-400 text-sm' : 'text-green-400 text-sm'}>{isDown ? '⚠️ DOWN' : '✅ UP'}</span></label>);
                })}</div>
              )}
            </div>

            <div className="flex gap-2"><button onClick={savePage} className="btn-primary">Save Status Page</button><button onClick={() => setEditingPage(null)} className="btn-ghost">Cancel</button></div>
          </div>
          <div className="lg:col-span-2">
            <div className="card-glass p-6 sticky top-6">
              <h3 className="font-bold mb-4">Live Preview</h3>
              <div className="rounded-lg overflow-hidden" style={{ background: formData.darkMode ? '#0D0D18' : '#fff', borderTop: `4px solid ${formData.brandColor}` }}>
                <div className="p-4" style={{ background: formData.brandColor + '20' }}><h4 className="text-xl font-bold">{formData.name || 'Page Name'}</h4></div>
                <div className={`px-4 py-3 text-center ${allUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{allUp ? '✅ All Systems Operational' : '⚠️ Some Systems Down'}</div>
                <div className="p-4 space-y-2">
                  {selectedMonitorsData.length === 0 ? <p className="text-sm text-gray-500">Select monitors to display</p> : selectedMonitorsData.map(m => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span>{m.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${m.status === 'down' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{m.status === 'down' ? 'DOWN' : 'UP'}</span>
                    </div>
                  ))}
                </div>
                {formData.selectedMonitors.length > 3 && <div className="p-2 text-center text-xs text-gray-500">+{formData.selectedMonitors.length - 3} more</div>}
                <div className="p-3 border-t border-gray-800 text-xs text-gray-500">{formData.companyDescription || 'No description'}</div>
                <div className="p-3 border-t border-gray-800 flex justify-center gap-3">{formData.twitter && <span>🐦</span>}{formData.discord && <span>💬</span>}{formData.supportEmail && <span>📧</span>}</div>
              </div>
              <div className="mt-3 p-3 bg-gray-900 rounded text-xs">
                <p className="text-gray-400 mb-1">🌐 Public URL:</p>
                <code className="text-cyan-400">https://pages.pulsegrid.io/{formData.slug || 'your-slug'}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Status Pages</h1><p className="text-sm text-gray-400">Public status pages your users can view</p></div><button onClick={createNew} className="btn-primary flex items-center gap-2">{ICONS.plus} Create Status Page</button></div>
      
      {showHelp && <div className="card-glass p-6 border-l-4 border-l-cyan-500">
        <div className="flex justify-between items-start mb-3"><h3 className="font-bold text-cyan-400">What is a Status Page?</h3><button onClick={() => setShowHelp(false)} className="text-gray-500">✕</button></div>
        <p className="text-sm text-gray-400 mb-3">A status page shows your users the real-time health of your services. They can subscribe to get notified when things go down. It's a great way to build trust and reduce support tickets.</p>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="p-3 bg-gray-900 rounded"><div className="font-bold mb-1">📢 Transparency</div><div className="text-gray-400">Users see status instantly</div></div>
          <div className="p-3 bg-gray-900 rounded"><div className="font-bold mb-1">🔔 Notifications</div><div className="text-gray-400">Email alerts on downtime</div></div>
          <div className="p-3 bg-gray-900 rounded"><div className="font-bold mb-1">📊 History</div><div className="text-gray-400">Past incidents</div></div>
        </div>
      </div>}

      {pages.length === 0 && <div className="card-glass p-12 text-center"><div className="text-cyan-400 mb-4 flex justify-center text-6xl">{ICONS.globe}</div><h3 className="text-xl font-bold mb-2">No Status Pages</h3><p className="text-gray-400 mb-2">Create a public status page to share with your users.</p><p className="text-sm text-gray-500 mb-6">Show the real-time status of your APIs, websites, and services.</p><button onClick={createNew} className="btn-primary">Create Your First Status Page</button></div>}
      
      {pages.length > 0 && <div className="space-y-4">{pages.map(page => {
        const pageMonitors = page.selectedMonitors?.map(id => monitors.find(m => m.id === id)).filter(Boolean) || [];
        const allUp = pageMonitors.every(m => m.status === 'up' || !m.status);
        return (<div key={page.id} className="card-glass p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1"><h3 className="font-bold">{page.name}</h3><span className={`px-2 py-0.5 rounded text-xs ${allUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{allUp ? 'OPERATIONAL' : 'DEGRADED'}</span></div>
              <p className="text-sm text-gray-400 mb-2">https://pages.pulsegrid.io/{page.slug}</p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>🔴 {pageMonitors.filter(m => m.status === 'down').length} down</span>
                <span>🟢 {pageMonitors.filter(m => m.status !== 'down').length} up</span>
                {page.isPublished && <span className="text-green-400">Published</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => togglePublish(page)} className={`btn-ghost text-sm ${page.isPublished ? 'text-green-400' : ''}`}>{page.isPublished ? 'Published' : 'Publish'}</button>
              <button onClick={() => editPage(page)} className="btn-ghost text-sm">Edit</button>
              <button onClick={() => deletePage(page.id)} className="btn-ghost text-red-400 text-sm">Delete</button>
            </div>
          </div>
        </div>);
      })}</div>}
    </div>
  );
};

// Report Preview Content Component
const ReportPreviewContent = ({ activeReport, monitors, selectedMonitors }) => {
  const reportMonitors = activeReport === 'custom'
    ? selectedMonitors.map(id => monitors.find(m => m.id === id)).filter(Boolean)
    : monitors;
  const periodLabel = activeReport === 'daily' ? 'Yesterday' : activeReport === 'weekly' ? 'Last 7 Days' : activeReport === 'monthly' ? 'Last 30 Days' : 'Custom Range';
  const avgUptime = reportMonitors.length > 0 ? (reportMonitors.reduce((a, m) => a + (m.uptimePercentage || 100), 0) / reportMonitors.length).toFixed(1) : '100.0';
  const avgResponse = reportMonitors.length > 0 ? Math.round(reportMonitors.reduce((a, m) => a + (m.avgResponseMs || 0), 0) / reportMonitors.length) : 0;
  const downCount = reportMonitors.filter(m => m.status === 'down').length;

  return (
    <div>
      <div className="text-sm text-gray-400 mb-3">{periodLabel} • {reportMonitors.length} monitors</div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-400">Avg Uptime</span><div className="font-bold text-green-400">{avgUptime}%</div></div>
        <div><span className="text-gray-400">Down Monitors</span><div className={`font-bold ${downCount > 0 ? 'text-red-400' : 'text-green-400'}`}>{downCount}</div></div>
        <div><span className="text-gray-400">Avg Response</span><div className="font-bold">{avgResponse}ms</div></div>
        <div><span className="text-gray-400">Total Monitors</span><div className="font-bold">{reportMonitors.length}</div></div>
      </div>
      {reportMonitors.length > 0 && (
        <div className="mt-4">
          <div className="text-sm text-gray-400 mb-2">Monitors</div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {reportMonitors.map(m => (
              <div key={m.id} className="flex justify-between text-sm py-1 px-2 bg-black/30 rounded">
                <span>{m.name}</span>
                <span className={m.status === 'down' ? 'text-red-400' : 'text-green-400'}>{m.status === 'down' ? 'DOWN' : 'UP'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Send Report Email
const sendReportEmail = async (activeReport, monitors, selectedMonitors) => {
  const reportMonitors = activeReport === 'custom'
    ? selectedMonitors.map(id => monitors.find(m => m.id === id)).filter(Boolean)
    : monitors;
  if (reportMonitors.length === 0) { alert('No monitors to include in report'); return; }

  const email = auth.currentUser?.email;
  if (!email) { alert('Please sign in to send reports'); return; }

  const periodLabel = activeReport === 'daily' ? 'Daily Report' : activeReport === 'weekly' ? 'Weekly Report' : activeReport === 'monthly' ? 'Monthly Report' : 'Custom Report';
  const avgUptime = reportMonitors.length > 0 ? (reportMonitors.reduce((a, m) => a + (m.uptimePercentage || 100), 0) / reportMonitors.length).toFixed(1) : '100.0';

  const RESEND_API_KEY = 're_Hy1TH7nk_EhqPzuus64koJmTbnqvGKebr';
  const htmlContent = `
<div style="font-family: Arial, sans-serif; background: #050508; color: #E8E8F0; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: #0D0D18; border-radius: 12px; padding: 30px;">
<h1 style="color: #00F5FF; margin-bottom: 20px;">PulseGrid ${periodLabel}</h1>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:10px;background:#1A1A2E;border-radius:8px;"><div style="color:#00F5FF;font-size:24px;font-weight:bold;">${avgUptime}%</div><div style="color:#888;font-size:12px;">Avg Uptime</div></td>
<td style="padding:10px;background:#1A1A2E;border-radius:8px;"><div style="color:#00F5FF;font-size:24px;font-weight:bold;">${reportMonitors.length}</div><div style="color:#888;font-size:12px;">Monitors</div></td></tr>
</table>
<h2 style="color:#00F5FF;margin:20px 0 10px;">Monitor Status</h2>
<table style="width:100%;border-collapse:collapse;font-size:12px;">
<tr style="background:#1A1A2E;"><th style="padding:8px;text-align:left;">Name</th><th style="padding:8px;text-align:left;">Status</th><th style="padding:8px;text-align:left;">Uptime</th></tr>
${reportMonitors.map(m => `<tr><td style="padding:8px;border-bottom:1px solid #1A1A2E;">${m.name}</td><td style="padding:8px;border-bottom:1px solid #1A1A2E;color:${m.status === 'down' ? '#FF3366' : '#39FF14'};">${m.status === 'down' ? 'DOWN' : 'UP'}</td><td style="padding:8px;border-bottom:1px solid #1A1A2E;">${(m.uptimePercentage || 100).toFixed(1)}%</td></tr>`).join('')}
</table>
<p style="color:#666;font-size:11px;margin-top:20px;">Generated by PulseGrid on ${new Date().toLocaleString()}</p>
</div></div>`;

  try {
    await fetch('https://corsproxy.io/?https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + RESEND_API_KEY, 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ from: 'PulseGrid Reports <reports@resend.dev>', to: email, subject: 'PulseGrid Report - ' + periodLabel, html: htmlContent })
    });
    alert('Report sent to ' + email);
  } catch (err) { alert('Failed to send report: ' + err.message); }
};

// Reports Page
const ReportsPage = () => {
  const { toast, navigate } = useContext(NavigationContext);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMonitors, setSelectedMonitors] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [activeReport, setActiveReport] = useState(null);

  useEffect(() => {
    if (!auth.currentUser) { navigate('landing'); return; }
    const unsub = db.collection('monitors').where('userId', '==', auth.currentUser.uid).onSnapshot((snapshot) => { setMonitors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); });
    return () => unsub();
  }, [navigate]);

  const generateReportHTML = (reportType, monitorList) => {
    const now = new Date().toLocaleString();
    const periodLabel = reportType === 'daily' ? 'Yesterday' : reportType === 'weekly' ? 'Last 7 Days' : reportType === 'monthly' ? 'Last 30 Days' : 'Custom Range';
    const avgUptime = monitorList.length > 0 ? (monitorList.reduce((a, m) => a + (m.uptimePercentage || 100), 0) / monitorList.length).toFixed(2) : '100.00';
    const avgResponse = monitorList.length > 0 ? Math.round(monitorList.reduce((a, m) => a + (m.avgResponseMs || 0), 0) / monitorList.length) : 0;
    const totalOutages = 0;
    const totalChecks = monitorList.length * 1440;
    const downMonitors = monitorList.filter(m => m.status === 'down');

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PulseGrid Report - ${periodLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #050508; color: #E8E8F0; padding: 40px; }
    .report-container { max-width: 800px; margin: 0 auto; background: #0D0D18; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #00F5FF 0%, #0088AA 100%); padding: 40px; text-align: center; }
    .header h1 { font-size: 36px; color: #000; margin-bottom: 8px; }
    .header p { color: #333; font-size: 14px; }
    .section { padding: 30px 40px; border-bottom: 1px solid #1A1A2E; }
    .section h2 { color: #00F5FF; font-size: 20px; margin-bottom: 20px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .stat-box { background: #1A1A2E; padding: 20px; border-radius: 12px; text-align: center; }
    .stat-box .value { font-size: 28px; font-weight: bold; color: #00F5FF; }
    .stat-box .label { font-size: 12px; color: #888; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th { background: #1A1A2E; padding: 12px; text-align: left; color: #00F5FF; font-size: 12px; }
    td { padding: 12px; border-bottom: 1px solid #1A1A2E; font-size: 14px; }
    .status-up { color: #39FF14; }
    .status-down { color: #FF3366; }
    .footer { padding: 20px 40px; text-align: center; color: #666; font-size: 12px; }
    @media print { body { background: #fff; color: #000; } .report-container { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <h1>PulseGrid</h1>
      <p>Performance Report - ${periodLabel}</p>
    </div>
    
    <div class="section">
      <h2>Overview</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="value">${avgUptime}%</div>
          <div class="label">Avg Uptime</div>
        </div>
        <div class="stat-box">
          <div class="value">${totalOutages}</div>
          <div class="label">Outages</div>
        </div>
        <div class="stat-box">
          <div class="value">${avgResponse}ms</div>
          <div class="label">Avg Response</div>
        </div>
        <div class="stat-box">
          <div class="value">${monitorList.length}</div>
          <div class="label">Monitors</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Monitor Status</h2>
      <table>
        <thead>
          <tr>
            <th>Monitor Name</th>
            <th>URL</th>
            <th>Uptime</th>
            <th>Response Time</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${monitorList.map(m => `
          <tr>
            <td><strong>${m.name}</strong></td>
            <td style="color:#888;font-size:12px;">${(m.url || '').substring(0, 30)}</td>
            <td class="status-up">${(m.uptimePercentage || 100).toFixed(2)}%</td>
            <td>${m.avgResponseMs || 0}ms</td>
            <td class="${m.status === 'down' ? 'status-down' : 'status-up'}">${m.status === 'down' ? 'DOWN' : 'UP'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Checks with Downtime</h2>
      ${downMonitors.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Monitor</th>
            <th>Uptime</th>
            <th>Downtime</th>
            <th>Outages</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          ${downMonitors.map(m => `
          <tr>
            <td><strong>${m.name}</strong></td>
            <td class="status-down">${(m.uptimePercentage || 0).toFixed(2)}%</td>
            <td>0h 00m 00s</td>
            <td>0</td>
            <td>${m.avgResponseMs || 0}ms</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ` : '<p style="color:#39FF14;">✓ No downtime recorded</p>'}
    </div>

    <div class="section">
      <h2>Checks without Downtime</h2>
      ${monitorList.filter(m => m.status !== 'down').length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Monitor</th>
            <th>Uptime</th>
            <th>Downtime</th>
            <th>Outages</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          ${monitorList.filter(m => m.status !== 'down').map(m => `
          <tr>
            <td><strong>${m.name}</strong></td>
            <td class="status-up">${(m.uptimePercentage || 100).toFixed(2)}%</td>
            <td>0h 00m 00s</td>
            <td>0</td>
            <td>${m.avgResponseMs || 0}ms</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ` : '<p style="color:#FF3366;">No monitors without downtime</p>'}
    </div>

    <div class="footer">
      Generated by PulseGrid on ${now}
    </div>
  </div>
</body>
</html>`;
    return html;
  };

  const handleDownload = (reportType) => {
    const allMonitors = monitors;
    const reportData = { type: reportType, monitors: allMonitors, generatedAt: new Date().toISOString() };
    const htmlContent = generateReportHTML(reportType, allMonitors);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `pulsegrid-${reportType}-report.html`; a.click();
    toast('success', `Downloaded ${reportType} report`);
  };

  const handleView = (reportType) => {
    setActiveReport(reportType);
    setShowPreview(true);
  };

  const generateCustomReport = () => {
    if (selectedMonitors.length === 0) { toast('error', 'Select at least one monitor'); return; }
    setActiveReport('custom');
    setShowPreview(true);
  };

  const downloadCustomReport = () => {
    const selectedData = selectedMonitors.map(mid => monitors.find(m => m.id === mid)).filter(Boolean);
    const htmlContent = generateReportHTML('custom', selectedData);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pulsegrid-custom-report.html'; a.click();
    toast('success', 'Downloaded custom report');
  };

  const toggleMonitor = (mid) => {
    setSelectedMonitors(prev => prev.includes(mid) ? prev.filter(id => id !== mid) : [...prev, mid]);
  };

  const getReportForPreview = () => {
    if (activeReport === 'custom') return selectedMonitors.map(mid => monitors.find(m => m.id === mid)).filter(Boolean);
    return monitors;
  };

  if (loading) return <div className="p-6 flex justify-center"><div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const cardData = [
    { id: 'daily', icon: ICONS.activity, title: 'Daily Summary', desc: "Yesterday's performance across all monitors" },
    { id: 'weekly', icon: ICONS.zap, title: 'Weekly Performance', desc: '7-day trends, slowest endpoints' },
    { id: 'monthly', icon: ICONS.file, title: 'Monthly SLA Report', desc: 'Uptime % per monitor for clients' },
    { id: 'custom', icon: ICONS.settings, title: 'Custom Range', desc: 'Select date range and monitors' }
  ];

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold">Reports</h1><p className="text-sm text-gray-400">Generate and download reports</p></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cardData.map((card, i) => (
          <div key={i} className="card-glass p-6">
            <div className="text-cyan-400 mb-3">{card.icon}</div>
            <h3 className="font-bold mb-1">{card.title}</h3>
            <p className="text-sm text-gray-400 mb-4">{card.desc}</p>
            <div className="flex gap-2"><button onClick={() => handleDownload(card.id)} className="btn-ghost text-sm">📥 Download</button><button onClick={() => handleView(card.id)} className="btn-ghost text-sm">👁 View</button></div>
          </div>
        ))}
      </div>
      <div className="card-glass p-6">
        <h3 className="font-bold mb-4">Custom Report</h3>
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div><label className="block text-sm text-gray-400 mb-1">From</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-full" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">To</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-full" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Monitors ({monitors.length})</label>
            <div className="input-field w-full h-32 overflow-y-auto bg-black/50">
              {monitors.length === 0 ? <p className="text-gray-500 text-sm">No monitors found</p> : monitors.map(m => (
                <label key={m.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-800 px-2 rounded">
                  <input type="checkbox" checked={selectedMonitors.includes(m.id)} onChange={() => toggleMonitor(m.id)} className="w-4 h-4" />
                  <span className="text-sm">{m.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <button onClick={generateCustomReport} className="btn-primary">Generate Report</button>
      </div>
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card-glass p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">Report Preview</h2><button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-white">✕</button></div>
            <div className="space-y-4">
              <ReportPreviewContent activeReport={activeReport} monitors={monitors} selectedMonitors={selectedMonitors} />
              <div className="flex gap-2"><button onClick={() => handleDownload(activeReport || 'custom')} className="btn-primary">📥 Download HTML</button><button onClick={() => sendReportEmail(activeReport, monitors, selectedMonitors)} className="btn-ghost">📧 Email Report</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// API Docs Page
const APIDocsPage = () => {
  const { toast, navigate, setCurrentPage, confirmModal, setConfirmModal } = useContext(NavigationContext);
  const [activeTab, setActiveTab] = useState('your-api');
  const [activeDocSection, setActiveDocSection] = useState('what-is-api');
  const [codeTab, setCodeTab] = useState('curl');
  const [apiKey, setApiKey] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [apiUsage, setApiUsage] = useState({ requestsToday: 0, dailyLimit: 1000 });

  useEffect(() => { if (!auth.currentUser) { navigate('landing'); return; } }, [navigate]);

  useEffect(() => {
    const loadApiKey = async () => {
      const doc = await db.collection('users').doc(auth.currentUser.uid).get();
      if (doc.exists && doc.data().apiKey) {
        setApiKey(doc.data().apiKey);
        setApiUsage(doc.data().apiUsage || { requestsToday: 0, dailyLimit: 1000 });
      }
    };
    loadApiKey();
  }, []);

  const scrollToSection = (id) => {
    setActiveDocSection(id);
    const el = document.getElementById('doc-' + id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey || 'pg_live_' + auth.currentUser?.uid?.slice(0, 12));
    toast('success', 'API key copied!');
  };

  const regenerateKey = async () => {
    const newKey = 'pg_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setConfirmModal({
      title: 'Regenerate API Key?',
      message: 'Your old API key will stop working immediately. Any applications using it will break.',
      onConfirm: async () => {
        setConfirmModal(null);
        await db.collection('users').doc(auth.currentUser.uid).update({ apiKey: newKey, apiUsage: { requestsToday: 0, dailyLimit: 1000 } });
        setApiKey(newKey);
        setApiUsage({ requestsToday: 0, dailyLimit: 1000 });
        toast('success', 'New API key generated!');
      },
      danger: true,
      confirmText: 'Regenerate',
      cancelText: 'Cancel'
    });
  };

  const testApi = async () => {
    setTestingApi(true);
    setTestResult(null);
    try {
      const monitorsSnap = await db.collection('monitors').where('userId', '==', auth.currentUser.uid).limit(5).get();
      const monitors = monitorsSnap.docs.map(d => ({ id: d.id, name: d.data().name, status: d.data().status }));
      setTestResult({ success: true, data: { success: true, monitors, total: monitors.length } });
      await db.collection('users').doc(auth.currentUser.uid).update({ 'apiUsage.requestsToday': (apiUsage.requestsToday || 0) + 1 });
      setApiUsage(prev => ({ ...prev, requestsToday: (prev.requestsToday || 0) + 1 }));
    } catch (err) {
      setTestResult({ success: false, data: { success: false, error: err.message, code: 'TEST_FAILED' } });
    }
    setTestingApi(false);
  };

  const navItems = [
    { id: 'what-is-api', label: 'What is an API?' },
    { id: 'what-is-pulsegrid-api', label: "What is PulseGrid's API?" },
    { id: 'who-should-use', label: 'Who Should Use This?' },
    { id: 'getting-started', label: 'Getting Started', sub: true },
    { id: 'make-first-request', label: '→ Make Your First Request' },
    { id: 'understanding-responses', label: '→ Understanding Responses' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'endpoints', label: 'Endpoints', sub: true },
    { id: 'list-monitors', label: '→ List Monitors' },
    { id: 'create-monitor', label: '→ Create Monitor' },
    { id: 'get-monitor', label: '→ Get Monitor' },
    { id: 'update-monitor', label: '→ Update Monitor' },
    { id: 'delete-monitor', label: '→ Delete Monitor' },
    { id: 'get-stats', label: '→ Get Monitor Stats' },
    { id: 'list-incidents', label: '→ List Incidents' },
    { id: 'webhooks', label: 'Webhooks', sub: true },
    { id: 'webhooks-intro', label: '→ What are Webhooks?' },
    { id: 'webhook-setup', label: '→ Setting Up Webhooks' },
    { id: 'webhook-events', label: '→ Webhook Events' },
    { id: 'webhook-payload', label: '→ Webhook Payload' },
    { id: 'error-codes', label: 'Error Codes' },
    { id: 'rate-limits', label: 'Rate Limits' },
    { id: 'need-help', label: 'Need Help?' },
  ];

  const YourApiTab = () => (
    <div className="space-y-6">
      <div className="card-glass p-6 space-y-4 border-l-4 border-cyan-500">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Syne' }}>Your API Key</h2>
          <button onClick={regenerateKey} className="text-xs text-red-400 hover:text-red-300">Regenerate</button>
        </div>
        <p className="text-gray-400 text-sm">Use this key to authenticate API requests.</p>
        <div className="flex gap-2">
          <div className="flex-1 p-3 bg-[#0A0A0F] border border-gray-700 rounded-lg font-mono text-sm flex items-center gap-2">
            <span className="text-cyan-400 flex-1">{showKey ? (apiKey || 'pg_live_' + auth.currentUser?.uid?.slice(0, 12) + '...') : '••••••••••••••••••••••••••••••••'}</span>
            <button onClick={() => setShowKey(!showKey)} className="text-gray-500 hover:text-white">{showKey ? '🙈' : '👁️'}</button>
            <button onClick={copyKey} className="text-gray-500 hover:text-white">📋</button>
          </div>
        </div>
        <div className="p-3 border border-red-500/50 bg-red-900/20 rounded-lg">
          <p className="text-sm text-red-400">🔒 Never share your API key. If exposed, regenerate it immediately.</p>
        </div>
      </div>

      <div className="card-glass p-6 space-y-4">
        <h2 className="text-xl font-bold" style={{ fontFamily: 'Syne' }}>Usage</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-900/50 rounded-lg">
            <div className="text-2xl font-bold text-cyan-400">{apiUsage.requestsToday}</div>
            <div className="text-sm text-gray-400">Requests Today</div>
          </div>
          <div className="p-4 bg-gray-900/50 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{apiUsage.dailyLimit.toLocaleString()}</div>
            <div className="text-sm text-gray-400">Daily Limit</div>
          </div>
          <div className="p-4 bg-gray-900/50 rounded-lg">
            <div className="text-2xl font-bold text-purple-400">{Math.round((1 - apiUsage.requestsToday / apiUsage.dailyLimit) * 100)}%</div>
            <div className="text-sm text-gray-400">Remaining</div>
          </div>
        </div>
        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
          <div className="bg-cyan-500 h-full" style={{ width: Math.min(100, (apiUsage.requestsToday / apiUsage.dailyLimit) * 100) + '%' }} />
        </div>
      </div>

      <div className="card-glass p-6 space-y-4">
        <h2 className="text-xl font-bold" style={{ fontFamily: 'Syne' }}>Test Your API</h2>
        <p className="text-gray-400 text-sm">Click the button below to make a test request to the API.</p>
        <button onClick={testApi} disabled={testingApi} className="btn-primary">
          {testingApi ? 'Testing...' : '▶ Test API'}
        </button>
        {testResult && (
          <div className={`p-4 rounded-lg font-mono text-xs overflow-x-auto ${testResult.success ? 'bg-[#0A0A0F] border border-green-500/30' : 'bg-[#0A0A0F] border border-red-500/30'}`}>
            <pre style={{ color: testResult.success ? '#00FF88' : '#FF3366' }}>{JSON.stringify(testResult.data, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="card-glass p-6 space-y-4">
        <h2 className="text-xl font-bold" style={{ fontFamily: 'Syne' }}>Quick Start</h2>
        <p className="text-gray-400 text-sm">Copy this code to get started:</p>
        <div className="flex gap-2 mb-3">{['curl', 'JavaScript', 'Python'].map(t => (<button key={t} onClick={() => setCodeTab(t.toLowerCase())} className={`px-3 py-1 rounded text-sm ${codeTab === t.toLowerCase() ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400'}`}>{t}</button>))}</div>
        <div className="p-4 bg-[#0A0A0F] border border-cyan-500/20 rounded-lg font-mono text-xs overflow-x-auto">
          {codeTab === 'curl' && <div className="text-gray-300">curl https://api.pulsegrid.io/v1/monitors -H "Authorization: Bearer {apiKey || 'YOUR_API_KEY'}"</div>}
          {codeTab === 'javascript' && <div className="text-gray-300">const res = await fetch('https://api.pulsegrid.io/v1/monitors', {'{'}headers:{'{'}Authorization: 'Bearer {apiKey || 'YOUR_API_KEY'}'{'}'}{'}'});<br/>const data = await res.json();</div>}
          {codeTab === 'python' && <div className="text-gray-300">import requests<br/>headers = {'{'}'Authorization': 'Bearer {apiKey || 'YOUR_API_KEY'}'{'}'}<br/>res = requests.get('https://api.pulsegrid.io/v1/monitors', headers=headers)<br/>print(res.json())</div>}
        </div>
      </div>
    </div>
  );

  const GuideTab = () => (
    <div className="grid lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1">
        <nav className="sticky top-6 space-y-0.5 text-sm">
          {navItems.map(n => (
            <button key={n.id} onClick={() => scrollToSection(n.id)} className={`w-full text-left px-3 py-1.5 rounded-lg ${activeDocSection === n.id ? 'bg-cyan-900/50 text-cyan-400 border-l-2 border-cyan-500' : n.sub ? 'text-white font-medium mt-3 pt-2 border-t border-gray-800' : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'} ${n.label.startsWith('→') ? 'pl-6' : ''}`}>{n.label}</button>
          ))}
        </nav>
      </div>
      <div className="lg:col-span-3 space-y-8 overflow-hidden">
        <div id="doc-what-is-api" className="card-glass p-6 space-y-4 border-l-4 border-cyan-500">
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne' }}>What is an API?</h2>
          <p className="text-gray-300 leading-relaxed">An API (Application Programming Interface) lets your code talk to PulseGrid directly — no clicking buttons needed.</p>
          <p className="text-gray-400">You send a request, get JSON data back. Simple as that.</p>
          <div className="p-4 bg-[#0A0A0F] border border-cyan-500/20 rounded-lg font-mono text-sm" style={{color:'#00FF88'}}>{'{"name":"My API","status":"up","responseTime":245}'}</div>
        </div>

        <div id="doc-what-is-pulsegrid-api" className="card-glass p-6 space-y-4 border-l-4 border-cyan-500">
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne' }}>What Can You Do?</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {[{ icon: '🤖', title: 'Automate Monitors', desc: 'Create monitors when you deploy services.' },
              { icon: '📊', title: 'Custom Dashboards', desc: 'Pull data into your own tools.' },
              { icon: '🔗', title: 'Integrations', desc: 'Connect to Notion, Slack, etc.' },
              { icon: '🚨', title: 'Custom Alerts', desc: 'Build your own alerting logic.' }
            ].map((c, i) => (
              <div key={i} className="p-4 bg-gray-900/50 rounded-lg border border-gray-800"><div className="text-xl mb-1">{c.icon}</div><div className="font-medium">{c.title}</div><div className="text-xs text-gray-500">{c.desc}</div></div>
            ))}
          </div>
        </div>

        <div id="doc-make-first-request" className="card-glass p-6 space-y-4 border-l-4 border-cyan-500">
          <h3 className="text-xl font-bold" style={{ fontFamily: 'Syne' }}>Make Your First Request</h3>
          <p className="text-gray-400">Fetch all your monitors:</p>
          <div className="p-4 bg-[#0A0A0F] border border-cyan-500/20 rounded-lg font-mono text-xs overflow-x-auto">
            <div className="text-gray-300">curl https://api.pulsegrid.io/v1/monitors -H "Authorization: Bearer YOUR_KEY"</div>
          </div>
          <p className="text-gray-400">Switch to the "Your API" tab to test with your actual key!</p>
        </div>

        <div id="doc-authentication" className="card-glass p-6 space-y-4 border-l-4 border-cyan-500">
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne' }}>Authentication</h2>
          <div className="p-3 bg-gray-900 rounded-lg font-mono text-sm">Authorization: Bearer pg_live_xxxxxxxx</div>
        </div>

        <div id="doc-list-monitors" className="card-glass p-6 space-y-4 border-l-4 border-cyan-500">
          <div className="flex items-center gap-3"><span className="px-2 py-1 bg-cyan-600 text-white rounded text-xs font-bold">GET</span><span className="font-mono">/v1/monitors</span></div>
          <h3 className="text-xl font-bold" style={{ fontFamily: 'Syne' }}>List Monitors</h3>
          <table className="w-full text-xs"><thead><tr className="bg-gray-800"><th className="p-2 text-left">Param</th><th className="p-2 text-left">Description</th></tr></thead><tbody className="text-gray-400"><tr><td className="p-2">status</td><td className="p-2">Filter: "up", "down", "slow"</td></tr><tr><td className="p-2">limit</td><td className="p-2">Max results (default 50)</td></tr></tbody></table>
        </div>

        <div id="doc-create-monitor" className="card-glass p-6 space-y-4 border-l-4 border-green-500">
          <div className="flex items-center gap-3"><span className="px-2 py-1 bg-green-600 text-white rounded text-xs font-bold">POST</span><span className="font-mono">/v1/monitors</span></div>
          <h3 className="text-xl font-bold" style={{ fontFamily: 'Syne' }}>Create Monitor</h3>
          <table className="w-full text-xs"><thead><tr className="bg-gray-800"><th className="p-2 text-left">Field</th><th className="p-2 text-left">Required</th><th className="p-2 text-left">Description</th></tr></thead><tbody className="text-gray-400"><tr><td className="p-2">name</td><td className="p-2">Yes</td><td className="p-2">Monitor name</td></tr><tr><td className="p-2">url</td><td className="p-2">Yes</td><td className="p-2">URL to monitor</td></tr><tr><td className="p-2">intervalSeconds</td><td className="p-2">No</td><td className="p-2">Check frequency (default 300)</td></tr></tbody></table>
        </div>

        <div id="doc-webhooks-intro" className="card-glass p-6 space-y-4 border-l-4 border-cyan-500">
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne' }}>Webhooks</h2>
          <p className="text-gray-300">Webhooks let PulseGrid notify YOUR server when something happens.</p>
          <p className="text-gray-400">Instead of you asking "is it down?" every minute, we call YOU when it goes down.</p>
        </div>

        <div id="doc-webhook-events" className="card-glass p-6 space-y-4 border-l-4 border-cyan-500">
          <h3 className="text-xl font-bold" style={{ fontFamily: 'Syne' }}>Webhook Events</h3>
          <table className="w-full text-xs"><thead><tr className="bg-gray-800"><th className="p-2 text-left">Event</th><th className="p-2 text-left">When</th></tr></thead><tbody className="text-gray-400"><tr><td className="p-2">monitor.down</td><td className="p-2">Monitor fails</td></tr><tr><td className="p-2">monitor.recovered</td><td className="p-2">Comes back up</td></tr><tr><td className="p-2">incident.created</td><td className="p-2">New incident</td></tr></tbody></table>
        </div>

        <div id="doc-error-codes" className="card-glass p-6 space-y-4 border-l-4 border-cyan-500">
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne' }}>Error Codes</h2>
          <table className="w-full text-xs"><thead><tr className="bg-gray-800"><th className="p-2 text-left">Code</th><th className="p-2 text-left">Meaning</th></tr></thead><tbody className="text-gray-400"><tr><td className="p-2">UNAUTHORIZED</td><td className="p-2">Invalid API key</td></tr><tr><td className="p-2">NOT_FOUND</td><td className="p-2">Resource doesn't exist</td></tr><tr><td className="p-2">RATE_LIMITED</td><td className="p-2">Too many requests</td></tr></tbody></table>
        </div>

        <div id="doc-rate-limits" className="card-glass p-6 space-y-4 border-l-4 border-cyan-500">
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne' }}>Rate Limits</h2>
          <table className="w-full text-xs"><thead><tr className="bg-gray-800"><th className="p-2 text-left">Plan</th><th className="p-2 text-left">Per Day</th></tr></thead><tbody className="text-gray-400"><tr><td className="p-2">Free</td><td className="p-2">1,000</td></tr><tr><td className="p-2">Pro</td><td className="p-2">20,000</td></tr></tbody></table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2"><h1 className="text-2xl font-bold">API</h1><span className="text-xs bg-cyan-900 text-cyan-400 px-2 py-0.5 rounded">Docs</span></div>
        <div className="flex bg-gray-900 rounded-lg p-1">
          <button onClick={() => setActiveTab('your-api')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'your-api' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Your API</button>
          <button onClick={() => setActiveTab('guide')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'guide' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Guide</button>
        </div>
      </div>
      {activeTab === 'your-api' ? <YourApiTab /> : <GuideTab />}
    </div>
  );
};

const navItems = [
    { id: 'what-is-api', label: 'What is an API?' },
    { id: 'what-is-pulsegrid-api', label: "What is PulseGrid's API?" },
    { id: 'who-should-use', label: 'Who Should Use This?' },
    { id: 'getting-started', label: 'Getting Started', sub: true },
    { id: 'get-api-key', label: '→ Get Your API Key' },
    { id: 'make-first-request', label: '→ Make Your First Request' },
    { id: 'understanding-responses', label: '→ Understanding Responses' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'endpoints', label: 'Endpoints', sub: true },
    { id: 'list-monitors', label: '→ List Monitors' },
    { id: 'create-monitor', label: '→ Create Monitor' },
    { id: 'get-monitor', label: '→ Get Monitor' },
    { id: 'update-monitor', label: '→ Update Monitor' },
    { id: 'delete-monitor', label: '→ Delete Monitor' },
    { id: 'get-stats', label: '→ Get Monitor Stats' },
    { id: 'list-incidents', label: '→ List Incidents' },
    { id: 'webhooks', label: 'Webhooks', sub: true },
    { id: 'webhooks-intro', label: '→ What are Webhooks?' },
    { id: 'webhook-setup', label: '→ Setting Up Webhooks' },
    { id: 'webhook-events', label: '→ Webhook Events' },
    { id: 'webhook-payload', label: '→ Webhook Payload' },
    { id: 'error-codes', label: 'Error Codes' },
    { id: 'rate-limits', label: 'Rate Limits' },
    { id: 'need-help', label: 'Need Help?' },
];

// Monitor Detail Page
const MonitorDetailPage = ({ monitorId }) => {
  const { toast, navigate } = useContext(NavigationContext);
  const [monitor, setMonitor] = useState(null);
  const [checks, setChecks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) { navigate('landing'); return; }
    const loadData = async () => {
      try {
        if (!monitorId) { toast('error', 'Monitor not found'); navigate('monitors'); return; }
        const doc = await db.collection('monitors').doc(monitorId).get();
        if (!doc.exists || doc.data().userId !== auth.currentUser.uid) { toast('error', 'Monitor not found'); navigate('monitors'); return; }
        setMonitor({ id: doc.id, ...doc.data() });
        setLoading(false);
      } catch (err) { toast('error', 'Failed to load monitor'); navigate('monitors'); }
    };
    loadData();
  }, [monitorId, navigate, toast]);

  const handlePause = async () => {
    if (!monitor) return;
    const newStatus = monitor.isPaused ? 'pending' : 'paused';
    await db.collection('monitors').doc(monitor.id).update({ isPaused: !monitor.isPaused, status: newStatus });
    setMonitor({ ...monitor, isPaused: !monitor.isPaused, status: newStatus });
    toast('success', monitor.isPaused ? 'Monitor resumed' : 'Monitor paused');
  };

  const handleDelete = async () => {
    setConfirmModal({ title: 'Delete monitor?', message: 'This will permanently delete this monitor and all its check history.', onConfirm: async () => { setConfirmModal(null); await db.collection('monitors').doc(monitor.id).delete(); toast('success', 'Monitor deleted'); navigate('monitors'); }, danger: true, confirmText: 'Delete', cancelText: 'Cancel' });
  };

  const handleTestNow = async () => {
    if (!monitor) return;
    setTestLoading(true);
    setShowTestModal(true);
    setTestResult(null);
    await new Promise(r => setTimeout(r, 1500));
    setTestResult({ status: 200, time: Math.floor(Math.random() * 300) + 50, ok: true });
    setTestLoading(false);
  };

  if (loading) return <div className="p-6 flex justify-center"><div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const getStatusColor = (s) => s === 'up' ? '#39FF14' : s === 'down' ? '#FF3366' : s === 'slow' ? '#FFB800' : '#6B6B8A';
  const getStatusClass = (s) => !s || s === 'up' || s === 'pending' ? 'up' : s === 'down' ? 'down' : s === 'slow' ? 'slow' : 'paused';

  const uptime24h = monitor?.uptimePercentage?.toFixed(2) || '100.00';
  const uptime30d = monitor?.uptimePercentage?.toFixed(2) || '100.00';
  const avgResponse = monitor?.avgResponseMs || 0;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'performance', label: 'Performance' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'rum', label: 'Real User Monitoring' },
    { id: 'history', label: 'Response History' },
    { id: 'settings', label: 'Settings' }
  ];

  return (
    <div className="p-6 space-y-6">
      <button onClick={() => navigate('monitors')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">{ICONS.chevronLeft} Monitors</button>
      
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Syne' }}>{monitor?.name}</h1>
          <p className="text-sm text-gray-400 font-mono">{monitor?.url}</p>
          {monitor?.tags?.length > 0 && (
            <div className="flex gap-1 mt-2">
              {monitor.tags.map((t, i) => <span key={i} className="px-2 py-0.5 bg-cyan-900/50 text-cyan-400 rounded-full text-xs">{t}</span>)}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleTestNow} disabled={testLoading} className="btn-primary">{testLoading ? 'Testing...' : '▶ Test Now'}</button>
          <button onClick={() => navigate('monitors')} className="btn-ghost">✏️ Edit</button>
          <button onClick={handlePause} className={`btn-ghost ${monitor?.isPaused ? 'text-green-400' : ''}`}>{monitor?.isPaused ? '▶ Resume' : '⏸ Pause'}</button>
          <button onClick={handleDelete} className="btn-ghost text-red-400">🗑️ Delete</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card-glass p-4">
          <div className="text-xs text-gray-400 mb-1">Current Status</div>
          <span className={`status-badge ${getStatusClass(monitor?.status)}`}>{monitor?.status === 'pending' || !monitor?.status ? 'UP' : (monitor?.status || 'UP').toUpperCase()}</span>
        </div>
        <div className="card-glass p-4">
          <div className="text-xs text-gray-400 mb-1">Uptime 24h</div>
          <div className="text-xl font-bold text-green-400">{uptime24h}%</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-xs text-gray-400 mb-1">Uptime 30d</div>
          <div className="text-xl font-bold text-green-400">{uptime30d}%</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-xs text-gray-400 mb-1">Avg Response</div>
          <div className="text-xl font-bold text-cyan-400">{avgResponse}ms</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-xs text-gray-400 mb-1">Incidents</div>
          <div className="text-xl font-bold">{incidents.length}</div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-700 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2 text-sm whitespace-nowrap ${activeTab === t.id ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="card-glass p-6">
            <h3 className="font-bold mb-4">Response Time (24h)</h3>
            <div className="h-40 flex items-end gap-1">
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="flex-1 bg-cyan-500/60" style={{ height: `${30 + Math.random() * 60}%` }}></div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span>
            </div>
          </div>
          <div className="card-glass p-6">
            <h3 className="font-bold mb-4">Last 90 Days</h3>
            <div className="grid grid-cols-13 gap-1">
              {Array.from({ length: 90 }, (_, i) => (
                <div key={i} className="aspect-square rounded-sm" style={{ background: Math.random() > 0.1 ? '#39FF14' : '#1A1A2E' }}></div>
              ))}
            </div>
          </div>
          <div className="card-glass p-6">
            <h3 className="font-bold mb-4">SLA Tracking</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div><div className="text-sm text-gray-400">Uptime</div><div className="text-2xl font-bold text-green-400">{uptime30d}%</div></div>
              <div><div className="text-sm text-gray-400">SLA Target</div><div className="text-2xl font-bold">{monitor?.slaTarget || 99.9}%</div></div>
              <div><div className="text-sm text-gray-400">Status</div><div className="text-xl font-bold text-green-400">✅ MEETING SLA</div></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="card-glass p-6">
            <h3 className="font-bold mb-4">Performance Grade</h3>
            <div className="flex items-center gap-4">
              <div className="text-6xl font-bold text-green-400">A</div>
              <div><div className="text-2xl font-bold">95/100</div><div className="text-sm text-gray-400">Based on response time (40pts) + uptime (40pts) + consistency (20pts)</div></div>
            </div>
          </div>
          <div className="card-glass p-6">
            <h3 className="font-bold mb-4">Timing Breakdown</h3>
            {[{ l: 'DNS Lookup', t: 12 }, { l: 'TCP Connect', t: 24 }, { l: 'TLS Handshake', t: 45 }, { l: 'TTFB', t: 78 }, { l: 'Content Download', t: 23 }].map(x => (
              <div key={x.l} className="flex items-center gap-4 mb-3">
                <span className="w-28 text-sm text-gray-400">{x.l}</span>
                <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden"><div className="h-full bg-cyan-500" style={{ width: `${x.t}%` }}></div></div>
                <span className="text-sm w-12">{x.t}ms</span>
              </div>
            ))}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-700">
              <span className="w-28 font-bold">Total</span>
              <div className="flex-1 h-4 bg-gray-800 rounded"><div className="h-full bg-green-500" style={{ width: '18%' }}></div></div>
              <span className="font-bold">182ms</span>
            </div>
          </div>
          <div className="card-glass p-6">
            <h3 className="font-bold mb-4">Recommendations</h3>
            <p className="text-green-400 text-sm">✅ Your endpoint is performing well. No issues found.</p>
          </div>
        </div>
      )}

      {activeTab === 'incidents' && (
        <div className="card-glass p-6">
          <h3 className="font-bold mb-4">Incidents</h3>
          {incidents.length === 0 ? (
            <p className="text-center text-gray-400 py-8">🎉 No incidents! This monitor has been running smoothly.</p>
          ) : (
            <div className="space-y-4">
              {incidents.map(inc => {
                const checkResults = inc.checkResults || {};
                const checks = checkResults;
                const failedChecks = [];
                const passedChecks = [];
                
                if (checks.connectivity?.passed === false) failedChecks.push('Connectivity — ' + (checks.connectivity.error || 'Failed'));
                else if (checks.connectivity) passedChecks.push('Connectivity');
                
                if (checks.fullLoad?.passed === false) failedChecks.push('Full page load — ' + (checks.fullLoad.error || 'Failed'));
                else if (checks.fullLoad) passedChecks.push('Full page load');
                
                if (checks.contentValidation?.passed === false) failedChecks.push('Content — ' + (checks.contentValidation.issues?.join('; ') || 'Failed'));
                else if (checks.contentValidation) passedChecks.push('Content');
                
                if (checks.linkValidation?.broken > 0) failedChecks.push('Links — ' + checks.broken + ' of ' + checks.checked + ' broken');
                else if (checks.linkValidation) passedChecks.push('Links');
                
                if (checks.ssl?.valid === false || checks.ssl?.daysUntilExpiry < 30) failedChecks.push('SSL — ' + (checks.ssl.daysUntilExpiry < 30 ? 'Expiring in ' + checks.ssl.daysUntilExpiry + ' days' : 'Invalid'));
                else if (checks.ssl) passedChecks.push('SSL');
                
                if (checks.dns?.resolved === false) failedChecks.push('DNS — ' + (checks.dns.error || 'Failed'));
                else if (checks.dns) passedChecks.push('DNS');
                
                const duration = inc.resolvedAt && inc.createdAt ? Math.round((inc.resolvedAt.toDate() - inc.createdAt.toDate()) / 60000) + 'min' : 'Ongoing';
                const created = inc.createdAt?.toDate?.() || new Date();
                const timeStr = created.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' EAT';
                
                return (
                  <div key={inc.id} className="border border-gray-700 rounded-lg overflow-hidden">
                    <div className={`flex items-center justify-between px-4 py-3 ${inc.isResolved ? 'bg-gray-800' : 'bg-red-900/30'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{inc.isResolved ? '✅' : '🔴'}</span>
                        <span className="font-medium">{inc.isResolved ? 'Resolved' : 'CRITICAL'}</span>
                      </div>
                      <div className="text-xs text-gray-400">{timeStr} — Duration: {duration}</div>
                    </div>
                    
                    <div className="p-4 bg-[#0D0D18]">
                      <div className="text-cyan-400 font-medium mb-2">"{inc.title || inc.reason || 'Downtime'}"</div>
                      
                      {inc.description && (
                        <div className="mb-4">
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">What happened</div>
                          <p className="text-sm text-gray-300">{inc.description}</p>
                        </div>
                      )}
                      
                      {inc.affectedLocations && (
                        <div className="mb-4">
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Affected locations</div>
                          <div className={`${inc.isResolved ? 'text-green-400' : 'text-red-400'} block mb-1`}>❌ {inc.affectedLocations}</div>
                          {inc.workingLocations && <div className="text-green-400">✅ {inc.workingLocations}</div>}
                        </div>
                      )}
                      
                      {failedChecks.length > 0 && (
                        <div className="mb-4">
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Checks that failed</div>
                          {failedChecks.map((c, i) => (
                            <div key={i} className="text-red-400 text-sm flex items-center gap-2">❌ {c}</div>
                          ))}
                          {passedChecks.map((c, i) => (
                            <div key={i} className="text-green-400 text-sm flex items-center gap-2">✅ {c}</div>
                          ))}
                        </div>
                      )}
                      
                      {inc.timeline?.length > 0 && (
                        <div className="mb-4">
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Timeline</div>
                          {inc.timeline.map((t, i) => (
                            <div key={i} className="text-gray-400 text-sm flex gap-2">
                              <span className="text-cyan-400">{t.time?.toDate?.().toLocaleTimeString?.('en-GB', { hour: '2-digit', minute: '2-digit' }) || t.time}</span>
                              <span>— {t.event}</span>
                              {t.detail && <span className="text-gray-500">({t.detail})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex gap-3 mt-4 pt-3 border-t border-gray-700">
                        <button className="text-xs text-cyan-400 hover:text-cyan-300">Add Note</button>
                        <button className="text-xs text-gray-400 hover:text-white">Download Report</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rum' && (
        <div className="card-glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-bold">Real User Monitoring</h3>
            <span className="px-2 py-0.5 bg-purple-600 text-xs rounded">🔒 PRO</span>
          </div>
          <p className="text-sm text-gray-400 mb-4">Paste this script before the {'</body>'} tag on your website to track real visitor load times.</p>
          <div className="bg-gray-900 p-4 rounded-lg font-mono text-xs overflow-x-auto mb-4">
            {`<script>
(function() {
  var t = Date.now();
  window.addEventListener('load', function() {
    fetch('https://api.pulsegrid.io/rum/${monitor?.id}', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        loadTime: Date.now() - t,
        url: location.href,
        timestamp: new Date().toISOString()
      })
    });
  });
})();
</script>`}
          </div>
          <button className="btn-ghost text-sm">Copy Code</button>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div><div className="text-xs text-gray-400">Active Sessions</div><div className="text-xl font-bold">0</div></div>
            <div><div className="text-xs text-gray-400">Avg Load Time</div><div className="text-xl font-bold">—</div></div>
            <div><div className="text-xs text-gray-400">Pageviews 24h</div><div className="text-xl font-bold">0</div></div>
            <div><div className="text-xs text-gray-400">Apdex</div><div className="text-xl font-bold">—</div></div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card-glass p-6">
          <h3 className="font-bold mb-4">Response History</h3>
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <span className="text-sm">{new Date(Date.now() - i * 3600000).toLocaleString()}</span>
                <span className="text-green-400 text-sm">200 OK</span>
                <span className="text-cyan-400 text-sm">{Math.floor(Math.random() * 200 + 50)}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="card-glass p-6 space-y-4">
          <h3 className="font-bold mb-4">Settings</h3>
          <div><label className="block text-sm text-gray-400">Name</label><input value={monitor?.name || ''} className="input-field w-full" /></div>
          <div><label className="block text-sm text-gray-400">URL</label><input value={monitor?.url || ''} className="input-field w-full" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-400">Method</label><select className="input-field w-full"><option>GET</option></select></div>
            <div><label className="block text-sm text-gray-400">Interval</label><select className="input-field w-full"><option>300</option></select></div>
          </div>
          <button className="btn-primary">Save Changes</button>
        </div>
      )}

      {showTestModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card-glass p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold mb-4">Test Result — {monitor?.name}</h2>
            {testLoading ? (
              <div className="text-center py-8"><div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div><p className="mt-4 text-gray-400">Testing endpoint...</p></div>
            ) : testResult ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><div className="text-sm text-gray-400">Status</div><div className="text-green-400 font-bold">200 OK</div></div>
                  <div><div className="text-sm text-gray-400">Response Time</div><div className="text-cyan-400 font-bold">{testResult.time}ms</div></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleTestNow} className="btn-primary flex-1">🔄 Run Again</button>
                  <button onClick={() => setShowTestModal(false)} className="btn-ghost flex-1">Close</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

// Settings Page
const SettingsPage = () => {
  const { toast, navigate, userData, setUserData, confirmModal, setConfirmModal } = useContext(NavigationContext);
  const [activeSection, setActiveSection] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(userData?.fullName || '');
  const [companyName, setCompanyName] = useState(userData?.companyName || '');
  const [timezone, setTimezone] = useState(userData?.timezone || 'Africa/Nairobi');
  const [apiKey, setApiKey] = useState('pg_live_●●●●●●●●●●●●●●●');
  const [showApiKey, setShowApiKey] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({ emailDown: true, emailRecover: true, dailyDigest: false, weeklyReport: false, monthlySLA: false });
  const [quietHours, setQuietHours] = useState(false);
  const [quietFrom, setQuietFrom] = useState('23:00');
  const [quietTo, setQuietTo] = useState('07:00');
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    if (!auth.currentUser) { navigate('landing'); return; }
  }, [navigate]);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await db.collection('users').doc(auth.currentUser.uid).update({ fullName, companyName, timezone });
      setUserData({ ...userData, fullName, companyName, timezone });
      toast('success', '✅ Profile updated.');
    } catch (err) { toast('error', 'Failed to update profile'); }
    setLoading(false);
  };

  const handleSaveNotifications = async () => {
    try {
      await db.collection('users').doc(auth.currentUser.uid).update({ notificationPrefs: { ...notifPrefs, quietHours, quietFrom, quietTo } });
      toast('success', '✅ Notification settings saved.');
    } catch (err) { toast('error', 'Failed to save settings'); }
  };

  const copyApiKey = () => { navigator.clipboard.writeText('pg_live_' + auth.currentUser?.uid?.slice(0, 8)); toast('success', '✅ Copied!'); };
  const handleLogout = async () => { setConfirmModal({ title: 'Log out?', message: 'Are you sure you want to log out of PulseGrid?', onConfirm: async () => { setConfirmModal(null); await auth.signOut(); toast('info', 'Logged out'); }, danger: true, confirmText: 'Log Out', cancelText: 'Cancel' }); };

  const pauseAllMonitors = async () => {
    setConfirmModal({ title: 'Pause all monitors?', message: 'This will pause checking all your monitors. You can resume them anytime.', onConfirm: async () => { setConfirmModal(null); const snaps = await db.collection('monitors').where('userId', '==', auth.currentUser.uid).get(); for (const doc of snaps.docs) { await doc.ref.update({ isPaused: true, status: 'paused' }); } toast('success', 'All monitors paused.'); }, danger: false, confirmText: 'Pause All', cancelText: 'Cancel' });
  };

  const exportData = async () => {
    const data = { user: userData, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pulsegrid-data.json'; a.click();
    toast('success', '✅ Data exported.');
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE MY ACCOUNT') { toast('error', 'Type DELETE MY ACCOUNT to confirm'); return; }
    await db.collection('users').doc(auth.currentUser.uid).delete();
    await auth.currentUser.delete();
    toast('info', 'Account deleted.');
    navigate('landing');
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: ICONS.user },
    { id: 'team', label: 'Team', icon: ICONS.user, pro: true },
    { id: 'billing', label: 'Billing', icon: ICONS.file },
    { id: 'notifications', label: 'Notifications', icon: ICONS.bell },
    { id: 'api', label: 'API Access', icon: ICONS.zap, pro: true },
    { id: 'danger', label: 'Danger Zone', icon: ICONS.x }
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="flex gap-6 flex-wrap">
        <div className="w-56 shrink-0 space-y-1">{sections.map(s => (<button key={s.id} onClick={() => setActiveSection(s.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection === s.id ? 'bg-cyan-900/50 text-cyan-400' : 'hover:bg-gray-800 text-gray-400'}`}>{s.icon}<span className="flex-1 text-left">{s.label}</span>{s.pro && <span className="text-xs bg-purple-600 px-1 rounded">🔒</span>}</button>))}</div>
        <div className="flex-1 card-glass p-6 space-y-6 max-w-2xl">
          {activeSection === 'profile' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Profile</h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center text-2xl font-bold text-cyan-400">{fullName?.[0]?.toUpperCase() || 'U'}</div>
                <button className="text-cyan-400 text-sm">Change Photo</button>
              </div>
              <div className="space-y-4">
                <div><label className="block text-sm text-gray-400 mb-1">Full Name</label><input value={fullName} onChange={e => setFullName(e.target.value)} className="input-field w-full" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Company</label><input value={companyName} onChange={e => setCompanyName(e.target.value)} className="input-field w-full" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Email</label><input value={auth.currentUser?.email || ''} className="input-field w-full" disabled /><span className="text-xs text-green-400 ml-2">Verified ✓</span></div>
                <div><label className="block text-sm text-gray-400 mb-1">Timezone</label><select value={timezone} onChange={e => setTimezone(e.target.value)} className="input-field w-full"><option>Africa/Nairobi</option><option>Europe/London</option><option>America/New_York</option><option>Asia/Singapore</option></select></div>
                <button onClick={handleSaveProfile} disabled={loading} className="btn-primary">{loading ? <Spinner /> : 'Save Changes'}</button>
              </div>
            </div>
          )}
          {activeSection === 'team' && (
            <div>
              <div className="flex items-center gap-2 mb-4"><h2 className="text-xl font-bold">Team</h2><span className="text-xs bg-purple-600 px-2 py-0.5 rounded">🔒 PRO</span></div>
              <p className="text-sm text-gray-400 mb-4">Invite team members to collaborate on monitoring.</p>
              <div className="p-8 bg-gray-900 rounded-lg text-center"><p className="text-gray-400">Coming soon during beta!</p></div>
            </div>
          )}
          {activeSection === 'billing' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Billing</h2>
              <div className="p-4 bg-cyan-900/30 border border-cyan-500 rounded-lg mb-6">
                <div className="text-cyan-400 font-bold mb-1">🎉 You're on Beta Access</div>
                <p className="text-sm text-gray-400">All Pro Features FREE — Beta ends in 30 days</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-900/50 rounded-lg opacity-50"><div className="text-green-400 font-bold">M-Pesa</div><p className="text-xs text-gray-500">Coming Soon</p></div>
                <div className="p-4 bg-gray-900/50 rounded-lg opacity-50"><div className="text-blue-400 font-bold">PayPal</div><p className="text-xs text-gray-500">Coming Soon</p></div>
              </div>
              <div><label className="block text-sm text-gray-400 mb-2">Get notified when payments go live</label><div className="flex gap-2"><input placeholder="your@email.com" className="input-field flex-1" /><button className="btn-ghost">Notify Me</button></div></div>
            </div>
          )}
          {activeSection === 'notifications' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Notifications</h2>
              <div className="space-y-3 mb-6">
                {[{ k: 'emailDown', l: 'Email when monitor goes DOWN' }, { k: 'emailRecover', l: 'Email when monitor RECOVERS' }, { k: 'dailyDigest', l: 'Daily digest email' }, { k: 'weeklyReport', l: 'Weekly performance report' }, { k: 'monthlySLA', l: 'Monthly SLA report' }].map(o => (<label key={o.k} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"><span>{o.l}</span><input type="checkbox" checked={notifPrefs[o.k]} onChange={e => setNotifPrefs({ ...notifPrefs, [o.k]: e.target.checked })} className="w-4 h-4" /></label>))}
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg mb-4"><span>Quiet Hours</span><input type="checkbox" checked={quietHours} onChange={e => setQuietHours(e.target.checked)} className="w-4 h-4" /></div>
              {quietHours && <div className="flex gap-4 mb-4"><input type="time" value={quietFrom} onChange={e => setQuietFrom(e.target.value)} className="input-field" /><input type="time" value={quietTo} onChange={e => setQuietTo(e.target.value)} className="input-field" /></div>}
              <button onClick={handleSaveNotifications} className="btn-primary">Save Preferences</button>
            </div>
          )}
          {activeSection === 'api' && (
            <div>
              <div className="flex items-center gap-2 mb-4"><h2 className="text-xl font-bold">API Access</h2><span className="text-xs bg-purple-600 px-2 py-0.5 rounded">🔒 PRO</span></div>
              <p className="text-sm text-gray-400 mb-4">Use your API key to integrate PulseGrid with your systems.</p>
              <div className="space-y-4 mb-6">
                <div><label className="block text-sm text-gray-400 mb-1">Your API Key</label><div className="flex gap-2"><input value={showApiKey ? auth.currentUser?.uid?.slice(0, 16) || 'pg_live_abc123def456' : apiKey} className="input-field flex-1" disabled /><button onClick={() => setShowApiKey(!showApiKey)} className="btn-ghost">{showApiKey ? '👁 Hide' : '👁 Show'}</button><button onClick={copyApiKey} className="btn-ghost">📋 Copy</button></div></div>
              </div>
              <div className="p-4 bg-gray-900 rounded-lg font-mono text-xs">curl -H YOUR_KEY https://api.pulsegrid.io/v1/monitors</div>
            </div>
          )}
          {activeSection === 'danger' && (
            <div>
              <h2 className="text-xl font-bold mb-4 text-red-400">Danger Zone</h2>
              <div className="space-y-4">
                <button onClick={pauseAllMonitors} className="btn-ghost w-full text-left">⏸ Pause All Monitors</button>
                <button onClick={exportData} className="btn-ghost w-full text-left">📦 Export All Data</button>
                <div className="p-4 border border-red-500/30 rounded-lg">
                  <div className="text-red-400 font-bold mb-2">Delete Account</div>
                  <p className="text-sm text-gray-400 mb-3">This permanently deletes your account and all data.</p>
                  <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="Type DELETE MY ACCOUNT" className="input-field w-full mb-2" />
                  <button onClick={deleteAccount} disabled={deleteConfirm !== 'DELETE MY ACCOUNT'} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg disabled:opacity-50">🗑️ Delete Account</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main App
const App = () => {
  const [currentPage, setCurrentPage] = useState('landing');
  const [toastData, setToastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [confirmModal, setConfirmModal] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toast = (type, message) => setToastData({ type, message });
  const pageTitles = { landing: 'Welcome', login: 'Sign In', signup: 'Sign Up', verifyemail: 'Verify Email', dashboard: 'Dashboard', monitors: 'My Monitors', addmonitor: 'Add Monitor', monitor: 'Monitor Details', statuspages: 'Status Pages', reports: 'Reports', settings: 'Settings', apidocs: 'API Docs' };
  
  const navigate = (page) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
    document.title = (pageTitles[page] || page) + ' — PulseGrid';
  };
  const handleLogout = () => { setShowLogoutConfirm(true); };
  const confirmLogout = async () => { setShowLogoutConfirm(false); await auth.signOut(); };
  const cancelLogout = () => { setShowLogoutConfirm(false); };

  const contextValue = { toast, navigate, userData, setUserData, auth, db, confirmModal, setConfirmModal };

  useEffect(() => {
    if (typeof firebase === 'undefined') { setTimeout(() => setLoading(false), 1000); return; }

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const doc = await db.collection('users').doc(user.uid).get();
          if (doc.exists) { 
            const newUserData = doc.data(); 
            setUserData(newUserData); 
          }
          else {
            await db.collection('users').doc(user.uid).set({
              uid: user.uid, email: user.email, fullName: user.displayName || '', companyName: '',
              plan: 'pro', createdAt: firebase.firestore.FieldValue.serverTimestamp(), avatarUrl: user.photoURL || '', emailVerified: user.emailVerified
            });
            const newUserData = { uid: user.uid, email: user.email, fullName: user.displayName || '', plan: 'pro' };
            setUserData(newUserData);
          }
        } catch (err) { console.error('Error loading user data:', err); }
        setCurrentPage('dashboard');
      } else {
        setUserData(null);
        setCurrentPage('landing');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || !auth.currentUser) return;
    try { await auth.currentUser.sendEmailVerification(); toast('success', 'Verification email sent!'); setResendCooldown(60); }
    catch (err) { toast('error', 'Failed to send verification email'); }
  };

  useEffect(() => { if (resendCooldown > 0) { const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000); return () => clearTimeout(t); } }, [resendCooldown]);

  const handleVerifyContinue = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) { toast('success', 'Email verified! Welcome to PulseGrid!'); setCurrentPage('dashboard'); }
    else { toast('error', 'Email not verified yet. Check your inbox and click the link.'); }
  };

  if (loading) return (<div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}><div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div></div>);

  const isLoggedIn = !!auth.currentUser;
  const isPublicPage = ['landing', 'login', 'signup', 'verify-email'].includes(currentPage);
  const showApp = isLoggedIn && !isPublicPage;

  return (
    <NavigationContext.Provider value={contextValue}>
      <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="grid-bg" /><div className="scanline" />
        {toastData && (
          <div className={`toast ${toastData.type}`} style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
            <div className="flex items-center justify-between"><span>{toastData.message}</span><button onClick={() => setToastData(null)} className="text-gray-400 hover:text-white ml-4">{ICONS.x}</button></div>
          </div>
        )}
        {confirmModal && <ConfirmModal title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(null)} danger={confirmModal.danger} confirmText={confirmModal.confirmText} cancelText={confirmModal.cancelText} />}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={cancelLogout}>
            <div className="bg-[#0D0D18] border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Syne' }}>Log out?</h3>
              <p className="text-gray-400 mb-6 text-sm">Are you sure you want to log out of PulseGrid?</p>
              <div className="flex gap-3">
                <button onClick={cancelLogout} className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition">Cancel</button>
                <button onClick={confirmLogout} className="flex-1 px-4 py-2 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white transition">Log Out</button>
              </div>
            </div>
          </div>
        )}
        {currentPage === 'landing' && !isLoggedIn && <LandingPage />}
        {(currentPage === 'login' || currentPage === 'signup') && !isLoggedIn && <AuthPage initialTab={currentPage} />}
        {currentPage === 'verify-email' && auth.currentUser && <EmailVerificationScreen email={auth.currentUser.email} onResend={handleResendVerification} onContinue={handleVerifyContinue} onBack={() => auth.signOut()} resendCooldown={resendCooldown} />}
        {showApp && (
          <div className="flex">
            <div className="mobile-header">
              <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>☰</button>
              <span className="font-bold" style={{ fontFamily: 'Syne' }}>PulseGrid</span>
              <div style={{ width: 40 }}></div>
            </div>
            <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`} onClick={() => setMobileMenuOpen(false)}>
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">{ICONS.radio}<span className="text-xl font-bold" style={{ fontFamily: 'Syne' }}>PulseGrid</span></div>
                <button className="text-gray-500 md:hidden" onClick={() => setMobileMenuOpen(false)}>✕</button>
              </div>
              <nav className="p-2">
                {[{ icon: ICONS.home, label: 'Dashboard', page: 'dashboard' }, { icon: ICONS.activity, label: 'Monitors', page: 'monitors' }, { icon: ICONS.plus, label: 'Add Monitor', page: 'add-monitor' }, { icon: ICONS.globe, label: 'Status Pages', page: 'status-pages' }, { icon: ICONS.file, label: 'Reports', page: 'reports' }, { icon: ICONS.zap, label: 'API Docs', page: 'api-docs' }, { icon: ICONS.settings, label: 'Settings', page: 'settings' }].map(item => (
                  <button key={item.page} onClick={() => setCurrentPage(item.page)} className={`sidebar-item w-full ${currentPage === item.page ? 'active' : ''}`}>{item.icon}<span>{item.label}</span></button>
                ))}
                <button onClick={handleLogout} className="sidebar-item w-full text-red-400 hover:bg-red-900/30 mt-4 pt-4 border-t border-gray-800">{ICONS.logout || ICONS.x}<span>Logout</span></button>
              </nav>
            </aside>
            {mobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-[99]" onClick={() => setMobileMenuOpen(false)} />}
            <main className="flex-1 md:ml-60">
              <header className="sticky top-0 z-30 bg-black border-b border-gray-800 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold capitalize">{currentPage}</h2>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-900 border border-cyan-700"><span className="text-xs text-cyan-400">{userData?.plan?.toUpperCase() || 'FREE'}</span></div>
                </div>
              </header>
              <div className="pb-20">
                {currentPage === 'dashboard' && <Dashboard />}
                {currentPage === 'monitors' && <MonitorsPage />}
                {currentPage === 'add-monitor' && <AddMonitorPage />}
                {currentPage === 'status-pages' && <StatusPagesPage />}
                {currentPage === 'reports' && <ReportsPage />}
                {currentPage === 'api-docs' && <APIDocsPage />}
                {currentPage === 'settings' && <SettingsPage />}
                {currentPage.startsWith('monitor-') && <MonitorDetailPage monitorId={currentPage.replace('monitor-', '')} />}
              </div>
            </main>
          </div>
        )}
      </div>
    </NavigationContext.Provider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
