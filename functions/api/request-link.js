import { envConfig, json, listRows, normaliseEmail, updateRow } from '../_baserow.js';

const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
const nextSundayExpiry=(from=new Date())=>{
  const d=new Date(from.getTime());
  const days=(7-d.getUTCDay())%7 || 7;
  d.setUTCDate(d.getUTCDate()+days);
  d.setUTCHours(23,59,59,0);
  return d.toISOString();
};

export async function onRequestPost({ request, env }) {
  try {
    const body=await request.json();
    const email=normaliseEmail(body.email);
    if (!email) return json({ok:false,message:'Enter a valid email address.'},400);

    const cfg=envConfig(env);
    const members=await listRows(cfg,cfg.members);
    const member=members.find(row=>normaliseEmail(row.Email)===email && row.Active !== false);

    if (member && env.MAGIC_LINK_WEBHOOK_URL) {
      const freshToken=token();
      await updateRow(cfg,cfg.members,member.id,{
        'Order token':freshToken,
        'Order token expiry':nextSundayExpiry(new Date())
      });

      const origin=new URL(request.url).origin;
      const requestedPath=String(body.returnPath||'/dashboard/');
      const safePath=requestedPath.startsWith('/')&&!requestedPath.startsWith('//')?requestedPath:'/dashboard/';
      const separator=safePath.includes('?')?'&':'?';
      const link=`${origin}${safePath}${separator}token=${encodeURIComponent(freshToken)}`;
      await fetch(env.MAGIC_LINK_WEBHOOK_URL,{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          event:'member_login_link',
          email,
          link,
          member:{firstName:member['First name']||'',memberNumber:member['Member number']||`RC-${member.id}`},
          basketSummary:body.basketSummary||[]
        })
      });
    }

    return json({ok:true,message:'If that email belongs to an active member, we’ve sent a new secure login link.'});
  } catch (error) {
    return json({ok:false,message:'We could not process that request.',detail:String(error.message||error)},500);
  }
}
