import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneFrame from '../components/PhoneFrame';
import { Icon } from './ui';
import { DEFAULT_TWEAKS, themeVars } from './theme';

// ── Brand mark: rounded gradient tile + check ─────────────────────────
function OnTimeMark({ size = 60, radius }: { size?: number; radius?: number }) {
  const r = radius != null ? radius : size * 0.3;
  return (
    <div style={{
      width: size, height: size, borderRadius: r, flexShrink: 0,
      background: 'var(--hero)', boxShadow: 'var(--hero-shadow)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -size * 0.28, right: -size * 0.24, width: size * 0.7, height: size * 0.7, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
      <Icon name="check" size={size * 0.52} color="#fff" strokeWidth={2.8} />
    </div>
  );
}

function Field({
  icon, type = 'text', label, value, onChange, placeholder, autoComplete, trailing, error, onFocus,
}: {
  icon: string; type?: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoComplete?: string; trailing?: ReactNode; error?: string | null; onFocus?: () => void;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={loginStyles.fieldLabel}>{label}</label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 11, height: 54,
        padding: '0 14px', borderRadius: 'var(--r-card)',
        background: 'var(--card)',
        border: error ? '1.5px solid var(--danger)' : focus ? '1.5px solid var(--accent)' : '1.5px solid var(--hair)',
        boxShadow: focus ? '0 0 0 4px var(--accent-soft)' : 'none',
        transition: 'border-color .15s, box-shadow .15s',
      }}>
        <Icon name={icon} size={20} color={focus ? 'var(--accent)' : 'var(--text-3)'} strokeWidth={1.9} />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { setFocus(true); onFocus && onFocus(); }}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'inherit', fontSize: 15.5, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.01em',
          }}
        />
        {trailing}
      </div>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, paddingLeft: 2 }}>
          <Icon name="x" size={13} color="var(--danger)" strokeWidth={2.6} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>{error}</span>
        </div>
      )}
    </div>
  );
}

function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('aarav.mehta@ontime.co');
  const [pw, setPw] = useState('ontime');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string | null; pw?: string | null }>({});
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'face'>('idle');
  const [shake, setShake] = useState(false);

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 420); };

  const submit = () => {
    if (phase !== 'idle') return;
    const e: { email?: string; pw?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid work email';
    if (pw.length < 4) e.pw = 'Enter your password';
    setErrors(e);
    if (Object.keys(e).length) { triggerShake(); return; }
    setPhase('submitting');
    setTimeout(() => onSignedIn(), 1050);
  };

  const faceLogin = () => {
    if (phase !== 'idle') return;
    setErrors({});
    setPhase('face');
    setTimeout(() => onSignedIn(), 1500);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: -150, left: '50%', transform: 'translateX(-50%)',
        width: 460, height: 360, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(closest-side, var(--accent-soft), transparent)', opacity: 0.9,
      }} />

      <div style={{ height: 'var(--topbar, 0px)', flexShrink: 0 }} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 26px', display: 'flex', flexDirection: 'column' }} className="no-scrollbar">
        <div style={{ paddingTop: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <OnTimeMark size={56} />
            <div>
              <div style={{ fontSize: 25, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1, whiteSpace: 'nowrap' }}>On Time</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-3)', marginTop: 4, letterSpacing: '0.02em' }}>by CATaskKit</div>
            </div>
          </div>
          <h1 style={{ margin: '34px 0 0', fontSize: 30, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>Welcome back</h1>
          <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--text-3)', fontWeight: 500, lineHeight: 1.45 }}>Sign in to mark your attendance and manage leave.</p>
        </div>

        <div style={{ marginTop: 30, animation: shake ? 'loginShake .42s cubic-bezier(.36,.07,.19,.97)' : 'none' }}>
          <Field
            icon="mail" type="email" label="Work email" autoComplete="username"
            value={email} onChange={setEmail} placeholder="you@company.com"
            error={errors.email} onFocus={() => setErrors((s) => ({ ...s, email: null }))}
          />
          <Field
            icon="lock" type={showPw ? 'text' : 'password'} label="Password" autoComplete="current-password"
            value={pw} onChange={setPw} placeholder="Enter your password"
            error={errors.pw} onFocus={() => setErrors((s) => ({ ...s, pw: null }))}
            trailing={
              <button onClick={() => setShowPw((s) => !s)} style={loginStyles.eyeBtn} aria-label="Toggle password">
                <Icon name={showPw ? 'eyeOff' : 'eye'} size={19} color="var(--text-3)" strokeWidth={1.9} />
              </button>
            }
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 2px 24px' }}>
            <button onClick={() => setRemember((r) => !r)} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{
                width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                background: remember ? 'var(--accent)' : 'var(--card)',
                border: remember ? 'none' : '1.5px solid var(--hair)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s',
              }}>
                {remember && <Icon name="check" size={14} color="#fff" strokeWidth={3} />}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-2)' }}>Remember me</span>
            </button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--accent)' }}>Forgot password?</button>
          </div>

          <button onClick={submit} disabled={phase !== 'idle'} style={{
            ...loginStyles.primaryBtn, opacity: phase === 'face' ? 0.55 : 1, cursor: phase === 'idle' ? 'pointer' : 'default',
          }}>
            {phase === 'submitting' ? (<><span className="login-spinner" /> Signing in…</>) : (<>Sign in <Icon name="arrowRight" size={20} color="#fff" strokeWidth={2.4} /></>)}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--hair)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'var(--hair)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <button onClick={faceLogin} disabled={phase !== 'idle'} style={loginStyles.secondaryBtn}>
              {phase === 'face' ? (<><span className="login-spinner login-spinner-dark" /> Scanning…</>) : (<><Icon name="faceId" size={21} color="var(--text-1)" strokeWidth={1.9} /> Sign in with Face ID</>)}
            </button>
            <button style={loginStyles.secondaryBtn}>
              <Icon name="building" size={20} color="var(--text-1)" strokeWidth={1.9} /> Continue with company SSO
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 18 }} />

        <div style={{ paddingBottom: 'calc(20px + var(--safe))' }}>
          <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text-3)', fontWeight: 500 }}>
            New here? <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Ask your HR admin</span> for access
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 16, color: 'var(--text-3)' }}>
            <Icon name="shield" size={13} color="var(--text-3)" />
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.01em' }}>Encrypted &amp; secured · v2.4.1</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const loginStyles: Record<string, CSSProperties> = {
  fieldLabel: { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.01em' },
  eyeBtn: { width: 34, height: 34, borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: -6 },
  primaryBtn: {
    width: '100%', height: 56, borderRadius: 'var(--r-btn)', border: 'none',
    background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 16.5,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
    boxShadow: '0 8px 22px var(--accent-glow)', letterSpacing: '-0.01em', whiteSpace: 'nowrap',
  },
  secondaryBtn: {
    width: '100%', height: 52, borderRadius: 'var(--r-btn)', cursor: 'pointer',
    border: '1.5px solid var(--hair)', background: 'var(--card)', color: 'var(--text-1)',
    fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: 'var(--card-shadow)', whiteSpace: 'nowrap',
  },
};

export default function Login() {
  const navigate = useNavigate();
  const vars = themeVars(DEFAULT_TWEAKS);
  return (
    <PhoneFrame dark={DEFAULT_TWEAKS.dark}>
      <div style={{ position: 'relative', height: '100%', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", WebkitFontSmoothing: 'antialiased', ...vars }}>
        <LoginScreen onSignedIn={() => navigate('/app')} />
      </div>
    </PhoneFrame>
  );
}
