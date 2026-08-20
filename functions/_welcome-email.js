import { fileUrl, number, unwrap } from './_baserow.js';

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const currency=value=>`£${Number(value||0).toFixed(2)}`;

export const WELCOME_EMAIL_TEMPLATE_FIELD='Welcome email HTML';

export const FALLBACK_WELCOME_EMAIL_HTML=`<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#ded8cc;font-family:Arial,Helvetica,sans-serif;color:#30272c;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ded8cc;width:100%;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#faf7f2;border-collapse:collapse;">
<tr><td align="center" style="background:#5a2d4d;padding:28px 24px;"><img src="{{header_logo_url}}" width="150" alt="Rooted Commons" style="display:block;width:150px;max-width:80%;height:auto;border:0;"></td></tr>
<tr><td style="padding:34px 40px 18px;"><h1 style="margin:0 0 18px;color:#5a2d4d;font-family:Georgia,serif;font-size:30px;">Welcome to Rooted Commons</h1><p style="font-size:16px;line-height:1.6;">Hi {{first_name}},</p><p style="font-size:16px;line-height:1.6;">Thanks for joining Rooted Commons. Your membership has been created successfully.</p></td></tr>
<tr><td style="padding:0 40px 22px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f2e9;border-left:4px solid #5a2d4d;"><tr><td style="padding:18px 20px;"><h2 style="margin:0 0 12px;color:#5a2d4d;font-family:Georgia,serif;font-size:22px;">Please set up your regular payment</h2><p style="margin:0 0 12px;line-height:1.6;">Your {{commitment_frequency}} commitment is <strong>{{commitment_amount}}</strong>. Set up a standing order with these details:</p><p style="margin:0;line-height:1.7;">{{bank_account_name}}<br>Sort code: <strong>{{bank_sort_code}}</strong><br>Account number: <strong>{{bank_account_number}}</strong><br>Reference: <strong>{{member_ref}}</strong></p><p style="margin:8px 0 0;font-size:13px;line-height:1.55;font-style:italic;font-weight:bold;text-align:right;">Please include your member reference exactly as shown above.<br>It’s how payments get linked to your account.</p><p style="margin:18px 0 0;line-height:1.6;">You can pause your regular commitment for up to <strong>8 weeks in each calendar year</strong> without losing your <a href="https://rootedcommons.uk/faqs/#member-streaks" style="color:#5a2d4d;font-weight:bold;">Member Streak</a>.</p></td></tr></table></td></tr>
<tr><td align="center" style="padding:8px 40px 26px;"><a href="{{login_url}}" style="display:inline-block;background:#5a2d4d;color:#faf7f2;font-family:Georgia,serif;font-size:18px;text-decoration:none;padding:14px 30px;border-radius:10px;">Start your first order</a><p style="margin:14px 0 0;font-size:13px;line-height:1.5;"><strong>No password needed.</strong> This secure link signs you in on this device. We refresh these links weekly to keep your account secure.</p></td></tr>
<tr><td style="padding:0 40px 34px;"><p style="margin:0;font-size:16px;line-height:1.6;"><strong>Thank you for joining Rooted Commons.</strong> Your regular commitment helps create the reliable demand that makes a stronger local food network possible.</p></td></tr>
</table></td></tr></table></body></html>`;

export function welcomeEmailData({firstName,memberRef,contributionFrequency,contributionAmount,loginUrl,settings={},member={}}){
  return {
    first_name:String(firstName||'').trim()||'there',
    member_ref:String(memberRef||'').trim(),
    commitment_frequency:String(contributionFrequency||'').trim().toLowerCase(),
    commitment_amount:currency(contributionAmount),
    login_url:String(loginUrl||'').trim(),
    bank_account_name:unwrap(settings['Bank account name']),
    bank_sort_code:unwrap(settings['Bank sort code']),
    bank_account_number:unwrap(settings['Bank account number']),
    balance:Number(number(member['Current credit'])||0).toFixed(2),
    membership_tier:unwrap(member['Founder badge']||member['Founder level']||member['Membership badge'])||'Rooted Commons member',
    badge_image_url:(()=>{const founder=unwrap(member['Founder badge']||member['Founder level']||member['Membership badge']);const images={'Founder 10':fileUrl(settings['Founder 10 badge']),'Founder 25':fileUrl(settings['Founder 25 badge']),'Founder 50':fileUrl(settings['Founder 50 badge'])};return images[founder]||fileUrl(settings['Member badge'])||'';})(),
    badge_url:String(loginUrl||'').trim(),
    header_logo_url:fileUrl(settings['Header logo'])
  };
}

