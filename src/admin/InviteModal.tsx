import { useState, type ReactNode } from 'react';
import { AIcon, APill, BtnGhost, BtnPrimary } from './ui';
import { supabase } from '../lib/supabase';
import type { Employee } from '../lib/api';
import { SITE_URL } from '../lib/brand';

// The live app URL — employees join from here (Login → "Join your workspace").
// Uses the configured SITE_URL so emailed links never point at localhost.
const APP_URL = SITE_URL;

function CopyRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 6px 0 13px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)' }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink-1)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
        <button onClick={onCopy} title={`Copy ${label.toLowerCase()}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink-2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', flexShrink: 0 }}>
          <AIcon name="display" size={14} color="var(--ink-3)" />Copy
        </button>
      </div>
    </div>
  );
}

function Shell({ title, status, children, footer, onClose }: { title: string; status: ReactNode; children: ReactNode; footer: ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,34,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 540, maxWidth: '100%', background: 'var(--panel)', borderRadius: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
            {status}
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: 'var(--soft)', cursor: 'pointer', flexShrink: 0 }}><AIcon name="x" size={17} color="var(--ink-2)" /></button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>{footer}</div>
      </div>
    </div>
  );
}

export default function InviteModal({ employee, canManage, onClose, onToast }: {
  employee: Employee; canManage: boolean; onClose: () => void; onToast: (t: string, tone?: string, icon?: string) => void;
}) {
  const joined = !!employee.profile_id;
  const email = (employee.email || '').trim();
  const [sending, setSending] = useState(false);

  const message =
    `Hi ${employee.name},\n\n` +
    `You've been added to our eHajeri workspace. To get started:\n` +
    `1. Open ${APP_URL}\n` +
    `2. Tap "Join your workspace"\n` +
    `3. Sign up with your work email (${email || 'your email'}) and set a password.\n\n` +
    `That's it — you'll be able to check in and manage your leave.`;

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); onToast(`${label} copied`); }
    catch { onToast('Copy failed — select the text manually', 'red', 'xCircle'); }
  };

  const sendReset = async () => {
    if (!supabase || !email) return;
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${APP_URL}?reset-password=1` });
    setSending(false);
    if (error) { onToast('Could not send reset email', 'red', 'xCircle'); return; }
    onToast('Password reset email sent'); onClose();
  };

  const sendInviteEmail = async () => {
    if (!supabase || !email) return;
    setSending(true);
    // Emails a magic join link and creates the auth account; the 0006 trigger
    // links it to this org on creation. Needs a real inbox + email delivery.
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: APP_URL } });
    setSending(false);
    if (error) { onToast('Could not send invite email', 'red', 'xCircle'); return; }
    onToast('Invite email sent'); onClose();
  };

  const statusPill = joined
    ? <APill tone="green"><AIcon name="check" size={12} sw={3} />Joined</APill>
    : <APill tone="amber">Invite pending</APill>;

  if (!email) {
    return (
      <Shell title={`Invite ${employee.name}`} status={statusPill} onClose={onClose} footer={<BtnGhost onClick={onClose}>Close</BtnGhost>}>
        <div style={{ display: 'flex', gap: 11, padding: '14px 16px', borderRadius: 12, background: 'var(--soft)' }}>
          <AIcon name="shield" size={18} color="var(--ink-3)" />
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>This employee has no email on file. Add their work email first, then they can join.</div>
        </div>
      </Shell>
    );
  }

  if (joined) {
    return (
      <Shell title={`Invite ${employee.name}`} status={statusPill} onClose={onClose}
        footer={<><BtnGhost onClick={onClose}>Close</BtnGhost>{canManage && <BtnPrimary icon="shield" onClick={sendReset} disabled={sending}>{sending ? 'Sending…' : 'Send password reset'}</BtnPrimary>}</>}>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
          <b style={{ color: 'var(--ink-1)' }}>{employee.name}</b> already joined with <b style={{ color: 'var(--ink-1)' }}>{email}</b>. If they're locked out, send a password reset link to that inbox.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title={`Invite ${employee.name}`} status={statusPill} onClose={onClose}
      footer={<>
        <BtnGhost onClick={onClose}>Close</BtnGhost>
        {canManage && <BtnGhost icon="inbox" onClick={sendInviteEmail} disabled={sending}>{sending ? 'Sending…' : 'Email invite link'}</BtnGhost>}
        <BtnPrimary icon="display" onClick={() => copy(message, 'Invite message')}>Copy invite message</BtnPrimary>
      </>}>
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 16px' }}>
        Send these join instructions to <b style={{ color: 'var(--ink-1)' }}>{email}</b>. They set their own password the first time they join.
      </p>
      <CopyRow label="Work email" value={email} onCopy={() => copy(email, 'Email')} />
      <CopyRow label="Join link" value={APP_URL} onCopy={() => copy(APP_URL, 'Link')} />
      <div style={{ marginTop: 6, padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', lineHeight: 1.55, maxHeight: 168, overflowY: 'auto' }}>{message}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.45 }}>
        “Email invite link” sends a secure magic link via Supabase that creates &amp; links their account — works once their email is a real inbox.
      </div>
    </Shell>
  );
}
