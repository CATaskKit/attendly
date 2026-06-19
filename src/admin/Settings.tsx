import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { AIcon, ACard, APill, BtnPrimary, BtnGhost, PageHead, Spinner } from './ui';
import { getOrganization, updateOrganization, getOrganizationSettings, setOrganizationSetting } from '../lib/api';
import { supabase } from '../lib/supabase';

// Restored from the original design handoff (admin-settings.jsx). Company
// profile and Leave policy are wired live to Supabase; the policy/roles/security/
// notification sections persist locally per-org until a backend exists for them.

// ── Small form primitives (ported) ───────────────────────────────────
const inputStyle: CSSProperties = { width: '100%', boxSizing: 'border-box', height: 42, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel)', padding: '0 13px', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink-1)', outline: 'none' };
const stepBtn: CSSProperties = { width: 38, height: 40, border: 'none', background: 'var(--bg)', color: 'var(--ink-2)', fontSize: 19, fontWeight: 600, cursor: 'pointer' };

function SToggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!on)} disabled={disabled} style={{ width: 44, height: 26, borderRadius: 999, border: 'none', padding: 0, flexShrink: 0, background: on ? 'var(--accent)' : 'var(--line)', position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .2s' }} />
    </button>
  );
}
function SInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function SSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', paddingRight: 36, fontWeight: 600 }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <AIcon name="chevronDown" size={16} color="var(--ink-3)" style={{ position: 'absolute', right: 12, top: 13, pointerEvents: 'none' }} />
    </div>
  );
}
function SNumber({ value, onChange, min = 0, max = 999, step = 1, unit }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', background: 'var(--panel)' }}>
      <button onClick={() => onChange(Math.max(min, value - step))} style={stepBtn}>–</button>
      <span style={{ minWidth: 58, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>{value}{unit ? ' ' + unit : ''}</span>
      <button onClick={() => onChange(Math.min(max, value + step))} style={stepBtn}>+</button>
    </div>
  );
}
function SettingItem({ label, desc, children, last }: { label: string; desc?: string; children: ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 0', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)' }}>{label}</div>
        {desc && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.45 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}
function SCard({ title, desc, children, action }: { title: string; desc?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <ACard style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.01em' }}>{title}</div>
          {desc && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>{desc}</div>}
        </div>
        {action}
      </div>
      {children}
    </ACard>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 7 }}>{label}</span>
      {children}
    </label>
  );
}

