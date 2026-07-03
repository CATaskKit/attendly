// Shared GST tax-invoice PDF builder (Deno / pdf-lib). Used by both the
// invoice-pdf download endpoint and verify-payment's auto-email.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'https://esm.sh/pdf-lib@1.17.1';

export type InvoiceDoc = {
  invoice_no: string;
  invoice_date: string;            // ISO
  supplier: { name: string; gstin: string; address: string; state: string; email: string; phone: string };
  customer: { name: string; gstin?: string | null; state?: string | null; address?: string | null };
  sac_code: string;
  description: string;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  place_of_supply?: string | null;
};

const INK = rgb(0.09, 0.11, 0.15);
const MUTE = rgb(0.42, 0.45, 0.52);
const LINE = rgb(0.82, 0.85, 0.9);
const ACCENT = rgb(0.31, 0.36, 0.87);

// The standard PDF fonts (WinAnsi) can't encode the ₹ glyph, so use "Rs." —
// standard and compliant on Indian tax invoices.
const inr = (n: number) =>
  'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// Standard PDF fonts only encode Latin-1. Map common typographic characters to
// ASCII and drop anything else so user-entered text can never crash rendering.
function safe(s: string): string {
  return String(s ?? '')
    .replace(/₹/g, 'Rs.')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E -ÿ]/g, '');
}

// Indian-system number to words (for the rupee total).
function amountInWords(num: number): string {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n: number): string => (n < 20 ? a[n] : `${b[Math.floor(n / 10)]}${n % 10 ? ' ' + a[n % 10] : ''}`);
  const three = (n: number): string => (n >= 100 ? `${a[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + two(n % 100) : ''}` : two(n));
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';
  let r = rupees;
  const crore = Math.floor(r / 10000000); r %= 10000000;
  const lakh = Math.floor(r / 100000); r %= 100000;
  const thousand = Math.floor(r / 1000); r %= 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (r) parts.push(three(r));
  let words = parts.join(' ').trim() || 'Zero';
  words = `${words} Rupees`;
  if (paise) words += ` and ${two(paise)} Paise`;
  return `${words} Only`;
}

export async function buildInvoicePdf(doc: InvoiceDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const M = 42;
  let y = height - M;

  const text = (s: string, x: number, yy: number, size = 9.5, f: PDFFont = font, color = INK) =>
    page.drawText(s, { x, y: yy, size, font: f, color });
  const right = (s: string, xr: number, yy: number, size = 9.5, f: PDFFont = font, color = INK) => {
    const w = f.widthOfTextAtSize(s, size);
    page.drawText(s, { x: xr - w, y: yy, size, font: f, color });
  };
  const hline = (yy: number, x0 = M, x1 = width - M, color = LINE, thickness = 0.75) =>
    page.drawLine({ start: { x: x0, y: yy }, end: { x: x1, y: yy }, thickness, color });

  // Header
  text('TAX INVOICE', M, y, 18, bold, ACCENT);
  right(doc.supplier.name, width - M, y, 15, bold);
  y -= 16;
  right('by CATaskKit', width - M, y, 8.5, font, MUTE);
  y -= 22;
  hline(y); y -= 16;

  // Supplier + invoice meta (two columns)
  const colR = width - M;
  const midX = 320;
  let ly = y;
  text('Sold by', M, ly, 8, bold, MUTE); ly -= 13;
  text(doc.supplier.name, M, ly, 10.5, bold); ly -= 13;
  for (const ln of wrap(doc.supplier.address, 46)) { text(ln, M, ly, 9); ly -= 12; }
  text(`GSTIN: ${doc.supplier.gstin}`, M, ly, 9, bold); ly -= 12;
  text(`State: ${doc.supplier.state}`, M, ly, 9); ly -= 12;
  text(`${doc.supplier.email}  ·  ${doc.supplier.phone}`, M, ly, 8.5, font, MUTE);

  let ry = y;
  const label = (k: string, v: string, yy: number, vBold = false) => {
    text(k, midX, yy, 9, font, MUTE);
    right(v, colR, yy, 9, vBold ? bold : font);
  };
  label('Invoice No.', doc.invoice_no, ry, true); ry -= 14;
  label('Invoice Date', new Date(doc.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), ry); ry -= 14;
  label('Place of Supply', doc.place_of_supply || doc.customer.state || '—', ry); ry -= 14;
  label('SAC', doc.sac_code, ry);

  y = Math.min(ly, ry) - 22;
  hline(y); y -= 16;

  // Bill to
  text('Bill to', M, y, 8, bold, MUTE); y -= 14;
  text(doc.customer.name, M, y, 10.5, bold); y -= 13;
  if (doc.customer.address) for (const ln of wrap(doc.customer.address, 70)) { text(ln, M, y, 9); y -= 12; }
  if (doc.customer.gstin) { text(`GSTIN: ${doc.customer.gstin}`, M, y, 9, bold); y -= 12; }
  if (doc.customer.state) { text(`State: ${doc.customer.state}`, M, y, 9); y -= 12; }
  y -= 10;

  // Line-item table
  const cSac = 300, cTax = colR;
  hline(y + 4); const headY = y - 10;
  text('Description', M, headY, 8.5, bold, MUTE);
  text('SAC', cSac, headY, 8.5, bold, MUTE);
  right('Taxable value', cTax, headY, 8.5, bold, MUTE);
  y = headY - 8; hline(y); y -= 16;
  for (const ln of wrap(doc.description, 52)) { text(ln, M, y, 9.5); y -= 13; }
  const rowTopY = y + 13;
  text(doc.sac_code, cSac, rowTopY, 9.5);
  right(inr(doc.taxable_value), cTax, rowTopY, 9.5);
  y -= 6; hline(y); y -= 16;

  // Tax summary (right-aligned block)
  const sumX = 330;
  const sumRow = (k: string, v: string, yy: number, strong = false) => {
    text(k, sumX, yy, 9.5, strong ? bold : font, strong ? INK : MUTE);
    right(v, colR, yy, 9.5, strong ? bold : font);
  };
  sumRow('Taxable value', inr(doc.taxable_value), y); y -= 15;
  if (doc.igst > 0) {
    sumRow('IGST @ 18%', inr(doc.igst), y); y -= 15;
  } else {
    sumRow('CGST @ 9%', inr(doc.cgst), y); y -= 15;
    sumRow('SGST @ 9%', inr(doc.sgst), y); y -= 15;
  }
  hline(y + 4, sumX, colR); y -= 12;
  sumRow('Total', inr(doc.total), y, true); y -= 22;

  // Amount in words
  text('Amount in words', M, y, 8, bold, MUTE); y -= 13;
  for (const ln of wrap(amountInWords(doc.total), 90)) { text(ln, M, y, 9.5, bold); y -= 12; }

  // Footer
  const fy = 70;
  hline(fy + 14);
  text('This is a computer-generated invoice and does not require a signature.', M, fy, 8, font, MUTE);
  text(`Registered: ${doc.supplier.address}`, M, fy - 12, 7.5, font, MUTE);
  right(`For ${doc.supplier.name}`, colR, fy, 8.5, bold);

  return await pdf.save();
}

// Naive width-agnostic word wrap by character count (Helvetica ~ fine at these sizes).
function wrap(s: string, max: number): string[] {
  const words = String(s || '').split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { if (cur) out.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}
