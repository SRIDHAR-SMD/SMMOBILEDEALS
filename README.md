# Email templates (REQUIRED for OTP login)

Supabase sends the OTP email using a DIFFERENT template depending on the situation:

| Situation on the site                               | Supabase template   | File here           |
|------------------------------------------------------|---------------------|---------------------|
| New account verification (Register)                  | Confirm signup      | confirm-signup.html |
| Login OTP after password / "Login with OTP" / Forgot password / Delete account (existing customer) | **Magic Link** | magic-link.html |

If **Magic Link** still has the default text ("Follow this link to login"), the customer gets an email
with NO code (or nothing useful) even though signup worked. Fix:

Supabase Dashboard -> Authentication -> Email Templates -> open **Magic Link** -> Subject: `Your SM Mobile Deals login code`
-> paste the HTML of magic-link.html (it contains `{{ .Token }}`) -> Save.
Do the same for **Confirm signup** with confirm-signup.html.
