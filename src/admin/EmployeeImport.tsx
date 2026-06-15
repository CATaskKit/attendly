import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { AIcon, BtnGhost, BtnPrimary } from './ui';
import type { Dept, Employee } from '../lib/api';

export type ImportRow = { name: string; email: string; designation: string; dept: string; manager: string; type: string; code: string };

const TYPES = ['Full-time', 'Part-time', 'Contract'];
const TEMPLATE = 'name,email,designation,department,reporting_to,type\nPriya Sharma,priya@acme.com,Engineer,Engineering,EMP-001,Full-time\nRahul Verma,rahul@acme.com,Designer,Design,Priya Sharma,Full-time';

// ── Minimal RFC-4180-ish CSV parser (handles quotes and commas) ──────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((f) => f.trim() !== '')) rows.push(row); }
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function EmployeeImport({ departments, employees, onClose, onImport }: {
  departments: Dept[]; employees: Employee[]; onClose: () => void; onImport: (rows: ImportRow[]) => Promise<void> | void;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const deptNames = useMemo(() => departments.map((d) => d.name), [departments]);
  // Resolve a free-text department / manager to an existing record (by name or code).
  const resolveDept = (raw: string) => deptNames.find((d) => norm(d) === norm(raw)) || '';
  const resolveManager = (raw: string) => {
    const hit = employees.find((e) => norm(e.code) === norm(raw) || norm(e.name) === norm(raw));
    return hit ? hit.name : '';
  };

  const ingest = (raw: string) => {
    setError(null);
    const grid = parseCSV(raw);
    if (grid.length < 2) { setError('Need a header row and at least one employee row.'); return; }
    const headers = grid[0].map(norm);
    const col = (...aliases: string[]) => headers.findIndex((h) => aliases.includes(h));
    const iName = col('name', 'fullname', 'employeename', 'employee');
    const iEmail = col('email', 'workemail', 'emailaddress');
    const iDesig = col('designation', 'title', 'jobtitle', 'role');
    const iDept = col('department', 'dept');
    const iMgr = col('reportingto', 'manager', 'reportsto', 'managercode', 'reporting');
    const iType = col('type', 'employmenttype', 'emptype');
    const iCode = col('code', 'empcode', 'employeecode');
    if (iName < 0) { setError('CSV needs a "name" column.'); return; }
    const at = (r: string[], i: number) => (i >= 0 && r[i] != null ? r[i].trim() : '');
    const parsed: ImportRow[] = grid.slice(1).map((r) => ({
      name: at(r, iName),
      email: at(r, iEmail),
      designation: at(r, iDesig),
      dept: resolveDept(at(r, iDept)),
      manager: resolveManager(at(r, iMgr)),
      type: TYPES.find((t) => norm(t) === norm(at(r, iType))) || 'Full-time',
      code: at(r, iCode),
    })).filter((r) => r.name);
    if (!parsed.length) { setError('No rows with a name were found.'); return; }
    setRows(parsed);
  };

  const onFile = (f: File | null) => { if (!f) return; const rd = new FileReader(); rd.onload = () => ingest(String(rd.result || '')); rd.readAsText(f); };
  const upd = (i: number, k: keyof ImportRow, v: string) => setRows((rs) => rs.map((r, ri) => (ri === i ? { ...r, [k]: v } : r)));
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, ri) => ri !== i));

  const valid = rows.filter((r) => r.name.trim());
  const doImport = async () => {
    if (!valid.length) return;
    setImporting(true);
    try { await onImport(valid); } finally { setImporting(false); }
  };

  const cell: CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--line)', fontSize: 13 };
  const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', height: 34, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel)', padding: '0 8px', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink-1)', outline: 'none' };
  const sel: CSSProperties = { ...inp, appearance: 'none', cursor: 'pointer' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,34,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: rows.length ? 980 : 560, maxWidth: '100%', maxHeight: '90vh', background: 'var(--panel)', borderRadius: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--line)' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-1)' }}>Bulk import employees</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>Upload a CSV; pick Department & Reporting-to from existing records.</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: 'var(--soft)', cursor: 'pointer' }}><AIcon name="x" size={17} color="var(--ink-2)" /></button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto' }}>
          {rows.length === 0 ? (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, padding: 16, borderRadius: 12, border: '1.5px dashed var(--line)', background: 'var(--bg)', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AIcon name="download" size={20} color="var(--accent)" /></div>
                  <div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)' }}>Choose a CSV file</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>name, email, designation, department, reporting_to, type</div></div>
                </button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0] || null)} />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 7 }}>…or paste CSV</div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={TEMPLATE} rows={6} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel)', padding: 12, fontSize: 12.5, fontFamily: 'var(--mono)', color: 'var(--ink-1)', outline: 'none', resize: 'vertical' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <button onClick={() => setText(TEMPLATE)} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>Insert sample</button>
                <BtnPrimary icon="check" onClick={() => ingest(text)}>Preview rows</BtnPrimary>
              </div>
              {error && <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--red-soft)', color: 'var(--red)', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
            </>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
                <thead><tr>{['Name', 'Email', 'Designation', 'Department', 'Reporting to', 'Type', ''].map((h) => <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', padding: '6px 8px', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td style={cell}><input style={inp} value={r.name} onChange={(e) => upd(i, 'name', e.target.value)} /></td>
                      <td style={cell}><input style={inp} value={r.email} onChange={(e) => upd(i, 'email', e.target.value)} placeholder="—" /></td>
                      <td style={cell}><input style={inp} value={r.designation} onChange={(e) => upd(i, 'designation', e.target.value)} placeholder="—" /></td>
                      <td style={cell}>
                        <select style={sel} value={r.dept} onChange={(e) => upd(i, 'dept', e.target.value)}>
                          <option value="">— Department —</option>
                          {deptNames.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </td>
                      <td style={cell}>
                        <select style={sel} value={r.manager} onChange={(e) => upd(i, 'manager', e.target.value)}>
                          <option value="">— None —</option>
                          {employees.map((e) => <option key={e.id} value={e.name}>{e.name} · {e.code}</option>)}
                        </select>
                      </td>
                      <td style={cell}>
                        <select style={sel} value={r.type} onChange={(e) => upd(i, 'type', e.target.value)}>
                          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td style={cell}><button onClick={() => removeRow(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}><AIcon name="trash" size={15} color="var(--ink-3)" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deptNames.length === 0 && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--amber)', fontWeight: 600 }}>No departments exist yet — add some in Settings → Leave/Departments to enable the dropdown.</div>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>{rows.length ? `${valid.length} employee${valid.length === 1 ? '' : 's'} ready` : 'CSV with a name column required'}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {rows.length > 0 && <BtnGhost icon="x" onClick={() => { setRows([]); setError(null); }}>Start over</BtnGhost>}
            <BtnGhost onClick={onClose}>Cancel</BtnGhost>
            {rows.length > 0 && <BtnPrimary icon="plus" onClick={doImport} disabled={importing || valid.length === 0}>{importing ? 'Importing…' : `Import ${valid.length}`}</BtnPrimary>}
          </div>
        </div>
      </div>
    </div>
  );
}
