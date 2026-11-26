/* ==========================================================================
   AUTH — Supabase Auth when configured, otherwise a demo-grade local
   fallback (localStorage, simple hash — not cryptographically secure,
   fine for offline demos only).

   DESIGN: like DB, reads stay synchronous (Auth.currentUser() etc. read a
   cached session object). Auth.init() is the async call that establishes
   that cache on page load; register/login/logout/updateProfile are async
   because they may need to reach Supabase.
   ========================================================================== */

const Auth = (() => {

  function simpleHash(str){
    let h = 0;
    for (let i = 0; i < str.length; i++){ h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return 'h' + Math.abs(h).toString(36);
  }

  function useSupabase(){ return DB.useSupabase(); }

  /* ---- phone helpers: customers log in with PHONE (or email) ---- */
  function normPhone(v){ const d = String(v||'').replace(/\D/g,''); return d.length > 10 ? d.slice(-10) : d; }
  function validPhone(v){ return /^[6-9]\d{9}$/.test(normPhone(v)); }
  function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v||'').trim()); }
  // identifier = phone number OR email -> the account's email (needed by Supabase Auth)
  async function resolveEmail(identifier){
    const id = String(identifier||'').trim();
    if (id.includes('@')) return { ok:true, email:id };
    if (!validPhone(id)) return { ok:false, error:'Enter your 10-digit phone number or your email.' };
    const ph = normPhone(id);
    if (useSupabase()){
      const { data, error } = await supabaseClient.rpc('login_email_for_phone', { p_phone: ph });
      if (error) return { ok:false, error:'Phone login is not set up on the server yet (run supabase/phone-login.sql). Use your email for now.' };
      if (!data) return { ok:false, error:'No account found with this phone number.' };
      return { ok:true, email:data };
    }
    const u = DB.getUsers().find(x => normPhone(x.phone) === ph);
    return u ? { ok:true, email:u.email } : { ok:false, error:'No account found with this phone number.' };
  }

  // Never let a slow/hung Supabase call freeze a page.
  function withTimeout(promise, ms, fallback){
    return Promise.race([promise, new Promise(res => setTimeout(res, ms, fallback))]);
  }
  // A "panel" session that has no real Supabase login (hidden Master Gateway only).
  function isGatewaySession(u){
    return !!u && (u.id === 'admin' || u.id === 'staff') && !!DB.read('smd_master_token', null);
  }

  /* ---- built-in TEST account (works on plain localhost AND with Supabase) ----
     Supabase connected + test user exists  -> real Supabase session (normal path).
     Supabase not reachable / not set up / test user missing -> local customer session,
     so 7999@gmail.com can always log in and browse / cart / order (orders stay in localStorage). */
  function localTestPass(email){
    const map = SITE_CONFIG.localTestAccounts || { '7999@gmail.com':'7999' };
    const key = String(email||'').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(map, key) ? String(map[key]) : null;
  }
  function localTestMatch(email, password){
    const p = localTestPass(email);
    return p !== null && String(password||'') === p;
  }
  function isLocalTestSession(u){ return !!u && u.localTest === true; }
  function localTestLogin(email){
    const user = { id:'local-test', email:String(email).trim().toLowerCase(), name:'Customer 7999', phone:'', address:'', city:'', state:'', pincode:'', role:'customer', localTest:true };
    setSession(user);
    return { ok:true, user:currentUser(), localTest:true };
  }

  /* ---- Admin / Store-admin trust check ----
     A role of 'admin' or 'staff' stored in the browser is NOT enough on its own (anyone can
     type that into localStorage). Panel access needs a connected Supabase AND either
       (a) a real Supabase login session, or
       (b) a hidden-gateway session whose signed token was verified by the server (see init()).
     No Supabase (plain localhost, SDK missing, wrong keys) => nobody is admin or staff. */
  let gatewayVerified = false;
  function hasRealSbToken(){
    try{ return Object.keys(localStorage).some(k => /^sb-.+-auth-token$/.test(k)); }catch(e){ return false; }
  }
  function panelTrusted(u){
    if (!u) return false;
    if (!useSupabase()) return false;
    if (isGatewaySession(u)) return gatewayVerified;
    return hasRealSbToken();
  }
  function purgePanelSession(){
    try{ localStorage.removeItem(DB.KEYS.session); DB.clearCache(DB.KEYS.session); localStorage.removeItem('smd_master_token'); DB.clearCache('smd_master_token'); }catch(e){}
  }
  function isPanelRole(u){ return !!u && (u.role === 'admin' || u.role === 'staff' || u.id === 'admin' || u.id === 'staff'); }

  // While a password is being pre-checked for the OTP step we must NOT let
  // the auth-state listener create a "logged in" session.
  let suppressHydrate = false;

  // Fire-and-forget: asks the send-email edge function to mail the CURRENT
  // user ('welcome' once after signup, 'login_alert' on every login).
  function sendMail(kind){
    if (!useSupabase()) return;
    try{
      supabaseClient.functions.invoke('send-email', { body:{ kind } })
        .then(r => { if (r && r.error) console.warn('[mail]', kind, r.error.message || r.error); })
        .catch(err => console.warn('[mail]', kind, err.message));
    }catch(err){ console.warn('[mail]', kind, err.message); }
  }

  function currentUser(){
    return DB.read(DB.KEYS.session, null);
  }

  function isLoggedIn(){ return !!currentUser(); }

  function isAdmin(){
    const u = currentUser();
    if (!u || u.role !== 'admin') return false;
    if (!panelTrusted(u)) return false;
    // temporary owner whose time is over is no longer admin
    return !(u.tempUntil && new Date(u.tempUntil).getTime() <= Date.now());
  }

  function setSession(user){
    const { passHash, ...safe } = user;
    DB.write(DB.KEYS.session, safe);
  }

  /* ---------------- init — restore session on page load ---------------- */
  let initPromise = null;
  function init(){
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (!useSupabase()){
        // pure local mode: a customer / test session may stay, but an admin / staff session can never be valid here
        if (isPanelRole(currentUser())) purgePanelSession();
        return;
      }
      // hidden-gateway (/sri-login) sessions: the signed token must be accepted by the server
      try{
        const cu = currentUser();
        if (isGatewaySession(cu)){
          const tk = DB.read('smd_master_token', null);
          const askServer = () => supabaseClient.functions.invoke('master-gateway', { body:{ action:'check', token: tk && tk.token } });
          const r = await withTimeout(askServer(), 2500, { error:'timeout' });
          if (r && r.data && r.data.ok === true && r.data.role === (cu.role)) gatewayVerified = true;
          else if (r && r.data && r.data.ok === false) purgePanelSession();   // server clearly rejected the token -> logout
          else {
            // FIX (dashboard opens then jumps to login): slow network / edge-function cold start / offline is NOT a logout.
            // Keep the session, trust it for now, and re-check quietly in the background.
            gatewayVerified = true;
            (async () => {
              for (let i = 0; i < 3; i++){
                const rr = await withTimeout(askServer().catch(() => ({ error:'net' })), 10000, { error:'timeout' });
                if (rr && rr.data && rr.data.ok === true){ return; }
                if (rr && rr.data && rr.data.ok === false){ purgePanelSession(); window.location.replace((window.location.pathname.includes('/pages/') ? '../' : '') + 'index.html'); return; }
                await new Promise(res => setTimeout(res, 4000));
              }
            })();
          }
        } else if (isPanelRole(cu) && !hasRealSbToken()){
          purgePanelSession();   // forged / stale panel session with no real login behind it
        }
      }catch(e){ if (isGatewaySession(currentUser())) purgePanelSession(); }

      try{
        // getSession() normally reads the locally-stored token instantly,
        // but a slow/unreachable network can make it hang — and since
        // boot() awaits Auth.init() before DB.init() (and before anything
        // renders), a hung getSession() would freeze every single page.
        // Cap it at 3s and just proceed with whatever's in local storage.
        const timeout = new Promise(resolve => setTimeout(resolve, 3000, 'timeout'));
        const result = await Promise.race([supabaseClient.auth.getSession(), timeout]);
        if (result === 'timeout'){
          console.warn('[Supabase] auth getSession timed out after 3s, continuing with local session');
          return;
        }
        const { data: { session } } = result;
        if (session && session.user){
          // Same user already cached locally → refresh the profile in the
          // background instead of blocking every page on a network round trip
          // (admin pages still wait so a freshly-granted admin role applies).
          const cached = currentUser();
          if (cached && cached.id === session.user.id && (!/admin/.test((window.location.pathname || '').toLowerCase()) || isPanelRole(cached))){  /* FAST: admin/staff cached session -> refresh profile in background, dashboard turant open */
            hydrateFromSupabaseUser(session.user);
          } else {
            await hydrateFromSupabaseUser(session.user);
          }
        } else {
          // No real Supabase session. Only the hidden Master Gateway may keep a
          // local panel session; any old fake local-admin session (from the removed
          // password shortcut) is cleared so it can never show an empty dashboard.
          if (!isGatewaySession(currentUser()) && !isLocalTestSession(currentUser())){
            localStorage.removeItem(DB.KEYS.session); DB.clearCache(DB.KEYS.session);
          }
        }
        // IMPORTANT: never await Supabase calls INSIDE this callback — supabase-js holds
        // its auth lock while the callback runs, so awaiting another request here
        // deadlocks every later request (pages stuck on "Loading..."). Defer instead.
        supabaseClient.auth.onAuthStateChange((event, newSession) => {
          if (suppressHydrate || event === 'INITIAL_SESSION') return;
          if (newSession && newSession.user){
            setTimeout(() => { hydrateFromSupabaseUser(newSession.user); }, 0);
          } else if (!isGatewaySession(currentUser()) && !isLocalTestSession(currentUser())){
            localStorage.removeItem(DB.KEYS.session); DB.clearCache(DB.KEYS.session);
          }
        });
      }catch(err){
        console.warn('[Supabase] auth init failed:', err.message);
      }
    })();
    return initPromise;
  }

  async function hydrateFromSupabaseUser(sbUser){
    try{
      // FIX (admin showing as CUSTOMER): one slow / failed profile read used to silently turn
      // admin + staff into 'customer'. Now we retry up to 3 times before giving up.
      let profile = null;
      for (let attempt = 0; attempt < 2 && !profile; attempt++){
        const res = await withTimeout(supabaseClient.from('profiles').select('*').eq('id', sbUser.id).maybeSingle(), 3500, { data:null });
        profile = res && res.data;
        if (!profile && attempt < 1) await new Promise(r => setTimeout(r, 400));
      }
      // Still no profile row (read failed): fall back to the reserved role-emails from config
      // instead of 'customer'. Safe: panel pages still need a real Supabase session + RLS.
      const _em = String(sbUser.email || '').toLowerCase();
      const _fallbackRole = (String(SITE_CONFIG.adminEmail || '').toLowerCase() === _em) ? 'admin'
        : ((SITE_CONFIG.staffEmails || []).map(e => String(e).toLowerCase()).includes(_em) ? 'staff' : 'customer');
      // FIX: profile read failed (slow/no network) -> keep the cached admin/staff session instead of
      // downgrading it to 'customer' (that made the admin app say "Admin access only" / get stuck)
      const _cached = (!profile) ? currentUser() : null;
      const _keep = !!(_cached && _cached.id === sbUser.id && (_cached.role === 'admin' || _cached.role === 'staff'));
      if (_keep){ setSession(Object.assign({}, _cached, { email: sbUser.email || _cached.email })); return; }
      setSession({
        id: sbUser.id,
        email: sbUser.email,
        name: (profile && profile.name) || sbUser.user_metadata?.name || 'Customer',
        phone: profile ? profile.phone : '',
        address: profile ? profile.address : '',
        city: profile ? profile.city : '',
        state: profile ? profile.state : '',
        pincode: profile ? profile.pincode : '',
        role: (profile && profile.role) || _fallbackRole,
        tempUntil: (profile && profile.temp_admin_until) || null,
        tempDeleteOnExpiry: !!(profile && profile.temp_delete_on_expiry)
      });
      if (profile && (profile.temp_admin_until || profile.role === 'admin')) setTimeout(expireTemp, 0);
    }catch(err){
      console.warn('[Supabase] could not load profile:', err.message);
    }
  }

  /* ---------------- signup OTP ---------------- */
  async function finishSignup(user, details){
    try{
      await supabaseClient.from('profiles').upsert({ id:user.id, email:user.email, ...details });
    }catch(err){ console.warn('[Supabase] profile save failed:', err.message); }
    try{ localStorage.setItem('smd_just_registered', user.id); }catch(e){}
    await hydrateFromSupabaseUser(user);
    if (typeof Inbox !== 'undefined') Inbox.sendToAdmin('New customer registered', `${details.name} (${user.email}) just created an account.`, `pages/admin.html?customer=${user.id}`);
    sendMail('welcome');
  }
  async function verifySignupOtp(email, code, details){
    if (!useSupabase()) return { ok:false, error:'Not available.' };
    const { data, error } = await supabaseClient.auth.verifyOtp({ email: String(email||'').trim(), token: String(code||'').trim(), type:'signup' });
    if (error || !data.user) return { ok:false, error:'Incorrect or expired code.' };
    await finishSignup(data.user, details || {});
    return { ok:true, user: currentUser() };
  }
  async function resendOtp(email, type){
    if (!useSupabase()) return { ok:false, error:'Not available.' };
    const r = (type === 'signup')
      ? await supabaseClient.auth.resend({ type:'signup', email })
      : await supabaseClient.auth.signInWithOtp({ email, options:{ shouldCreateUser:false } });
    return r.error ? { ok:false, error:r.error.message } : { ok:true };
  }

  /* ---------------- register ---------------- */
  async function register({ name, email, phone, password, address, city, state, pincode }){
    if (String(email||'').toLowerCase() === String(SITE_CONFIG.adminEmail).toLowerCase()) return { ok:false, error:'This email is reserved. Please use a different email.' };
    // Phone number AND email are both mandatory.
    if (!validEmail(email)) return { ok:false, error:'Please enter a valid email address.' };
    if (!validPhone(phone)) return { ok:false, error:'Please enter a valid 10-digit mobile number.' };
    phone = normPhone(phone);
    if (useSupabase()){
      try{
        const { data: taken } = await supabaseClient.rpc('phone_exists', { p_phone: phone });
        if (taken === true) return { ok:false, error:'This phone number is already registered. Please log in.' };
      }catch(e){ /* RPC not installed yet — skip the pre-check */ }
      try{
        const details = { name, phone, address, city, state, pincode };
        const { data, error } = await supabaseClient.auth.signUp({
          email, password, options: { data: details }
        });
        if (error) return { ok:false, error: error.message };
        const user = data.user;
        // Already-registered, confirmed emails come back with an empty
        // identities list (and no OTP is ever sent) — say so clearly.
        if (user && Array.isArray(user.identities) && user.identities.length === 0){
          return { ok:false, error:'An account with this email already exists. Please log in.' };
        }
        // Normal path: Supabase has emailed a one-time code and is waiting
        // for it. The account becomes active only after verifySignupOtp().
        if (!data.session){
          return { ok:true, user:null, needsOtp:true, email, details };
        }
        // "Confirm email" is switched OFF in Supabase, so there is no OTP
        // step — fall back to the old immediate sign-in.
        await finishSignup(user, details);
        return { ok:true, user: currentUser() };
      }catch(err){
        return { ok:false, error: err.message || 'Something went wrong — please try again.' };
      }
    }

    // ---- local fallback ----
    const users = DB.getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())){
      return { ok:false, error:'An account with this email already exists.' };
    }
    if (users.some(u => normPhone(u.phone) === phone)) return { ok:false, error:'This phone number is already registered. Please log in.' };
    const user = { id: Utils.uid('USR'), name, email, phone, address, city, state, pincode, passHash: simpleHash(password), role:'customer', createdAt:new Date().toISOString() };
    users.push(user);
    DB.saveUsers(users);
    setSession(user);
    if (typeof Inbox !== 'undefined') Inbox.sendToAdmin('New customer registered', `${name} (${email}) just created an account.`, `pages/admin.html?customer=${user.id}`);
    return { ok:true, user };
  }

  /* ---------------- login ---------------- */
  async function login({ email, password }){
    // `email` may be a phone number — resolve to the account email first.
    if (!String(email||'').includes('@')){
      const r = await resolveEmail(email);
      if (!r.ok) return r;
      email = r.email;
    }
    // Admin, staff-less customers and everyone else use the SAME secure flow:
    // password -> emailed OTP -> real Supabase session. There is no local/offline
    // admin shortcut any more (it created a fake session with no database access).
    if (useSupabase()){
      let otpExempt = (SITE_CONFIG.otpExemptEmails || []).map(e => String(e).toLowerCase()).includes(String(email).toLowerCase().trim());
      if (!otpExempt){
        try{
          const ex = await withTimeout(supabaseClient.rpc('is_otp_exempt', { p_email: String(email).trim() }), 2500, { data:false });
          if (ex && ex.data === true) otpExempt = true;
        }catch(e){}
      }
      let needOtp = SITE_CONFIG.requireOtpAfterPassword !== false && !otpExempt; // email OTP is ON unless disabled (or this is the listed test account)
      if (needOtp) suppressHydrate = true;
      try{
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error){
          // test account: never blocked by a missing/unsynced Supabase user
          if (localTestMatch(email, password)){ suppressHydrate = false; return localTestLogin(email); }
          if (/not confirmed/i.test(error.message)){
            // never finished signup OTP — send a fresh signup code
            await supabaseClient.auth.resend({ type:'signup', email });
            return { ok:true, needsOtp:true, otpType:'signup', email };
          }
          console.warn('[Auth] signInWithPassword failed:', error.status, error.message);
          if (/failed to fetch|networkerror|load failed|network request failed/i.test(error.message)) return { ok:false, error:'Server-ah connect panna mudiyala. Internet check pannunga, apram Ctrl+Shift+R (hard refresh) panni thirumba try pannunga. Theeraliya na latest version-ah Vercel-la redeploy pannanum.' };
          if (/invalid login/i.test(error.message)) return { ok:false, error:'Incorrect email/phone or password.' };
          if (/rate limit|too many/i.test(error.message)) return { ok:false, error:'Too many attempts. Please wait a few minutes and try again.' };
          return { ok:false, error:'Login error: ' + error.message + (error.status ? ' (' + error.status + ')' : '') };
        }
        if (!needOtp && otpExempt){
          // Test-account shortcut is for plain CUSTOMER accounts only. If this email ever
          // became admin/staff, fall back to the normal emailed-OTP step.
          const { data:prof } = await supabaseClient.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
          if (prof && prof.role && prof.role !== 'customer'){
            needOtp = true; suppressHydrate = true;
          }
        }
        if (!needOtp){
          // Password-only login: the email was already verified by OTP at signup.
          await hydrateFromSupabaseUser(data.user);
          const u = currentUser();
          if (typeof Inbox !== 'undefined' && u) Inbox.sendToAdmin('Customer logged in', `${u.name || 'A customer'} (${email}) logged in with password.`, `pages/admin.html?customer=${u.id}`);
          sendMail('login_alert');
          return { ok:true, user:u };
        }
        // Optional extra step: drop the session and require an emailed code.
        await supabaseClient.auth.signOut({ scope:'local' });
        localStorage.removeItem(DB.KEYS.session); DB.clearCache(DB.KEYS.session);
        const r = await supabaseClient.auth.signInWithOtp({ email, options:{ shouldCreateUser:false } });
        if (r.error){
          console.warn('[Auth] signInWithOtp failed:', r.error.status, r.error.message);
          return { ok:false, error: /rate limit|too many|seconds/i.test(r.error.message)
            ? 'Password correct, but the OTP email limit is reached. Wait ~1 hour or set up custom SMTP in Supabase (Auth -> SMTP).'
            : 'Password correct, but the OTP email could not be sent: ' + r.error.message };
        }
        return { ok:true, needsOtp:true, otpType:'email', email };
      } catch(err){
        // network down / Supabase unreachable while the page believes it is connected
        if (localTestMatch(email, password)){ suppressHydrate = false; return localTestLogin(email); }
        return { ok:false, error:'Could not reach the server: ' + (err && err.message ? err.message : 'network error') };
      } finally {
        setTimeout(() => { suppressHydrate = false; }, 800);
      }
    }

    // ---- local fallback ----
    if (localTestMatch(email, password)) return localTestLogin(email);
    const users = DB.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return { ok:false, error:'No account found with this email.' };
    if (user.passHash !== simpleHash(password)) return { ok:false, error:'Incorrect password.' };
    setSession(user);
    if (typeof Inbox !== 'undefined') Inbox.sendToAdmin('Customer logged in', `${user.name || 'A customer'} (${email}) just logged in.`, `pages/admin.html?customer=${user.id}`);
    return { ok:true, user };
  }

  // Login WITHOUT a password: email a one-time code, then verifyLoginOtp().
  async function startOtpLogin(email){
    email = String(email||'').trim();
    if (!email) return { ok:false, error:'Please enter your registered phone number or email.' };
    if (!email.includes('@')){ const r = await resolveEmail(email); if (!r.ok) return r; email = r.email; }
    if (!useSupabase()) return { ok:false, error:'OTP login is not available right now. Please use your password.' };
    const { error } = await supabaseClient.auth.signInWithOtp({ email, options:{ shouldCreateUser:false } });
    if (error) return { ok:false, error: /not found|signups not allowed/i.test(error.message) ? 'No account found with this email.' : error.message };
    return { ok:true, email, otpType:'email' };
  }

  async function verifyLoginOtp(email, code, otpType){
    if (!useSupabase()) return { ok:false, error:'Not available.' };
    const { data, error } = await supabaseClient.auth.verifyOtp({ email: String(email||'').trim(), token: String(code||'').trim(), type: otpType === 'signup' ? 'signup' : 'email' });
    if (error || !data.user) return { ok:false, error:'Incorrect or expired code.' };
    suppressHydrate = false;
    await hydrateFromSupabaseUser(data.user);
    const u = currentUser();
    if (typeof Inbox !== 'undefined' && u && u.role !== 'admin' && u.role !== 'staff') Inbox.sendToAdmin('Customer logged in', `${u.name || 'A customer'} (${email}) just logged in.`, `pages/admin.html?customer=${u.id}`);
    sendMail(otpType === 'signup' ? 'welcome' : 'login_alert');
    return { ok:true, user:u };
  }

  /* ---------------- profile update ---------------- */
  async function updateProfile(patch){
    const u = currentUser();
    if (!u) return;
    const merged = { ...u, ...patch };
    setSession(merged);
    if (typeof Inbox !== 'undefined') Inbox.trackActivity('Profile updated', 'changed profile details (' + Object.keys(patch).join(', ') + ')', 'pages/admin.html?tab=customers');
    if (useSupabase() && u.id !== 'admin' && u.id !== 'staff' && !u.localTest){
      try{ await supabaseClient.from('profiles').update(patch).eq('id', u.id); }
      catch(err){ console.warn('[Supabase] updateProfile failed:', err.message); }
    } else if (!useSupabase() && !u.localTest && u.role !== 'admin' && u.role !== 'staff'){
      const users = DB.getUsers().map(x => x.id === u.id ? { ...x, ...patch } : x);
      DB.saveUsers(users);
    }
  }

  /* ---------------- forgot password (email OTP) ----------------
     1) sendResetOtp  -> Supabase emails a one-time code to the registered email
     2) verifyResetOtp -> code is checked (this signs the user in temporarily)
     3) setNewPassword -> saves the new password, then signs out so the user
                          logs in normally with it.
     Needs Supabase; the email template must include {{ .Token }}. */
  function isReservedAdmin(email){
    return String(email||'').trim().toLowerCase() === String(SITE_CONFIG.adminEmail).toLowerCase();
  }
  async function sendResetOtp(email){
    email = String(email||'').trim();
    if (!email) return { ok:false, error:'Please enter your registered phone number or email.' };
    if (!email.includes('@')){ const r = await resolveEmail(email); if (!r.ok) return r; email = r.email; }
    if (!useSupabase()) return { ok:false, error:'Password reset by email is not available right now. Please contact the store.' };
    const { error } = await supabaseClient.auth.signInWithOtp({ email, options:{ shouldCreateUser:false } });
    if (error) return { ok:false, error: /not found|signups not allowed/i.test(error.message) ? 'No account found with this email.' : error.message };
    return { ok:true, email };
  }
  async function verifyResetOtp(email, code){
    if (!useSupabase()) return { ok:false, error:'Not available.' };
    const { error } = await supabaseClient.auth.verifyOtp({ email: String(email||'').trim(), token: String(code||'').trim(), type:'email' });
    if (error) return { ok:false, error:'Incorrect or expired code.' };
    if (typeof Inbox !== 'undefined') Inbox.sendToAdmin('Password reset requested', `${String(email).trim()} verified an OTP to reset their password.`, 'pages/admin.html?tab=customers');
    return { ok:true };
  }
  async function setNewPassword(password){
    if (!useSupabase()) return { ok:false, error:'Not available.' };
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) return { ok:false, error: error.message };
    const who = currentUser();
    if (typeof Inbox !== 'undefined') await Inbox.sendToAdmin('Password changed (forgot password)', `${who && who.email ? who.email : 'A customer'} reset their password using Forgot Password.`, 'pages/admin.html?tab=customers');
    await logout();
    return { ok:true };
  }

  /* ---------------- logout ---------------- */
  async function logout(){
    try{
      if (typeof Inbox !== 'undefined' && !String(window.location.pathname).includes('forgot-password')){
        // wait briefly so the note is sent while the session still exists
        await Promise.race([ Inbox.trackActivity('Customer logged out', 'logged out', 'pages/admin.html?tab=customers'), new Promise(r => setTimeout(r, 1500)) ]);
      }
    }catch(e){}
    localStorage.removeItem(DB.KEYS.session); DB.clearCache(DB.KEYS.session);
    if (useSupabase()){
      try{ await supabaseClient.auth.signOut(); }catch(err){ /* ignore */ }
    }
    try{ Object.keys(localStorage).forEach(k => { if (/^sb-.+-(auth-token|code-verifier)/.test(k)) localStorage.removeItem(k); }); }catch(e){}
  }

  /* ---------------- delete account (permanent) ----------------
     Removes the account entirely — not a deactivation. The same email and
     phone number can be used to register a brand new account afterwards,
     but nothing about the deleted one (orders, wishlist, saved address) is
     recoverable, matching what the Terms & Conditions state. */
  function canSelfDelete(){
    const u = currentUser();
    return !!u && !u.localTest && u.role !== 'admin' && u.id !== 'staff' && u.id !== 'admin';
  }
  // Step 1 — email a one-time code to the logged-in account.
  async function requestDeleteOtp(){
    const u = currentUser();
    if (!u) return { ok:false, error:'Not logged in.' };
    if (u.role === 'admin') return { ok:false, error:'Admin accounts cannot be deleted. Use temporary ownership transfer instead.' };
    if (!canSelfDelete()) return { ok:false, error:'This session has no account of its own to delete.' };
    if (!useSupabase()) return { ok:true, local:true };
    suppressHydrate = true;
    const { error } = await supabaseClient.auth.signInWithOtp({ email:u.email, options:{ shouldCreateUser:false } });
    setTimeout(() => { suppressHydrate = false; }, 800);
    return error ? { ok:false, error:error.message } : { ok:true, email:u.email };
  }
  // Step 2 — verify the code, then delete permanently.
  async function confirmDeleteAccount(code){
    const u = currentUser();
    if (!u || !canSelfDelete()) return { ok:false, error:'Not allowed.' };
    if (useSupabase()){
      const { data, error } = await supabaseClient.auth.verifyOtp({ email:u.email, token:String(code||'').trim(), type:'email' });
      if (error || !data || !data.user || data.user.id !== u.id) return { ok:false, error:'Incorrect or expired code.' };
      const { data:res, error:rpcErr } = await supabaseClient.rpc('delete_my_account');
      if (rpcErr) return { ok:false, error:'Delete is not set up on the server yet (run supabase/profile-controls.sql).' };
      if (res && res.ok === false) return { ok:false, error:res.error };
      localStorage.removeItem(DB.KEYS.session); DB.clearCache(DB.KEYS.session);
      try{ await supabaseClient.auth.signOut({ scope:'local' }); }catch(e){}
      return { ok:true };
    }
    // ---- local fallback ----
    DB.saveUsers(DB.getUsers().filter(x => x.id !== u.id));
    DB.write(DB.KEYS.orders, DB.getOrders().filter(o => o.userId !== u.id));
    localStorage.removeItem(DB.KEYS.cart); DB.clearCache(DB.KEYS.cart);
    localStorage.removeItem(DB.KEYS.wishlist); DB.clearCache(DB.KEYS.wishlist);
    localStorage.removeItem(DB.KEYS.session); DB.clearCache(DB.KEYS.session);
    return { ok:true };
  }

  /* ---------------- temporary ownership (admin only) ---------------- */
  async function expireTemp(){
    if (!useSupabase()) return;
    try{
      await supabaseClient.rpc('expire_temp_admins');
      const u = currentUser();
      if (u && u.tempUntil && new Date(u.tempUntil).getTime() <= Date.now()){
        // our own temporary time is over: sign out
        localStorage.removeItem(DB.KEYS.session); DB.clearCache(DB.KEYS.session);
        try{ await supabaseClient.auth.signOut({ scope:'local' }); }catch(e){}
        if (!/login\.html|index\.html/.test(window.location.pathname)) window.location.replace((typeof ROOT_PREFIX !== 'undefined' ? ROOT_PREFIX : '') + 'pages/login.html');
      }
    }catch(e){ /* functions not installed yet */ }
  }
  async function grantTempAdmin(email, hours, deleteOnExpiry){
    if (!useSupabase()) return { ok:false, error:'Needs Supabase.' };
    const h = Math.floor(Number(hours));
    if (!(h >= 1 && h <= 500)) return { ok:false, error:'Hours must be between 1 and 500.' };
    const { data, error } = await supabaseClient.rpc('grant_temp_admin', { p_email:String(email||'').trim(), p_hours:h, p_delete_on_expiry: deleteOnExpiry !== false });
    if (error) return { ok:false, error:'Not set up on the server yet (run supabase/profile-controls.sql).' };
    return data || { ok:false, error:'No response.' };
  }
  async function revokeTempAdmin(userId){
    if (!useSupabase()) return { ok:false, error:'Needs Supabase.' };
    const { data, error } = await supabaseClient.rpc('revoke_temp_admin', { p_user:userId });
    return error ? { ok:false, error:error.message } : (data || { ok:true });
  }
  async function listTempAdmins(){
    if (!useSupabase()) return [];
    try{
      const { data } = await supabaseClient.from('profiles').select('id,name,email,temp_admin_until,temp_delete_on_expiry').not('temp_admin_until','is',null).order('temp_admin_until');
      return data || [];
    }catch(e){ return []; }
  }

  function requireLogin(redirectTo = 'login.html'){
    if (!isLoggedIn()){ window.location.href = redirectTo; return false; }
    return true;
  }

  /* ---------------- master gateway grant ----------------
     Called ONLY by js/master-gateway.js after the edge function has verified
     credentials (+ OTP for Admin 1) and returned a signed token.            */
  async function masterGrant({ role, email, password, token }){
    if (!useSupabase()) return { ok:false, error:'Supabase is not connected - admin / staff access is disabled.' };
    gatewayVerified = true; // token was just issued by the server-side gateway
    if (role === 'admin'){
      if (useSupabase() && email && password){
        try{
          const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
          if (!error && data.user){
            await hydrateFromSupabaseUser(data.user);
            const real = currentUser();
            if (real && real.role === 'admin'){ DB.write('smd_master_token', { role, token, at: Date.now() }); return { ok:true, user: real }; }
          }
        }catch(err){ console.warn('[Supabase] admin sign-in failed, using local session:', err.message); }
      }
      const u = { id:'admin', name:(SITE_CONFIG.adminName || 'Store Admin'), email:SITE_CONFIG.adminEmail, role:'admin' };
      setSession(u); DB.write('smd_master_token', { role, token, at: Date.now() });
      return { ok:true, user: u };
    }
    if (role === 'staff'){
      const u = { id:'staff', name:'Staff', email:'staff@local', role:'staff' };
      setSession(u); DB.write('smd_master_token', { role, token, at: Date.now() });
      return { ok:true, user: u };
    }
    return { ok:false, error:'Unknown role.' };
  }
  function isStaff(){ const u = currentUser(); return !!u && u.role === 'staff' && panelTrusted(u); }
  function hasPanelAccess(){ return isAdmin() || isStaff(); }
  function requirePanel(redirectTo = 'login.html'){
    if (!hasPanelAccess()){ window.location.replace(redirectTo); return false; }
    return true;
  }

  function requireAdmin(redirectTo = 'login.html'){
    if (!isAdmin()){ window.location.href = redirectTo; return false; }
    return true;
  }

  /* ---------------- admin team management (Supabase only) ----------------
     A logged-in admin can look up a registered customer by email and flip
     their role — this works because our RLS policy lets is_admin() update
     ANY profile row, not just their own. No service-role key needed. */
  async function findByEmail(email){
    if (!useSupabase()) return { ok:false, error:'Connect Supabase to manage admin users.' };
    const { data, error } = await supabaseClient.from('profiles').select('*').eq('email', email.toLowerCase().trim()).maybeSingle();
    if (error) return { ok:false, error: error.message };
    if (!data) return { ok:false, error:'No account found with that email. They need to register first.' };
    return { ok:true, profile: data };
  }

  async function setRole(userId, role){
    if (!useSupabase()) return { ok:false, error:'Connect Supabase to manage admin users.' };
    const { error } = await supabaseClient.from('profiles').update({ role }).eq('id', userId);
    if (error) return { ok:false, error: error.message };
    return { ok:true };
  }

  async function listAdmins(){
    if (!useSupabase()) return [];
    const { data } = await supabaseClient.from('profiles').select('*').eq('role', 'admin');
    return data || [];
  }

  /* ---------------- manage accounts: store admin (staff) + test accounts ---------------- */
  async function listManagedAccounts(){
    if (!useSupabase()) return [];
    const tests = (SITE_CONFIG.testAccountEmails || []).map(e => String(e).toLowerCase());
    const { data: staff } = await supabaseClient.from('profiles').select('id,name,email,role').eq('role', 'staff');
    let testRows = [];
    if (tests.length){
      const r = await supabaseClient.from('profiles').select('id,name,email,role').in('email', tests).neq('role', 'admin');
      testRows = r.data || [];
    }
    const seen = new Set(), out = [];
    (staff || []).concat(testRows).forEach(p => { if (!seen.has(p.id)){ seen.add(p.id); out.push(p); } });
    return out;
  }

  async function adminDeleteAccount(userId){
    if (!useSupabase()) return { ok:false, error:'Connect Supabase first.' };
    const { data, error } = await supabaseClient.rpc('admin_delete_account', { p_user: userId });
    if (error) return { ok:false, error: error.message };
    return data && data.ok ? { ok:true } : { ok:false, error:(data && data.error) || 'Could not delete this account.' };
  }

  return { listManagedAccounts, adminDeleteAccount, resolveEmail, normPhone, init, register, login, logout, requestDeleteOtp, confirmDeleteAccount, canSelfDelete, grantTempAdmin, revokeTempAdmin, listTempAdmins, expireTemp, currentUser, isLoggedIn, isAdmin, updateProfile, requireLogin, requireAdmin, masterGrant, isStaff, hasPanelAccess, requirePanel, verifySignupOtp, startOtpLogin, verifyLoginOtp, resendOtp, sendResetOtp, verifyResetOtp, setNewPassword, findByEmail, setRole, listAdmins };
})();
