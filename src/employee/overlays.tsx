import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, Card, Pill, SlideToConfirm } from './ui';
import { locationMessage } from '../lib/attendanceAudit';
import { isOffDate } from '../lib/calendar';
import { isNative, openLocationSettings, savedMessage } from '../lib/native';
import { MapView, VRow, SelfieTile } from './screens';
import type { Ctx } from './data';
import { APP_NAME } from '../lib/brand';
import { signedReceiptUrl, type Holiday } from '../lib/api';
import { fmtINR } from '../lib/billing';

const fieldLabel: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 9, letterSpacing: '0.01em' };
const primaryBtn: CSSProperties = { width: '100%', height: 54, borderRadius: 'var(--r-btn)', border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 16, boxShadow: '0 6px 18px var(--accent-glow)' };

type AttFile = { name: string; size?: number; kind: string };

// ── Overlay shell ────────────────────────────────────────────────────
export function Overlay({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'var(--bg)', display: 'flex', flexDirection: 'column', animation: 'slideUp .28s cubic-bezier(.2,.8,.2,1)' }}>
      <div style={{ height: 'var(--topbar, 0px)', flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px 12px', flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', border: 'var(--card-border)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="chevronLeft" size={22} color="var(--text-1)" />
        </button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>{title}</h1>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>{children}</div>
      {footer && <div style={{ flexShrink: 0, padding: '12px 16px calc(16px + var(--safe))', borderTop: '1px solid var(--hair)', background: 'var(--card)' }}>{footer}</div>}
    </div>
  );
}

// ── CHECK IN ─────────────────────────────────────────────────────────
export function CheckInScreen({ ctx }: { ctx: Ctx }) {
  const { closeOverlay, doCheckIn, fmtClock, now, refreshAttendanceAudit, timeSynced } = ctx;
  const [selfie, setSelfie] = useState(false);
  const [audit, setAudit] = useState(ctx.attendanceAudit);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingAudit(true);
    refreshAttendanceAudit()
      .then((next) => { if (active) setAudit(next); })
      .finally(() => { if (active) setLoadingAudit(false); });
    return () => { active = false; };
  }, [refreshAttendanceAudit]);

  const confirm = () => {
    void refreshAttendanceAudit().then((latest) => doCheckIn(latest));
  };
  const retryLocation = () => {
    setLoadingAudit(true);
    void refreshAttendanceAudit().then((next) => setAudit(next)).finally(() => setLoadingAudit(false));
  };
  const locationOk = !!audit.location;
  const locationText = audit.location || (loadingAudit ? 'Detecting location...' : locationMessage(audit.locationError ?? null));
  const ipText = audit.ip || (loadingAudit ? 'Detecting IP...' : 'Unavailable');

  return (
    <Overlay title="Check In" onClose={closeOverlay} footer={
      locationOk
        ? <SlideToConfirm label="Slide to check in" onConfirm={confirm} />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={retryLocation} disabled={loadingAudit} style={{ ...primaryBtn, opacity: loadingAudit ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
              <Icon name="mapPin" size={19} color="#fff" strokeWidth={2.2} />{loadingAudit ? 'Getting location…' : 'Enable location to check in'}
            </button>
            {isNative() && (
              <button onClick={() => void openLocationSettings()} style={{ height: 40, borderRadius: 'var(--r-btn)', border: 'none', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <Icon name="shield" size={16} color="var(--accent)" /> Open settings to turn on location
              </button>
            )}
          </div>
        )
    }>
      <MapView height={148} label={audit.location || 'Current device location'} lat={audit.lat} lng={audit.lng} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, background: locationOk ? 'var(--success-soft)' : 'var(--warning-soft)', borderRadius: 'var(--r-card)', padding: '11px 14px' }}>
        <Icon name={locationOk ? 'shield' : 'mapPin'} size={22} color={locationOk ? 'var(--success)' : 'var(--warning)'} strokeWidth={2} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: locationOk ? 'var(--success)' : 'var(--warning)' }}>{locationOk ? 'Location captured' : loadingAudit ? 'Getting your location…' : 'Location required'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{locationText}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 12, alignItems: 'center' }}>
        <SelfieTile captured={selfie} onToggle={() => setSelfie((s) => !s)} name={ctx.employeeName} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-1)' }}>Selfie verification</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.45 }}>{selfie ? 'Captured — tap the photo to retake.' : 'Optional. Tap the tile to capture a selfie.'}</div>
          {selfie && <div style={{ marginTop: 8 }}><Pill tone="success"><Icon name="check" size={12} color="var(--success)" strokeWidth={3} />Face matched</Pill></div>}
        </div>
      </div>

      <Card pad={14} style={{ marginTop: 12 }}>
        <VRow icon="clock" label="Time" value={fmtClock(now)} ok={timeSynced} mono />
        <div style={{ height: 1, background: 'var(--hair)' }} />
        <VRow icon="mapPin" label="Location" value={locationText} ok={!!audit.location} />
        <div style={{ height: 1, background: 'var(--hair)' }} />
        <VRow icon="wifi" label="Network IP" value={ipText} ok={!!audit.ip} mono />
        <div style={{ height: 1, background: 'var(--hair)' }} />
        <VRow icon="device" label="Device" value={audit.device} />
      </Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, padding: '0 4px', color: 'var(--text-3)' }}>
        <Icon name="shield" size={14} color="var(--text-3)" />
        <span style={{ fontSize: 11.5, lineHeight: 1.4 }}>Location, device &amp; IP are recorded with this entry for audit.</span>
      </div>
    </Overlay>
  );
}

