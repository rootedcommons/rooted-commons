import { envConfig, fileUrl, json, linkedIds, listRows, truthy, unwrap, updateRow, orderWeek } from '../../_baserow.js';
import { buildSessionToken, nextWednesdayExpiry, replaceWeeklyAccessSession } from '../../_auth.js';
import { sendMail } from '../../_smtp.js';
import { renderWeeklyEmail, weeklyEmailText, WEEKLY_EMAIL_TEMPLATE_FIELD } from '../../_weekly-email.js';


function londonParts(now=new Date()){
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(now).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
}
function inWeeklyWindow(now=new Date()){
  const parts=londonParts(now);
  return parts.weekday==='Wed' && Number(parts.hour)===18 && Number(parts.minute)>=5 && Number(parts.minute)<35;
}
function sameExpiry(a,b){
  const x=new Date(a||0).getTime(),y=new Date(b||0).getTime();
  return Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<60_000;
}
function justClosedOrderWeek(now=new Date()){
  const parts=londonParts(now);
  const localDate=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),12));
  localDate.setUTCDate(localDate.getUTCDate()+1);
  return orderWeek(localDate.toISOString().slice(0,10));
}
function settingsRow(rows=[]){
  return rows.find(row=>unwrap(row['Site title'])||fileUrl(row['Header logo']))||rows[0]||{};
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
    const [members,sessions,orders,points,settingsRows]=await Promise.all([
      listRows(cfg,cfg.members),
      listRows(cfg,cfg.sessions),
      listRows(cfg,cfg.orders),
      listRows(cfg,cfg.collectionPoints),
      listRows(cfg,cfg.settings)
    ]);
    const settings=settingsRow(settingsRows);
    const pointsById=new Map(points.map(point=>[Number(point.id),point]));
    const activeMembers=members.filter(member=>truthy(member.Active,false)&&String(member.Email||'').trim());
    const closedWeek=justClosedOrderWeek(now);
    const ordersByMember=new Map();
    for(const order of orders){
      if(unwrap(order['Order week'])!==closedWeek) continue;
      if(unwrap(order.Status)!=='Confirmed') continue;
      for(const memberId of linkedIds(order.Member)){
        const existing=ordersByMember.get(memberId);
        if(!existing||new Date(order['Submitted at']||0)>new Date(existing['Submitted at']||0)) ordersByMember.set(memberId,order);
      }
    }

    const expiresAt=nextWednesdayExpiry(now);
    const origin=new URL(request.url).origin;
    const results={members:activeMembers.length,created:0,emailed:0,alreadySent:0,failed:0,orderWeek:closedWeek};
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
        const order=ordersByMember.get(Number(member.id))||null;
        const pointId=order?linkedIds(order['Collection point'])[0]:null;
        const collectionPoint=pointId?pointsById.get(pointId)||null:null;
        const content=renderWeeklyEmail({
          template:settings[WEEKLY_EMAIL_TEMPLATE_FIELD],member,settings,order,collectionPoint,accessUrl,expiresAt
        });
        await sendMail(env,{
          to:String(member.Email).trim(),
          subject:"Orders are closed — next week's market is open",
          text:weeklyEmailText(content.data),
          html:content.html
        });
        if(content.usedFallback) console.warn('weekly email fallback used',{memberId:member.id});
        const sentAt=new Date().toISOString();
        await updateRow(cfg,cfg.sessions,weekly.id,{'Email sent at':sentAt});
        weekly['Email sent at']=sentAt;
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