// Org-wide settings persistence. Stored in organizations.settings (shared across
// every admin/device); a localStorage copy gives an instant first paint and a
// demo-mode fallback when Supabase isn't configured.
function useOrgSetting<T>(orgId: string | null, key: string, fallback: T): [T, (v: T) => void] {
  const storeKey = `attendly:settings:${orgId ?? 'demo'}:${key}`;
  const [val, setVal] = useState<T>(() => {
    try { const raw = localStorage.getItem(storeKey); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
  });
  useEffect(() => {
    if (!supabase || !orgId) return;
    getOrganizationSettings(orgId)
      .then((s) => { if (s && Object.prototype.hasOwnProperty.call(s, key)) setVal(s[key] as T); })
      .catch(() => { /* keep local/fallback */ });
  }, [orgId, key]);
  const update = (v: T) => {
    setVal(v);
    try { localStorage.setItem(storeKey, JSON.stringify(v)); } catch { /* ignore */ }
    if (supabase && orgId) setOrganizationSetting(orgId, key, v).catch(console.error);
  };
  return [val, update];
}

type SectionProps = { orgId: string | null; canManage: boolean; notify: (t: string, tone?: string, icon?: string) => void; goBilling: () => void };

// ── 1. Company profile (LIVE) ────────────────────────────────────────
function CompanySettings({ orgId, canManage, notify }: SectionProps) {
  const [cfg, setCfg] = useState({ name: '', industry: 'Software / IT', country: 'India', tz: 'Asia/Kolkata', currency: 'INR' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const upd = (k: keyof typeof cfg, v: string) => setCfg((c) => ({ ...c, [k]: v }));

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    getOrganization(orgId).then((o) => {
      if (!o) return;
      setCfg({ name: o.display_name || o.name, industry: o.industry || 'Software / IT', country: o.country || 'India', tz: o.timezone || 'Asia/Kolkata', currency: o.currency || 'INR' });
    }).catch(console.error).finally(() => setLoading(false));
  }, [orgId]);

  const save = async () => {
    if (!orgId) { notify('Company profile saved'); return; }
    setSaving(true);
    try {
      await updateOrganization(orgId, { display_name: cfg.name, industry: cfg.industry, country: cfg.country, timezone: cfg.tz, currency: cfg.currency });
      notify('Company profile saved');
    } catch (e) { console.error(e); notify('Could not save profile', 'red', 'xCircle'); }
    finally { setSaving(false); }
  };

  if (loading) return <Spinner label="Loading company profile…" />;
  return (
    <SCard title="Company profile" desc="Basic information shown across the workspace and on reports." action={canManage ? <BtnPrimary icon="check" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</BtnPrimary> : undefined}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, padding: '4px 0 18px', borderBottom: '1px solid var(--line)' }}>
        <Field label="Display name"><SInput value={cfg.name} onChange={(e) => upd('name', e.target.value)} /></Field>
        <Field label="Industry"><SSelect value={cfg.industry} onChange={(v) => upd('industry', v)} options={['Software / IT', 'Manufacturing', 'Retail', 'Healthcare', 'Financial Services', 'Consulting', 'Services']} /></Field>
        <Field label="Country"><SSelect value={cfg.country} onChange={(v) => upd('country', v)} options={['India', 'United States', 'United Kingdom', 'Singapore', 'UAE']} /></Field>
        <Field label="Currency"><SSelect value={cfg.currency} onChange={(v) => upd('currency', v)} options={['INR', 'USD', 'GBP', 'SGD', 'AED']} /></Field>
      </div>
      <SettingItem label="Timezone" desc="Used for attendance timestamps and reports." last>
        <div style={{ width: 240 }}><SSelect value={cfg.tz} onChange={(v) => upd('tz', v)} options={['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'Asia/Singapore']} /></div>
      </SettingItem>
    </SCard>
  );
}

// ── 1b. Work week (LIVE) — weekend policy + shift timing ─────────────
// These persist to the organizations row and drive payroll working-day counts,
// comp-off (weekend/holiday work), and late-marking in the Attendance MIS.
function WorkWeekSettings({ orgId, canManage, notify }: SectionProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offDays, setOffDays] = useState<number[]>([0]);          // weekly off days among Sun–Fri (Sat is the rule below)
  const [satRule, setSatRule] = useState<'off' | 'even' | 'odd' | 'work'>('off');
  const [shiftStart, setShiftStart] = useState('09:30');
  const [shiftEnd, setShiftEnd] = useState('18:30');
  const [grace, setGrace] = useState(5);

  useEffect(() => {
    if (!supabase || !orgId) { setLoading(false); return; }
    getOrganization(orgId).then((o) => {
      if (!o) return;
      const wd = Array.isArray(o.weekend_days) ? o.weekend_days : [0, 6];
      setOffDays(wd.filter((d) => d !== 6));
      setSatRule(o.weekend_sat_alt === 'even' ? 'even' : o.weekend_sat_alt === 'odd' ? 'odd' : wd.includes(6) ? 'off' : 'work');
      setShiftStart(o.shift_start || '09:30');
      setShiftEnd(o.shift_end || '18:30');
      setGrace(o.late_grace_min == null ? 5 : Number(o.late_grace_min));
    }).catch(console.error).finally(() => setLoading(false));
  }, [orgId]);

  const save = async () => {
    const weekend_days = [...offDays, ...(satRule === 'off' ? [6] : [])].sort((a, b) => a - b);
    const weekend_sat_alt = satRule === 'even' ? 'even' : satRule === 'odd' ? 'odd' : null;
    if (!supabase || !orgId) { notify('Work week saved'); return; }
    setSaving(true);
    try {
      await updateOrganization(orgId, { weekend_days, weekend_sat_alt, shift_start: shiftStart, shift_end: shiftEnd, late_grace_min: grace });
      notify('Work week saved');
    } catch (e) { console.error(e); notify('Could not save work week', 'red', 'xCircle'); }
    finally { setSaving(false); }
  };
  const toggleDay = (n: number) => setOffDays(offDays.includes(n) ? offDays.filter((x) => x !== n) : [...offDays, n]);
  const SAT_OPTS: Record<string, 'off' | 'even' | 'odd' | 'work'> = { 'Off every week': 'off', '2nd & 4th off': 'even', '1st & 3rd off': 'odd', 'Working': 'work' };
  const satLabel = Object.keys(SAT_OPTS).find((k) => SAT_OPTS[k] === satRule) ?? 'Off every week';

  if (loading) return <Spinner label="Loading work week…" />;
  return (
    <SCard title="Work week" desc="Weekend policy and shift timing. These drive payroll working days, comp-off, and late-marking — set them to match how your company actually works (6-day weeks, alternate Saturdays, etc.)." action={canManage ? <BtnPrimary icon="check" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</BtnPrimary> : undefined}>
      <SettingItem label="Weekly off days" desc="Highlighted days are non-working — they're excluded from payroll working days, and attendance on them earns comp-off.">
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ n: 0, l: 'Sun' }, { n: 1, l: 'Mon' }, { n: 2, l: 'Tue' }, { n: 3, l: 'Wed' }, { n: 4, l: 'Thu' }, { n: 5, l: 'Fri' }].map((d) => {
            const on = offDays.includes(d.n);
            return <button key={d.n} onClick={() => canManage && toggleDay(d.n)} disabled={!canManage} style={{ width: 42, height: 38, borderRadius: 9, border: on ? '1.5px solid var(--accent)' : '1.5px solid var(--line)', background: on ? 'var(--accent-soft)' : 'var(--panel)', color: on ? 'var(--accent-deep)' : 'var(--ink-3)', fontWeight: 700, fontSize: 12.5, cursor: canManage ? 'pointer' : 'default' }}>{d.l}</button>;
          })}
        </div>
      </SettingItem>
      <SettingItem label="Saturdays" desc="Fixed or alternate-Saturday week-off policy (e.g. 2nd & 4th Saturday off).">
        <div style={{ width: 200 }}><SSelect value={satLabel} onChange={(v) => canManage && setSatRule(SAT_OPTS[v])} options={Object.keys(SAT_OPTS)} /></div>
      </SettingItem>
      <SettingItem label="Standard shift" desc="Office hours. The start time is the basis for late-marking.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SInput type="time" value={shiftStart} disabled={!canManage} onChange={(e) => setShiftStart(e.target.value)} style={{ width: 120, textAlign: 'center' }} />
          <span style={{ color: 'var(--ink-3)' }}>to</span>
          <SInput type="time" value={shiftEnd} disabled={!canManage} onChange={(e) => setShiftEnd(e.target.value)} style={{ width: 120, textAlign: 'center' }} />
        </div>
      </SettingItem>
      <SettingItem label="Late grace period" desc="Minutes after shift start before a check-in is marked late." last>
        <SNumber value={grace} onChange={setGrace} min={0} max={60} step={5} unit="min" />
      </SettingItem>
    </SCard>
  );
}

