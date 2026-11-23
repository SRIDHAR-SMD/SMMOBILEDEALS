// ==========================================================================
// SUPABASE EDGE FUNCTION: master-gateway   (backs the hidden /sri-login page)
//
//  Roles
//   admin  → email + password, then a 6-digit OTP emailed to OTP_TO
//   staff  → username + password (no OTP)
//
//  Everything is verified HERE, on the server. Credentials are never shipped
//  to the browser. Wrong attempts are logged (with IP + optional GPS) to
//  geo_log and throttled per IP.
//
//  Deploy:  supabase functions deploy master-gateway --no-verify-jwt
//  Secrets: see supabase/master-gateway.sql (bottom) for the exact commands.
// ==========================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const SB = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
const SECRET = env('MASTER_SECRET');
const A_EMAIL = env('MASTER_ADMIN_EMAIL').toLowerCase();
const A_PASS = env('MASTER_ADMIN_PASS');
const S_USER = env('MASTER_STAFF_USER').toLowerCase();
const S_PASS = env('MASTER_STAFF_PASS');
const OTP_TO = env('OTP_TO');
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hmac(msg: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
// constant-time compare on hashes
async function same(a: string, b: string) { const [x, y] = await Promise.all([sha(a), sha(b)]); let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i); return d === 0; }
async function makeToken(role: string) { const exp = Date.now() + 12 * 3600e3; const body = `${role}.${exp}`; return `${body}.${await hmac(body)}`; }
async function checkToken(t: string) {
  const [role, exp, sig] = String(t || '').split('.');
  if (!role || !exp || !sig || Number(exp) < Date.now()) return null;
  return (await hmac(`${role}.${exp}`)) === sig ? role : null;
}

async function logEvent(kind: string, req: Request, extra: Record<string, unknown> = {}) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  await SB.from('geo_log').insert({ kind, ip, ua: (req.headers.get('user-agent') || '').slice(0, 300), ...extra }).then(() => {}, () => {});
}
async function tooManyFails(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const since = new Date(Date.now() - 15 * 60e3).toISOString();
  const { count } = await SB.from('geo_log').select('id', { count: 'exact', head: true }).eq('kind', 'gateway_fail').eq('ip', ip).gte('created_at', since);
  return (count ?? 0) >= 8;
}

async function sendOtp(code: string) {
  const host = env('SMTP_HOST'), user = env('SMTP_USER'), pass = env('SMTP_PASS'), port = Number(env('SMTP_PORT', '465'));
  if (!host || !user || !pass || !OTP_TO) throw new Error('SMTP not configured');
  const c = new SMTPClient({ connection: { hostname: host, port, tls: port === 465, auth: { username: user, password: pass } } });
  await c.send({
    from: env('MAIL_FROM') || user, to: OTP_TO, subject: 'SM Mobile Deals — Admin login OTP', content: 'auto',
    html: `<div style="font-family:Arial;max-width:420px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px"><h3>Master Gateway — Admin 1</h3><p>Your one-time code (valid 5 minutes):</p><p style="font-size:32px;letter-spacing:6px;font-weight:700">${code}</p><p style="color:#2555c4;font-size:12px">If this wasn't you, someone knows the admin password — change it now.</p></div>`,
  });
  await c.close();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (!SECRET) return json({ error: 'Gateway not configured' }, 503);
    const b = await req.json();
    const geo = b.geo && typeof b.geo.lat === 'number' ? { lat: b.geo.lat, lng: b.geo.lng, accuracy: b.geo.accuracy ?? null, consent: true } : { consent: false };

    if (b.action === 'check') { const role = await checkToken(b.token); return json({ ok: !!role, role }); }

    if (await tooManyFails(req)) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);

    if (b.action === 'start_admin') {
      const ok = (await same(String(b.email || '').toLowerCase(), A_EMAIL)) && (await same(String(b.password || ''), A_PASS));
      if (!ok) { await sleep(700); await logEvent('gateway_fail', req, { user_email: String(b.email || '').slice(0, 80), note: 'admin bad credentials', ...geo }); return json({ error: 'Invalid credentials' }, 401); }
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
      const id = crypto.randomUUID();
      await SB.from('master_otps').insert({ id, otp_hash: await sha(id + code + SECRET), expires_at: new Date(Date.now() + 5 * 60e3).toISOString() });
      try { await sendOtp(code); } catch (e) { await SB.from('master_otps').delete().eq('id', id); return json({ error: 'Could not send OTP email: ' + (e as Error).message }, 502); }
      return json({ ok: true, challenge: id });
    }

    if (b.action === 'verify_admin') {
      const { data: row } = await SB.from('master_otps').select('*').eq('id', String(b.challenge || '')).maybeSingle();
      if (!row || row.used || new Date(row.expires_at) < new Date() || row.attempts >= 5) return json({ error: 'OTP expired. Start again.' }, 401);
      await SB.from('master_otps').update({ attempts: row.attempts + 1 }).eq('id', row.id);
      if ((await sha(row.id + String(b.otp || '').trim() + SECRET)) !== row.otp_hash) { await sleep(500); await logEvent('gateway_fail', req, { user_email: A_EMAIL, note: 'admin bad OTP', ...geo }); return json({ error: 'Wrong OTP' }, 401); }
      await SB.from('master_otps').update({ used: true }).eq('id', row.id);
      await logEvent('gateway_ok', req, { user_email: A_EMAIL, note: 'admin login', ...geo });
      return json({ ok: true, role: 'admin', token: await makeToken('admin') });
    }

    if (b.action === 'staff') {
      const ok = (await same(String(b.username || '').toLowerCase(), S_USER)) && (await same(String(b.password || ''), S_PASS));
      if (!ok) { await sleep(700); await logEvent('gateway_fail', req, { user_email: String(b.username || '').slice(0, 80), note: 'staff bad credentials', ...geo }); return json({ error: 'Invalid credentials' }, 401); }
      await logEvent('gateway_ok', req, { user_email: S_USER, note: 'staff login', ...geo });
      return json({ ok: true, role: 'staff', token: await makeToken('staff') });
    }
    return json({ error: 'Bad request' }, 400);
  } catch (e) { return json({ error: 'Server error' }, 500); }
});
