import { envConfig, getRow, json, listRowsFiltered, updateRow, publicMember, publicCollectionPoint, linkedIds, unwrap, number, truthy, ukMarketCycle } from '../_baserow.js';
import { authenticatedMember } from '../_auth.js';
import { refreshMemberMetricCache } from '../_public-metrics.js';

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
      await updateRow(cfg,cfg.members,member.id,{
        'Weekly commitment':weeklyCommitment,
        'Monthly equivalent':monthlyEquivalent,
        'Contribution frequency':contributionFrequency,
        'Commitment changed at':commitmentChangedAt,
        'Commitment payment pending':true
      });
      const metricRefresh=refreshMemberMetricCache(cfg).catch(error=>console.warn('Unable to refresh public member metrics',error));
      if(typeof context.waitUntil==='function')context.waitUntil(metricRefresh);
      return json({ok:true,weeklyCommitment,monthlyEquivalent,contributionFrequency,contributionAmount:money(contributionAmount),commitmentChangedAt,commitmentPaymentPending:true});
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
