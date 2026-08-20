import { envConfig, createRow, deleteRow, getRow, json, listRows, listRowsFiltered, updateRow, publicMember, publicCollectionPoint, linkedIds, unwrap, number, truthy, ukMarketCycle, normaliseEmail } from '../_baserow.js';
import { authenticatedMember } from '../_auth.js';
import { refreshMemberMetricCache } from '../_public-metrics.js';
import { pauseAllowance, pauseWeeksBetween, advanceExpectedPastPause, expectedAmount, nextExpectedPayment, ukDate, shiftStreakAnchorForGap } from '../_membership-lifecycle.js';
import { sendMail } from '../_smtp.js';
import { LIFECYCLE_EMAIL_FIELDS, renderLifecycleEmail, lifecycleEmailText } from '../_membership-emails.js';
import { createEmailChangeToken, hashEmailChangeToken } from '../_email-change.js';

function transactionDate(row) {
  return row.Date || row['Transaction date'] || row['Created on'] || '';
}

function transactionType(row) {
  return unwrap(row.Type || row['Transaction type']).trim();
}

function transactionAmount(row) {
  return number(row.Amount, 0);
}

function summariseTransactions(rows) {
  const now = Date.now();
  const eightWeeksAgo = now - (8 * 7 * 86400000);
  const mine = rows
    .map(row => ({
      id: Number(row.id),
      date: transactionDate(row),
      type: transactionType(row),
      amount: transactionAmount(row),
      notes: unwrap(row.Notes || row.Description || row.Reference),
      reference: unwrap(row['Transaction reference'] || row.Reference),
      includedInCredit: truthy(row['Included in credit'], true)
    }))
    .sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));

  const included = mine.filter(item => item.includedInCredit);
  const allPayments = included.filter(item => item.amount > 0 && item.type.trim().toLowerCase() === 'payment');
  const payments = allPayments.slice(0,4);
  const totalPaymentsReceived = allPayments.reduce((sum,item)=>sum+Math.abs(item.amount),0);
  const recentOrders = included.filter(item => /order/i.test(item.type) && !/reversal|refund/i.test(item.type));
  const eightWeekSpend = recentOrders
    .filter(item => new Date(item.date || 0).getTime() >= eightWeeksAgo)
    .reduce((sum,item) => sum + Math.abs(item.amount), 0);
  const averageWeeklySpend = eightWeekSpend / 8;
  const totalOrderSpend = recentOrders.reduce((sum,item) => sum + Math.abs(item.amount), 0);
  return { payments, activity: included.slice(0,20), averageWeeklySpend, totalOrderSpend, totalPaymentsReceived };
}

export async function onRequestGet({ request, env }) {
  try {
    const cfg = envConfig(env);
    const auth=await authenticatedMember(cfg,request,env,new URL(request.url).searchParams.get('token')||'');
    if(!auth)return json({authenticated:false},401);
    const member=auth.member;
    const memberId=Number(member.id);
    const pointId = linkedIds(member['Collection point'])[0];
    const [orders, transactions, point] = await Promise.all([
      cfg.orders ? listRowsFiltered(cfg, cfg.orders, { Member:{ operator:'link_row_has', value:memberId } }, { size:200, all:true }) : Promise.resolve([]),
      cfg.transactions ? listRowsFiltered(cfg, cfg.transactions, { Member:{ operator:'link_row_has', value:memberId } }, { size:200, all:true }) : Promise.resolve([]),
      cfg.collectionPoints && pointId ? getRow(cfg, cfg.collectionPoints, pointId).catch(() => null) : Promise.resolve(null)
    ]);
    const memberOrders = orders
      .filter(order => String(order.Status || '') !== 'Cancelled')
      .sort((a,b) => new Date(b['Submitted at'] || 0) - new Date(a['Submitted at'] || 0));
    const account = summariseTransactions(transactions);
    const currentWeek = ukMarketCycle().orderWeek;
    const currentOrder = memberOrders.find(order =>
      String(unwrap(order['Order week'])) === currentWeek &&
      ['Processing','Confirmed'].includes(String(unwrap(order.Status)))
    ) || null;
    if (!account.averageWeeklySpend && memberOrders.length) {
      const eightWeeksAgo = Date.now() - (8 * 7 * 86400000);
      account.averageWeeklySpend = memberOrders
        .filter(order => new Date(order['Submitted at'] || 0).getTime() >= eightWeeksAgo)
        .reduce((sum, order) => sum + Math.abs(number(order['Order total'], 0)), 0) / 8;
    }
    if (!account.totalOrderSpend && memberOrders.length) {
      account.totalOrderSpend = memberOrders.reduce((sum, order) => sum + Math.abs(number(order['Order total'], 0)), 0);
    }
    return json({authenticated:true, member:publicMember(member, {
      collectionPoint: publicCollectionPoint(point),
      lastOrder: memberOrders[0] || null,
      currentOrder,
      account
    })});
  } catch (error) {
    console.error('member lookup failed',error);
    return json({error:'Member lookup failed'},500);
  }
}


