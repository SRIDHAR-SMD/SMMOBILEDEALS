# What changed (this delivery)

| Item | Where |
|---|---|
| Faster loads | non-blocking fonts/FontAwesome, splash no longer waits for `load`, minified css/js (sources in `_source/`, rebuild with `tools/minify.sh`), SW v4, cache headers |
| Offline / 404 reel player | `404.html`, `offline.html`, `js/offline-player.js` (reels from `SITE_CONFIG.deliveryReels`, falls back to `instagramReels`) |
| Support email | `js/config.js` → `email` |
| 📸 Proofs button | payment page, `js/proofs.js` (`SITE_CONFIG.proofs` for extra images) |
| Hidden `/sri-login` | `pages/sri-login.html` + Vercel rewrite, `noindex`, not linked anywhere |
| Roles | Admin 1 (password + emailed OTP) · Staff (limited tabs) — verified server-side by `supabase/functions/master-gateway` |
| 🛰️ footer icon | small icon → anti-scam notice |
| GPS anti-scam | `js/geo.js`: notice → browser permission → log; Admin → **Security & GPS** tab with Google Maps links |
| Black/White theme + splash failsafe + local supabase-js | `css/dark-mode.css`, `js/vendor/supabase.min.js` |
| Live location + scam alerts | `js/geo.js`, admin → Live Customers, run `supabase/live-location.sql` |
| Colourful admin icons | `js/admin-extras.js` (every field label + nav) |

## Deploy steps (required for /sri-login to work)
1. Supabase SQL Editor → run `supabase/master-gateway.sql`
2. Set secrets + deploy function (commands are at the bottom of that SQL file)
3. Push to Vercel

## Latest update
- Footer "Get in touch": address -> Google Maps link, timings -> centred timetable popup (open/closed + today highlighted), phone -> popup with both numbers, email/WhatsApp rows fully clickable.
- Realistic Shop / Account icons in footer headings; "What customers say" stars are yellow everywhere.
- Admin panel: sidebar + in-panel buttons get a blue outline on hover/focus; toast notifications always dark panel + white text.
- Fixed: broken JS string in pages/admin.html (invoice preview), wrong css path in 404.html/offline.html, removed 3 unused stylesheets, SW cache v27, _source/ re-synced with the shipped js/css.
- Project title: Dealora (index.html <title>).

## Latest update (login "How it works" + footer icons)
- **How it works (login page):** removed the foggy inset box on the Confirmed / Awaiting / Failed phone screens. The tint is now painted edge-to-edge on the phone screen (`wt-vp-ok / wt-vp-wait / wt-vp-fail` class set in `walkthrough.js`), text colours corrected (green / amber / red), the smudgy text-shadow removed, and long titles/captions wrap instead of overflowing.
- **Footer -> Get in touch:** location, timings, phone, e-mail and WhatsApp icons are now realistic full-colour glossy SVGs (red map pin, clock face, green handset tile, envelope with notification dot, WhatsApp bubble). The Timings / Call-us popups use the same icons. "Get in touch" heading now has the same outlined icon as Shop and Account.
- SW cache bumped to v28. CSS lives at the end of `css/final-fix.css`; JS changes are in both `_source/js` and `js`.

## Latest update (admin login, email OTP, profile page)
- **Admin is now `smmobiledealss@gmail.com`** (real Supabase account, role `admin`). `7999@gmail.com` is a normal customer. Run `supabase/default-admin.sql` once.
- **Email OTP on every login** (`requireOtpAfterPassword: true`): password -> emailed code -> session. Same flow for admin and customers; "Login with OTP" tab and Forgot password also work for admin.
- **Removed the local fake-admin login** (hash in config). It made a session with no database access, hence the empty dashboard showing "Sridhar / STORE ADMIN". Stale fake sessions are auto-cleared.
- **Fixed pages stuck on "Loading…"** (Profile/Admin): `onAuthStateChange` awaited a Supabase call inside the callback (supabase-js deadlock). Now deferred; `App.boot` also has 6s/9s time caps.
- **Profile page now opens for Admin/Staff** (no forced redirect), shows an Admin badge + "Open dashboard"; delete-account hidden for them. Admin dashboard labels unified to "SRIDHAR SUGI / Admin".

