import { envConfig, linkedIds, listRows, number, truthy, unwrap, updateRow } from './_baserow.js';
import { sendMail } from './_smtp.js';
import { LIFECYCLE_EMAIL_FIELDS, renderLifecycleEmail, lifecycleEmailText } from './_membership-emails.js';

const DAY=86400000;
const statusOf=member=>unwrap(member['Membership status']) || 'Active';
const streakStatusOf=member=>unwrap(member['Streak status']) || (statusOf(member)==='Inactive'||statusOf(member)==='Closed'?'Ended':statusOf(member)==='Paused'?'Frozen':'Active');
const dateOnly=value=>{
  const raw=String(value||'').trim();
  const direct=raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if(direct)return direct[1];
  const d=new Date(raw);
  return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'';
};
const dateAtNoon=value=>{const d=dateOnly(value);return d?new Date(`${d}T12:00:00Z`):new Date(NaN);};
const addDaysDate=(value,days)=>{const d=dateAtNoon(value);if(!Number.isFinite(d.getTime()))return '';d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const addMonthsDate=(value,months)=>{const d=dateAtNoon(value);if(!Number.isFinite(d.getTime()))return '';const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10);};
const advanceCadenceDate=(value,frequency)=>frequency==='Monthly'?addMonthsDate(value,1):addDaysDate(value,7);
const londonDate=value=>{
  const d=value instanceof Date?value:new Date(value||Date.now());
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};
const daysBetween=(a,b)=>{const da=dateAtNoon(a),db=dateAtNoon(b);return Number.isFinite(da.getTime())&&Number.isFinite(db.getTime())?Math.round((db-da)/DAY):NaN;};
const formatDate=value=>value?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/London'}).format(new Date(`${String(value).slice(0,10)}T12:00:00Z`)):'';
const calendarYear=value=>Number(dateOnly(value).slice(0,4))||new Date().getUTCFullYear();

export function pauseWeeksBetween(start,end){
  const a=dateAtNoon(start);
  const b=dateAtNoon(end);
  if(!Number.isFinite(a.getTime())||!Number.isFinite(b.getTime())||b<=a)return 0;
  return Math.ceil((b-a)/(7*DAY));
}

export function pauseAllowance(member,year=Number(londonDate(new Date()).slice(0,4))){
  const storedYear=Math.trunc(number(member['Pause allowance year']));
  const used=storedYear===year?Math.max(0,Math.trunc(number(member['Pause weeks used']))):0;
  return {year,used,remaining:Math.max(0,8-used)};
}

export function expectedAmount(member){
  const frequency=unwrap(member['Contribution frequency'])==='Monthly'?'Monthly':'Weekly';
  return {frequency,amount:frequency==='Monthly'?number(member['Monthly equivalent']):number(member['Weekly commitment'])};
}

export function shiftStreakAnchorForGap(anchor,start,end){
  const base=dateOnly(anchor),from=dateOnly(start),to=dateOnly(end);
  if(!base||!from||!to)return base||'';
  if(base>=to)return base;
  const overlapStart=base>from?base:from;
  const gap=daysBetween(overlapStart,to);
  return Number.isFinite(gap)&&gap>0?addDaysDate(base,gap):base;
}

function accrueSupportedWeeks(member,through){
  const anchor=dateOnly(member['Streak credited through']);
  const limit=dateOnly(through);
  if(!anchor||!limit)return {};
  const elapsed=daysBetween(anchor,limit);
  const weeks=Number.isFinite(elapsed)?Math.max(0,Math.floor(elapsed/7)):0;
  if(!weeks)return {};
  return {'Consecutive weeks':Math.max(0,Math.trunc(number(member['Consecutive weeks'])))+weeks,'Streak credited through':addDaysDate(anchor,weeks*7)};
}


export function ukDate(value=new Date()){ return londonDate(value); }

export function nextExpectedPayment(receivedAt,frequency){
  const raw=String(receivedAt||'').trim();
  const base=(receivedAt instanceof Date||raw.includes('T'))?londonDate(receivedAt):dateOnly(receivedAt);
  return advanceCadenceDate(base,frequency);
}


export function advanceExpectedPastPause(expectedAt,pauseEnd,frequency){
  let next=dateOnly(expectedAt);
  const end=dateOnly(pauseEnd);
  if(!next||!end)return next||'';
  let guard=0;
  while(next<end && guard<60){next=advanceCadenceDate(next,frequency);guard+=1;}
  return next;
}

function interfaceMap(rows=[]){
  return Object.fromEntries(rows.map(row=>[unwrap(row.Key),String(row.Content??'')]).filter(([key])=>key));
}

async function revokeMemberSessions(cfg,sessions,memberId,now){
  const mine=sessions.filter(session=>linkedIds(session.Member).includes(Number(memberId))&&truthy(session.Active,true)&&!session['Revoked at']);
  for(const session of mine){
    await updateRow(cfg,cfg.sessions,session.id,{'Revoked at':now,Active:false});
    session.Active=false;session['Revoked at']=now;
  }
}

