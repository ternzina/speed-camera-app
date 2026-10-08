import { DurableObject } from 'cloudflare:workers';
import { applyPolicy } from './security-policy.mjs';
export class DownloadLimiter extends DurableObject {
 /** @param {DurableObjectState} ctx @param {Env} env */
 constructor(ctx,env) {
  super(ctx,env);
  ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS policy_state (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL)');
 }
 /** @param {import("./protocol").PolicyInput} input @returns {Promise<import("./protocol").PolicyResult>} */
 async check(input) {
  // No await between read / policy mutation / durable write: one atomic synchronous SQL turn.
  const rows=this.ctx.storage.sql.exec('SELECT value FROM policy_state WHERE id=1').toArray();
  const state=rows.length ? JSON.parse(String(rows[0].value)) : {};
  const result=applyPolicy(state,input);
  state.lastSeen=Date.now();
  this.ctx.storage.sql.exec('INSERT INTO policy_state(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',JSON.stringify(state));
  await this.ctx.storage.setAlarm(Date.now()+30*86400000);
  return result;
 }
 async alarm() {
  const rows=this.ctx.storage.sql.exec("SELECT value FROM policy_state WHERE id=1").toArray();
  if(rows.length && JSON.parse(String(rows[0].value)).lastSeen <= Date.now()-30*86400000) this.ctx.storage.sql.exec("DELETE FROM policy_state");
 }
}
