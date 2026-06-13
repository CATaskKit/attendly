import { useMemo, useState, type CSSProperties } from 'react';
import { AIcon, AAvatar, ACard, APill, KPI, Segmented, BtnPrimary, BtnGhost, PageHead } from './ui';
import {
  decideReimbursement, bulkDecideReimbursements, markReimbursementsPaid, deleteReimbursement, signedReceiptUrl,
  type Reimbursement,
} from '../lib/api';
import { reimbursementActive, fmtINR, type OrgBilling } from '../lib/billing';
import { downloadReimbursementsZip } from '../lib/zip';

type Tab = 'Pending' | 'Approved' | 'Paid' | 'Rejected' | 'All';
type ToastFn = (text: string, tone?: string, icon?: string) => void;

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'Paid' ? 'purple' : status === 'Approved' ? 'green' : status === 'Rejected' ? 'red' : 'amber';
  return <APill tone={tone as 'purple'}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{status}</APill>;
}

function ReceiptChip({ name, path, onToast }: { name: string; path: string; onToast: ToastFn }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const url = await signedReceiptUrl(path);
      if (url) window.open(url, '_blank', 'noopener');
      else onToast('Could not open receipt', 'red', 'xCircle');
    } catch { onToast('Could not open receipt', 'red', 'xCircle'); }
    finally { setBusy(false); }
  };
  return (
    <button onClick={open} disabled={busy} title={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: 200, height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
      <AIcon name="paperclip" size={14} color="var(--ink-3)" />
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{busy ? 'Opening…' : name}</span>
    </button>
  );
}

