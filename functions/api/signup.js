import { createRow, envConfig, json, listRows, listRowsFiltered, normaliseEmail, publicCollectionPoint, truthy } from '../_baserow.js';
import { createSignedSession, nextWednesdayExpiry } from '../_auth.js';
import { refreshMemberMetricCache } from '../_public-metrics.js';
import { sendMail } from '../_smtp.js';
import { renderWelcomeEmail, welcomeEmailText, WELCOME_EMAIL_TEMPLATE_FIELD } from '../_welcome-email.js';

const clean=value=>String(value||'').trim();
const money=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
const hasPennyPrecision=value=>Number.isFinite(Number(value))&&Math.abs(Number(value)*100-Math.round(Number(value)*100))<1e-7;
const attempts=new Map();
const RATE_WINDOW_MS=15*60*1000;
const RATE_MAX=5;

function clientIp(request){
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}
function rateLimited(ip){
  const now=Date.now();
  const current=(attempts.get(ip)||[]).filter(time=>now-time<RATE_WINDOW_MS);
  if(current.length>=RATE_MAX){attempts.set(ip,current);return true;}
  current.push(now);attempts.set(ip,current);
  if(attempts.size>1000){for(const [key,times] of attempts){if(!times.some(time=>now-time<RATE_WINDOW_MS))attempts.delete(key);}}
  return false;
}
async function verifyTurnstile(secret,response,ip){
  if(!secret)return {success:false,configurationError:true};
  if(!response)return {success:false};
  const form=new FormData();
  form.append('secret',secret);
  form.append('response',response);
  if(ip && ip!=='unknown')form.append('remoteip',ip);
  const verification=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form});
  if(!verification.ok)return {success:false};
  return verification.json();
}

export async function onRequestPost(context){
  const {request,env}=context;
  try{
    const ip=clientIp(request);
    if(rateLimited(ip))return json({ok:false,message:'Too many signup attempts. Please wait a little while and try again.'},429);

    const body=await request.json();
    const turnstile=await verifyTurnstile(env.TURNSTILE_SECRET_KEY,clean(body.turnstileToken),ip);
    if(turnstile.configurationError)return json({ok:false,message:'Signup protection is not configured. Please contact us.'},503);
    if(!turnstile.success)return json({ok:false,message:'The security check could not be verified. Please try again.'},400);

    const email=normaliseEmail(body.email);
    const confirmEmail=normaliseEmail(body.confirmEmail);
    const firstName=clean(body.firstName);
    const lastName=clean(body.lastName);
    const phone=clean(body.phone);
    const productRequests=clean(body.productRequests);
    const contributionFrequency=clean(body.contributionFrequency);
    const contributionAmount=Number(body.contributionAmount);
    const collectionPointId=Number(body.collectionPointId);
    const preferredCollectionDay=clean(body.preferredCollectionDay);
    const allowedDays=['Thursday','Friday','Saturday','Sunday'];
    const allowedFrequencies=['Weekly','Monthly'];
    const minimum=contributionFrequency==='Monthly'?43.33:10;
    if(!firstName||!lastName||!phone||!email||!email.includes('@')||email!==confirmEmail||!Number.isFinite(collectionPointId)||collectionPointId<1||!allowedFrequencies.includes(contributionFrequency)||!hasPennyPrecision(contributionAmount)||contributionAmount<minimum||!allowedDays.includes(preferredCollectionDay)||body.membershipConsent!==true){
      return json({ok:false,message:`Please complete all required fields. ${contributionFrequency==='Monthly'?'Monthly contributions must be at least £43.33':'Weekly contributions must be at least £10.00'} and may be entered to the penny.`},400);
    }

    const weeklyCommitment=contributionFrequency==='Weekly'?money(contributionAmount):money(contributionAmount*12/52);
    const monthlyEquivalent=contributionFrequency==='Monthly'?money(contributionAmount):money(contributionAmount*52/12);

    const cfg=envConfig(env);
    const [existingMembers,points,members,settingsRows]=await Promise.all([listRowsFiltered(cfg,cfg.members,{Email:email},{size:2}),listRows(cfg,cfg.collectionPoints),listRows(cfg,cfg.members),cfg.settings?listRows(cfg,cfg.settings):Promise.resolve([])]);
    const settings=settingsRows.find(row=>clean(row['Site title']))||settingsRows[0]||{};
    if(existingMembers.some(row=>normaliseEmail(row.Email)===email))return json({ok:false,code:'existing_member',message:'It looks like you’re already a Rooted Commons member.'},409);
    const point=points.find(row=>Number(row.id)===collectionPointId && truthy(row.Active,true));
    if(!point)return json({ok:false,message:'That collection point is not currently available.'},409);
    const validDays=(publicCollectionPoint(point).collectionSlots||[]).map(slot=>slot.day);
    if(!validDays.includes(preferredCollectionDay))return json({ok:false,message:`That collection point is not available on ${preferredCollectionDay}. Please choose another location.`},409);

    const currentTotalMembers=members.filter(row=>truthy(row.Active,true)).length;
    const founderBadge=currentTotalMembers<10
      ? 'Founder 10'
      : currentTotalMembers<25
        ? 'Founder 25'
        : currentTotalMembers<50
          ? 'Founder 50'
          : '';

    const now=new Date();
    const fields={
      'First name':firstName,
      'Last name':lastName,
      'Email':email,
      'Phone':phone,
      'Active':true,
      'Weekly commitment':weeklyCommitment,
      'Monthly equivalent':monthlyEquivalent,
      'Contribution frequency':contributionFrequency,
      'Collection point':[collectionPointId],
      'Preferred collection day':preferredCollectionDay,
      'Member since':now.toISOString(),
      'Membership consent':true,
      'Weekly newsletter':body.weeklyNewsletter===true,
      'Email verified':false,
      'Product requests':productRequests,
      ...(founderBadge?{'Founder badge':founderBadge}:{})
    };
    const member=await createRow(cfg,cfg.members,fields);
    const metricRefresh=refreshMemberMetricCache(cfg,{memberRows:[...members,member]}).catch(error=>console.warn('Unable to refresh public member metrics',error));
    if(typeof context.waitUntil==='function')context.waitUntil(metricRefresh);
    const {token:orderToken}=await createSignedSession(cfg,member.id,env,{purpose:'Weekly access',expiresAt:nextWednesdayExpiry(now)});
    const memberNumber=String(member['Member number']||`RC-${member.id}`);
    const origin=new URL(request.url).origin;
    const dashboardUrl=`/api/access?token=${encodeURIComponent(orderToken)}&return=${encodeURIComponent('/dashboard/')}`;
    const verificationUrl=`${origin}/api/verify-email?token=${encodeURIComponent(orderToken)}`;
    let welcomeEmailSent=false;
    try{
      const rendered=renderWelcomeEmail({
        template:settings[WELCOME_EMAIL_TEMPLATE_FIELD],
        firstName,
        memberRef:memberNumber,
        contributionFrequency,
        contributionAmount,
        loginUrl:verificationUrl,
        settings
      });
      await sendMail(env,{
        to:email,
        subject:'Welcome to Rooted Commons',
        html:rendered.html,
        text:welcomeEmailText(rendered.data)
      });
      welcomeEmailSent=true;
      if(rendered.usedFallback)console.warn('welcome email fallback used',{memberId:member.id});
    }catch(error){
      console.error('welcome email send failed',error);
    }
    return json({ok:true,memberId:member.id,memberNumber,dashboardUrl,welcomeEmailSent},201);
  }catch(error){console.error('signup failed',error);return json({ok:false,message:'We could not create your membership. Please try again.'},500);}
}