async function sendLifecycle(env,{kind,member,settings,field,pauseWeeksRemaining=0,pauseStart='',pauseEnd=''}){
  const to=String(member.Email||'').trim();
  if(!to)return false;
  const origin='https://rootedcommons.uk';
  const rendered=renderLifecycleEmail({
    kind,
    template:settings[field],
    member,settings,pauseWeeksRemaining,
    pauseStart:formatDate(pauseStart),pauseEnd:formatDate(pauseEnd),
    dashboardUrl:`${origin}/dashboard/`,signinUrl:`${origin}/signin/`
  });
  const subjects={
    pauseConfirmation:'Your Rooted Commons membership pause is confirmed',
    pauseEnding:'Your Rooted Commons pause is ending',
    paymentOverdue:'Your regular Rooted Commons payment hasn’t arrived',
    inactive:'Your Rooted Commons membership is inactive',
    stillInactive:'Your Rooted Commons membership is still inactive',
    closure:'Your Rooted Commons membership is being closed'
  };
  try{
    await sendMail(env,{to,subject:subjects[kind],html:rendered.html,text:lifecycleEmailText(kind,rendered.data)});
    return true;
  }catch(error){
    console.error('membership lifecycle email send failed',{kind,memberId:member.id,error});
    return false;
  }
}

