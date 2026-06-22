import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Map, Calendar, Radio, GitBranch, Plane, Building2,
  Clock, Bell, ScrollText, Plus, X, Trash2, Check, ChevronDown,
  Phone, Hash, Mail, Copy, AlertTriangle, UserCheck, Globe,
  Shield, Edit3, Edit2, AlertCircle, Loader, Save, RefreshCw, Loader2, MapPin,
} from 'lucide-react';
import APIService from '../services/api';
import LiveMap from './LiveMap';
import { getColor, setColor, ensureLoaded } from '../services/aircraftColors';
import airportsData from '../data/airports.json';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const NM_TO_M = 1852;

function toAirport(a) {
  return {
    icao: a[0], name: a[1], city: a[2], iata: a[8] || null,
    lat: a[5], lon: a[6], elev: a[7],
    runways: (a[9] || []).map(rw => ({
      leIdent: rw[0], leHdg: rw[1], heIdent: rw[2], heHdg: rw[3], lengthFt: rw[4],
      leLat: rw[5] ?? null, leLon: rw[6] ?? null, heLat: rw[7] ?? null, heLon: rw[8] ?? null,
    })),
  };
}

function searchAirports(query) {
  if (!query || query.length < 2) return [];
  const q = query.toUpperCase().trim();
  const qLower = query.toLowerCase().trim();
  const exact = [], prefix = [], nameCity = [];
  for (let i = 0; i < airportsData.length; i++) {
    const a = airportsData[i];
    const icao = a[0]; const iata = a[8] || '';
    if (icao === q || iata === q) { exact.push(a); continue; }
    if (icao.startsWith(q) || iata.startsWith(q)) { prefix.push(a); continue; }
    const name = (a[1] || '').toLowerCase(); const city = (a[2] || '').toLowerCase();
    if (name.includes(qLower) || city.includes(qLower)) nameCity.push(a);
  }
  return [...exact, ...prefix, ...nameCity].slice(0, 10).map(toAirport);
}

// ── Design tokens (green/amber — ops center feel) ────────────────────────────
const G = '#22d3a3';   // primary green
const A = '#f59e0b';   // amber accent
const BG = '#0a0d12';
const CARD = '#0f1319';
const BORDER = 'rgba(255,255,255,0.08)';

const TABS = [
  { id: 'ops',       label: 'Operations', Icon: Radio },
  { id: 'map',       label: 'Live Map',   Icon: Map },
  { id: 'members',   label: 'Members',    Icon: Users },
  { id: 'schedule',  label: 'Schedule',   Icon: Calendar },
  { id: 'channels',  label: 'Channels',   Icon: Phone },
  { id: 'routing',   label: 'Routing',    Icon: GitBranch },
  { id: 'aircraft',  label: 'Aircraft',   Icon: Plane },
  { id: 'airports',  label: 'Airports',   Icon: Building2 },
  { id: 'arrivals',  label: 'Arrivals',   Icon: Clock },
  { id: 'alerts',    label: 'Alerts',     Icon: Bell },
  { id: 'activity',  label: 'Activity',   Icon: ScrollText },
];

const ROLE_STYLES = {
  owner: { bg: 'rgba(245,158,11,0.15)', color: A, label: 'Owner' },
  admin: { bg: 'rgba(34,211,163,0.12)', color: G, label: 'Admin' },
  member: { bg: 'rgba(107,114,128,0.1)', color: '#9ca3af', label: 'Member' },
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CHANNEL_TYPES = [
  { key: 'sms',         label: 'SMS',          Icon: Phone,  color: '#22d3a3', desc: 'Text message alerts to any phone number' },
  { key: 'discord',     label: 'Discord',      Icon: Hash,   color: '#5865F2', desc: 'Send alerts to a Discord channel via webhook' },
  { key: 'slack',       label: 'Slack',        Icon: Hash,   color: '#4A154B', desc: 'Post alerts to a Slack channel via webhook' },
  { key: 'email',       label: 'Email',        Icon: Mail,   color: '#f59e0b', desc: 'Send alert emails to any address' },
  { key: 'teams',       label: 'MS Teams',     Icon: Users,  color: '#6264A7', desc: 'Send alerts to a Microsoft Teams channel' },
  { key: 'telegram',    label: 'Telegram',     Icon: Globe,  color: '#26A5E4', desc: 'Send alerts to a Telegram bot or channel' },
  { key: 'google_chat', label: 'Google Chat',  Icon: Globe,  color: '#1a73e8', desc: 'Post alerts to a Google Chat space' },
  { key: 'webhook',     label: 'Webhook',      Icon: GitBranch, color: '#6b7280', desc: 'POST alert data to any custom HTTP endpoint' },
];

const CHANNEL_META = {
  sms:         { valueLabel: 'Phone Number',  valuePlaceholder: '+1 555 000 0000',                                namePlaceholder: 'Main Line',       hint: 'E.164 format — include country code' },
  discord:     { valueLabel: 'Webhook URL',   valuePlaceholder: 'https://discord.com/api/webhooks/...',          namePlaceholder: 'Ops Channel',     hint: 'Discord → channel settings → Integrations → Webhooks' },
  slack:       { valueLabel: 'Webhook URL',   valuePlaceholder: 'https://hooks.slack.com/services/...',          namePlaceholder: 'Ops Channel',     hint: 'Slack → App Directory → Incoming Webhooks' },
  email:       { valueLabel: 'Email Address', valuePlaceholder: 'alerts@company.com',                            namePlaceholder: 'Ops Email',       hint: 'Can be a personal or distribution list address' },
  teams:       { valueLabel: 'Webhook URL',   valuePlaceholder: 'https://...office365.com/webhook/...',          namePlaceholder: 'Main Teams',      hint: 'Teams → channel → ⋯ → Connectors → Incoming Webhook' },
  telegram:    { valueLabel: 'Chat ID',       valuePlaceholder: '-1001234567890',                                namePlaceholder: 'Ops Channel',     hint: 'Set TELEGRAM_BOT_TOKEN env var; use @userinfobot to get Chat ID' },
  google_chat: { valueLabel: 'Webhook URL',   valuePlaceholder: 'https://chat.googleapis.com/v1/spaces/...',    namePlaceholder: 'Ops Space',       hint: 'Google Chat → space → Manage webhooks → Add' },
  webhook:     { valueLabel: 'Webhook URL',   valuePlaceholder: 'https://your-server.com/hook',                  namePlaceholder: 'Custom Hook',     hint: 'Will receive a POST with JSON alert payload' },
};

const AIRPORT_DIST_OPTIONS = [1, 2, 3, 5, 7, 10, 15, 20];

// ── Shared primitives ─────────────────────────────────────────────────────────
const s = {
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12 },
  input: {
    width: '100%', padding: '9px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${BORDER}`,
    borderRadius: 8, color: '#f9fafb', fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  },
  label: {
    fontSize: 11, fontWeight: 600, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    display: 'block', marginBottom: 6,
  },
  btn: (variant = 'primary') => ({
    padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
    fontWeight: 600, border: 'none',
    background: variant === 'primary'
      ? `linear-gradient(135deg, ${G}, #16a37a)`
      : variant === 'danger'
      ? 'rgba(239,68,68,0.12)'
      : 'rgba(255,255,255,0.06)',
    color: variant === 'primary' ? '#0a0d12'
      : variant === 'danger' ? '#ef4444'
      : '#d1d5db',
  }),
  greenDot: { width: 8, height: 8, borderRadius: '50%', background: G, display: 'inline-block' },
  amberDot: { width: 8, height: 8, borderRadius: '50%', background: A, display: 'inline-block' },
  grayDot: { width: 8, height: 8, borderRadius: '50%', background: '#4b5563', display: 'inline-block' },
};

function Avatar({ email, size = 34 }) {
  const initials = (email || '??').split('@')[0].slice(0, 2).toUpperCase();
  const hue = [...(email || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue},30%,16%)`, border: `1px solid hsl(${hue},30%,26%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.floor(size * 0.33), fontWeight: 700,
      color: `hsl(${hue},55%,65%)`, flexShrink: 0,
    }}>{initials}</div>
  );
}

function Modal({ title, onClose, children, width = 420 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0f1319', border: `1px solid ${BORDER}`,
        borderRadius: 16, padding: 28, width, maxWidth: '92%',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)', maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f9fafb' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onConfirm, confirmLabel = 'Save', disabled }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
      <button onClick={onCancel} style={{ ...s.btn('ghost'), flex: 1 }}>Cancel</button>
      <button onClick={onConfirm} disabled={disabled} style={{ ...s.btn('primary'), flex: 1, opacity: disabled ? 0.5 : 1 }}>
        {confirmLabel}
      </button>
    </div>
  );
}

function FieldLabel({ children }) { return <label style={s.label}>{children}</label>; }

function Spinner() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
    <Loader2 size={24} color={G} style={{ animation: 'spin 1s linear infinite' }} />
  </div>;
}

function InlineError({ msg }) {
  if (!msg) return null;
  return <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8, background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: 8 }}>{msg}</div>;
}

function Badge({ color, children }) {
  return <span style={{
    background: color + '22', color, fontSize: 11, fontWeight: 700,
    padding: '2px 8px', borderRadius: 20, letterSpacing: '0.04em',
  }}>{children}</span>;
}

