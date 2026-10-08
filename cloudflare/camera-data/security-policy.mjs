export const POLICY = Object.freeze({slots:2, dailyNew:4, tokenTTL:300, tokenUses:3, requestsPerMinute:30, failures:8, blockSeconds:900, failureBlockSeconds:1800, ipRequestsPerMinute:180, ipInstallationsPerHour:30});
/** @param {import("./protocol").PolicyState} state @param {import("./protocol").PolicyInput} input @param {number} now @returns {import("./protocol").PolicyResult} */
export function applyPolicy(state, input, now = Date.now()) {
 const s = state;
 s.requests = (s.requests || []).filter(t => t > now - 60000);
 s.failures = (s.failures || []).filter(t => t > now - 600000);
 s.newCountries = (s.newCountries || []).filter(x => x.at > now - 86400000);
 s.active ||= {};
 s.tokens = Object.fromEntries(Object.entries(s.tokens || {}).filter(([,x]) => x.exp * 1000 > now));
 s.installations = (s.installations || []).filter(x => x.at > now - 3600000);
 if (s.blockedUntil > now) return {status:429, error:'temporarily_blocked', retryAfter:Math.ceil((s.blockedUntil-now)/1000)};
 s.requests.push(now);
 /** @param {string} error @param {number} seconds */
 const block = (error, seconds = Number(POLICY.blockSeconds)) => {s.blockedUntil=now+seconds*1000;return {status:429,error,retryAfter:seconds};};
 if (s.requests.length > (input.action==='ip' ? POLICY.ipRequestsPerMinute : POLICY.requestsPerMinute)) return block('request_rate');
 if (input.action==='ip') {
  if (!s.installations.some(x => x.id===input.installation)) s.installations.push({id:input.installation,at:now});
  if (s.installations.length > POLICY.ipInstallationsPerHour) return block('installation_rotation',300);
  return {status:200};
 }
 if (input.action==='invalid') {
  s.failures.push(now);
  if (s.failures.length >= POLICY.failures) return block('failed_authorization',POLICY.failureBlockSeconds);
  return {status:input.status || 401,error:input.error || 'invalid_token'};
 }
 if (input.action==='release') {
  delete s.active[input.country];
  for(const [id,t] of Object.entries(s.tokens)) if(t.country===input.country) delete s.tokens[id];
  return {status:200};
 }
 if (input.action==='token') {
  if (!s.active[input.country]) {
   if (Object.keys(s.active).length >= POLICY.slots) return {status:409,error:'offline_limit',countries:Object.keys(s.active)};
   if (!s.newCountries.some(x=>x.country===input.country)) {
    if (s.newCountries.length >= POLICY.dailyNew) return {status:429,error:'daily_country_limit',retryAfter:Math.ceil((s.newCountries[0].at+86400000-now)/1000)};
    s.newCountries.push({country:input.country,at:now});
   }
   s.active[input.country]={generation:input.generation};
  }
  s.tokens[input.jti]={country:input.country,exp:input.exp,uses:0,generation:s.active[input.country].generation};
  return {status:200,generation:s.active[input.country].generation};
 }
 if (input.action==='consume') {
  const token=s.tokens[input.jti];
  if (!token || token.country!==input.country || token.exp*1000<=now || token.generation!==s.active[input.country]?.generation || token.uses>=POLICY.tokenUses) {
   s.failures.push(now);
   if(s.failures.length>=POLICY.failures)return block('failed_authorization',POLICY.failureBlockSeconds);
   return {status:401,error:'invalid_or_used_token'};
  }
  token.uses++;
  return {status:200};
 }
 return {status:400,error:'invalid_action'};
}
