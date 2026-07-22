import { envConfig, json, listRows, normaliseEmail } from '../_baserow.js';
export async function onRequestPost({ request, env }) {
  try {
    const body=await request.json(); const email=normaliseEmail(body.email);
    if (!email) return json({ok:false,message:'Enter a valid email address.'},400);
    const cfg=envConfig(env); const members=await listRows(cfg,cfg.members);
    const member=members.find(row=>normaliseEmail(row.Email)===email && row.Active !== false);
    if (member && env.MAGIC_LINK_WEBHOOK_URL) {
      const origin=new URL(request.url).origin;
      const link=`${origin}/orders/?token=${encodeURIComponent(member['Order token'] || '')}`;
      await fetch(env.MAGIC_LINK_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,link,member:{firstName:member['First name']||''},basketSummary:body.basketSummary||[]})});
    }
    return json({ok:true,message:'If that email belongs to an active member, a secure ordering link will be sent. Otherwise, we will send information about joining.'});
  } catch (error) { return json({ok:false,message:'We could not process that request.',detail:String(error.message||error)},500); }
}
