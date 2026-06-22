import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plane, RefreshCw, Loader, Navigation } from 'lucide-react';
import APIService from '../services/api';
import { teamBackgroundTracker } from '../services/teamBackgroundTracker';
import { getColor, ensureLoaded } from '../services/aircraftColors';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import airportsData from '../data/airports.json';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

function nmToMeters(nm) { return nm * 1852; }

function toAirport(a) {
  return {
    icao: a[0],
    runways: (a[9] || []).map(r => ({
      leIdent: r[0], leHdg: r[1] ?? null, heIdent: r[2], heHdg: r[3] ?? null,
      lengthFt: r[4],
      leLat: r[5] ?? null, leLon: r[6] ?? null,
      heLat: r[7] ?? null, heLon: r[8] ?? null,
    })),
  };
}

function identToHdg(id) {
  const n = parseInt(id ?? '');
  return (n >= 1 && n <= 36) ? n * 10 : null;
}

function freshnessStyle(lastSeenMs) {
  const ageS = (Date.now() - lastSeenMs) / 1000;
  if (ageS < 45) return { color: '#38bdf8', opacity: 1 };
  if (ageS < 90) return { color: '#f59e0b', opacity: 0.85 };
  return { color: '#f87171', opacity: 0.65 };
}

function ageLabel(lastSeenMs) {
  const s = Math.round((Date.now() - lastSeenMs) / 1000);
  if (s < 5) return 'live';
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export default function LiveMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const trailsRef = useRef({});
  const trailDataRef = useRef(teamBackgroundTracker.getTrailData());
  const posTrackerRef = useRef(teamBackgroundTracker.getPosTracker());
  const ringsRef = useRef([]);
  const airportMarkerRef = useRef(null);
  const runwayLayersRef = useRef([]);

  const [airportConfig, setAirportConfig] = useState(null);
  const [aircraft, setAircraft] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    ensureLoaded();
    APIService.getTeamAirports()
      .then(airports => {
        const active = airports.find(a => a.is_active) || airports[0];
        if (active) setAirportConfig(active);
        else setError('No active airport configured for this team.');
      })
      .catch(() => setError('No airport configured for this team.'));
  }, []);

  useEffect(() => {
    if (!airportConfig || mapRef.current) return;

    const lat = parseFloat(airportConfig.latitude);
    const lng = parseFloat(airportConfig.longitude);

    const map = L.map(mapContainerRef.current, { center: [lat, lng], zoom: 10, zoomControl: true });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Draw runways from airports.json
    const entry = airportsData.find(r => r[0] === airportConfig.airport_code);
    if (entry) {
      const ap = toAirport(entry);
      const cosLat = Math.cos(lat * Math.PI / 180);
      for (const rw of ap.runways) {
        const leHdg = rw.leHdg ?? identToHdg(rw.leIdent);
        let lePt, hePt;
        if (rw.leLat != null && rw.leLon != null && rw.heLat != null && rw.heLon != null) {
          lePt = [rw.leLat, rw.leLon];
          hePt = [rw.heLat, rw.heLon];
        } else if (leHdg != null && rw.lengthFt > 0 && !/[LRC]$/i.test(rw.leIdent || '')) {
          const hM = (rw.lengthFt * 0.3048) / 2;
          const hRad = (leHdg * Math.PI) / 180;
          lePt = [lat - (hM / 111320) * Math.cos(hRad), lng - (hM / (111320 * cosLat)) * Math.sin(hRad)];
          hePt = [lat + (hM / 111320) * Math.cos(hRad), lng + (hM / (111320 * cosLat)) * Math.sin(hRad)];
        } else continue;

        runwayLayersRef.current.push(
          L.polyline([lePt, hePt], { color: '#ffffff', weight: 5, opacity: 0.85 }).addTo(map)
        );

        const rwLabel = (pt, txt) => L.marker(pt, {
          icon: L.divIcon({
            html: `<span style="font-size:9px;font-weight:700;color:#fff;white-space:nowrap;background:rgba(0,0,0,0.55);padding:1px 4px;border-radius:3px;">${txt}</span>`,
            className: '',
            iconAnchor: [12, 6],
          }),
          interactive: false,
        }).addTo(map);

        if (rw.leIdent) runwayLayersRef.current.push(rwLabel(lePt, rw.leIdent));
        if (rw.heIdent) runwayLayersRef.current.push(rwLabel(hePt, rw.heIdent));
      }
    }

    // Small center dot for airport reference
    const centerIcon = L.divIcon({
      className: '',
      html: `<div style="width:10px;height:10px;background:#0ea5e9;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px #0ea5e980;"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });
    airportMarkerRef.current = L.marker([lat, lng], { icon: centerIcon })
      .bindPopup(`<div style="font-size:13px;"><strong style="color:#0ea5e9;">${airportConfig.airport_code || 'Home Base'}</strong><br/><span style="color:#9ca3af;font-size:11px;">${lat.toFixed(4)}, ${lng.toFixed(4)}</span></div>`)
      .addTo(map);

    const ringDistances = [...(airportConfig.alert_distances_nm || ['2.0', '5.0', '10.0'])]
      .sort((a, b) => parseFloat(b) - parseFloat(a));
    const ringColors = ['#ef4444', '#f59e0b', '#38bdf8'];
    ringsRef.current = ringDistances.map((dist, i) => {
      const nm = parseFloat(dist);
      const colorIndex = ringDistances.length - 1 - i;
      return L.circle([lat, lng], {
        radius: nmToMeters(nm), color: ringColors[colorIndex] || '#6b7280',
        weight: 1, opacity: 0.5, fillOpacity: 0.03, dashArray: '6 4',
      }).bindPopup(`<span style="font-size:12px;color:#9ca3af;">${nm} nm alert ring</span>`).addTo(map);
    });

    setLoading(false);
    fetchAircraft(map, teamBackgroundTracker.getData());
  }, [airportConfig]);

  const fetchAircraft = useCallback((mapInstance, data) => {
    const map = mapInstance || mapRef.current;
    if (!map) return;

    try {
      const now = Date.now();
      const liveAircraft = (data || []).filter(a => {
        if (!a.latitude || !a.longitude) return false;
        if (a.on_ground) return false;

        if (a.last_seen) {
          const ageS = (now - new Date(a.last_seen).getTime()) / 1000;
          if (ageS > 90) return false;
        }

        const tail = a.tail_number;
        const lat = parseFloat(a.latitude);
        const lng = parseFloat(a.longitude);
        const prev = posTrackerRef.current[tail];
        if (!prev || prev.lat !== lat || prev.lng !== lng) {
          posTrackerRef.current[tail] = { lat, lng, changedAt: now };
        } else {
          const frozenS = (now - prev.changedAt) / 1000;
          const alt = a.altitude_ft_msl != null ? parseFloat(a.altitude_ft_msl) : 99999;
          const dist = a.distance_nm != null ? parseFloat(a.distance_nm) : 99;
          if (frozenS > 75 && dist < 5 && alt < 3000) return false;
          if (frozenS > 120 && alt < 1500) return false;
        }
        return true;
      });

      setAircraft(liveAircraft);
      setError(null);

      const seen = new Set();

      liveAircraft.forEach((ac) => {
        const lat = parseFloat(ac.latitude);
        const lng = parseFloat(ac.longitude);
        const color = getColor(ac.tail_number);
        const lastSeenMs = ac.last_seen ? new Date(ac.last_seen).getTime() : now;
        const fresh = freshnessStyle(lastSeenMs);

        seen.add(ac.tail_number);

        const trail = trailDataRef.current[ac.tail_number] || [];
        if (trailsRef.current[ac.tail_number]) {
          trailsRef.current[ac.tail_number].setLatLngs(trail).setStyle({ color });
        } else {
          trailsRef.current[ac.tail_number] = L.polyline(trail, {
            color, weight: 2, opacity: 0.6, dashArray: '4 4',
          }).addTo(map);
        }

        const rotation = ac.heading || 0;
        const c = color;
        const iconHtml = `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
            <div style="font-size:9px;font-weight:700;color:${c};white-space:nowrap;background:rgba(0,0,0,0.65);padding:1px 5px;border-radius:4px;letter-spacing:0.04em;opacity:${fresh.opacity};">${ac.tail_number}</div>
            <div style="width:28px;height:28px;background:${c}20;border:1.5px solid ${c};border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:${fresh.opacity};transform:rotate(${rotation}deg);box-shadow:0 0 8px ${c}40;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="${c}" stroke="none">
                <path d="M12 2L8 10H4l4 4-1.5 6L12 17l5.5 3L16 14l4-4h-4L12 2z"/>
              </svg>
            </div>
          </div>`;
        const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [70, 44], iconAnchor: [35, 30] });

        const status = ac.is_approaching ? 'approaching' : (ac.status || 'outside');
        const popupContent = `
          <div style="font-size:13px;min-width:170px;">
            <div style="font-weight:700;color:${c};font-size:15px;margin-bottom:6px;">${ac.tail_number}</div>
            <div style="color:#9ca3af;font-size:11px;margin-bottom:8px;">${ac.icao24 || ''}</div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Status</span><span style="color:#e5e7eb;font-weight:600;">${status.replace('_', ' ')}</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Distance</span><span style="color:#e5e7eb;font-weight:600;">${ac.distance_nm?.toFixed(1) ?? '—'} nm</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Altitude</span><span style="color:#e5e7eb;font-weight:600;">${ac.altitude_ft_msl != null ? Math.round(ac.altitude_ft_msl) + ' ft MSL' : '—'}</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Speed</span><span style="color:#e5e7eb;font-weight:600;">${ac.velocity_kts != null ? Math.round(ac.velocity_kts) + ' kts' : '—'}</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Heading</span><span style="color:#e5e7eb;font-weight:600;">${ac.heading != null ? Math.round(ac.heading) + '°' : '—'}</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Data age</span><span style="color:${c};font-weight:600;">${ageLabel(lastSeenMs)}</span></div>
            </div>
          </div>`;

        if (markersRef.current[ac.tail_number]) {
          markersRef.current[ac.tail_number].setLatLng([lat, lng]).setIcon(icon);
          markersRef.current[ac.tail_number].getPopup()?.setContent(popupContent);
        } else {
          markersRef.current[ac.tail_number] = L.marker([lat, lng], { icon })
            .bindPopup(popupContent)
            .addTo(map);
        }
      });

      const cleanup = (ref, extra) => {
        Object.keys(ref).forEach(tail => {
          if (!seen.has(tail)) { map.removeLayer(ref[tail]); delete ref[tail]; if (extra) delete extra[tail]; }
        });
      };
      cleanup(markersRef.current);
      cleanup(trailsRef.current, trailDataRef.current);
      Object.keys(posTrackerRef.current).forEach(tail => {
        if (!seen.has(tail)) delete posTrackerRef.current[tail];
      });

    } catch (err) {
      console.error('LiveMap render error:', err);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const unsub = teamBackgroundTracker.subscribe(data => {
      setLastUpdate(new Date());
      fetchAircraft(mapRef.current, data);
    });
    return unsub;
  }, [fetchAircraft, airportConfig]);

  useEffect(() => {
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  const handleRecenter = () => {
    if (!mapRef.current || !airportConfig) return;
    mapRef.current.setView([parseFloat(airportConfig.latitude), parseFloat(airportConfig.longitude)], 10);
  };

  return (
    <div style={{ padding: '28px 32px', fontFamily: "'Segoe UI', system-ui, sans-serif", display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', paddingRight: window.electronAPI?.platform === 'win32' ? 110 : 0 }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#f9fafb', margin: '0 0 4px 0' }}>Live Map</h2>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>
            Real-time aircraft positions · Updates every 5s
            {lastUpdate && <span style={{ marginLeft: '8px', color: '#4b5563' }}>· Last update: {lastUpdate.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleRecenter} style={{ background: 'none', border: '1px solid #374151', borderRadius: '8px', color: '#9ca3af', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Navigation size={12} /> Recenter
          </button>
          <button onClick={() => fetchAircraft(mapRef.current, teamBackgroundTracker.getData())} style={{ background: 'none', border: '1px solid #374151', borderRadius: '8px', color: '#9ca3af', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', background: '#ef444415', border: '1px solid #ef444430', borderRadius: '12px', color: '#fca5a5', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid #2d3748', marginBottom: '16px' }}>
        {(loading && !error) && (
          <div style={{ position: 'absolute', inset: 0, background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, gap: '10px', color: '#6b7280', fontSize: '14px' }}>
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading map...
          </div>
        )}
        <div ref={mapContainerRef} style={{ height: 'calc(100vh - 320px)', minHeight: '360px', width: '100%' }} />
      </div>

      <div style={{ background: 'linear-gradient(135deg, #1e2538 0%, #1a2030 100%)', border: '1px solid #2d3748', borderRadius: '16px', padding: '20px' }}>
        <p style={{ fontSize: '14px', fontWeight: '600', color: '#f9fafb', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plane size={14} color="#9ca3af" />
          Aircraft in Range
          <span style={{ fontSize: '11px', fontWeight: '400', color: '#4b5563', marginLeft: '4px' }}>({aircraft.length} detected)</span>
        </p>

        {aircraft.length === 0 ? (
          <p style={{ color: '#4b5563', fontSize: '13px', margin: 0 }}>No aircraft with position data right now.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {aircraft.map((ac) => {
              const lastSeenMs = ac.last_seen ? new Date(ac.last_seen).getTime() : Date.now();
              const fresh = freshnessStyle(lastSeenMs);
              return (
                <div
                  key={ac.tail_number}
                  onClick={() => {
                    if (mapRef.current && ac.latitude && ac.longitude) {
                      mapRef.current.setView([parseFloat(ac.latitude), parseFloat(ac.longitude)], 13);
                      markersRef.current[ac.tail_number]?.openPopup();
                    }
                  }}
                  style={{ background: '#111827', border: `1px solid ${fresh.color}30`, borderRadius: '10px', padding: '12px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = `${fresh.color}60`}
                  onMouseLeave={e => e.currentTarget.style.borderColor = `${fresh.color}30`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: fresh.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#f9fafb' }}>{ac.tail_number}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: fresh.color }}>{ageLabel(lastSeenMs)}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>{ac.distance_nm?.toFixed(1) ?? '—'} nm · {ac.altitude_ft_msl != null ? Math.round(ac.altitude_ft_msl) + ' ft' : '—'}</span>
                    <span>{ac.velocity_kts != null ? Math.round(ac.velocity_kts) + ' kts' : '—'}{ac.heading != null ? ` · ${Math.round(ac.heading)}°` : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .leaflet-container { background: #0d1117 !important; }
        .leaflet-control-zoom a { background: #1e2538 !important; color: #9ca3af !important; border-color: #2d3748 !important; }
        .leaflet-control-zoom a:hover { background: #2d3748 !important; color: #f9fafb !important; }
        .leaflet-control-attribution { background: rgba(13,17,23,0.8) !important; color: #4b5563 !important; font-size: 10px !important; }
        .leaflet-control-attribution a { color: #6b7280 !important; }
        .leaflet-popup-content-wrapper { background: #1e2538 !important; border: 1px solid #2d3748 !important; border-radius: 12px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important; color: #f9fafb !important; }
        .leaflet-popup-tip { background: #1e2538 !important; }
        .leaflet-popup-content { margin: 14px 16px !important; }
      `}</style>
    </div>
  );
}
