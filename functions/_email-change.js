const encoder=new TextEncoder();
const bytesToBase64Url=bytes=>{let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function createEmailChangeToken(){return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));}
export async function hashEmailChangeToken(token){const digest=await crypto.subtle.digest('SHA-256',encoder.encode(String(token||'')));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}

export function maskedEmail(value){
  const email=String(value||'').trim();
  const at=email.lastIndexOf('@');
  if(at<1)return email;
  const local=email.slice(0,at),domain=email.slice(at+1);
  const visible=local.slice(0,1);
  return `${visible}${'•'.repeat(Math.max(3,Math.min(8,local.length-1)))}@${domain}`;
}

export function emailChangeSecurityNotice({newEmail,headerLogoUrl=''}){
  const masked=maskedEmail(newEmail);
  const logo=headerLogoUrl
    ? `<img src="${escapeHtml(headerLogoUrl)}" width="150" alt="Rooted Commons" style="display:block;width:150px;max-width:80%;height:auto;border:0;">`
    : '<strong style="color:#faf7f2;font-family:Georgia,serif;font-size:26px;">Rooted Commons</strong>';
  const html=`<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#ded8cc;font-family:Arial,Helvetica,sans-serif;color:#30272c;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ded8cc;width:100%;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#faf7f2;border-collapse:collapse;"><tr><td align="center" style="background:#5a2d4d;padding:28px 24px;">${logo}</td></tr><tr><td style="padding:34px 40px;font-size:16px;line-height:1.65;"><h1 style="margin:0 0 18px;color:#5a2d4d;font-family:Georgia,serif;font-size:28px;">Your email address was changed</h1><p style="margin:0 0 16px;">The email address on your Rooted Commons membership has been changed to <strong>${escapeHtml(masked)}</strong>.</p><p style="margin:0 0 16px;">If you made this change, you don’t need to do anything.</p><p style="margin:0;"><strong>If you did not make this change, please <a href="https://rootedcommons.uk/contact/" style="color:#5a2d4d;">contact Rooted Commons immediately</a>.</strong></p></td></tr><tr><td align="center" style="background:#5a2d4d;padding:24px 28px;color:#ded8cc;font-size:12px;line-height:1.6;">Rooted Commons is operated by Roots to Fruits CIC.<br><a href="https://rootedcommons.uk/contact/" style="color:#ded8cc;">Contact</a> &middot; <a href="https://rootedcommons.uk/privacy/" style="color:#ded8cc;">Privacy notice</a></td></tr></table></td></tr></table></body></html>`;
  const text=`Your Rooted Commons email address was changed\n\nThe email address on your Rooted Commons membership has been changed to ${masked}.\n\nIf you made this change, you don’t need to do anything.\n\nIf you did not make this change, contact Rooted Commons immediately: https://rootedcommons.uk/contact/`;
  return {html,text};
}
