import { useState } from 'react';
import { Icon, Avatar, Card, Pill, StatusBadge } from './ui';
import { Legend, SectionTitle, ScreenHeader } from './screens';
import type { Ctx, LeaveRequest, TeamRequest } from './data';

const LEAVE_ICON: Record<string, string> = { Casual: 'coffee', Sick: 'umbrella', Paid: 'briefcase', 'Work from home': 'house', Unpaid: 'calendar' };

// ─────────────────────── LEAVE TAB ───────────────────────────────────
export function LeaveScreen({ ctx }: { ctx: Ctx }) {
  const fallback = [
    { name: 'Casual', icon: 'coffee', avail: 6, total: 12, tone: 'accent' },
    { name: 'Sick', icon: 'umbrella', avail: 4, total: 8, tone: 'warning' },
    { name: 'Paid', icon: 'briefcase', avail: 2, total: 15, tone: 'success' },
  ];
  const tones = ['accent', 'warning', 'success', 'purple'];
  const iconFor = (name: string) => LEAVE_ICON[name] || 'calendar';
  const fmtDays = (days: number) => Number.isInteger(days) ? String(days) : days.toFixed(1);
  const balances = ctx.configured
    ? ctx.leaveBalances.map((b, i) => ({ name: b.type, icon: iconFor(b.type), avail: b.available, total: b.allotted, tone: tones[i % tones.length] }))
    : fallback;
  const totalBalance = balances.reduce((sum, b) => sum + b.avail, 0);
  const pending = ctx.leaveRequests.filter((r) => r.status === 'Pending').length;
  const typeCount = balances.length;
  const subtitle = typeCount
    ? `${fmtDays(totalBalance)} days available across ${typeCount} type${typeCount === 1 ? '' : 's'}`
    : 'No leave types configured yet';
  return (
    <div>
      <ScreenHeader title="Leave" subtitle={subtitle} />
      <Card pad={16}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Total balance</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{fmtDays(totalBalance)} <span style={{ fontSize: 16, color: 'var(--text-3)' }}>days</span></div>
          </div>
          {pending > 0 ? <Pill tone="warning">{pending} pending</Pill> : <Pill tone="success">All up to date</Pill>}
        </div>
        <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', marginTop: 16, gap: 2 }}>
          {balances.map((b) => <div key={b.name} style={{ flex: Math.max(1, b.avail), background: `var(--${b.tone})` }} />)}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
          {balances.map((b) => <Legend key={b.name} color={`var(--${b.tone})`} label={`${b.name} ${fmtDays(b.avail)}`} />)}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
        {balances.map((b) => (
          <Card key={b.name} pad={13}>
            <Icon name={b.icon} size={20} color={`var(--${b.tone})`} />
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginTop: 8, letterSpacing: '-0.02em' }}>{fmtDays(b.avail)}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>{b.name} left</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3 }}>Max {fmtDays(b.total)}</div>
          </Card>
        ))}
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Requests</SectionTitle>
        {ctx.leaveRequests.map((r, i) => <LeaveRow key={r.id || i} r={r} onCancel={ctx.cancelLeave} />)}
      </div>
      <div style={{ height: 80 }} />

      <button onClick={() => ctx.openOverlay('applyleave')} style={{
        position: 'absolute', right: 18, bottom: 'calc(82px + var(--safe))', zIndex: 40,
        height: 54, paddingInline: 20, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 15,
        display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 22px var(--accent-glow)',
      }}>
        <Icon name="plus" size={20} color="#fff" strokeWidth={2.6} /> Apply
      </button>
    </div>
  );
}

function LeaveRow({ r, onCancel }: { r: LeaveRequest; onCancel?: (id: string) => void }) {
  const icon = LEAVE_ICON[r.type] || 'calendar';
  const canCancel = r.status === 'Pending' && !!r.id && !!onCancel;
  return (
    <Card pad={14} style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--muted-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={20} color="var(--text-2)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-1)' }}>{r.type} leave</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{r.from}{r.half ? ' · Half day' : ` – ${r.to}`} · {r.days}d</div>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 13, paddingTop: 13, borderTop: '1px solid var(--hair)' }}>
        <Step label="Applied" done />
        <Connector done={r.status !== 'Pending' || !!r.mgr} />
        <Step label="Manager" done={r.status === 'Approved' || !!r.mgr} active={r.status === 'Pending' && !r.mgr} reject={r.status === 'Rejected' && r.rejectedBy === 'mgr'} />
        <Connector done={r.status === 'Approved'} />
        <Step label="HR" done={r.status === 'Approved'} active={r.status === 'Pending' && !!r.mgr} reject={r.status === 'Rejected' && r.rejectedBy === 'hr'} />
      </div>
      {canCancel && (
        <button onClick={() => { if (window.confirm('Withdraw this leave request?')) onCancel!(r.id!); }}
          style={{ width: '100%', marginTop: 12, height: 40, borderRadius: 11, border: '1.5px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <Icon name="x" size={16} color="var(--danger)" strokeWidth={2.4} /> Cancel request
        </button>
      )}
    </Card>
  );
}

function Step({ label, done, active, reject }: { label: string; done?: boolean; active?: boolean; reject?: boolean }) {
  const color = reject ? 'var(--danger)' : done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--muted-soft)';
  const fg = done || reject || active ? '#fff' : 'var(--text-3)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: active ? '0 0 0 4px var(--accent-soft)' : 'none' }}>
        <Icon name={reject ? 'x' : 'check'} size={13} color={fg} strokeWidth={3} />
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: done || active || reject ? 'var(--text-1)' : 'var(--text-3)' }}>{label}</span>
    </div>
  );
}
function Connector({ done }: { done?: boolean }) {
  return <div style={{ flex: 1, height: 2, background: done ? 'var(--success)' : 'var(--hair)', marginTop: -16, borderRadius: 2 }} />;
}

