// ==========================================================================
// SUPABASE EDGE FUNCTION: sms-otp  — phone OTP step for the ADMIN login
//   POST {action:'send'}            -> sends a 6-digit code to ADMIN_PHONE
//   POST {action:'verify', code}    -> checks it (5 tries, 5 min expiry)
// Only a signed-in user whose profile.role = 'admin' may call it. The phone number
// lives in a secret, never in the browser. Codes are stored hashed.
// If no SMS provider secret is set, it answers {ok:true, skipped:true} and the site skips the step.
//
// Deploy:  supabase functions deploy sms-otp
// Secrets: supabase secrets set ADMIN_PHONE=9XXXXXXXXX OTP_PEPPER=<long random text>
//   + Twilio : TWILIO_SID TWILIO_TOKEN TWILIO_FROM
//   or MSG91 : MSG91_AUTHKEY MSG91_TEMPLATE_ID
// ==========================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_PHONE = (Deno.env.get('ADMIN_PHONE') || '').replace(/\D/g, '');
const PEPPER = Deno.env.get('OTP_PEPPER') || SERVICE.slice(0, 32);
const TW = { sid: Deno.env.get('TWILIO_SID'), token: Deno.env.get('TWILIO_TOKEN'), from: Deno.env.get('TWILIO_FROM') };
const M91 = { key: Deno.env.get('MSG91_AUTHKEY'), tpl: Deno.env.get('MSG91_TEMPLATE_ID') };

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const msisdn = () => (ADMIN_PHONE.length === 10 ? '91' + ADMIN_PHONE : ADMIN_PHONE);
const masked = () => '+' + msisdn().slice(0, 2) + ' ******' + msisdn().slice(-4);
const hash = async (code: string, uid: string) => {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${code}:${uid}:${PEPPER}`));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
};
const safeEq = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

async function sendSms(code: string): Promise<boolean> {
  const text = `${code} is your SM Mobile Deals admin code. Valid 5 minutes. Do not share it.`;
  if (TW.sid && TW.token && TW.from) {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW.sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${TW.sid}:${TW.token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: '+' + msisdn(), From: TW.from, Body: text }),
    });
    return r.ok;
  }
  if (M91.key && M91.tpl) {
    const r = await fetch(`https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(M91.tpl)}&mobile=${msisdn()}&otp=${code}`, {
      method: 'POST', headers: { authkey: M91.key, 'Content-Type': 'application/json' }, body: '{}',
    });
    return r.ok;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
  try {
    const providerReady = !!ADMIN_PHONE && ((TW.sid && TW.token && TW.from) || (M91.key && M91.tpl));
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const userClient = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ ok: false, error: 'unauthorized' }, 401);

    const db = createClient(URL_, SERVICE);
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!prof || prof.role !== 'admin') return json({ ok: false, error: 'forbidden' }, 403);

    if (!providerReady) return json({ ok: true, skipped: true, error: 'sms_not_configured' });

    const body = await req.json().catch(() => ({}));

    if (body.action === 'send') {
      const since = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await db.from('admin_sms_otps').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since);
      if ((count ?? 0) >= 5) return json({ ok: false, error: 'rate_limited' }, 429);
      await db.from('admin_sms_otps').update({ used: true }).eq('user_id', user.id).eq('used', false);
      const n = new Uint32Array(1); crypto.getRandomValues(n);
      const code = String(n[0] % 1000000).padStart(6, '0');
      const { data: row, error } = await db.from('admin_sms_otps').insert({
        user_id: user.id, code_hash: await hash(code, user.id), expires_at: new Date(Date.now() + 300_000).toISOString(),
      }).select('id').single();
      if (error) return json({ ok: false, error: 'db' }, 500);
      if (!(await sendSms(code))) { await db.from('admin_sms_otps').delete().eq('id', row.id); return json({ ok: false, error: 'sms_failed' }, 502); }
      return json({ ok: true, masked: masked() });
    }

    if (body.action === 'verify') {
      const code = String(body.code || '').replace(/\D/g, '');
      if (code.length !== 6) return json({ ok: false, error: 'invalid' }, 400);
      const { data: row } = await db.from('admin_sms_otps').select('*').eq('user_id', user.id).eq('used', false)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!row) return json({ ok: false, error: 'expired' }, 400);
      if (new Date(row.expires_at).getTime() < Date.now()) return json({ ok: false, error: 'expired' }, 400);
      if (row.attempts >= 5) { await db.from('admin_sms_otps').update({ used: true }).eq('id', row.id); return json({ ok: false, error: 'too_many_attempts' }, 429); }
      if (!safeEq(await hash(code, user.id), row.code_hash)) {
        await db.from('admin_sms_otps').update({ attempts: row.attempts + 1 }).eq('id', row.id);
        return json({ ok: false, error: row.attempts + 1 >= 5 ? 'too_many_attempts' : 'wrong_code' }, row.attempts + 1 >= 5 ? 429 : 400);
      }
      await db.from('admin_sms_otps').update({ used: true }).eq('id', row.id);
      await db.from('admin_sms_verified').upsert({ user_id: user.id, verified_until: new Date(Date.now() + 12 * 3600_000).toISOString() });
      return json({ ok: true });
    }
    return json({ ok: false, error: 'bad_action' }, 400);
  } catch (_e) {
    return json({ ok: false, error: 'server' }, 500);
  }
});
