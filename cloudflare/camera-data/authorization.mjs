import { POLICY } from './security-policy.mjs';
const utf8 = new TextEncoder();
/** @param {Uint8Array} bytes */
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
/** @param {string} text */
const bytes = text => Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
/** @param {string} secret */
async function key(secret) {
 if(typeof secret!=='string'||secret.length<32)throw Error('Missing server signing secret');
 return crypto.subtle.importKey('raw',utf8.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
/** @param {string} secret @param {string} value */
export async function privateHash(secret,value) {return b64(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),utf8.encode(value))));}
/** @param {string} secret @param {import("./protocol").TokenClaims} claims */
export async function signToken(secret,claims) {
 const body=b64(utf8.encode(JSON.stringify(claims)));
 return body+'.'+await privateHash(secret,'download-v2.'+body);
}
/** @param {string} secret @param {string} token @param {string} country @param {string} installation @param {number} now @returns {Promise<import("./protocol").TokenClaims>} */
export async function verifyToken(secret,token,country,installation,now=Date.now()) {
 if(typeof token!=='string'||token.length>2000)throw Error('Invalid token');
 const [body,sig,...extra]=token.split('.');if(!body||!sig||extra.length)throw Error('Invalid token');
 if(!await crypto.subtle.verify('HMAC',await key(secret),bytes(sig),utf8.encode('download-v2.'+body)))throw Error('Invalid signature');
 const c=JSON.parse(new TextDecoder().decode(bytes(body))),time=Math.floor(now/1000);
 if(c.v!==2||c.country!==country||c.installation!==installation||!Number.isInteger(c.iat)||!Number.isInteger(c.exp)||c.iat>time+5||c.exp<=time||c.exp-c.iat!==POLICY.tokenTTL||typeof c.jti!=='string'||typeof c.generation!=='string'||!/^[a-f0-9]{64}$/.test(c.version))throw Error('Invalid claims');
 return c;
}
