// Firebase imports (loaded from CDN)
const { useState, useEffect } = React;
const { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = Recharts;

// Firebase configuration - Replace with your Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
let app, auth, db;
if (typeof firebase !== 'undefined') {
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
}

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
  chevronLeft: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>,
  download: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  zap: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  trash: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  radio: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>,
  pause: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
};

const generateChartData = () => Array.from({ length: 24 }, (_, i) => ({ time: `${i}:00`, Kenya: Math.floor(Math.random() * 200) + 100, Germany: Math.floor(Math.random() * 180) + 120, USA: Math.floor(Math.random() * 220) + 80 }));

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

    try {
      if (type === 'signup') {
        const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(result.user.uid).set({
          email, full_name: name, plan: 'free', createdAt: new Date()
        });
        onAuth({ uid: result.user.uid, email, name, plan: 'free' });
      } else {
        const result = await firebase.auth().signInWithEmailAndPassword(email, password);
        const doc = await db.collection('users').doc(result.user.uid).get();
        const userData = doc.data() || { email, name: email.split('@')[0] };
        onAuth({ uid: result.user.uid, email, ...userData });
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
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
      try {
        const mSnap = await db.collection('monitors').where('userId', '==', user.uid).get();
        const monitorsList = mSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMonitors(monitorsList);

        const iSnap = await db.collection('incidents').get();
        const incidentsList = iSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(i => monitorsList.some(m => m.id === i.monitorId));
        setIncidents(incidentsList);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
      setChartData(generateChartData());
      setLoading(false);
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [user.uid]);

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

  const upCount = monitors.filter(m => m.status === 'up').length;
  const downCount = monitors.filter(m => m.status === 'down').length;

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
          { label: 'Avg Response', value: '—', color: 'amber', icon: ICONS.zap },
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
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Active Monitors</h3>
            <button onClick={() => onNavigate('monitors')} className="text-sm text-cyan-400">View all</button>
          </div>
          <div className="space-y-3">
            {monitors.slice(0, 4).map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-gray-500">{m.url}</div>
                </div>
                <span className={`status-badge ${m.status === 'up' ? 'up' : 'down'}`}>
                  <span className={`pulse-dot ${m.status === 'up' ? 'green' : 'red'}`}></span>
                  {(m.status || 'UP').toUpperCase()}
                </span>
              </div>
            ))}
            {monitors.length === 0 && <p className="text-gray-500 text-sm">No monitors yet. Add your first one!</p>}
          </div>
        </div>

        <div className="card-glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Recent Incidents</h3>
          </div>
          <div className="space-y-3">
            {incidents.slice(0, 3).map(inc => (
              <div key={inc.id} className="p-3 bg-gray-900 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{inc.reason}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${inc.isResolved ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                    {inc.isResolved ? 'resolved' : 'ongoing'}
                  </span>
                </div>
              </div>
            ))}
            {incidents.length === 0 && <p className="text-gray-500 text-sm">No incidents recorded.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const AddMonitorPage = ({ user, onSave, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', url: '', method: 'GET', interval: 60, timeout: 30 });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const docRef = await db.collection('monitors').add({
        userId: user.uid,
        name: formData.name,
        url: formData.url,
        method: formData.method,
        interval: formData.interval,
        timeout: formData.timeout,
        status: 'up',
        isPaused: false,
        isActive: true,
        createdAt: new Date()
      });
      onSave({ id: docRef.id, ...formData, status: 'up' });
    } catch (err) {
      console.error('Error creating monitor:', err);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6">{ICONS.chevronLeft} Back</button>
      <h1 className="text-2xl font-bold mb-6">Add New Monitor</h1>
      <div className="card-glass p-6 space-y-6">
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
        <button onClick={handleSubmit} disabled={loading || !formData.name || !formData.url} className="btn-primary px-6 py-3">{loading ? 'Creating...' : 'Create Monitor'}</button>
      </div>
    </div>
  );
};

