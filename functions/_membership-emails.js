import { fileUrl, number, unwrap } from './_baserow.js';

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money=value=>`£${Number(value||0).toFixed(2)}`;
const displayDate=value=>{const raw=String(value||'').trim();if(!raw)return '';if(!/^\d{4}-\d{2}-\d{2}/.test(raw))return raw;const d=new Date(`${raw.slice(0,10)}T12:00:00Z`);return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/London'}).format(d);};

export const LIFECYCLE_EMAIL_FIELDS={
  pauseConfirmation:'Pause confirmation email HTML',
  pauseEnding:'Pause ending email HTML',
  paymentOverdue:'Payment overdue email HTML',
  inactive:'Membership inactive email HTML',
  stillInactive:'Membership still inactive email HTML',
  closure:'Membership closure email HTML'
};

const shell=(title,body)=>`<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#ded8cc;font-family:Arial,Helvetica,sans-serif;color:#30272c;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ded8cc;width:100%;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#faf7f2;border-collapse:collapse;"><tr><td style="background:#5a2d4d;padding:24px 32px;color:#faf7f2;"><h1 style="margin:0;font-family:Georgia,serif;font-size:28px;line-height:1.2;">${title}</h1></td></tr><tr><td style="padding:30px 38px;font-size:16px;line-height:1.65;">${body}</td></tr><tr><td style="background:#5a2d4d;padding:22px 28px;color:#ded8cc;text-align:center;font-size:12px;line-height:1.6;">Rooted Commons is operated by Roots to Fruits CIC.<br><a href="https://rootedcommons.uk/contact/" style="color:#ded8cc;">Contact</a> &middot; <a href="https://rootedcommons.uk/privacy/" style="color:#ded8cc;">Privacy notice</a> &middot; <a href="https://rootedcommons.uk/membership-terms/" style="color:#ded8cc;">Membership terms</a></td></tr></table></td></tr></table></body></html>`;

export const FALLBACK_EMAILS={
  pauseConfirmation:shell('Your membership pause is confirmed',`<p>Hi {{first_name}},</p><p>Your Rooted Commons membership is paused from <strong>{{pause_start_date}}</strong> until <strong>{{pause_end_date}}</strong>.</p><div style="margin:20px 0;padding:18px 20px;background:#f8f2e9;border-left:4px solid #5a2d4d;"><strong>Your streak is frozen at {{consecutive_weeks}} consecutive weeks.</strong><br>You have {{pause_weeks_remaining}} of your 8 pause weeks remaining this calendar year.</div><p>Your existing member perks remain available and you can still place orders while paused. We won’t send the usual weekly market email or regular-payment reminders during your pause.</p><p>You can still sign in on a device you have already authenticated, or <a href="{{signin_url}}" style="color:#5a2d4d;font-weight:bold;">request a sign-in link</a> whenever you need one.</p>`),
  pauseEnding:shell('Your membership pause is ending',`<p>Hi {{first_name}},</p><p>Your Rooted Commons pause ends on <strong>{{pause_end_date}}</strong>.</p><p>Your regular commitment and consecutive-weeks streak will resume after your pause. Please make sure your standing order is ready to restart.</p><p><a href="{{dashboard_url}}" style="color:#5a2d4d;font-weight:bold;">Open your member dashboard</a></p>`),
  paymentOverdue:shell('Your regular payment hasn’t arrived',`<p>Hi {{first_name}},</p><div style="margin:0 0 20px;padding:18px 20px;background:#f8f2e9;border-left:4px solid #5a2d4d;"><strong>Your regular payment hasn’t arrived.</strong><br>Your consecutive-weeks streak is frozen while we wait.</div><p>If you’re taking a break, <a href="https://rootedcommons.uk/faqs/#pauses" style="color:#5a2d4d;font-weight:bold;">let us know</a>. You can pause your regular commitment for up to 8 weeks in each calendar year without losing your streak.</p><p>If this was simply missed or delayed, please check your standing order. Your streak is protected for one calendar month from the missed payment date.</p>`),
  inactive:shell('Your membership is inactive',`<p>Hi {{first_name}},</p><div style="margin:0 0 20px;padding:18px 20px;background:#f8f2e9;border-left:4px solid #5a2d4d;"><strong>Your membership is inactive.</strong><br>We haven’t received your regular commitment for a calendar month, so your consecutive-weeks streak has ended and progression perks have reset.</div><p>You can restart your membership at any time by resuming your regular commitment. Any Member Credit already in your account remains available to spend.</p><p>If we’ve got this wrong, please get in touch.</p>`),
  stillInactive:shell('Your Rooted Commons membership is still inactive',`<p>Hi {{first_name}},</p><p>Your account and any Member Credit are still here if you’d like to come back. You can restart your membership by resuming your regular commitment.</p><p>If you meant to arrange a break or think we’ve got something wrong, just get in touch. If you don’t plan to return, you don’t need to do anything. Inactive memberships are normally closed after six months without a regular payment.</p>`),
  closure:shell('We’re closing your Rooted Commons membership',`<p>Hi {{first_name}},</p><p>We haven’t received a regular commitment for six months, so we’re closing your inactive membership.</p>{{#if has_credit}}<div style="margin:20px 0;padding:18px 20px;background:#f8f2e9;border-left:4px solid #5a2d4d;"><strong>You still have {{member_credit}} of Member Credit.</strong><br>Closing your membership does not remove this balance. Contact us if you would like to use or resolve it.</div>{{/if}}<p>You can come back in future. Contact us and we can reopen access for you; a new consecutive-weeks streak will begin when your regular commitment resumes.</p>`)
};

export function lifecycleEmailData({member,settings={},pauseWeeksRemaining=0,pauseStart='',pauseEnd='',dashboardUrl='https://rootedcommons.uk/dashboard/',signinUrl='https://rootedcommons.uk/signin/'}){
  const credit=number(member['Current credit']);
  return {
    first_name:unwrap(member['First name'])||'there',
    member_ref:unwrap(member['Member number'])||`RC-${member.id}`,
    member_credit:money(credit),
    has_credit:credit>0.004,
    consecutive_weeks:String(Math.max(0,number(member['Consecutive weeks']))),
    previous_streak_weeks:String(Math.max(0,number(member['Previous streak weeks']))),
    pause_start_date:displayDate(pauseStart),
    pause_end_date:displayDate(pauseEnd),
    pause_weeks_remaining:String(Math.max(0,pauseWeeksRemaining)),
    dashboard_url:dashboardUrl,
    signin_url:signinUrl,
    contact_email:unwrap(settings['Contact email'])||'info@rootedcommons.uk',
    bank_account_name:unwrap(settings['Bank account name']),
    bank_sort_code:unwrap(settings['Bank sort code']),
    bank_account_number:unwrap(settings['Bank account number']),
    header_logo_url:fileUrl(settings['Header logo']),
    footer_logo_url:fileUrl(settings['Footer logo'])||fileUrl(settings['Header logo'])
  };
}

function renderVariables(template,data){
  return String(template||'').replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g,(_m,key)=>escapeHtml(data[key]??''));
}
export function renderLifecycleTemplate(template,data){
  let html=String(template||'');
  html=html.replace(/{{#if\s+has_credit}}([\s\S]*?){{\/if}}/g,(_m,inner)=>data.has_credit?inner:'');
  html=renderVariables(html,data);
  if(/{{[^}]+}}/.test(html)) throw new Error('Lifecycle email template contains an unsupported or unresolved placeholder');
  return html;
}

export function renderLifecycleEmail({kind,template,...input}){
  const data=lifecycleEmailData(input);
  const fallback=FALLBACK_EMAILS[kind];
  if(!fallback) throw new Error(`Unknown lifecycle email kind: ${kind}`);
  const candidate=String(template||'').trim();
  try{
    return {html:renderLifecycleTemplate(candidate||fallback,data),data,usedFallback:!candidate};
  }catch(error){
    console.error('membership lifecycle email template render failed; using fallback',{kind,error});
    return {html:renderLifecycleTemplate(fallback,data),data,usedFallback:true};
  }
}

export function lifecycleEmailText(kind,data){
  const intros={
    pauseConfirmation:`Your membership is paused from ${data.pause_start_date} until ${data.pause_end_date}. Your streak is frozen at ${data.consecutive_weeks} consecutive weeks. You have ${data.pause_weeks_remaining} of 8 pause weeks remaining this calendar year. Weekly market emails and regular-payment reminders are paused, but you can still sign in and order.`,
    pauseEnding:`Your membership pause ends on ${data.pause_end_date}. Please make sure your standing order is ready to restart.`,
    paymentOverdue:`Your regular payment hasn't arrived. Your streak is frozen. If you're taking a break, let us know. Your streak is protected for one calendar month from the missed payment date.`,
    inactive:`Your membership is inactive. Your consecutive-weeks streak has ended and progression perks have reset. Any existing Member Credit remains available to spend.`,
    stillInactive:`Your membership is still inactive. You can restart by resuming your regular commitment. Inactive memberships are normally closed after six months without a regular payment.`,
    closure:`We're closing your Rooted Commons membership after six months without a regular payment.${data.has_credit?` You still have ${data.member_credit} of Member Credit, which is not lost.`:''}`
  };
  return `Rooted Commons\n\nHi ${data.first_name},\n\n${intros[kind]||''}\n\nQuestions? Contact ${data.contact_email}.`;
}
