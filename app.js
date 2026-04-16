const { useState, useEffect, useRef } = React;
const { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } = Recharts;

const API_URL = '/api';

const apiCall = async (method, endpoint, data = null) => {
  const savedUser = localStorage.getItem('pulsegrid_user');
  const user = savedUser ? JSON.parse(savedUser) : null;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (user?.token) options.headers['Authorization'] = `Bearer ${user.token}`;
  if (data) options.body = JSON.stringify(data);
  try {
    const res = await fetch(`${API_URL}${endpoint}`, options);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('API call failed:', err.message);
    return null;
  }
};

const ICONS = {
  home: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  activity: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  plus: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  globe: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  file: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  search: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  bell: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  x: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  chevronDown: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>,
  chevronUp: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>,
  chevronLeft: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>,
  download: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  externalLink: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  trash: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  radio: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>,
  menu: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  zap: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  edit: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  pause: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  sharing: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
};

const generateChartData = () => Array.from({ length: 24 }, (_, i) => ({ time: `${i}:00`, Kenya: Math.floor(Math.random() * 200) + 100, Germany: Math.floor(Math.random() * 180) + 120, USA: Math.floor(Math.random() * 220) + 80 }));
const generateUptimeData = () => Array.from({ length: 30 }, () => ({ value: Math.random() > 0.05 ? 100 : Math.floor(Math.random() * 10) + 95 }));

const Toast = ({ type, message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div className={`toast ${type}`}>
      <div className="flex items-center justify-between">
        <span>{message}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white ml-4">{ICONS.x}</button>
      </div>
    </div>
  );
};

