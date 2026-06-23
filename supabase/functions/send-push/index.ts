// Edge Function: deliver a real push notification (FCM HTTP v1) whenever a row
// is inserted into public.notifications.
//
// Wire it up as a Supabase Database Webhook:
//   Table: notifications  |  Events: INSERT  |  Type: Supabase Edge Function → send-push
//
// Deploy:  supabase functions deploy send-push
// Secrets: FIREBASE_SERVICE_ACCOUNT  (the full service-account JSON, as one secret value)
//          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

// --- Google OAuth: sign a JWT with the service-account key, exchange for a token.
function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const raw = atob(body);
  const der = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) der[i] = raw.charCodeAt(i);
  return der.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));
  const unsigned = `${header}.${claim}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`OAuth failed: ${JSON.stringify(body)}`);
  return body.access_token as string;
}

Deno.serve(async (req) => {
  try {
    const saRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!saRaw) return new Response('FIREBASE_SERVICE_ACCOUNT not set', { status: 500 });
    const sa = JSON.parse(saRaw) as ServiceAccount;

    // Supabase DB webhook payload: { type, table, record, old_record, ... }
    const payload = await req.json().catch(() => ({}));
    const record = payload?.record;
    if (!record?.user_id) return new Response('no user_id in record', { status: 200 });

    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, service);

    const { data: tokens } = await admin
      .from('device_tokens')
      .select('token')
      .eq('user_id', record.user_id);
    if (!tokens || tokens.length === 0) return new Response('no devices', { status: 200 });

    const accessToken = await getAccessToken(sa);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
    const title = record.title || 'Attendly';
    const bodyText = record.body || '';

    const results = await Promise.all(tokens.map(async ({ token }) => {
      const message = {
        message: {
          token,
          notification: { title, body: bodyText },
          android: { priority: 'HIGH', notification: { sound: 'default', channel_id: 'attendly_default' } },
          data: { type: String(record.type ?? ''), id: String(record.id ?? '') },
        },
      };
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (r.status === 404 || r.status === 400) {
        // Token is stale/invalid — prune it so we stop trying.
        await admin.from('device_tokens').delete().eq('token', token);
      }
      return r.status;
    }));

    return new Response(JSON.stringify({ sent: results }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(`error: ${e instanceof Error ? e.message : String(e)}`, { status: 500 });
  }
});