// ── CHECK OUT ────────────────────────────────────────────────────────
export function CheckOutScreen({ ctx }: { ctx: Ctx }) {
  const { closeOverlay, doCheckOut, fmtClock, fmtDur, checkInTime, elapsed, now, refreshAttendanceAudit, timeSynced } = ctx;
  const [audit, setAudit] = useState(ctx.attendanceAudit);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingAudit(true);
    refreshAttendanceAudit()
      .then((next) => { if (active) setAudit(next); })
      .finally(() => { if (active) setLoadingAudit(false); });
    return () => { active = false; };
  }, [refreshAttendanceAudit]);

  const confirm = () => { void refreshAttendanceAudit().then((latest) => doCheckOut(latest)); };
  const retryLocation = () => {
    setLoadingAudit(true);
    void refreshAttendanceAudit().then((next) => setAudit(next)).finally(() => setLoadingAudit(false));
  };
  const locationOk = !!audit.location;
  const locationText = audit.location || (loadingAudit ? 'Detecting location...' : locationMessage(audit.locationError ?? null));
  const clockText = timeSynced ? 'Online synced' : 'Using device time';
  const fmtShort = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  const overtimeSecs = Math.max(0, elapsed - 8 * 3600);
  const late = checkInTime ? (checkInTime.getHours() * 60 + checkInTime.getMinutes()) > 9 * 60 + 45 : false;
  return (
    <Overlay title="Check Out" onClose={closeOverlay} footer={
      locationOk
        ? <SlideToConfirm label="Slide to check out" tone="var(--success)" icon="arrowRight" onConfirm={confirm} />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={retryLocation} disabled={loadingAudit} style={{ ...primaryBtn, opacity: loadingAudit ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
              <Icon name="mapPin" size={19} color="#fff" strokeWidth={2.2} />{loadingAudit ? 'Getting location…' : 'Enable location to check out'}
            </button>
            {isNative() && (
              <button onClick={() => void openLocationSettings()} style={{ height: 40, borderRadius: 'var(--r-btn)', border: 'none', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <Icon name="shield" size={16} color="var(--accent)" /> Open settings to turn on location
              </button>
            )}
          </div>
        )
    }>
      <div style={{ borderRadius: 'var(--r-hero)', padding: 20, background: 'var(--hero)', color: '#fff', boxShadow: 'var(--hero-shadow)' }}>
        <div style={{ fontSize: 12.5, opacity: 0.85 }}>Today's working time</div>
        <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>{fmtDur(elapsed)}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 11.5, opacity: 0.85 }}>Checked in</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtClock(checkInTime)}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 11.5, opacity: 0.85 }}>Check out</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtClock(now)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <Card pad={14}><div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Overtime</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>+{fmtShort(overtimeSecs)}</div></Card>
        <Card pad={14}><div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Shift</div><div style={{ fontSize: 20, fontWeight: 800, color: late ? 'var(--warning)' : 'var(--text-1)', marginTop: 4 }}>{late ? 'Late' : 'On time'}</div></Card>
      </div>

      <div style={{ marginTop: 16 }}><MapView height={150} label={audit.location || 'Current device location'} lat={audit.lat} lng={audit.lng} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, background: locationOk ? 'var(--success-soft)' : 'var(--warning-soft)', borderRadius: 'var(--r-card)', padding: '11px 14px' }}>
        <Icon name={locationOk ? 'shield' : 'mapPin'} size={22} color={locationOk ? 'var(--success)' : 'var(--warning)'} strokeWidth={2} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: locationOk ? 'var(--success)' : 'var(--warning)' }}>{locationOk ? 'Location captured' : loadingAudit ? 'Getting your location…' : 'Location required'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{locationText}</div>
        </div>
      </div>
      <Card pad={16} style={{ marginTop: 14 }}>
        <VRow icon="clock" label="Clock" value={clockText} ok={timeSynced} />
        <div style={{ height: 1, background: 'var(--hair)' }} />
        <VRow icon="mapPin" label="Check-out location" value={locationText} ok={locationOk} />
        <div style={{ height: 1, background: 'var(--hair)' }} />
        <VRow icon="wifi" label="Network IP" value={audit.ip || (loadingAudit ? 'Detecting IP...' : 'Unavailable')} ok={!!audit.ip} mono />
        <div style={{ height: 1, background: 'var(--hair)' }} />
        <VRow icon="device" label="Device" value={audit.device} />
      </Card>
    </Overlay>
  );
}

