/* Master Gateway client — talks ONLY to the master-gateway edge function.
   No credentials live in this file. */
const MasterGateway = (() => {
  async function call(body){
    if (typeof DB === 'undefined' || !DB.useSupabase() || typeof supabaseClient === 'undefined' || !supabaseClient)
      return { ok:false, error:'Gateway service is not connected (Supabase + master-gateway function required).' };
    try{
      const { data, error } = await supabaseClient.functions.invoke('master-gateway', { body });
      if (error){
        let msg = 'Request failed.';
        try{ const j = await error.context.json(); if (j && j.error) msg = j.error; }catch(e){}
        return { ok:false, error:msg };
      }
      return data && data.error ? { ok:false, error:data.error } : data;
    }catch(e){ return { ok:false, error:'Network error.' }; }
  }
  const startAdmin  = (email, password, geo) => call({ action:'start_admin', email, password, geo });
  const verifyAdmin = (challenge, otp, geo)   => call({ action:'verify_admin', challenge, otp, geo });
  const startStaff  = (username, password, geo) => call({ action:'start_staff', username, password, geo });
  const verifyStaff = (challenge, otp, geo)   => call({ action:'verify_staff', challenge, otp, geo });
  const check       = (token) => call({ action:'check', token });
  return { startAdmin, verifyAdmin, startStaff, verifyStaff, check };
})();
