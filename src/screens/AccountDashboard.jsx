/**
 * Dashboard home (Teams).
 *
 * Deliberately the same screen as the personal app's DashboardHome — same kit
 * components, same panels, same order — because the two apps should read as
 * one product. Where this one differs it is because teams genuinely have
 * something personal accounts do not:
 *
 *   Coverage        — replaces the personal app's Ground Station card. Teams
 *                     have no SDR; what they need to know at a glance is
 *                     whether anyone is actually on duty to receive an alert.
 *   On duty now     — who is covering, and in what role.
 *
 * Everything team-scoped loads independently of the account itself. These used
 * to share a Promise.all with getCurrentUser(), and because /api/teams/* 403s
 * for anyone not yet in a team, that rejection blanked the whole screen and
 * reported the plan as "Starter".
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Cloud, Users, Plane, Bell, UserCheck } from 'lucide-react';
import APIService from '../services/api';
import StorageService from '../services/storage';
import {
  PageHead, Stamp, Panel, PanelHead, Count, StatusCard, StatStrip,
  TableWrap, Table, Th, Td, Pill, Badge, Tail, StageBar, Empty,
} from '../ui/kit';

const REFRESH_MS = 15000;

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function ago(v) {
  if (!v) return '—';
  const secs = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
  if (secs < 60) return `${Math.floor(secs)}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) {
    const h = Math.floor(secs / 3600);
    return `${h}h ${Math.floor((secs - h * 3600) / 60)}m ago`;
  }
  return `${Math.floor(secs / 86400)}d ago`;
}

/** Rings are ordered widest-first; count how many the aircraft is inside. */
function stageOf(distance, rings) {
  if (!Array.isArray(rings) || !rings.length) return { filled: 0, label: 'Tracking', t: 'neutral' };
  const sorted = [...rings].map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a);
  const filled = sorted.filter(r => distance <= r).length;
  if (filled >= sorted.length) return { filled, label: 'Final', t: 'accent' };
  if (filled === 0) return { filled: 0, label: 'Tracking', t: 'neutral' };
  if (filled === 1) return { filled, label: 'Inbound', t: 'good' };
  return { filled, label: 'Approach', t: 'good' };
}

