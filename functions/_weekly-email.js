import { fileUrl, number, unwrap, truthy } from './_baserow.js';

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const decimal=value=>(Number(value)||0).toFixed(2);
const safeHref=value=>/^(?:\/|#|https?:\/\/|mailto:|tel:)/i.test(String(value||'').trim())?String(value).trim():'#';
function limitedMarkdown(value=''){
  let out=escapeHtml(String(value||''));
  out=out.replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_m,label,href)=>`<a href=\"${escapeHtml(safeHref(href))}\" style=\"color:#5a2d4d;font-weight:bold;\">${label}</a>`);
  out=out.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  return out.replace(/\r?\n/g,'<br>');
}

export const WEEKLY_EMAIL_TEMPLATE_FIELD='Weekly orders closed email HTML';

// Deliberately simpler than the editable Baserow template. This is the emergency
// delivery fallback if the Site Settings field is blank or cannot be rendered.
export const FALLBACK_WEEKLY_EMAIL_HTML=`<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#ded8cc;font-family:Arial,Helvetica,sans-serif;color:#5a2d4d;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your new Rooted Commons access link.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ded8cc;width:100%;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#faf7f2;border-collapse:collapse;">
<tr><td style="padding:34px 40px 10px;"><h1 style="margin:0 0 18px;color:#5a2d4d;font-family:Georgia,serif;font-size:30px;">Orders are closed</h1><p style="margin:0;font-size:16px;line-height:1.6;">Hi {{first_name}},</p></td></tr>
<tr><td style="padding:10px 40px 0;"><p style="margin:0;font-size:16px;line-height:1.6;">Your current member balance is <strong>&pound;{{balance}}</strong>.</p></td></tr>
{{#if balance_negative}}
<tr><td style="padding:20px 40px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f2e9;border:1px solid #d9dec5;border-left:4px solid #5a2d4d;"><tr><td style="padding:18px 20px;"><p style="margin:0 0 10px;font-size:15px;line-height:1.6;"><strong>Your account is &pound;{{amount_due}} short.</strong> Please bring your balance to &pound;0.00 or above before Thursday morning.</p><p style="margin:0;font-size:15px;line-height:1.6;"><a href="{{topup_url}}" style="color:#5a2d4d;font-weight:bold;">Top up from your dashboard</a>.</p></td></tr></table></td></tr>
{{/if}}
{{#if payment_overdue}}
<tr><td style="padding:20px 40px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f2e9;border:1px solid #ded8cc;border-left:4px solid #5a2d4d;"><tr><td style="padding:18px 20px;"><p style="margin:0 0 8px;font-size:16px;line-height:1.6;"><strong>{{payment_overdue_heading}}</strong></p><p style="margin:0;font-size:15px;line-height:1.6;">{{payment_overdue_body_html}}</p></td></tr></table></td></tr>
{{/if}}
<tr><td style="padding:22px 40px 8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f2e9;border:1px solid #d9dec5;"><tr><td align="center" style="padding:26px 24px;"><a href="{{login_url}}" style="display:inline-block;background:#5a2d4d;color:#faf7f2;font-family:Georgia,serif;font-size:18px;text-decoration:none;padding:14px 30px;">Browse next week's market</a><p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:#3f6b3d;">This private link stops working at 18.05 on Wednesday {{cutoff_date}}.</p></td></tr></table></td></tr>
{{#if order}}
<tr><td style="padding:24px 40px 0;"><h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;">Your collection</h2><p style="margin:0 0 14px;font-size:15px;line-height:1.6;"><strong>{{collection_point_name}}</strong><br>{{collection_point_address}}<br>{{preferred_day}} {{collection_window}}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;background:#f8f2e9;border:1px solid #d9dec5;">{{#each order.items}}<tr><td style="padding:9px 12px;font-size:14px;border-bottom:1px solid #d9dec5;">{{name}}</td><td align="center" style="padding:9px 8px;font-size:14px;border-bottom:1px solid #d9dec5;">{{qty}}</td><td align="right" style="padding:9px 12px;font-size:14px;border-bottom:1px solid #d9dec5;">&pound;{{total}}</td></tr>{{/each}}</table></td></tr>
{{/if}}
{{#unless order}}
<tr><td style="padding:22px 40px 0;"><p style="margin:0;font-size:15px;line-height:1.6;color:#3f6b3d;">You didn't order this week, so there's nothing to collect.</p></td></tr>
{{/unless}}
<tr><td style="padding:28px 40px 34px;"><p style="margin:0;font-size:14px;line-height:1.6;">Questions? Reply to this email or contact <a href="mailto:{{contact_email}}" style="color:#5a2d4d;">{{contact_email}}</a>.</p></td></tr>
</table></td></tr></table>
</body></html>`;

