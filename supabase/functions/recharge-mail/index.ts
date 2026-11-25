// SUPABASE EDGE FUNCTION: recharge-mail
// After a customer submits a recharge request, the screenshot is cross-checked by AI (amount, payee UPI, UTR, time, status, duplicate UTR);
// only if everything matches it is forwarded to the shop (RECHARGE_MAIL_TO) the details + payment screenshot.
// Only the request's own owner (from their JWT) can trigger it.
// Deploy:  supabase functions deploy recharge-mail
// Secrets: same SMTP_* / MAIL_FROM as send-email, ANTHROPIC_API_KEY (as ai-chat); optional SHOP_UPI_ID, SHOP_UPI_NAME, PAYMENT_MAX_AGE_MIN (default 60); optional RECHARGE_MAIL_TO (default smmobiledealss@gmail.com)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SMTP_HOST = Deno.env.get('SMTP_HOST'), SMTP_PORT = Number(Deno.env.get('SMTP_PORT') || '465');
const SMTP_USER = Deno.env.get('SMTP_USER'), SMTP_PASS = Deno.env.get('SMTP_PASS');
const MAIL_FROM = Deno.env.get('MAIL_FROM') || SMTP_USER || '';
const TO = Deno.env.get('RECHARGE_MAIL_TO') || 'smmobiledealss@gmail.com';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SHOP_UPI = (Deno.env.get('SHOP_UPI_ID') || 'sridharss400@okaxis').toLowerCase();
const SHOP_NAME = Deno.env.get('SHOP_UPI_NAME') || 'SM Mobile Deals';
const MAX_AGE_MIN = Number(Deno.env.get('PAYMENT_MAX_AGE_MIN') || '60');
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { id } = await req.json();
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not signed in' }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: r } = await admin.from('recharge_requests').select('*').eq('id', String(id)).maybeSingle();
    if (!r || r.user_id !== user.id) return json({ error: 'Not found' }, 404);

    // ---- 1) AI cross-check of the payment screenshot ----
    const reasons: string[] = []; let utr: string | null = null; let report = '';
    if (!ANTHROPIC_API_KEY) return json({ error: 'AI verification not configured (ANTHROPIC_API_KEY missing)' }, 500);
    try {
      const imgRes = await fetch(r.screenshot_url);
      if (!imgRes.ok) throw new Error('screenshot not reachable');
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const mime = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
      const ai = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 500, messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: btoa(bin) } },
          { type: 'text', text: 'This should be a UPI payment success screenshot (GPay / PhonePe / Paytm / bank app). Read it and reply with ONLY JSON: {"is_payment_screenshot":bool,"status":"success|failed|pending|unknown","amount":number|null,"payee_upi":string|null,"payee_name":string|null,"utr":string|null,"paid_at":"ISO-8601 with +05:30 if readable else null","looks_edited":bool,"note":string}. Do not guess values you cannot read.' }
        ] }] }) });
      const aj = await ai.json();
      const txt = (aj.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
      const x = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
      utr = x.utr ? String(x.utr).replace(/\s/g, '') : null;
      if (!x.is_payment_screenshot) reasons.push('Not a payment screenshot');
      if (x.status !== 'success') reasons.push('Payment status is not "success" (' + x.status + ')');
      if (Number(x.amount) !== Number(r.amount)) reasons.push(`Amount mismatch (screenshot ₹${x.amount ?? '?'}, expected ₹${r.amount})`);
      const payeeOk = (x.payee_upi && String(x.payee_upi).toLowerCase() === SHOP_UPI) || (x.payee_name && String(x.payee_name).toLowerCase().includes(SHOP_NAME.toLowerCase().split(' ')[0]));
      if (!payeeOk) reasons.push(`Paid to a different account (${x.payee_upi || x.payee_name || 'unreadable'}), expected ${SHOP_UPI}`);
      if (!utr || utr.length < 8) reasons.push('UTR / transaction ID not readable');
      if (x.paid_at) { const mins = (Date.now() - new Date(x.paid_at).getTime()) / 60000; if (isNaN(mins) || mins > MAX_AGE_MIN || mins < -10) reasons.push(`Payment time is not recent (${x.paid_at})`); }
      else reasons.push('Payment date/time not readable');
      if (x.looks_edited) reasons.push('Screenshot looks edited');
      if (utr) { const { data: dup } = await admin.from('recharge_requests').select('id').eq('utr', utr).eq('ai_status', 'verified').neq('id', r.id).maybeSingle(); if (dup) reasons.push('This UTR was already used for another request'); }
      report = `Amount ₹${x.amount} · Payee ${x.payee_upi || x.payee_name} · UTR ${utr} · Time ${x.paid_at} · Status ${x.status}` + (x.note ? ' · ' + x.note : '');
    } catch (e) { reasons.push('Could not read the screenshot (' + String((e as Error).message) + ')'); }

    if (reasons.length) {
      await admin.from('recharge_requests').update({ ai_status: 'failed', ai_notes: reasons.join(' | '), updated_at: new Date().toISOString() }).eq('id', r.id);
      return json({ ok: false, verified: false, reasons });
    }
    await admin.from('recharge_requests').update({ ai_status: 'verified', ai_notes: report, utr, updated_at: new Date().toISOString() }).eq('id', r.id);

    // ---- 2) Verified -> forward to the shop with the screenshot ----
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return json({ error: 'SMTP not configured' }, 500);

    const html = `<div style="font-family:Arial,sans-serif;max-width:520px"><h2>New ${esc(r.type)} recharge request</h2>
      <p><b>Request:</b> ${esc(r.id)}<br><b>Mobile:</b> ${esc(r.mobile)}<br><b>Operator:</b> ${esc(r.operator)} (${esc(r.circle)})<br>
      <b>Amount paid:</b> ₹${esc(r.amount)}<br><b>Plan:</b> ${esc(r.plan || '-')}<br>
      <b>Customer:</b> ${esc(r.user_name)} (${esc(r.user_email)})</p>
      <p style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:10px"><b>✅ AI-verified screenshot</b><br>${esc(report)}</p><p><a href="${esc(r.screenshot_url)}">Open payment screenshot</a></p><p style="font-size:12px;color:#6b7280">AI check can miss edited images — confirm the credit in your UPI app / bank before recharging.</p>
      <p>Verify the payment, then Accept and recharge from Admin → Recharge requests.</p></div>`;
    const attachments: any[] = [];
    try {
      if (r.screenshot_url && r.screenshot_url.startsWith('http')) {
        const f = await fetch(r.screenshot_url); const buf = new Uint8Array(await f.arrayBuffer());
        if (buf.length < 5_000_000) attachments.push({ filename: `${r.id}.jpg`, content: buf, contentType: f.headers.get('content-type') || 'image/jpeg', encoding: 'binary' });
      }
    } catch (_) { /* link is still in the mail */ }
    const client = new SMTPClient({ connection: { hostname: SMTP_HOST, port: SMTP_PORT, tls: SMTP_PORT === 465, auth: { username: SMTP_USER, password: SMTP_PASS } } });
    await client.send({ from: MAIL_FROM, to: TO, subject: `Recharge request ₹${r.amount} · ${r.operator} ${r.mobile}`, content: 'New recharge request', html, attachments });
    await client.close();
    return json({ ok: true, verified: true });
  } catch (e) { return json({ error: String((e as Error).message || e) }, 500); }
});
