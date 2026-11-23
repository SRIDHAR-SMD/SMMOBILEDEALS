# v29 deploy (5 minutes)
1. Supabase -> SQL Editor -> run `supabase/security-v29.sql`
2. (optional, admin phone OTP)
   supabase functions deploy sms-otp
   supabase secrets set ADMIN_PHONE=9XXXXXXXXX OTP_PEPPER=<long random text>
   + Twilio: TWILIO_SID TWILIO_TOKEN TWILIO_FROM   OR   MSG91: MSG91_AUTHKEY MSG91_TEMPLATE_ID
   (without these the phone step is skipped automatically)
3. Deploy site:  cd SM-Mobile-Deals && vercel --prod
4. Hard-refresh once (Ctrl+Shift+R) — service worker cache is now smd-cache-v34.