function formatCutoff(expiresAt){
  const date=new Date(expiresAt);
  if(!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',day:'numeric',month:'long',year:'numeric'}).format(date);
}
function parseItems(raw){
  try{
    const parsed=JSON.parse(String(raw||'[]'));
    return Array.isArray(parsed)?parsed:[];
  }catch{return [];}
}
function badgeFor(member,settings){
  const founder=unwrap(member['Founder badge']||member['Founder level']||member['Membership badge']);
  const images={
    'Founder 10':fileUrl(settings['Founder 10 badge']),
    'Founder 25':fileUrl(settings['Founder 25 badge']),
    'Founder 50':fileUrl(settings['Founder 50 badge'])
  };
  return {label:founder||'Rooted Commons member',image:images[founder]||fileUrl(settings['Member badge'])||''};
}

export function weeklyEmailData({member,settings,interfaceContent={},order,collectionPoint,accessUrl,expiresAt}){
  const balance=number(member['Current credit']);
  const badge=badgeFor(member,settings);
  const items=order?parseItems(order['Item JSON']):[];
  return {
    first_name:unwrap(member['First name'])||'there',
    balance:decimal(balance),
    balance_negative:balance<0,
    weekly_newsletter:truthy(member['Weekly newsletter'],false),
    payment_overdue:Boolean(member['Regular payment overdue since']) && (unwrap(member['Membership status'])||'Active')==='Active',
    payment_overdue_heading:interfaceContent['dashboard.payment_overdue_heading']||'Your regular payment hasn’t arrived',
    payment_overdue_body_html:limitedMarkdown(interfaceContent['dashboard.payment_overdue_body']||"We haven’t received the regular payment we were expecting. If you’re taking a break, [let us know](/faqs/#pauses) and you can pause your regular commitment for up to 8 weeks in each calendar year without losing your [consecutive-weeks streak](/faqs/#member-streaks). Your streak is protected for one calendar month from the missed payment date."),
    amount_due:decimal(Math.abs(Math.min(balance,0))),
    member_ref:unwrap(member['Member number'])||`RC-${member.id}`,
    login_url:accessUrl,
    topup_url:accessUrl,
    cutoff_date:formatCutoff(expiresAt),
    membership_tier:badge.label,
    badge_image_url:badge.image,
    badge_url:accessUrl,
    contact_email:unwrap(settings['Contact email'])||'orders@rootedcommons.uk',
    bank_account_name:unwrap(settings['Bank account name']),
    bank_sort_code:unwrap(settings['Bank sort code']),
    bank_account_number:unwrap(settings['Bank account number']),
    bank_details:Boolean(unwrap(settings['Bank account name'])&&unwrap(settings['Bank sort code'])&&unwrap(settings['Bank account number'])),
    header_logo_url:fileUrl(settings['Header logo']),
    footer_logo_url:fileUrl(settings['Footer logo'])||fileUrl(settings['Header logo']),
    preferred_day:order?unwrap(order['Collection day']):'',
    collection_point_name:order?(unwrap(collectionPoint?.Name)||unwrap(order['Collection point'])):'',
    collection_point_address:order?unwrap(collectionPoint?.Address):'',
    collection_window:order?unwrap(order['Collection time']):'',
    order:order?{
      total:decimal(number(order['Order total'])),
      items:items.map(item=>({
        name:item.product_name||item.name||'Item',
        qty:item.quantity??item.qty??'',
        total:decimal(item.line_total??item.total??0)
      }))
    }:null
  };
}

function valueHtml(key,value){
  if(key.endsWith('_html')) return String(value||'');
  if(key==='collection_point_address') return escapeHtml(value).replace(/\r?\n/g,'<br>');
  return escapeHtml(value);
}
function renderVariables(template,data){
  return template.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g,(_match,key)=>{
    const value=key.split('.').reduce((current,part)=>current==null?'':current[part],data);
    return valueHtml(key,value??'');
  });
}
export function renderWeeklyEmailTemplate(template,data){
  let html=String(template||'');
  html=html.replace(/{{#each\s+order\.items}}([\s\S]*?){{\/each}}/g,(_match,inner)=>{
    const items=data.order?.items||[];
    return items.map(item=>renderVariables(inner,item)).join('');
  });
  html=html.replace(/{{#if\s+bank_details}}([\s\S]*?){{\/if}}/g,(_match,inner)=>data.bank_details?inner:'');
  html=html.replace(/{{#if\s+balance_negative}}([\s\S]*?){{\/if}}/g,(_match,inner)=>data.balance_negative?inner:'');
  html=html.replace(/{{#if\s+payment_overdue}}([\s\S]*?){{\/if}}/g,(_match,inner)=>data.payment_overdue?inner:'');
  html=html.replace(/{{#if\s+weekly_newsletter}}([\s\S]*?){{\/if}}/g,(_match,inner)=>data.weekly_newsletter?inner:'');
  html=html.replace(/{{#if\s+order}}([\s\S]*?){{\/if}}/g,(_match,inner)=>data.order?inner:'');
  html=html.replace(/{{#unless\s+order}}([\s\S]*?){{\/unless}}/g,(_match,inner)=>data.order?'':inner);
  html=renderVariables(html,data);
  // Reject unrecognised template directives rather than sending broken control syntax.
  if(/{{[^}]+}}/.test(html)) throw new Error('Weekly email template contains an unsupported or unresolved placeholder');
  return html;
}

export function renderWeeklyEmail({template,member,settings,interfaceContent={},order,collectionPoint,accessUrl,expiresAt}){
  const data=weeklyEmailData({member,settings,interfaceContent,order,collectionPoint,accessUrl,expiresAt});
  const candidate=String(template||'').trim();
  const useEditable=candidate && candidate.includes('{{login_url}}');
  try{
    return {html:renderWeeklyEmailTemplate(useEditable?candidate:FALLBACK_WEEKLY_EMAIL_HTML,data),data,usedFallback:!useEditable};
  }catch(error){
    console.error('weekly email template render failed; using fallback',error);
    return {html:renderWeeklyEmailTemplate(FALLBACK_WEEKLY_EMAIL_HTML,data),data,usedFallback:true};
  }
}

export function weeklyEmailText(data){
  const arrears=data.balance_negative?`\nYour account is £${data.amount_due} short. Please bring your balance to £0.00 or above before Thursday morning.\nTop up: ${data.topup_url}\n`:'';
  const overdue=data.payment_overdue?`\n${data.payment_overdue_heading}\nYour consecutive-weeks streak is frozen while we wait for your regular payment. If you're taking a break, see https://rootedcommons.uk/faqs/#pauses\n`:'';
  const order=data.order?`\nFor collection on ${data.preferred_day}\n${data.collection_point_name}${data.collection_point_address?`\n${data.collection_point_address}`:''}${data.collection_window?`\n${data.collection_window}`:''}\n${data.order.items.map(item=>`- ${item.name} × ${item.qty}: £${item.total}`).join('\n')}\n`:`\nYou didn't order this week, so there's nothing to collect.\n`;
  return `Orders are closed\n\nHi ${data.first_name},\n\nBalance: £${data.balance}\n${arrears}${overdue}\nThis week's market is closed and next week's is now open.\n\nBrowse next week's market:\n${data.login_url}\n\nThis private link stops working at 18.05 on Wednesday ${data.cutoff_date}.\n${order}\nQuestions? Reply to this email or contact ${data.contact_email}.\n\nRooted Commons is operated by Roots to Fruits CIC.`;
}
