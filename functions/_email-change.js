const encoder=new TextEncoder();
const bytesToBase64Url=bytes=>{let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
export function createEmailChangeToken(){return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));}
export async function hashEmailChangeToken(token){const digest=await crypto.subtle.digest('SHA-256',encoder.encode(String(token||'')));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
