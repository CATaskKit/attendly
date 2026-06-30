import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneFrame from '../components/PhoneFrame';
import { Icon } from './ui';
import { DEFAULT_TWEAKS, themeVars } from './theme';
import { useAuth } from '../lib/auth';
import { APP_NAME, VENDOR } from '../lib/brand';

// Shown to a signed-in account that isn't attached to any organization — e.g. a
// "Join workspace" signup whose email wasn't invited yet, or an owner whose org
// creation didn't complete. The app proper requires an org, so we park them here
// with a way to re-check (claim a freshly added invite) or sign out.
export default function NoWorkspace() {
  const navigate = useNavigate();
  const { authed, loading, profile, refreshMembership, signOut } = useAuth();
  const vars = themeVars(DEFAULT_TWEAKS);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Guard the route: not signed in → login; already has an org → let routing
  // send them to their real home.
  useEffect(() => {
    if (loading) return;
    if (!authed) { navigate('/', { replace: true }); return; }
    if (profile?.org_id) navigate('/', { replace: true });
  }, [authed, loading, profile, navigate]);

  const email = profile?.email ?? '';

  const checkAgain = async () => {
    if (checking) return;
    setChecking(true);
    setNotice(null);
    const { orgId } = await refreshMembership();
    if (orgId) { navigate('/', { replace: true }); return; }
    setChecking(false);
    setNotice('Still no workspace found. Ask your HR/admin to add this exact email, then try again.');
  };

  return (
    <PhoneFrame dark={DEFAULT_TWEAKS.dark}>
      <div style={{ position: 'relative', height: '100%', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", WebkitFontSmoothing: 'antialiased', ...vars }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
          <div style={{ height: 'var(--topbar, 0px)', flexShrink: 0 }} />
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 26px', display: 'flex', flexDirection: 'column' }} className="no-scrollbar">
            <div style={{ flex: 1, minHeight: 24 }} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{
                width: 76, height: 76, borderRadius: 24, flexShrink: 0,
                background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22,
              }}>
                <Icon name="building" size={36} color="var(--accent)" strokeWidth={1.9} />
              </div>
              <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                You're not in a workspace yet
              </h1>
              <p style={{ margin: '12px 0 0', fontSize: 15, color: 'var(--text-3)', fontWeight: 500, lineHeight: 1.5, maxWidth: 320 }}>
                Your account is active, but it isn't linked to any company on {APP_NAME}. Ask your HR or admin to add you, then check again.
              </p>
              {email && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18,
                  padding: '9px 14px', borderRadius: 'var(--r-card)', background: 'var(--card)', border: '1.5px solid var(--hair)',
                }}>
                  <Icon name="mail" size={16} color="var(--text-3)" strokeWidth={1.9} />
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)' }}>{email}</span>
                </div>
              )}
            </div>

            {notice && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '22px 0 0', padding: '11px 13px', borderRadius: 'var(--r-card)', background: 'var(--danger-soft)' }}>
                <Icon name="shield" size={16} color="var(--danger)" strokeWidth={2} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--danger)', lineHeight: 1.4 }}>{notice}</span>
              </div>
            )}

            <div style={{ flex: 1, minHeight: 28 }} />

            <div style={{ paddingBottom: 'calc(20px + var(--safe))', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <button onClick={checkAgain} disabled={checking} style={{ ...styles.primaryBtn, cursor: checking ? 'default' : 'pointer' }}>
                {checking ? (<><span className="login-spinner" /> Checking…</>) : (<><Icon name="refresh" size={19} color="#fff" strokeWidth={2.2} /> Check again</>)}
              </button>
              <button onClick={() => { void signOut(); navigate('/', { replace: true }); }} style={styles.secondaryBtn}>
                <Icon name="logout" size={19} color="var(--text-1)" strokeWidth={1.9} /> Sign out
              </button>
              <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--text-3)' }}>
                {APP_NAME} · by {VENDOR}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

const styles: Record<string, CSSProperties> = {
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
