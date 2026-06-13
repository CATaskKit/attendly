import { useMemo, useState } from 'react';
import { AIcon, ACard, APill, BtnPrimary, BtnGhost, PageHead } from './ui';
import { createAnnouncement, deleteAnnouncement, type Announcement, type AnnouncementRead } from '../lib/api';

type ToastFn = (text: string, tone?: string, icon?: string) => void;

export function Announcements({ orgId, rows, reads, memberCount, role, authorName, onChanged, onToast }: {
  orgId: string | null;
  rows: Announcement[];
  reads: AnnouncementRead[];
  memberCount: number;
  role: string;
  authorName: string;
  onChanged: () => void;
  onToast: ToastFn;
}) {
  const isHR = role === 'owner' || role === 'hr';
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  const readCount = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of reads) {
      if (!m.has(r.announcement_id)) m.set(r.announcement_id, new Set());
      m.get(r.announcement_id)!.add(r.user_id);
    }
    return m;
  }, [reads]);

  const post = async () => {
    if (!orgId || !title.trim() || !body.trim()) { onToast('Add a title and message', 'amber', 'bell'); return; }
    setBusy(true);
    try {
      await createAnnouncement(orgId, { title: title.trim(), body: body.trim(), author: authorName, pinned });
      setTitle(''); setBody(''); setPinned(false);
      onToast('Announcement posted — everyone notified', 'green', 'checkCircle');
      onChanged();
    } catch (e) { onToast(e instanceof Error ? e.message : 'Could not post', 'red', 'xCircle'); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try { await deleteAnnouncement(id); onToast('Announcement deleted', 'red', 'trash'); onChanged(); }
    catch (e) { onToast(e instanceof Error ? e.message : 'Delete failed', 'red', 'xCircle'); }
    finally { setBusy(false); }
  };

  const denom = Math.max(0, memberCount - 1); // author doesn't need to read their own

  return (
    <div>
      <PageHead title="Announcements" sub="Post company-wide updates — every employee is notified instantly." />

      {isHR && (
        <ACard style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 12 }}>New announcement</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Office closed on Friday)" maxLength={120}
            style={{ width: '100%', height: 44, borderRadius: 11, border: '1px solid var(--line)', padding: '0 14px', fontSize: 14.5, fontWeight: 600, color: 'var(--ink-1)', background: 'var(--panel)', boxSizing: 'border-box', outline: 'none' }} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" rows={4}
            style={{ width: '100%', marginTop: 10, borderRadius: 11, border: '1px solid var(--line)', padding: '12px 14px', fontSize: 14, color: 'var(--ink-1)', background: 'var(--panel)', boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              Pin to top
            </label>
            <BtnPrimary icon="bell" onClick={() => { void post(); }} disabled={busy || !title.trim() || !body.trim()}>{busy ? 'Posting…' : 'Post & notify everyone'}</BtnPrimary>
          </div>
        </ACard>
      )}

      {rows.length === 0 ? (
        <ACard style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5, padding: 32 }}>No announcements yet.{isHR ? ' Post the first one above.' : ''}</ACard>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((a) => {
            const seen = readCount.get(a.id)?.size ?? 0;
            return (
              <ACard key={a.id} pad={18}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AIcon name="bell" size={19} color="var(--accent)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink-1)' }}>{a.title}</span>
                      {a.pinned && <APill tone="amber"><AIcon name="arrowUp" size={12} color="var(--amber)" />Pinned</APill>}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, marginTop: 6, whiteSpace: 'pre-wrap' }}>{a.body}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
                      <span>{a.author || 'Admin'} · {new Date(a.created_at).toLocaleString()}</span>
                      <APill tone="neutral"><AIcon name="checkCircle" size={12} color="var(--ink-2)" />{seen}{denom ? ` / ${denom}` : ''} read</APill>
                    </div>
                  </div>
                  {isHR && (
                    <button onClick={() => remove(a.id)} disabled={busy} title="Delete announcement" style={{ border: '1px solid var(--line)', background: 'transparent', borderRadius: 9, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AIcon name="trash" size={15} color="var(--ink-3)" />
                    </button>
                  )}
                </div>
              </ACard>
            );
          })}
        </div>
      )}
    </div>
  );
}