const MonitorsPage = ({ user, onNavigate }) => {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchMonitors = async () => {
      try {
        const snap = await db.collection('monitors').where('userId', '==', user.uid).get();
        setMonitors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Error:', err);
      }
      setLoading(false);
    };
    fetchMonitors();
  }, [user.uid]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this monitor?')) return;
    await db.collection('monitors').doc(id).delete();
    setMonitors(monitors.filter(m => m.id !== id));
  };

  const handlePause = async (id) => {
    const m = monitors.find(x => x.id === id);
    await db.collection('monitors').doc(id).update({ isPaused: !m.isPaused });
    setMonitors(monitors.map(x => x.id === id ? { ...x, isPaused: !x.isPaused } : x));
  };

  const filtered = monitors.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || m.status === filter || (filter === 'paused' && m.isPaused);
    return matchSearch && matchFilter;
  });

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

      <div className="flex flex-col md:flex-row gap-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search monitors..." className="input-field flex-1" />
        <select value={filter} onChange={e => setFilter(e.target.value)} className="input-field">
          <option value="all">All Status</option>
          <option value="up">Up</option>
          <option value="down">Down</option>
          <option value="paused">Paused</option>
        </select>
      </div>

      <div className="card-glass overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="p-4 text-left text-sm text-gray-400">Monitor</th>
              <th className="p-4 text-left text-sm text-gray-400">Status</th>
              <th className="p-4 text-left text-sm text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan="3" className="p-8 text-center text-gray-500">No monitors found</td></tr>}
            {filtered.map(m => (
              <tr key={m.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                <td className="p-4">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-gray-500">{m.url}</div>
                </td>
                <td className="p-4">
                  <span className={`status-badge ${m.isPaused ? 'paused' : m.status === 'up' ? 'up' : 'down'}`}>
                    <span className={`pulse-dot ${m.isPaused ? 'gray' : m.status === 'up' ? 'green' : 'red'}`}></span>
                    {m.isPaused ? 'PAUSED' : (m.status || 'UP').toUpperCase()}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button onClick={() => handlePause(m.id)} className="p-2 hover:bg-gray-800 rounded" title={m.isPaused ? 'Resume' : 'Pause'}>{m.isPaused ? ICONS.radio : ICONS.pause}</button>
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

const StatusPagesPage = ({ user, onNavigate }) => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const snap = await db.collection('statusPages').where('userId', '==', user.uid).get();
        setPages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Error:', err);
      }
      setLoading(false);
    };
    fetchPages();
  }, [user.uid]);

  const createPage = async () => {
    const name = prompt('Status page name:');
    if (!name) return;
    const docRef = await db.collection('statusPages').add({
      userId: user.uid,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      isPublished: false,
      createdAt: new Date()
    });
    setPages([...pages, { id: docRef.id, name, slug: name.toLowerCase().replace(/\s+/g, '-'), isPublished: false }]);
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ReportsPage = ({ user, onNavigate }) => (
  <div className="p-6 space-y-6">
    <div>
      <h1 className="text-2xl font-bold">Reports</h1>
      <p className="text-sm text-gray-400">Generate detailed reports about your monitoring data</p>
    </div>
    <div className="card-glass p-12 text-center">
      <div className="text-cyan-400 mb-4 flex justify-center">{ICONS.file}</div>
      <h3 className="text-xl font-bold mb-2">Reports Coming Soon</h3>
      <p className="text-gray-400">Detailed uptime and performance reports will be available soon.</p>
    </div>
  </div>
);

const SettingsPage = ({ user, onNavigate }) => {
  const [activeSection, setActiveSection] = useState('profile');

  const sections = [
    { id: 'profile', label: 'Profile', icon: ICONS.home },
    { id: 'notifications', label: 'Notifications', icon: ICONS.bell },
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
                  <input defaultValue={user.name} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input defaultValue={user.email} className="input-field w-full" disabled />
                </div>
                <button className="btn-primary">Save Changes</button>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Notification Settings</h2>
              <p className="text-gray-400">Notification settings coming soon.</p>
            </div>
          )}

          {activeSection === 'billing' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Billing</h2>
              <div className="card-glass p-6 border border-cyan-900 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold">Current Plan: Free</h3>
                    <p className="text-sm text-gray-400">5 monitors, unlimited checks</p>
                  </div>
                  <button className="btn-primary">Upgrade</button>
                </div>
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
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('pulsegrid_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
      firebase.auth().onAuthStateChanged((firebaseUser) => {
        if (firebaseUser) {
          db.collection('users').doc(firebaseUser.uid).get().then(doc => {
            const userData = doc.data() || { email: firebaseUser.email, name: firebaseUser.email.split('@')[0] };
            const userObj = { uid: firebaseUser.uid, email: firebaseUser.email, ...userData };
            setUser(userObj);
            localStorage.setItem('pulsegrid_user', JSON.stringify(userObj));
            setPage('dashboard');
          });
        } else {
          setUser(null);
          localStorage.removeItem('pulsegrid_user');
        }
        setLoading(false);
      });
    } else {
      setTimeout(() => setLoading(false), 1000);
    }
  }, []);

  const handleAuth = (type) => setPage(type);
  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('pulsegrid_user', JSON.stringify(userData));
    setPage('dashboard');
    setToast({ type: 'success', message: `Welcome to PulseGrid, ${userData.name || userData.email}!` });
  };
  const handleLogout = async () => {
    if (typeof firebase !== 'undefined') await firebase.auth().signOut();
    localStorage.removeItem('pulsegrid_user');
    setUser(null);
    setPage('landing');
  };
  const navigate = (pageName) => setPage(pageName);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

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
              {page === 'add-monitor' && <AddMonitorPage user={user} onSave={() => { setToast({ type: 'success', message: '[OK] Monitor created!' }); navigate('monitors'); }} onBack={() => navigate('monitors')} />}
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
