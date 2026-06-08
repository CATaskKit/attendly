import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, Card, Pill, SlideToConfirm } from './ui';
import { MapView, VRow, SelfieTile } from './screens';
import type { Ctx } from './data';

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
  const { closeOverlay, doCheckIn, fmtClock, now } = ctx;
  const [selfie, setSelfie] = useState(false);
  return (
    <Overlay title="Check In" onClose={closeOverlay} footer={<SlideToConfirm label="Slide to check in" onConfirm={doCheckIn} />}>
      <MapView />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, background: 'var(--success-soft)', borderRadius: 'var(--r-card)', padding: '13px 15px' }}>
        <Icon name="shield" size={22} color="var(--success)" strokeWidth={2} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--success)' }}>Inside office geofence</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>42 m from HQ centre · accuracy ±8 m</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 18, alignItems: 'flex-start' }}>
        <SelfieTile captured={selfie} onToggle={() => setSelfie((s) => !s)} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-1)' }}>Selfie verification</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.45 }}>{selfie ? 'Captured. Looks good — you can retake by tapping the photo.' : 'Optional. Tap the tile to capture a check-in selfie.'}</div>
          {selfie && <div style={{ marginTop: 8 }}><Pill tone="success"><Icon name="check" size={12} color="var(--success)" strokeWidth={3} />Face matched</Pill></div>}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <Card pad={16} style={{ marginTop: 10 }}>
          <VRow icon="mapPin" label="Location" value="Brigade Tech Park, Whitefield" />
          <div style={{ height: 1, background: 'var(--hair)' }} />
          <VRow icon="clock" label="Time" value={fmtClock(now) + ' IST'} mono />
          <div style={{ height: 1, background: 'var(--hair)' }} />
          <VRow icon="wifi" label="Network IP" value="103.21.58.204" mono />
          <div style={{ height: 1, background: 'var(--hair)' }} />
          <VRow icon="device" label="Device" value="iPhone 15 · iOS 18.2" />
        </Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, padding: '0 4px', color: 'var(--text-3)' }}>
          <Icon name="shield" size={14} color="var(--text-3)" />
          <span style={{ fontSize: 11.5, lineHeight: 1.4 }}>Location, device &amp; IP are recorded with this entry for audit. Encrypted in transit.</span>
        </div>
      </div>
    </Overlay>
  );
}

// ── CHECK OUT ────────────────────────────────────────────────────────
export function CheckOutScreen({ ctx }: { ctx: Ctx }) {
  const { closeOverlay, doCheckOut, fmtClock, fmtDur, checkInTime, elapsed, now } = ctx;
  return (
    <Overlay title="Check Out" onClose={closeOverlay} footer={<SlideToConfirm label="Slide to check out" tone="var(--success)" icon="arrowRight" onConfirm={doCheckOut} />}>
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
        <Card pad={14}><div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Overtime</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>+0:32</div></Card>
        <Card pad={14}><div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Shift</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', marginTop: 4 }}>On time</div></Card>
      </div>

      <div style={{ marginTop: 16 }}><MapView height={150} /></div>
      <Card pad={16} style={{ marginTop: 14 }}>
        <VRow icon="mapPin" label="Check-out location" value="Brigade Tech Park, Whitefield" />
        <div style={{ height: 1, background: 'var(--hair)' }} />
        <VRow icon="device" label="Device" value="iPhone 15 · iOS 18.2" />
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

export function ApplyLeaveScreen({ ctx }: { ctx: Ctx }) {
  const { closeOverlay, submitLeave } = ctx;
  const [type, setType] = useState('casual');
  const [half, setHalf] = useState(false);
  const [from] = useState('Jun 12');
  const [to] = useState('Jun 13');
  const [reason, setReason] = useState('');
  const [attachments, setAttachments] = useState<AttFile[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const t = LEAVE_TYPES.find((x) => x.id === type)!;

  const addFiles = (items: AttFile[]) => setAttachments((a) => [...a, ...items].slice(0, 6));
  const removeFile = (i: number) => setAttachments((a) => a.filter((_, idx) => idx !== i));

  return (
    <Overlay title="Apply for leave" onClose={closeOverlay}
      footer={<button onClick={() => submitLeave({ type: t.name, from, to, half, days: half ? 0.5 : 2 })} style={primaryBtn}>Submit request</button>}>
      <label style={fieldLabel}>Leave type</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {LEAVE_TYPES.map((lt) => {
          const on = type === lt.id;
          return (
            <button key={lt.id} onClick={() => setType(lt.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 999,
              border: on ? '1.5px solid var(--accent)' : '1.5px solid var(--hair)',
              background: on ? 'var(--accent-soft)' : 'var(--card)', cursor: 'pointer',
              color: on ? 'var(--accent)' : 'var(--text-2)', fontWeight: 600, fontSize: 13.5,
            }}>
              <Icon name={lt.icon} size={16} color={on ? 'var(--accent)' : 'var(--text-3)'} />{lt.name}
            </button>
          );
        })}
      </div>

      <label style={fieldLabel}>Duration</label>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <DateField label="From" value={from} />
        <DateField label="To" value={half ? from : to} dim={half} />
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

function UploadSheet({ attachments, onAdd, onRemove, onClose }: { attachments: AttFile[]; onAdd: (f: AttFile[]) => void; onRemove: (i: number) => void; onClose: () => void }) {
  const camRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const ingest = (fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
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

function DateField({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div style={{ flex: 1, opacity: dim ? 0.45 : 1, borderRadius: 'var(--r-card)', border: 'var(--card-border)', background: 'var(--card)', padding: '11px 14px' }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-1)' }}>{value}</span>
        <Icon name="calendar" size={17} color="var(--accent)" />
      </div>
    </div>
  );
}

// ── Logout confirmation sheet ────────────────────────────────────────
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
