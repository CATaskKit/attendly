import JSZip from 'jszip';
import * as XLSX from 'xlsx-js-style';
import type { Reimbursement } from './api';
import { fmtINR } from './billing';
import { styledSheet } from './export';
import { saveFile, MIME } from './native';

// Bundles a set of reimbursement claims into a .zip: every receipt file plus an
// Excel summary, so HR can archive offline (records are retained ~2 years) and
// proceed with payment. Used by both the admin console (all/selected claims) and
// the employee app (their own records).
export async function downloadReimbursementsZip(
  rows: Reimbursement[],
  signedUrlFor: (path: string) => Promise<string | null>,
  filename = 'reimbursements',
): Promise<{ files: number; missing: number; savedTo: string | void }> {
  const zip = new JSZip();
  const receipts = zip.folder('receipts')!;
  let files = 0;
  let missing = 0;

  const summary: Record<string, string | number>[] = [];
  for (const r of rows) {
    const folderName = `${(r.emp || 'employee').replace(/[^\w.-]+/g, '_')}-${r.spent_on}-${r.id.slice(0, 6)}`;
    summary.push({
      Employee: r.emp ?? '',
      Code: r.code ?? '',
      Department: r.dept ?? '',
      Category: r.category,
      Amount: r.amount,
      'Amount (₹)': fmtINR(r.amount),
      'Spent on': r.spent_on,
      Status: r.status,
      Reason: r.reason ?? '',
      'Paid on': r.paid_at ? new Date(r.paid_at).toLocaleDateString() : '',
      'Payment ref': r.paid_ref ?? '',
      Receipts: r.attachments.length,
      'Submitted': new Date(r.created_at).toLocaleString(),
    });

    for (const att of r.attachments) {
      const url = await signedUrlFor(att.path);
      if (!url) { missing++; continue; }
      try {
        const blob = await (await fetch(url)).blob();
        receipts.folder(folderName)!.file(att.name, blob);
        files++;
      } catch { missing++; }
    }
  }

  // Excel summary at the root of the zip (branded header, zebra rows, borders).
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, styledSheet(summary), 'Reimbursements');
  const xlsxArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  zip.file('reimbursements-summary.xlsx', xlsxArray);

  const out = await zip.generateAsync({ type: 'blob' });
  const savedTo = await saveFile(`${filename}-${new Date().toISOString().slice(0, 10)}.zip`, out, MIME.zip);
  return { files, missing, savedTo };
}
