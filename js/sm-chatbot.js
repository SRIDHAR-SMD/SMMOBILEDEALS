/*
 * SM Mobile Deals - Chat Assistant (admin + customer)
 * Drop-in file. Add before </body>:  <script src="sm-chatbot.js"></script>
 * Remove the old chatbot script/markup first.
 *
 * Edit the CONFIG block below to match your Supabase table / column names.
 * IMPORTANT: admin data is protected by the role check here AND must also be
 * protected by Supabase RLS policies (see notes at the bottom of this file).
 */
(function () {
  'use strict';

  // ===================== CONFIG (edit these) =====================
  const CONFIG = {
    // Your existing Supabase client variable on the page:
    getClient: () => window.supabaseClient || window.supabase_client || window.sb || window.db,
    adminRoles: ['admin', 'staff'],
    paidValues: ['paid', 'confirmed', 'success'],
    pendingValues: ['pending'],
    lowStockAt: 5,
    shopName: 'SM Mobile Deals',
    t: {
      orders: 'orders',
      products: 'products',
      service: 'service_appointments',
      refunds: 'refunds',
      messages: 'customer_messages',
      profiles: 'profiles'
    },
    c: {
      userId: 'user_id', created: 'created_at',
      orderStatus: 'status', orderTotal: 'total', orderPay: 'payment_status',
      pName: 'name', pPrice: 'price', pStock: 'stock', pCategory: 'category', pCondition: 'condition',
      sService: 'service_type', sStatus: 'status', sDate: 'appointment_date',
      rStatus: 'status', rAmount: 'amount',
      mText: 'message', mName: 'name',
      role: 'role'
    }
  };
  // ===============================================================

  const C = CONFIG.c, T = CONFIG.t;
  const state = { role: 'guest', user: null, open: false };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const money = n => '\u20B9' + Number(n || 0).toLocaleString('en-IN');
  const when = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-';
  const isAdmin = () => CONFIG.adminRoles.includes(state.role);

  // ---------- styles ----------
  const css = `
  #smc-fab{position:fixed;right:24px;bottom:24px;width:60px;height:60px;border-radius:50%;border:1px solid #3a4152;background:#1b1f2a;color:#fff;font-size:26px;cursor:pointer;z-index:99998;box-shadow:0 6px 20px rgba(0,0,0,.35)}
  #smc-fab:focus-visible,#smc-panel button:focus-visible,#smc-input:focus-visible{outline:2px solid #60a5fa;outline-offset:2px}
  #smc-panel{position:fixed;right:24px;bottom:96px;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);display:none;flex-direction:column;background:#14171f;color:#f3f4f6;border-radius:18px;overflow:hidden;z-index:99999;box-shadow:0 12px 40px rgba(0,0,0,.45);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  #smc-panel.open{display:flex}
  .smc-head{padding:16px 18px 12px;display:flex;justify-content:space-between;align-items:flex-start}
  .smc-head h3{margin:0;font-size:17px;color:#fff}
  .smc-head p{margin:2px 0 0;font-size:12.5px;color:#b6bdcc}
  .smc-x{background:#2a3040;color:#fff;border:0;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:16px}
  /* tab strip: dark text on light surface (fixes the faded text) */
  .smc-tabs{background:#f3f4f8;padding:10px 12px 8px}
  .smc-tabrow{display:flex;gap:8px}
  .smc-tab{flex:1;padding:9px 10px;border-radius:999px;border:1px solid #cfd4e0;background:#fff;color:#1f2430;font-weight:600;font-size:13.5px;cursor:pointer}
  .smc-tab.active{background:#2563eb;border-color:#2563eb;color:#fff}
  .smc-hint{margin:8px 2px 0;font-size:12px;line-height:1.4;color:#374151}
  .smc-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
  .smc-msg{max-width:88%;padding:10px 12px;border-radius:14px;font-size:14px;line-height:1.45;word-wrap:break-word}
  .smc-bot{background:#222836;color:#f3f4f6;align-self:flex-start;border-bottom-left-radius:4px}
  .smc-me{background:#2563eb;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
  .smc-line{padding:6px 0;border-bottom:1px solid #343c50}
  .smc-line:last-child{border-bottom:0}
  .smc-line b{color:#fff}.smc-line small{color:#b6bdcc;display:block}
  .smc-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
  .smc-chip{background:#1b1f2a;color:#f3f4f6;border:1px solid #3a4152;border-radius:999px;padding:7px 12px;font-size:13px;cursor:pointer}
  .smc-chip:hover{background:#2a3040}
  .smc-chip.admin{border-color:#f59e0b;color:#fcd34d}
  .smc-foot{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #2a3040;background:#14171f}
  #smc-input{flex:1;background:#1b1f2a;color:#fff;border:1px solid #3a4152;border-radius:999px;padding:10px 14px;font-size:14px}
  #smc-input::placeholder{color:#9aa3b5}
  .smc-send{background:#2563eb;color:#fff;border:0;border-radius:50%;width:40px;height:40px;cursor:pointer;font-size:16px}
  @media (prefers-reduced-motion:no-preference){#smc-panel.open{animation:smcIn .18s ease-out}@keyframes smcIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // ---------- markup ----------
  const root = document.createElement('div');
  root.innerHTML = `
    <button id="smc-fab" aria-label="Open chat assistant">\uD83C\uDFA7</button>
    <section id="smc-panel" role="dialog" aria-label="${esc(CONFIG.shopName)} assistant">
      <div class="smc-head"><div><h3>${esc(CONFIG.shopName)} Assistant</h3><p id="smc-sub">Ask me anything, we reply instantly</p></div>
        <button class="smc-x" aria-label="Close chat">\u2715</button></div>
      <div class="smc-tabs">
        <div class="smc-tabrow">
          <button class="smc-tab active" data-tab="ai">AI Assistant</button>
          <button class="smc-tab" data-tab="admin">Talk to Admin</button>
        </div>
        <p class="smc-hint" id="smc-hint">AI Assistant answers instantly. To reach the admin, tap "Talk to Admin".</p>
      </div>
      <div class="smc-body" id="smc-body"></div>
      <div class="smc-foot">
        <input id="smc-input" type="text" placeholder="Ask about a product, order, price..." autocomplete="off">
        <button class="smc-send" aria-label="Send">\u27A4</button>
      </div>
    </section>`;
  document.body.appendChild(root);

  const panel = root.querySelector('#smc-panel'), body = root.querySelector('#smc-body'),
        input = root.querySelector('#smc-input'), hint = root.querySelector('#smc-hint');

  // ---------- UI helpers ----------
  function addMsg(html, who) {
    const d = document.createElement('div');
    d.className = 'smc-msg ' + (who === 'me' ? 'smc-me' : 'smc-bot');
    d.innerHTML = html;
    body.appendChild(d); body.scrollTop = body.scrollHeight; return d;
  }
  const lines = rows => rows.map(r => `<div class="smc-line"><b>${r[0]}</b>${r[1] ? `<small>${r[1]}</small>` : ''}</div>`).join('');

  function chipsFor() {
    const base = [
      ['Phones', 'phones'], ['Laptops', 'laptops'], ['Second-hand phones', 'used phones'],
      ['Second-hand laptops', 'used laptops'], ['Track my order', 'track'],
      ['My service status', 'service'], ['Payment options', 'payment']
    ];
    const admin = [
      ['Orders', 'orders'], ["Today's sales", 'sales'], ['Pending payments', 'pending'],
      ['Service appointments', 'service'], ['Refunds', 'refunds'], ['Customer messages', 'messages'], ['Low stock', 'stock']
    ];
    return { base, admin: isAdmin() ? admin : [] };
  }
  function showWelcome() {
    body.innerHTML = '';
    const who = isAdmin() ? 'Admin mode is on. You can see orders, sales, payments, service and stock.' : 'Ask me about products, prices, delivery, payment or tracking your order.';
    const m = addMsg('Hi! \uD83D\uDC4B I\'m the ' + esc(CONFIG.shopName) + ' assistant. ' + who);
    const { base, admin } = chipsFor();
    const wrap = document.createElement('div'); wrap.className = 'smc-chips';
    [...admin.map(a => a.concat('admin')), ...base].forEach(([label, cmd, cls]) => {
      const b = document.createElement('button'); b.className = 'smc-chip ' + (cls || ''); b.textContent = label;
      b.onclick = () => ask(cmd, label); wrap.appendChild(b);
    });
    m.appendChild(wrap);
  }

  // ---------- data ----------
  const client = () => CONFIG.getClient();
  async function run(promise) {
    try { const { data, error } = await promise; if (error) throw error; return data || []; }
    catch (e) { console.error('[chat]', e); return null; }
  }
  const fail = () => addMsg('I couldn\'t load that right now. Please try again, or tap "Talk to Admin".');

  async function loadRole() {
    const sb = client(); if (!sb) return;
    try {
      const { data } = await sb.auth.getUser();
      state.user = data && data.user;
      if (!state.user) return;
      state.role = 'customer';
      const { data: p } = await sb.from(T.profiles).select(C.role).eq('id', state.user.id).maybeSingle();
      if (p && p[C.role]) state.role = String(p[C.role]).toLowerCase();
    } catch (e) { console.error('[chat] role', e); }
  }

  // ---------- actions ----------
  const productQ = (cat, used) => {
    let q = client().from(T.products).select('*').ilike(C.pCategory, '%' + cat + '%');
    q = used ? q.ilike(C.pCondition, '%used%') : q.not(C.pCondition, 'ilike', '%used%');
    return q.order(C.pPrice, { ascending: true }).limit(8);
  };
  async function showProducts(rows, title) {
    if (rows === null) return fail();
    if (!rows.length) return addMsg('No ' + esc(title) + ' found right now.');
    addMsg('<b>' + esc(title) + '</b>' + lines(rows.map(p => [
      esc(p[C.pName]), money(p[C.pPrice]) + (isAdmin() && p[C.pStock] != null ? ' \u2022 stock ' + esc(p[C.pStock]) : '')
    ])));
  }

  const actions = {
    phones: async () => showProducts(await run(productQ('phone', false)), 'Phones'),
    laptops: async () => showProducts(await run(productQ('laptop', false)), 'Laptops'),
    'used phones': async () => showProducts(await run(productQ('phone', true)), 'Second-hand phones'),
    'used laptops': async () => showProducts(await run(productQ('laptop', true)), 'Second-hand laptops'),
    payment: async () => addMsg('We accept UPI, cards, net banking and wallet. For EMI or cash on delivery, tap "Talk to Admin".'),
    track: async (arg) => {
      if (!state.user) return addMsg('Please log in to track your orders.');
      let q = client().from(T.orders).select('*').order(C.created, { ascending: false }).limit(5);
      if (!isAdmin()) q = q.eq(C.userId, state.user.id);   // customers: own orders only
      if (arg) q = q.eq('id', arg);
      const rows = await run(q);
      if (rows === null) return fail();
      if (!rows.length) return addMsg('No orders found.' + (arg ? ' Check the order ID and try again.' : ''));
      addMsg('<b>' + (isAdmin() ? 'Latest orders' : 'Your orders') + '</b>' + lines(rows.map(o => [
        '#' + esc(o.id) + ' \u2022 ' + money(o[C.orderTotal]), esc(o[C.orderStatus]) + ' \u2022 ' + when(o[C.created])
      ])));
    },
    service: async () => {
      if (!state.user) return addMsg('Please log in to see service appointments.');
      let q = client().from(T.service).select('*').order(C.created, { ascending: false }).limit(10);
      if (!isAdmin()) q = q.eq(C.userId, state.user.id);
      const rows = await run(q);
      if (rows === null) return fail();
      if (!rows.length) return addMsg('No service appointments found.');
      addMsg('<b>Service</b>' + lines(rows.map(s => [esc(s[C.sService]), esc(s[C.sStatus]) + ' \u2022 ' + when(s[C.sDate] || s[C.created])])));
    }
  };

  // admin-only actions (blocked in UI and must be blocked by RLS too)
  const adminActions = {
    orders: async () => actions.track(),
    sales: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const rows = await run(client().from(T.orders).select('*').gte(C.created, start.toISOString()));
      if (rows === null) return fail();
      const paid = rows.filter(o => CONFIG.paidValues.includes(String(o[C.orderPay]).toLowerCase()));
      const sum = paid.reduce((a, o) => a + Number(o[C.orderTotal] || 0), 0);
      addMsg('<b>Today</b>' + lines([['Orders: ' + rows.length, ''], ['Paid sales: ' + money(sum), paid.length + ' paid orders']]));
    },
    pending: async () => {
      const rows = await run(client().from(T.orders).select('*').in(C.orderPay, CONFIG.pendingValues).order(C.created, { ascending: false }).limit(10));
      if (rows === null) return fail();
      addMsg(rows.length ? '<b>Pending payments</b>' + lines(rows.map(o => ['#' + esc(o.id) + ' \u2022 ' + money(o[C.orderTotal]), when(o[C.created])])) : 'No pending payments.');
    },
    refunds: async () => {
      const rows = await run(client().from(T.refunds).select('*').order(C.created, { ascending: false }).limit(10));
      if (rows === null) return fail();
      addMsg(rows.length ? '<b>Refunds</b>' + lines(rows.map(r => [money(r[C.rAmount]), esc(r[C.rStatus]) + ' \u2022 ' + when(r[C.created])])) : 'No refund requests.');
    },
    messages: async () => {
      const rows = await run(client().from(T.messages).select('*').order(C.created, { ascending: false }).limit(8));
      if (rows === null) return fail();
      addMsg(rows.length ? '<b>Customer messages</b>' + lines(rows.map(m => [esc(m[C.mName] || 'Customer'), esc(String(m[C.mText] || '').slice(0, 90))])) : 'No messages.');
    },
    stock: async () => {
      const rows = await run(client().from(T.products).select('*').lte(C.pStock, CONFIG.lowStockAt).order(C.pStock, { ascending: true }).limit(10));
      if (rows === null) return fail();
      addMsg(rows.length ? '<b>Low stock</b>' + lines(rows.map(p => [esc(p[C.pName]), 'Stock: ' + esc(p[C.pStock])])) : 'Nothing is low on stock.');
    }
  };

  // ---------- routing ----------
  async function ask(text, label) {
    text = String(text || '').trim(); if (!text) return;
    addMsg(esc(label || text), 'me');
    const t = text.toLowerCase();

    const idMatch = t.match(/(?:order|track)\s*#?\s*([a-z0-9-]{3,})/i);
    if (idMatch && !['my', 'status'].includes(idMatch[1])) return actions.track(idMatch[1]);

    const adminKeys = [['sales', /sale|revenue|today/], ['pending', /pending/], ['refunds', /refund/],
      ['messages', /message/], ['stock', /stock|inventory/], ['orders', /^orders?$|all orders/]];
    for (const [key, re] of adminKeys) {
      if (re.test(t) && (key in adminActions)) {
        if (!isAdmin()) return addMsg('That information is only available to the admin.');
        return adminActions[key]();
      }
    }
    if (/used|second|pre-?owned/.test(t)) return /laptop/.test(t) ? actions['used laptops']() : actions['used phones']();
    if (/laptop/.test(t)) return actions.laptops();
    if (/phone|mobile/.test(t)) return actions.phones();
    if (/track|my order|order status/.test(t)) return actions.track();
    if (/service|repair/.test(t)) return actions.service();
    if (/pay|upi|emi|cod/.test(t)) return actions.payment();

    // fallback: product name search
    const rows = await run(client().from(T.products).select('*').ilike(C.pName, '%' + text.replace(/[%,]/g, '') + '%').limit(6));
    if (rows && rows.length) return showProducts(rows, 'Results');
    addMsg('I didn\'t find that. Try "phones", "laptops" or "track my order", or tap "Talk to Admin".');
  }

  // ---------- events ----------
  const open = v => { state.open = v; panel.classList.toggle('open', v); if (v) input.focus(); };
  root.querySelector('#smc-fab').onclick = () => open(!state.open);
  root.querySelector('.smc-x').onclick = () => open(false);
  root.querySelector('.smc-send').onclick = () => { const v = input.value; input.value = ''; ask(v); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { const v = input.value; input.value = ''; ask(v); } });
  root.querySelectorAll('.smc-tab').forEach(b => b.onclick = () => {
    root.querySelectorAll('.smc-tab').forEach(x => x.classList.toggle('active', x === b));
    if (b.dataset.tab === 'admin') {
      hint.textContent = 'Your message will be sent to the admin team.';
      window.dispatchEvent(new CustomEvent('sm-chat-talk-admin')); // hook your live-chat code here
    } else hint.textContent = 'AI Assistant answers instantly. To reach the admin, tap "Talk to Admin".';
  });

  loadRole().then(showWelcome);
  if (client() && client().auth && client().auth.onAuthStateChange)
    client().auth.onAuthStateChange(() => loadRole().then(showWelcome));
})();

/*
 * SUPABASE RLS (run in SQL editor) - this is what really protects admin data.
 * The role check in this file only hides buttons; the database must enforce it.
 *
 * create or replace function public.is_admin() returns boolean
 * language sql security definer set search_path = public as $$
 *   select exists (select 1 from profiles where id = auth.uid() and role in ('admin','staff'));
 * $$;
 *
 * alter table orders enable row level security;
 * create policy "customer reads own orders" on orders for select using (user_id = auth.uid());
 * create policy "admin reads all orders"    on orders for select using (is_admin());
 *
 * -- repeat the same pattern for service_appointments (own + admin),
 * -- and admin-only for refunds and customer_messages:
 * alter table refunds enable row level security;
 * create policy "admin only refunds" on refunds for select using (is_admin());
 *
 * -- products: everyone can read, only admin can write
 * alter table products enable row level security;
 * create policy "public read products" on products for select using (true);
 */
