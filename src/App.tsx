import { useState, useCallback, useEffect } from 'react';
import { Database, Eye, EyeOff, Key, RefreshCw, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Info, XCircle, LogOut, Clock } from 'lucide-react';
import type { DataRow } from './types';
import { parseFile } from './utils/fileParser';
import FileUpload from './components/FileUpload';
import DataGrid from './components/DataGrid';
import CleansingModule from './components/CleansingModule';
import AIStandardizeModule, { type AIProvider } from './components/AIStandardizeModule';
import PivotExportModule from './components/PivotExportModule';
import DatabaseLog from './components/DatabaseLog';
import AdminUserManagement from './components/AdminUserManagement';
import { logAttachedFile, getSupabaseConfig, updateSupabaseConfig, DUMMY_USERS, type DummyUser, syncUserToDatabase, getDatabaseUsers, getSupabaseClient } from './utils/db';

const providerLabels: Record<AIProvider, string> = {
  groq: 'Groq',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google AI',
};

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error' | 'warning';
}

export default function App() {
  const [data, setData] = useState<DataRow[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<AIProvider, string>>({
    groq: '',
    openai: '',
    anthropic: '',
    gemini: '',
  });
  const [showKeys, setShowKeys] = useState(false);
  const [keysExpanded, setKeysExpanded] = useState(false);
  const [refreshDbTrigger, setRefreshDbTrigger] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [users, setUsers] = useState<DummyUser[]>(() => {
    const saved = localStorage.getItem('datacleanse_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as DummyUser[];
        // Merge with default DUMMY_USERS to ensure properties (like status/isAdmin) are populated
        return DUMMY_USERS.map((defaultUser) => {
          const match = parsed.find((u) => u.email.toLowerCase() === defaultUser.email.toLowerCase());
          if (match) {
            return {
              ...match,
              isAdmin: defaultUser.isAdmin,
              status: match.status || defaultUser.status || 'approved',
            };
          }
          return defaultUser;
        }).concat(
          parsed.filter((p) => !DUMMY_USERS.some((d) => d.email.toLowerCase() === p.email.toLowerCase()))
        );
      } catch {
        return DUMMY_USERS;
      }
    }
    return DUMMY_USERS;
  });

  const [currentUser, setCurrentUser] = useState<DummyUser | null>(() => {
    const saved = localStorage.getItem('datacleanse_current_user');
    if (saved) {
      try {
        const user = JSON.parse(saved) as DummyUser;
        // Verify user still exists in the local database and is approved
        const savedUsers = localStorage.getItem('datacleanse_users');
        const allUsers = savedUsers ? (JSON.parse(savedUsers) as DummyUser[]) : DUMMY_USERS;
        const match = allUsers.find((u) => u.email.toLowerCase() === user.email.toLowerCase());
        if (match && (match.status || 'approved') === 'approved') {
          return match;
        }
      } catch {
        return null;
      }
    }
    return null;
  });

  const [dbConfig, setDbConfig] = useState(() => getSupabaseConfig());

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);

  // Signup fields
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupCompany, setSignupCompany] = useState('');
  const [signupRole, setSignupRole] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupError, setSignupError] = useState<string | null>(null);

  const [authState, setAuthState] = useState<'signin' | 'signup' | 'forgot_email' | 'forgot_reset' | 'forgot_success' | 'signup_pending'>('signin');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  const userIdentity = currentUser
    ? `${currentUser.name} (${currentUser.company}) <${currentUser.email}>`
    : 'Guest User';

  const isSupabaseConnected = !!getSupabaseClient();

  useEffect(() => {
    async function loadRemoteUsers() {
      try {
        const dbUsers = await getDatabaseUsers();
        if (dbUsers && dbUsers.length > 0) {
          setUsers((prev) => {
            const merged = [...prev];
            for (const dUser of dbUsers) {
              const idx = merged.findIndex((u) => u.email.toLowerCase() === dUser.email.toLowerCase());
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...dUser };
              } else {
                merged.push(dUser);
              }
            }
            localStorage.setItem('datacleanse_users', JSON.stringify(merged));
            return merged;
          });
        }
      } catch (e) {
        console.error('Failed to load database users', e);
      }
    }
    loadRemoteUsers();
  }, []);

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const updateApiKey = useCallback((provider: AIProvider, key: string) => {
    setApiKeys((prev) => ({ ...prev, [provider]: key }));
    showToast(`${providerLabels[provider]} API Key saved.`, 'info');
  }, [showToast]);

  const hasAnyApiKey = useCallback(() => {
    return Object.values(apiKeys).some((k) => k.trim().length > 0);
  }, [apiKeys]);

  const reset = useCallback(() => {
    setData(null);
    setColumns([]);
    setFileName('');
    setFileError(null);
    showToast('Workspace reset successfully.', 'info');
  }, [showToast]);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setFileError(null);
    try {
      const { rows, columns: cols } = await parseFile(file);
      setData(rows);
      setColumns(cols);
      setFileName(file.name);
      await logAttachedFile(file.name, file.size, rows.length, cols.length, userIdentity, rows);
      setRefreshDbTrigger((prev) => prev + 1);
      showToast(`Ingested ${file.name} successfully! (${rows.length.toLocaleString()} rows, ${cols.length} cols)`, 'success');
    } catch (e: unknown) {
      setFileError(e instanceof Error ? e.message : 'Failed to parse file');
      showToast(e instanceof Error ? e.message : 'Failed to parse file', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, userIdentity]);

  function handleCleansingApply(updated: DataRow[]) {
    const origCount = data?.length || 0;
    const removedCount = origCount - updated.length;
    setData(updated);
    if (removedCount > 0) {
      showToast(`Deterministic cleansing applied successfully! Removed ${removedCount.toLocaleString()} duplicate row(s).`, 'success');
    } else {
      showToast('Deterministic cleansing & normalization applied successfully!', 'success');
    }
  }

  function handleAIApply(updated: DataRow[], newCols: string[]) {
    setData(updated);
    setColumns((prev) => {
      const newSet = new Set(prev);
      for (const col of newCols) {
        if (!newSet.has(col)) {
          newSet.add(col);
        }
      }
      return Array.from(newSet);
    });
    showToast(`AI aligned taxonomy completed! Appended new columns: ${newCols.join(', ')}`, 'success');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const cleanInput = emailInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();

    let currentUsersList = [...users];

    let match = currentUsersList.find(
      (u) =>
        (u.email.toLowerCase() === cleanInput ||
         u.name.toLowerCase() === cleanInput) &&
        u.passwordHash === cleanPass
    );

    // If not found in current local state, attempt to fetch fresh profiles from database (e.g. registered on another machine)
    if (!match) {
      try {
        const remoteUsers = await getDatabaseUsers();
        if (remoteUsers && remoteUsers.length > 0) {
          const merged = [...currentUsersList];
          for (const ru of remoteUsers) {
            const idx = merged.findIndex((m) => m.email.toLowerCase() === ru.email.toLowerCase());
            if (idx >= 0) {
              // Update existing user with fresh details from database
              merged[idx] = { ...merged[idx], ...ru };
            } else {
              // Add new user from database
              merged.push(ru);
            }
          }
          setUsers(merged);
          localStorage.setItem('datacleanse_users', JSON.stringify(merged));
          currentUsersList = merged;

          match = currentUsersList.find(
            (u) =>
              (u.email.toLowerCase() === cleanInput ||
               u.name.toLowerCase() === cleanInput) &&
              u.passwordHash === cleanPass
          );
        }
      } catch (err) {
        console.error('Failed to fetch remote database users on login', err);
      }
    }

    if (match) {
      if (match.status === 'rejected') {
        setLoginError('Your access request has been rejected. Please contact an administrator.');
        showToast('Access request rejected', 'error');
        return;
      }

      const activeUser: DummyUser = { ...match, status: 'approved' };
      setCurrentUser(activeUser);
      localStorage.setItem('datacleanse_current_user', JSON.stringify(activeUser));
      setLoginError(null);
      showToast(`Welcome back, ${activeUser.name}!`, 'success');
    } else {
      setLoginError('Invalid username/email or password.');
      showToast('Authentication failed', 'error');
    }
  }

  function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);

    const email = signupEmail.trim().toLowerCase();
    const name = signupName.trim();
    const company = signupCompany.trim();
    const role = signupRole.trim();
    const password = signupPassword.trim();
    const confirm = signupConfirmPassword.trim();

    if (password.length < 6) {
      setSignupError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirm) {
      setSignupError('Passwords do not match.');
      return;
    }

    const emailExists = users.some((u) => u.email.toLowerCase() === email);
    if (emailExists) {
      setSignupError('An account with this email already exists.');
      return;
    }

    const newUser: DummyUser = {
      name,
      email,
      passwordHash: password,
      company,
      role,
      status: 'approved',
      isAdmin: false,
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    localStorage.setItem('datacleanse_users', JSON.stringify(updatedUsers));

    // Asynchronously push user registration details to Supabase & IndexedDB database
    syncUserToDatabase(newUser);

    // Log the user in directly
    setCurrentUser(newUser);
    localStorage.setItem('datacleanse_current_user', JSON.stringify(newUser));

    // Clear form fields
    setSignupName('');
    setSignupEmail('');
    setSignupCompany('');
    setSignupRole('');
    setSignupPassword('');
    setSignupConfirmPassword('');

    showToast(`Welcome, ${name}! Your account has been created and synced to the database.`, 'success');
  }

  function handleForgotPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    const match = users.find(
      (u) => u.email.toLowerCase() === resetEmail.trim().toLowerCase()
    );
    if (match) {
      setAuthState('forgot_reset');
      setNewPassword('');
      setConfirmPassword('');
      setResetError(null);
    } else {
      setResetError('No account found with this email address.');
    }
  }

  function handleResetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    const updatedUsers = users.map((u) => {
      if (u.email.toLowerCase() === resetEmail.trim().toLowerCase()) {
        const updatedUser = { ...u, passwordHash: newPassword };
        syncUserToDatabase(updatedUser);
        return updatedUser;
      }
      return u;
    });

    setUsers(updatedUsers);
    localStorage.setItem('datacleanse_users', JSON.stringify(updatedUsers));
    setAuthState('forgot_success');
    setResetError(null);
    showToast('Password reset successfully!', 'success');
  }

  function handleSignOut() {
    setShowLogoutConfirm(true);
  }

  function confirmSignOut() {
    setCurrentUser(null);
    localStorage.removeItem('datacleanse_current_user');
    setEmailInput('');
    setPasswordInput('');
    setShowLogoutConfirm(false);
    showToast('Signed out successfully.', 'info');
  }

  const handleForgotPassword = useCallback(() => {
    setAuthState('forgot_email');
    setResetEmail('');
    setResetError(null);
  }, []);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-8 z-10 animate-fade-in">
          <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-white/10 mx-auto mb-4 hover:scale-105 transition-transform">
            <Database size={28} className="text-teal-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">DataCleanse AI</h1>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1.5">AI-Enriched Enterprise Data Cleansing</p>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl z-10 space-y-6 animate-fade-in duration-300">
          {authState === 'signin' && (
            <>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Sign In</h2>
                <p className="text-xs text-slate-400">Access your secure auditing environment</p>
              </div>

              {!isSupabaseConnected && (
                <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-[11px] text-amber-200">
                  <Info size={14} className="mt-0.5 shrink-0 text-amber-400" />
                  <span>
                    Database Offline (Local fallback active). Accounts created here will not be shared across other devices. Ask your administrator to set up the Supabase URL and Anon Key.
                  </span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Username or Email</label>
                  <input
                    type="text"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="e.g. Hansika or hansika@example.com"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide">Password</label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[10px] font-bold text-teal-400 hover:text-teal-350 transition-colors focus:outline-none"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                  />
                </div>

                {loginError && (
                  <div className="flex items-start gap-2 bg-red-950/40 border border-red-500/30 rounded-xl px-3.5 py-2.5 text-xs text-red-200">
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-violet-600 to-teal-600 hover:from-violet-700 hover:to-teal-700 text-white font-bold rounded-xl text-sm shadow-lg hover:shadow-violet-900/20 active:scale-[0.98] transition-all"
                >
                  Sign In
                </button>
              </form>

              <div className="text-center pt-1">
                <p className="text-xs text-slate-400">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthState('signup');
                      setSignupError(null);
                    }}
                    className="font-bold text-teal-400 hover:text-teal-350 transition-colors"
                  >
                    Create Account
                  </button>
                </p>
              </div>
            </>
          )}

          {authState === 'signup' && (
            <>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Create Account</h2>
                <p className="text-xs text-slate-400">Register your account details to get instant access</p>
              </div>

              {!isSupabaseConnected && (
                <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-[11px] text-amber-200">
                  <Info size={14} className="mt-0.5 shrink-0 text-amber-400" />
                  <span>
                    Database Offline (Local fallback active). Accounts created here will not be shared across other devices. Ask your administrator to set up the Supabase URL and Anon Key.
                  </span>
                </div>
              )}

              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="e.g. john@example.com"
                    className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Company</label>
                    <input
                      type="text"
                      required
                      value={signupCompany}
                      onChange={(e) => setSignupCompany(e.target.value)}
                      placeholder="e.g. Acme Corp"
                      className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Role</label>
                    <input
                      type="text"
                      required
                      value={signupRole}
                      onChange={(e) => setSignupRole(e.target.value)}
                      placeholder="e.g. Data Scientist"
                      className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                  />
                </div>

                {signupError && (
                  <div className="flex items-start gap-2 bg-red-950/40 border border-red-500/30 rounded-xl px-3.5 py-2.5 text-xs text-red-200">
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                    <span>{signupError}</span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthState('signin')}
                    className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-sm transition-all"
                  >
                    Back to Sign In
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-teal-600 hover:from-violet-700 hover:to-teal-700 text-white font-bold rounded-xl text-sm shadow-lg active:scale-[0.98] transition-all"
                  >
                    Sign Up & Sign In
                  </button>
                </div>
              </form>
            </>
          )}

          {authState === 'signup_pending' && (
            <div className="text-center space-y-5 animate-fade-in">
              <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/25 mx-auto">
                <Clock size={28} className="text-amber-400 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-white">Access Requested</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your access request is pending administrator approval.
                </p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-[11px] text-slate-400 leading-relaxed">
                  Please notify <span className="text-teal-400 font-semibold select-all">karthik@example.com</span> or <span className="text-teal-400 font-semibold select-all">admin@example.com</span> to approve your access.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAuthState('signin')}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-teal-600 hover:from-violet-700 hover:to-teal-700 text-white font-bold rounded-xl text-sm shadow-lg active:scale-[0.98] transition-all"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {authState === 'forgot_email' && (
            <>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Forgot Password</h2>
                <p className="text-xs text-slate-400">Enter your registered email address to find your account</p>
              </div>

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="hansika@example.com"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                  />
                </div>

                {resetError && (
                  <div className="flex items-start gap-2 bg-red-950/40 border border-red-500/30 rounded-xl px-3.5 py-2.5 text-xs text-red-200">
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthState('signin')}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-sm transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-teal-600 hover:from-violet-700 hover:to-teal-700 text-white font-bold rounded-xl text-sm shadow-lg active:scale-[0.98] transition-all"
                  >
                    Continue
                  </button>
                </div>
              </form>
            </>
          )}

          {authState === 'forgot_reset' && (
            <>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Reset Password</h2>
                <p className="text-xs text-slate-400">Set a new secure password for your account</p>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                  />
                </div>

                {resetError && (
                  <div className="flex items-start gap-2 bg-red-950/40 border border-red-500/30 rounded-xl px-3.5 py-2.5 text-xs text-red-200">
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthState('forgot_email')}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-sm transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-teal-600 hover:from-violet-700 hover:to-teal-700 text-white font-bold rounded-xl text-sm shadow-lg active:scale-[0.98] transition-all"
                  >
                    Reset Password
                  </button>
                </div>
              </form>
            </>
          )}

          {authState === 'forgot_success' && (
            <div className="text-center space-y-5">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/25 mx-auto">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Password Updated</h2>
                <p className="text-xs text-slate-400 leading-relaxed">Your password has been successfully reset. You can now use your new password to sign in.</p>
              </div>

              <button
                type="button"
                onClick={() => setAuthState('signin')}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-teal-600 hover:from-violet-700 hover:to-teal-700 text-white font-bold rounded-xl text-sm shadow-lg active:scale-[0.98] transition-all"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>

        {/* Toast notifications */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-fade-in ${
                toast.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-250'
                  : toast.type === 'error'
                  ? 'bg-red-950/80 border-red-500/30 text-red-250'
                  : toast.type === 'warning'
                  ? 'bg-amber-950/80 border-amber-500/30 text-amber-250'
                  : 'bg-indigo-950/80 border-indigo-500/30 text-indigo-250'
              }`}
            >
              {toast.type === 'success' && <CheckCircle size={15} className="text-emerald-400 shrink-0" />}
              {toast.type === 'error' && <XCircle size={15} className="text-red-400 shrink-0" />}
              {toast.type === 'warning' && <AlertCircle size={15} className="text-amber-400 shrink-0" />}
              {toast.type === 'info' && <Info size={15} className="text-indigo-400 shrink-0" />}
              <span className="text-xs font-semibold">{toast.message}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 hover:scale-[1.01] transition-transform duration-200">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-md shadow-slate-900/10">
              <Database size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight leading-none">DataCleanse AI</h1>
              <p className="text-[11px] font-bold text-slate-405 uppercase tracking-wider mt-1.5">AI-Enriched Data Cleansing Tool</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Active Authenticated User Profile Dropdown */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setProfileExpanded((p) => !p)}
                  className="flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100/85 border border-slate-200/80 rounded-xl px-3 py-1.5 shadow-sm transition-all hover:scale-[1.01] text-left"
                  title="View Profile Actions"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center font-extrabold text-xs text-white shadow-sm shrink-0">
                    {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="leading-tight hidden sm:block">
                    <div className="text-xs font-bold text-slate-800">{currentUser.name}</div>
                    <div className="text-[9px] text-slate-400 font-semibold">{currentUser.role} · {currentUser.company}</div>
                  </div>
                  <ChevronDown size={12} className={`text-slate-450 transition-transform duration-200 ${profileExpanded ? 'rotate-180' : ''}`} />
                </button>

                {profileExpanded && (
                  <>
                    {/* Backdrop to close when clicking outside */}
                    <div className="fixed inset-0 z-20" onClick={() => setProfileExpanded(false)} />
                    
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-30 animate-scale-up">
                      <div className="px-3 py-2 border-b border-slate-100 sm:hidden">
                        <div className="text-xs font-bold text-slate-800">{currentUser.name}</div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{currentUser.role}</div>
                        <div className="text-[9px] text-slate-500 font-medium">{currentUser.company}</div>
                      </div>
                      <div className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Account Actions
                      </div>
                      <button
                        onClick={() => {
                          setProfileExpanded(false);
                          handleSignOut();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg text-xs font-semibold transition-all text-left"
                      >
                        <LogOut size={13} className="text-slate-400" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* API Keys & Supabase Database Section */}
            <div className="relative">
              <button
                onClick={() => setKeysExpanded((p) => !p)}
                className={`flex items-center gap-2 px-3 py-2 text-xs rounded-xl border transition-all ${
                  hasAnyApiKey() || dbConfig.url
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Key size={13} />
                Connections & Keys
                {(hasAnyApiKey() || dbConfig.url) && (
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                )}
                {keysExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {keysExpanded && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-4 space-y-3 z-30 max-h-[80vh] overflow-y-auto">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Configure AI Provider Keys</div>
                  {(['groq', 'openai', 'anthropic', 'gemini'] as AIProvider[]).map((provider) => (
                    <div key={provider} className="relative">
                      <label className="block text-xs font-medium text-slate-600 mb-1">{providerLabels[provider]}</label>
                      <input
                        type={showKeys ? 'text' : 'password'}
                        value={apiKeys[provider]}
                        onChange={(e) => updateApiKey(provider, e.target.value)}
                        placeholder={`${providerLabels[provider]} API Key`}
                        className="w-full pl-3 pr-8 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowKeys((p) => !p);
                        }}
                        className="absolute right-2 top-7 text-slate-400 hover:text-slate-600"
                      >
                        {showKeys ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setShowKeys((p) => !p)}
                    className="w-full text-xs text-slate-550 hover:text-slate-750 py-1 border-b border-slate-100 pb-2"
                  >
                    {showKeys ? 'Hide all keys' : 'Show all keys'}
                  </button>

                  <div className="pt-2">
                    <div className="text-xs font-semibold text-slate-700 mb-2">Configure Supabase Database</div>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Supabase URL</label>
                        <input
                          type="text"
                          value={dbConfig.url}
                          onChange={(e) => {
                            const url = e.target.value;
                            updateSupabaseConfig(url, dbConfig.anonKey);
                            setDbConfig({ url, anonKey: dbConfig.anonKey });
                            setRefreshDbTrigger((prev) => prev + 1);
                          }}
                          placeholder="https://your-project.supabase.co"
                          className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Supabase Anon Key</label>
                        <input
                          type="text"
                          value={dbConfig.anonKey}
                          onChange={(e) => {
                            const anonKey = e.target.value;
                            updateSupabaseConfig(dbConfig.url, anonKey);
                            setDbConfig({ url: dbConfig.url, anonKey });
                          }}
                          placeholder="eyJhbGciOiJIUzI1Ni..."
                          className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {data && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                <RefreshCw size={13} />
                New File
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {!data ? (
          /* Upload screen */
          <div className="space-y-8">
            <div className="text-center py-8">
              <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-teal-850 to-indigo-950 tracking-tight mb-2">
                Upload Your Dataset
              </h2>
              <p className="text-slate-550 text-sm max-w-lg mx-auto font-medium">
                Import a CSV or Excel file to begin cleansing, normalizing, and analyzing your tabular data.
              </p>
            </div>
            <FileUpload onFile={handleFile} loading={loading} />
            {fileError && (
              <div className="max-w-xl mx-auto text-center text-red-650 text-xs bg-red-50 border border-red-200/50 rounded-2xl px-4 py-3.5 shadow-sm font-semibold">
                {fileError}
              </div>
            )}

            {/* Feature cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {[
                { icon: '01', label: 'File Ingestion', desc: 'CSV & Excel with interactive data preview', color: 'bg-white/75 border-slate-200/60 shadow-slate-100 hover:border-teal-400 hover:shadow-teal-500/5' },
                { icon: '02', label: 'Rule-Based Cleansing', desc: 'Deduplication and structural normalization', color: 'bg-white/75 border-slate-200/60 shadow-slate-100 hover:border-amber-400 hover:shadow-amber-500/5' },
                { icon: '03', label: 'AI Standardization', desc: 'Multi-provider taxonomy alignment', color: 'bg-white/75 border-slate-200/60 shadow-slate-100 hover:border-violet-400 hover:shadow-violet-500/5' },
                { icon: '04', label: 'Pivot & Export', desc: 'Aggregate, filter, and download clean data', color: 'bg-white/75 border-slate-200/60 shadow-slate-100 hover:border-emerald-400 hover:shadow-emerald-500/5' },
              ].map((f) => (
                <div key={f.icon} className={`rounded-2xl border p-5 shadow-sm transition-all duration-350 hover:-translate-y-1 hover:shadow-md ${f.color}`}>
                  <div className="text-[10px] font-extrabold text-slate-400 mb-2 tracking-widest">MODULE {f.icon}</div>
                  <div className="font-bold text-sm text-slate-800 mb-1">{f.label}</div>
                  <div className="text-xs text-slate-500 font-medium leading-relaxed">{f.desc}</div>
                </div>
              ))}
            </div>

            {currentUser.isAdmin && (
              <div className="mt-6">
                <AdminUserManagement
                  users={users}
                  setUsers={setUsers}
                  currentUser={currentUser}
                  showToast={showToast}
                />
              </div>
            )}

            {/* Audit Log database history at bottom of upload screen */}
            <DatabaseLog refreshTrigger={refreshDbTrigger} username={userIdentity} />
          </div>
        ) : (
          /* Main workspace */
          <div className="space-y-5">
            {/* Module 1 - Preview */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Database size={16} className="text-slate-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800 text-sm">Module 1: Data Preview</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {data.length.toLocaleString()} rows · {columns.length} columns — showing first 10
                  </p>
                </div>
              </div>
              <div className="p-5">
                <DataGrid
                  rows={data}
                  columns={columns}
                  maxRows={10}
                />
              </div>
            </div>

            {/* Module 2 */}
            <CleansingModule
              data={data}
              columns={columns}
              onApply={handleCleansingApply}
            />

            {/* Module 3 */}
            <AIStandardizeModule
              data={data}
              columns={columns}
              onApply={handleAIApply}
              apiKeys={apiKeys}
            />

            {/* Module 4 */}
            <PivotExportModule
              data={data}
              columns={columns}
              fileName={fileName}
              username={userIdentity}
              onExportLogged={() => setRefreshDbTrigger((prev) => prev + 1)}
              onExportSuccess={(msg) => showToast(msg, 'success')}
            />

            {currentUser.isAdmin && (
              <AdminUserManagement
                users={users}
                setUsers={setUsers}
                currentUser={currentUser}
                showToast={showToast}
              />
            )}

            {/* Audit Log database history at bottom of main workspace */}
            <DatabaseLog refreshTrigger={refreshDbTrigger} username={userIdentity} />
          </div>
        )}
      </main>

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-fade-in ${
              toast.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-200/50 text-emerald-800'
                : toast.type === 'error'
                ? 'bg-red-50/95 border-red-200/50 text-red-850'
                : toast.type === 'warning'
                ? 'bg-amber-50/95 border-amber-200/50 text-amber-800'
                : 'bg-indigo-50/95 border-indigo-200/50 text-indigo-850'
            }`}
          >
            {toast.type === 'success' && <CheckCircle size={15} className="text-emerald-600 shrink-0" />}
            {toast.type === 'error' && <XCircle size={15} className="text-red-600 shrink-0" />}
            {toast.type === 'warning' && <AlertCircle size={15} className="text-amber-600 shrink-0" />}
            {toast.type === 'info' && <Info size={15} className="text-indigo-650 shrink-0" />}
            <span className="text-xs font-semibold">{toast.message}</span>
          </div>
        ))}
      </div>
      {/* Custom Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-150 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 transform scale-100 transition-all duration-300 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertCircle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sign Out</h3>
                <p className="text-xs text-slate-500 mt-0.5">Are you sure you want to sign out?</p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmSignOut}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all active:scale-[0.98]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
