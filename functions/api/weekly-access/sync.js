import { envConfig, json, linkedIds, listRows, truthy, updateRow } from '../../_baserow.js';
import { buildSessionToken, nextWednesdayExpiry, replaceWeeklyAccessSession } from '../../_auth.js';
import { sendMail } from '../../_smtp.js';

const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function londonClock(now=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/London',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(now).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return {weekday:parts.weekday,hour:Number(parts.hour),minute:Number(parts.minute)};
}
function inWeeklyWindow(now=new Date()){
  const {weekday,hour,minute}=londonClock(now);
  return weekday==='Wed' && hour===18 && minute>=5 && minute<35;
}
function sameExpiry(a,b){
  const x=new Date(a||0).getTime(),y=new Date(b||0).getTime();
  return Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<60_000;
}

export async function onRequestPost({request,env}){
  const supplied=request.headers.get('x-weekly-access-key')||'';
  if(!env.WEEKLY_ACCESS_SYNC_KEY||supplied!==env.WEEKLY_ACCESS_SYNC_KEY)return json({ok:false,message:'Forbidden'},403);
  const url=new URL(request.url);
  const force=url.searchParams.get('force')==='1';
  const now=new Date();
  if(!force&&!inWeeklyWindow(now))return json({ok:true,skipped:true,message:'Outside the Wednesday 18:05–18:35 Europe/London rotation window.'});

  try{
    const cfg=envConfig(env);
    const [members,sessions]=await Promise.all([listRows(cfg,cfg.members),listRows(cfg,cfg.sessions)]);
    const activeMembers=members.filter(member=>truthy(member.Active,false)&&String(member.Email||'').trim());
    const expiresAt=nextWednesdayExpiry(now);
    const origin=new URL(request.url).origin;
    const results={members:activeMembers.length,created:0,emailed:0,alreadySent:0,failed:0};
    const failures=[];

    for(const member of activeMembers){
      try{
        let weekly=sessions.find(session=>
          linkedIds(session.Member).includes(Number(member.id)) &&
          String(session.Purpose||'')==='Weekly access' &&
          truthy(session.Active,true) &&
          !session['Revoked at'] &&
          sameExpiry(session['Expires at'],expiresAt)
        );
        let token='';
        if(!weekly){
          const created=await replaceWeeklyAccessSession(cfg,member.id,env,{existingSessions:sessions,expiresAt});
          weekly=created.session;
          token=created.token;
          sessions.push(weekly);
          results.created+=1;
        }else{
          token=await buildSessionToken(String(weekly['Session ID']),env.AUTH_SESSION_SECRET);
        }

        if(weekly['Email sent at']){
          results.alreadySent+=1;
          continue;
        }

        const accessUrl=`${origin}/api/access?token=${encodeURIComponent(token)}&return=${encodeURIComponent('/dashboard/')}`;
        const firstName=String(member['First name']||'there');
        await sendMail(env,{
          to:String(member.Email).trim(),
          subject:'Your Rooted Commons weekly access link',
          text:`Hi ${firstName},\n\nOrders have closed for this week and your new Rooted Commons access link is ready for the next weekly market:\n${accessUrl}\n\nIf you are already signed in on this device, you can simply visit Rooted Commons as usual.\n\nPlease keep this link private.\n\nRooted Commons`,
          html:`<p>Hi ${escapeHtml(firstName)},</p><p>Orders have closed for this week and your new Rooted Commons access link is ready for the next weekly market.</p><p><a href="${escapeHtml(accessUrl)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#5a2d4d;color:#ded8cc;text-decoration:none;font-weight:700">Open Rooted Commons</a></p><p>If you are already signed in on this device, you can simply visit Rooted Commons as usual.</p><p style="font-size:13px">Please keep this link private.</p>`
        });
        await updateRow(cfg,cfg.sessions,weekly.id,{'Email sent at':new Date().toISOString()});
        weekly['Email sent at']=new Date().toISOString();
        results.emailed+=1;
      }catch(error){
        results.failed+=1;
        failures.push({memberId:member.id,error:String(error?.message||error).slice(0,180)});
        console.error('weekly access member failed',{memberId:member.id,error});
      }
    }
    return json({ok:results.failed===0,...results,expiresAt,failures:failures.slice(0,20)},results.failed?207:200);
  }catch(error){
    console.error('weekly access sync failed',error);
    return json({ok:false,message:'Weekly access rotation failed.'},500);
  }
}