export async function processMembershipLifecycle(env,{now=new Date()}={}){
  const cfg=envConfig(env);
  const [members,settingsRows,interfaceRows,sessions]=await Promise.all([
    listRows(cfg,cfg.members),cfg.settings?listRows(cfg,cfg.settings):Promise.resolve([]),cfg.interfaceContent?listRows(cfg,cfg.interfaceContent):Promise.resolve([]),cfg.sessions?listRows(cfg,cfg.sessions):Promise.resolve([])
  ]);
  const settings=settingsRows.find(row=>unwrap(row['Site title']))||settingsRows[0]||{};
  const content=interfaceMap(interfaceRows);
  const nowIso=now.toISOString();
  const today=londonDate(now);
  const results={checked:members.length,paused:0,resumed:0,overdue:0,inactive:0,followups:0,closed:0,dataReviews:0,emails:0,errors:[]};

  for(const member of members){
    try{
      let status=statusOf(member);
      let patch={};
      const frequency=expectedAmount(member).frequency;
      const pauseStart=dateOnly(member['Pause starts']);
      const pauseEnd=dateOnly(member['Pause ends']);
      const commitmentStopped=dateOnly(member['Regular commitment stopped at']);


      // Scheduled notified pause becomes active on its start date.
      if(pauseStart&&pauseEnd&&today>=pauseStart&&today<pauseEnd&&status==='Active'){
        patch['Membership status']='Paused';
        patch['Streak status']='Frozen';
        if(!dateOnly(member['Streak frozen since']))patch['Streak frozen since']=pauseStart;
        status='Paused';results.paused+=1;
      }

      // A notified pause ends automatically. Keep the annual-used counter, but clear the current pause.
      if(status==='Paused'&&pauseEnd&&today>=pauseEnd){
        const expectedBeforePause=dateOnly(member['Regular payment expected at']);
        const prePauseOverdue=dateOnly(member['Regular payment overdue since']);
        const skippedExpected=Boolean(expectedBeforePause&&pauseStart&&expectedBeforePause>=pauseStart&&expectedBeforePause<pauseEnd);
        const expected=prePauseOverdue ? expectedBeforePause : advanceExpectedPastPause(member['Regular payment expected at'],pauseEnd,frequency);
        const remainsFrozen=Boolean(prePauseOverdue||skippedExpected);
        const frozenSince=dateOnly(patch['Streak frozen since']||member['Streak frozen since'])||pauseStart;
        const shiftedAnchor=remainsFrozen?(member['Streak credited through']||null):shiftStreakAnchorForGap(member['Streak credited through'],frozenSince,pauseEnd);
        patch={...patch,'Membership status':'Active','Streak status':remainsFrozen?'Frozen':'Active','Streak frozen since':remainsFrozen?(frozenSince||null):null,'Pause starts':null,'Pause ends':null,'Current pause weeks':0,'Pause ending email sent at':null,'Regular payment overdue since':prePauseOverdue||null,'Payment overdue email sent at':prePauseOverdue?(member['Payment overdue email sent at']||null):null,'Regular payment expected at':expected||null,'Streak credited through':shiftedAnchor||null};
        status='Active';results.resumed+=1;
      }

      // Send the pause-ending reminder three days before the end. This is the only routine email sent during a pause.
      if(status==='Paused'&&pauseEnd&&!member['Pause ending email sent at']){
        const days=daysBetween(today,pauseEnd);
        if(days>=0&&days<=3){
          const allowance=pauseAllowance(member,calendarYear(pauseStart||now));
          if(await sendLifecycle(env,{kind:'pauseEnding',member,settings,field:LIFECYCLE_EMAIL_FIELDS.pauseEnding,pauseWeeksRemaining:allowance.remaining,pauseStart,pauseEnd})){results.emails+=1;patch['Pause ending email sent at']=nowIso;}
        }
      }

      // Streak progression is elapsed-time based, not payment-count based. A qualifying
      // payment establishes/maintains funding; each full supported seven-day period adds one.
      // Cap accrual at the expected payment date so downtime after a missed payment is never credited.
      const effectiveStreakStatus=unwrap(patch['Streak status']||member['Streak status']) || 'Active';
      if(status==='Active'&&!commitmentStopped&&effectiveStreakStatus==='Active'){
        const expectedForAccrual=dateOnly(patch['Regular payment expected at']||member['Regular payment expected at']);
        const through=expectedForAccrual&&today>expectedForAccrual?expectedForAccrual:today;
        const accrued=accrueSupportedWeeks({...member,...patch},through);
        if(Object.keys(accrued).length)patch={...patch,...accrued};
      }

      // Pauses suppress overdue logic and routine payment reminders. Policy dates are date-only:
      // the entire expected day is allowed to pass before a payment is treated as missed.
      if(status==='Active'&&!commitmentStopped){
        const expected=dateOnly(patch['Regular payment expected at']||member['Regular payment expected at']);
        let overdue=dateOnly(patch['Regular payment overdue since']||member['Regular payment overdue since']);
        if(expected&&today>expected&&!overdue){
          overdue=expected;
          patch['Regular payment overdue since']=overdue;
          patch['Streak status']='Frozen';
          if(!dateOnly(patch['Streak frozen since']||member['Streak frozen since']))patch['Streak frozen since']=overdue;
          results.overdue+=1;
        }
        if(overdue&&!member['Payment overdue email sent at']&&!patch['Payment overdue email sent at']){
          if(await sendLifecycle(env,{kind:'paymentOverdue',member:{...member,...patch},settings,field:LIFECYCLE_EMAIL_FIELDS.paymentOverdue})){results.emails+=1;patch['Payment overdue email sent at']=nowIso;}
        }
        // One full calendar month remains protected. Example: due 7 Sep -> inactive from 8 Oct.
        if(overdue&&today>addMonthsDate(overdue,1)){
          const currentWeeks=Math.max(0,Math.trunc(number(member['Consecutive weeks'])));
          patch={...patch,'Membership status':'Inactive','Streak status':'Ended','Previous streak weeks':currentWeeks,'Consecutive weeks':0,'Streak frozen since':null,'Membership inactive at':today};
          status='Inactive';results.inactive+=1;
        }
      }

      const overdueSince=dateOnly(patch['Regular payment overdue since']||member['Regular payment overdue since']);
      if(status==='Inactive'&&overdueSince){
        if(!member['Membership inactive email sent at']&&!patch['Membership inactive email sent at']){
          if(await sendLifecycle(env,{kind:'inactive',member:{...member,...patch},settings,field:LIFECYCLE_EMAIL_FIELDS.inactive})){results.emails+=1;patch['Membership inactive email sent at']=nowIso;}
        }
        if(today>=addMonthsDate(overdueSince,2)&&!member['Membership follow-up email sent at']){
          if(await sendLifecycle(env,{kind:'stillInactive',member:{...member,...patch},settings,field:LIFECYCLE_EMAIL_FIELDS.stillInactive})){results.emails+=1;patch['Membership follow-up email sent at']=nowIso;results.followups+=1;}
        }
        if(today>=addMonthsDate(overdueSince,6)){
          if(!member['Membership closure email sent at']&&!patch['Membership closure email sent at']){
            if(await sendLifecycle(env,{kind:'closure',member:{...member,...patch},settings,field:LIFECYCLE_EMAIL_FIELDS.closure})){results.emails+=1;patch['Membership closure email sent at']=nowIso;}
          }
          patch['Membership status']='Closed';patch['Membership closed at']=today;
          status='Closed';results.closed+=1;
          if(cfg.sessions)await revokeMemberSessions(cfg,sessions,member.id,nowIso);
        }
      }

      if(status==='Closed'&&overdueSince&&today>=addMonthsDate(overdueSince,6)&&!member['Membership closure email sent at']&&!patch['Membership closure email sent at']){
        if(await sendLifecycle(env,{kind:'closure',member:{...member,...patch},settings,field:LIFECYCLE_EMAIL_FIELDS.closure})){results.emails+=1;patch['Membership closure email sent at']=nowIso;}
      }

      if((status==='Closed'||statusOf({...member,...patch})==='Closed')&&overdueSince&&today>=addMonthsDate(overdueSince,12)&&!dateOnly(member['Data minimisation due at'])&&!dateOnly(patch['Data minimisation due at'])){
        // Do not destructively erase records automatically: tax/accounting, outstanding credit,
        // disputes and Member Credit can require different retention. Record the date review became due.
        patch['Data minimisation due at']=addMonthsDate(overdueSince,12);
        results.dataReviews+=1;
      }

      if(Object.keys(patch).length){
        await updateRow(cfg,cfg.members,member.id,patch);
        Object.assign(member,patch);
      }
    }catch(error){
      results.errors.push({memberId:member.id,error:String(error?.message||error).slice(0,240)});
      console.error('membership lifecycle member failed',{memberId:member.id,error});
    }
  }
  return results;
}

