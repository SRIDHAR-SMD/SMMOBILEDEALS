// ==========================================================================
// SUPABASE EDGE FUNCTION: send-email
// Sends the two automatic customer emails:
//   kind = 'welcome'     -> once, right after the account is created (OTP verified)
//   kind = 'login_alert' -> every time the customer logs in successfully
// The recipient is ALWAYS the signed-in user's own email (read from their JWT),
// never something the browser sends, so this can't be abused to spam others.
// Every attempt is written to the email_log table (admin panel -> Email Log).
//
// Deploy:   supabase functions deploy send-email
// Secrets (SMTP — e.g. a Gmail App Password, Brevo, Zoho, Resend SMTP):
//   supabase secrets set SMTP_HOST=smtp.gmail.com SMTP_PORT=465 \
//     SMTP_USER=yourshop@gmail.com SMTP_PASS=your-app-password \
//     MAIL_FROM="SM Mobile Deals <yourshop@gmail.com>"
// ==========================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SMTP_HOST = Deno.env.get('SMTP_HOST');
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') || '465');
const SMTP_USER = Deno.env.get('SMTP_USER');
const SMTP_PASS = Deno.env.get('SMTP_PASS');
const MAIL_FROM = Deno.env.get('MAIL_FROM') || SMTP_USER || '';
const SHOP = 'SM Mobile Deals';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function layout(title: string, body: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#0b1020;color:#fff;padding:18px 24px;font-size:18px;font-weight:700">${SHOP}</div>
  <div style="padding:24px;color:#111827;font-size:14.5px;line-height:1.6"><h2 style="margin:0 0 12px;font-size:18px">${title}</h2>${body}</div>
  <div style="background:#f9fafb;color:#6b7280;padding:12px 24px;font-size:12px">${SHOP}, Coimbatore · This is an automatic email.</div></div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { kind } = await req.json();
    if (kind !== 'welcome' && kind !== 'login_alert') return json({ error: 'Invalid kind' }, 400);

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user || !user.email) return json({ error: 'Not signed in' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profile } = await admin.from('profiles').select('name,login_count').eq('id', user.id).maybeSingle();
    const name = esc(profile?.name || 'Customer');

    if (kind === 'welcome') {
      const { data: prev } = await admin.from('email_log').select('id').eq('user_id', user.id).eq('kind', 'welcome').eq('status', 'sent').limit(1);
      if (prev && prev.length) return json({ ok: true, skipped: 'already sent' });
    } else {
      await admin.from('profiles').update({ last_login_at: new Date().toISOString(), login_count: (profile?.login_count || 0) + 1 }).eq('id', user.id);
    }

    const when = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    const subject = kind === 'welcome' ? `Welcome to ${SHOP}!` : `Login successful — ${SHOP}`;
    const html = kind === 'welcome'
      ? layout(`Welcome, ${name}! 🎉`, `<p>Your ${SHOP} account has been created successfully.</p>
          <p>Browse the latest mobiles, laptops, watches and accessories, track your orders and save your wishlist — all in one place.</p>
          <p>Delivery within Coimbatore district: next day with Cash on Delivery.</p><p>Happy shopping!</p>`)
      : layout('You just logged in', `<p>Hi ${name},</p><p>You logged in to your ${SHOP} account on <b>${when} (IST)</b>.</p>
          <p style="color:#2555c4">If this was not you, please reset your password immediately using “Forgot password?” on the login page.</p>`);

    let status = 'sent', errMsg: string | null = null;
    try {
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error('SMTP is not configured (missing SMTP_* secrets)');
      const client = new SMTPClient({ connection: { hostname: SMTP_HOST, port: SMTP_PORT, tls: SMTP_PORT === 465, auth: { username: SMTP_USER, password: SMTP_PASS } } });
      await client.send({ from: MAIL_FROM, to: user.email, subject, content: 'auto', html });
      await client.close();
    } catch (e) {
      status = 'failed'; errMsg = String((e as Error).message || e).slice(0, 300);
    }
    await admin.from('email_log').insert({ user_id: user.id, email: user.email, kind, status, error: errMsg });
    return json(status === 'sent' ? { ok: true } : { ok: false, error: errMsg }, status === 'sent' ? 200 : 502);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
