import { createRow, envConfig, json, listRows, normaliseEmail, publicCollectionPoint, truthy } from '../_baserow.js';

const clean=value=>String(value||'').trim();
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
const money=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
const hasPennyPrecision=value=>Number.isFinite(Number(value)) && Math.abs(Number(value)*100-Math.round(Number(value)*100))<1e-6;
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
    const firstName=clean(body.firstName);
    const lastName=clean(body.lastName);
    const phone=clean(body.phone);
    const contributionFrequency=clean(body.contributionFrequency);
    const contributionAmount=Number(body.contributionAmount);
    const collectionPointId=Number(body.collectionPointId);
    const preferredCollectionDay=clean(body.preferredCollectionDay);
    const allowedDays=['Thursday','Friday','Saturday','Sunday'];
    const allowedFrequencies=['Weekly','Monthly'];
    const minimum=contributionFrequency==='Monthly'?43.34:10;
    if(!firstName||!lastName||!phone||!email||!email.includes('@')||!Number.isFinite(collectionPointId)||collectionPointId<1||!allowedFrequencies.includes(contributionFrequency)||!hasPennyPrecision(contributionAmount)||contributionAmount<minimum||!allowedDays.includes(preferredCollectionDay)||body.membershipConsent!==true){
      return json({ok:false,message:`Please complete all required fields. ${contributionFrequency==='Monthly'?'Monthly contributions must be at least £43.34':'Weekly contributions must be at least £10.00'} and may be entered to the penny.`},400);
    }

    const weeklyCommitment=contributionFrequency==='Weekly'?money(contributionAmount):money(contributionAmount*12/52);
    const monthlyEquivalent=contributionFrequency==='Monthly'?money(contributionAmount):money(contributionAmount*52/12);

    const cfg=envConfig(env);
    const [members,points]=await Promise.all([listRows(cfg,cfg.members),listRows(cfg,cfg.collectionPoints)]);
    if(members.some(row=>normaliseEmail(row.Email)===email))return json({ok:false,message:'There is already a membership using this email address.'},409);
    const point=points.find(row=>Number(row.id)===collectionPointId && truthy(row.Active,true));
    if(!point)return json({ok:false,message:'That collection point is not currently available.'},409);
    const validDays=(publicCollectionPoint(point).collectionSlots||[]).map(slot=>slot.day);
    if(!validDays.includes(preferredCollectionDay))return json({ok:false,message:`That collection point is not available on ${preferredCollectionDay}. Please choose another location.`},409);

    const now=new Date();
    const fields={
      'First name':firstName,
      'Last name':lastName,
      'Email':email,
      'Phone':phone,
      'Active':true,
      'Order token':token(),
      'Weekly commitment':weeklyCommitment,
      'Monthly equivalent':monthlyEquivalent,
      'Contribution frequency':contributionFrequency,
      'Collection point':[collectionPointId],
      'Preferred collection day':preferredCollectionDay,
      'Member since':now.toISOString().slice(0,10),
      'Membership consent':true,
      'Membership consent at':now.toISOString(),
      'Weekly newsletter':body.weeklyNewsletter===true
    };
    const member=await createRow(cfg,cfg.members,fields);
    return json({ok:true,memberId:member.id},201);
  }catch(error){return json({ok:false,message:'We could not create your membership. Please try again.',detail:String(error.message||error)},500);}
}