// ── APPLY LEAVE ──────────────────────────────────────────────────────
const LEAVE_TYPES = [
  { id: 'casual', name: 'Casual', icon: 'coffee' },
  { id: 'sick', name: 'Sick', icon: 'umbrella' },
  { id: 'paid', name: 'Paid', icon: 'briefcase' },
  { id: 'wfh', name: 'Work from home', icon: 'house' },
  { id: 'unpaid', name: 'Unpaid', icon: 'calendar' },
];
type LeaveOption = { id: string; name: string; icon: string; available?: number; allotted?: number };
const iconForLeave = (name: string) => LEAVE_TYPES.find((lt) => lt.name.toLowerCase() === name.toLowerCase())?.icon || 'calendar';
const leaveOptionId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'leave';
const fmtDays = (days: number) => Number.isInteger(days) ? String(days) : days.toFixed(1);

export function ApplyLeaveScreen({ ctx }: { ctx: Ctx }) {
  const { closeOverlay, submitLeave } = ctx;
  const leaveOptions = useMemo<LeaveOption[]>(() => (
    ctx.live
      ? ctx.leaveBalances.map((b) => ({ id: leaveOptionId(b.type), name: b.type, icon: iconForLeave(b.type), available: b.available, allotted: b.allotted }))
      : LEAVE_TYPES
  ), [ctx.live, ctx.leaveBalances]);
  const [type, setType] = useState(LEAVE_TYPES[0].name);
  const [half, setHalf] = useState(false);
  const todayIso = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [fromDate, setFromDate] = useState(todayIso);
  const [toDate, setToDate] = useState(tomorrow.toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [attachments, setAttachments] = useState<AttFile[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  useEffect(() => {
    if (leaveOptions.length && !leaveOptions.some((x) => x.name === type)) setType(leaveOptions[0].name);
  }, [leaveOptions, type]);
  const t = leaveOptions.find((x) => x.name === type) ?? leaveOptions[0];
  const displayDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dayDiff = Math.max(1, Math.round((new Date(`${toDate}T00:00:00`).getTime() - new Date(`${fromDate}T00:00:00`).getTime()) / 86400000) + 1);
  const days = half ? 0.5 : dayDiff;
  const firstAttachment = attachments[0]?.name ?? null;
  const exceedsBalance = ctx.live && t?.available != null && days > t.available;

  // Validations: To ≥ From; not entirely on holidays/weekly-offs; no overlap
  // with an existing pending/approved leave.
  const effTo = half ? fromDate : toDate;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const localIso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const compulsoryHol = useMemo(() => new Set(ctx.holidays.filter((h) => (h.type || '').toLowerCase() !== 'optional').map((h) => h.date)), [ctx.holidays]);
  const workingDaysIn = (a: string, b: string) => {
    let n = 0; const d = new Date(`${a}T00:00:00`); const end = new Date(`${b}T00:00:00`);
    while (d <= end) { if (!isOffDate(d, ctx.weekend) && !compulsoryHol.has(localIso(d))) n++; d.setDate(d.getDate() + 1); }
    return n;
  };
  const dateOrderBad = !half && toDate < fromDate;
  const allOff = !dateOrderBad && workingDaysIn(fromDate, effTo) === 0;
  const overlaps = ctx.leaveRequests.some((lr) =>
    (lr.status === 'Pending' || lr.status === 'Approved') && lr.fromDate && lr.toDate && lr.fromDate <= effTo && lr.toDate >= fromDate);
  const dateError = dateOrderBad ? 'To date must be on or after the From date'
    : allOff ? 'Those dates are holidays / weekly-offs — no leave needed'
    : overlaps ? 'You already have a leave request on these dates'
    : null;
  const canSubmit = !!t && !exceedsBalance && !dateError;

  const addFiles = (items: AttFile[]) => setAttachments((a) => [...a, ...items].slice(0, 6));
  const removeFile = (i: number) => setAttachments((a) => a.filter((_, idx) => idx !== i));

  return (
    <Overlay title="Apply for leave" onClose={closeOverlay}
      footer={<button disabled={!canSubmit} onClick={() => t && submitLeave({ type: t.name, from: displayDate(fromDate), to: displayDate(half ? fromDate : toDate), half, days, fromDate, toDate: half ? fromDate : toDate, reason, attachment: firstAttachment })} style={{ ...primaryBtn, opacity: canSubmit ? 1 : 0.55, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>{exceedsBalance ? 'Exceeds balance' : dateError ? 'Check the dates' : 'Submit request'}</button>}>
      <label style={fieldLabel}>Leave type</label>
      {leaveOptions.length === 0 ? (
        <Card pad={16} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>No leave balance assigned</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>Ask HR to add leave policies for your profile.</div>
        </Card>
      ) : (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {leaveOptions.map((lt) => {
          const on = type === lt.name;
          return (
            <button key={lt.id} onClick={() => setType(lt.name)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 999,
              border: on ? '1.5px solid var(--accent)' : '1.5px solid var(--hair)',
              background: on ? 'var(--accent-soft)' : 'var(--card)', cursor: 'pointer',
              color: on ? 'var(--accent)' : 'var(--text-2)', fontWeight: 600, fontSize: 13.5,
            }}>
              <Icon name={lt.icon} size={16} color={on ? 'var(--accent)' : 'var(--text-3)'} />{lt.name}
              {ctx.live && lt.available != null && lt.allotted != null && <span style={{ fontSize: 11.5, color: on ? 'var(--accent)' : 'var(--text-3)', fontWeight: 700 }}>{fmtDays(lt.available)}/{fmtDays(lt.allotted)}</span>}
            </button>
          );
        })}
      </div>
      )}
      {ctx.live && t?.available != null && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '10px 12px', borderRadius: 'var(--r-card)', background: exceedsBalance ? 'var(--danger-soft)' : 'var(--muted-soft)' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: exceedsBalance ? 'var(--danger)' : 'var(--text-2)' }}>{fmtDays(t.available)} days available</span>
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>Max {fmtDays(t.allotted ?? 0)}</span>
        </div>
      )}

      <label style={fieldLabel}>Duration</label>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <DateField label="From" value={fromDate} onChange={setFromDate} />
        <DateField label="To" value={half ? fromDate : toDate} onChange={setToDate} dim={half} />
      </div>
      <div onClick={() => setHalf((h) => !h)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', borderRadius: 'var(--r-card)', border: 'var(--card-border)', background: 'var(--card)', cursor: 'pointer', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="clock" size={19} color="var(--text-2)" />
          <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-1)' }}>Half day</span>
        </div>
        <div style={{ width: 46, height: 28, borderRadius: 999, background: half ? 'var(--accent)' : 'var(--muted-soft)', position: 'relative', transition: 'background .2s' }}>
          <div style={{ position: 'absolute', top: 3, left: half ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .2s' }} />
        </div>
      </div>

      {dateError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '11px 13px', borderRadius: 'var(--r-card)', background: 'var(--danger-soft)' }}>
          <Icon name="x" size={15} color="var(--danger)" strokeWidth={2.6} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--danger)', lineHeight: 1.4 }}>{dateError}</span>
        </div>
      )}

      <label style={fieldLabel}>Reason</label>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add a short note for your manager…" rows={3} style={{
        width: '100%', boxSizing: 'border-box', resize: 'none', borderRadius: 'var(--r-card)', border: 'var(--card-border)',
        background: 'var(--card)', padding: 14, fontSize: 14.5, fontFamily: 'inherit', color: 'var(--text-1)', marginBottom: 20, outline: 'none',
      }} />

      <label style={fieldLabel}>Attachments <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>· optional</span></label>

      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {attachments.map((f, i) => <AttachRow key={i} file={f} onRemove={() => removeFile(i)} />)}
        </div>
      )}

      <button onClick={() => setShowUpload(true)} style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 14, borderRadius: 'var(--r-card)', cursor: 'pointer', marginBottom: 8,
        border: '1.5px dashed var(--hair)', background: 'var(--card)', textAlign: 'left',
      }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={attachments.length ? 'plus' : 'upload'} size={20} color="var(--accent)" strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{attachments.length ? 'Add another file' : 'Upload a document'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Camera, photos or files · PDF, JPG, PNG</div>
        </div>
        <Icon name="chevronRight" size={18} color="var(--text-3)" />
      </button>

      {showUpload && (
        <UploadSheet attachments={attachments} onAdd={addFiles} onRemove={removeFile} onClose={() => setShowUpload(false)} />
      )}
    </Overlay>
  );
}

