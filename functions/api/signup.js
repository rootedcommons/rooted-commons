import { createRow, envConfig, json, listRows, normaliseEmail } from '../_baserow.js';
const clean=value=>String(value||'').trim();
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
export async function onRequestPost({request,env}){
  try{
    const body=await request.json(); const email=normaliseEmail(body.email); const firstName=clean(body.firstName); const lastName=clean(body.lastName); const phone=clean(body.phone); const weeklyCommitment=Number(body.weeklyCommitment); const collectionPointId=Number(body.collectionPointId);
    if(!firstName||!lastName||!email||!email.includes('@')||!Number.isFinite(collectionPointId)||collectionPointId<1||!Number.isFinite(weeklyCommitment)||weeklyCommitment<1||body.membershipConsent!==true)return json({ok:false,message:'Please complete all required fields.'},400);
    const cfg=envConfig(env); const members=await listRows(cfg,cfg.members); if(members.some(row=>normaliseEmail(row.Email)===email))return json({ok:false,message:'There is already a membership using this email address.'},409);
    const fields={'First name':firstName,'Last name':lastName,'Email':email,'Active':true,'Order token':token(),'Weekly commitment':weeklyCommitment,'Collection point':[collectionPointId],'Member since':new Date().toISOString().slice(0,10),'Membership consent':true,'Membership consent at':new Date().toISOString(),'Marketing consent':body.marketingConsent===true};
    if(phone)fields.Phone=phone;
    const member=await createRow(cfg,cfg.members,fields);
    return json({ok:true,memberId:member.id},201);
  }catch(error){return json({ok:false,message:'We could not create your membership. Please try again.',detail:String(error.message||error)},500);}
}