export async function onRequestPatch(context) {
  const {request,env}=context;
  try {
    const body = await request.json();
    const token = String(body.token || '');
    const cfg = envConfig(env);
    const auth=await authenticatedMember(cfg,request,env,token);
    if(!auth)return json({ok:false,message:'This secure link is invalid or has expired.'},401);
    const member=auth.member;


    if(String(body.action||'')==='details'){
      const clean=value=>String(value||'').trim();
      const firstName=clean(body.firstName);
      const lastName=clean(body.lastName);
      const phone=clean(body.phone);
      const requestedEmail=normaliseEmail(body.email);
      const confirmEmail=normaliseEmail(body.confirmEmail);
      if(!firstName||!lastName||!phone||!requestedEmail)return json({ok:false,message:'Please complete your name, email address and phone number.'},400);
      if(requestedEmail!==confirmEmail)return json({ok:false,message:'The two email addresses do not match.'},400);
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail))return json({ok:false,message:'Enter a valid email address.'},400);
      const currentEmail=normaliseEmail(member.Email);
      const emailChanged=requestedEmail!==currentEmail;
      if(emailChanged){
        const duplicates=await listRowsFiltered(cfg,cfg.members,{Email:requestedEmail},{size:5});
        if(duplicates.some(row=>Number(row.id)!==Number(member.id)&&normaliseEmail(row.Email)===requestedEmail))return json({ok:false,message:'That email address is already used by another membership.'},409);
      }
      const basePatch={'First name':firstName,'Last name':lastName,'Phone':phone,'Weekly newsletter':body.weeklyNewsletter===true};
      let emailVerificationSent=false;
      if(emailChanged){
        const changeToken=createEmailChangeToken();
        const tokenHash=await hashEmailChangeToken(changeToken);
        const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
        await updateRow(cfg,cfg.members,member.id,{...basePatch,'Pending email':requestedEmail,'Email change token hash':tokenHash,'Email change expires at':expiresAt,'Email change confirmation sent at':null});
        try{
          const verifyUrl=`${new URL(request.url).origin}/api/confirm-email-change?token=${encodeURIComponent(changeToken)}`;
          const html=`<!doctype html><html><body style="margin:0;background:#faf8f1;font-family:Arial,sans-serif;color:#2d2a32"><div style="max-width:620px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #ddd6ce;border-radius:18px;padding:28px"><h1 style="margin:0 0 14px;font-size:24px">Confirm your new email address</h1><p>You asked to change the email address for your Rooted Commons membership.</p><p><a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#5f3b78;color:#fff;text-decoration:none;font-weight:700">Confirm new email address</a></p><p style="font-size:14px">This link expires in 24 hours. Your existing email address will stay on the account until you confirm the new one.</p></div></div></body></html>`;
          await sendMail(env,{to:requestedEmail,subject:'Confirm your new Rooted Commons email address',html,text:`Confirm your new Rooted Commons email address: ${verifyUrl}\n\nThis link expires in 24 hours. Your existing email address will stay on the account until you confirm the new one.`});
          emailVerificationSent=true;
          await updateRow(cfg,cfg.members,member.id,{'Email change confirmation sent at':new Date().toISOString()}).catch(error=>console.warn('Unable to record email-change confirmation timestamp',{memberId:member.id,error}));
        }catch(error){console.error('email change verification send failed',error);await updateRow(cfg,cfg.members,member.id,{'Pending email':null,'Email change token hash':'','Email change expires at':null}).catch(()=>{});}
      }else{
        await updateRow(cfg,cfg.members,member.id,{...basePatch,'Pending email':null,'Email change token hash':'','Email change expires at':null});
      }
      return json({ok:true,emailChanged,emailVerificationSent,email:currentEmail,firstName,lastName,phone,weeklyNewsletter:body.weeklyNewsletter===true,message:emailChanged?(emailVerificationSent?'Your details were saved. Check your new email address to confirm the change.':'Your other details were saved, but we could not send the email-change confirmation. Your current email address has not changed.'):'Your details were saved.'});
    }

    const closeMembership=async()=>{
      const today=ukDate();
      const weeks=Math.max(0,Math.trunc(number(member['Consecutive weeks'])));
      const patch={
        'Membership status':'Closed','Streak status':'Ended',
        'Previous streak weeks':Math.max(Math.trunc(number(member['Previous streak weeks'])),weeks),
        'Consecutive weeks':0,'Streak frozen since':null,'Membership closed at':today,
        'Regular commitment stopped at':member['Regular commitment stopped at']||today,
        'Regular payment expected at':null,'Regular payment overdue since':null,
        'Commitment payment pending':false,
        'Pause starts':null,'Pause ends':null,'Current pause weeks':0
      };
      await updateRow(cfg,cfg.members,member.id,patch);
      Object.assign(member,patch);
      if(cfg.sessions){
        const sessions=await listRowsFiltered(cfg,cfg.sessions,{Member:{operator:'link_row_has',value:Number(member.id)}},{size:100,all:true});
        for(const session of sessions){if(session.id)await deleteRow(cfg,cfg.sessions,session.id);}
      }
      const metricRefresh=refreshMemberMetricCache(cfg).catch(error=>console.warn('Unable to refresh public member metrics',error));
      if(typeof context.waitUntil==='function')context.waitUntil(metricRefresh);
    };

    const currentMemberCredit=()=>number(member['Current credit'],0);
    const hasProcessingOrder=async()=>{
      if(!cfg.orders)return false;
      const rows=await listRowsFiltered(cfg,cfg.orders,{Member:{operator:'link_row_has',value:Number(member.id)}},{size:50,all:true});
      return rows.some(row=>String(unwrap(row.Status)).toLowerCase()==='processing');
    };

    if(String(body.action||'')==='stop-commitment'){
      if(unwrap(member['Membership status'])==='Closed')return json({ok:false,message:'This membership is already closed.'},409);
      const today=ukDate();
      const patch={
        'Regular commitment stopped at':today,
        'Regular payment expected at':null,
        'Regular payment overdue since':null,
        'Payment overdue email sent at':null,
        'Membership inactive at':null,
        'Membership inactive email sent at':null,
        'Membership follow-up email sent at':null,
        'Commitment payment pending':false,
        'Streak status':'Frozen',
        'Streak frozen since':String(member['Streak frozen since']||'').slice(0,10)||today,
        'Membership status':'Active'
      };
      await updateRow(cfg,cfg.members,member.id,patch);
      Object.assign(member,patch);
      return json({ok:true,regularCommitmentStoppedAt:today,message:'Your regular commitment has been stopped. No further regular payments are expected while you use your remaining Member Credit. Remember to cancel the standing order with your bank.'});
    }

    if(String(body.action||'')==='resolve-credit-and-close'){
      if(body.confirmClose!==true)return json({ok:false,message:'Please confirm that you want to donate your remaining Member Credit and close your membership.'},400);
      if(await hasProcessingOrder())return json({ok:false,message:'Please wait for your current order to finish processing before resolving your Member Credit and closing your membership.'},409);
      if(!cfg.transactions)return json({ok:false,message:'Member Credit cannot be resolved automatically at the moment. Please contact us.'},503);
      const credit=currentMemberCredit();
      if(credit<=0.005)return json({ok:false,message:'There is no positive Member Credit to donate. Please close your membership normally.'},409);
      const recipientValue=String(body.recipient||'').trim();
      let recipientName='';
      if(recipientValue==='rooted-commons')recipientName='Rooted Commons';
      else if(/^partner:\d+$/.test(recipientValue)&&cfg.networkPartners){
        const partnerId=Number(recipientValue.split(':')[1]);
        const partner=await getRow(cfg,cfg.networkPartners,partnerId).catch(()=>null);
        if(partner&&truthy(partner.Active,true)&&truthy(partner['Accepts Member Credit donations'],false)&&unwrap(partner.Name))recipientName=unwrap(partner.Name);
      }
      if(!recipientName)return json({ok:false,message:'Choose where you would like to donate your remaining Member Credit.'},400);
      const today=ukDate();
      const reference=`RC-CLOSE-DONATION-${member.id}-${today}`;
      const existing=await listRowsFiltered(cfg,cfg.transactions,{'Transaction reference':reference},{size:5}).catch(()=>[]);
      if(!existing.length){
        await createRow(cfg,cfg.transactions,{
          Date:new Date().toISOString(),Type:'Adjustment',Amount:-Math.round(credit*100)/100,
          Member:[Number(member.id)],Notes:`Remaining Member Credit donated to ${recipientName} on member-requested closure.`,
          Email:String(member.Email||'').trim(),'Transaction reference':reference,'Included in credit':true
        });
      }
      try{
        await closeMembership();
      }catch(error){
        console.error('membership close failed after credit donation',error);
        return json({ok:false,creditResolved:true,message:`Your £${credit.toFixed(2)} Member Credit was recorded as donated to ${recipientName}, but we could not finish closing your membership. Please contact us so we can complete the closure.`},500);
      }
      return json({ok:true,closed:true,creditResolved:true,donatedAmount:Math.round(credit*100)/100,recipientName,message:'Your remaining Member Credit has been donated and your membership has been closed.'});
    }

    if(String(body.action||'')==='close-account'){
      if(body.confirmClose!==true)return json({ok:false,message:'Please confirm that you want to close your membership.'},400);
      if(await hasProcessingOrder())return json({ok:false,message:'Please wait for your current order to finish processing before closing your membership.'},409);
      const credit=currentMemberCredit();
      if(credit>0.005)return json({ok:false,creditResolutionRequired:true,credit,message:'Your remaining Member Credit must be resolved before your membership can be closed.'},409);
      if(credit<-0.005)return json({ok:false,creditResolutionRequired:true,credit,message:'Your Member Credit balance must be resolved before your membership can be closed. Please contact us.'},409);
      await closeMembership();
      return json({ok:true,closed:true,message:'Your membership has been closed.'});
    }

    if(String(body.action||'')==='pause'){
      const status=unwrap(member['Membership status']) || 'Active';
      if(status!=='Active') return json({ok:false,message:'Only an active membership can be paused from the dashboard.'},409);
      const start=String(body.pauseStart||'').slice(0,10);
      const end=String(body.pauseEnd||'').slice(0,10);
      const startDate=new Date(`${start}T00:00:00Z`);
      const endDate=new Date(`${end}T00:00:00Z`);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||!Number.isFinite(startDate.getTime())||!Number.isFinite(endDate.getTime())||endDate<=startDate){
        return json({ok:false,message:'Choose a valid pause start and end date.'},400);
      }
      if(startDate.getUTCFullYear()!==endDate.getUTCFullYear()) return json({ok:false,message:'For now, a pause must start and finish within the same calendar year. You can arrange another pause after New Year if needed.'},400);
      const weeks=pauseWeeksBetween(start,end);
      const allowance=pauseAllowance(member,startDate.getUTCFullYear());
      if(weeks<1||weeks>allowance.remaining) return json({ok:false,message:`That pause would use ${weeks} weeks, but you have ${allowance.remaining} of your 8 pause weeks remaining this calendar year.`},409);
      const today=ukDate();
      const activeNow=today>=start&&today<end;
      const patch={
        'Pause starts':start,
        'Pause ends':end,
        'Current pause weeks':weeks,
        'Pause allowance year':startDate.getUTCFullYear(),
        'Pause weeks used':allowance.used+weeks,
        'Pause confirmation email sent at':null,
        'Pause ending email sent at':null,
        ...(activeNow?{'Membership status':'Paused','Streak status':'Frozen','Streak frozen since':String(member['Streak frozen since']||'').slice(0,10)||start}:{})
      };
      await updateRow(cfg,cfg.members,member.id,patch);
      Object.assign(member,patch);
      let emailSent=false;
      try{
        const settingsRows=cfg.settings?await listRows(cfg,cfg.settings):[];
        const settings=settingsRows.find(row=>unwrap(row['Site title']))||settingsRows[0]||{};
        const rendered=renderLifecycleEmail({kind:'pauseConfirmation',template:settings[LIFECYCLE_EMAIL_FIELDS.pauseConfirmation],member,settings,pauseWeeksRemaining:Math.max(0,8-(allowance.used+weeks)),pauseStart:start,pauseEnd:end});
        await sendMail(env,{to:String(member.Email||'').trim(),subject:'Your Rooted Commons membership pause is confirmed',html:rendered.html,text:lifecycleEmailText('pauseConfirmation',rendered.data)});
        emailSent=true;
        const pauseConfirmationSentAt=new Date().toISOString();
        await updateRow(cfg,cfg.members,member.id,{'Pause confirmation email sent at':pauseConfirmationSentAt}).catch(error=>console.warn('Unable to record pause-confirmation timestamp',{memberId:member.id,error}));
        member['Pause confirmation email sent at']=pauseConfirmationSentAt;
      }catch(error){console.error('pause confirmation email failed',error);}
      return json({ok:true,membershipStatus:activeNow?'Paused':'Active',streakStatus:activeNow?'Frozen':unwrap(member['Streak status'])||'Active',pauseStarts:start,pauseEnds:end,currentPauseWeeks:weeks,pauseWeeksUsed:allowance.used+weeks,pauseWeeksRemaining:Math.max(0,8-(allowance.used+weeks)),emailSent});
    }

    if(String(body.action||'')==='end-pause'){
      const start=String(member['Pause starts']||'').slice(0,10);
      const plannedEnd=String(member['Pause ends']||'').slice(0,10);
      if(!start||!plannedEnd)return json({ok:false,message:'There is no current pause to end.'},409);
      const today=ukDate();
      const actualEnd=today<start?start:today;
      const plannedWeeks=Math.max(0,Math.trunc(number(member['Current pause weeks']))||pauseWeeksBetween(start,plannedEnd));
      const actualWeeks=today<=start?0:pauseWeeksBetween(start,actualEnd);
      const allowance=pauseAllowance(member,new Date(`${start}T00:00:00Z`).getUTCFullYear());
      const adjustedUsed=Math.max(0,allowance.used-Math.max(0,plannedWeeks-actualWeeks));
      const frequency=unwrap(member['Contribution frequency'])==='Monthly'?'Monthly':'Weekly';
      const hadPrePauseOverdue=Boolean(String(member['Regular payment overdue since']||'').trim());
      const expectedBeforePause=String(member['Regular payment expected at']||'').slice(0,10);
      const skippedExpected=Boolean(expectedBeforePause && expectedBeforePause>=start && expectedBeforePause<actualEnd);
      const resumedStreakStatus=(hadPrePauseOverdue||skippedExpected)?'Frozen':'Active';
      const expected=hadPrePauseOverdue ? (member['Regular payment expected at']||null) : (today<=start ? (member['Regular payment expected at']||null) : advanceExpectedPastPause(member['Regular payment expected at'],actualEnd,frequency));
      const remainsFrozen=resumedStreakStatus==='Frozen';
      const frozenSince=String(member['Streak frozen since']||'').slice(0,10)||(today>start?start:'');
      const shiftedAnchor=today<=start?(member['Streak credited through']||null):(remainsFrozen?(member['Streak credited through']||null):shiftStreakAnchorForGap(member['Streak credited through'],frozenSince||start,actualEnd));
      const patch={'Membership status':'Active','Streak status':resumedStreakStatus,'Streak frozen since':remainsFrozen?(frozenSince||start||null):null,'Pause starts':null,'Pause ends':null,'Current pause weeks':0,'Pause weeks used':adjustedUsed,'Pause ending email sent at':null,'Regular payment overdue since':hadPrePauseOverdue?(member['Regular payment overdue since']||null):null,'Payment overdue email sent at':hadPrePauseOverdue?(member['Payment overdue email sent at']||null):null,'Regular payment expected at':expected,'Streak credited through':shiftedAnchor||null};
      await updateRow(cfg,cfg.members,member.id,patch);
      return json({ok:true,membershipStatus:'Active',streakStatus:resumedStreakStatus,pauseWeeksUsed:adjustedUsed,pauseWeeksRemaining:Math.max(0,8-adjustedUsed)});
    }

    if(String(body.action||'')==='commitment'){
      const contributionFrequency=String(body.contributionFrequency||'').trim();
      const contributionAmount=Number(body.contributionAmount);
      const minimum=contributionFrequency==='Monthly'?43.33:10;
      const validFrequency=['Weekly','Monthly'].includes(contributionFrequency);
      const validAmount=Number.isFinite(contributionAmount) && Math.abs(contributionAmount*100-Math.round(contributionAmount*100))<0.000001 && contributionAmount>=minimum;
      if(!validFrequency||!validAmount){
        return json({ok:false,message:contributionFrequency==='Monthly'?'Monthly commitments must be at least £43.33.':'Weekly commitments must be at least £10.00.'},400);
      }
      const money=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
      const weeklyCommitment=contributionFrequency==='Weekly'?money(contributionAmount):money(contributionAmount*12/52);
      const monthlyEquivalent=contributionFrequency==='Monthly'?money(contributionAmount):money(contributionAmount*52/12);
      const commitmentChangedAt=new Date().toISOString();
      let revertedToConfirmed=false;
      const paymentRows=cfg.transactions?await listRowsFiltered(cfg,cfg.transactions,{Member:{operator:'link_row_has',value:Number(member.id)}},{size:200,all:true}):[];
      const previousRegularAmount=expectedAmount(member).amount;
      const hasRegularPaymentHistory=Boolean(String(member['Streak credited through']||'').slice(0,10)) || paymentRows.some(row=>
        transactionType(row).toLowerCase()==='payment' && transactionAmount(row)>0 && truthy(row['Included in credit'],true) && Math.abs(transactionAmount(row)-previousRegularAmount)<0.005
      );
      // A member who has never made a qualifying regular payment still has no payment
      // schedule to miss, even if they edit their commitment before that first payment.
      let expectedAt=hasRegularPaymentHistory?nextExpectedPayment(commitmentChangedAt,contributionFrequency):'';

      // While a commitment change is waiting for its first matching payment, allow the
      // member to return to the last payment-confirmed amount without creating another
      // pending standing-order change. This deliberately uses the most recent included
      // Payment from before the pending change, so no extra Baserow schema is required.
      if(truthy(member['Commitment payment pending'],false) && paymentRows.length){
        const changedAt=member['Commitment changed at'] ? new Date(member['Commitment changed at']).getTime() : NaN;
        const rows=paymentRows;
        const priorPayments=rows.filter(row=>{
          if(transactionType(row).toLowerCase()!=='payment'||transactionAmount(row)<=0||!truthy(row['Included in credit'],true))return false;
          const t=new Date(transactionDate(row)||0).getTime();
          return Number.isFinite(t) && (!Number.isFinite(changedAt)||t<changedAt);
        }).sort((a,b)=>new Date(transactionDate(b)||0)-new Date(transactionDate(a)||0));
        const amountGroups=new Map();
        priorPayments.forEach((row,index)=>{
          const amount=money(transactionAmount(row));
          const key=amount.toFixed(2);
          const group=amountGroups.get(key)||{amount,count:0,latestIndex:index,latestRow:row};
          group.count+=1;
          if(index<group.latestIndex){group.latestIndex=index;group.latestRow=row;}
          amountGroups.set(key,group);
        });
        const confirmedGroup=[...amountGroups.values()].sort((a,b)=>b.count-a.count||a.latestIndex-b.latestIndex)[0]||null;
        if(confirmedGroup&&Math.abs(confirmedGroup.amount-money(contributionAmount))<0.005){
          revertedToConfirmed=true;
          expectedAt=nextExpectedPayment(transactionDate(confirmedGroup.latestRow),contributionFrequency);
        }
      }

      await updateRow(cfg,cfg.members,member.id,{
        'Weekly commitment':weeklyCommitment,
        'Monthly equivalent':monthlyEquivalent,
        'Contribution frequency':contributionFrequency,
        'Commitment changed at':commitmentChangedAt,
        'Commitment payment pending':!revertedToConfirmed,
        'Regular commitment stopped at':null,
        'Regular payment expected at':expectedAt||null,
        'Regular payment overdue since':null,
        'Payment overdue email sent at':null
      });
      const metricRefresh=refreshMemberMetricCache(cfg).catch(error=>console.warn('Unable to refresh public member metrics',error));
      if(typeof context.waitUntil==='function')context.waitUntil(metricRefresh);
      return json({ok:true,weeklyCommitment,monthlyEquivalent,contributionFrequency,contributionAmount:money(contributionAmount),commitmentChangedAt,commitmentPaymentPending:!revertedToConfirmed,revertedToConfirmed,regularPaymentExpectedAt:expectedAt||''});
    }

    const collectionPointId = Number(body.collectionPointId || 0);
    const preferredCollectionDay = String(body.preferredCollectionDay || '').trim();
    if (!collectionPointId) return json({ ok:false, message:'Choose a collection point.' }, 400);
    const point=await getRow(cfg,cfg.collectionPoints,collectionPointId).catch(()=>null);
    if (!point || !truthy(point.Active, true)) return json({ ok:false, message:'That collection point is not currently available.' }, 409);
    const publicPoint = publicCollectionPoint(point);
    const validDays = (publicPoint.collectionSlots || []).map(slot => slot.day);
    const savedDay = validDays.includes(preferredCollectionDay) ? preferredCollectionDay : (validDays[0] || 'Thursday');
    await updateRow(cfg, cfg.members, member.id, { 'Collection point':[collectionPointId], 'Preferred collection day':savedDay });
    return json({ ok:true, collectionPoint:publicPoint, preferredCollectionDay:savedDay });
  } catch (error) {
    console.error('member update failed',error);
    return json({ok:false,message:'Your membership could not be updated.'},500);
  }
}
