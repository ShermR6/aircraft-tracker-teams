import React, { useState, useEffect } from 'react';
import { Plus, X, Phone, Hash, Mail, UserPlus, Check, Clock, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import APIService from '../services/api';

const TABS = ['Members', 'Channels', 'Routing', 'Activity'];

const DISTANCES = ['10nm', '5nm', '2nm', 'landing'];
const DISTANCE_LABELS = { '10nm': '10nm', '5nm': '5nm', '2nm': '2nm', 'landing': 'Landing' };

const ROLE_STYLES = {
  owner: { bg: 'rgba(14,165,233,0.12)', color: '#0ea5e9', label: 'Owner' },
  admin: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', label: 'Admin' },
  member: { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af', label: 'Member' },
};

const INTEGRATION_TYPES = [
  { key: 'sms', label: 'SMS Numbers', Icon: Phone, placeholder: '+1 (555) 000-0000', hint: 'Mobile number to receive text alerts' },
  { key: 'discord', label: 'Discord Webhooks', Icon: Hash, placeholder: 'https://discord.com/api/webhooks/...', hint: 'Discord channel webhook URL' },
  { key: 'slack', label: 'Slack Channels', Icon: Hash, placeholder: 'https://hooks.slack.com/services/...', hint: 'Slack incoming webhook URL' },
  { key: 'email', label: 'Email Addresses', Icon: Mail, placeholder: 'team@company.com', hint: 'Email address to receive alerts' },
];

const inputStyle = {
  width: '100%', padding: '10px 12px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#f9fafb', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};

function Avatar({ email, size = 36 }) {
  const initials = email.split('@')[0].slice(0, 2).toUpperCase();
  const hue = [...email].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue}, 35%, 18%)`,
      border: `1px solid hsl(${hue}, 35%, 28%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.floor(size * 0.35), fontWeight: 700,
      color: `hsl(${hue}, 55%, 65%)`, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0f1117', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: 28, width: 400, maxWidth: '90%',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
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

function FieldLabel({ children }) {
  return (
    <label style={{
      fontSize: 11, fontWeight: 600, color: '#6b7280',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      display: 'block', marginBottom: 6,
    }}>
      {children}
    </label>
  );
}

function ModalActions({ onCancel, onConfirm, confirmLabel, disabled, loading }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
      <button onClick={onCancel} style={{
        flex: 1, padding: '11px', borderRadius: 8,
        background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
        color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>Cancel</button>
      <button
        onClick={onConfirm}
        disabled={disabled || loading}
        style={{
          flex: 1, padding: '11px', borderRadius: 8,
          background: (disabled || loading) ? 'rgba(14,165,233,0.2)' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
          border: 'none', color: (disabled || loading) ? '#0ea5e9' : '#fff',
          fontSize: 13, fontWeight: 700, cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        }}
      >{loading ? 'Sending...' : confirmLabel}</button>
    </div>
  );
}

function InviteMemberModal({ onClose, onInvite }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleConfirm = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setErr('');
    try {
      await onInvite(email.trim());
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Invite Team Member" onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <FieldLabel>Email Address</FieldLabel>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConfirm()}
          placeholder="teammate@company.com"
          style={inputStyle}
          autoFocus
        />
        <p style={{ fontSize: 11, color: '#4b5563', margin: '6px 0 0', lineHeight: 1.5 }}>
          They'll receive an email with the team license key and installation instructions.
        </p>
        {err && <p style={{ fontSize: 12, color: '#f87171', margin: '8px 0 0' }}>{err}</p>}
      </div>
      <ModalActions
        onCancel={onClose}
        onConfirm={handleConfirm}
        confirmLabel="Send Invite"
        disabled={!email.trim()}
        loading={loading}
      />
    </Modal>
  );
}

function AddChannelModal({ type, onClose, onAdd }) {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const integ = INTEGRATION_TYPES.find(t => t.key === type);

  const handleConfirm = async () => {
    if (!label.trim() || !value.trim()) return;
    setLoading(true);
    setErr('');
    try {
      await onAdd(type, label.trim(), value.trim());
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to add channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Add ${integ.label.slice(0, -1)}`} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <FieldLabel>Label</FieldLabel>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Ramp Team, Office, #alerts"
          style={inputStyle}
          autoFocus
        />
      </div>
      <div>
        <FieldLabel>{integ.label.slice(0, -1)}</FieldLabel>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConfirm()}
          placeholder={integ.placeholder}
          style={inputStyle}
        />
        <p style={{ fontSize: 11, color: '#4b5563', margin: '6px 0 0' }}>{integ.hint}</p>
        {err && <p style={{ fontSize: 12, color: '#f87171', margin: '8px 0 0' }}>{err}</p>}
      </div>
      <ModalActions
        onCancel={onClose}
        onConfirm={handleConfirm}
        confirmLabel="Add Channel"
        disabled={!label.trim() || !value.trim()}
        loading={loading}
      />
    </Modal>
  );
}

function MembersTab({ members, onInvite, onRemove }) {
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div>
      {showInvite && (
        <InviteMemberModal onClose={() => setShowInvite(false)} onInvite={onInvite} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {members.length} member{members.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setShowInvite(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
            border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <UserPlus size={14} /> Invite Member
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {members.map(m => {
          const role = ROLE_STYLES[m.role] || ROLE_STYLES.member;
          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
            }}>
              <Avatar email={m.email} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </div>
                <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>
                  Joined {new Date(m.joined_at).toLocaleDateString()}
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                background: role.bg, color: role.color, textTransform: 'capitalize', flexShrink: 0,
              }}>{role.label}</span>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                fontSize: 11, color: '#22d3a3',
              }}>
                <Check size={12} /> Active
              </span>
              {m.role !== 'owner' && (
                <button
                  onClick={() => onRemove(m.id)}
                  style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                  onMouseLeave={e => e.currentTarget.style.color = '#374151'}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChannelsTab({ channels, onAddChannel, onRemoveChannel }) {
  const [addingType, setAddingType] = useState(null);

  return (
    <div>
      {addingType && (
        <AddChannelModal
          type={addingType}
          onClose={() => setAddingType(null)}
          onAdd={async (type, label, value) => {
            await onAddChannel(type, label, value);
          }}
        />
      )}
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px', lineHeight: 1.6 }}>
        Add multiple notification endpoints per integration type. Configure which distances trigger each channel in the Routing tab.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {INTEGRATION_TYPES.map(({ key, label, Icon }) => {
          const list = channels.filter(ch => ch.integration_type === key);
          return (
            <div key={key}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={14} color="#4b5563" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af' }}>{label}</span>
                  {list.length > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                      background: 'rgba(14,165,233,0.1)', color: '#0ea5e9',
                    }}>{list.length}</span>
                  )}
                </div>
                <button
                  onClick={() => setAddingType(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 6,
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.3)'; e.currentTarget.style.color = '#0ea5e9'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#6b7280'; }}
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              {list.length === 0 ? (
                <div style={{
                  padding: '14px 16px',
                  border: '1px dashed rgba(255,255,255,0.08)',
                  borderRadius: 10, textAlign: 'center',
                  color: '#374151', fontSize: 12,
                }}>
                  No {label.toLowerCase()} added yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {list.map(ch => (
                    <div key={ch.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 14px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#d1d5db', flexShrink: 0 }}>{ch.label}</span>
                      <span style={{
                        fontSize: 12, color: '#4b5563',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      }}>{ch.value}</span>
                      <button
                        onClick={() => onRemoveChannel(ch.id)}
                        style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                        onMouseLeave={e => e.currentTarget.style.color = '#374151'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoutingTab({ channels, routing, onToggle }) {
  if (channels.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📡</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>No channels configured</div>
        <div style={{ fontSize: 13, color: '#374151' }}>
          Add channels in the Channels tab first, then configure routing rules here.
        </div>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.6 }}>
        Choose which channels are notified at each alert distance. All channels are enabled by default.
      </p>
      <div style={{
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', width: 110 }}>
                Distance
              </th>
              {channels.map(ch => (
                <th key={ch.id} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {ch.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DISTANCES.map((dist, di) => (
              <tr
                key={dist}
                style={{
                  background: di % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  borderBottom: di < DISTANCES.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <td style={{ padding: '13px 16px' }}>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: dist === 'landing' ? '#22d3a3' : '#f1f5f9',
                  }}>{DISTANCE_LABELS[dist]}</span>
                </td>
                {channels.map(ch => {
                  const enabled = !(routing[dist] || []).includes(ch.id);
                  return (
                    <td key={ch.id} style={{ padding: '13px 12px', textAlign: 'center' }}>
                      <button
                        onClick={() => onToggle(dist, ch.id, enabled)}
                        style={{
                          width: 20, height: 20, borderRadius: 5,
                          border: `1.5px solid ${enabled ? '#0ea5e9' : 'rgba(255,255,255,0.15)'}`,
                          background: enabled ? '#0ea5e9' : 'transparent',
                          cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                      >
                        {enabled && <Check size={11} color="#fff" strokeWidth={3} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActivityTab({ activity, loading }) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4b5563', fontSize: 13 }}>
        Loading activity...
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>No activity yet</div>
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
          Alert events will appear here once your team starts receiving alerts.
        </div>
      </div>
    );
  }

  const TYPE_COLORS = {
    '10nm': '#0ea5e9', '5nm': '#a855f7', '2nm': '#f59e0b', 'landing': '#22d3a3',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {activity.map(a => (
        <div key={a.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 14,
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5, flexShrink: 0,
            background: 'rgba(14,165,233,0.1)',
            color: TYPE_COLORS[a.alert_type] || '#6b7280',
            marginTop: 1,
          }}>{a.alert_type}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: '#d1d5db', marginBottom: 2 }}>{a.message}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#4b5563' }}>{a.aircraft_tail}</span>
              <span style={{ fontSize: 11, color: '#374151' }}>via {a.integration_type}</span>
              <span style={{ fontSize: 11, color: '#374151' }}>{new Date(a.sent_at).toLocaleString()}</span>
            </div>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
            background: a.status === 'sent' ? 'rgba(34,211,163,0.1)' : 'rgba(248,113,113,0.1)',
            color: a.status === 'sent' ? '#22d3a3' : '#f87171',
          }}>{a.status}</span>
        </div>
      ))}
    </div>
  );
}

export default function Teams() {
  const [activeTab, setActiveTab] = useState('Members');
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);

  const loadTeam = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await APIService.getTeam();
      setTeam(data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const loadActivity = async () => {
    setActivityLoading(true);
    try {
      const data = await APIService.getTeamActivity();
      setActivity(data);
      setActivityLoaded(true);
    } catch {}
    setActivityLoading(false);
  };

  useEffect(() => { loadTeam(); }, []);

  useEffect(() => {
    if (activeTab === 'Activity' && !activityLoaded && !activityLoading) {
      loadActivity();
    }
  }, [activeTab]);

  const handleInvite = async (email) => {
    await APIService.inviteTeamMember(email);
  };

  const handleRemoveMember = async (memberId) => {
    const prev = team;
    setTeam(t => ({ ...t, members: t.members.filter(m => m.id !== memberId) }));
    try {
      await APIService.removeTeamMember(memberId);
    } catch {
      setTeam(prev);
    }
  };

  const handleAddChannel = async (type, label, value) => {
    const newChannel = await APIService.addTeamChannel(type, label, value);
    setTeam(t => ({ ...t, channels: [...t.channels, newChannel] }));
  };

  const handleRemoveChannel = async (channelId) => {
    const prev = team;
    setTeam(t => ({ ...t, channels: t.channels.filter(c => c.id !== channelId) }));
    try {
      await APIService.removeTeamChannel(channelId);
    } catch {
      setTeam(prev);
    }
  };

  const handleToggleRouting = async (dist, channelId, currentlyEnabled) => {
    const prevRouting = team.routing;
    const disabled = [...(team.routing[dist] || [])];
    const newDisabled = currentlyEnabled
      ? [...disabled, channelId]
      : disabled.filter(id => id !== channelId);
    const newRouting = { ...team.routing, [dist]: newDisabled };
    setTeam(t => ({ ...t, routing: newRouting }));
    try {
      await APIService.updateTeamRouting(newRouting);
    } catch {
      setTeam(t => ({ ...t, routing: prevRouting }));
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
        <div style={{ color: '#4b5563', fontSize: 13 }}>Loading team...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 12 }}>
        <AlertCircle size={24} color="#f87171" />
        <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>
        <button
          onClick={loadTeam}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  const members = team?.members || [];
  const channels = team?.channels || [];
  const routing = team?.routing || {};

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#0ea5e9', marginBottom: 6 }}>
          Team Management
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f9fafb', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Your Team
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
          Manage members, notification channels, and alert routing for your team.
        </p>
      </div>

      <div style={{
        display: 'flex', gap: 2,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        marginBottom: 28,
      }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              background: 'none', border: 'none',
              borderBottom: `2px solid ${activeTab === tab ? '#0ea5e9' : 'transparent'}`,
              color: activeTab === tab ? '#0ea5e9' : '#6b7280',
              fontSize: 13, fontWeight: activeTab === tab ? 700 : 500,
              cursor: 'pointer', transition: 'all 0.15s', marginBottom: -1,
            }}
          >{tab}</button>
        ))}
      </div>

      {activeTab === 'Members' && (
        <MembersTab members={members} onInvite={handleInvite} onRemove={handleRemoveMember} />
      )}
      {activeTab === 'Channels' && (
        <ChannelsTab channels={channels} onAddChannel={handleAddChannel} onRemoveChannel={handleRemoveChannel} />
      )}
      {activeTab === 'Routing' && (
        <RoutingTab channels={channels} routing={routing} onToggle={handleToggleRouting} />
      )}
      {activeTab === 'Activity' && (
        <ActivityTab activity={activity} loading={activityLoading} />
      )}
    </div>
  );
}