export function Reimbursements({ rows, role, billing, onChanged, onToast, onGoBilling }: {
  rows: Reimbursement[];
  role: string;
  billing: OrgBilling | null;
  onChanged: () => void;
  onToast: ToastFn;
  onGoBilling: () => void;
}) {
  const [tab, setTab] = useState<Tab>('Pending');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [payFor, setPayFor] = useState<Reimbursement[] | null>(null);
  const [voidFor, setVoidFor] = useState<Reimbursement | null>(null);

  const active = billing ? reimbursementActive(billing) : false;
  const isHR = role === 'owner' || role === 'hr';
  const isManager = role === 'manager';

  // Who can action a Pending claim at its current stage.
  const canDecide = (r: Reimbursement) =>
    r.status === 'Pending' && (isManager ? r.stage === 'manager' : isHR && r.stage !== 'manager');

  const counts = useMemo(() => ({
    Pending: rows.filter((r) => r.status === 'Pending').length,
    Approved: rows.filter((r) => r.status === 'Approved').length,
    Paid: rows.filter((r) => r.status === 'Paid').length,
    Rejected: rows.filter((r) => r.status === 'Rejected').length,
  }), [rows]);

  const shown = useMemo(() => rows.filter((r) => (tab === 'All' ? true : r.status === tab)), [rows, tab]);
  const selectedRows = shown.filter((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => setSelected(new Set());

  if (!active) {
    return (
      <div>
        <PageHead title="Reimbursements" sub="Expense & convenience claims" />
        <ACard style={{ maxWidth: 560, margin: '24px auto', textAlign: 'center', padding: 36 }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, margin: '0 auto 16px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AIcon name="receipt" size={28} color="var(--accent)" sw={1.8} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-1)', margin: '0 0 8px' }}>Reimbursements is an add-on</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 20px' }}>
            Let employees submit expense claims with receipts, route them for manager/HR approval, and process payouts — for <b>₹5 / employee / month</b>. Turn it on from Billing.
          </p>
          {isHR && <BtnPrimary icon="wallet" onClick={onGoBilling}>Enable in Billing</BtnPrimary>}
        </ACard>
      </div>
    );
  }

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); onToast(ok); clearSel(); onChanged(); }
    catch (e) { onToast(e instanceof Error ? e.message : 'Action failed', 'red', 'xCircle'); }
    finally { setBusy(false); }
  };

  const zip = async (list: Reimbursement[], name: string) => {
    if (!list.length) { onToast('Nothing to export', 'amber', 'download'); return; }
    setBusy(true);
    try {
      const { files, missing } = await downloadReimbursementsZip(list, signedReceiptUrl, name);
      onToast(`Downloaded ${list.length} claim${list.length === 1 ? '' : 's'} · ${files} receipt${files === 1 ? '' : 's'}${missing ? ` (${missing} unavailable)` : ''}`, 'green', 'download');
    } catch (e) { onToast(e instanceof Error ? e.message : 'Export failed', 'red', 'xCircle'); }
    finally { setBusy(false); }
  };

  const actionable = selectedRows.filter(canDecide);
  const approvedSel = selectedRows.filter((r) => r.status === 'Approved');

  return (
    <div>
      <PageHead title="Reimbursements" sub={`${counts.Pending} pending · ${counts.Approved} awaiting payout`}>
        <BtnGhost icon="download" onClick={() => zip(shown, `reimbursements-${tab.toLowerCase()}`)} disabled={busy}>Download ZIP + report</BtnGhost>
      </PageHead>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
        <KPI icon="receipt" label="Pending claims" value={counts.Pending} tone="amber" />
        <KPI icon="checkCircle" label="Approved · to pay" value={fmtINR(rows.filter((r) => r.status === 'Approved').reduce((a, r) => a + Number(r.amount), 0))} tone="accent" />
        <KPI icon="wallet" label="Paid this period" value={fmtINR(rows.filter((r) => r.status === 'Paid').reduce((a, r) => a + Number(r.amount), 0))} tone="green" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Segmented
          options={[{ value: 'Pending', label: 'Pending', n: counts.Pending }, { value: 'Approved', label: 'Approved', n: counts.Approved }, { value: 'Paid', label: 'Paid', n: counts.Paid }, 'Rejected', 'All']}
          value={tab} onChange={(v) => { setTab(v as Tab); clearSel(); }}
        />
        {actionable.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <BtnGhost icon="x" onClick={() => run(() => bulkDecideReimbursements(actionable, 'reject'), 'Claims rejected')} disabled={busy}>Reject {actionable.length}</BtnGhost>
            <BtnPrimary icon="check" tone="green" onClick={() => run(() => bulkDecideReimbursements(actionable, 'approve'), 'Claims approved')} disabled={busy}>Approve {actionable.length}</BtnPrimary>
          </div>
        )}
        {isHR && approvedSel.length > 0 && (
          <BtnPrimary icon="wallet" onClick={() => setPayFor(approvedSel)} disabled={busy}>Mark {approvedSel.length} paid</BtnPrimary>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'var(--amber-soft)', color: 'var(--amber)', fontSize: 12.5, fontWeight: 600 }}>
        <AIcon name="shield" size={15} color="var(--amber)" />
        Records and receipts are retained for ~2 years. Download the ZIP regularly and keep an offline backup before then.
      </div>

      {shown.length === 0 ? (
        <ACard style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>No {tab.toLowerCase()} claims.</ACard>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {shown.map((r) => {
            const selectable = canDecide(r) || (isHR && r.status === 'Approved');
            return (
              <ACard key={r.id} pad={16} style={{ borderColor: selected.has(r.id) ? 'var(--accent)' : 'var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {selectable && (
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} style={{ width: 17, height: 17, marginTop: 3, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  )}
                  <AAvatar name={r.emp || '?'} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)' }}>{r.emp}</span>
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.dept || '—'} · {r.code || '—'}</span>
                      <StatusBadge status={r.status} />
                      {r.status === 'Pending' && <APill tone="neutral">{r.stage === 'manager' ? 'Manager review' : 'HR review'}</APill>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>{fmtINR(Number(r.amount))}</span>
                      <APill tone="accent"><AIcon name="receipt" size={13} color="var(--accent-deep)" />{r.category}</APill>
                      <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>Spent {new Date(r.spent_on + 'T00:00:00').toLocaleDateString()}</span>
                    </div>
                    {r.reason && <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45, marginTop: 8 }}>{r.reason}</div>}
                    {r.attachments.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        {r.attachments.map((a) => <ReceiptChip key={a.path} name={a.name} path={a.path} onToast={onToast} />)}
                      </div>
                    )}
                    {r.status === 'Paid' && (
                      <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginTop: 10 }}>
                        Paid {r.paid_at ? new Date(r.paid_at).toLocaleDateString() : ''}{r.paid_ref ? ` · ref ${r.paid_ref}` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    {canDecide(r) && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => run(() => decideReimbursement(r, 'reject'), 'Claim rejected')} disabled={busy} title="Reject" style={iconBtn('red')}><AIcon name="x" size={17} color="var(--red)" sw={2.2} /></button>
                        <button onClick={() => run(() => decideReimbursement(r, 'approve'), r.stage === 'manager' ? 'Forwarded to HR' : 'Claim approved')} disabled={busy} title={r.stage === 'manager' ? 'Approve → HR' : 'Approve'} style={iconBtn('green')}><AIcon name="check" size={17} color="var(--green)" sw={2.4} /></button>
                      </div>
                    )}
                    {isHR && r.status === 'Approved' && (
                      <BtnPrimary icon="wallet" onClick={() => setPayFor([r])} disabled={busy}>Mark paid</BtnPrimary>
                    )}
                    {isHR && (
                      <button onClick={() => setVoidFor(r)} disabled={busy} title="Delete claim" style={{ ...iconBtn('red'), background: 'transparent', border: '1px solid var(--line)', width: 32, height: 32 }}>
                        <AIcon name="trash" size={15} color="var(--ink-3)" />
                      </button>
                    )}
                  </div>
                </div>
              </ACard>
            );
          })}
        </div>
      )}

      {payFor && <PaidModal rows={payFor} onClose={() => setPayFor(null)} onConfirm={(ref) => { const list = payFor; setPayFor(null); run(() => markReimbursementsPaid(list, ref), `Marked ${list.length} paid`); }} />}
      {voidFor && <VoidModal row={voidFor} onClose={() => setVoidFor(null)} onConfirm={() => { const row = voidFor; setVoidFor(null); run(() => deleteReimbursement(row), 'Claim deleted'); }} />}
    </div>
  );
}

