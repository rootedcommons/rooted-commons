import { createRow, envConfig, json, listRows, normaliseEmail, publicCollectionPoint, truthy } from '../_baserow.js';

const clean=value=>String(value||'').trim();
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
const money=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
const hasPennyPrecision=value=>Number.isFinite(Number(value)) && Math.abs(Number(value)*100-Math.round(Number(value)*100))<1e-6;
const nextWednesdayExpiry=(from=new Date())=>{
  const format=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/London',
    year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  });
  const parts=Object.fromEntries(format.formatToParts(from).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const weekday={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[parts.weekday];
  const localMinutes=Number(parts.hour)*60+Number(parts.minute);
  let days=(3-weekday+7)%7;
  if(days===0 && localMinutes>=18*60+5)days=7;

  const localDate=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)));
  localDate.setUTCDate(localDate.getUTCDate()+days);
  const y=localDate.getUTCFullYear();
  const m=localDate.getUTCMonth()+1;
  const d=localDate.getUTCDate();

  // Convert the intended Europe/London wall-clock time (18:05) to UTC,
  // including GMT/BST automatically.
  const targetAsUtc=Date.UTC(y,m-1,d,18,5,0,0);
  let guess=new Date(targetAsUtc);
  for(let i=0;i<3;i+=1){
    const seen=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
      timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(guess).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    const seenAsUtc=Date.UTC(Number(seen.year),Number(seen.month)-1,Number(seen.day),Number(seen.hour),Number(seen.minute));
    guess=new Date(guess.getTime()+(targetAsUtc-seenAsUtc));
  }
  return guess.toISOString();
};
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

export async function onRequestPost({request,env}){
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
    const [members,points]=await Promise.all([listRows(cfg,cfg.members),listRows(cfg,cfg.collectionPoints)]);
    if(members.some(row=>normaliseEmail(row.Email)===email))return json({ok:false,code:'existing_member',message:'It looks like you’re already a Rooted Commons member.'},409);
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
    const orderToken=token();
    const fields={
      'First name':firstName,
      'Last name':lastName,
      'Email':email,
      'Phone':phone,
      'Active':true,
      'Order token':orderToken,
      'Token created':now.toISOString(),
      'Order token expiry':nextWednesdayExpiry(now),
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
    const memberNumber=String(member['Member number']||`RC-${member.id}`);
    const origin=new URL(request.url).origin;
    const dashboardUrl=`/dashboard/?token=${encodeURIComponent(orderToken)}`;
    const verificationUrl=`${origin}/api/verify-email?token=${encodeURIComponent(orderToken)}`;
    let welcomeEmailSent=false;
    const welcomeWebhook=env.WELCOME_EMAIL_WEBHOOK_URL||env.MAGIC_LINK_WEBHOOK_URL;
    if(welcomeWebhook){
      try{
        const response=await fetch(welcomeWebhook,{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({
            event:'member_signup_confirmation',
            email,
            link:verificationUrl,
            verificationLink:verificationUrl,
            dashboardLink:`${origin}${dashboardUrl}`,
            member:{firstName,lastName,memberNumber},
            contribution:{frequency:contributionFrequency,amount:money(contributionAmount)},
            emailContent:{
              subject:'Welcome to Rooted Commons – confirm your email',
              heading:'Welcome to Rooted Commons',
              intro:'Your membership has been created successfully.',
              confirmationText:'Please confirm that this email address belongs to you by opening your secure member link.',
              buttonText:'Confirm my email and open my dashboard',
              securityText:'This is a unique private link to your membership account and member credit. Please do not share it with anyone or use it on someone else’s device.',
              rotationText:'We will send you a new unique link each Wednesday after orders close. When a new link is issued, the previous one stops working.'
            }
          })
        });
        welcomeEmailSent=response.ok;
      }catch{}
    }
    return json({ok:true,memberId:member.id,memberNumber,dashboardUrl,welcomeEmailSent},201);
  }catch(error){return json({ok:false,message:'We could not create your membership. Please try again.',detail:String(error.message||error)},500);}
}
