// Edge Function: render a GST tax-invoice PDF for one invoice.
// Deploy:  supabase functions deploy invoice-pdf
// Auth: caller must be an owner/HR admin of the org the invoice belongs to.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildInvoicePdf, type InvoiceDoc } from '../_shared/invoice-pdf.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPPLIER = {
  name: 'CATaskKit',
  gstin: '27FLWPS2525A1ZT',
  address: 'Opp. to Lotus Court, Kharadi, Pune, Maharashtra, India – 411001',
  state: 'Maharashtra',
  email: 'info@cataskkit.com',
  phone: '+91 70282 79090',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const { invoice_id } = await req.json().catch(() => ({}));
    if (!invoice_id) return json({ error: 'Missing invoice_id' }, 400);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);
    const { data: profile } = await userClient.from('profiles').select('org_id, role').eq('id', user.id).single();
    if (!profile?.org_id || !['owner', 'hr'].includes(profile.role)) return json({ error: 'Only an owner or HR admin can view invoices' }, 403);

    const admin = createClient(url, service);
    const { data: inv } = await admin.from('invoices').select('*').eq('id', invoice_id).single();
    if (!inv || inv.org_id !== profile.org_id) return json({ error: 'Invoice not found' }, 404);

    let description = 'Attendly — annual subscription';
    if (inv.payment_id) {
      const { data: pay } = await admin.from('billing_payments').select('seats, period_end').eq('payment_id', inv.payment_id).single();
      if (pay?.seats) {
        const till = pay.period_end ? new Date(pay.period_end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        description = `Attendly — annual subscription (${pay.seats} seats)${till ? ` · valid till ${till}` : ''}`;
      }
    }

    const doc: InvoiceDoc = {
      invoice_no: inv.invoice_no,
      invoice_date: inv.invoice_date,
      supplier: { name: inv.supplier_name || SUPPLIER.name, gstin: inv.supplier_gstin || SUPPLIER.gstin, address: inv.supplier_address || SUPPLIER.address, state: inv.supplier_state || SUPPLIER.state, email: SUPPLIER.email, phone: SUPPLIER.phone },
      customer: { name: inv.customer_name, gstin: inv.customer_gstin, state: inv.customer_state, address: inv.customer_address },
      sac_code: inv.sac_code,
      description,
      taxable_value: Number(inv.taxable_value),
      cgst: Number(inv.cgst),
      sgst: Number(inv.sgst),
      igst: Number(inv.igst),
      total: Number(inv.total),
      place_of_supply: inv.place_of_supply,
    };

    const bytes = await buildInvoicePdf(doc);
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${doc.invoice_no.replace(/\//g, '-')}.pdf"` },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'invoice render failed' }, 400);
  }
});