// ── Ops Status Bar ────────────────────────────────────────────────────────────
function OpsStatusBar({ onDuty = [], liveAircraft = [], claims = [], arrivals = [] }) {
  const inRange = liveAircraft.filter(a => a.status === 'in_airspace').length;
  const claimCount = claims.length;
  const upcomingArrivals = arrivals.filter(a => a.status === 'pending').length;
  return (
    <div style={{
      display: 'flex', gap: 24, alignItems: 'center',
      padding: '10px 20px',
      background: 'rgba(34,211,163,0.05)',
      borderBottom: `1px solid rgba(34,211,163,0.12)`,
      fontSize: 12, color: '#d1d5db', flexShrink: 0,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={s.greenDot} />
        <strong style={{ color: G }}>{onDuty.filter(m => m.on_duty).length}</strong> on duty
      </span>
      <span style={{ color: '#374151' }}>·</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Plane size={12} color={G} />
        <strong style={{ color: G }}>{inRange}</strong> in range
      </span>
      <span style={{ color: '#374151' }}>·</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <UserCheck size={12} color={claimCount > 0 ? A : '#6b7280'} />
        <strong style={{ color: claimCount > 0 ? A : '#6b7280' }}>{claimCount}</strong> claimed
      </span>
      <span style={{ color: '#374151' }}>·</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Clock size={12} color={upcomingArrivals > 0 ? A : '#6b7280'} />
        <strong style={{ color: upcomingArrivals > 0 ? A : '#6b7280' }}>{upcomingArrivals}</strong> expected
      </span>
    </div>
  );
}

// ── Tab: Operations ───────────────────────────────────────────────────────────
function OpsTab({ team, onDuty, liveAircraft, claims, arrivals, activity, onClaim, onRelease, onAck }) {
  const inRange = liveAircraft.filter(a => a.status === 'in_airspace');
  const unacked = activity.filter(a => !a.status?.startsWith('acked'));
  const upcoming = arrivals.filter(a => a.status === 'pending').slice(0, 5);
  const onDutyNow = onDuty.filter(m => m.on_duty);

  function etaCountdown(expected_at) {
    const diff = new Date(expected_at) - new Date();
    if (diff < 0) return 'Overdue';
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* On duty */}
      <section>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          On Duty Now
        </div>
        {onDutyNow.length === 0 ? (
          <div style={{ color: '#4b5563', fontSize: 13 }}>Nobody currently on duty — all channels active</div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {onDutyNow.map(m => (
              <div key={m.member_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <Avatar email={m.email} size={36} />
                  <span style={{ ...s.greenDot, position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, border: '2px solid ' + CARD }} />
                </div>
                <span style={{ fontSize: 13, color: '#d1d5db' }}>{m.display_name || m.email.split('@')[0]}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Aircraft in range */}
      <section>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Aircraft In Range
        </div>
        {inRange.length === 0 ? (
          <div style={{ color: '#4b5563', fontSize: 13 }}>No aircraft currently in airspace</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inRange.map(a => {
              const claim = claims.find(c => c.icao24 === a.icao24);
              return (
                <div key={a.icao24} style={{ ...s.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Plane size={16} color={G} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#f9fafb' }}>{a.tail_number}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {a.distance_nm?.toFixed(1)}nm · {a.altitude_ft_agl ? Math.round(a.altitude_ft_agl) + 'ft AGL' : 'On ground'}
                      {claim && <span style={{ color: A, marginLeft: 8 }}>✋ {claim.claimed_by_email?.split('@')[0]}</span>}
                    </div>
                  </div>
                  {claim
                    ? <button onClick={() => onRelease(a.icao24)} style={{ ...s.btn('ghost'), fontSize: 12, padding: '6px 12px' }}>Release</button>
                    : <button onClick={() => onClaim(a.icao24, a.tail_number)} style={{ ...s.btn('primary'), fontSize: 12, padding: '6px 12px' }}>Claim</button>
                  }
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Upcoming arrivals */}
      {upcoming.length > 0 && (
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Expected Arrivals
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.map(a => (
              <div key={a.id} style={{ ...s.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Clock size={15} color={A} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#f9fafb' }}>{a.tail_number}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{a.notes || 'No notes'}</div>
                </div>
                <Badge color={A}>{etaCountdown(a.expected_at)}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Unacknowledged alerts */}
      {unacked.length > 0 && (
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Pending Acknowledgement ({unacked.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unacked.slice(0, 5).map(log => (
              <div key={log.id} style={{ ...s.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderColor: 'rgba(239,68,68,0.15)' }}>
                <AlertTriangle size={14} color='#ef4444' />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#f9fafb' }}>{log.aircraft_tail} — {log.alert_type}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{log.message?.slice(0, 60)}</div>
                </div>
                <button onClick={() => onAck(log.id)} style={{ ...s.btn('primary'), fontSize: 12, padding: '6px 12px' }}>Ack</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Tab: Members ──────────────────────────────────────────────────────────────
function MembersTab({ team, myRole, onDuty, onRefresh }) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteNote, setInviteNote] = useState('');
  const [inviteTokens, setInviteTokens] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const members = team?.members || [];
  const canManage = myRole === 'owner' || myRole === 'admin';

  const loadTokens = useCallback(async () => {
    try { setInviteTokens(await APIService.listInviteTokens()); } catch { }
  }, []);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  const handleCreateInvite = async () => {
    try {
      const token = await APIService.createInviteToken(inviteNote || null);
      setInviteTokens(t => [...t, token]);
      setInviteNote('');
      setShowInviteModal(false);
    } catch (e) { setError(e.response?.data?.detail || 'Failed to create invite'); }
  };

  const handleRemove = async (memberId) => {
    if (!confirm('Remove this member?')) return;
    try { await APIService.removeMember(memberId); onRefresh(); } catch (e) { setError(e.response?.data?.detail || 'Failed to remove'); }
  };

  const handleDeleteToken = async (id) => {
    try { await APIService.deleteInviteToken(id); setInviteTokens(t => t.filter(x => x.id !== id)); } catch { }
  };

  const copyInviteLink = (token) => {
    const link = `finalpingapp://invite/${token.token}`;
    navigator.clipboard?.writeText(link);
  };

  const dutyMap = Object.fromEntries((onDuty || []).map(m => [m.user_id, m.on_duty]));

  const handleToggleDuty = async (member) => {
    const currently = dutyMap[member.user_id] || false;
    try { await APIService.setMemberDuty(member.id, !currently); onRefresh(); } catch { }
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#f9fafb' }}>Team Members ({members.length})</span>
        {canManage && <button onClick={() => setShowInviteModal(true)} style={s.btn('primary')}>+ Create Invite Link</button>}
      </div>
      <InlineError msg={error} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {members.map(m => {
          const rs = ROLE_STYLES[m.role] || ROLE_STYLES.member;
          const onDutyNow = dutyMap[m.user_id];
          return (
            <div key={m.id} style={{ ...s.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <Avatar email={m.email} />
                <span style={{ ...(onDutyNow ? s.greenDot : s.grayDot), position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, border: '2px solid ' + CARD }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#f9fafb' }}>{m.display_name || m.email.split('@')[0]}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{m.email}</div>
                <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
                  {m.custom_role_name ? <Badge color={m.custom_role_color || '#9ca3af'}>{m.custom_role_name}</Badge> : <Badge color={rs.color}>{rs.label}</Badge>}
                  {onDutyNow && <span style={{ marginLeft: 8, color: G, fontSize: 11 }}>● On Duty</span>}
                </div>
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleToggleDuty(m)} style={{ ...s.btn('ghost'), fontSize: 12, padding: '5px 10px' }}>
                    {onDutyNow ? 'Set Off Duty' : 'Set On Duty'}
                  </button>
                  {m.role !== 'owner' && myRole === 'owner' && (
                    <button onClick={() => handleRemove(m.id)} style={{ ...s.btn('danger'), fontSize: 12, padding: '5px 10px' }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pending invite tokens */}
      {inviteTokens.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Pending Invite Links
          </div>
          {inviteTokens.map(t => (
            <div key={t.id} style={{ ...s.card, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#9ca3af' }}>{t.token.slice(0, 12)}…</div>
                <div style={{ fontSize: 11, color: '#4b5563' }}>{t.note || 'No note'}</div>
              </div>
              <button onClick={() => copyInviteLink(t)} style={{ ...s.btn('ghost'), fontSize: 12, padding: '5px 10px', display: 'flex', gap: 5 }}>
                <Copy size={13} /> Copy
              </button>
              <button onClick={() => handleDeleteToken(t.id)} style={{ ...s.btn('danger'), padding: '5px 8px' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showInviteModal && (
        <Modal title="Create Invite Link" onClose={() => setShowInviteModal(false)}>
          <FieldLabel>Note (optional)</FieldLabel>
          <input value={inviteNote} onChange={e => setInviteNote(e.target.value)} placeholder="e.g. For John" style={s.input} />
          <ModalActions onCancel={() => setShowInviteModal(false)} onConfirm={handleCreateInvite} confirmLabel="Create Link" />
        </Modal>
      )}
    </div>
  );
}

// ── Tab: Schedule ─────────────────────────────────────────────────────────────
function ScheduleTab({ team, onDuty }) {
  const [shifts, setShifts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editShift, setEditShift] = useState(null);
  const [error, setError] = useState('');

  const members = team?.members || [];

  const loadShifts = useCallback(async () => {
    try { setShifts(await APIService.getTeamShifts()); } catch { }
  }, []);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this shift?')) return;
    try { await APIService.deleteTeamShift(id); loadShifts(); } catch (e) { setError(e.response?.data?.detail || 'Failed'); }
  };

  const onDutyNow = (onDuty || []).filter(m => m.on_duty);

  return (
    <div style={{ padding: 20 }}>
      {onDutyNow.length > 0 && (
        <div style={{ ...s.card, padding: '14px 18px', marginBottom: 20, background: 'rgba(34,211,163,0.04)', borderColor: 'rgba(34,211,163,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: G, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>On Duty Right Now</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {onDutyNow.map(m => (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar email={m.email} size={30} />
                <span style={{ fontSize: 12, color: '#d1d5db' }}>{m.display_name || m.email.split('@')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#f9fafb' }}>Shifts</span>
        <button onClick={() => { setEditShift(null); setShowModal(true); }} style={s.btn('primary')}>+ Add Shift</button>
      </div>
      <InlineError msg={error} />

      {shifts.length === 0 ? (
        <div style={{ color: '#4b5563', fontSize: 13, textAlign: 'center', paddingTop: 30 }}>No shifts configured yet</div>
      ) : shifts.map(shift => (
        <div key={shift.id} style={{ ...s.card, padding: '14px 18px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: shift.color || G, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#f9fafb', flex: 1 }}>{shift.name}</span>
            <button onClick={() => { setEditShift(shift); setShowModal(true); }} style={{ ...s.btn('ghost'), padding: '4px 8px' }}><Edit3 size={13} /></button>
            <button onClick={() => handleDelete(shift.id)} style={{ ...s.btn('danger'), padding: '4px 8px' }}><Trash2 size={13} /></button>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {(shift.start_date || shift.end_date) ? (
              <span style={{ fontSize: 12, color: G, fontWeight: 600 }}>
                {shift.start_date ? new Date(shift.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '?'}
                {' → '}
                {shift.end_date ? new Date(shift.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Ongoing'}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: '#6b7280' }}>Recurring</span>
            )}
            <span style={{ fontSize: 12, color: '#6b7280' }}>{shift.start_time}–{shift.end_time}</span>
            {shift.timezone && <span style={{ fontSize: 11, color: '#4b5563' }}>{shift.timezone}</span>}
          </div>
          {shift.members?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {shift.members.map(m => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Avatar email={m.email} size={22} />
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{m.display_name || m.email.split('@')[0]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {showModal && <ShiftModal
        shift={editShift}
        members={members}
        onClose={() => setShowModal(false)}
        onSave={loadShifts}
      />}
    </div>
  );
}

function ShiftModal({ shift, members, onClose, onSave }) {
  const [name, setName] = useState(shift?.name || '');
  const [startDate, setStartDate] = useState(shift?.start_date || '');
  const [endDate, setEndDate] = useState(shift?.end_date || '');
  const [startTime, setStartTime] = useState(shift?.start_time || '08:00');
  const [endTime, setEndTime] = useState(shift?.end_time || '17:00');
  const [tz, setTz] = useState(shift?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [color, setColor] = useState(shift?.color || G);
  const [userIds, setUserIds] = useState((shift?.members || []).map(m => m.user_id));
  const [error, setError] = useState('');

  const toggleMember = (id) => setUserIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);

  const handleSave = async () => {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      setError('End date must be after start date'); return;
    }
    try {
      const data = { name, start_date: startDate || null, end_date: endDate || null, start_time: startTime, end_time: endTime, timezone: tz, color, user_ids: userIds };
      if (shift) {
        await APIService.updateTeamShift(shift.id, data);
        await APIService.setShiftMembers(shift.id, userIds);
      } else {
        await APIService.createTeamShift(data);
      }
      onSave();
      onClose();
    } catch (e) { setError(e.response?.data?.detail || 'Failed to save shift'); }
  };

  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <Modal title={shift ? 'Edit Shift' : 'Add Shift'} onClose={onClose} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <FieldLabel>Shift Name</FieldLabel>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Morning shift" style={s.input} />
        </div>

        <div>
          <FieldLabel>Date Range</FieldLabel>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...s.input, colorScheme: 'dark', flex: 1 }} />
            <span style={{ color: '#4b5563', fontSize: 13, flexShrink: 0 }}>→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || undefined} style={{ ...s.input, colorScheme: 'dark', flex: 1 }} />
          </div>
          {startDate && endDate && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 5 }}>
              {fmtDate(startDate)} – {fmtDate(endDate)}
            </div>
          )}
          {(!startDate || !endDate) && (
            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 5 }}>Leave blank for a recurring shift with no end date</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Start Time</FieldLabel>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...s.input, colorScheme: 'dark' }} />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>End Time</FieldLabel>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...s.input, colorScheme: 'dark' }} />
          </div>
        </div>

        <div>
          <FieldLabel>Timezone</FieldLabel>
          <select value={tz} onChange={e => setTz(e.target.value)}
            style={{ ...s.input, colorScheme: 'dark', background: '#0d1117', color: '#f9fafb' }}>
            {(Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [
              'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
              'America/Anchorage','Pacific/Honolulu','Europe/London','Europe/Paris','Europe/Berlin',
              'Europe/Moscow','Asia/Dubai','Asia/Kolkata','Asia/Tokyo','Asia/Shanghai',
              'Australia/Sydney','Pacific/Auckland','UTC',
            ]).map(z => <option key={z} value={z} style={{ background: '#0d1117', color: '#f9fafb' }}>{z.replace(/_/g,' ')}</option>)}
          </select>
        </div>

        <div>
          <FieldLabel>Color</FieldLabel>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ ...s.input, width: 60, height: 36, padding: 2, cursor: 'pointer' }} />
        </div>

        <div>
          <FieldLabel>Assigned Members</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {members.map(m => (
              <label key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={userIds.includes(m.user_id)} onChange={() => toggleMember(m.user_id)} />
                <Avatar email={m.email} size={24} />
                <span style={{ fontSize: 13, color: '#d1d5db' }}>{m.name || m.display_name || m.email.split('@')[0]}</span>
                <span style={{ fontSize: 11, color: '#4b5563' }}>{m.email}</span>
              </label>
            ))}
          </div>
        </div>

        <InlineError msg={error} />
        <ModalActions onCancel={onClose} onConfirm={handleSave} confirmLabel={shift ? 'Update' : 'Create'} disabled={!name.trim()} />
      </div>
    </Modal>
  );
}

// ── Tab: Channels ─────────────────────────────────────────────────────────────
function ChannelsTab({ team, onRefresh }) {
  const [showAdd, setShowAdd] = useState(null);
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(null);

  const channels = team?.channels || [];

  const handleAdd = async () => {
    try {
      await APIService.addTeamChannel(showAdd, label.trim(), value.trim());
      setShowAdd(null); setLabel(''); setValue('');
      onRefresh();
    } catch (e) { setError(e.response?.data?.detail || 'Failed to add channel'); }
  };

  const handleRemove = async (id) => {
    setRemoving(id);
    try { await APIService.removeTeamChannel(id); onRefresh(); } catch { }
    setRemoving(null);
  };

  const meta = showAdd ? CHANNEL_META[showAdd] : null;
  const typeMeta = showAdd ? CHANNEL_TYPES.find(t => t.key === showAdd) : null;

  return (
    <div style={{ padding: 24, maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f9fafb', margin: '0 0 4px 0' }}>Notification Channels</h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Connect your preferred services to receive real-time aircraft alerts.</p>
      </div>
      <InlineError msg={error} />

      {/* Integration cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
        {CHANNEL_TYPES.map(({ key, label: lbl, Icon, color, desc }) => {
          const configured = channels.filter(c => c.integration_type === key);
          return (
            <div key={key} style={{ background: '#0f1319', border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 12, padding: '16px 16px 14px', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.boxShadow = `0 0 0 1px ${color}22`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none'; }}
              onClick={() => { setShowAdd(key); setLabel(''); setValue(''); setError(''); }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color={color} />
                </div>
                {configured.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#22d3a322', color: G, border: '1px solid #22d3a344' }}>
                    {configured.length} active
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb', marginBottom: 4 }}>{lbl}</div>
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>{desc}</div>
            </div>
          );
        })}
      </div>

      {/* Active channels list */}
      {channels.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Active Channels ({channels.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {channels.map(ch => {
              const ct = CHANNEL_TYPES.find(t => t.key === ch.integration_type);
              const Icon = ct?.Icon || Globe;
              const color = ct?.color || '#6b7280';
              return (
                <div key={ch.id} style={{ background: '#131b27', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb' }}>{ch.label}</div>
                    <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ct?.label} · {ch.value.length > 40 ? ch.value.slice(0, 40) + '…' : ch.value}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: G, boxShadow: `0 0 6px ${G}` }} />
                    <button onClick={() => handleRemove(ch.id)} disabled={removing === ch.id}
                      style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: removing === ch.id ? 'transparent' : '#ef444415', color: '#ef4444', cursor: removing === ch.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: removing === ch.id ? 0.5 : 1 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {channels.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 20px', background: '#0f1319', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.08)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(34,211,163,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Radio size={22} color={G} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f9fafb', marginBottom: 6 }}>No channels yet</div>
          <div style={{ fontSize: 13, color: '#4b5563' }}>Click any integration above to add your first channel.</div>
        </div>
      )}

      {showAdd && (
        <Modal title={`Connect ${typeMeta?.label}`} onClose={() => setShowAdd(null)} width={460}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Integration icon + desc */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: (typeMeta?.color || '#6b7280') + '12', borderRadius: 10, border: `1px solid ${typeMeta?.color || '#6b7280'}22` }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: (typeMeta?.color || '#6b7280') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {typeMeta && <typeMeta.Icon size={20} color={typeMeta.color} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb' }}>{typeMeta?.label}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{typeMeta?.desc}</div>
              </div>
            </div>
            <div>
              <FieldLabel>Channel Name</FieldLabel>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder={meta?.namePlaceholder || 'Channel name'} style={s.input} />
            </div>
            <div>
              <FieldLabel>{meta?.valueLabel || 'Value'}</FieldLabel>
              <input value={value} onChange={e => setValue(e.target.value)} placeholder={meta?.valuePlaceholder || ''} style={s.input} />
              {meta?.hint && <div style={{ fontSize: 11, color: '#4b5563', marginTop: 5 }}>{meta.hint}</div>}
            </div>
            <InlineError msg={error} />
            <ModalActions onCancel={() => setShowAdd(null)} onConfirm={handleAdd} disabled={!label.trim() || !value.trim()} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Tab: Routing ──────────────────────────────────────────────────────────────
function RoutingTab({ team, onRefresh }) {
  const [routing, setRouting] = useState(team?.routing || {});
  const [escalation, setEscalation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const channels = team?.channels || [];

  useEffect(() => {
    APIService.getEscalationConfig().then(setEscalation).catch(() => {});
  }, []);

  const toggleRoute = (alertType, channelId) => {
    setRouting(r => {
      const disabled = new Set(r[alertType] || []);
      if (disabled.has(channelId)) disabled.delete(channelId);
      else disabled.add(channelId);
      return { ...r, [alertType]: [...disabled] };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await APIService.updateTeamRouting(routing);
      if (escalation) await APIService.updateEscalationConfig(escalation);
      onRefresh();
    } catch (e) { setError(e.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const alertTypes = ['landing', 'takeoff', '10nm', '5nm', '2nm'];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#f9fafb' }}>Alert Routing</span>
        <button onClick={handleSave} disabled={saving} style={s.btn('primary')}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
      <InlineError msg={error} />

      {channels.length === 0 ? (
        <div style={{ color: '#4b5563', fontSize: 13 }}>Add channels first to configure routing</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Alert</th>
              {channels.map(ch => (
                <th key={ch.id} style={{ textAlign: 'center', padding: '8px 8px', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
                  {ch.label.slice(0, 12)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alertTypes.map(at => (
              <tr key={at} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ padding: '10px 12px', fontSize: 13, color: '#d1d5db', textTransform: 'capitalize' }}>{at}</td>
                {channels.map(ch => {
                  const disabled = (routing[at] || []).includes(ch.id);
                  return (
                    <td key={ch.id} style={{ textAlign: 'center', padding: '10px 8px' }}>
                      <button onClick={() => toggleRoute(at, ch.id)} style={{
                        width: 22, height: 22, borderRadius: 6, border: `1px solid ${disabled ? BORDER : G}`,
                        background: disabled ? 'transparent' : 'rgba(34,211,163,0.15)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto',
                      }}>
                        {!disabled && <Check size={13} color={G} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Escalation config */}
      {escalation && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={14} color="#f87171" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb' }}>Alert Escalation</div>
              <div style={{ fontSize: 11, color: '#4b5563' }}>Automatically re-notify if an alert is not acknowledged</div>
            </div>
          </div>
          <div style={{ background: '#0f1319', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Toggle row */}
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: escalation.enabled ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f9fafb' }}>Enable escalation</div>
                <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>Re-alert team members when alerts go unacknowledged</div>
              </div>
              <div onClick={() => setEscalation(x => ({ ...x, enabled: !x.enabled }))}
                style={{ width: 44, height: 24, borderRadius: 12, background: escalation.enabled ? G : '#1e2a3a', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: escalation.enabled ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
              </div>
            </div>
            {escalation.enabled && (
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Level 1 */}
                <div style={{ background: '#131b27', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Level 1 — First Escalation</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <FieldLabel>Escalate after</FieldLabel>
                      <div style={{ position: 'relative' }}>
                        <input type="number" value={escalation.first_escalation_minutes} min={1}
                          onChange={e => setEscalation(x => ({ ...x, first_escalation_minutes: +e.target.value }))} style={s.input} />
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#4b5563' }}>min</span>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <FieldLabel>Notify</FieldLabel>
                      <select value={escalation.first_escalation_target}
                        onChange={e => setEscalation(x => ({ ...x, first_escalation_target: e.target.value }))}
                        style={{ ...s.input, colorScheme: 'dark' }}>
                        <option value="all_admins">All Admins</option>
                        <option value="owner">Team Owner</option>
                        <option value="all_members">All Members</option>
                      </select>
                    </div>
                  </div>
                </div>
                {/* Level 2 */}
                <div style={{ background: '#131b27', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Level 2 — Critical Escalation</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <FieldLabel>Escalate after</FieldLabel>
                      <div style={{ position: 'relative' }}>
                        <input type="number" value={escalation.second_escalation_minutes} min={1}
                          onChange={e => setEscalation(x => ({ ...x, second_escalation_minutes: +e.target.value }))} style={s.input} />
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#4b5563' }}>min</span>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <FieldLabel>Notify</FieldLabel>
                      <select value={escalation.second_escalation_target}
                        onChange={e => setEscalation(x => ({ ...x, second_escalation_target: e.target.value }))}
                        style={{ ...s.input, colorScheme: 'dark' }}>
                        <option value="all_admins">All Admins</option>
                        <option value="owner">Team Owner</option>
                        <option value="all_members">All Members</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Aircraft ─────────────────────────────────────────────────────────────
function AircraftTab({ myRole }) {
  const FALLBACK_DISTS = [10, 5, 2];
  const makeEmpty = (dists) => ({ icao24: '', tail_number: '', aircraft_type: '', alert_distances: [...dists], color: '' });

  const [aircraft, setAircraft] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalDists, setGlobalDists] = useState(FALLBACK_DISTS);
  const [form, setForm] = useState(makeEmpty(FALLBACK_DISTS));
  const [editingId, setEditingId] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [msg, setMsg] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [colorVer, setColorVer] = useState(0);
  const lookupTimer = useRef(null);
  const canManage = myRole === 'owner' || myRole === 'admin';

  useEffect(() => {
    ensureLoaded().then(() => setColorVer(v => v + 1));
    load();
    APIService.getAirportConfig().then(cfg => {
      if (cfg?.alert_distances_nm?.length) {
        const d = cfg.alert_distances_nm.map(Number).sort((a, b) => b - a);
        setGlobalDists(d); setForm(makeEmpty(d));
      }
    }).catch(() => {});
  }, []);

  const load = async () => {
    try { setAircraft(await APIService.getAircraft() || []); }
    catch { showMsg('error', 'Failed to load aircraft'); }
    finally { setLoading(false); }
  };

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); };

  const lookupIcao = async (icao) => {
    setLookingUp(true);
    try {
      const res = await fetch(`https://api.adsbdb.com/v0/aircraft/${icao}`);
      if (res.ok) {
        const info = (await res.json())?.response?.aircraft;
        if (info) setForm(p => ({ ...p, tail_number: info.registration || p.tail_number, aircraft_type: info.type || info.manufacturer_name || '' }));
      }
    } catch { }
    setLookingUp(false);
  };

  const handleIcaoChange = (val) => {
    const v = val.toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 6);
    setForm(p => ({ ...p, icao24: v, tail_number: '', aircraft_type: '' }));
    clearTimeout(lookupTimer.current);
    if (v.length === 6) lookupTimer.current = setTimeout(() => lookupIcao(v), 300);
  };

  const toggleDist = (d) => setForm(p => {
    const has = p.alert_distances.includes(d);
    if (has && p.alert_distances.length === 1) return p;
    return { ...p, alert_distances: has ? p.alert_distances.filter(x => x !== d) : [...p.alert_distances, d].sort((a, b) => b - a) };
  });

  const startEdit = (a) => { setEditingId(a.id); setForm({ icao24: a.icao24 || '', tail_number: a.tail_number || '', aircraft_type: a.aircraft_type || '', alert_distances: a.alert_distances || [...globalDists], color: getColor(a.tail_number) }); };
  const cancelEdit = () => { setEditingId(null); setForm(makeEmpty(globalDists)); };

  const handleSave = async () => {
    if (!form.icao24 || form.icao24.length !== 6) { showMsg('error', 'Enter a valid 6-character ICAO24 hex code'); return; }
    if (!form.tail_number.trim()) { showMsg('error', 'Tail number is required'); return; }
    setSaving(true);
    try {
      const tail = form.tail_number.toUpperCase();
      if (editingId) { await APIService.updateAircraft(editingId, tail, form.icao24, null, form.aircraft_type || null, form.alert_distances); showMsg('success', `${tail} updated`); setEditingId(null); }
      else { await APIService.addAircraft(tail, form.icao24, null, form.aircraft_type || null, form.alert_distances); showMsg('success', `${tail} added`); }
      if (form.color) { await setColor(form.tail_number.toUpperCase(), form.color); setColorVer(v => v + 1); }
      await load(); setForm(makeEmpty(globalDists));
    } catch (err) { showMsg('error', err.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, tailNum) => {
    try { await new Promise((res, rej) => setConfirmModal({ message: `Remove ${tailNum} from tracking?`, onConfirm: res, onCancel: rej })); setConfirmModal(null); }
    catch { setConfirmModal(null); return; }
    setDeleting(id);
    try { await APIService.deleteAircraft(id); setAircraft(prev => prev.filter(a => a.id !== id)); if (editingId === id) cancelEdit(); showMsg('success', `${tailNum} removed`); }
    catch { showMsg('error', 'Failed to remove aircraft'); }
    finally { setDeleting(null); }
  };

  const inp = { width: '100%', padding: '10px 14px', background: '#0d1117', border: '1px solid #1f2937', borderRadius: '8px', color: '#f9fafb', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
  const formColor = form.color || (form.tail_number ? getColor(form.tail_number.toUpperCase()) : '#38bdf8');

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Loading aircraft...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: canManage ? '1fr 360px' : '1fr', gap: 24, padding: 24, alignItems: 'start' }}>
      {/* Confirm modal */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f1117', border: '1px solid #2d3748', borderRadius: 16, padding: 32, maxWidth: 380, width: '100%' }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 16 }}>✈️</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f9fafb', margin: '0 0 8px 0', textAlign: 'center' }}>Remove Aircraft</h2>
            <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', margin: '0 0 24px 0' }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => confirmModal.onCancel()} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'transparent', border: '1px solid #374151', color: '#9ca3af', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => confirmModal.onConfirm()} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Left — list */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>AIRCRAFT</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#f9fafb', margin: '0 0 4px 0' }}>Team Fleet</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>{aircraft.length} aircraft tracked</p>

        {msg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13, background: msg.type === 'error' ? '#ef444420' : '#34d39920', border: `1px solid ${msg.type === 'error' ? '#ef444440' : '#34d39940'}`, color: msg.type === 'error' ? '#fca5a5' : '#6ee7b7' }}>
            <AlertCircle size={15} />{msg.text}
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Tail', 'ICAO24', 'Model', 'Alerts', 'Status', canManage ? '' : null].filter(Boolean).map(h => (
                <th key={h} style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 12px 10px', textAlign: h === '' ? 'right' : 'left', borderBottom: '1px solid #1f2937' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {aircraft.length === 0 ? (
              <tr><td colSpan={canManage ? 6 : 5} style={{ textAlign: 'center', padding: '48px 20px', color: '#4b5563', fontSize: 13 }}>No aircraft yet — add your first tail number on the right.</td></tr>
            ) : aircraft.map(a => (
              <tr key={a.id} style={{ background: editingId === a.id ? 'rgba(59,130,246,0.05)' : 'transparent' }}>
                <td style={{ padding: '14px 12px', borderBottom: '1px solid #111827', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div title="Click to change color" onClick={() => document.getElementById(`cp-${a.id}`).click()} style={{ width: 12, height: 12, borderRadius: '50%', background: getColor(a.tail_number), cursor: 'pointer', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.2)' }} />
                    <input id={`cp-${a.id}`} type="color" value={getColor(a.tail_number)} onChange={e => { setColor(a.tail_number, e.target.value); setColorVer(v => v + 1); }} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#f9fafb' }}>{a.tail_number}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 12px', borderBottom: '1px solid #111827', fontSize: 13, color: '#6b7280', fontFamily: 'monospace' }}>{a.icao24 || '—'}</td>
                <td style={{ padding: '14px 12px', borderBottom: '1px solid #111827', fontSize: 12, color: '#9ca3af' }}>{a.aircraft_type || '—'}</td>
                <td style={{ padding: '14px 12px', borderBottom: '1px solid #111827' }}>
                  {globalDists.map(d => (
                    <span key={d} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, marginRight: 4, background: (a.alert_distances || globalDists).includes(d) ? 'rgba(14,165,233,0.12)' : 'rgba(255,255,255,0.04)', color: (a.alert_distances || globalDists).includes(d) ? '#38bdf8' : '#374151', border: `1px solid ${(a.alert_distances || globalDists).includes(d) ? 'rgba(14,165,233,0.25)' : '#1f2937'}` }}>{d}nm</span>
                  ))}
                </td>
                <td style={{ padding: '14px 12px', borderBottom: '1px solid #111827', textAlign: 'right' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#34d39920', color: '#34d399', border: '1px solid #34d39930' }}>● ACTIVE</span>
                </td>
                {canManage && (
                  <td style={{ padding: '14px 12px', borderBottom: '1px solid #111827', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: '#60a5fa15', color: '#60a5fa', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => editingId === a.id ? cancelEdit() : startEdit(a)}><Edit2 size={13} /></button>
                    {' '}
                    <button style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: '#ef444415', color: '#ef4444', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleDelete(a.id, a.tail_number)} disabled={deleting === a.id}>
                      {deleting === a.id ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Right — panel */}
      {canManage && (
        <div style={{ position: 'sticky', top: 0, marginTop: 74 }}>
          <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #172035 100%)', border: '1px solid #3b82f620', borderRadius: 16, padding: 24, boxShadow: '0 0 0 1px #3b82f615, 0 8px 32px rgba(59,130,246,0.1)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>ADD AIRCRAFT</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f9fafb', marginBottom: 20 }}>{editingId ? 'Edit tail' : 'Track new tail'}</div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>ICAO 24-BIT HEX</label>
              <input style={inp} placeholder="a4992d" value={form.icao24} onChange={e => handleIcaoChange(e.target.value)} onFocus={e => e.target.style.borderColor = '#0ea5e9'} onBlur={e => e.target.style.borderColor = '#1f2937'} />
              <p style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>Find on <span style={{ color: '#38bdf8', cursor: 'pointer' }} onClick={() => window.electronAPI?.openExternal('https://globe.adsbexchange.com')}>ADSBExchange</span></p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>TAIL NUMBER</label>
                <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600 }}>{lookingUp ? '● looking up...' : '+ AUTO'}</span>
              </div>
              <input style={inp} placeholder="N504GR" value={form.tail_number} onChange={e => setForm(p => ({ ...p, tail_number: e.target.value.toUpperCase() }))} onFocus={e => e.target.style.borderColor = '#0ea5e9'} onBlur={e => e.target.style.borderColor = '#1f2937'} maxLength={10} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>AIRCRAFT TYPE</label>
                <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600 }}>+ AUTO</span>
              </div>
              <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 8, padding: '10px 14px', color: form.aircraft_type ? '#e5e7eb' : '#374151', fontSize: 14, minHeight: 40, display: 'flex', alignItems: 'center' }}>
                {form.aircraft_type || <span style={{ fontStyle: 'italic', fontSize: 13 }}>Auto-filled from ICAO lookup</span>}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>MAP COLOR</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div onClick={() => document.getElementById('ac-form-color').click()} style={{ width: 36, height: 36, borderRadius: '50%', background: formColor, cursor: 'pointer', flexShrink: 0, border: '2px solid rgba(255,255,255,0.15)', boxShadow: `0 0 10px ${formColor}70` }} />
                <input id="ac-form-color" type="color" value={formColor} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                <input style={{ ...inp, fontFamily: 'monospace', fontSize: 13 }} value={formColor} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setForm(p => ({ ...p, color: e.target.value })); }} maxLength={7} placeholder="#38bdf8" onFocus={e => e.target.style.borderColor = '#0ea5e9'} onBlur={e => e.target.style.borderColor = '#1f2937'} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>ALERT DISTANCES</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {globalDists.map(d => {
                  const active = form.alert_distances.includes(d);
                  return (
                    <button key={d} onClick={() => toggleDist(d)} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${active ? 'rgba(14,165,233,0.4)' : '#1f2937'}`, background: active ? 'rgba(14,165,233,0.12)' : '#0d1117', color: active ? '#38bdf8' : '#4b5563', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {d} nm
                    </button>
                  );
                })}
              </div>
            </div>

            <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 12, background: saving ? '#374151' : 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Plane size={15} /> {editingId ? 'Save changes' : '+ Track aircraft'}</>}
            </button>
            {editingId && (
              <button onClick={cancelEdit} style={{ width: '100%', padding: 10, marginTop: 8, background: 'none', border: '1px solid #1f2937', borderRadius: 10, color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancel edit</button>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Tab: Airports ─────────────────────────────────────────────────────────────
function AirportsTab({ myRole }) {
  const [airports, setAirports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState(null);
  const [alertDistances, setAlertDistances] = useState([2, 5, 10]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingDistances, setEditingDistances] = useState(null); // { id, airport_code, dists }
  const searchRef = useRef(null);
  // Add-form map refs
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const ringsRef = useRef([]);
  const runwaysRef = useRef([]);
  // Overview map refs (shown below saved airport list)
  const listMapDivRef = useRef(null);
  const listMapRef = useRef(null);
  const listMarkersRef = useRef([]);
  const listRingsRef = useRef([]);
  const canManage = myRole === 'owner' || myRole === 'admin';

  const load = useCallback(async () => {
    try { setAirports(await APIService.getTeamAirports() || []); }
    catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Combined: init + draw for the add-form preview map. Uses rAF so div is in DOM.
  useEffect(() => {
    if (!selectedAirport) {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      return;
    }
    const raf = requestAnimationFrame(() => {
      if (!mapDivRef.current) return;
      if (!mapRef.current) {
        const m = L.map(mapDivRef.current, { center: [39.5, -98.35], zoom: 4, zoomControl: true, attributionControl: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(m);
        mapRef.current = m;
      }
      const map = mapRef.current;
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      ringsRef.current.forEach(l => l.remove()); ringsRef.current = [];
      runwaysRef.current.forEach(l => l.remove()); runwaysRef.current = [];
      const { lat, lon } = selectedAirport;
      map.invalidateSize(); map.setView([lat, lon], 12);
      const dotIcon = L.divIcon({ html: `<div style="width:10px;height:10px;background:#38bdf8;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px #38bdf8"></div>`, className: '', iconSize: [10, 10], iconAnchor: [5, 5] });
      markerRef.current = L.marker([lat, lon], { icon: dotIcon }).addTo(map);
      const cosLat = Math.cos(lat * Math.PI / 180);
      const identToHdg = (id) => { const n = parseInt(id); return (n >= 1 && n <= 36) ? n * 10 : null; };
      for (const rw of (selectedAirport.runways || [])) {
        const leHdg = rw.leHdg ?? identToHdg(rw.leIdent);
        let lePt, hePt;
        if (rw.leLat != null && rw.leLon != null && rw.heLat != null && rw.heLon != null) {
          lePt = [rw.leLat, rw.leLon]; hePt = [rw.heLat, rw.heLon];
        } else if (leHdg != null && rw.lengthFt > 0 && !/[LRC]$/i.test(rw.leIdent || '')) {
          const hM = (rw.lengthFt * 0.3048) / 2; const hRad = (leHdg * Math.PI) / 180;
          lePt = [lat - (hM / 111320) * Math.cos(hRad), lon - (hM / (111320 * cosLat)) * Math.sin(hRad)];
          hePt = [lat + (hM / 111320) * Math.cos(hRad), lon + (hM / (111320 * cosLat)) * Math.sin(hRad)];
        } else continue;
        runwaysRef.current.push(L.polyline([lePt, hePt], { color: '#fff', weight: 5, opacity: 0.9 }).addTo(map));
        const rwLbl = (pt, txt) => L.marker(pt, { icon: L.divIcon({ html: `<div style="font-size:9px;font-weight:800;color:#fff;background:rgba(0,0,0,0.75);padding:1px 5px;border-radius:3px;white-space:nowrap">${txt}</div>`, className: '', iconAnchor: [12, 6] }), interactive: false }).addTo(map);
        if (rw.leIdent) runwaysRef.current.push(rwLbl(lePt, rw.leIdent));
        if (rw.heIdent) runwaysRef.current.push(rwLbl(hePt, rw.heIdent));
      }
      for (const nm of [10, 5, 2]) {
        const c = L.circle([lat, lon], { radius: nm * NM_TO_M, color: '#38bdf8', weight: 2, opacity: 0.8, fill: false }).addTo(map);
        const lbl = L.marker(L.latLng(lat + (nm * NM_TO_M) / 111320, lon), { icon: L.divIcon({ html: `<div style="font-size:10px;font-weight:700;color:#38bdf8;white-space:nowrap;background:rgba(13,17,23,0.7);padding:1px 4px;border-radius:3px">${nm} nm</div>`, className: '', iconAnchor: [16, 8] }), interactive: false }).addTo(map);
        ringsRef.current.push(c, lbl);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedAirport]);

  // Overview map: shown below the saved airport list, with runways drawn from airports.json
  useEffect(() => {
    if (loading || airports.length === 0) return;
    const timer = setTimeout(() => {
      if (!listMapDivRef.current) return;
      if (!listMapRef.current) {
        const m = L.map(listMapDivRef.current, { center: [39.5, -98.35], zoom: 4, zoomControl: true, attributionControl: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(m);
        listMapRef.current = m;
      }
      const map = listMapRef.current;
      listMarkersRef.current.forEach(l => l.remove()); listMarkersRef.current = [];
      listRingsRef.current.forEach(l => l.remove()); listRingsRef.current = [];
      const bounds = [];
      const identToHdg = (id) => { const n = parseInt(id); return (n >= 1 && n <= 36) ? n * 10 : null; };

      airports.forEach(a => {
        const lat = Number(a.latitude); const lon = Number(a.longitude);
        if (!lat || !lon) return;
        const color = a.is_active ? '#22d3a3' : '#38bdf8';

        // Dot marker
        const dotIcon = L.divIcon({ html: `<div style="width:10px;height:10px;background:${color};border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px ${color}"></div>`, className: '', iconSize: [10, 10], iconAnchor: [5, 5] });
        const marker = L.marker([lat, lon], { icon: dotIcon }).addTo(map);
        marker.bindPopup(L.popup({ closeButton: false, className: 'ap-popup' }).setContent(`<div style="background:#131b27;border:1px solid #1e2a3a;border-radius:6px;padding:6px 10px;font-size:12px;color:#f9fafb;white-space:nowrap"><strong>${a.airport_code}</strong> · ${a.airport_name}</div>`));
        listMarkersRef.current.push(marker);

        // Rings
        for (const nm of [10, 5, 2]) {
          listRingsRef.current.push(L.circle([lat, lon], { radius: nm * NM_TO_M, color, weight: nm === 2 ? 2 : 1, opacity: nm === 2 ? 0.8 : 0.4, fill: false, dashArray: nm === 10 ? '6,6' : nm === 5 ? '4,4' : '' }).addTo(map));
          const lbl = L.marker(L.latLng(lat + (nm * NM_TO_M) / 111320, lon), { icon: L.divIcon({ html: `<div style="font-size:10px;font-weight:700;color:${color};opacity:0.8;white-space:nowrap;background:rgba(13,17,23,0.7);padding:1px 4px;border-radius:3px">${nm} nm</div>`, className: '', iconAnchor: [16, 8] }), interactive: false }).addTo(map);
          listRingsRef.current.push(lbl);
        }

        // Runways — look up from airports.json by ICAO code
        const entry = airportsData.find(r => r[0] === a.airport_code);
        if (entry) {
          const cosLat = Math.cos(lat * Math.PI / 180);
          const runways = toAirport(entry).runways;
          for (const rw of runways) {
            const leHdg = rw.leHdg ?? identToHdg(rw.leIdent);
            let lePt, hePt;
            if (rw.leLat != null && rw.leLon != null && rw.heLat != null && rw.heLon != null) {
              lePt = [rw.leLat, rw.leLon]; hePt = [rw.heLat, rw.heLon];
            } else if (leHdg != null && rw.lengthFt > 0 && !/[LRC]$/i.test(rw.leIdent || '')) {
              const hM = (rw.lengthFt * 0.3048) / 2; const hRad = (leHdg * Math.PI) / 180;
              lePt = [lat - (hM / 111320) * Math.cos(hRad), lon - (hM / (111320 * cosLat)) * Math.sin(hRad)];
              hePt = [lat + (hM / 111320) * Math.cos(hRad), lon + (hM / (111320 * cosLat)) * Math.sin(hRad)];
            } else continue;
            listMarkersRef.current.push(L.polyline([lePt, hePt], { color: '#fff', weight: 5, opacity: 0.9 }).addTo(map));
            const rwLbl = (pt, txt) => L.marker(pt, { icon: L.divIcon({ html: `<div style="font-size:9px;font-weight:800;color:#fff;background:rgba(0,0,0,0.75);padding:1px 5px;border-radius:3px;white-space:nowrap">${txt}</div>`, className: '', iconAnchor: [12, 6] }), interactive: false }).addTo(map);
            if (rw.leIdent) listMarkersRef.current.push(rwLbl(lePt, rw.leIdent));
            if (rw.heIdent) listMarkersRef.current.push(rwLbl(hePt, rw.heIdent));
          }
        }
        bounds.push([lat, lon]);
      });

      map.invalidateSize();
      if (bounds.length === 1) map.setView(bounds[0], 11);
      else if (bounds.length > 1) map.fitBounds(bounds, { padding: [60, 60] });
    }, 100);
    return () => clearTimeout(timer);
  }, [loading, airports]);

  // Destroy overview map when all airports removed
  useEffect(() => {
    if (!loading && airports.length === 0 && listMapRef.current) {
      listMapRef.current.remove(); listMapRef.current = null;
    }
  }, [loading, airports]);

  useEffect(() => {
    const h = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleSearch = (val) => {
    setSearchQuery(val);
    if (val.length >= 2) { setSuggestions(searchAirports(val)); setShowDropdown(true); }
    else { setSuggestions([]); setShowDropdown(false); }
  };

  const selectAirport = (ap) => {
    setSelectedAirport(ap); setSearchQuery(ap.icao); setShowDropdown(false); setSuggestions([]);
  };

  const toggleDist = (d) => setAlertDistances(prev =>
    prev.includes(d)
      ? prev.length === 1 ? prev : prev.filter(x => x !== d)
      : [...prev, d].sort((a, b) => a - b)
  );

  const handleAdd = async () => {
    if (!selectedAirport) return;
    setSaving(true);
    try {
      await APIService.addTeamAirport({ airport_code: selectedAirport.icao, airport_name: selectedAirport.name, latitude: selectedAirport.lat, longitude: selectedAirport.lon, elevation_ft_msl: selectedAirport.elev || 0, alert_distances_nm: alertDistances });
      setShowAdd(false); setSelectedAirport(null); setSearchQuery(''); setAlertDistances([2, 5, 10]);
      setMsg({ type: 'success', text: `${selectedAirport.icao} added` }); setTimeout(() => setMsg(null), 4000);
      await load();
    } catch (e) {
      const detail = e.response?.data?.detail;
      const text = detail || (e.response?.status === 403 ? 'Your plan does not allow additional airports. Upgrade to add more.' : 'Failed to add airport');
      setMsg({ type: 'error', text }); setTimeout(() => setMsg(null), 6000);
    }
    finally { setSaving(false); }
  };

  const handleSetActive = async (id) => { try { await APIService.setActiveAirport(id); await load(); } catch { } };
  const handleDelete = async (id) => { setConfirmDelete(null); try { await APIService.deleteTeamAirport(id); await load(); } catch { } };
  const handleSaveDists = async () => {
    if (!editingDistances) return;
    try {
      await APIService.updateTeamAirport(editingDistances.id, { alert_distances_nm: editingDistances.dists.map(String) });
      setEditingDistances(null); await load();
    } catch { }
  };

  const inp = { width: '100%', padding: '11px 14px', background: '#0d1117', border: '2px solid #1e2a3a', borderRadius: 8, color: '#f9fafb', fontSize: 15, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' };

  return (
    <div style={{ maxWidth: 820, padding: 24 }}>
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f1117', border: '1px solid #2d3748', borderRadius: 16, padding: 32, maxWidth: 380, width: '100%' }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 16 }}>🗑️</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f9fafb', margin: '0 0 8px 0', textAlign: 'center' }}>Remove Airport</h2>
            <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', margin: '0 0 24px 0' }}>Remove <strong style={{ color: '#f9fafb' }}>{confirmDelete.code}</strong> from the team?</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'transparent', border: '1px solid #374151', color: '#9ca3af', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete.id)} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit alert distances modal */}
      {editingDistances && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f1117', border: '1px solid #2d3748', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f9fafb', margin: '0 0 4px 0' }}>Alert Distances</h2>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 18px 0' }}>Choose which proximity distances trigger alerts for <strong style={{ color: '#f9fafb' }}>{editingDistances.airport_code}</strong></p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {AIRPORT_DIST_OPTIONS.map(d => {
                const on = editingDistances.dists.includes(d);
                return (
                  <button key={d} onClick={() => setEditingDistances(prev => {
                    const has = prev.dists.includes(d);
                    if (has && prev.dists.length === 1) return prev;
                    return { ...prev, dists: has ? prev.dists.filter(x => x !== d) : [...prev.dists, d].sort((a,b) => b-a) };
                  })} style={{ padding: '8px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, border: 'none', background: on ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)', color: on ? '#38bdf8' : '#4b5563', outline: on ? '1.5px solid rgba(56,189,248,0.4)' : '1px solid transparent' }}>
                    {d} nm
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 20 }}>Selected: {editingDistances.dists.join(', ')} nm — aircraft triggers alerts at these distances</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditingDistances(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'transparent', border: '1px solid #374151', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveDists} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #1a2030', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Airport Config</p>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#f9fafb', margin: '0 0 4px 0' }}>Team Airports</h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Configure destination airports the team is watching.</p>
        </div>
        {canManage && !showAdd && (
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 18px', borderRadius: 10, background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>+ Add Airport</button>
        )}
      </div>

      {msg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13, background: msg.type === 'error' ? '#ef444420' : '#34d39920', border: `1px solid ${msg.type === 'error' ? '#ef444440' : '#34d39940'}`, color: msg.type === 'error' ? '#fca5a5' : '#6ee7b7' }}>
          <AlertCircle size={15} />{msg.text}
        </div>
      )}

      {/* Airport list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280', fontSize: 13 }}>Loading...</div>
        ) : airports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#4b5563', fontSize: 13 }}>
            <MapPin size={28} color="#2d3748" style={{ display: 'block', margin: '0 auto 10px' }} />
            No airports configured yet
          </div>
        ) : airports.map(a => {
          const dists = (a.alert_distances_nm || ['10', '5', '2']).map(Number).sort((x,y) => y - x);
          return (
            <div key={a.id} style={{ background: '#131b27', border: `1px solid ${a.is_active ? 'rgba(34,211,163,0.25)' : '#1e2a3a'}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, background: a.is_active ? 'rgba(34,211,163,0.12)' : '#1e3a5f', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: a.is_active ? G : '#60a5fa', flexShrink: 0 }}>
                {(a.airport_code || '???').slice(0, 4)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#f9fafb' }}>{a.airport_name || a.airport_code}</span>
                  {a.is_active && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(34,211,163,0.12)', color: G, border: '1px solid rgba(34,211,163,0.25)' }}>Active</span>}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{a.airport_code} · {Number(a.latitude).toFixed(4)}, {Number(a.longitude).toFixed(4)} · Elev {a.elevation_ft_msl} ft</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {dists.map(d => (
                    <span key={d} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}>{d} nm</span>
                  ))}
                  {canManage && (
                    <button onClick={() => setEditingDistances({ id: a.id, airport_code: a.airport_code, dists })}
                      style={{ fontSize: 11, color: '#38bdf8', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', cursor: 'pointer', padding: '2px 10px', borderRadius: 6, fontWeight: 600 }}>
                      Edit Distances
                    </button>
                  )}
                </div>
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {!a.is_active && <button onClick={() => handleSetActive(a.id)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)', color: '#38bdf8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Set Active</button>}
                  <button onClick={() => setConfirmDelete({ id: a.id, code: a.airport_code })} style={{ width: 32, height: 32, borderRadius: 7, border: 'none', background: '#ef444415', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overview map — always visible when airports exist */}
      {!loading && airports.length > 0 && (
        <div style={{ border: '1px solid #1e2a3a', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid #1e2a3a' }}>Airport Overview</div>
          <div style={{ height: 300 }}><div ref={listMapDivRef} style={{ width: '100%', height: '100%' }} /></div>
        </div>
      )}
      {!loading && airports.length > 0 && (
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20, padding: '0 2px', display: 'flex', alignItems: 'center', gap: 8 }}>
          Missing a runway at your airport?
          <button
            onClick={() => window.electronAPI?.openExternal('https://finalpingapp.com/contact')}
            style={{ fontSize: 12, fontWeight: 600, color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >Contact us</button>
          and we'll add it to the next update.
        </div>
      )}

      {canManage && showAdd && (
        <div style={{ background: '#131b27', border: '1px solid #1e2a3a', borderRadius: 14, padding: 24, marginTop: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f9fafb', marginBottom: 16 }}>Add Airport</div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Search Airport</label>
            <div ref={searchRef} style={{ position: 'relative' }}>
              <input style={{ ...inp, borderColor: showDropdown ? '#38bdf8' : '#1e2a3a' }} type="text" value={searchQuery} placeholder="ICAO, IATA, city, or airport name" onChange={e => handleSearch(e.target.value)} onFocus={() => { if (suggestions.length) setShowDropdown(true); }} />
              {showDropdown && suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#131b27', border: '1px solid #1e2a3a', borderRadius: 8, marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  {suggestions.map(ap => (
                    <div key={ap.icao} onMouseDown={() => selectAirport(ap)}
                      style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', gap: 12, borderBottom: '1px solid #1a2030' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1a2a40'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ minWidth: 36, height: 36, background: ap.iata ? '#1e3a5f' : '#1a2030', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: ap.iata ? '#60a5fa' : '#4b5563', flexShrink: 0 }}>{ap.iata || ap.icao.slice(0, 3)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb' }}><span style={{ color: '#38bdf8' }}>{ap.icao}</span><span style={{ color: '#4b5563', fontWeight: 400 }}> · {ap.name}</span></div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{ap.city}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedAirport && (
            <div style={{ background: '#0d1117', border: '1px solid #1e2a3a', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, background: '#1e3a5f', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#60a5fa', flexShrink: 0 }}>{selectedAirport.iata || selectedAirport.icao.slice(0, 3)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb' }}>{selectedAirport.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{selectedAirport.icao} · {Number(selectedAirport.lat).toFixed(4)}, {Number(selectedAirport.lon).toFixed(4)} · Elev {selectedAirport.elev} ft</div>
              </div>
              <button onClick={() => { setSelectedAirport(null); setSearchQuery(''); }} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#ef444415', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
            </div>
          )}

          {selectedAirport && (
            <div style={{ marginBottom: 16, border: '1px solid #1e2a3a', borderRadius: 10, overflow: 'hidden', background: '#0d1117' }}>
              <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid #1e2a3a' }}>Map Preview</div>
              <div style={{ height: 280 }}><div ref={mapDivRef} style={{ width: '100%', height: '100%' }} /></div>
            </div>
          )}

          {selectedAirport && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Alert Distances</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {AIRPORT_DIST_OPTIONS.map(d => {
                  const active = alertDistances.includes(d);
                  return (
                    <button key={d} onClick={() => toggleDist(d)} style={{
                      padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, border: 'none',
                      background: active ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                      color: active ? '#38bdf8' : '#4b5563',
                      outline: active ? '1px solid rgba(56,189,248,0.35)' : '1px solid transparent',
                    }}>{d} nm</button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: '#4b5563', marginTop: 6 }}>
                Selected: {alertDistances.join(', ')} nm — triggers proximity alerts at these distances
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setShowAdd(false); setSelectedAirport(null); setSearchQuery(''); }} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'transparent', border: '1px solid #374151', color: '#9ca3af', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleAdd} disabled={!selectedAirport || saving} style={{ flex: 2, padding: '11px', borderRadius: 10, background: !selectedAirport || saving ? '#374151' : 'linear-gradient(135deg, #38bdf8, #0ea5e9)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: !selectedAirport || saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Adding...</> : <><Building2 size={14} /> Add Airport</>}
            </button>
          </div>
        </div>
      )}
      <style>{`.leaflet-container{background:#0d1117}.leaflet-control-zoom{border-color:#1e2a3a!important}.leaflet-control-zoom a{background:#131b27!important;color:#9ca3af!important;border-color:#1e2a3a!important}.ap-popup .leaflet-popup-content-wrapper{background:transparent;box-shadow:none;padding:0}.ap-popup .leaflet-popup-tip-container{display:none}`}</style>
    </div>
  );
}

// ── Tab: Expected Arrivals ────────────────────────────────────────────────────
function ArrivalsTab({ arrivals, onRefresh, myRole }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ tail_number: '', expected_at: '', notes: '', reminder_minutes: 30 });
  const [error, setError] = useState('');

  const handleAdd = async () => {
    try {
      await APIService.createExpectedArrival({ ...form, tail_number: form.tail_number.trim().toUpperCase() });
      setShowAdd(false); setForm({ tail_number: '', expected_at: '', notes: '', reminder_minutes: 30 });
      onRefresh();
    } catch (e) { setError(e.response?.data?.detail || 'Failed'); }
  };

  const handleCancel = async (id) => {
    try { await APIService.deleteExpectedArrival(id); onRefresh(); } catch { }
  };

  function statusColor(status) {
    if (status === 'arrived') return G;
    if (status === 'late') return '#ef4444';
    if (status === 'cancelled') return '#4b5563';
    return A;
  }

  function etaLabel(expected_at) {
    const diff = new Date(expected_at) - new Date();
    if (diff < -15 * 60000) return 'Late';
    if (diff < 0) return 'Due now';
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#f9fafb' }}>Expected Arrivals</span>
        <button onClick={() => setShowAdd(true)} style={s.btn('primary')}>+ Add Expected</button>
      </div>
      <InlineError msg={error} />

      {arrivals.length === 0 ? (
        <div style={{ color: '#4b5563', fontSize: 13, textAlign: 'center', paddingTop: 30 }}>No expected arrivals</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {arrivals.map(a => (
            <div key={a.id} style={{ ...s.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Clock size={15} color={statusColor(a.status)} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#f9fafb' }}>{a.tail_number}</span>
                  <Badge color={statusColor(a.status)}>{a.status === 'pending' ? etaLabel(a.expected_at) : a.status}</Badge>
                  {a.linked_icao24 && <Badge color={G}>Tracking</Badge>}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {new Date(a.expected_at).toLocaleString()}{a.notes ? ` · ${a.notes}` : ''}
                </div>
              </div>
              {a.status === 'pending' && (
                <button onClick={() => handleCancel(a.id)} style={{ ...s.btn('danger'), padding: '5px 8px' }}><X size={13} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Add Expected Arrival" onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <FieldLabel>Tail Number</FieldLabel>
              <input value={form.tail_number} onChange={e => setForm(f => ({ ...f, tail_number: e.target.value }))} placeholder="N12345" style={s.input} />
            </div>
            <div>
              <FieldLabel>Expected Arrival</FieldLabel>
              <input type="datetime-local" value={form.expected_at} onChange={e => setForm(f => ({ ...f, expected_at: e.target.value }))} style={{ ...s.input, colorScheme: 'dark' }} />
            </div>
            <div>
              <FieldLabel>Notes</FieldLabel>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" style={s.input} />
            </div>
            <div>
              <FieldLabel>Reminder (minutes before)</FieldLabel>
              <input type="number" value={form.reminder_minutes} min={0}
                onChange={e => setForm(f => ({ ...f, reminder_minutes: +e.target.value }))} style={s.input} />
            </div>
            <ModalActions onCancel={() => setShowAdd(false)} onConfirm={handleAdd} confirmLabel="Add" disabled={!form.tail_number.trim() || !form.expected_at} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Tab: Alerts ───────────────────────────────────────────────────────────────
const DEFAULT_ALERT_TYPES = [
  { key: 'landing',  label: 'Landing',          desc: 'Aircraft lands at or near the airport', icon: '🛬', color: G },
  { key: 'takeoff',  label: 'Takeoff',           desc: 'Aircraft departs from the airport',      icon: '🛫', color: A },
  { key: '2nm',      label: '2 nm Alert',        desc: 'Aircraft within 2 nautical miles',        icon: '📡', color: '#38bdf8' },
  { key: '5nm',      label: '5 nm Alert',        desc: 'Aircraft within 5 nautical miles',        icon: '📡', color: '#38bdf8' },
  { key: '10nm',     label: '10 nm Alert',       desc: 'Aircraft within 10 nautical miles',       icon: '📡', color: '#38bdf8' },
  { key: '15nm',     label: '15 nm Alert',       desc: 'Aircraft within 15 nautical miles',       icon: '📡', color: '#38bdf8' },
  { key: '20nm',     label: '20 nm Alert',       desc: 'Aircraft within 20 nautical miles',       icon: '📡', color: '#38bdf8' },
];
const DEFAULT_TEMPLATES = {
  landing:  '{tail_number} has landed at {airport}.',
  takeoff:  '{tail_number} has departed from {airport}.',
  '2nm':    '{tail_number} is 2 nm from {airport} at {altitude} ft.',
  '5nm':    '{tail_number} is 5 nm from {airport} at {altitude} ft.',
  '10nm':   '{tail_number} is 10 nm from {airport} at {altitude} ft.',
  '15nm':   '{tail_number} is 15 nm from {airport} at {altitude} ft.',
  '20nm':   '{tail_number} is 20 nm from {airport} at {altitude} ft.',
};

function AlertsTab() {
  const [settings, setSettings] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [initing, setIniting] = useState(false);

  const load = useCallback(async () => {
    try { setSettings(await APIService.getTeamAlertSettings()); } catch { }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (alertType, currentEnabled, template) => {
    try {
      await APIService.updateTeamAlertSetting(alertType, !currentEnabled, template);
      load();
    } catch { }
  };

  const handleSaveTemplate = async () => {
    try {
      await APIService.updateTeamAlertSetting(editing.alert_type, editing.enabled, editing.message_template);
      setEditing(null); load();
    } catch (e) { setError(e.response?.data?.detail || 'Failed'); }
  };

  const handleInit = async () => {
    setIniting(true);
    try {
      for (const t of DEFAULT_ALERT_TYPES) {
        if (!settings.find(s => s.alert_type === t.key)) {
          await APIService.updateTeamAlertSetting(t.key, true, DEFAULT_TEMPLATES[t.key]);
        }
      }
      await load();
    } catch { }
    setIniting(false);
  };

  // Merge configured settings with default types for display
  const rows = DEFAULT_ALERT_TYPES.map(def => {
    const configured = settings.find(s => s.alert_type === def.key);
    return { ...def, configured, enabled: configured?.enabled ?? false, template: configured?.message_template || DEFAULT_TEMPLATES[def.key] };
  });

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f9fafb', margin: '0 0 4px 0' }}>Alert Types</h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Configure which events send notifications and customize message templates.</p>
        </div>
        {settings.length === 0 && (
          <button onClick={handleInit} disabled={initing}
            style={{ padding: '10px 18px', borderRadius: 10, background: 'linear-gradient(135deg, #22d3a3, #0d9488)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: initing ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: initing ? 0.7 : 1 }}>
            {initing ? 'Initializing…' : 'Initialize Defaults'}
          </button>
        )}
      </div>
      <InlineError msg={error} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(row => (
          <div key={row.key} style={{ background: '#0f1319', border: `1px solid ${row.enabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: row.enabled ? 1 : 0.55 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: row.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
              {row.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb', marginBottom: 2 }}>{row.label}</div>
              <div style={{ fontSize: 11, color: '#4b5563' }}>{row.configured ? (row.template.length > 60 ? row.template.slice(0, 60) + '…' : row.template) : row.desc}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {row.configured && (
                <button onClick={() => setEditing({ alert_type: row.key, enabled: row.enabled, message_template: row.template })}
                  style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,0.05)', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={13} />
                </button>
              )}
              <div onClick={() => handleToggle(row.key, row.enabled, row.template)}
                style={{ width: 44, height: 24, borderRadius: 12, background: row.enabled ? G : '#1e2a3a', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: row.enabled ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal title={`Alert Template — ${editing.alert_type}`} onClose={() => setEditing(null)} width={500}>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Message Template</FieldLabel>
            <textarea
              value={editing.message_template}
              onChange={e => setEditing(x => ({ ...x, message_template: e.target.value }))}
              style={{ ...s.input, height: 90, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
            />
            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 6 }}>
              Variables: <code style={{ color: '#38bdf8' }}>{'{tail_number}'}</code> <code style={{ color: '#38bdf8' }}>{'{airport}'}</code> <code style={{ color: '#38bdf8' }}>{'{altitude}'}</code> <code style={{ color: '#38bdf8' }}>{'{speed}'}</code> <code style={{ color: '#38bdf8' }}>{'{distance}'}</code>
            </div>
          </div>
          <ModalActions onCancel={() => setEditing(null)} onConfirm={handleSaveTemplate} />
        </Modal>
      )}
    </div>
  );
}

// ── Tab: Activity ─────────────────────────────────────────────────────────────
function ActivityTab({ activity, onAck, onLoadMore }) {
  const typeColors = { alert: '#ef4444', landing: G, takeoff: A, claim: '#a855f7', escalation: '#ef4444', arrival: G };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#f9fafb', marginBottom: 14 }}>Activity Log</div>
      {activity.length === 0 && <div style={{ color: '#4b5563', fontSize: 13, textAlign: 'center', paddingTop: 30 }}>No activity yet</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {activity.map(log => {
          const acked = log.status?.startsWith('acked');
          const color = typeColors[log.alert_type?.includes('nm') ? 'alert' : log.alert_type] || '#6b7280';
          return (
            <div key={log.id} style={{ ...s.card, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: acked ? 0.6 : 1 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#d1d5db', fontWeight: 500 }}>
                  {log.aircraft_tail} <span style={{ color: '#6b7280' }}>·</span> {log.alert_type}
                </div>
                <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.message}
                </div>
                <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>
                  {new Date(log.sent_at).toLocaleTimeString()}
                  {acked && <span style={{ color: G, marginLeft: 6 }}>✓ Acked</span>}
                </div>
              </div>
              {!acked && (
                <button onClick={() => onAck(log.id)} style={{ ...s.btn('ghost'), fontSize: 12, padding: '4px 10px', flexShrink: 0 }}>Ack</button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button onClick={onLoadMore} style={{ ...s.btn('ghost'), fontSize: 12 }}>Load More</button>
      </div>
    </div>
  );
}

// ── Main Teams component ──────────────────────────────────────────────────────
export default function Teams({ userData }) {
  const [activeTab, setActiveTab] = useState('ops');
  const [team, setTeam] = useState(null);
  const [onDuty, setOnDuty] = useState([]);
  const [liveAircraft, setLiveAircraft] = useState([]);
  const [claims, setClaims] = useState([]);
  const [arrivals, setArrivals] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activityLimit, setActivityLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const myRole = userData?.team_role || team?.members?.find(m => m.email === userData?.email)?.role || 'member';

  const loadAll = useCallback(async () => {
    try {
      const [t, od, la, cl, ar, act] = await Promise.allSettled([
        APIService.getMyTeam(),
        APIService.getOnDutyMembers(),
        APIService.getTeamLiveAircraft(),
        APIService.getTeamClaims(),
        APIService.getExpectedArrivals(),
        APIService.getTeamActivity(activityLimit),
      ]);
      if (t.status === 'fulfilled') setTeam(t.value);
      if (od.status === 'fulfilled') setOnDuty(od.value);
      if (la.status === 'fulfilled') setLiveAircraft(la.value);
      if (cl.status === 'fulfilled') setClaims(cl.value);
      if (ar.status === 'fulfilled') setArrivals(ar.value);
      if (act.status === 'fulfilled') setActivity(act.value);
      if (t.status === 'rejected') setError(t.reason?.response?.data?.detail || 'Not a team member');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activityLimit]);

  useEffect(() => {
    loadAll();
    pollRef.current = setInterval(loadAll, 30000);
    return () => clearInterval(pollRef.current);
  }, [loadAll]);

  const handleClaim = async (icao24, tailNumber) => {
    try { await APIService.claimAircraft(icao24, tailNumber); loadAll(); } catch (e) { alert(e.response?.data?.detail || 'Cannot claim'); }
  };

  const handleRelease = async (icao24) => {
    try { await APIService.releaseClaim(icao24); loadAll(); } catch { }
  };

  const handleAck = async (logId) => {
    try { await APIService.ackActivity(logId); loadAll(); } catch { }
  };

  if (loading) return (
    <div style={{ background: BG, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  );

  if (error) {
    const isLicenseErr = error === 'team_license_expired' || error === 'Not a member of any team';
    const msg = error === 'team_license_expired'
      ? 'Your team license has expired. Re-activate your license key to renew.'
      : error === 'Not a member of any team'
      ? 'You are not part of a team yet. Activate a team license key or accept an invite.'
      : error;
    return (
      <div style={{ background: BG, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <AlertTriangle size={32} color={isLicenseErr ? '#f59e0b' : '#ef4444'} />
        <div style={{ color: isLicenseErr ? '#f59e0b' : '#ef4444', fontSize: 14, maxWidth: 320, textAlign: 'center' }}>{msg}</div>
        <button onClick={loadAll} style={s.btn('ghost')}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ background: BG, height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>
      {/* Team header */}
      <div style={{ padding: '14px 20px', paddingRight: window.electronAPI?.platform === 'win32' ? 150 : 20, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, WebkitAppRegion: 'drag' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${G}, #16a37a)`, display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitAppRegion: 'no-drag' }}>
          <Shield size={16} color='#0a0d12' />
        </div>
        <div style={{ WebkitAppRegion: 'no-drag', flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#f9fafb' }}>{team?.name || 'Your Team'}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{myRole} · {team?.members?.length || 0} members</div>
        </div>
        <button onClick={loadAll} title="Refresh" style={{ WebkitAppRegion: 'no-drag', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 8, color: '#4b5563', cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Ops status bar */}
      <OpsStatusBar onDuty={onDuty} liveAircraft={liveAircraft} claims={claims} arrivals={arrivals} />

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0, paddingRight: window.electronAPI?.platform === 'win32' ? 150 : 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', overflowX: 'auto', flex: 1 }}>
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', cursor: 'pointer',
                background: 'none', border: 'none',
                borderBottom: activeTab === id ? `2px solid ${G}` : '2px solid transparent',
                color: activeTab === id ? G : '#6b7280',
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'ops' && (
          <OpsTab
            team={team} onDuty={onDuty} liveAircraft={liveAircraft}
            claims={claims} arrivals={arrivals} activity={activity}
            onClaim={handleClaim} onRelease={handleRelease} onAck={handleAck}
          />
        )}
        {activeTab === 'map' && (
          <div style={{ height: '100%' }}>
            <LiveMap />
          </div>
        )}
        {activeTab === 'members' && (
          <MembersTab team={team} myRole={myRole} onDuty={onDuty} onRefresh={loadAll} />
        )}
        {activeTab === 'schedule' && (
          <ScheduleTab team={team} onDuty={onDuty} />
        )}
        {activeTab === 'channels' && (
          <ChannelsTab team={team} onRefresh={loadAll} />
        )}
        {activeTab === 'routing' && (
          <RoutingTab team={team} onRefresh={loadAll} />
        )}
        {activeTab === 'aircraft' && (
          <AircraftTab myRole={myRole} />
        )}
        {activeTab === 'airports' && (
          <AirportsTab myRole={myRole} />
        )}
        {activeTab === 'arrivals' && (
          <ArrivalsTab arrivals={arrivals} onRefresh={loadAll} myRole={myRole} />
        )}
        {activeTab === 'alerts' && (
          <AlertsTab />
        )}
        {activeTab === 'activity' && (
          <ActivityTab
            activity={activity}
            onAck={handleAck}
            onLoadMore={() => setActivityLimit(l => l + 50)}
          />
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
