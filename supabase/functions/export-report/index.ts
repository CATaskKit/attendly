// Supabase Edge Function: server-side HR data export (.xlsx).
// Builds the workbook on the server, paginating reads so it scales to large
// datasets without loading everything into the browser. Reads run with the
// caller's JWT, so Row-Level Security scopes the export to their organization.
//
// Deploy:  supabase functions deploy export-report
// Invoke:  POST {SUPABASE_URL}/functions/v1/export-report  (Authorization: Bearer <user jwt>)
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SHEETS = [
  { name: 'Employees', table: 'employees', cols: 'code,name,dept,designation,manager,type,status,email,phone,joined' },
  { name: 'Leave Requests', table: 'leave_requests', cols: 'emp,code,dept,type,from_date,to_date,days,half,status,stage,reason,attachment,applied_at' },
  { name: 'Leave Balances', table: 'leave_balances', cols: 'code,name,type,allotted,used,pending' },
  { name: 'Departments', table: 'departments', cols: 'name,created_at' },
  { name: 'Attendance', table: 'attendance', cols: 'day,check_in_at,check_out_at,status,work_seconds,location' },
];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PAGE = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const authorization = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  );

  try {
    const wb = XLSX.utils.book_new();
    for (const sheet of SHEETS) {
      const rows: Record<string, unknown>[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from(sheet.table).select(sheet.cols).range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data?.length) break;
        rows.push(...data);
        if (data.length < PAGE) break;
      }
      const ws = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['No records']]);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
    }

    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true });
    return new Response(bytes, {
      headers: {
        ...cors,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Attendly_HR_Export.xlsx"',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'export failed' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
