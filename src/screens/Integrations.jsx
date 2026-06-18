import React, { useState, useEffect } from 'react';
import { Plus, X, Phone, Hash, Mail, Trash2, AlertCircle, RefreshCw, Link as LinkIcon, MessageSquare, Globe } from 'lucide-react';
import APIService from '../services/api';

const INTEGRATION_TYPES = [
  { key: 'discord',     label: 'Discord Webhooks',        Icon: Hash,         placeholder: 'https://discord.com/api/webhooks/...',      hint: 'Discord channel webhook URL' },
  { key: 'slack',       label: 'Slack Channels',          Icon: Hash,         placeholder: 'https://hooks.slack.com/services/...',      hint: 'Slack incoming webhook URL' },
  { key: 'teams',       label: 'Microsoft Teams',         Icon: MessageSquare,placeholder: 'https://outlook.office.com/webhook/...',    hint: 'Teams channel incoming webhook URL' },
  { key: 'google_chat', label: 'Google Chat',             Icon: MessageSquare,placeholder: 'https://chat.googleapis.com/v1/spaces/...', hint: 'Google Chat space webhook URL' },
  { key: 'email',       label: 'Email Addresses',         Icon: Mail,         placeholder: 'team@company.com',                          hint: 'Email address to receive alerts' },
  { key: 'sms',         label: 'SMS Numbers',             Icon: Phone,        placeholder: '+11234567890',                              hint: 'Mobile number with country code (e.g. +11234567890)' },
  { key: 'telegram',    label: 'Telegram',                Icon: MessageSquare,placeholder: 'BOT_TOKEN:CHAT_ID',                         hint: 'Format: bot_token:chat_id — create bot via @BotFather' },
  { key: 'webhook',     label: 'Generic Webhooks',        Icon: Globe,        placeholder: 'https://your-service.com/webhook',          hint: 'FinalPing will POST JSON to this URL' },
];

const inputStyle = {
  width: '100%', padding: '10px 12px',
  background: '#232d42',
  border: '1px solid #3a4562',
  borderRadius: 8, color: '#f9fafb', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};

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
        <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
          Label
        </label>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Ramp Team, Office, #alerts"
          style={inputStyle}
          autoFocus
        />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
          {integ.label.slice(0, -1)}
        </label>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConfirm()}
          placeholder={integ.placeholder}
          style={inputStyle}
        />
        <p style={{ fontSize: 11, color: '#6b7280', margin: '6px 0 0' }}>{integ.hint}</p>
        {err && <p style={{ fontSize: 12, color: '#f87171', margin: '8px 0 0' }}>{err}</p>}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!label.trim() || !value.trim() || loading}
          style={{
            flex: 1, padding: '11px', borderRadius: 8,
            background: (!label.trim() || !value.trim() || loading) ? 'rgba(14,165,233,0.2)' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
            border: 'none', color: (!label.trim() || !value.trim() || loading) ? '#0ea5e9' : '#fff',
            fontSize: 13, fontWeight: 700, cursor: (!label.trim() || !value.trim() || loading) ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Adding...' : 'Add Channel'}
        </button>
      </div>
    </Modal>
  );
}

export default function Integrations() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingType, setAddingType] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const team = await APIService.getTeam();
      setChannels(team.channels || []);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (type, label, value) => {
    const newChannel = await APIService.addTeamChannel(type, label, value);
    setChannels(prev => [...prev, newChannel]);
  };

  const handleRemove = async (channelId) => {
    const prev = channels;
    setChannels(c => c.filter(ch => ch.id !== channelId));
    try {
      await APIService.removeTeamChannel(channelId);
    } catch {
      setChannels(prev);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
        <div style={{ color: '#4b5563', fontSize: 13 }}>Loading channels...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 12 }}>
        <AlertCircle size={24} color="#f87171" />
        <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}>
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      {addingType && (
        <AddChannelModal
          type={addingType}
          onClose={() => setAddingType(null)}
          onAdd={handleAdd}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <div style={{ width: 48, height: 48, background: 'rgba(14,165,233,0.12)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <LinkIcon size={22} color="#0ea5e9" />
        </div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f9fafb', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Notification Channels
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Add the SMS numbers, Discord webhooks, Slack channels, and email addresses your team uses for alerts.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {INTEGRATION_TYPES.map(({ key, label, Icon }) => {
          const list = channels.filter(ch => ch.integration_type === key);
          return (
            <div key={key} style={{ background: '#1a2236', border: '1px solid #2a3452', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: list.length > 0 ? 14 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon size={15} color="#6b7280" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#c4cad6' }}>{label}</span>
                  {list.length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(14,165,233,0.18)', color: '#38bdf8' }}>
                      {list.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setAddingType(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 13px', borderRadius: 8,
                    background: '#232d42', border: '1px solid #3a4562',
                    color: '#9ca3af', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.color = '#38bdf8'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#3a4562'; e.currentTarget.style.color = '#9ca3af'; }}
                >
                  <Plus size={13} /> Add
                </button>
              </div>

              {list.length === 0 ? (
                <div style={{ padding: '10px 0 2px', color: '#6b7280', fontSize: 12 }}>
                  No {label.toLowerCase()} added yet — click Add to configure one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {list.map(ch => (
                    <div key={ch.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px',
                      background: '#232d42',
                      border: '1px solid #2e3a55', borderRadius: 9,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', flexShrink: 0, minWidth: 100 }}>{ch.label}</span>
                      <span style={{ fontSize: 12, color: '#8896b3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {ch.value}
                      </span>
                      <button
                        onClick={() => handleRemove(ch.id)}
                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                        onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: '#6b7280', marginTop: 24, lineHeight: 1.7 }}>
        Configure which channels fire at each alert distance in the <strong style={{ color: '#9ca3af' }}>Team → Routing</strong> tab.
      </p>
    </div>
  );
}