// ── 2. Roles & permissions (local) ───────────────────────────────────
const ROLE_NAMES = ['Owner', 'Company Admin', 'HR', 'Manager', 'Employee'];
const PERMS = [
  { k: 'View dashboard', def: [1, 1, 1, 1, 0] },
  { k: 'Manage employees', def: [1, 1, 1, 0, 0] },
  { k: 'Approve leave', def: [1, 1, 1, 1, 0] },
  { k: 'Run payroll MIS', def: [1, 1, 0, 0, 0] },
  { k: 'Manage holidays', def: [1, 1, 1, 0, 0] },
  { k: 'Edit settings', def: [1, 1, 0, 0, 0] },
  { k: 'View audit logs', def: [1, 1, 0, 0, 0] },
];
type PermMatrix = Record<string, Record<string, boolean>>;
function gridFromMatrix(matrix: PermMatrix | null): number[][] {
  return PERMS.map((p) => ROLE_NAMES.map((role, c) => {
    if (c === 0) return 1; // Owner is always on
    const v = matrix?.[p.k]?.[role];
    return v === undefined ? p.def[c] : (v ? 1 : 0);
  }));
}
function matrixFromGrid(grid: number[][]): PermMatrix {
  const m: PermMatrix = {};
  PERMS.forEach((p, r) => { m[p.k] = {}; ROLE_NAMES.forEach((role, c) => { m[p.k][role] = !!grid[r][c]; }); });
  return m;
}
const rolePermsLocalKey = (orgId: string | null) => `attendly:settings:${orgId ?? 'demo'}:rolePerms`;

