import { envConfig, json, listRowsFiltered, normaliseEmail, updateRow } from '../_baserow.js';
import { getOrCreateCurrentAccessSession, safeReturnPath } from '../_auth.js';
import { sendMail } from '../_smtp.js';

const recentlyRequested=(member,now,windowMs=60_000)=>{
  const raw=member['Access link requested at'];
  if(!raw)return false;
  const previous=new Date(raw).getTime();
  return Number.isFinite(previous)&&now.getTime()-previous>=0&&now.getTime()-previous<windowMs;
};
const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export async function onRequestPost({request,env}){
  try{
    const body=await request.json();
    const email=normaliseEmail(body.email);
    if(!email)return json({ok:false,message:'Enter a valid email address.'},400);
    const cfg=envConfig(env);
    const members=await listRowsFiltered(cfg,cfg.members,{Email:email},{size:2});
    const member=members.find(row=>normaliseEmail(row.Email)===email&&row.Active!==false);
    if(member){
      const requestedAt=new Date();
      if(!recentlyRequested(member,requestedAt)){
        const {token}=await getOrCreateCurrentAccessSession(cfg,member.id,env);
        const origin=new URL(request.url).origin;
        const returnPath=safeReturnPath(body.returnPath||'/dashboard/');
        const accessUrl=`${origin}/api/access?token=${encodeURIComponent(token)}&return=${encodeURIComponent(returnPath)}`;
        const firstName=escapeHtml(member['First name']||'there');
        await sendMail(env,{
          to:email,
          subject:'Your Rooted Commons access link',
          text:`Hi ${member['First name']||'there'},\n\nHere is your private Rooted Commons access link:\n${accessUrl}\n\nPlease keep this link private.\n\nRooted Commons`,
          html:`<p>Hi ${firstName},</p><p>Here is your private Rooted Commons access link:</p><p><a href="${escapeHtml(accessUrl)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#5a2d4d;color:#ded8cc;text-decoration:none;font-weight:700">Open Rooted Commons</a></p><p style="font-size:13px">Please keep this link private.</p>`
        });
        await updateRow(cfg,cfg.members,member.id,{'Access link requested at':requestedAt.toISOString()});
      }
    }
    return json({ok:true,message:'If that email belongs to an active member, we’ve sent your access link.'});
  }catch(error){
    console.error('request-link failed',error);
    return json({ok:false,message:'We could not process that request. Please try again.'},500);
  }
}