function fileKind(name: string) {
  const e = (name.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif'].includes(e)) return 'image';
  if (e === 'pdf') return 'pdf';
  return 'file';
}
function fmtSize(b?: number) {
  if (b == null) return '';
  return b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
}
function AttachRow({ file, onRemove }: { file: AttFile; onRemove: () => void }) {
  const tone = file.kind === 'image' ? 'var(--success)' : file.kind === 'pdf' ? 'var(--danger)' : 'var(--accent)';
  const soft = file.kind === 'image' ? 'var(--success-soft)' : file.kind === 'pdf' ? 'var(--danger-soft)' : 'var(--accent-soft)';
  const icon = file.kind === 'image' ? 'image' : 'file';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 11, borderRadius: 'var(--r-card)', border: '1px solid var(--hair)', background: 'var(--card)' }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={19} color={tone} strokeWidth={1.9} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-3)' }}>
          <Icon name="check" size={12} color="var(--success)" strokeWidth={3} />
          <span>Attached{file.size != null ? ' · ' + fmtSize(file.size) : ''}</span>
        </div>
      </div>
      <button onClick={onRemove} style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: 'var(--muted-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="trash" size={16} color="var(--text-3)" />
      </button>
    </div>
  );
}

function UploadSheet({ attachments, onAdd, onFiles, onRemove, onClose }: { attachments: AttFile[]; onAdd: (f: AttFile[]) => void; onFiles?: (files: File[]) => void; onRemove: (i: number) => void; onClose: () => void }) {
  const camRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const ingest = (fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    onFiles?.(files); // real File objects (for upload), when the caller needs them
    onAdd(files.map((f) => ({ name: f.name, size: f.size, kind: fileKind(f.name) })));
  };

  const sources = [
    { id: 'camera', icon: 'camera', label: 'Camera', sub: 'Take photo', ref: camRef },
    { id: 'photos', icon: 'image', label: 'Photos', sub: 'Library', ref: photoRef },
    { id: 'files', icon: 'folder', label: 'Files', sub: 'Documents', ref: fileRef },
  ];

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(8,12,20,0.5)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      animation: 'sheetFade .22s ease', backdropFilter: 'blur(2px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--card)', borderTopLeftRadius: 26, borderTopRightRadius: 26,
        padding: '10px 18px calc(18px + var(--safe))', maxHeight: '90%', overflowY: 'auto',
        animation: 'sheetUp .3s cubic-bezier(.2,.85,.25,1)', boxShadow: '0 -10px 40px rgba(0,0,0,0.25)',
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--hair)', margin: '4px auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Add attachment</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.45 }}>Attach a certificate or supporting doc · up to 10 MB</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--muted-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="x" size={18} color="var(--text-2)" strokeWidth={2.2} />
          </button>
        </div>

        <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => ingest(e.target.files)} />
        <input ref={photoRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => ingest(e.target.files)} />
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,image/*" multiple style={{ display: 'none' }} onChange={(e) => ingest(e.target.files)} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, margin: '16px 0 14px' }}>
          {sources.map((s) => (
            <button key={s.id} onClick={() => s.ref.current && s.ref.current.click()} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 8px',
              borderRadius: 'var(--r-card)', border: '1px solid var(--hair)', background: 'var(--bg)', cursor: 'pointer',
            }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.icon} size={23} color="var(--accent)" strokeWidth={1.9} />
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)' }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: -4 }}>{s.sub}</div>
            </button>
          ))}
        </div>

        <div
          onClick={() => fileRef.current && fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); ingest(e.dataTransfer.files); }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '22px 16px', cursor: 'pointer',
            borderRadius: 'var(--r-card)', textAlign: 'center',
            border: dragOver ? '1.5px solid var(--accent)' : '1.5px dashed var(--hair)',
            background: dragOver ? 'var(--accent-soft)' : 'transparent', transition: 'background .15s, border-color .15s',
          }}>
          <Icon name="upload" size={26} color={dragOver ? 'var(--accent)' : 'var(--text-3)'} strokeWidth={1.8} />
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-2)' }}>Drag &amp; drop, or <span style={{ color: 'var(--accent)', fontWeight: 700 }}>browse</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>PDF, JPG or PNG</div>
        </div>

        {attachments.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Added</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>{attachments.length}/6</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attachments.map((f, i) => <AttachRow key={i} file={f} onRemove={() => onRemove(i)} />)}
            </div>
          </div>
        )}

        <button onClick={onClose} style={{ ...primaryBtn, marginTop: 18 }}>
          {attachments.length ? `Done · ${attachments.length} file${attachments.length > 1 ? 's' : ''} attached` : 'Done'}
        </button>
      </div>
    </div>
  );
}

function DateField({ label, value, dim, onChange }: { label: string; value: string; dim?: boolean; onChange: (value: string) => void }) {
  return (
    <label style={{ flex: 1, opacity: dim ? 0.45 : 1, borderRadius: 'var(--r-card)', border: 'var(--card-border)', background: 'var(--card)', padding: '9px 12px', display: 'block' }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
      <input
        type="date"
        value={value}
        disabled={dim}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', marginTop: 2, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-1)', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}
      />
    </label>
  );
}

// ── Notifications ────────────────────────────────────────────────────
export function NotificationsScreen({ ctx }: { ctx: Ctx }) {
  const { notifications, unreadCount, markAllRead, markOneRead, closeOverlay } = ctx;
  const fmtTime = (iso: string) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
  };
  const iconFor = (type: string) => (type.startsWith('leave') ? 'leave' : 'bell');
  return (
    <Overlay title="Notifications" onClose={closeOverlay}
      footer={unreadCount > 0 ? <button onClick={markAllRead} style={primaryBtn}>Mark all read</button> : undefined}>
      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-3)' }}>
          <Icon name="bell" size={34} color="var(--text-3)" />
          <div style={{ marginTop: 12, fontSize: 14.5, fontWeight: 700, color: 'var(--text-2)' }}>No notifications</div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>Approvals and updates show up here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifications.map((n) => (
            <Card key={n.id} pad={14} onClick={() => markOneRead(n.id)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: n.read ? 'var(--card)' : 'var(--accent-soft)' }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={iconFor(n.type)} size={19} color="var(--accent)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{n.title}</div>
                {n.body && <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>{fmtTime(n.created_at)}</div>
              </div>
              {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 }} />}
            </Card>
          ))}
        </div>
      )}
    </Overlay>
  );
}

// ── Announcements ────────────────────────────────────────────────────
export function AnnouncementsScreen({ ctx }: { ctx: Ctx }) {
  const { announcements, isAnnouncementRead, markAnnouncementRead, unreadAnnouncements, closeOverlay } = ctx;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <Overlay title="Announcements" onClose={closeOverlay}
      footer={unreadAnnouncements > 0 ? <button onClick={() => announcements.forEach((a) => markAnnouncementRead(a.id))} style={primaryBtn}>Mark all read</button> : undefined}>
      {announcements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-3)' }}>
          <Icon name="bell" size={34} color="var(--text-3)" />
          <div style={{ marginTop: 12, fontSize: 14.5, fontWeight: 700, color: 'var(--text-2)' }}>No announcements</div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>Company updates from HR show up here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {announcements.map((a) => {
            const read = isAnnouncementRead(a.id);
            return (
              <Card key={a.id} pad={15} onClick={() => markAnnouncementRead(a.id)} style={{ background: read ? 'var(--card)' : 'var(--accent-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                  {a.pinned && <Icon name="bell" size={14} color="var(--accent)" />}
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-1)', flex: 1 }}>{a.title}</span>
                  {!read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.body}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8, fontWeight: 600 }}>{a.author || 'Admin'} · {fmt(a.created_at)}</div>
              </Card>
            );
          })}
        </div>
      )}
    </Overlay>
  );
}

// ── Reimbursements ───────────────────────────────────────────────────
const REIMB_CATEGORIES = [
  { id: 'Travel', icon: 'mapPin' },
  { id: 'Food', icon: 'coffee' },
  { id: 'Convenience', icon: 'bolt' },
  { id: 'Supplies', icon: 'briefcase' },
  { id: 'Other', icon: 'file' },
];
const reimbTone = (s: string): 'accent' | 'success' | 'danger' | 'warning' =>
  s === 'Paid' ? 'accent' : s === 'Approved' ? 'success' : s === 'Rejected' ? 'danger' : 'warning';

export function ReimbursementsScreen({ ctx }: { ctx: Ctx }) {
  const { closeOverlay, reimbursements, reimbursementEnabled, submitReimbursement, cancelReimbursement } = ctx;
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [category, setCategory] = useState('Travel');
  const [amount, setAmount] = useState('');
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const amt = Number(amount) || 0;
  const canSubmit = reimbursementEnabled && amt > 0;

  const downloadMine = async () => {
    if (!reimbursements.length) return;
    setDownloading(true);
    try {
      // Load the zip/xlsx bundle on demand — keeps it out of the initial app load.
      const { downloadReimbursementsZip } = await import('../lib/zip');
      const { savedTo } = await downloadReimbursementsZip(reimbursements, signedReceiptUrl, 'my-reimbursements');
      ctx.notify(savedMessage(savedTo));
    } catch (e) { console.error(e); ctx.notify('Could not download — try again', 'x'); }
    finally { setDownloading(false); }
  };

  if (mode === 'new') {
    return (
      <Overlay title="New claim" onClose={() => setMode('list')}
        footer={<button disabled={!canSubmit} onClick={() => submitReimbursement({ category, amount: amt, spentOn, reason, files })} style={{ ...primaryBtn, opacity: canSubmit ? 1 : 0.55, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>Submit claim</button>}>
        <label style={fieldLabel}>Category</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {REIMB_CATEGORIES.map((c) => {
            const on = category === c.id;
            return (
              <button key={c.id} onClick={() => setCategory(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 999, border: on ? '1.5px solid var(--accent)' : '1.5px solid var(--hair)', background: on ? 'var(--accent-soft)' : 'var(--card)', color: on ? 'var(--accent)' : 'var(--text-2)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>
                <Icon name={c.icon} size={16} color={on ? 'var(--accent)' : 'var(--text-3)'} />{c.id}
              </button>
            );
          })}
        </div>

        <label style={fieldLabel}>Amount (₹)</label>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={{ width: '100%', boxSizing: 'border-box', height: 52, borderRadius: 'var(--r-card)', border: 'var(--card-border)', background: 'var(--card)', padding: '0 16px', fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginBottom: 18, outline: 'none' }} />

        <label style={fieldLabel}>Date of expense</label>
        <div style={{ marginBottom: 18 }}><DateField label="Spent on" value={spentOn} onChange={setSpentOn} /></div>

        <label style={fieldLabel}>Reason</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What was this expense for?" rows={3} style={{ width: '100%', boxSizing: 'border-box', resize: 'none', borderRadius: 'var(--r-card)', border: 'var(--card-border)', background: 'var(--card)', padding: 14, fontSize: 14.5, fontFamily: 'inherit', color: 'var(--text-1)', marginBottom: 18, outline: 'none' }} />

        <label style={fieldLabel}>Receipts <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>· attach bills</span></label>
        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {files.map((f, i) => <AttachRow key={i} file={{ name: f.name, size: f.size, kind: fileKind(f.name) }} onRemove={() => setFiles((a) => a.filter((_, idx) => idx !== i))} />)}
          </div>
        )}
        <button onClick={() => setShowUpload(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 14, borderRadius: 'var(--r-card)', cursor: 'pointer', border: '1.5px dashed var(--hair)', background: 'var(--card)', textAlign: 'left' }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={files.length ? 'plus' : 'upload'} size={20} color="var(--accent)" strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{files.length ? 'Add another receipt' : 'Upload a receipt'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Camera, photos or files · PDF, JPG, PNG · up to 8</div>
          </div>
        </button>

        {showUpload && (
          <UploadSheet
            attachments={files.map((f) => ({ name: f.name, size: f.size, kind: fileKind(f.name) }))}
            onAdd={() => { /* real files captured via onFiles below */ }}
            onFiles={(fs) => setFiles((a) => [...a, ...fs].slice(0, 8))}
            onRemove={(i) => setFiles((a) => a.filter((_, idx) => idx !== i))}
            onClose={() => setShowUpload(false)}
          />
        )}
      </Overlay>
    );
  }

  return (
    <Overlay title="Reimbursements" onClose={closeOverlay}
      footer={reimbursementEnabled ? <button onClick={() => setMode('new')} style={primaryBtn}>New claim</button> : undefined}>
      {!reimbursementEnabled && (
        <Card pad={16} style={{ marginBottom: 14, background: 'var(--warning-soft)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--warning)' }}>Reimbursements not enabled</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4 }}>Ask your HR admin to enable the reimbursement add-on to submit claims.</div>
        </Card>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 700 }}>{reimbursements.length} claim{reimbursements.length === 1 ? '' : 's'}</span>
        {reimbursements.length > 0 && (
          <button onClick={downloadMine} disabled={downloading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            <Icon name="upload" size={15} color="var(--accent)" />{downloading ? 'Preparing…' : 'Download my records'}
          </button>
        )}
      </div>
      {reimbursements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-3)' }}>
          <Icon name="receipt" size={34} color="var(--text-3)" />
          <div style={{ marginTop: 12, fontSize: 14.5, fontWeight: 700, color: 'var(--text-2)' }}>No claims yet</div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>Submit an expense and track its approval here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reimbursements.map((r) => (
            <Card key={r.id} pad={14}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="receipt" size={19} color="var(--accent)" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>{fmtINR(Number(r.amount))}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{r.category} · {new Date(r.spent_on + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
                <Pill tone={reimbTone(r.status)}>{r.status}</Pill>
              </div>
              {r.reason && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.4 }}>{r.reason}</div>}
              {r.status === 'Pending' && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>{r.stage === 'manager' ? 'Awaiting manager approval' : 'Awaiting HR approval'}</div>}
              {r.status === 'Paid' && <div style={{ fontSize: 11.5, color: 'var(--success)', fontWeight: 600, marginTop: 6 }}>Paid{r.paid_ref ? ` · ref ${r.paid_ref}` : ''}</div>}
              {r.attachments.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="paperclip" size={13} color="var(--text-3)" />{r.attachments.length} receipt{r.attachments.length === 1 ? '' : 's'}</div>}
              {r.status === 'Pending' && (
                <button onClick={() => { if (window.confirm('Withdraw this claim?')) cancelReimbursement(r.id); }}
                  style={{ width: '100%', marginTop: 10, height: 38, borderRadius: 10, border: '1.5px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon name="x" size={15} color="var(--danger)" strokeWidth={2.4} /> Cancel claim
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
      {reimbursements.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 14, padding: '0 4px', color: 'var(--text-3)' }}>
          <Icon name="shield" size={14} color="var(--text-3)" />
          <span style={{ fontSize: 11.5, lineHeight: 1.4 }}>Records are kept ~2 years. Download and keep an offline copy.</span>
        </div>
      )}
    </Overlay>
  );
}

// ── Logout confirmation sheet ────────────────────────────────────────
// ── HOLIDAYS (full list) ─────────────────────────────────────────────
function HolidayRow({ h, dim }: { h: Holiday; dim?: boolean }) {
  const d = new Date(`${h.date}T00:00:00`);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 10px', opacity: dim ? 0.55 : 1 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--accent)' }}>{d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{d.getDate()}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-1)' }}>{h.name}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{h.type} holiday · {d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric' })}</div>
      </div>
    </div>
  );
}