const LandingPage = ({ onAuth }) => (
  <div className="min-h-screen flex items-center justify-center p-6">
    <div className="max-w-4xl w-full text-center">
      <div className="mb-8">
        <div className="inline-flex items-center gap-3 mb-6">
          {ICONS.radio}
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'Syne' }}>PulseGrid</h1>
        </div>
        <p className="text-xl text-cyan-400 mb-2">[v2.0] Your APIs. Always Alive.</p>
        <p className="text-gray-400">Monitor your services from 3 global locations. Get instant alerts when things break.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {[
          { icon: ICONS.activity, title: 'Real-time Monitoring', desc: 'Check your APIs every 30 seconds from Nairobi, Frankfurt & Virginia' },
          { icon: ICONS.bell, title: 'Instant Alerts', desc: 'Get notified by email, SMS or webhook the second something goes down' },
          { icon: ICONS.globe, title: 'Status Pages', desc: 'Auto-generate beautiful public status pages for your users' },
        ].map((f, i) => (
          <div key={i} className="card-glass p-6 text-center">
            <div className="text-cyan-400 mb-4 flex justify-center">{f.icon}</div>
            <h3 className="font-bold mb-2">{f.title}</h3>
            <p className="text-sm text-gray-400">{f.desc}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button onClick={() => onAuth('signup')} className="btn-primary px-8 py-4 text-lg">Get Started Free</button>
        <button onClick={() => onAuth('login')} className="btn-ghost px-8 py-4 text-lg">Sign In</button>
      </div>
    </div>
  </div>
);

const AuthPage = ({ type, onAuth, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const endpoint = type === 'signup' ? '/auth/signup' : '/auth/login';
    const result = await apiCall('POST', endpoint, { email, password, name });
    
    if (result) {
      onAuth({ name: name || email.split('@')[0], email, id: result.id || Date.now(), token: result.token });
    } else {
      setError('Connection failed. Using demo mode.');
      setTimeout(() => onAuth({ name: name || email.split('@')[0], email, id: Date.now() }), 1500);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card-glass p-8 w-full max-w-md">
        <button onClick={onBack} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">{ICONS.chevronLeft} Back</button>
        <h2 className="text-2xl font-bold mb-6">{type === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
        {error && <div className="mb-4 p-3 bg-red-900/50 text-red-400 rounded-lg text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'signup' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Full Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Victor M." required />
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="victor@company.com" required />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="••••••••" required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">{loading ? 'Loading...' : type === 'signup' ? 'Create Account' : 'Sign In'}</button>
        </form>
        <p className="text-center text-sm text-gray-400 mt-6">
          {type === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => onAuth(type === 'signup' ? 'login' : 'signup')} className="text-cyan-400 hover:text-cyan-300">{type === 'signup' ? 'Sign in' : 'Sign up'}</button>
        </p>
      </div>
    </div>
  );
};

const Dashboard = ({ user, onNavigate }) => {
  const [monitors, setMonitors] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [monData, incData, statsData] = await Promise.all([
        apiCall('GET', '/monitors'),
        apiCall('GET', '/incidents'),
        apiCall('GET', '/stats/overview'),
      ]);
      
      setMonitors(monData?.monitors || []);
      setIncidents(incData?.incidents || []);
      setChartData(generateChartData());
      setLoading(false);
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading PulseGrid...</p>
        </div>
      </div>
    );
  }

  const upCount = monitors.filter(m => m.status === 'up' || m.status === 'OK').length;
  const downCount = monitors.filter(m => m.status === 'down' || m.status === 'ERROR').length;
  const avgResponse = monitors.length ? Math.round(monitors.reduce((a, m) => a + (m.avg_response || m.avgResponse || 0), 0) / monitors.length) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-400">Real-time status of all your monitors</p>
        </div>
        <button onClick={() => onNavigate('add-monitor')} className="btn-primary flex items-center gap-2">{ICONS.plus} Add Monitor</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Monitors', value: monitors.length || 0, color: 'cyan', icon: ICONS.activity },
          { label: 'Up', value: upCount, color: 'green', icon: ICONS.check },
          { label: 'Down', value: downCount, color: 'red', icon: ICONS.x },
          { label: 'Avg Response', value: avgResponse ? `${avgResponse}ms` : '—', color: 'amber', icon: ICONS.zap },
        ].map((stat, i) => (
          <div key={i} className={`card-glass p-4 stat-card ${stat.color}`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-gray-400">{stat.icon}</span>
              <span className="text-sm text-gray-400">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {downCount > 0 && (
        <div className="card-glass p-5 alert-banner border border-red-900">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-red-400">{ICONS.activity}</span>
            <span className="font-bold text-red-400">{downCount} monitor(s) experiencing issues</span>
          </div>
          {monitors.filter(m => m.status === 'down' || m.status === 'ERROR').map(m => (
            <div key={m.id} className="text-sm text-gray-400 ml-8">{m.name} — DOWN</div>
          ))}
        </div>
      )}

      <div className="card-glass p-6">
        <h3 className="font-bold mb-4">Response Time (24h)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E" />
            <XAxis dataKey="time" stroke="#6B6B8A" fontSize={12} />
            <YAxis stroke="#6B6B8A" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: '#0D0D18', border: '1px solid #1A1A2E', borderRadius: '8px' }} />
            <Line type="monotone" dataKey="Kenya" stroke="#00F5FF" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Germany" stroke="#39FF14" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="USA" stroke="#FFB800" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-6 mt-4">
          {[{ color: '#00F5FF', label: 'Kenya' }, { color: '#39FF14', label: 'Germany' }, { color: '#FFB800', label: 'USA' }].map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }}></div>
              <span>{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Active Monitors</h3>
            <button onClick={() => onNavigate('monitors')} className="text-sm text-cyan-400">View all</button>
          </div>
          <div className="space-y-3">
            {(monitors.length ? monitors : []).slice(0, 4).map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-gray-500">{m.url}</div>
                </div>
                <div className="text-right">
                  <span className={`status-badge ${m.status === 'up' || m.status === 'OK' ? 'up' : 'down'}`}>
                    <span className={`pulse-dot ${m.status === 'up' || m.status === 'OK' ? 'green' : 'red'}`}></span>
                    {(m.status || 'UP').toUpperCase()}
                  </span>
                  <div className="text-xs text-gray-500 mt-1">{m.avg_response || m.avgResponse || 0}ms</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Recent Incidents</h3>
            <button onClick={() => onNavigate('monitors')} className="text-sm text-cyan-400">View all</button>
          </div>
          <div className="space-y-3">
            {(incidents.length ? incidents : []).slice(0, 3).map(inc => (
              <div key={inc.id} className="p-3 bg-gray-900 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{inc.reason}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${inc.status === 'ongoing' || !inc.is_resolved ? 'bg-red-900 text-red-400' : 'bg-green-900 text-green-400'}`}>
                    {inc.status === 'ongoing' || !inc.is_resolved ? 'ongoing' : 'resolved'}
                  </span>
                </div>
                <div className="text-xs text-gray-500">{inc.started_at || inc.startedAt}</div>
              </div>
            ))}
            {(!incidents.length) && <p className="text-gray-500 text-sm">No incidents recorded.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const AddMonitorPage = ({ onSave, onBack }) => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', url: '', method: 'GET', interval: 60, timeout: 30, locations: ['KE'], notifications: { email: true, sms: false } });

  const handleSubmit = async () => {
    setLoading(true);
    const result = await apiCall('POST', '/monitors', {
      name: formData.name,
      url: formData.url,
      method: formData.method,
      interval: formData.interval,
      timeout: formData.timeout,
    });
    setLoading(false);
    onSave({ ...formData, id: result?.id || Date.now(), status: 'up', uptime: 100, avgResponse: 0 });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6">{ICONS.chevronLeft} Back</button>
      <h1 className="text-2xl font-bold mb-6">Add New Monitor</h1>
      <div className="flex gap-2 mb-8">
        {['Basic Info', 'Advanced', 'Notifications'].map((s, i) => (
          <button key={i} onClick={() => setStep(i)} className={`px-4 py-2 rounded-lg text-sm ${step === i ? 'bg-cyan-900 text-cyan-400' : 'text-gray-400'}`}>{i + 1}. {s}</button>
        ))}
      </div>
      <div className="card-glass p-6 space-y-6">
        {step === 0 && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Monitor Name</label>
              <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input-field" placeholder="My API Health Check" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">URL to Monitor</label>
              <input value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} className="input-field" placeholder="https://api.example.com/health" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">HTTP Method</label>
              <select value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value })} className="input-field">
                <option>GET</option><option>POST</option><option>HEAD</option>
              </select>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Check Interval: {formData.interval} seconds</label>
              <input type="range" min="30" max="300" value={formData.interval} onChange={e => setFormData({ ...formData, interval: parseInt(e.target.value) })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Timeout: {formData.timeout} seconds</label>
              <input type="range" min="5" max="60" value={formData.timeout} onChange={e => setFormData({ ...formData, timeout: parseInt(e.target.value) })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Monitoring Locations</label>
              <div className="space-y-2">
                {[{ id: 'KE', label: 'KE Nairobi' }, { id: 'DE', label: 'DE Frankfurt' }, { id: 'US', label: 'US Virginia' }].map(loc => (
                  <label key={loc.id} className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg cursor-pointer">
                    <input type="checkbox" checked={formData.locations.includes(loc.id)} onChange={e => {
                      const newLocs = e.target.checked ? [...formData.locations, loc.id] : formData.locations.filter(l => l !== loc.id);
                      setFormData({ ...formData, locations: newLocs });
                    }} style={{ accentColor: 'var(--accent-cyan)' }} />
                    <span>{loc.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg cursor-pointer">
              <input type="checkbox" checked={formData.notifications.email} onChange={e => setFormData({ ...formData, notifications: { ...formData.notifications, email: e.target.checked } })} style={{ accentColor: 'var(--accent-cyan)' }} />
              <div><div className="font-medium">Email Notifications</div><div className="text-sm text-gray-400">Get alerts when monitor goes down or recovers</div></div>
            </label>
          </div>
        )}
        <div className="flex gap-4">
          {step > 0 && <button onClick={() => setStep(step - 1)} className="btn-ghost px-6 py-3">Back</button>}
          {step < 2 ? (
            <button onClick={() => setStep(step + 1)} className="btn-primary px-6 py-3">Next</button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="btn-primary px-6 py-3">{loading ? 'Creating...' : 'Create Monitor'}</button>
          )}
        </div>
      </div>
    </div>
  );
};

const MonitorsPage = ({ user, onNavigate }) => {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [bulkAction, setBulkAction] = useState('');

  useEffect(() => {
    fetchMonitors();
  }, []);

  const fetchMonitors = async () => {
    const data = await apiCall('GET', '/monitors');
    setMonitors(data?.monitors || []);
    setLoading(false);
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selected.length === 0) return;
    const result = await apiCall('POST', '/monitors/bulk', { ids: selected, action: bulkAction });
    if (result) {
      fetchMonitors();
      setSelected([]);
      setBulkAction('');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this monitor?')) return;
    const result = await apiCall('DELETE', `/monitors/${id}`);
    if (result) fetchMonitors();
  };

  const handlePause = async (id) => {
    const m = monitors.find(m => m.id === id);
    const action = m?.is_paused ? 'resume' : 'pause';
    await apiCall('POST', `/monitors/${id}/${action}`);
    fetchMonitors();
  };

  const filtered = monitors.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.url?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || m.status === filter || (filter === 'paused' && m.is_paused);
    return matchSearch && matchFilter;
  });

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map(m => m.id));

  if (loading) return <div className="p-6 flex items-center justify-center min-h-[60vh]"><div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitors</h1>
          <p className="text-sm text-gray-400">{monitors.length} total monitors</p>
        </div>
        <button onClick={() => onNavigate('add-monitor')} className="btn-primary flex items-center gap-2">{ICONS.plus} Add Monitor</button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          {ICONS.search}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search monitors..." className="input-field pl-10 w-full" />
        </div>
        <div className="flex gap-3">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="input-field">
            <option value="all">All Status</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
            <option value="paused">Paused</option>
          </select>
          {selected.length > 0 && (
            <div className="flex gap-2">
              <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} className="input-field">
                <option value="">Bulk Action</option>
                <option value="pause">Pause</option>
                <option value="resume">Resume</option>
                <option value="delete">Delete</option>
              </select>
              <button onClick={handleBulkAction} className="btn-ghost px-4">Apply</button>
            </div>
          )}
        </div>
      </div>

      <div className="card-glass overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="p-4 text-left"><input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll} style={{ accentColor: 'var(--accent-cyan)' }} /></th>
              <th className="p-4 text-left text-sm text-gray-400">Monitor</th>
              <th className="p-4 text-left text-sm text-gray-400">Status</th>
              <th className="p-4 text-left text-sm text-gray-400">Response</th>
              <th className="p-4 text-left text-sm text-gray-400">Last Check</th>
              <th className="p-4 text-left text-sm text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan="6" className="p-8 text-center text-gray-500">No monitors found</td></tr>
            )}
            {filtered.map(m => (
              <tr key={m.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                <td className="p-4"><input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggleSelect(m.id)} style={{ accentColor: 'var(--accent-cyan)' }} /></td>
                <td className="p-4">
                  <button onClick={() => onNavigate('monitor-detail', m)} className="text-left hover:text-cyan-400">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-gray-500">{m.url}</div>
                  </button>
                </td>
                <td className="p-4">
                  <span className={`status-badge ${m.is_paused ? 'paused' : m.status === 'up' || m.status === 'OK' ? 'up' : 'down'}`}>
                    <span className={`pulse-dot ${m.is_paused ? 'gray' : m.status === 'up' || m.status === 'OK' ? 'green' : 'red'}`}></span>
                    {m.is_paused ? 'PAUSED' : (m.status || 'UP').toUpperCase()}
                  </span>
                </td>
                <td className="p-4 text-sm">{m.last_check?.response_time_ms || m.avg_response || 0}ms</td>
                <td className="p-4 text-sm text-gray-400">{m.last_check?.checked_at ? new Date(m.last_check.checked_at).toLocaleString() : '—'}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button onClick={() => handlePause(m.id)} className="p-2 hover:bg-gray-800 rounded" title={m.is_paused ? 'Resume' : 'Pause'}>{m.is_paused ? ICONS.radio : ICONS.pause}</button>
                    <button onClick={() => onNavigate('monitor-detail', m)} className="p-2 hover:bg-gray-800 rounded" title="View">{ICONS.activity}</button>
                    <button onClick={() => handleDelete(m.id)} className="p-2 hover:bg-red-900 rounded text-red-400" title="Delete">{ICONS.trash}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MonitorDetailPage = ({ monitor: initialMonitor, onBack }) => {
  const [monitor, setMonitor] = useState(initialMonitor);
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [checks, setChecks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [mData, statsData, checksData, incData] = await Promise.all([
        apiCall('GET', `/monitors/${initialMonitor.id}`),
        apiCall('GET', `/monitors/${initialMonitor.id}/sla`),
        apiCall('GET', `/monitors/${initialMonitor.id}/response-history`),
        apiCall('GET', '/incidents'),
      ]);
      if (mData?.monitor) setMonitor(mData.monitor);
      if (statsData) setStats(statsData);
      setChecks(checksData?.history || []);
      setIncidents((incData?.incidents || []).filter(i => i.monitor_id === initialMonitor.id));
      setLoading(false);
    };
    fetchData();
  }, [initialMonitor.id]);

  const runTest = async () => {
    await apiCall('POST', `/monitors/${monitor.id}/test`);
    const mData = await apiCall('GET', `/monitors/${monitor.id}`);
    if (mData?.monitor) setMonitor(mData.monitor);
  };

  const chartData = checks.slice(0, 20).reverse().map(c => ({ time: new Date(c.checked_at).toLocaleTimeString(), response: c.response_time_ms, status: c.status_code }));

  if (loading) return <div className="p-6 flex items-center justify-center min-h-[60vh]"><div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'performance', label: 'Performance' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'history', label: 'Response History' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-400 hover:text-white">{ICONS.chevronLeft}</button>
          <div>
            <h1 className="text-2xl font-bold">{monitor.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-400">{monitor.url}</span>
              <span className={`status-badge ${monitor.is_paused ? 'paused' : monitor.status === 'up' || monitor.status === 'OK' ? 'up' : 'down'}`}>
                <span className={`pulse-dot ${monitor.is_paused ? 'gray' : monitor.status === 'up' || monitor.status === 'OK' ? 'green' : 'red'}`}></span>
                {monitor.is_paused ? 'PAUSED' : (monitor.status || 'UP').toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        <button onClick={runTest} className="btn-primary flex items-center gap-2">{ICONS.zap} Run Test</button>
      </div>

      <div className="flex gap-2 border-b border-gray-800">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card-glass p-6">
            <h3 className="text-sm text-gray-400 mb-2">Current Response</h3>
            <div className="text-3xl font-bold">{monitor.last_check?.response_time_ms || 0}<span className="text-lg text-gray-400">ms</span></div>
            <div className="text-sm text-gray-500 mt-1">Last check: {monitor.last_check?.checked_at ? new Date(monitor.last_check.checked_at).toLocaleString() : 'Never'}</div>
          </div>
          <div className="card-glass p-6">
            <h3 className="text-sm text-gray-400 mb-2">Uptime (30d)</h3>
            <div className="text-3xl font-bold text-green-400">{stats?.current_month_uptime || 100}<span className="text-lg">%</span></div>
            <div className="text-sm text-gray-500 mt-1">SLA Target: {stats?.sla_target || 99.9}%</div>
          </div>
          <div className="card-glass p-6">
            <h3 className="text-sm text-gray-400 mb-2">Status Code</h3>
            <div className="text-3xl font-bold">{monitor.last_check?.status_code || '—'}</div>
            <div className="text-sm text-gray-500 mt-1">Expected: {monitor.expected_status_code || 200}</div>
          </div>
        </div>
      )}

      {tab === 'performance' && (
        <div className="card-glass p-6">
          <h3 className="font-bold mb-4">Response Time (Last 20 Checks)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E" />
              <XAxis dataKey="time" stroke="#6B6B8A" fontSize={12} />
              <YAxis stroke="#6B6B8A" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#0D0D18', border: '1px solid #1A1A2E', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="response" stroke="#00F5FF" strokeWidth={2} dot={{ fill: '#00F5FF', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="p-4 bg-gray-900 rounded-lg text-center">
              <div className="text-xs text-gray-400">Avg Response</div>
              <div className="text-xl font-bold">{Math.round(checks.reduce((a, c) => a + c.response_time_ms, 0) / (checks.length || 1))}ms</div>
            </div>
            <div className="p-4 bg-gray-900 rounded-lg text-center">
              <div className="text-xs text-gray-400">Min Response</div>
              <div className="text-xl font-bold">{Math.min(...checks.map(c => c.response_time_ms)) || 0}ms</div>
            </div>
            <div className="p-4 bg-gray-900 rounded-lg text-center">
              <div className="text-xs text-gray-400">Max Response</div>
              <div className="text-xl font-bold">{Math.max(...checks.map(c => c.response_time_ms)) || 0}ms</div>
            </div>
            <div className="p-4 bg-gray-900 rounded-lg text-center">
              <div className="text-xs text-gray-400">Grade</div>
              <div className="text-xl font-bold">{monitor.last_check?.grade || 'A'}</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'incidents' && (
        <div className="card-glass p-6">
          <h3 className="font-bold mb-4">Recent Incidents</h3>
          <div className="space-y-3">
            {incidents.length === 0 && <p className="text-gray-500">No incidents recorded.</p>}
            {incidents.map(inc => (
              <div key={inc.id} className="p-4 bg-gray-900 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-red-400">{inc.reason || inc.error_message}</span>
                  <span className={`text-xs px-2 py-1 rounded ${inc.is_resolved ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                    {inc.is_resolved ? 'Resolved' : 'Ongoing'}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Started: {inc.started_at || inc.created_at ? new Date(inc.started_at || inc.created_at).toLocaleString() : 'Unknown'}
                  {inc.resolved_at && <> | Resolved: {new Date(inc.resolved_at).toLocaleString()}</>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="card-glass p-6">
          <h3 className="font-bold mb-4">Response History</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="p-3 text-left text-sm text-gray-400">Time</th>
                  <th className="p-3 text-left text-sm text-gray-400">Status</th>
                  <th className="p-3 text-left text-sm text-gray-400">Response Time</th>
                  <th className="p-3 text-left text-sm text-gray-400">Result</th>
                </tr>
              </thead>
              <tbody>
                {checks.map(c => (
                  <tr key={c.id} className="border-t border-gray-800">
                    <td className="p-3 text-sm">{new Date(c.checked_at).toLocaleString()}</td>
                    <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${c.status_code === 200 ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>{c.status_code}</span></td>
                    <td className="p-3 text-sm">{c.response_time_ms}ms</td>
                    <td className="p-3"><span className={c.is_successful ? 'text-green-400' : 'text-red-400'}>{c.is_successful ? 'Success' : 'Failed'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="card-glass p-6">
          <h3 className="font-bold mb-4">Monitor Settings</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input defaultValue={monitor.name} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL</label>
                <input defaultValue={monitor.url} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Interval</label>
                <input type="number" defaultValue={monitor.interval_seconds} className="input-field w-full" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Timeout</label>
                <input type="number" defaultValue={monitor.timeout_seconds} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Expected Status</label>
                <input type="number" defaultValue={monitor.expected_status_code} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Locations</label>
                <div className="text-sm">{Array.isArray(monitor.locations) ? monitor.locations.join(', ') : monitor.locations || 'KE'}</div>
              </div>
            </div>
          </div>
          <button className="btn-primary mt-6">Save Changes</button>
        </div>
      )}
    </div>
  );
};

const StatusPagesPage = ({ user, onNavigate }) => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall('GET', '/status-pages').then(data => {
      setPages(data?.statusPages || []);
      setLoading(false);
    });
  }, []);

  const createPage = async () => {
    const name = prompt('Status page name:');
    if (!name) return;
    const result = await apiCall('POST', '/status-pages', { name, slug: name.toLowerCase().replace(/\s+/g, '-') });
    if (result?.statusPage) setPages([...pages, result.statusPage]);
  };

  if (loading) return <div className="p-6 flex items-center justify-center min-h-[60vh]"><div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Status Pages</h1>
          <p className="text-sm text-gray-400">Public status pages for your services</p>
        </div>
        <button onClick={createPage} className="btn-primary flex items-center gap-2">{ICONS.plus} Create Status Page</button>
      </div>

      {pages.length === 0 && (
        <div className="card-glass p-12 text-center">
          <div className="text-cyan-400 mb-4 flex justify-center">{ICONS.globe}</div>
          <h3 className="text-xl font-bold mb-2">No Status Pages</h3>
          <p className="text-gray-400 mb-6">Create a public status page to show your users the health of your services.</p>
          <button onClick={createPage} className="btn-primary">Create Your First Status Page</button>
        </div>
      )}

      {pages.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map(page => (
            <div key={page.id} className="card-glass p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">{page.name}</h3>
                <span className={`status-badge ${page.isPublished ? 'up' : 'paused'}`}>{page.isPublished ? 'Published' : 'Draft'}</span>
              </div>
              <div className="text-sm text-gray-400 mb-4">/{page.slug}</div>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1 text-sm">Edit</button>
                <button className="btn-ghost flex-1 text-sm">Preview</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ReportsPage = ({ user, onNavigate }) => {
  const [reportType, setReportType] = useState('uptime');
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    const data = await apiCall('GET', `/reports?type=${reportType}&range=${dateRange}`);
    setLoading(false);
    if (data) alert('Report generated! Check your email.');
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-gray-400">Generate detailed reports about your monitoring data</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card-glass p-6">
          <h3 className="font-bold mb-4">Report Type</h3>
          <div className="space-y-3">
            {[
              { id: 'uptime', label: 'Uptime Report', desc: 'Detailed uptime statistics and SLA compliance' },
              { id: 'performance', label: 'Performance Report', desc: 'Response time analysis and trends' },
              { id: 'incidents', label: 'Incident Report', desc: 'All incidents with root cause analysis' },
              { id: 'summary', label: 'Executive Summary', desc: 'High-level overview for stakeholders' },
            ].map(type => (
              <label key={type.id} className={`flex items-start gap-3 p-4 bg-gray-900 rounded-lg cursor-pointer transition-colors ${reportType === type.id ? 'ring-2 ring-cyan-500' : ''}`}>
                <input type="radio" name="reportType" value={type.id} checked={reportType === type.id} onChange={() => setReportType(type.id)} className="mt-1" style={{ accentColor: 'var(--accent-cyan)' }} />
                <div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-sm text-gray-400">{type.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="card-glass p-6">
          <h3 className="font-bold mb-4">Date Range</h3>
          <div className="space-y-3 mb-6">
            {[
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: '90d', label: 'Last 90 Days' },
              { id: 'custom', label: 'Custom Range' },
            ].map(range => (
              <label key={range.id} className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg cursor-pointer">
                <input type="radio" name="dateRange" value={range.id} checked={dateRange === range.id} onChange={() => setDateRange(range.id)} style={{ accentColor: 'var(--accent-cyan)' }} />
                <span>{range.label}</span>
              </label>
            ))}
          </div>
          <button onClick={generateReport} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : ICONS.download}
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      <div className="card-glass p-6">
        <h3 className="font-bold mb-4">Recent Reports</h3>
        <div className="text-center py-8 text-gray-500">
          <p>No reports generated yet. Generate your first report above.</p>
        </div>
      </div>
    </div>
  );
};

const SettingsPage = ({ user, onNavigate }) => {
  const [activeSection, setActiveSection] = useState('profile');
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });

  const sections = [
    { id: 'profile', label: 'Profile', icon: ICONS.home },
    { id: 'notifications', label: 'Notifications', icon: ICONS.bell },
    { id: 'api', label: 'API Keys', icon: ICONS.zap },
    { id: 'team', label: 'Team', icon: ICONS.sharing },
    { id: 'billing', label: 'Billing', icon: ICONS.file },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="flex gap-6">
        <div className="w-64 shrink-0">
          <nav className="space-y-1">
            {sections.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection === s.id ? 'bg-cyan-900/50 text-cyan-400' : 'hover:bg-gray-800 text-gray-400'}`}>
                {s.icon}
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 card-glass p-6">
          {activeSection === 'profile' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Profile Settings</h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Full Name</label>
                  <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} className="input-field w-full" disabled />
                </div>
                <button className="btn-primary">Save Changes</button>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Notification Settings</h2>
              <div className="space-y-4 max-w-md">
                <label className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                  <div>
                    <div className="font-medium">Email Notifications</div>
                    <div className="text-sm text-gray-400">Receive alerts via email</div>
                  </div>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent-cyan)' }} />
                </label>
                <label className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                  <div>
                    <div className="font-medium">SMS Notifications</div>
                    <div className="text-sm text-gray-400">Receive alerts via SMS</div>
                  </div>
                  <input type="checkbox" style={{ accentColor: 'var(--accent-cyan)' }} />
                </label>
                <label className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                  <div>
                    <div className="font-medium">Weekly Digest</div>
                    <div className="text-sm text-gray-400">Weekly summary email</div>
                  </div>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent-cyan)' }} />
                </label>
              </div>
            </div>
          )}

          {activeSection === 'api' && (
            <div>
              <h2 className="text-xl font-bold mb-6">API Keys</h2>
              <div className="mb-6">
                <p className="text-gray-400 mb-4">API keys allow you to access PulseGrid programmatically. Keep your keys secure and never share them publicly.</p>
                <button className="btn-primary">Generate New API Key</button>
              </div>
              <div className="p-4 bg-gray-900 rounded-lg">
                <div className="text-sm text-gray-400">No API keys generated yet.</div>
              </div>
            </div>
          )}

          {activeSection === 'team' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Team Members</h2>
              <p className="text-gray-400">Invite team members to collaborate on your monitors.</p>
              <div className="mt-4 p-8 border-2 border-dashed border-gray-800 rounded-lg text-center">
                <p className="text-gray-500">Upgrade to invite team members</p>
              </div>
            </div>
          )}

          {activeSection === 'billing' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Billing</h2>
              <div className="card-glass p-6 border border-cyan-900 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold">Current Plan: Free</h3>
                    <p className="text-sm text-gray-400">5 monitors, 3 locations</p>
                  </div>
                  <button className="btn-primary">Upgrade</button>
                </div>
              </div>
              <h3 className="font-bold mb-4">Plan Comparison</h3>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { name: 'Free', price: '$0', monitors: '5', features: ['3 locations', 'Email alerts'] },
                  { name: 'Starter', price: '$9', monitors: '20', features: ['10 locations', 'SMS alerts', 'Reports'] },
                  { name: 'Pro', price: '$29', monitors: '100', features: ['All locations', 'Slack/Discord', 'Team', 'Priority support'] },
                ].map(plan => (
                  <div key={plan.name} className={`p-6 rounded-lg border ${plan.name === 'Free' ? 'border-cyan-500 bg-cyan-900/20' : 'border-gray-700 bg-gray-900'}`}>
                    <h4 className="font-bold text-lg">{plan.name}</h4>
                    <div className="text-2xl font-bold my-2">{plan.price}<span className="text-sm text-gray-400">/mo</span></div>
                    <div className="text-sm text-gray-400 mb-4">{plan.monitors} monitors</div>
                    <ul className="space-y-2 text-sm">
                      {plan.features.map(f => <li key={f} className="flex items-center gap-2">{ICONS.check}<span>{f}</span></li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [page, setPage] = useState('landing');
  const [pageParams, setPageParams] = useState(null);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('pulsegrid_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('pulsegrid_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setPage('dashboard');
    }
    setTimeout(() => setLoading(false), 800);
  }, []);

  const handleAuth = (type) => setPage(type);
  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('pulsegrid_user', JSON.stringify(userData));
    setPage('dashboard');
    setToast({ type: 'success', message: `Welcome to PulseGrid, ${userData.name}!` });
  };
  const handleLogout = () => {
    localStorage.removeItem('pulsegrid_user');
    setUser(null);
    setPage('landing');
  };
  const navigate = (pageName, params) => {
    setPage(pageName);
    setPageParams(params);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="grid-bg" />
      <div className="scanline" />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {page === 'landing' && <LandingPage onAuth={handleAuth} />}
      {(page === 'login' || page === 'signup') && <AuthPage type={page} onAuth={handleLogin} onBack={() => handleAuth('landing')} />}
      {user && page !== 'landing' && page !== 'login' && page !== 'signup' && (
        <div className="flex">
          <aside className="sidebar">
            <div className="p-4 border-b border-gray-800 flex items-center gap-2">
              {ICONS.radio}
              <span className="text-xl font-bold" style={{ fontFamily: 'Syne' }}>PulseGrid</span>
            </div>
            <nav className="p-2">
              {[
                { icon: ICONS.home, label: 'Dashboard', page: 'dashboard' },
                { icon: ICONS.activity, label: 'Monitors', page: 'monitors' },
                { icon: ICONS.plus, label: 'Add Monitor', page: 'add-monitor' },
                { icon: ICONS.globe, label: 'Status Pages', page: 'status-pages' },
                { icon: ICONS.file, label: 'Reports', page: 'reports' },
                { icon: ICONS.settings, label: 'Settings', page: 'settings' },
              ].map((item, i) => (
                <button key={i} onClick={() => navigate(item.page)} className={`sidebar-item w-full ${page === item.page ? 'active' : ''}`}>
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="absolute bottom-4 left-0 right-0 px-2">
              <button onClick={handleLogout} className="sidebar-item w-full text-red-400 hover:text-red-300">{ICONS.x}<span>Logout</span></button>
            </div>
          </aside>
          <main className="flex-1 md:ml-60">
            <header className="sticky top-0 z-30 bg-black border-b border-gray-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold capitalize">{page}</h2>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-900 border border-cyan-700">
                  <span className="text-xs text-cyan-400">Free</span>
                </div>
              </div>
            </header>
            <div className="pb-20">
              {page === 'dashboard' && <Dashboard user={user} onNavigate={navigate} />}
              {page === 'monitors' && <MonitorsPage user={user} onNavigate={navigate} />}
              {page === 'add-monitor' && <AddMonitorPage onSave={(data) => { setToast({ type: 'success', message: '[OK] Monitor created!' }); navigate('monitors'); }} onBack={() => navigate('monitors')} />}
              {page === 'monitor-detail' && <MonitorDetailPage monitor={pageParams} onBack={() => navigate('monitors')} />}
              {page === 'status-pages' && <StatusPagesPage user={user} onNavigate={navigate} />}
              {page === 'reports' && <ReportsPage user={user} onNavigate={navigate} />}
              {page === 'settings' && <SettingsPage user={user} onNavigate={navigate} />}
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
