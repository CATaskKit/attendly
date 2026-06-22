import { useEffect, useState } from 'react';
import { AIcon, AAvatar, Spinner } from './ui';
import { supabase } from '../lib/supabase';
import { staticMapUrl, hasGoogleMaps } from '../lib/maps';
import type { Employee } from '../lib/api';

type Row = { day: string; check_in_at: string | null; location: string | null; lat: number | null; lng: number | null };

// Shows an employee's recent check-ins on a map (Google Static Map per row).
// Reads the lat/lng captured at check-in (migration 0018).
export default function CheckinMapModal({ employee, orgId, onClose }: { employee: Employee; orgId: string | null; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!supabase || !orgId || !employee.id) { setLoading(false); return; }
    supabase.from('attendance')
      .select('day,check_in_at,location,lat,lng')
      .eq('org_id', orgId).eq('employee_id', employee.id)
      .not('lat', 'is', null)
      .order('day', { ascending: false }).limit(40)
      .then(({ data, error }) => { if (!active) return; if (error) console.error(error); else setRows((data as Row[]) ?? []); setLoading(false); });
    return () => { active = false; };
  }, [orgId, employee.id]);

  const fmt = (r: Row) => {
    const d = new Date(r.day + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const t = r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
    return t ? `${d} · ${t}` : d;
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,34,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '100%', maxHeight: '88vh', background: 'var(--panel)', borderRadius: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <AAvatar name={employee.name} size={36} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink-1)' }}>{employee.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{employee.code} · check-in locations</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: 'var(--soft)', cursor: 'pointer', flexShrink: 0 }}><AIcon name="x" size={17} color="var(--ink-2)" /></button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto' }}>
          {!hasGoogleMaps() && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--soft)', fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 14 }}>
              Add a Google Maps key (VITE_GOOGLE_MAPS_KEY) to show map images. Coordinates are still recorded.
            </div>
          )}
          {loading ? <Spinner label="Loading check-in locations…" />
            : rows.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ink-3)' }}>
                <AIcon name="map" size={26} color="var(--ink-3)" />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', marginTop: 10 }}>No located check-ins yet</div>
                <div style={{ fontSize: 12.5, marginTop: 3 }}>Locations recorded from new check-ins will appear here.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {rows.map((r, i) => {
                  const url = r.lat != null && r.lng != null ? staticMapUrl(r.lat, r.lng, { height: 180 }) : null;
                  return (
                    <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: 'var(--bg)' }}>
                      {url
                        ? <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer"><img src={url} alt="Check-in location" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} /></a>
                        : <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}><AIcon name="map" size={22} color="var(--ink-3)" /></div>}
                      <div style={{ padding: '11px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-1)' }}>{fmt(r)}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.4 }}>{r.location || `${r.lat}, ${r.lng}`}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
