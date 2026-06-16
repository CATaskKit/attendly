import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneFrame from '../components/PhoneFrame';
import { Icon } from './ui';
import { DEFAULT_TWEAKS, themeVars } from './theme';
import { Capacitor } from '@capacitor/core';
import { useAuth, type Role } from '../lib/auth';
import { APP_NAME, VENDOR, APP_VERSION } from '../lib/brand';

// Where to land after auth, by role. The admin console (and onboarding) are a
// web-only desktop surface, so on the native mobile app everyone uses the
// employee app. On the web, owners/HR run the admin console; an owner who
// hasn't created their org yet goes to onboarding.
function landingFor(role?: Role, orgId?: string | null): string {
  if (Capacitor.isNativePlatform()) return '/app';
  if (role === 'owner' && !orgId) return '/onboarding';
  if (role === 'owner' || role === 'hr') return '/admin';
  return '/app';
}

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

type Mode = 'signin' | 'signup' | 'join' | 'forgot' | 'reset';

function LoginScreen() {
  const navigate = useNavigate();
  const { configured, signIn, signUp, joinOrg, sendPasswordReset, updatePassword, createOrganization, demoSignIn } = useAuth();

  const isResetLink = new URLSearchParams(window.location.search).has('reset-password');
  const [mode, setMode] = useState<Mode>(isResetLink ? 'reset' : 'signin');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState(configured ? '' : 'aarav.mehta@ontime.co');
  const [pw, setPw] = useState(configured ? '' : 'ontime');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string | null; pw?: string | null; confirm?: string | null; name?: string | null; company?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'face'>('idle');
  const [shake, setShake] = useState(false);

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 420); };

  const submit = async () => {
    if (phase !== 'idle') return;
    setFormError(null);
    setFormNotice(null);
    const e: typeof errors = {};
    const trimmedEmail = email.trim();
    const needsEmail = mode !== 'reset';
    if ((mode === 'signup' || mode === 'join') && !fullName.trim()) e.name = 'Enter your name';
    if (mode === 'signup' && !company.trim()) e.company = 'Enter your company';
    if (needsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) e.email = 'Enter a valid work email';
    if (mode !== 'forgot' && pw.length < 6) e.pw = configured ? 'At least 6 characters' : 'Enter your password';
    if (mode === 'reset' && confirmPw !== pw) e.confirm = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length) { triggerShake(); return; }

    setPhase('submitting');
    if (mode === 'forgot') {
      const { error } = await sendPasswordReset(trimmedEmail);
      setPhase('idle');
      if (error) { setFormError(error); triggerShake(); return; }
      setFormNotice('Password reset link sent. Check your email to continue.');
      return;
    }

    if (mode === 'reset') {
      const { error } = await updatePassword(pw);
      if (error) { setFormError(error); setPhase('idle'); triggerShake(); return; }
      navigate('/app');
      return;
    }

    if (mode === 'join') {
      const { error, joined } = await joinOrg(fullName.trim(), trimmedEmail, pw);
      if (error) { setFormError(error); setPhase('idle'); triggerShake(); return; }
      if (joined) { navigate('/app'); return; }
      // Account created but no invite matched their email yet.
      setFormError(`No invite found for ${trimmedEmail}. Ask your HR/admin to add you with this email, then sign in.`);
      setPhase('idle');
      return;
    }

    if (mode === 'signin') {
      const { error, role, orgId } = await signIn(trimmedEmail, pw);
      if (error) { setFormError(error); setPhase('idle'); triggerShake(); return; }
      navigate(landingFor(role, orgId));
    } else {
      const { error } = await signUp(fullName.trim(), trimmedEmail, pw);
      if (error) { setFormError(error); setPhase('idle'); triggerShake(); return; }
      const org = await createOrganization(company.trim());
      if (org.error) {
        // Most common cause: email-confirmation is on, so there's no session yet.
        setFormError(org.error.includes('organization') ? org.error : 'Account created — check your email to confirm, then sign in.');
        setPhase('idle');
        return;
      }
      navigate('/onboarding');
    }
  };

  const faceLogin = () => {
    if (phase !== 'idle' || configured) return;
    setPhase('face');
    setTimeout(() => { demoSignIn(); navigate('/app'); }, 1200);
  };

  const isSignup = mode === 'signup';
  const isJoin = mode === 'join';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  const title = isSignup ? 'Create your workspace' : isJoin ? 'Join your workspace' : isForgot ? 'Reset password' : isReset ? 'Create new password' : 'Welcome back';
  const subtitle = isSignup
    ? 'Set up your company and become the Owner.'
    : isJoin
      ? 'Your HR added you — set a password to join with your work email.'
      : isForgot
        ? 'Enter your work email and we will send a secure reset link.'
        : isReset
          ? 'Choose a new password for your account.'
          : 'Sign in to mark your attendance and manage leave.';
  const primaryText = isForgot ? 'Send reset link' : isReset ? 'Update password' : isSignup ? 'Create workspace' : isJoin ? 'Join workspace' : 'Sign in';
  const busyText = isForgot ? 'Sending...' : isReset ? 'Updating...' : isSignup ? 'Creating...' : isJoin ? 'Joining...' : 'Signing in...';

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
              <div style={{ fontSize: 25, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1, whiteSpace: 'nowrap' }}>{APP_NAME}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-3)', marginTop: 4, letterSpacing: '0.02em' }}>by {VENDOR}</div>
            </div>
          </div>
          <h1 style={{ margin: '34px 0 0', fontSize: 30, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{title}</h1>
          <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--text-3)', fontWeight: 500, lineHeight: 1.45 }}>{subtitle}</p>
        </div>

        <div style={{ marginTop: 26, animation: shake ? 'loginShake .42s cubic-bezier(.36,.07,.19,.97)' : 'none' }}>
          {(isSignup || isJoin) && (
            <Field icon="user" label="Your name" value={fullName} onChange={setFullName} placeholder="Rohan Kapoor" error={errors.name} onFocus={() => setErrors((s) => ({ ...s, name: null }))} />
          )}
          {isSignup && (
            <Field icon="building" label="Company" value={company} onChange={setCompany} placeholder="Acme Technologies" error={errors.company} onFocus={() => setErrors((s) => ({ ...s, company: null }))} />
          )}
          {!isReset && (
            <Field
              icon="mail" type="email" label={isForgot ? 'Account email' : 'Work email'} autoComplete="username"
              value={email} onChange={setEmail} placeholder="you@company.com"
              error={errors.email} onFocus={() => setErrors((s) => ({ ...s, email: null }))}
            />
          )}
          {!isForgot && (
            <Field
              icon="lock" type={showPw ? 'text' : 'password'} label={isReset ? 'New password' : isJoin ? 'Set a password' : 'Password'} autoComplete={isSignup || isJoin || isReset ? 'new-password' : 'current-password'}
              value={pw} onChange={setPw} placeholder={isSignup || isJoin || isReset ? 'Create a password' : 'Enter your password'}
              error={errors.pw} onFocus={() => setErrors((s) => ({ ...s, pw: null }))}
              trailing={
                <button onClick={() => setShowPw((s) => !s)} style={loginStyles.eyeBtn} aria-label="Toggle password">
                  <Icon name={showPw ? 'eyeOff' : 'eye'} size={19} color="var(--text-3)" strokeWidth={1.9} />
                </button>
              }
            />
          )}
          {isReset && (
            <Field
              icon="lock" type="password" label="Confirm password" autoComplete="new-password"
              value={confirmPw} onChange={setConfirmPw} placeholder="Repeat new password"
              error={errors.confirm} onFocus={() => setErrors((s) => ({ ...s, confirm: null }))}
            />
          )}

          {mode === 'signin' && (
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
              <button onClick={() => { setMode('forgot'); setFormError(null); setFormNotice(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--accent)' }}>Forgot password?</button>
            </div>
          )}

          {formNotice && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 14px', padding: '11px 13px', borderRadius: 'var(--r-card)', background: 'var(--success-soft)' }}>
              <Icon name="checkCircle" size={16} color="var(--success)" strokeWidth={2} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--success)', lineHeight: 1.4 }}>{formNotice}</span>
            </div>
          )}

          {formError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 14px', padding: '11px 13px', borderRadius: 'var(--r-card)', background: 'var(--danger-soft)' }}>
              <Icon name="shield" size={16} color="var(--danger)" strokeWidth={2} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--danger)', lineHeight: 1.4 }}>{formError}</span>
            </div>
          )}

          <button onClick={submit} disabled={phase !== 'idle'} style={{ ...loginStyles.primaryBtn, opacity: phase === 'face' ? 0.55 : 1, cursor: phase === 'idle' ? 'pointer' : 'default', marginTop: isSignup ? 6 : 0 }}>
            {phase === 'submitting' ? (<><span className="login-spinner" /> {busyText}</>) : (<>{primaryText} <Icon name="arrowRight" size={20} color="#fff" strokeWidth={2.4} /></>)}
          </button>

          {!configured && !isForgot && !isReset && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--hair)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em' }}>OR</span>
                <div style={{ flex: 1, height: 1, background: 'var(--hair)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <button onClick={faceLogin} disabled={phase !== 'idle'} style={loginStyles.secondaryBtn}>
                  {phase === 'face' ? (<><span className="login-spinner login-spinner-dark" /> Scanning…</>) : (<><Icon name="faceId" size={21} color="var(--text-1)" strokeWidth={1.9} /> Continue in demo mode</>)}
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 18 }} />

        <div style={{ paddingBottom: 'calc(20px + var(--safe))' }}>
          <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text-3)', fontWeight: 500 }}>
            {isSignup ? (
              <>Already have a workspace? <button onClick={() => { setMode('signin'); setFormError(null); setFormNotice(null); }} style={linkBtn}>Sign in</button></>
            ) : isJoin ? (
              <>Already have an account? <button onClick={() => { setMode('signin'); setFormError(null); setFormNotice(null); }} style={linkBtn}>Sign in</button></>
            ) : isForgot || isReset ? (
              <>Remembered it? <button onClick={() => { setMode('signin'); setFormError(null); setFormNotice(null); }} style={linkBtn}>Sign in</button></>
            ) : (
              <>
                <div>Invited by your team? <button onClick={() => { setMode('join'); setFormError(null); setFormNotice(null); }} style={linkBtn}>Join your workspace</button></div>
                <div style={{ marginTop: 6 }}>Setting up a new company? <button onClick={() => { setMode('signup'); setFormError(null); setFormNotice(null); }} style={linkBtn}>Create a workspace</button></div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 16, color: 'var(--text-3)' }}>
            <Icon name="shield" size={13} color="var(--text-3)" />
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.01em' }}>{configured ? `Encrypted & secured · v${APP_VERSION}` : 'Demo mode · connect Supabase to go live'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--accent)', fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit' };

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
  const { authed, loading, role, profile } = useAuth();
  const vars = themeVars(DEFAULT_TWEAKS);
  const isResetLink = new URLSearchParams(window.location.search).has('reset-password');

  // Already signed in → route to the right home for the role (admins land in the
  // admin console, everyone else in the employee app).
  useEffect(() => {
    if (loading || !authed || isResetLink) return;
    navigate(landingFor(role, profile?.org_id ?? null), { replace: true });
  }, [authed, loading, role, profile, isResetLink, navigate]);

  return (
    <PhoneFrame dark={DEFAULT_TWEAKS.dark}>
      <div style={{ position: 'relative', height: '100%', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", WebkitFontSmoothing: 'antialiased', ...vars }}>
        <LoginScreen />
      </div>
    </PhoneFrame>
  );
}