function VoidModal({ row, onClose, onConfirm }: { row: Reimbursement; onClose: () => void; onConfirm: () => void }) {
  const files = row.attachments?.length ?? 0;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,20,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--panel)', borderRadius: 16, padding: 24, width: 420, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: 'var(--ink-1)' }}>Delete this claim?</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          {row.emp || 'This'}'s <b style={{ color: 'var(--ink-1)' }}>{row.category}</b> claim of <b style={{ color: 'var(--ink-1)' }}>{fmtINR(Number(row.amount))}</b>{files ? ` and its ${files} receipt${files === 1 ? '' : 's'}` : ''} will be permanently removed. This can't be undone.
          {row.status === 'Paid' && <><br /><span style={{ color: 'var(--red)', fontWeight: 600 }}>Note: this claim is already marked paid.</span></>}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 4, justifyContent: 'flex-end' }}>
          <BtnGhost onClick={onClose}>Cancel</BtnGhost>
          <BtnPrimary icon="trash" tone="red" onClick={onConfirm}>Delete claim</BtnPrimary>
        </div>
      </div>
    </div>
  );
}

function PaidModal({ rows, onClose, onConfirm }: { rows: Reimbursement[]; onClose: () => void; onConfirm: (ref: string) => void }) {
  const [ref, setRef] = useState('');
  const total = rows.reduce((a, r) => a + Number(r.amount), 0);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,20,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--panel)', borderRadius: 16, padding: 24, width: 420, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: 'var(--ink-1)' }}>Mark as paid</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          {rows.length} claim{rows.length === 1 ? '' : 's'} · <b style={{ color: 'var(--ink-1)' }}>{fmtINR(total)}</b>. The employee{rows.length === 1 ? '' : 's'} will be notified.
        </p>
        <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Payment reference (optional)</label>
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR / transaction id" style={{ width: '100%', height: 42, marginTop: 6, borderRadius: 11, border: '1px solid var(--line)', padding: '0 12px', fontSize: 14, color: 'var(--ink-1)', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <BtnGhost onClick={onClose}>Cancel</BtnGhost>
          <BtnPrimary icon="wallet" tone="green" onClick={() => onConfirm(ref.trim())}>Confirm paid</BtnPrimary>
        </div>
      </div>
    </div>
  );
}

const iconBtn = (tone: string): CSSProperties => ({ width: 36, height: 36, borderRadius: 9, border: 'none', background: `var(--${tone}-soft)`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' });
