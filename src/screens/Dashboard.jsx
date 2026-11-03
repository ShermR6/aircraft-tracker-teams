import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Map, ScrollText, MessageSquare, BookOpen, Users } from 'lucide-react';
import StorageService from '../services/storage';
import APIService from '../services/api';
import AccountDashboard from './AccountDashboard';
import LiveMap from './LiveMap';
import Logs from './Logs';
import Teams from './Teams';

const ONBOARDING_STEPS = [
  {
    key: 'team',
    icon: '👥',
    title: 'Set up your team',
    desc: 'Invite members, assign roles, and configure who receives alerts and when.',
    action: 'Go to Team',
    route: '/dashboard/team',
  },
  {
    key: 'aircraft',
    icon: '✈️',
    title: 'Add your aircraft',
    desc: 'Enter tail numbers and ICAO24 codes for the aircraft your team tracks.',
    action: 'Go to Aircraft in Team',
    route: '/dashboard/team',
  },
  {
    key: 'channels',
    icon: '🔔',
    title: 'Connect your channels',
    desc: 'Set up Discord, Slack, or Microsoft Teams so alerts reach the right people.',
    action: 'Go to Channels in Team',
    route: '/dashboard/team',
  },
];

function OnboardingModal({ onClose, onNavigate, completedSteps }) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = ONBOARDING_STEPS[currentStep];
  const isLast = currentStep === ONBOARDING_STEPS.length - 1;
  const stepComplete = completedSteps.includes(step.key);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, width: 480, maxWidth: '90%',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '24px 24px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>
              Welcome to FinalPing for Teams
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              Get set up in 3 steps
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--faint)',
            cursor: 'pointer', padding: 4, borderRadius: 6,
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', padding: '16px 24px 0', gap: 8 }}>
          {ONBOARDING_STEPS.map((s, i) => (
            <div key={s.key} style={{
              flex: 1, height: 3, borderRadius: 999,
              background: i <= currentStep ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        <div style={{ padding: '24px 24px 8px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>{step.icon}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Step {currentStep + 1} — {step.title}
          </div>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 24 }}>
            {step.desc}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {ONBOARDING_STEPS.map((s, i) => (
              <div key={s.key} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10,
                background: i === currentStep ? 'rgba(14,165,233,0.08)' : 'transparent',
                border: `1px solid ${i === currentStep ? 'rgba(14,165,233,0.2)' : 'transparent'}`,
              }}>
                {completedSteps.includes(s.key)
                  ? <CheckCircle size={16} color="var(--good)" />
                  : i === currentStep
                    ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--accent)', flexShrink: 0 }} />
                    : <Circle size={16} color="var(--border)" />
                }
                <span style={{
                  fontSize: 13, fontWeight: i === currentStep ? 600 : 400,
                  color: completedSteps.includes(s.key) ? 'var(--good)' : i === currentStep ? 'var(--accent)' : 'var(--faint)',
                }}>
                  {s.title}
                </span>
                {completedSteps.includes(s.key) && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--good)' }}>Done ✓</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10 }}>
          <button
            onClick={() => onNavigate(step.route)}
            style={{
              flex: 1, padding: '12px', borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
              border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 16px rgba(14,165,233,0.3)',
            }}
          >
            {stepComplete ? 'Go again' : step.action} <ArrowRight size={14} />
          </button>
          {!isLast && (
            <button
              onClick={() => setCurrentStep(s => s + 1)}
              disabled={!stepComplete}
              style={{
                padding: '12px 16px', borderRadius: 10,
                background: 'transparent',
                border: `1px solid ${stepComplete ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}`,
                color: stepComplete ? 'var(--muted)' : 'var(--border)',
                fontSize: 14, cursor: stepComplete ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
              title={stepComplete ? '' : 'Complete this step first'}
            >
              Next
            </button>
          )}
          {isLast && (
            <button
              onClick={onClose}
              disabled={!stepComplete}
              style={{
                padding: '12px 16px', borderRadius: 10,
                background: 'transparent',
                border: `1px solid ${stepComplete ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}`,
                color: stepComplete ? 'var(--muted)' : 'var(--border)',
                fontSize: 14, cursor: stepComplete ? 'pointer' : 'not-allowed',
              }}
              title={stepComplete ? '' : 'Complete this step first'}
            >
              Finish
            </button>
          )}
        </div>

        <div style={{ textAlign: 'center', paddingBottom: 16, fontSize: 11, color: 'var(--border)' }}>
          You can always find these in the sidebar
        </div>
      </div>
    </div>
  );
}

const isWindows = window.electronAPI?.platform === 'win32';

const s = {
  shell: {
    display: 'flex',
    height: '100vh',
    background: 'var(--bg)',
    fontFamily: 'var(--font-sans)',
    overflow: 'hidden',
  },
  sidebar: {
    width: '220px',
    minWidth: '220px',
    background: 'linear-gradient(180deg, var(--bg) 0%, var(--bg) 100%)',
    borderRight: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  sidebarGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '200px',
    background: 'radial-gradient(ellipse at 50% -20%, rgba(14,165,233,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  logoArea: {
    padding: '36px 16px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    position: 'relative',
    zIndex: 1,
    WebkitAppRegion: 'drag',
  },
  logoTop: {
    fontSize: '8px', fontWeight: '700', letterSpacing: '0.18em',
    textTransform: 'uppercase', color: 'var(--muted)', lineHeight: 1, marginBottom: '6px',
  },
  logoMain: {
    fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em',
    color: 'var(--text)', lineHeight: 1.1,
  },
  logoTeamsBadge: {
    fontSize: '8px', fontWeight: '800', letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--accent)',
    background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.28)',
    padding: '2px 6px', borderRadius: '4px',
    verticalAlign: 'middle', display: 'inline-block', marginLeft: '6px',
    lineHeight: '14px',
  },
  logoLine: {
    display: 'block', width: '40px', height: '2px',
    background: 'linear-gradient(90deg, var(--accent), transparent)',
    borderRadius: '999px', marginTop: '4px', marginBottom: '12px',
  },
  logoEmail: {
    fontSize: '11px', color: 'var(--faint)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  nav: {
    flex: 1, padding: '12px 10px',
    display: 'flex', flexDirection: 'column', gap: '2px',
    overflowY: 'auto', position: 'relative', zIndex: 1,
  },
  navSection: {
    fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--border)', padding: '8px 12px 4px',
  },
  navLink: (active) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 12px', borderRadius: '10px', textDecoration: 'none',
    fontSize: '13px', fontWeight: active ? '600' : '500',
    color: active ? 'var(--accent)' : 'var(--muted)',
    background: active ? 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(2,132,199,0.08))' : 'transparent',
    border: active ? '1px solid rgba(14,165,233,0.22)' : '1px solid transparent',
    boxShadow: active ? '0 0 20px rgba(14,165,233,0.08)' : 'none',
    transition: 'all 0.15s',
  }),
  navDot: {
    width: '6px', height: '6px', borderRadius: '50%',
    background: 'var(--accent)', boxShadow: '0 0 6px rgba(14,165,233,0.8)',
    marginLeft: 'auto', flexShrink: 0,
  },
  sidebarBottom: {
    padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.07)',
    position: 'relative', zIndex: 1,
  },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
    padding: '9px 12px', background: 'none', border: '1px solid transparent',
    borderRadius: '10px', color: 'var(--muted)', fontSize: '13px',
    fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s',
  },
  main: {
    flex: 1, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    background: 'var(--bg)',
  },
  content: { padding: '24px 28px 32px', overflowY: 'auto', flex: 1 },
  dragStrip: {
    height: 36, flexShrink: 0, WebkitAppRegion: 'drag',
  },
};