## Latest update (profile for everyone, OTP delete, temporary ownership)
- **My Profile opens for Customer, Store Admin and Admin** with an "Access & Control" card (role, what you can do, temporary-access countdown).
- **Customer + Store Admin: Delete My Account Permanently** — type DELETE, then a code is emailed; account is deleted only after the code is verified (server function `delete_my_account`). Orders are kept anonymised. Admin cannot self-delete.
- **Admin: Transfer Ownership (temporary)** — email + hours slider (1–500 h, presets), optional "delete that account when time ends". Access stops exactly at expiry (`is_admin()` checks the time); the account is auto-deleted by a 1-minute pg_cron job (and on every admin page load). Admin can "End now" early.
- Run `supabase/profile-controls.sql` once (after `default-admin.sql`). Enable **pg_cron** in Supabase -> Database -> Extensions for deletion while nobody is online.

## Latest update (order cancel / decline + ₹1000 charge)
- Customer **Cancel** now shows the charge up-front (charge, amount paid, refund) before confirming; cancelled orders show charge/refund status.
- **Fixed**: refund was computed from the full order total even for COD/Advance orders that only paid an advance. Now it is based on money actually paid (`Orders.amountPaid`), charge = min(paid, ₹1000).
- **Admin**: 🚫 button on every open order (cancel with custom charge, 0 = waive, + reason sent to customer); Refunds tab has **Change charge**. New file `js/admin-cancel.js`.
- `supabase/order-cancel-guard.sql`: database trigger computes the charge server-side so customers can't edit refund fields.

## Latest update (logout fix, test account, manage accounts, transparent chatbot)
- **Logout fixed** (customer + admin + staff): the stored Supabase session (`sb-*-auth-token`) is now removed immediately on logout, so a reload no longer logs you back in (`js/smd-v29.js`, `js/auth.js`).
- **7999@gmail.com** (test customer) skips the emailed OTP: `SITE_CONFIG.otpExemptEmails` in `js/config.js`. Falls back to OTP automatically if that account ever becomes admin/staff.
- **Admin -> Admin Team -> Manage Accounts**: permanently delete the Store Admin (staff) or test account (`testAccountEmails`). Run `supabase/admin-manage-accounts.sql` once (after `profile-controls.sql`).
- `supabase/default-admin.sql` now also creates the Store Admin (`sridhariphone7@gmail.com`, role staff). Delete the passwords from that file after running it.
- **Chatbot circle**: transparent fill (no white fog), headset icon only, no logo rotation.
- **Trending now** cards: transparent, no white fog (light and dark theme).
- SW cache `smd-cache-v45`.

## v47 — accounts + full audit
- **Admin login**: `smmobiledealss@gmail.com` / `RacingSport7999@#` (role admin). **Store admin**: `sridhariphone7@gmail.com` / `RacingSport7999@#` (staff). **Test customer**: `7999@gmail.com` / `7999` (no email OTP). Run `supabase/default-admin.sql` once, then delete the passwords from that file.
- The older admin address `smmobilesdealss@gmail.com` is demoted to a normal customer by that SQL.
- Audit of all 27 pages (dark + light, desktop + mobile): no JS errors, no missing files, no horizontal overflow. Fixed: admin modal titles (white on white), typed text in the login/register phone demo (white on white), light-theme homepage category tile tint, price label contrast on Shop.
- SW cache `smd-cache-v47`.

## v48
- Top-bar (header) logo now fades between the dark and light SM logo every 5 seconds. The chatbot circle only has the white fog removed (headset icon, nothing else changes).
- SW cache `smd-cache-v48`.

## v52 — test account fallback, admin/staff hardening, "View all" fix
- **Test account** `7999@gmail.com` / `7999` now logs in on plain localhost (no Supabase) AND with Supabase (real session if the user exists, local customer session if Supabase is unreachable / user missing). Code: `js/auth.js` (`localTestMatch`, `localTestLogin`).
- **Admin / Store admin** are now disabled unless Supabase is connected AND there is a real Supabase login (or a server-verified /sri-login token). Forged `localStorage` sessions are purged. `masterGrant` refuses without Supabase.
- **Handpicked -> "View all"**: readable white glass pill in both themes, no wrap/overflow (end of `css/final-fix.css`).
- SW cache `smd-cache-v52`.