function RolesSettings({ orgId, canManage, notify }: SectionProps) {
  const [grid, setGrid] = useState<number[][]>(() => PERMS.map((p) => p.def.slice()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase || !orgId) {
      try { const raw = localStorage.getItem(rolePermsLocalKey(orgId)); if (raw) setGrid(JSON.parse(raw) as number[][]); } catch { /* ignore */ }
      setLoading(false); return;
    }
    supabase.from('role_permissions').select('matrix').eq('org_id', orgId).maybeSingle()
      .then(({ data, error }) => { if (error) console.error(error); setGrid(gridFromMatrix((data?.matrix as PermMatrix | undefined) ?? null)); setLoading(false); });
  }, [orgId]);

  const flip = (r: number, c: number) => { if (c === 0 || !canManage) return; setGrid(grid.map((row, ri) => ri === r ? row.map((v, ci) => ci === c ? (v ? 0 : 1) : v) : row)); };

  const save = async () => {
    if (!supabase || !orgId) {
      try { localStorage.setItem(rolePermsLocalKey(orgId), JSON.stringify(grid)); } catch { /* ignore */ }
      notify('Permissions updated'); return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('role_permissions').upsert({ org_id: orgId, matrix: matrixFromGrid(grid), updated_at: new Date().toISOString() });
      if (error) throw error;
      notify('Permissions updated');
    } catch (e) { console.error(e); notify('Could not save permissions', 'red', 'xCircle'); }
    finally { setSaving(false); }
  };

  if (loading) return <Spinner label="Loading permissions…" />;
  return (
    <SCard title="Roles & permissions" desc="Role-based access control. Owner permissions are locked." action={canManage ? <BtnPrimary icon="check" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</BtnPrimary> : undefined}>
      <div style={{ overflowX: 'auto', margin: '0 -4px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead><tr>
            <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>Permission</th>
            {ROLE_NAMES.map((r, i) => <th key={r} style={{ padding: '10px 8px', fontSize: 11.5, fontWeight: 700, color: i === 0 ? 'var(--accent-deep)' : 'var(--ink-2)', textAlign: 'center', whiteSpace: 'nowrap' }}>{r}</th>)}
          </tr></thead>
          <tbody>
            {PERMS.map((p, r) => (
              <tr key={p.k}>
                <td style={{ padding: '12px 8px', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-1)', borderTop: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{p.k}</td>
                {ROLE_NAMES.map((_, c) => {
                  const on = grid[r][c], locked = c === 0;
                  return <td key={c} style={{ textAlign: 'center', borderTop: '1px solid var(--line)' }}>
                    <button onClick={() => flip(r, c)} disabled={locked || !canManage} style={{ width: 26, height: 26, borderRadius: 8, border: 'none', cursor: locked || !canManage ? 'default' : 'pointer', background: on ? (locked ? 'var(--soft)' : 'var(--green-soft)') : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <AIcon name="check" size={16} color={locked ? 'var(--ink-3)' : 'var(--green)'} sw={2.6} /> : <span style={{ width: 10, height: 2, borderRadius: 2, background: 'var(--line)' }} />}
                    </button>
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SCard>
  );
}

// ── 3. Attendance policy (local) ─────────────────────────────────────
function AttendanceSettings({ orgId, canManage, notify }: SectionProps) {
  const [c, setC] = useOrgSetting(orgId, 'attendancePolicy', { geofence: 150, ot: 8, half: 4, selfie: true, gps: true, web: false, otOn: true });
  const u = (k: keyof typeof c, v: number | boolean) => setC({ ...c, [k]: v });
  return (
    <SCard title="Attendance policy" desc="Rules applied when employees check in and out. Shift timing & late grace are set in Work week." action={canManage ? <BtnPrimary icon="check" onClick={() => notify('Attendance policy saved')}>Save</BtnPrimary> : undefined}>
      <SettingItem label="Geofence radius" desc="Allowed distance from office location for a valid check-in."><SNumber value={c.geofence} onChange={(v) => u('geofence', v)} min={50} max={1000} step={50} unit="m" /></SettingItem>
      <SettingItem label="Require GPS location" desc="Compulsory — check-in is blocked until the employee shares a location."><SToggle on={true} onChange={() => {}} disabled /></SettingItem>
      <SettingItem label="Require check-in selfie" desc="Capture a verification selfie on every check-in."><SToggle on={c.selfie} onChange={(v) => u('selfie', v)} /></SettingItem>
      <SettingItem label="Allow web check-in" desc="Permit attendance from the web app, not just mobile."><SToggle on={c.web} onChange={(v) => u('web', v)} /></SettingItem>
      <SettingItem label="Calculate overtime" desc="Track hours worked beyond the daily threshold.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {c.otOn && <SNumber value={c.ot} onChange={(v) => u('ot', v)} min={6} max={12} unit="hrs" />}
          <SToggle on={c.otOn} onChange={(v) => u('otOn', v)} />
        </div>
      </SettingItem>
      <SettingItem label="Half-day threshold" desc="Worked hours below this count as a half day." last><SNumber value={c.half} onChange={(v) => u('half', v)} min={2} max={6} unit="hrs" /></SettingItem>
    </SCard>
  );
}

// ── 4. Leave policy (LIVE) ───────────────────────────────────────────
type LeaveTypeRow = { id?: string; name: string; quota: number; accrual: string; carry_forward: boolean; paid: boolean; color: string | null };
function LeaveSettings({ orgId, canManage, notify }: SectionProps) {
  const [types, setTypes] = useState<LeaveTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!supabase || !orgId) { setLoading(false); return; }
    supabase.from('leave_types').select('id,name,quota,accrual,carry_forward,paid,color').eq('org_id', orgId).order('name')
      .then(({ data, error }) => { if (error) console.error(error); else setTypes((data as LeaveTypeRow[]) ?? []); setLoading(false); });
  };
  useEffect(load, [orgId]);
  const u = (i: number, k: keyof LeaveTypeRow, v: number | string | boolean) => setTypes(types.map((x, xi) => xi === i ? { ...x, [k]: v } : x));
  const addType = () => setTypes([...types, { name: '', quota: 10, accrual: 'Monthly', carry_forward: false, paid: true, color: '#1573e6' }]);

  const save = async () => {
    if (!supabase || !orgId) { notify('Leave policy saved'); return; }
    setSaving(true);
    try {
      for (const t of types) {
        if (!t.name.trim()) continue;
        const fields = { org_id: orgId, name: t.name.trim(), quota: t.quota, accrual: t.accrual, carry_forward: t.carry_forward, paid: t.paid };
        if (t.id) await supabase.from('leave_types').update(fields).eq('id', t.id);
        else await supabase.from('leave_types').insert(fields);
      }
      notify('Leave policy saved');
      load();
    } catch (e) { console.error(e); notify('Could not save leave policy', 'red', 'xCircle'); }
    finally { setSaving(false); }
  };

  if (loading) return <Spinner label="Loading leave policy…" />;
  return (
    <SCard title="Leave policy" desc="Configure leave types, quotas and accrual." action={canManage ? <div style={{ display: 'flex', gap: 8 }}><BtnGhost icon="plus" onClick={addType}>Add type</BtnGhost><BtnPrimary icon="check" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</BtnPrimary></div> : undefined}>
      {types.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>No leave types yet. Add one to get started.</div>
      ) : (
      <div style={{ overflowX: 'auto', margin: '0 -4px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead><tr>{['Leave type', 'Annual quota', 'Accrual', 'Carry forward', 'Paid'].map((h, i) => <th key={h} style={{ textAlign: i > 0 ? 'center' : 'left', padding: '10px 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>)}</tr></thead>
          <tbody>
            {types.map((t, i) => (
              <tr key={t.id ?? `new-${i}`}>
                <td style={{ padding: '12px 8px', borderTop: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color || 'var(--accent)', flexShrink: 0 }} />
                    <SInput value={t.name} onChange={(e) => u(i, 'name', e.target.value)} placeholder="Leave type" style={{ height: 38, fontWeight: 700 }} />
                  </div>
                </td>
                <td style={{ textAlign: 'center', borderTop: '1px solid var(--line)' }}><SNumber value={Number(t.quota)} onChange={(v) => u(i, 'quota', v)} min={0} max={40} /></td>
                <td style={{ textAlign: 'center', borderTop: '1px solid var(--line)', minWidth: 130 }}><SSelect value={t.accrual || 'Monthly'} onChange={(v) => u(i, 'accrual', v)} options={['Monthly', 'Annual', '—']} /></td>
                <td style={{ textAlign: 'center', borderTop: '1px solid var(--line)' }}><div style={{ display: 'flex', justifyContent: 'center' }}><SToggle on={!!t.carry_forward} onChange={(v) => u(i, 'carry_forward', v)} /></div></td>
                <td style={{ textAlign: 'center', borderTop: '1px solid var(--line)' }}><div style={{ display: 'flex', justifyContent: 'center' }}><SToggle on={!!t.paid} onChange={(v) => u(i, 'paid', v)} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </SCard>
  );
}

// ── 5. Security (local) ──────────────────────────────────────────────
function SecuritySettings({ orgId, canManage, notify }: SectionProps) {
  const [c, setC] = useOrgSetting(orgId, 'security', { twofa: true, enforce: true, timeout: '30 minutes', minlen: 10, symbols: true });
  const u = (k: keyof typeof c, v: number | string | boolean) => setC({ ...c, [k]: v });
  const statuses = [['Row Level Security', "Every tenant's data is isolated at the database level", 'Enabled'], ['Audit logging', 'All admin actions are recorded with actor and timestamp', 'On'], ['Encryption at rest', 'Sensitive fields encrypted with AES-256', 'AES-256']];
  return (
    <div>
      <SCard title="Authentication" desc="Sign-in and session controls." action={canManage ? <BtnPrimary icon="check" onClick={() => notify('Security settings saved')}>Save</BtnPrimary> : undefined}>
        <SettingItem label="Two-factor authentication" desc="Require a second factor at sign-in."><SToggle on={c.twofa} onChange={(v) => u('twofa', v)} /></SettingItem>
        <SettingItem label="Enforce 2FA for admins" desc="Company Admin & HR roles must enable 2FA."><SToggle on={c.enforce} onChange={(v) => u('enforce', v)} /></SettingItem>
        <SettingItem label="Session timeout" desc="Auto sign-out after inactivity."><div style={{ width: 180 }}><SSelect value={c.timeout} onChange={(v) => u('timeout', v)} options={['15 minutes', '30 minutes', '1 hour', '4 hours']} /></div></SettingItem>
        <SettingItem label="Minimum password length" desc="Applies to all new and changed passwords."><SNumber value={c.minlen} onChange={(v) => u('minlen', v)} min={6} max={20} /></SettingItem>
        <SettingItem label="Require symbols & numbers" desc="Passwords must include a symbol and a digit." last><SToggle on={c.symbols} onChange={(v) => u('symbols', v)} /></SettingItem>
      </SCard>
      <SCard title="Platform security" desc="Managed safeguards — always on.">
        {statuses.map((s, i) => (
          <div key={s[0]} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 0', borderBottom: i < statuses.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AIcon name="shield" size={19} color="var(--green)" /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)' }}>{s[0]}</div><div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{s[1]}</div></div>
            <APill tone="green"><AIcon name="check" size={12} sw={3} />{s[2]}</APill>
          </div>
        ))}
      </SCard>
    </div>
  );
}

// ── 6. Notifications (local) ─────────────────────────────────────────
const NOTIF_EVENTS = ['Check-in / check-out', 'Leave applied', 'Leave approved', 'Leave rejected', 'New leave request (approver)', 'Payroll MIS generated'];
function NotifSettings({ orgId, canManage, notify }: SectionProps) {
  const [grid, setGrid] = useOrgSetting<boolean[][]>(orgId, 'notifPrefs', NOTIF_EVENTS.map((_, i) => [i !== 5, true]));
  const flip = (r: number, c: number) => setGrid(grid.map((row, ri) => ri === r ? row.map((v, ci) => ci === c ? !v : v) : row));
  return (
    <SCard title="Notifications" desc="Choose how employees and approvers are notified." action={canManage ? <BtnPrimary icon="check" onClick={() => notify('Notification preferences saved')}>Save</BtnPrimary> : undefined}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 0 }}>
        <div style={{ padding: '8px 0', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase' }}>Event</div>
        <div style={{ padding: '8px 0', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', textAlign: 'center' }}>Push</div>
        <div style={{ padding: '8px 0', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', textAlign: 'center' }}>Email</div>
        {NOTIF_EVENTS.map((e, r) => (
          <div key={e} style={{ display: 'contents' }}>
            <div style={{ padding: '15px 0', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-1)', borderTop: '1px solid var(--line)' }}>{e}</div>
            <div style={{ padding: '12px 0', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'center' }}><SToggle on={grid[r][0]} onChange={() => canManage && flip(r, 0)} /></div>
            <div style={{ padding: '12px 0', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'center' }}><SToggle on={grid[r][1]} onChange={() => canManage && flip(r, 1)} /></div>
          </div>
        ))}
      </div>
    </SCard>
  );
}

// ── 7. Subscription (links to the live Billing page) ─────────────────
function SubscriptionSettings({ goBilling }: SectionProps) {
  return (
    <SCard title="Subscription" desc="Your plan, seats and payment history are managed on the Billing page.">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0 4px' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AIcon name="wallet" size={22} color="var(--accent)" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)' }}>Plan & billing</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Manage your subscription tier, seats and Razorpay payments.</div>
        </div>
        <BtnPrimary icon="wallet" onClick={goBilling}>Open billing</BtnPrimary>
      </div>
    </SCard>
  );
}

// ── Settings shell ───────────────────────────────────────────────────
const SETTINGS_NAV = [
  { id: 'company', icon: 'building', label: 'Company profile', Body: CompanySettings },
  { id: 'workweek', icon: 'calendar', label: 'Work week', Body: WorkWeekSettings },
  { id: 'roles', icon: 'users', label: 'Roles & permissions', Body: RolesSettings },
  { id: 'attendance', icon: 'clock', label: 'Attendance policy', Body: AttendanceSettings },
  { id: 'leave', icon: 'calendarClock', label: 'Leave policy', Body: LeaveSettings },
  { id: 'security', icon: 'shield', label: 'Security', Body: SecuritySettings },
  { id: 'notifications', icon: 'bell', label: 'Notifications', Body: NotifSettings },
  { id: 'subscription', icon: 'wallet', label: 'Subscription', Body: SubscriptionSettings },
] as const;

export default function Settings({ orgId, canManage, onToast, onGoBilling }: { orgId: string | null; canManage: boolean; onToast: (t: string, tone?: string, icon?: string) => void; onGoBilling: () => void }) {
  const [sec, setSec] = useState<string>('company');
  const active = SETTINGS_NAV.find((s) => s.id === sec) ?? SETTINGS_NAV[0];
  const Body = active.Body;
  return (
    <div>
      <PageHead title="Settings" sub="Company configuration, roles, policies & security" />
      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 22, alignItems: 'start' }}>
        <ACard pad={8} style={{ position: 'sticky', top: 0 }}>
          {SETTINGS_NAV.map((s) => {
            const on = sec === s.id;
            return (
              <button key={s.id} onClick={() => setSec(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '11px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 2, background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent-deep)' : 'var(--ink-2)', fontWeight: on ? 700 : 600, fontSize: 13.5 }}>
                <AIcon name={s.icon} size={18} color={on ? 'var(--accent)' : 'var(--ink-3)'} />{s.label}
              </button>
            );
          })}
        </ACard>
        <div style={{ minWidth: 0 }}>
          <Body orgId={orgId} canManage={canManage} notify={onToast} goBilling={onGoBilling} />
        </div>
      </div>
    </div>
  );
}
