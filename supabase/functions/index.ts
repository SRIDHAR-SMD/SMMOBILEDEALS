// SUPABASE EDGE FUNCTION: admin-alert
// Emails the shop admin when a customer places an order, submits an order payment,
// adds money to the wallet (top-up) or sends a wallet coins request.
// The email content is read from the DATABASE (not from the browser) and the record must belong to the
// signed-in caller, so nobody can use this to send random text to the admin.
// Deploy:  supabase functions deploy admin-alert
// Uses the same secrets as send-email (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM).
// Optional secret ADMIN_ALERT_TO (default: RECHARGE_MAIL_TO or smmobiledealss@gmail.com).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SMTP_HOST = Deno.env.get('SMTP_HOST'), SMTP_PORT = Number(Deno.env.get('SMTP_PORT') || '465');
const SMTP_USER = Deno.env.get('SMTP_USER'), SMTP_PASS = Deno.env.get('SMTP_PASS');
const MAIL_FROM = Deno.env.get('MAIL_FROM') || SMTP_USER || '';
const TO = Deno.env.get('ADMIN_ALERT_TO') || Deno.env.get('RECHARGE_MAIL_TO') || 'smmobiledealss@gmail.com';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { kind, id } = await req.json();
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not signed in' }, 401);
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    let key = '', subject = '', title = '', rows: [string, string][] = [];
    if (kind === 'order') {
      const { data: o } = await db.from('orders').select('*').eq('id', String(id)).maybeSingle();
      if (!o || o.user_id !== user.id) return json({ error: 'Not found' }, 404);
      const t = o.totals || {}, a = o.address || {};
      const items = (Array.isArray(o.items) ? o.items : []).map((i: any) => `${i.name} x${i.qty || 1}`).join(', ');
      key = `order:${o.id}:${o.payment_status}`;
      title = o.payment_status === 'pending_confirmation' ? 'Order payment submitted - please verify' : 'New order received';
      subject = `${title}: ${o.id} · ₹${t.total ?? ''} · ${o.payment_method}`;
      rows = [['Order', o.id], ['Total', '₹' + (t.total ?? '')], ['Payment', `${o.payment_method} · ${o.payment_status}`],
        ['Customer', `${a.name || ''} · ${a.phone || ''}`], ['Email', user.email || ''],
        ['Address', [a.line1, a.city, a.state, a.pincode].filter(Boolean).join(', ')], ['Items', items]];
      if (String(o.screenshot_url || '').startsWith('http')) rows.push(['Payment screenshot', o.screenshot_url]);
    } else if (kind === 'topup') {
      const { data: t } = await db.from('wallet_topups').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!t) return json({ error: 'Not found' }, 404);
      key = `topup:${t.id}`; title = 'Wallet top-up waiting for approval';
      subject = `Wallet top-up ₹${t.amount} - approve needed`;
      rows = [['Amount', `₹${t.amount} = ${t.amount} coins`], ['Customer', t.user_email || user.email || ''], ['UTR', t.utr],
        ['Next step', 'Check the payment in your bank / UPI app, then approve in Admin > Wallet Requests (or reply YES in the admin chatbot).']];
    } else if (kind === 'wallet_request') {
      const { data: r } = await db.from('wallet_requests').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!r) return json({ error: 'Not found' }, 404);
      const d = r.details || {};
      key = `wreq:${r.id}`; title = r.kind === 'recharge' ? 'Coins recharge request' : 'Coins mobile purchase request';
      subject = `${title}: ${r.coins} coins`;
      rows = [['Coins used', String(r.coins)], ['Customer', r.user_email || user.email || ''],
        r.kind === 'recharge' ? ['Recharge', `${d.mobile || ''} · ${d.operator || ''}`] : ['Product', `${d.product || ''} ${d.note ? '(' + d.note + ')' : ''}`],
        ['Next step', 'Do it, then press Done in Admin > Wallet Requests. Reject refunds the coins.']];
    } else return json({ error: 'Invalid kind' }, 400);

    const { error: dup } = await db.from('admin_alert_log').insert({ key });
    if (dup) return json({ sent: false, duplicate: true });
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) { await db.from('admin_alert_log').delete().eq('key', key); return json({ error: 'SMTP not configured' }, 500); }

    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:#0b1020;color:#fff;padding:16px 22px;font-size:17px;font-weight:700">SM Mobile Deals - Admin alert</div>
      <div style="padding:22px;color:#111827;font-size:14.5px;line-height:1.6"><h2 style="margin:0 0 12px;font-size:18px">${esc(title)}</h2>
      <table style="width:100%;border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:6px 8px;color:#6b7280;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 8px;font-weight:600">${esc(v)}</td></tr>`).join('')}</table></div>
      <div style="background:#f9fafb;color:#6b7280;padding:10px 22px;font-size:12px">Automatic email from your shop website.</div></div>`;
    try {
      const client = new SMTPClient({ connection: { hostname: SMTP_HOST, port: SMTP_PORT, tls: SMTP_PORT === 465, auth: { username: SMTP_USER, password: SMTP_PASS } } });
      await client.send({ from: MAIL_FROM, to: TO, subject, content: title, html });
      await client.close();
    } catch (e) { await db.from('admin_alert_log').delete().eq('key', key); return json({ error: 'Mail failed: ' + (e as Error).message }, 500); }
    return json({ sent: true });
  } catch (e) { return json({ error: (e as Error).message }, 500); }
});
