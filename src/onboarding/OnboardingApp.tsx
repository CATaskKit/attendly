import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ADMIN_VARS } from '../admin/theme';
import { AIcon, AAvatar, BtnGhost, BtnPrimary, AToast } from '../admin/ui';
import { getOrganization, updateOrganization, addDepartments, addLeaveTypes, addEmployees } from '../lib/api';

type EmpDraft = { name: string; email: string; dept: string; designation: string; manager: string };
type State = {
  display: string; industry: string; country: string; timezone: string; currency: string;
  departments: string[];
  leaveTypes: { name: string; quota: number }[];
  employees: EmpDraft[];
};

const STEPS = [
  { id: 'company', title: 'Company profile', rail: 'Brand & locale', icon: 'building' },
  { id: 'departments', title: 'Departments', rail: 'Org structure', icon: 'grid' },
  { id: 'leave', title: 'Leave policy', rail: 'Types & quotas', icon: 'umbrella' },
  { id: 'team', title: 'Invite your team', rail: 'Add people', icon: 'users' },
  { id: 'finish', title: 'Finish', rail: 'Go live', icon: 'check' },
];

const DEFAULT_STATE: State = {
  display: '', industry: 'Software / IT', country: 'India', timezone: 'Asia/Kolkata', currency: 'INR',
  departments: ['Engineering', 'Design', 'Sales', 'Operations', 'Finance'],
  leaveTypes: [
    { name: 'Casual', quota: 12 }, { name: 'Sick', quota: 8 }, { name: 'Paid', quota: 15 }, { name: 'Work from home', quota: 24 },
  ],
  employees: [{ name: '', email: '', dept: 'Engineering', designation: '', manager: '' }],
};

const input: CSSProperties = { width: '100%', boxSizing: 'border-box', height: 44, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel)', padding: '0 13px', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink-1)', outline: 'none' };
const lbl: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 7 };

function Panel({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 18, padding: 24, boxShadow: '0 1px 2px rgba(16,28,48,.04)' }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>{title}</div>
      {desc && <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 3, marginBottom: 18 }}>{desc}</div>}
      {!desc && <div style={{ height: 18 }} />}
      {children}
    </div>
  );
}

