import { envConfig, json, listRows, updateRow, publicMember, publicCollectionPoint, linkedIds, linkedValues, unwrap, number, truthy, ukMarketCycle } from '../_baserow.js';
import { authenticatedMember } from '../_auth.js';

function belongsToMember(row, member) {
  const memberId = Number(member.id);
  return ['Member', 'Members'].some(field => linkedIds(row[field]).includes(memberId));
}

function orderBelongsToMember(order, member) {
  return belongsToMember(order, member);
}

function transactionDate(row) {
  return row.Date || row['Transaction date'] || row['Created on'] || '';
}

function transactionType(row) {
  return unwrap(row.Type || row['Transaction type']).trim();
}

function transactionAmount(row) {
  return number(row.Amount, 0);
}

function summariseTransactions(rows, member) {
  const now = Date.now();
  const eightWeeksAgo = now - (8 * 7 * 86400000);
  const mine = rows
    .filter(row => belongsToMember(row, member))
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
  const allPayments = included.filter(item => item.amount > 0 && !/refund|reversal/i.test(item.type));
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
    const [orders, points, transactions] = await Promise.all([
      cfg.orders ? listRows(cfg, cfg.orders) : Promise.resolve([]),
      cfg.collectionPoints ? listRows(cfg, cfg.collectionPoints) : Promise.resolve([]),
      cfg.transactions ? listRows(cfg, cfg.transactions) : Promise.resolve([])
    ]);
    const pointId = linkedIds(member['Collection point'])[0];
    const point = points.find(row => Number(row.id) === Number(pointId));
    const memberOrders = orders
      .filter(order => orderBelongsToMember(order, member) && String(order.Status || '') !== 'Cancelled')
      .sort((a,b) => new Date(b['Submitted at'] || 0) - new Date(a['Submitted at'] || 0));
    const account = summariseTransactions(transactions, member);
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


export async function onRequestPatch({ request, env }) {
  try {
    const body = await request.json();
    const token = String(body.token || '');
    const collectionPointId = Number(body.collectionPointId || 0);
    const preferredCollectionDay = String(body.preferredCollectionDay || '').trim();
    if (!collectionPointId) return json({ ok:false, message:'Choose a collection point.' }, 400);
    const cfg = envConfig(env);
    const [auth,points]=await Promise.all([authenticatedMember(cfg,request,env,token),listRows(cfg,cfg.collectionPoints)]);
    if(!auth)return json({ok:false,message:'This secure link is invalid or has expired.'},401);
    const member=auth.member;
    const point = points.find(row => Number(row.id) === collectionPointId && truthy(row.Active, true));
    if (!point) return json({ ok:false, message:'That collection point is not currently available.' }, 409);
    const publicPoint = publicCollectionPoint(point);
    const validDays = (publicPoint.collectionSlots || []).map(slot => slot.day);
    const savedDay = validDays.includes(preferredCollectionDay) ? preferredCollectionDay : (validDays[0] || 'Thursday');
    await updateRow(cfg, cfg.members, member.id, { 'Collection point':[collectionPointId], 'Preferred collection day':savedDay });
    return json({ ok:true, collectionPoint:publicPoint, preferredCollectionDay:savedDay });
  } catch (error) {
    console.error('member update failed',error);
    return json({ok:false,message:'The collection point could not be updated.'},500);
  }
}
