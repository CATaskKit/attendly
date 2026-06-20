import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { SITE_URL } from './brand';

export type Role = 'owner' | 'hr' | 'manager' | 'employee';

export type Profile = {
  id: string;
  org_id: string | null;
  full_name: string | null;
  email: string | null;
  role: Role;
  employee_id?: string | null;
  phone?: string | null;
  personal_email?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
};

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  role: Role;
  /** true when signed in (real) or in demo mode after a demo sign-in */
  authed: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; role?: Role; orgId?: string | null }>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  updateProfile: (fields: Partial<Profile>) => Promise<{ error?: string }>;
  /** create the org for a freshly signed-up owner */
  createOrganization: (name: string) => Promise<{ error?: string }>;
  /** sign up an invited employee and link them to the inviting org by email */
  joinOrg: (fullName: string, email: string, password: string) => Promise<{ error?: string; joined?: boolean }>;
  signOut: () => Promise<void>;
  /** demo-mode only: pretend to sign in so the UI is explorable without keys */
  demoSignIn: () => void;
  /** true after a password-recovery link is opened — show the set-new-password screen */
  recovery: boolean;
  clearRecovery: () => void;
};

const DEMO_PROFILE: Profile = {
  id: 'demo',
  org_id: 'demo-org',
  full_name: 'Aarav Mehta',
  email: 'aarav.mehta@ontime.co',
  role: 'manager',
  phone: '+91 98860 41122',
  personal_email: 'aarav.personal@example.com',
  date_of_birth: '1993-08-18',
  address: 'Indiranagar, Bengaluru',
  emergency_contact_name: 'Meera Mehta',
  emergency_contact_phone: '+91 99001 22448',
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [demo, setDemo] = useState(false);
  const [recovery, setRecovery] = useState(false);

  // Load (and keep fresh) the session + profile when Supabase is configured.
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;

    const loadProfile = async (uid: string) => {
      const { data } = await supabase!.from('profiles').select('*').eq('id', uid).single();
      if (active) setProfile((data as Profile) ?? null);
    };

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    // Never await Supabase calls inside this callback: supabase-js emits auth
    // events while holding its auth lock, and a query here needs that same lock
    // to resolve the session — awaiting deadlocks every call that follows
    // (e.g. create_organization right after signUp). Defer to the next tick.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      // A recovery link opens a session too — flag it so the UI prompts for a new
      // password instead of silently logging the user in (magic-link behaviour).
      if (_e === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
      if (s) setTimeout(() => { void loadProfile(s.user.id); }, 0);
      else setProfile(null);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    if (!supabase) { setDemo(true); return {}; }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    // Load the profile now so the caller can route by role (admin vs employee)
    // without waiting on the async onAuthStateChange listener.
    let prof: Profile | null = null;
    if (data.user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
      prof = (p as Profile) ?? null;
      // If they aren't in an org yet, try to claim a matching employee invite
      // (covers people who signed up before HR added them). Best-effort.
      if (prof && !prof.org_id) {
        try {
          await supabase.rpc('claim_invite');
          const { data: p2 } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
          if (p2) prof = p2 as Profile;
        } catch { /* claim_invite not available yet — ignore */ }
      }
      setProfile(prof);
    }
    return { role: prof?.role, orgId: prof?.org_id ?? null };
  };

  const signUp: AuthContextValue['signUp'] = async (fullName, email, password) => {
    if (!supabase) { setDemo(true); return {}; }
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    });
    return error ? { error: error.message } : {};
  };

  // Invited-employee signup: create the account, then confirm they were linked
  // to an org (by the 0006 signup trigger, or a claim_invite fallback).
  const joinOrg: AuthContextValue['joinOrg'] = async (fullName, email, password) => {
    if (!supabase) { setDemo(true); return { joined: true }; }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (error) return { error: error.message };
    const uid = data.user?.id;
    if (!uid) return { joined: false };
    let { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (!prof?.org_id) {
      try {
        await supabase.rpc('claim_invite');
        const { data: p2 } = await supabase.from('profiles').select('*').eq('id', uid).single();
        if (p2) prof = p2;
      } catch { /* claim_invite not available yet — ignore */ }
    }
    setProfile((prof as Profile) ?? null);
    return { joined: !!(prof as Profile | null)?.org_id };
  };

  const sendPasswordReset: AuthContextValue['sendPasswordReset'] = async (email) => {
    if (!supabase) return { error: 'Connect Supabase to send password reset emails.' };
    const resetUrl = `${SITE_URL}/?reset-password=1`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: resetUrl });
    return error ? { error: error.message } : {};
  };

  const updatePassword: AuthContextValue['updatePassword'] = async (password) => {
    if (!supabase) return { error: 'Connect Supabase to update passwords.' };
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { error: error.message } : {};
  };

  const updateProfile: AuthContextValue['updateProfile'] = async (fields) => {
    if (!supabase) {
      setProfile((current) => current ? { ...current, ...fields } : current);
      return {};
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Sign in again to update your profile.' };
    const allowed: Partial<Profile> = {
      full_name: fields.full_name,
      phone: fields.phone,
      personal_email: fields.personal_email,
      date_of_birth: fields.date_of_birth,
      address: fields.address,
      emergency_contact_name: fields.emergency_contact_name,
      emergency_contact_phone: fields.emergency_contact_phone,
    };
    const patch = Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined));
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', user.id).select('*').single();
    if (error) return { error: error.message };
    setProfile((data as Profile) ?? null);
    return {};
  };

  const createOrganization: AuthContextValue['createOrganization'] = async (name) => {
    if (!supabase) return {};
    const { error } = await supabase.rpc('create_organization', { org_name: name });
    if (error) return { error: error.message };
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile((data as Profile) ?? null);
    }
    return {};
  };

  const signOut: AuthContextValue['signOut'] = async () => {
    if (supabase) await supabase.auth.signOut();
    setDemo(false);
    setProfile(null);
    setSession(null);
  };

  const demoSignIn = () => setDemo(true);

  const authed = isSupabaseConfigured ? !!session : demo;
  const effectiveProfile = isSupabaseConfigured ? profile : demo ? DEMO_PROFILE : null;
  const role: Role = effectiveProfile?.role ?? 'employee';

  const value: AuthContextValue = {
    configured: isSupabaseConfigured,
    loading,
    session,
    profile: effectiveProfile,
    role,
    authed,
    signIn,
    signUp,
    sendPasswordReset,
    updatePassword,
    updateProfile,
    createOrganization,
    joinOrg,
    signOut,
    demoSignIn,
    recovery,
    clearRecovery: () => setRecovery(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
