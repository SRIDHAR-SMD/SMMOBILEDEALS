# Deploy to Vercel (replaces the live site on your existing domain)

The folder is already linked to the Vercel project `sm-mobile-deals` (`.vercel/project.json`),
and that project already owns your domain. A production deploy replaces the live site; the
domain stays attached automatically.

```bash
# one time
npm i -g vercel
vercel login

# every deploy (run inside this folder, where vercel.json is)
vercel pull --yes --environment=production   # optional: pulls project settings
vercel deploy --prod --yes
```

Check the domain: `vercel domains ls` and `vercel project ls`.

## Supabase (run once in Supabase -> SQL Editor, in this order if not done before)
1. `supabase/schema-tables-only.sql` (or `schema.sql`) 
2. `supabase/seed/seed-1..6` (seed 6 already contains the 60 mobile + 48 laptop spare parts)
   - if you ran the seeds earlier WITHOUT spare parts, just run `supabase/spare-parts.sql` once
3. the other files listed in `supabase/RUN-ORDER.md`

`js/supabase-client.js` must hold the URL + anon key of the Supabase project you want live.
