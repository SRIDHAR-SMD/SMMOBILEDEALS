# Supabase project: SM MOBILE DEALS (jvaontaxvywcklbhdnjd)
URL: https://jvaontaxvywcklbhdnjd.supabase.co  (js/supabase-client.js + vercel.json CSP already point here)

DONE by Claude through the connector: tables, RLS, storage buckets, OTP/profile/phone/admin/recharge SQL,
3 accounts, 5 edge functions (send-email, recharge-mail, sms-otp, master-gateway, ai-chat).

YOU STILL DO:
1. SQL Editor: run supabase/seed/seed-1-of-6.sql ... seed-6-of-6.sql ONE BY ONE (products; seed 6 has spare parts).
2. Authentication -> SMTP: Gmail App Password. Magic Link template must contain {{ .Token }}.
3. Edge function secrets (Project Settings -> Edge Functions -> Secrets):
   SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_USER SMTP_PASS MAIL_FROM
   MASTER_SECRET (long random) MASTER_ADMIN_EMAIL MASTER_ADMIN_PASS MASTER_STAFF_USER MASTER_STAFF_PASS OTP_TO
   ANTHROPIC_API_KEY (chatbot + recharge screenshot check)   ADMIN_PHONE + Twilio/MSG91 (optional SMS OTP)
4. Authentication -> Providers -> Email -> turn ON leaked-password protection.
5. vercel deploy --prod --yes