export function HolidaysScreen({ ctx }: { ctx: Ctx }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const sorted = [...ctx.holidays].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter((h) => h.date >= todayIso);
  const past = sorted.filter((h) => h.date < todayIso).reverse();
  const heading = (t: string, mt = 4) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: `${mt}px 4px 6px` }}>{t}</div>
  );
  return (
    <Overlay title="Holidays" onClose={ctx.closeOverlay}>
      {ctx.holidays.length === 0 ? (
        <Card pad={16} style={{ color: 'var(--text-3)', fontSize: 13.5 }}>No holidays have been added yet.</Card>
      ) : (
        <>
          {upcoming.length > 0 && (<>{heading(`Upcoming · ${upcoming.length}`)}<Card pad={4}>{upcoming.map((h, i) => <div key={h.id ?? i} style={{ borderTop: i ? '1px solid var(--hair)' : 'none' }}><HolidayRow h={h} /></div>)}</Card></>)}
          {past.length > 0 && (<>{heading(`Earlier this year · ${past.length}`, 18)}<Card pad={4}>{past.map((h, i) => <div key={h.id ?? i} style={{ borderTop: i ? '1px solid var(--hair)' : 'none' }}><HolidayRow h={h} dim /></div>)}</Card></>)}
        </>
      )}
      <div style={{ height: 16 }} />
    </Overlay>
  );
}

export function LogoutConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(8,12,20,0.42)' }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'var(--card)', borderTopLeftRadius: 26, borderTopRightRadius: 26,
        padding: '26px 22px calc(22px + var(--safe))', boxShadow: '0 -10px 40px rgba(0,0,0,0.18)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--hair)', margin: '-8px auto 18px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
            <Icon name="logout" size={26} color="var(--danger)" strokeWidth={2.1} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Log out of On Time?</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-3)', fontWeight: 500, lineHeight: 1.45, maxWidth: 280 }}>You'll need to sign in again to mark attendance and manage leave.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
          <button onClick={onConfirm} style={{ height: 52, borderRadius: 'var(--r-btn)', border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 700, fontSize: 15.5, cursor: 'pointer', fontFamily: 'inherit' }}>Log out</button>
          <button onClick={onCancel} style={{ height: 52, borderRadius: 'var(--r-btn)', border: 'var(--card-border)', background: 'var(--muted-soft)', color: 'var(--text-1)', fontWeight: 700, fontSize: 15.5, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