function normaliseWelcomeTemplate(template){
  let html=String(template||'');
  html=html.replace(/(<img\b[^>]*\balt=["']Rooted Commons["'][^>]*\bwidth=["'])240(["'])/gi,(_m,a,b)=>`${a}150${b}`);
  html=html.replace(/(<img\b[^>]*\bwidth=["'])240(["'][^>]*\balt=["']Rooted Commons["'])/gi,(_m,a,b)=>`${a}150${b}`);
  html=html.replace(/width\s*:\s*240px/gi,'width:150px');
  html=html.replace(/<span\b[^>]*>\s*{{\s*membership_tier\s*}}\s*<\/span>/gi,'');
  // Welcome emails are always sent before any Member Credit can have accumulated, so
  // keep the founder badge but remove the redundant £0.00 Balance section.
  html=html.replace(/<tr>\s*<td\b[^>]*style=["'][^"']*padding\s*:\s*0\s+12px\s+14px[^"']*["'][^>]*>\s*<table[\s\S]*?<span\b[^>]*>\s*Balance\s*<\/span>[\s\S]*?<\/table>\s*<\/td>\s*<\/tr>/gi,'');
  html=html.replace(/<p\b[^>]*>\s*Your\s+{{\s*commitment_frequency\s*}}\s+commitment\s+is\s+<strong>{{\s*commitment_amount\s*}}<\/strong>\.[\s\S]*?Set up a standing order with these details:\s*<\/p>/gi,'<p style="margin:0 0 18px;font-size:15px;line-height:1.6;">Your {{commitment_frequency}} commitment is <strong>{{commitment_amount}}</strong>. Set up a standing order with these details:</p>');
  html=html.replace(/<p\b[^>]*>\s*Please include your member reference exactly as shown above\.<br\s*\/?>\s*It[’']s how payments get linked to your account\.\s*<\/p>/gi,'<p style="margin:8px 0 0;font-size:13px;line-height:1.55;font-style:italic;font-weight:bold;text-align:right;">Please include your member reference exactly as shown above.<br>It’s how payments get linked to your account.</p>');
  if(!/without losing your\s*<a\b[^>]*>\s*Member Streak\s*<\/a>/i.test(html)){
    html=html.replace(/(<p\b[^>]*>\s*Please include your member reference exactly as shown above\.<br\s*\/?>\s*It[’']s how payments get linked to your account\.\s*<\/p>)/i,'$1<p style="margin:18px 0 0;font-size:15px;line-height:1.6;">You can pause your regular commitment for up to <strong>8 weeks in each calendar year</strong> without losing your <a href="https://rootedcommons.uk/faqs/#member-streaks" style="color:#5a2d4d;font-weight:bold;">Member Streak</a>.</p>');
  }
  html=html.replace(/>\s*Your member dashboard\s*<\/a>/gi,'>Start your first order</a>');
  html=html.replace(/<p\b[^>]*>\s*<strong>No password needed\.<\/strong>[\s\S]*?<\/p>/i,'<p style="margin:20px 0 0;font-size:13px;line-height:1.55;"><strong>No password needed.</strong> This secure link signs you in on this device. We refresh these links weekly to keep your account secure.</p>');
  return html;
}

export function renderWelcomeEmailTemplate(template,data){
  let html=String(template||'');
  html=html.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g,(_match,key)=>escapeHtml(data[key]??''));
  if(/{{[^}]+}}/.test(html)) throw new Error('Welcome email template contains an unsupported or unresolved placeholder');
  return html;
}

export function renderWelcomeEmail({template,...input}){
  const data=welcomeEmailData(input);
  const candidate=String(template||'').trim();
  const useEditable=candidate && candidate.includes('{{login_url}}');
  try{
    return {html:renderWelcomeEmailTemplate(normaliseWelcomeTemplate(useEditable?candidate:FALLBACK_WELCOME_EMAIL_HTML),data),data,usedFallback:!useEditable};
  }catch(error){
    console.error('welcome email template render failed; using fallback',error);
    return {html:renderWelcomeEmailTemplate(normaliseWelcomeTemplate(FALLBACK_WELCOME_EMAIL_HTML),data),data,usedFallback:true};
  }
}

export function welcomeEmailText(data){
  return `Welcome to Rooted Commons\n\nHi ${data.first_name},\n\nThanks for joining Rooted Commons.\n\nPlease set up your regular payment\nYour ${data.commitment_frequency} commitment is ${data.commitment_amount}. Set up a standing order with these details:\n${data.bank_account_name}\nSort code: ${data.bank_sort_code}\nAccount number: ${data.bank_account_number}\nReference: ${data.member_ref}\n\nPlease include your member reference exactly as shown above. It’s how payments get linked to your account.\n\nYou can pause your regular commitment for up to 8 weeks in each calendar year without losing your Member Streak: https://rootedcommons.uk/faqs/#member-streaks\n\nStart your first order:\n${data.login_url}\n\nNo password needed. This secure link signs you in on this device. We refresh these links weekly to keep your account secure.\n\nKeep your link private. Remember to sign out after using someone else’s device.\n\nThank you for joining Rooted Commons.`;
}