function DashboardHome({ isViewOnly }) {
  return (
    <>
      <AccountDashboard />
    </>
  );
}

export default function Dashboard({ onLogout }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appVersion, setAppVersion] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [visitedRoutes, setVisitedRoutes] = useState(new Set());
  const [connectionLost, setConnectionLost] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const onboardingChecked = React.useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const currentPath = location.pathname;

    ONBOARDING_STEPS.forEach(step => {
      if (currentPath === step.route) {
        setVisitedRoutes(prev => new Set([...prev, step.key]));
      }
    });

    if (currentPath === '/dashboard' || currentPath === '/dashboard/') {
      setVisitedRoutes(prev => {
        if (prev.size > 0) {
          setCompletedSteps(current => {
            const newCompleted = [...new Set([...current, ...prev])];
            return newCompleted;
          });
        }
        return prev;
      });
    }
  }, [location.pathname]);

  useEffect(() => { loadUserData(); }, []);

  // Hourly display_name sync — picks up website profile changes without re-login
  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await StorageService.getUserData().catch(() => null);
      if (data) syncFreshUserData(data);
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = APIService.onConnectionChange((connected) => {
      setConnectionLost(!connected);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    window.electronAPI?.getAppVersion().then(v => setAppVersion(v)).catch(() => {});
  }, []);

  const syncFreshUserData = async (data) => {
    try {
      const fresh = await APIService.getCurrentUser();
      if (!fresh) return;
      const nameChanged = fresh.display_name !== undefined && fresh.display_name !== data?.display_name;
      const tierChanged = fresh.license_tier && fresh.license_tier !== data?.license_tier;
      if (nameChanged || tierChanged) {
        const updated = { ...data, license_tier: fresh.license_tier || data?.license_tier, display_name: fresh.display_name ?? data?.display_name };
        await StorageService.setUserData(updated);
        setUserData(updated);
      }
    } catch { }
  };

  const loadUserData = async () => {
    try {
      const data = await StorageService.getUserData();
      setUserData(data);
      syncFreshUserData(data);

      if (!onboardingChecked.current) {
        onboardingChecked.current = true;
        const onboardingKey = `onboardingComplete_${data?.email || 'default'}`;
        const onboardingDone = await window.electronAPI?.storeGet(onboardingKey);
        if (!onboardingDone) {
          setShowOnboarding(true);
        }
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseOnboarding = async () => {
    const onboardingKey = `onboardingComplete_${userData?.email || 'default'}`;
    await window.electronAPI?.storeSet(onboardingKey, true);
    setShowOnboarding(false);
  };

  const handleLogout = () => setShowLogoutConfirm(true);

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await onLogout();
  };

  if (loading) {
    return (
      <div style={{ ...s.shell, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--faint)', fontSize: '13px' }}>Loading...</div>
      </div>
    );
  }

  const path = location.pathname;
  const isViewOnly = !userData?.license_tier || userData.license_tier === 'free';

  return (
    <div style={s.shell}>
      {showOnboarding && (path === '/dashboard' || path === '/dashboard/') && (
        <OnboardingModal
          onClose={handleCloseOnboarding}
          onNavigate={(route) => { navigate(route); }}
          completedSteps={completedSteps}
        />
      )}

      {showLogoutConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '28px 28px 24px', width: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <LogOut size={18} color='var(--bad)' />
              <span style={{ color: 'var(--text)', fontSize: '15px', fontWeight: 700 }}>Log out</span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 22px' }}>Are you sure you want to log out of FinalPing for Teams?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={confirmLogout}
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--bad)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >Log out</button>
            </div>
          </div>
        </div>
      )}

      {connectionLost && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(135deg, var(--panel), var(--panel))',
          borderBottom: '1px solid rgba(239,68,68,0.3)',
          padding: '8px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 16, fontSize: 12, color: 'var(--muted)',
        }}>
          <span>⚠️ <strong style={{ color: 'var(--bad)' }}>Connection lost</strong> — unable to reach the server.</span>
        </div>
      )}

      {isViewOnly && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9997,
          background: 'linear-gradient(135deg, var(--panel), var(--panel))',
          borderBottom: '1px solid rgba(245,158,11,0.3)',
          padding: '8px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 16, fontSize: 12, color: 'var(--muted)',
        }}>
          <span>👀 You&apos;re in <strong style={{ color: 'var(--warn)' }}>view-only mode</strong> — purchase a license to start tracking aircraft.</span>
          <button
            onClick={() => window.electronAPI?.openExternal('https://finalpingapp.com/pricing')}
            style={{
              padding: '4px 14px', borderRadius: 999,
              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
              color: 'var(--warn)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            View Plans →
          </button>
        </div>
      )}

      <div style={s.sidebar}>
        <div style={s.sidebarGlow} />

        <div style={s.logoArea}>
          <div style={s.logoTop}>Aircraft Alerts</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={s.logoMain}>FinalPing</div>
            <span style={s.logoTeamsBadge}>Teams</span>
          </div>
          <span style={s.logoLine} />
          <div style={s.logoEmail}>{userData?.display_name || userData?.email}</div>
        </div>

        <nav style={s.nav}>
          <div style={s.navSection}>Menu</div>
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" active={path === '/dashboard' || path === '/dashboard/'} />
          <NavItem to="/dashboard/map" icon={Map} label="Live Map" active={path === '/dashboard/map'} />
          <NavItem to="/dashboard/team" icon={Users} label="Team" active={path === '/dashboard/team'} />
          <NavItem to="/dashboard/logs" icon={ScrollText} label="Logs" active={path === '/dashboard/logs'} />
        </nav>

        <div style={s.sidebarBottom}>
          <button
            style={s.logoutBtn}
            onClick={() => window.electronAPI?.openExternal('https://finalpingapp.com/docs')}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.borderColor = 'rgba(14,165,233,0.2)';
              e.currentTarget.style.background = 'rgba(14,165,233,0.06)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--muted)';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.background = 'none';
            }}
          >
            <BookOpen size={14} /> Help Center
          </button>
          <button
            style={s.logoutBtn}
            onClick={() => window.electronAPI?.openExternal('https://finalpingapp.com/contact')}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.borderColor = 'rgba(14,165,233,0.2)';
              e.currentTarget.style.background = 'rgba(14,165,233,0.06)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--muted)';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.background = 'none';
            }}
          >
            <MessageSquare size={14} /> Send Feedback
          </button>
          <button
            style={s.logoutBtn}
            onClick={handleLogout}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--bad)';
              e.currentTarget.style.borderColor = 'rgba(248,113,113,0.2)';
              e.currentTarget.style.background = 'rgba(248,113,113,0.06)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--muted)';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.background = 'none';
            }}
          >
            <LogOut size={14} /> Logout
          </button>
          <div style={{ fontSize: '10px', color: 'var(--border)', textAlign: 'center', marginTop: '8px', letterSpacing: '0.05em' }}>
            {appVersion ? `v${appVersion}` : ''}
          </div>
        </div>
      </div>

      <div style={{ ...s.main, paddingTop: (connectionLost ? 36 : 0) + (isViewOnly ? 36 : 0) }}>
        <div style={s.dragStrip} />
        <Routes>
          <Route path="/map" element={<LiveMap />} />
          <Route path="/" element={<div style={s.content}><DashboardHome isViewOnly={isViewOnly} /></div>} />
          <Route path="/team" element={<Teams />} />
          <Route path="/logs" element={<div style={s.content}><Logs /></div>} />
        </Routes>
      </div>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, active }) {
  return (
    <Link
      to={to}
      style={s.navLink(active)}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.color = 'var(--muted)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--muted)';
          e.currentTarget.style.borderColor = 'transparent';
        }
      }}
    >
      <Icon size={14} />
      {label}
      {active && <span style={s.navDot} />}
    </Link>
  );
}
