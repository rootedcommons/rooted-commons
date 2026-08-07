import { envConfig, json, listRows, normaliseEmail, updateRow } from '../_baserow.js';

const recentlyRequested=(member,now,windowMs=60_000)=>{
  const raw=member['Access link requested at'];
  if(!raw)return false;
  const previous=new Date(raw).getTime();
  return Number.isFinite(previous) && now.getTime()-previous>=0 && now.getTime()-previous<windowMs;
};

export async function onRequestPost({ request, env }) {
  try {
    const body=await request.json();
    const email=normaliseEmail(body.email);
    if (!email) return json({ok:false,message:'Enter a valid email address.'},400);

    const cfg=envConfig(env);
    const members=await listRows(cfg,cfg.members);
    const member=members.find(row=>normaliseEmail(row.Email)===email && row.Active !== false);

    if (member) {
      const requestedAt=new Date();

      // Trigger the Baserow email automation without changing the member's
      // existing access/order token. This keeps links already sent in weekly
      // emails valid and simply resends the current link.
      if(!recentlyRequested(member,requestedAt)){
        await updateRow(cfg,cfg.members,member.id,{
          'Access link requested at':requestedAt.toISOString()
        });
      }
    }

    return json({ok:true,message:'If that email belongs to an active member, we’ve sent your access link.'});
  } catch (error) {
    return json({ok:false,message:'We could not process that request.',detail:String(error.message||error)},500);
  }
}
