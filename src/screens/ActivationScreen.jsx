import React, { useState } from 'react';
import { Key, Mail, ArrowRight, Loader, Shield, Zap, Bell, Eye, EyeOff, Users } from 'lucide-react';
import APIService from '../services/api';
import StorageService from '../services/storage';

const s = {
  shell: {
    display: 'flex',
    height: '100vh',
    background: 'var(--bg)',
    fontFamily: 'var(--font-sans)',
    overflow: 'hidden',
  },
  left: {
    width: '420px',
    minWidth: '420px',
    background: 'var(--panel)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '48px 40px',
    position: 'relative',
    overflow: 'hidden',
  },
  leftGlow: {
    position: 'absolute',
    top: '-100px',
    left: '-100px',
    width: '400px',
    height: '400px',
    background: 'none',
    pointerEvents: 'none',
  },
  leftGlow2: {
    position: 'absolute',
    bottom: '-50px',
    right: '-50px',
    width: '300px',
    height: '300px',
    background: 'none',
    pointerEvents: 'none',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '64px',
    position: 'relative',
    zIndex: 1,
  },
  logoIcon: {
    width: '48px',
    height: '48px',
    background: 'var(--accent)',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'none',
  },
  logoText: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--text)',
    margin: 0,
  },
  heroTitle: {
    fontSize: '36px',
    fontWeight: '800',
    color: 'var(--text)',
    margin: '0 0 16px 0',
    lineHeight: '1.2',
    position: 'relative',
    zIndex: 1,
  },
  heroAccent: {
    color: 'var(--accent)',
  },
  heroSub: {
    fontSize: '15px',
    color: 'var(--faint)',
    lineHeight: '1.6',
    margin: '0 0 48px 0',
    position: 'relative',
    zIndex: 1,
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    position: 'relative',
    zIndex: 1,
    flex: 1,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
  },
  featureIcon: (color) => ({
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: `${color}15`,
    border: `1px solid ${color}25`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px',
  }),
  featureTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text)',
    margin: '0 0 3px 0',
  },
  featureSub: {
    fontSize: '12px',
    color: 'var(--faint)',
    margin: 0,
    lineHeight: '1.5',
  },
  leftFooter: {
    position: 'relative',
    zIndex: 1,
    paddingTop: '32px',
    borderTop: '1px solid var(--border)',
  },
  leftFooterText: {
    fontSize: '12px',
    color: 'var(--faint)',
    margin: 0,
  },
  right: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    background: 'var(--panel)',
  },
  formCard: {
    width: '100%',
    maxWidth: '440px',
  },
  formTitle: {
    fontSize: '26px',
    fontWeight: '700',
    color: 'var(--text)',
    margin: '0 0 6px 0',
  },
  formSub: {
    fontSize: '14px',
    color: 'var(--faint)',
    margin: '0 0 36px 0',
  },
  fieldGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: '8px',
  },
  inputWrap: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '12px 14px 12px 42px',
    background: 'var(--panel-2)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    color: 'var(--text)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  },
  submitBtn: (loading) => ({
    width: '100%',
    padding: '14px',
    background: loading ? 'var(--panel-2)' : 'var(--accent)',
    border: 'none',
    borderRadius: '10px',
    color: loading ? 'var(--faint)' : '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: loading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '8px',
    boxShadow: 'none',
    transition: 'all 0.2s',
  }),
  errorBox: {
    padding: '12px 14px',
    background: 'var(--bad-bg)',
    border: '1px solid var(--bad)',
    borderRadius: '8px',
    color: 'var(--bad)',
    fontSize: '13px',
    marginBottom: '16px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '28px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'var(--panel-2)',
  },
  dividerText: {
    fontSize: '12px',
    color: 'var(--faint)',
  },
  purchaseBox: {
    padding: '16px',
    background: 'var(--panel-2)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    textAlign: 'center',
  },
  purchaseText: {
    fontSize: '13px',
    color: 'var(--muted)',
    margin: '0 0 10px 0',
  },
  purchaseBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 20px',
    background: 'var(--cta-soft)',
    border: '1px solid var(--cta)',
    borderRadius: '8px',
    color: 'var(--cta)',
    fontSize: '13px',
    fontWeight: '600',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  formFooter: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '12px',
    color: 'var(--faint)',
  },
  tosRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    margin: '16px 0 12px 0',
  },
  checkbox: {
    marginTop: '2px',
    width: '15px',
    height: '15px',
    flexShrink: 0,
    accentColor: 'var(--accent)',
    cursor: 'pointer',
  },
  tosLabel: {
    fontSize: '13px',
    color: 'var(--muted)',
    lineHeight: '1.5',
    cursor: 'default',
  },
  tosLink: {
    color: 'var(--accent)',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
};

