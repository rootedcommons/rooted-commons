import { envConfig, json, listRows, normaliseEmail, updateRow } from '../_baserow.js';

const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
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
      const tokenCreated=new Date();
      await updateRow(cfg,cfg.members,member.id,{
        'Order token':freshToken,
        'Token created':tokenCreated.toISOString(),
        'Order token expiry':nextWednesdayExpiry(tokenCreated)
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
