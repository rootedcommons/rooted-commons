import { envConfig, json, listRows, updateRow, tokenValid, publicMember, publicCollectionPoint, linkedIds, linkedValues, unwrap, number, truthy } from '../_baserow.js';

function belongsToMember(row, member) {
  const memberId = Number(member.id);
  const linkedFields = ['Member', 'Members', 'Xero Contact ID'];
  if (linkedFields.some(field => linkedIds(row[field]).includes(memberId))) return true;
  const memberXero = unwrap(member['Xero Contact ID']);
  if (!memberXero) return false;
  return linkedFields.some(field => linkedValues(row[field]).includes(memberXero));
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
  const payments = included.filter(item => item.amount > 0).slice(0,4);
  const recentOrders = included.filter(item => /order/i.test(item.type) && !/reversal|refund/i.test(item.type));
  const eightWeekSpend = recentOrders
    .filter(item => new Date(item.date || 0).getTime() >= eightWeeksAgo)
    .reduce((sum,item) => sum + Math.abs(item.amount), 0);
  const averageWeeklySpend = eightWeekSpend / 8;
  const totalOrderSpend = recentOrders.reduce((sum,item) => sum + Math.abs(item.amount), 0);
  return { payments, activity: included.slice(0,20), averageWeeklySpend, totalOrderSpend };
}

export async function onRequestGet({ request, env }) {
  try {
    const token = new URL(request.url).searchParams.get('token') || '';
    if (!token) return json({authenticated:false}, 401);
    const cfg = envConfig(env);
    const [members, orders, points, transactions] = await Promise.all([
      listRows(cfg, cfg.members),
      cfg.orders ? listRows(cfg, cfg.orders) : Promise.resolve([]),
      cfg.collectionPoints ? listRows(cfg, cfg.collectionPoints) : Promise.resolve([]),
      cfg.transactions ? listRows(cfg, cfg.transactions) : Promise.resolve([])
    ]);
    const member = members.find(row => tokenValid(row, token));
    if (!member) return json({authenticated:false},401);
    const pointId = linkedIds(member['Collection point'])[0];
    const point = points.find(row => Number(row.id) === Number(pointId));
    const memberOrders = orders
      .filter(order => orderBelongsToMember(order, member) && String(order.Status || '') !== 'Cancelled')
      .sort((a,b) => new Date(b['Submitted at'] || 0) - new Date(a['Submitted at'] || 0));
    const account = summariseTransactions(transactions, member);
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
      account
    })});
  } catch (error) {
    return json({error:'Member lookup failed', detail:String(error.message||error)},500);
  }
}


export async function onRequestPatch({ request, env }) {
  try {
    const body = await request.json();
    const token = String(body.token || '');
    const collectionPointId = Number(body.collectionPointId || 0);
    if (!token || !collectionPointId) return json({ ok:false, message:'Choose a collection point.' }, 400);
    const cfg = envConfig(env);
    const [members, points] = await Promise.all([listRows(cfg, cfg.members), listRows(cfg, cfg.collectionPoints)]);
    const member = members.find(row => tokenValid(row, token));
    if (!member) return json({ ok:false, message:'This secure link is invalid or has expired.' }, 401);
    const point = points.find(row => Number(row.id) === collectionPointId && truthy(row.Active, true));
    if (!point) return json({ ok:false, message:'That collection point is not currently available.' }, 409);
    await updateRow(cfg, cfg.members, member.id, { 'Collection point':[collectionPointId] });
    return json({ ok:true, collectionPoint:publicCollectionPoint(point) });
  } catch (error) {
    return json({ ok:false, message:'The collection point could not be updated.', detail:String(error.message||error) }, 500);
  }
}