export default function ActivationScreen({ onSuccess }) {
  const [tab, setTab] = useState('signin'); // 'signin' | 'activate'
  const [appVersion, setAppVersion] = useState('');

  // Sign in state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Activate state
  const [licenseKey, setLicenseKey] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  React.useEffect(() => {
    window.electronAPI?.getAppVersion().then(v => setAppVersion(v)).catch(() => {});
  }, []);

  const openLink = (url) => {
    if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url);
    else window.open(url, '_blank');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Please enter your email and password.');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const data = await APIService.login(loginEmail.trim(), loginPassword);
      await StorageService.setToken(data.access_token);
      await StorageService.setUserData({
        email: data.email,
        user_id: data.user_id,
        display_name: data.display_name || null,
        license_tier: data.license_tier,
      });
      onSuccess(data);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid email or password.';
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!licenseKey.trim() || !email.trim()) {
      setError('Please enter both your license key and email address.');
      return;
    }
    if (!agreed) {
      setError('You must agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }
    if (licenseKey.trim().toUpperCase().startsWith('FP-')) {
      setError('This appears to be a personal FinalPing license key. FinalPing for Teams requires a key starting with FPT-.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await APIService.activateLicense(licenseKey.trim(), email.trim());
      await StorageService.setToken(data.access_token);
      await StorageService.setUserData({
        email: data.email,
        user_id: data.user_id,
        display_name: data.display_name || null,
        license_tier: data.license_tier,
      });
      onSuccess(data);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Activation failed. Please check your license key and email.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const focusInput = (e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--input)'; };
  const blurInput = (e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--panel-2)'; };

  return (
    <div style={s.shell}>
      <div style={s.left}>
        <div style={s.leftGlow} />
        <div style={s.leftGlow2} />

        <div style={s.logoRow}>
          <div>
            <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)', lineHeight: 1, marginBottom: '2px' }}>Team Management</div>
            <div style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.1 }}>FinalPing</div>
            <div style={{ fontSize: '14px', fontWeight: '600', letterSpacing: '-0.01em', color: 'var(--accent)', lineHeight: 1.1 }}>for Teams</div>
            <div style={{ width: '40px', height: '2px', background: 'linear-gradient(90deg, var(--accent), transparent)', borderRadius: '999px', marginTop: '4px' }} />
          </div>
        </div>

        <h1 style={s.heroTitle}>
          Track aircraft.<br />
          <span style={s.heroAccent}>Keep your team informed.</span>
        </h1>
        <p style={s.heroSub}>
          Real-time ADS-B monitoring with team-wide alerts, shared dashboards, and role-based access for your entire organization.
        </p>

        <div style={s.featureList}>
          <div style={s.featureItem}>
            <div style={s.featureIcon('var(--accent)')}><Users size={16} color="var(--accent)" /></div>
            <div>
              <p style={s.featureTitle}>Team Dashboard</p>
              <p style={s.featureSub}>Shared live map and aircraft status visible to your whole team in real time.</p>
            </div>
          </div>
          <div style={s.featureItem}>
            <div style={s.featureIcon('var(--good)')}><Bell size={16} color="var(--good)" /></div>
            <div>
              <p style={s.featureTitle}>Team Alerts</p>
              <p style={s.featureSub}>Proximity alerts routed to team channels — Discord, Slack, or Microsoft Teams.</p>
            </div>
          </div>
          <div style={s.featureItem}>
            <div style={s.featureIcon('var(--accent)')}><Shield size={16} color="var(--accent)" /></div>
            <div>
              <p style={s.featureTitle}>Roles & Permissions</p>
              <p style={s.featureSub}>Assign admin, dispatcher, and viewer roles to control who can do what.</p>
            </div>
          </div>
          <div style={s.featureItem}>
            <div style={s.featureIcon('var(--warn)')}><Zap size={16} color="var(--warn)" /></div>
            <div>
              <p style={s.featureTitle}>On-Duty Scheduling</p>
              <p style={s.featureSub}>Set who&apos;s on duty and route alerts only to the right people at the right time.</p>
            </div>
          </div>
        </div>

        <div style={s.leftFooter}>
          <p style={s.leftFooterText}>{appVersion ? `v${appVersion}` : ''} · © 2026 FinalPing · <a href="https://finalpingapp.com" onClick={e => { e.preventDefault(); window.electronAPI?.openExternal('https://finalpingapp.com'); }} style={{ color: 'var(--faint)', textDecoration: 'none' }}>FinalPingApp.com</a></p>
        </div>
      </div>

      <div style={s.right}>
        <div style={s.formCard}>

          {/* Tabs */}
          <div style={{
            display: 'flex', background: 'var(--panel-2)', borderRadius: 12,
            padding: 4, marginBottom: 32, border: '1px solid var(--border)',
          }}>
            {[{ id: 'signin', label: 'Sign In' }, { id: 'activate', label: 'Activate License' }].map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setLoginError(''); setError(''); }}
                style={{
                  flex: 1, padding: '10px', borderRadius: 9, border: 'none',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  background: tab === t.id ? 'linear-gradient(135deg, var(--accent), var(--accent-hover))' : 'transparent',
                  color: tab === t.id ? '#fff' : 'var(--muted)',
                  boxShadow: tab === t.id ? '0 2px 8px var(--accent)40' : 'none',
                }}>{t.label}</button>
            ))}
          </div>

          {/* ── Sign In Tab ── */}
          {tab === 'signin' && (
            <>
              <h2 style={s.formTitle}>Welcome back</h2>
              <p style={s.formSub}>Sign in with your FinalPing for Teams account</p>

              {loginError && <div style={s.errorBox}>{loginError}</div>}

              <form onSubmit={handleLogin}>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Email Address</label>
                  <div style={s.inputWrap}>
                    <div style={s.inputIcon}><Mail size={15} color="var(--faint)" /></div>
                    <input style={s.input} type="email" placeholder="your@email.com"
                      value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                      onFocus={focusInput} onBlur={blurInput} autoComplete="email" />
                  </div>
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Password</label>
                  <div style={{ ...s.inputWrap, position: 'relative' }}>
                    <div style={s.inputIcon}><Shield size={15} color="var(--faint)" /></div>
                    <input style={{ ...s.input, paddingRight: 36 }} type={showLoginPassword ? "text" : "password"} placeholder="••••••••"
                      value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                      onFocus={focusInput} onBlur={blurInput} autoComplete="current-password" />
                    <button type="button" onClick={() => setShowLoginPassword(v => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 0, display: 'flex', alignItems: 'center' }}>
                      {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button type="submit" style={s.submitBtn(loginLoading)} disabled={loginLoading}>
                  {loginLoading
                    ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />Signing in...</>
                    : <><ArrowRight size={16} />Sign In</>}
                </button>
              </form>

              <div style={s.divider}>
                <div style={s.dividerLine} />
                <span style={s.dividerText}>or</span>
                <div style={s.dividerLine} />
              </div>

              <button
                type="button"
                onClick={() => {
                  const url = 'https://finalpingapp.com/api/auth/google/desktop-start?scheme=finalpingteams';
                  if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url);
                  else window.open(url, '_blank');
                }}
                style={{
                  width: '100%', padding: '12px 14px', background: '#fff',
                  border: '1px solid var(--text)', borderRadius: '10px',
                  color: 'var(--border)', fontSize: '14px', fontWeight: '600',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '10px', marginBottom: 20,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div style={s.divider}>
                <div style={s.dividerLine} />
                <span style={s.dividerText}>New to FinalPing for Teams?</span>
                <div style={s.dividerLine} />
              </div>

              <div style={s.purchaseBox}>
                <p style={s.purchaseText}>Don&apos;t have an account? Get a teams license key first</p>
                <a href="https://finalpingapp.com/pricing"
                  onClick={e => { e.preventDefault(); openLink('https://finalpingapp.com/pricing'); }}
                  style={s.purchaseBtn}
                  onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, var(--accent)30, var(--accent)30)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, var(--accent-soft), var(--accent-soft))'}>
                  <Zap size={13} /> Purchase at FinalPingApp.com
                </a>
              </div>

              <p style={{ ...s.formFooter, marginTop: 16 }}>
                <span style={s.tosLink} onClick={() => openLink('https://finalpingapp.com/login/forgot')}>
                  Forgot your password?
                </span>
              </p>
            </>
          )}

          {/* ── Activate Tab ── */}
          {tab === 'activate' && (
            <>
              <h2 style={s.formTitle}>Activate your license</h2>
              <p style={s.formSub}>Enter your FPT- license key and email to get started</p>

              {error && <div style={s.errorBox}>{error}</div>}

              <form onSubmit={handleSubmit}>
                <div style={s.fieldGroup}>
                  <label style={s.label}>License Key</label>
                  <div style={s.inputWrap}>
                    <div style={s.inputIcon}><Key size={15} color="var(--faint)" /></div>
                    <input style={s.input} type="text" placeholder="FPT-XXXX-XXXX-XXXX-XXXX"
                      value={licenseKey} onChange={e => setLicenseKey(e.target.value)}
                      onFocus={focusInput} onBlur={blurInput} autoComplete="off" spellCheck={false} />
                  </div>
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Email Address</label>
                  <div style={s.inputWrap}>
                    <div style={s.inputIcon}><Mail size={15} color="var(--faint)" /></div>
                    <input style={s.input} type="email" placeholder="your@email.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      onFocus={focusInput} onBlur={blurInput} autoComplete="email" />
                  </div>
                </div>
                <div style={s.tosRow}>
                  <input type="checkbox" id="agree" checked={agreed}
                    onChange={e => setAgreed(e.target.checked)} style={s.checkbox} />
                  <label htmlFor="agree" style={s.tosLabel}>
                    I agree to the{' '}
                    <span style={s.tosLink} onClick={() => openLink('https://finalpingapp.com/terms')}>Terms of Service</span>
                    {' '}and{' '}
                    <span style={s.tosLink} onClick={() => openLink('https://finalpingapp.com/privacy')}>Privacy Policy</span>
                  </label>
                </div>
                <button type="submit" style={s.submitBtn(loading || !agreed)} disabled={loading || !agreed}>
                  {loading
                    ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />Activating...</>
                    : <><ArrowRight size={16} />Activate License</>}
                </button>
              </form>

              <div style={s.divider}>
                <div style={s.dividerLine} />
                <span style={s.dividerText}>Don&apos;t have a teams license?</span>
                <div style={s.dividerLine} />
              </div>

              <div style={s.purchaseBox}>
                <p style={s.purchaseText}>Get a FinalPing for Teams license to start tracking</p>
                <a href="https://finalpingapp.com/pricing"
                  onClick={e => { e.preventDefault(); openLink('https://finalpingapp.com/pricing'); }}
                  style={s.purchaseBtn}
                  onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, var(--accent)30, var(--accent)30)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, var(--accent-soft), var(--accent-soft))'}>
                  <Zap size={13} /> Purchase at FinalPingApp.com
                </a>
              </div>

              <p style={s.formFooter}>Your license key (starting with FPT-) was emailed to you after purchase.</p>
            </>
          )}

        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
