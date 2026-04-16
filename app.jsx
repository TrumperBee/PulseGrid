// Firebase imports (loaded from CDN)
const { useState, useEffect, createContext, useContext } = React;
const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = Recharts;

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
};

// Generate chart data
const generateChartData = () => Array.from({ length: 24 }, (_, i) => ({ time: `${i}:00`, Kenya: Math.floor(Math.random() * 200) + 100, Germany: Math.floor(Math.random() * 180) + 120, USA: Math.floor(Math.random() * 220) + 80 }));

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
        <p className="text-sm text-gray-500 mb-8">Click the link in your email to activate your account.</p>
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
      try { await user.sendEmailVerification(); } catch (e) {}
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
      toast('success', 'Password reset email sent to ' + email);
    } catch (error) {
      toast('error', 'Failed to send reset email');
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
              <p className="text-gray-400 mb-6">Check your inbox for a reset link.</p>
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

  useEffect(() => {
    if (!auth.currentUser) return;
    const loadData = async () => {
      try {
        const mSnap = await db.collection('monitors').where('userId', '==', auth.currentUser.uid).orderBy('createdAt', 'desc').get();
        const monitorsList = mSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMonitors(monitorsList);
        const up = monitorsList.filter(m => m.status === 'up').length;
        const down = monitorsList.filter(m => m.status === 'down').length;
        setStats({ total: monitorsList.length, up, down, avgResponse: monitorsList.length > 0 ? Math.round(monitorsList.reduce((a, m) => a + (m.avgResponseMs || 0), 0) / monitorsList.length) : 0 });
        const iSnap = await db.collection('incidents').where('userId', '==', auth.currentUser.uid).orderBy('createdAt', 'desc').limit(10).get();
        setIncidents(iSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) { console.error('Error loading data:', err); }
      setChartData(generateChartData());
      setLoading(false);
    };
    loadData();
    const unsubscribe = db.collection('monitors').where('userId', '==', auth.currentUser.uid).onSnapshot((snapshot) => {
      const monitorsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMonitors(monitorsList);
      const up = monitorsList.filter(m => m.status === 'up').length;
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
        <button onClick={() => navigate('add-monitor')} className="btn-primary flex items-center gap-2">{ICONS.plus} Add Monitor</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ label: 'Total Monitors', value: stats.total, icon: ICONS.activity }, { label: 'Up', value: stats.up, icon: ICONS.check }, { label: 'Down', value: stats.down, icon: ICONS.x }, { label: 'Avg Response', value: stats.avgResponse ? `${stats.avgResponse}ms` : '—', icon: ICONS.zap }].map((s, i) => (
          <div key={i} className="card-glass p-4">
            <div className="flex items-center gap-3 mb-2"><span className="text-gray-400">{s.icon}</span><span className="text-sm text-gray-400">{s.label}</span></div>
            <div className="text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>
      {stats.down > 0 && <div className="card-glass p-5 alert-banner border border-red-900"><div className="flex items-center gap-3"><span className="text-red-400">{ICONS.activity}</span><span className="font-bold text-red-400">{stats.down} monitor(s) experiencing issues</span></div></div>}
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
          <div className="flex items-center justify-between mb-4"><h3 className="font-bold">Active Monitors</h3><button onClick={() => navigate('monitors')} className="text-sm text-cyan-400">View all</button></div>
          <div className="space-y-3">
            {monitors.slice(0, 4).map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <div><div className="font-medium">{m.name}</div><div className="text-xs text-gray-500">{m.url}</div></div>
                <span className={`status-badge ${m.status === 'up' ? 'up' : 'down'}`}><span className={`pulse-dot ${m.status === 'up' ? 'green' : 'red'}`}></span>{(m.status || 'UP').toUpperCase()}</span>
              </div>
            ))}
            {monitors.length === 0 && <p className="text-gray-500 text-sm">No monitors yet. Add your first one!</p>}
          </div>
        </div>
        <div className="card-glass p-6">
          <div className="flex items-center justify-between mb-4"><h3 className="font-bold">Recent Incidents</h3></div>
          <div className="space-y-3">
            {incidents.slice(0, 3).map(inc => (
              <div key={inc.id} className="p-3 bg-gray-900 rounded-lg">
                <div className="flex items-center justify-between"><span className="font-medium text-sm">{inc.reason}</span><span className={`text-xs px-2 py-0.5 rounded ${inc.isResolved ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>{inc.isResolved ? 'resolved' : 'ongoing'}</span></div>
              </div>
            ))}
            {incidents.length === 0 && <p className="text-gray-500 text-sm">No incidents recorded.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

// Add Monitor Page
const AddMonitorPage = () => {
  const { toast, navigate } = useContext(NavigationContext);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', url: '', method: 'GET', interval: 60 });

  const handleSubmit = async () => {
    if (!formData.name || !formData.url) { toast('error', 'Please fill in required fields'); return; }
    setLoading(true);
    try {
      await db.collection('monitors').add({
        userId: auth.currentUser.uid, name: formData.name, url: formData.url, method: formData.method,
        intervalSeconds: formData.interval, status: 'up', isPaused: false, isActive: true,
        uptimePercentage: 100, avgResponseMs: 0, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      toast('success', 'Monitor created successfully!');
      navigate('monitors');
    } catch (err) { toast('error', 'Failed to create monitor'); }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => navigate('monitors')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6">{ICONS.chevronLeft} Back</button>
      <h1 className="text-2xl font-bold mb-6">Add New Monitor</h1>
      <div className="card-glass p-6 space-y-6">
        <div><label className="block text-sm text-gray-400 mb-1">Monitor Name *</label><input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input-field" placeholder="My API Health Check" /></div>
        <div><label className="block text-sm text-gray-400 mb-1">URL to Monitor *</label><input value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} className="input-field" placeholder="https://api.example.com/health" /></div>
        <div><label className="block text-sm text-gray-400 mb-1">HTTP Method</label><select value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value })} className="input-field"><option>GET</option><option>POST</option><option>HEAD</option></select></div>
        <div><label className="block text-sm text-gray-400 mb-1">Check Interval: {formData.interval}s</label><input type="range" min="30" max="300" value={formData.interval} onChange={e => setFormData({ ...formData, interval: parseInt(e.target.value) })} className="w-full" /></div>
        <button onClick={handleSubmit} disabled={loading || !formData.name || !formData.url} className="btn-primary px-6 py-3 flex items-center justify-center gap-2">{loading ? <Spinner /> : 'Create Monitor'}</button>
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

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = db.collection('monitors').where('userId', '==', auth.currentUser.uid).orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
      setMonitors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id) => { if (!confirm('Delete this monitor?')) return; await db.collection('monitors').doc(id).delete(); toast('success', 'Monitor deleted'); };
  const handlePause = async (id) => { const m = monitors.find(x => x.id === id); await db.collection('monitors').doc(id).update({ isPaused: !m.isPaused }); };
  const filtered = monitors.filter(m => { const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()); const matchFilter = filter === 'all' || m.status === filter || (filter === 'paused' && m.isPaused); return matchSearch && matchFilter; });

  if (loading) return <div className="p-6 flex items-center justify-center min-h-[60vh]"><div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Monitors</h1><p className="text-sm text-gray-400">{monitors.length} total monitors</p></div></div>
      <div className="flex flex-col md:flex-row gap-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search monitors..." className="input-field flex-1" />
        <select value={filter} onChange={e => setFilter(e.target.value)} className="input-field"><option value="all">All Status</option><option value="up">Up</option><option value="down">Down</option><option value="paused">Paused</option></select>
      </div>
      <div className="card-glass overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900"><tr><th className="p-4 text-left text-sm text-gray-400">Monitor</th><th className="p-4 text-left text-sm text-gray-400">Status</th><th className="p-4 text-left text-sm text-gray-400">Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan="3" className="p-8 text-center text-gray-500">No monitors found</td></tr>}
            {filtered.map(m => (
              <tr key={m.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                <td className="p-4"><div className="font-medium">{m.name}</div><div className="text-xs text-gray-500">{m.url}</div></td>
                <td className="p-4"><span className={`status-badge ${m.isPaused ? 'paused' : m.status === 'up' ? 'up' : 'down'}`}><span className={`pulse-dot ${m.isPaused ? 'gray' : m.status === 'up' ? 'green' : 'red'}`}></span>{m.isPaused ? 'PAUSED' : (m.status || 'UP').toUpperCase()}</span></td>
                <td className="p-4"><div className="flex gap-2"><button onClick={() => handlePause(m.id)} className="p-2 hover:bg-gray-800 rounded">{m.isPaused ? ICONS.radio : ICONS.pause}</button><button onClick={() => handleDelete(m.id)} className="p-2 hover:bg-red-900 rounded text-red-400">{ICONS.trash}</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Status Pages Page
const StatusPagesPage = () => {
  const { toast } = useContext(NavigationContext);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = db.collection('statusPages').where('userId', '==', auth.currentUser.uid).orderBy('createdAt', 'desc').onSnapshot((snapshot) => { setPages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); });
    return () => unsubscribe();
  }, []);

  const createPage = async () => {
    const name = prompt('Status page name:');
    if (!name) return;
    await db.collection('statusPages').add({ userId: auth.currentUser.uid, name, slug: name.toLowerCase().replace(/\s+/g, '-'), isPublished: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    toast('success', 'Status page created!');
  };

  if (loading) return <div className="p-6 flex items-center justify-center min-h-[60vh]"><div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Status Pages</h1><p className="text-sm text-gray-400">Public status pages for your services</p></div><button onClick={createPage} className="btn-primary flex items-center gap-2">{ICONS.plus} Create Status Page</button></div>
      {pages.length === 0 && <div className="card-glass p-12 text-center"><div className="text-cyan-400 mb-4 flex justify-center">{ICONS.globe}</div><h3 className="text-xl font-bold mb-2">No Status Pages</h3><p className="text-gray-400 mb-6">Create a public status page to show your users the health of your services.</p><button onClick={createPage} className="btn-primary">Create Your First Status Page</button></div>}
      {pages.length > 0 && <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{pages.map(page => (<div key={page.id} className="card-glass p-6"><div className="flex items-center justify-between mb-4"><h3 className="font-bold">{page.name}</h3><span className={`status-badge ${page.isPublished ? 'up' : 'paused'}`}>{page.isPublished ? 'Published' : 'Draft'}</span></div><div className="text-sm text-gray-400 mb-4">/{page.slug}</div></div>))}</div>}
    </div>
  );
};

// Reports Page
const ReportsPage = () => (
  <div className="p-6 space-y-6">
    <div><h1 className="text-2xl font-bold">Reports</h1><p className="text-sm text-gray-400">Generate detailed reports about your monitoring data</p></div>
    <div className="card-glass p-12 text-center"><div className="text-cyan-400 mb-4 flex justify-center">{ICONS.file}</div><h3 className="text-xl font-bold mb-2">Reports Coming Soon</h3><p className="text-gray-400">Detailed uptime and performance reports will be available soon.</p></div>
  </div>
);

// Settings Page
const SettingsPage = () => {
  const { toast, userData, setUserData } = useContext(NavigationContext);
  const [activeSection, setActiveSection] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(userData?.fullName || '');
  const [companyName, setCompanyName] = useState(userData?.companyName || '');

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await db.collection('users').doc(auth.currentUser.uid).update({ fullName, companyName });
      setUserData({ ...userData, fullName, companyName });
      toast('success', 'Profile updated successfully!');
    } catch (err) { toast('error', 'Failed to update profile'); }
    setLoading(false);
  };

  const handleLogout = async () => { if (!confirm('Are you sure you want to log out?')) return; await auth.signOut(); toast('success', 'You have been logged out.'); };

  const sections = [{ id: 'profile', label: 'Profile', icon: ICONS.user }, { id: 'notifications', label: 'Notifications', icon: ICONS.bell }, { id: 'account', label: 'Account', icon: ICONS.settings }];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="flex gap-6">
        <div className="w-64 shrink-0"><nav className="space-y-1">{sections.map(s => (<button key={s.id} onClick={() => setActiveSection(s.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection === s.id ? 'bg-cyan-900/50 text-cyan-400' : 'hover:bg-gray-800 text-gray-400'}`}>{s.icon}<span>{s.label}</span></button>))}</nav></div>
        <div className="flex-1 card-glass p-6">
          {activeSection === 'profile' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Profile Settings</h2>
              <div className="space-y-4 max-w-md">
                <div><label className="block text-sm text-gray-400 mb-1">Full Name</label><input value={fullName} onChange={e => setFullName(e.target.value)} className="input-field w-full" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Company</label><input value={companyName} onChange={e => setCompanyName(e.target.value)} className="input-field w-full" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Email</label><input value={auth.currentUser?.email || ''} className="input-field w-full" disabled /></div>
                <button onClick={handleSaveProfile} disabled={loading} className="btn-primary flex items-center gap-2">{loading ? <Spinner /> : 'Save Changes'}</button>
              </div>
            </div>
          )}
          {activeSection === 'notifications' && <div><h2 className="text-xl font-bold mb-6">Notification Settings</h2><p className="text-gray-400">Notification settings coming soon.</p></div>}
          {activeSection === 'account' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Account</h2>
              <div className="space-y-4">
                <div className="p-4 bg-gray-900 rounded-lg"><div className="text-sm text-gray-400 mb-1">Plan</div><div className="font-bold text-cyan-400">{userData?.plan?.toUpperCase() || 'FREE'}</div><p className="text-xs text-gray-500 mt-1">Pro features enabled during beta</p></div>
                <button onClick={handleLogout} className="btn-ghost text-red-400 hover:text-red-300 flex items-center gap-2">{ICONS.x} Log Out</button>
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

  const toast = (type, message) => setToastData({ type, message });
  const navigate = (page) => setCurrentPage(page);

  const contextValue = { toast, navigate, userData, setUserData, auth, db };

  useEffect(() => {
    if (typeof firebase === 'undefined') { setTimeout(() => setLoading(false), 1000); return; }

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const doc = await db.collection('users').doc(user.uid).get();
          if (doc.exists) { userData = doc.data(); setUserData(userData); }
          else {
            await db.collection('users').doc(user.uid).set({
              uid: user.uid, email: user.email, fullName: user.displayName || '', companyName: '',
              plan: 'pro', createdAt: firebase.firestore.FieldValue.serverTimestamp(), avatarUrl: user.photoURL || '', emailVerified: user.emailVerified
            });
            userData = { uid: user.uid, email: user.email, fullName: user.displayName || '', plan: 'pro' };
            setUserData(userData);
          }
        } catch (err) { console.error('Error loading user data:', err); }
        setCurrentPage('dashboard');
      } else {
        userData = null; setUserData(null);
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
        {currentPage === 'landing' && !isLoggedIn && <LandingPage />}
        {(currentPage === 'login' || currentPage === 'signup') && !isLoggedIn && <AuthPage initialTab={currentPage} />}
        {currentPage === 'verify-email' && auth.currentUser && <EmailVerificationScreen email={auth.currentUser.email} onResend={handleResendVerification} onContinue={handleVerifyContinue} onBack={() => auth.signOut()} resendCooldown={resendCooldown} />}
        {showApp && (
          <div className="flex">
            <aside className="sidebar">
              <div className="p-4 border-b border-gray-800 flex items-center gap-2">{ICONS.radio}<span className="text-xl font-bold" style={{ fontFamily: 'Syne' }}>PulseGrid</span></div>
              <nav className="p-2">
                {[{ icon: ICONS.home, label: 'Dashboard', page: 'dashboard' }, { icon: ICONS.activity, label: 'Monitors', page: 'monitors' }, { icon: ICONS.plus, label: 'Add Monitor', page: 'add-monitor' }, { icon: ICONS.globe, label: 'Status Pages', page: 'status-pages' }, { icon: ICONS.file, label: 'Reports', page: 'reports' }, { icon: ICONS.settings, label: 'Settings', page: 'settings' }].map(item => (
                  <button key={item.page} onClick={() => setCurrentPage(item.page)} className={`sidebar-item w-full ${currentPage === item.page ? 'active' : ''}`}>{item.icon}<span>{item.label}</span></button>
                ))}
              </nav>
            </aside>
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
                {currentPage === 'settings' && <SettingsPage />}
              </div>
            </main>
          </div>
        )}
      </div>
    </NavigationContext.Provider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
