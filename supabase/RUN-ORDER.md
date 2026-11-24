# New Supabase project — run these in SQL Editor, in THIS order

1. schema-tables-only.sql
2. seed/seed-1-of-6.sql ... seed/seed-6-of-6.sql  (one by one, in order -> 2,145 products)
3. otp-emails-setup.sql
4. profile-controls.sql
5. phone-login.sql
6. admin-manage-accounts.sql
7. order-cancel-guard.sql
8. live-location.sql
9. security-v29.sql
10. notifications-delete.sql   (NEW - makes notification X / Clear all work)
11. master-gateway.sql
11. accounts-and-otp-exempt.sql   <- LAST (3 accounts + test-account OTP skip). Every row of its result must show password_ok = true.
12. recharge.sql   (mobile recharge requests + admin switch; then: supabase functions deploy recharge-mail)

Then: Project Settings -> API -> copy Project URL + anon key into js/supabase-client.js
(SUPABASE_URL / SUPABASE_ANON_KEY), and set Authentication -> SMTP (Gmail App Password)
so Admin / Store Admin / customer OTP emails can be sent. Magic Link email template must contain {{ .Token }}.
After running, delete the passwords from accounts-and-otp-exempt.sql and default-admin.sql.