// ─────────────────────── APPROVALS TAB (manager) ─────────────────────
export function ApprovalsScreen({ ctx }: { ctx: Ctx }) {
  const { teamRequests, approveTeam, rejectTeam } = ctx;
  const [filter, setFilter] = useState<'Pending' | 'All'>('Pending');
  const pending = teamRequests.filter((r) => r.status === 'Pending');
  const actioned = teamRequests.filter((r) => r.status !== 'Pending').length;
  const onLeave = teamRequests.filter((r) => r.status === 'Approved' && r.active).length;
  const shown = filter === 'Pending' ? pending : teamRequests;
  const teamCount = new Set(teamRequests.map((r) => r.code).filter((code) => code && code !== '-')).size;

  return (
    <div>
      <ScreenHeader title="Approvals" subtitle={pending.length ? `${pending.length} request${pending.length > 1 ? 's' : ''} awaiting your review` : "You're all caught up"} />

      <Card pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Avatar name={ctx.employeeName} size={42} accent="var(--accent)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-1)' }}>{ctx.role === 'manager' ? 'Your team' : 'Organization'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{teamCount ? `${teamCount} ${ctx.role === 'manager' ? 'direct report' : 'employee'}${teamCount === 1 ? '' : 's'} with requests` : (ctx.role === 'manager' ? 'Direct reports' : 'All employees')}</div>
        </div>
        <Pill tone="accent"><Icon name="users" size={13} color="var(--accent)" />{teamCount}</Pill>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
        {[
          { v: pending.length, l: 'Pending', tone: 'warning' },
          { v: actioned, l: 'Actioned', tone: 'success' },
          { v: onLeave, l: 'Out today', tone: 'accent' },
        ].map((s) => (
          <Card key={s.l} pad={13}>
            <div style={{ fontSize: 24, fontWeight: 800, color: `var(--${s.tone})`, letterSpacing: '-0.02em' }}>{s.v}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>{s.l}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'inline-flex', background: 'var(--muted-soft)', borderRadius: 999, padding: 3, marginBottom: 14 }}>
        {(['Pending', 'All'] as const).map((f) => {
          const on = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              border: 'none', cursor: 'pointer', background: on ? 'var(--card)' : 'transparent',
              color: on ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 700, fontSize: 13, padding: '7px 18px',
              borderRadius: 999, boxShadow: on ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>{f}{f === 'Pending' && pending.length > 0 ? ` · ${pending.length}` : ''}</button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <Card pad={28} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="checkCircle" size={28} color="var(--success)" strokeWidth={2} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>No pending requests</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>New leave requests {ctx.role === 'manager' ? 'from your team' : 'across your organization'} will appear here.</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map((r) => <ApprovalCard key={r.id} r={r} onApprove={() => approveTeam(r.id)} onReject={() => rejectTeam(r.id)} />)}
        </div>
      )}
      <div style={{ height: 20 }} />
    </div>
  );
}

function ApprovalCard({ r, onApprove, onReject }: { r: TeamRequest; onApprove: () => void; onReject: () => void }) {
  const icon = LEAVE_ICON[r.type] || 'calendar';
  const isPending = r.status === 'Pending';
  const statusLine = r.status === 'Forwarded' ? 'Forwarded to HR' : `${r.status} by you`;
  return (
    <Card pad={15}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={r.name} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-1)' }}>{r.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{r.code}</div>
        </div>
        <StatusBadge status={r.status} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 13, padding: '11px 13px', borderRadius: 'var(--r-card)', background: 'var(--muted-soft)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={18} color="var(--text-2)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)' }}>{r.type} leave · {r.days}d</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.from}{r.from === r.to ? '' : ` – ${r.to}`} · applied {r.applied}</div>
        </div>
      </div>

      {r.reason && (
        <div style={{ display: 'flex', gap: 9, marginTop: 11, paddingLeft: 2 }}>
          <Icon name="message" size={15} color="var(--text-3)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>{r.reason}</span>
        </div>
      )}

      {isPending ? (
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={onReject} style={{ flex: 1, height: 44, borderRadius: 'var(--r-btn)', border: '1.5px solid var(--hair)', background: 'var(--card)', color: 'var(--danger)', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Icon name="x" size={17} color="var(--danger)" strokeWidth={2.4} />Reject
          </button>
          <button onClick={onApprove} style={{ flex: 1.3, height: 44, borderRadius: 'var(--r-btn)', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 14px var(--accent-glow)' }}>
            <Icon name="check" size={17} color="#fff" strokeWidth={2.6} />Approve
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--hair)', color: 'var(--text-3)' }}>
          <Icon name={r.status === 'Rejected' ? 'x' : 'checkCircle'} size={15} color={r.status === 'Rejected' ? 'var(--danger)' : 'var(--success)'} strokeWidth={2.2} />
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{statusLine}{r.resolvedAt ? ` · ${r.resolvedAt}` : ''}</span>
        </div>
      )}
    </Card>
  );
}