function etaOf(distanceNm, kts) {
  if (!kts || kts < 30 || !distanceNm) return '—';
  const mins = (distanceNm / kts) * 60;
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${Math.round(mins)} min`;
  return `${(mins / 60).toFixed(1)} hr`;
}

const CHANNEL_LABEL = {
  discord: 'Discord', slack: 'Slack', telegram: 'Telegram', email: 'Email',
  sms: 'SMS', webhook: 'Webhook', teams: 'Microsoft Teams',
  google_chat: 'Google Chat', ms_teams: 'Microsoft Teams',
};

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' };

export default function AccountDashboard() {
  const [user, setUser] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [fleet, setFleet] = useState([]);
  const [live, setLive] = useState([]);
  const [stats, setStats] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [members, setMembers] = useState([]);
  const [airportRings, setAirportRings] = useState(null);
  const [backendOnline, setBackendOnline] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    const settle = (p) => p.then(v => v).catch(() => null);
    const [u, ac, lv, st, nt, hc, duty, cfg] = await Promise.all([
      settle(APIService.getCurrentUser()),
      settle(APIService.getAircraft()),
      settle(APIService.getLiveAircraft()),
      settle(APIService.getNotificationStats()),
      settle(APIService.getRecentNotifications(60)),
      settle(APIService.healthCheck()),
      settle(APIService.getOnDutyMembers()),
      settle(APIService.getAirportConfig()),
    ]);

    if (u) {
      setUser(u);
      const exp = u.expires_at || u.expiry_date || u.license_expires_at || u.expiry;
      if (exp) setExpiresAt(exp);
      else {
        const stored = await StorageService.getUserData().catch(() => null);
        setExpiresAt(stored?.expires_at || stored?.expiry_date || stored?.license_expires_at || null);
      }
    } else {
      // Fall back to the last known identity rather than rendering a plan the
      // account does not have.
      const stored = await StorageService.getUserData().catch(() => null);
      if (stored) setUser(stored);
    }
    if (Array.isArray(ac)) setFleet(ac);
    if (Array.isArray(lv)) setLive(lv);
    if (st) setStats(st);
    if (Array.isArray(nt)) setNotifs(nt);
    if (Array.isArray(duty)) setMembers(duty);
    if (cfg?.alert_distances_nm?.length) setAirportRings(cfg.alert_distances_nm);
    setBackendOnline(hc !== null);
    setUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // ── Inbound now: airborne, closing, nearest first ──
  const ringsFor = (tail) => {
    const m = fleet.find(a => a.tail_number === tail);
    return m?.alert_distances?.length ? m.alert_distances : airportRings;
  };
  const inbound = live
    .filter(a => !a.on_ground && a.is_approaching)
    .sort((a, b) => (a.distance_nm ?? 999) - (b.distance_nm ?? 999));

  // ── Alert delivery: group recent notifications per channel ──
  const byChannel = {};
  notifs.forEach(n => {
    const k = n.integration_type || 'unknown';
    if (!byChannel[k]) byChannel[k] = { sent: 0, failed: 0, last: null };
    const c = byChannel[k];
    c.sent += 1;
    if (n.status && String(n.status).toLowerCase() !== 'sent' && String(n.status).toLowerCase() !== 'success') {
      c.failed += 1;
    }
    if (!c.last || new Date(n.sent_at) > new Date(c.last)) c.last = n.sent_at;
  });
  const channels = Object.entries(byChannel).sort((a, b) => b[1].sent - a[1].sent);

  // ── Coverage: who is actually on duty to receive an alert ──
  const onDuty = members.filter(m => m.on_duty);

  const tierLabel = user?.license_tier
    ? user.license_tier.charAt(0).toUpperCase() + user.license_tier.slice(1)
    : '—';

  return (
    <>
      <PageHead
        title="Dashboard"
        subtitle="Your team overview and system status"
        right={<Stamp>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : 'Loading…'}</Stamp>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 14 }}>
        <StatusCard
          icon={<Cloud size={19} />}
          title="Cloud Tracker"
          desc="Monitoring your aircraft 24/7 — no action needed"
          right={backendOnline
            ? <Badge t="good">Online</Badge>
            : <Badge t={backendOnline === null ? 'neutral' : 'bad'}>
                {backendOnline === null ? 'Checking' : 'Offline'}
              </Badge>}
        />
        <StatusCard
          icon={<Users size={19} />}
          title="Coverage"
          desc="Team members on duty to receive alerts right now"
          right={onDuty.length
            ? <Badge t="good">{onDuty.length} on duty</Badge>
            : <Badge t={members.length ? 'warn' : 'neutral'}>
                {members.length ? 'Nobody on duty' : 'No team'}
              </Badge>}
        />
      </div>

      <StatStrip items={[
        { label: 'License Tier', value: tierLabel },
        { label: 'Tracked Aircraft', value: fleet.length },
        { label: 'Alerts This Week', value: stats?.this_week ?? '—' },
        { label: 'Expires', value: fmtDate(expiresAt), small: true },
      ]} />

      <Panel style={{ marginTop: 14 }}>
        <PanelHead
          title="Inbound now"
          right={<Count>{inbound.length ? `${inbound.length} in range` : 'None in range'}</Count>}
        />
        {inbound.length === 0 ? (
          <Empty
            icon={<Plane size={22} />}
            title="Nothing inbound right now"
            hint="Aircraft appear here as they close on your airport."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Tail</Th><Th>Type</Th><Th>Stage</Th><Th>Distance</Th><Th>ETA</Th>
                </tr>
              </thead>
              <tbody>
                {inbound.map(a => {
                  const st = stageOf(a.distance_nm, ringsFor(a.tail_number));
                  const type = fleet.find(f => f.tail_number === a.tail_number)?.aircraft_type;
                  return (
                    <tr key={a.icao24 || a.tail_number}>
                      <Td><Tail>{a.tail_number}</Tail></Td>
                      <Td dim>{type || '—'}</Td>
                      <Td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                          <StageBar filled={st.filled} />
                          <Pill t={st.t}>{st.label}</Pill>
                        </span>
                      </Td>
                      <Td mono>{a.distance_nm != null ? `${a.distance_nm.toFixed(1)} nm` : '—'}</Td>
                      <Td mono>{etaOf(a.distance_nm, a.velocity_kts)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      <Panel style={{ marginTop: 14 }}>
        <PanelHead title="Alert delivery" right={<Count>Recent</Count>} />
        {channels.length === 0 ? (
          <Empty
            icon={<Bell size={22} />}
            title="No alerts sent yet"
            hint="Delivery health appears here once the tracker fires its first alert."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Channel</Th><Th>Last delivered</Th><Th>Sent</Th><Th>Health</Th>
                </tr>
              </thead>
              <tbody>
                {channels.map(([key, c]) => (
                  <tr key={key}>
                    <Td strong>{CHANNEL_LABEL[key] || key}</Td>
                    <Td mono>{ago(c.last)}</Td>
                    <Td mono>{c.sent - c.failed} / {c.sent}</Td>
                    <Td>
                      {c.failed === 0
                        ? <Pill t="good">Healthy</Pill>
                        : <Pill t="warn">{c.failed} failed</Pill>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      {/* Teams-only: an alert nobody is rostered to see is an alert that did
          not happen, so who is covering belongs on the front page. */}
      <Panel style={{ marginTop: 14 }}>
        <PanelHead
          title="On duty now"
          right={<Count>{members.length ? `${onDuty.length} of ${members.length}` : 'No team'}</Count>}
        />
        {onDuty.length === 0 ? (
          <Empty
            icon={<UserCheck size={22} />}
            title={members.length ? 'Nobody is on duty' : 'No team yet'}
            hint={members.length
              ? 'Alerts still send, but no one is rostered to act on them. Set duty on the Team tab.'
              : 'Create or join a team to roster coverage.'}
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr><Th>Member</Th><Th>Role</Th><Th>Status</Th></tr>
              </thead>
              <tbody>
                {onDuty.map(m => (
                  <tr key={m.member_id}>
                    <Td strong>{m.email || '—'}</Td>
                    <Td dim>{ROLE_LABEL[m.role] || m.role}</Td>
                    <Td><Pill t="good">On duty</Pill></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