function Chips({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const add = () => { const v = draft.trim(); if (v && !items.includes(v)) { onChange([...items, v]); setDraft(''); } };
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: items.length ? 12 : 0 }}>
        {items.map((it, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 8px 0 13px', borderRadius: 999, background: 'var(--accent-soft)', border: '1px solid color-mix(in oklab, var(--accent) 26%, #fff)', color: 'var(--accent-deep)', fontWeight: 700, fontSize: 13 }}>
            {it}
            <button onClick={() => onChange(items.filter((_, x) => x !== i))} style={{ display: 'flex', width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', color: 'inherit' }}><AIcon name="x" size={13} color="currentColor" sw={2.4} /></button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} style={input} />
        <BtnGhost icon="plus" onClick={add}>Add</BtnGhost>
      </div>
    </div>
  );
}

export default function OnboardingApp() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const orgId = profile?.org_id ?? null;

  const [step, setStep] = useState(0);
  const [s, setS] = useState<State>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: string; icon: string } | null>(null);
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!orgId) return;
    getOrganization(orgId).then((o) => { if (o) setS((p) => ({ ...p, display: o.display_name || o.name })); }).catch(() => {});
  }, [orgId]);

  const fire = (text: string, tone = 'green', icon = 'checkCircle') => { setToast({ text, tone, icon }); setTimeout(() => setToast(null), 2600); };

  const finish = async () => {
    if (!orgId) { navigate('/admin'); return; }
    setSaving(true);
    try {
      await updateOrganization(orgId, { display_name: s.display, industry: s.industry, country: s.country, timezone: s.timezone, currency: s.currency, plan: 'trial' });
      await addDepartments(orgId, s.departments);
      await addLeaveTypes(orgId, s.leaveTypes);
      await addEmployees(orgId, s.employees);
      navigate('/admin');
    } catch (e) {
      console.error(e); fire('Setup failed — please try again', 'red', 'xCircle'); setSaving(false);
    }
  };

  const last = step === STEPS.length - 1;
  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', ...ADMIN_VARS, background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: 'var(--ink-1)' }}>
      {/* RAIL */}
      <aside style={{ width: 290, flexShrink: 0, background: 'var(--side-bg)', borderRight: '1px solid var(--side-line)', display: 'flex', flexDirection: 'column', padding: '26px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px 18px' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(140deg, var(--accent), var(--accent-deep))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AIcon name="check" size={18} color="#fff" sw={2.8} /></div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>eHajri</div>
        </div>
        <div style={{ padding: '8px 6px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Get started</div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>Set up your workspace</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {STEPS.map((st, i) => {
            const done = i < step, active = i === step;
            return (
              <button key={st.id} onClick={() => i <= step && setStep(i)} style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 11, border: 'none', cursor: i <= step ? 'pointer' : 'default', background: active ? 'var(--side-active-bg)' : 'transparent' }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12.5, flexShrink: 0, background: done || active ? 'var(--accent)' : 'transparent', border: done || active ? 'none' : '1.5px solid var(--side-line)', color: done || active ? '#fff' : 'var(--side-dim)' }}>
                  {done ? <AIcon name="check" size={15} color="#fff" sw={3} /> : i + 1}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: active ? 800 : 700, color: active ? 'var(--side-active-ink)' : done ? 'var(--side-ink)' : 'var(--side-dim)' }}>{st.title}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--side-dim)', fontWeight: 500 }}>{st.rail}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 'auto', padding: '13px 14px', borderRadius: 13, background: 'var(--side-hover)', display: 'flex', alignItems: 'center', gap: 11 }}>
          <AAvatar name={profile?.full_name || 'You'} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name || 'You'}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}><AIcon name="shield" size={12} color="currentColor" sw={2.2} /> Owner</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 58, flexShrink: 0, borderBottom: '1px solid var(--line)', background: 'var(--panel)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 36px' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-2)' }}>Step {step + 1} of {STEPS.length} · <span style={{ color: 'var(--ink-1)' }}>{STEPS[step].title}</span></span>
          <div style={{ flex: 1, maxWidth: 280, height: 7, borderRadius: 999, background: 'var(--soft)', overflow: 'hidden', marginLeft: 8 }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'var(--accent)', transition: 'width .35s' }} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{pct}%</span>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '34px 44px 40px' }}>
          <div style={{ maxWidth: 720 }}>
            <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{STEPS[step].title}</h1>

            {step === 0 && (
              <Panel title="Identity & locale" desc="How your company appears, and the defaults every record inherits.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Company display name</span><input style={input} value={s.display} onChange={(e) => set('display', e.target.value)} placeholder="Acme Technologies" /></label>
                  <label><span style={lbl}>Industry</span><select style={{ ...input, appearance: 'none' }} value={s.industry} onChange={(e) => set('industry', e.target.value)}>{['Software / IT', 'Manufacturing', 'Retail', 'Finance', 'Healthcare', 'Services'].map((o) => <option key={o}>{o}</option>)}</select></label>
                  <label><span style={lbl}>Country</span><select style={{ ...input, appearance: 'none' }} value={s.country} onChange={(e) => set('country', e.target.value)}>{['India', 'United States', 'United Kingdom', 'Singapore', 'UAE'].map((o) => <option key={o}>{o}</option>)}</select></label>
                  <label><span style={lbl}>Timezone</span><select style={{ ...input, appearance: 'none' }} value={s.timezone} onChange={(e) => set('timezone', e.target.value)}>{['Asia/Kolkata', 'America/New_York', 'Europe/London', 'Asia/Singapore', 'Asia/Dubai'].map((o) => <option key={o}>{o}</option>)}</select></label>
                  <label><span style={lbl}>Currency</span><select style={{ ...input, appearance: 'none' }} value={s.currency} onChange={(e) => set('currency', e.target.value)}>{['INR', 'USD', 'GBP', 'SGD', 'AED'].map((o) => <option key={o}>{o}</option>)}</select></label>
                </div>
              </Panel>
            )}

            {step === 1 && (
              <Panel title="Departments" desc="The functional units of your company. Employees and approvals route through these.">
                <Chips items={s.departments} onChange={(v) => set('departments', v)} placeholder="Add a department, e.g. Marketing" />
              </Panel>
            )}

            {step === 2 && (
              <Panel title="Leave types" desc="Each type accrues against an annual quota per employee.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {s.leaveTypes.map((lt, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)' }}>
                      <input style={{ ...input, flex: 1, height: 40 }} value={lt.name} onChange={(e) => set('leaveTypes', s.leaveTypes.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x))} placeholder="Leave type" />
                      <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                        <button onClick={() => set('leaveTypes', s.leaveTypes.map((x, xi) => xi === i ? { ...x, quota: Math.max(0, x.quota - 1) } : x))} style={{ width: 36, height: 40, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontSize: 18, color: 'var(--ink-2)' }}>–</button>
                        <span style={{ minWidth: 64, textAlign: 'center', fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)' }}>{lt.quota} d</span>
                        <button onClick={() => set('leaveTypes', s.leaveTypes.map((x, xi) => xi === i ? { ...x, quota: x.quota + 1 } : x))} style={{ width: 36, height: 40, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontSize: 18, color: 'var(--ink-2)' }}>+</button>
                      </div>
                      <button onClick={() => set('leaveTypes', s.leaveTypes.filter((_, xi) => xi !== i))} style={{ width: 36, height: 40, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--panel)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}><AIcon name="trash" size={16} color="currentColor" /></button>
                    </div>
                  ))}
                  <button onClick={() => set('leaveTypes', [...s.leaveTypes, { name: '', quota: 10 }])} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 14px', border: '1px dashed var(--line)', borderRadius: 11, background: 'transparent', cursor: 'pointer', color: 'var(--accent)', fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit' }}><AIcon name="plus" size={15} color="currentColor" sw={2.2} /> Add leave type</button>
                </div>
              </Panel>
            )}

            {step === 3 && (
              <Panel title="Invite your team" desc="Add the people in your organization. You can add more later from the admin console.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {s.employees.map((e, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 1fr 36px', gap: 10, alignItems: 'center' }}>
                      <input style={{ ...input, height: 40 }} value={e.name} onChange={(ev) => set('employees', s.employees.map((x, xi) => xi === i ? { ...x, name: ev.target.value } : x))} placeholder="Full name" />
                      <input style={{ ...input, height: 40 }} value={e.email} onChange={(ev) => set('employees', s.employees.map((x, xi) => xi === i ? { ...x, email: ev.target.value } : x))} placeholder="name@company.com" />
                      <select style={{ ...input, height: 40, appearance: 'none' }} value={e.dept} onChange={(ev) => set('employees', s.employees.map((x, xi) => xi === i ? { ...x, dept: ev.target.value } : x))}>{s.departments.map((d) => <option key={d}>{d}</option>)}</select>
                      <button onClick={() => set('employees', s.employees.filter((_, xi) => xi !== i))} style={{ width: 36, height: 40, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--panel)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}><AIcon name="trash" size={16} color="currentColor" /></button>
                    </div>
                  ))}
                  <button onClick={() => set('employees', [...s.employees, { name: '', email: '', dept: s.departments[0] || '', designation: '', manager: '' }])} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 14px', border: '1px dashed var(--line)', borderRadius: 11, background: 'transparent', cursor: 'pointer', color: 'var(--accent)', fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit' }}><AIcon name="plus" size={15} color="currentColor" sw={2.2} /> Add person</button>
                </div>
              </Panel>
            )}

            {step === 4 && (
              <Panel title="Review & go live" desc="Here's what we'll create for your workspace.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  {[['building', s.display || 'Company', 'Workspace'], ['grid', s.departments.length, 'Departments'], ['umbrella', s.leaveTypes.filter((t) => t.name.trim()).length, 'Leave types'], ['users', s.employees.filter((e) => e.name.trim()).length, 'Employees']].map(([ic, v, l]) => (
                    <div key={l as string} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AIcon name={ic as string} size={20} color="var(--accent)" /></span>
                      <div style={{ minWidth: 0 }}><div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{l}</div></div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '13px 16px', borderRadius: 12, background: 'var(--soft)' }}>
                  <AIcon name="shield" size={18} color="var(--accent)" /><span style={{ fontSize: 13, color: 'var(--ink-2)' }}>You're the <b style={{ color: 'var(--ink-1)' }}>Owner</b>. Everything is isolated to your organization.</span>
                </div>
              </Panel>
            )}
          </div>
        </div>

        <footer style={{ height: 78, flexShrink: 0, borderTop: '1px solid var(--line)', background: 'var(--panel)', display: 'flex', alignItems: 'center', padding: '0 36px', gap: 16 }}>
          {step > 0 ? <BtnGhost icon="chevronRight" onClick={() => setStep((x) => x - 1)}>Back</BtnGhost> : <button onClick={() => navigate('/admin')} style={{ border: 'none', background: 'none', color: 'var(--ink-3)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>Skip for now</button>}
          <div style={{ marginLeft: 'auto' }}>
            {last
              ? <BtnPrimary icon="check" onClick={finish} disabled={saving}>{saving ? 'Setting up…' : 'Finish & go to admin'}</BtnPrimary>
              : <BtnPrimary icon="chevronRight" onClick={() => setStep((x) => x + 1)}>Continue</BtnPrimary>}
          </div>
        </footer>
      </div>

      <AToast show={!!toast} text={toast?.text} tone={toast?.tone} icon={toast?.icon} />
    </div>
  );
}
