import { envConfig, json, listRows, tokenValid, publicMember, publicCollectionPoint, linkedIds, linkedValues, unwrap, number } from '../_baserow.js';

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
      notes: unwrap(row.Notes || row.Description || row.Reference)
    }))
    .sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));

  const payments = mine.filter(item => /payment|top.?up/i.test(item.type) && item.amount > 0).slice(0,4);
  const recentOrders = mine.filter(item => /order/i.test(item.type) && !/reversal|refund/i.test(item.type));
  const eightWeekSpend = recentOrders
    .filter(item => new Date(item.date || 0).getTime() >= eightWeeksAgo)
    .reduce((sum,item) => sum + Math.abs(item.amount), 0);
  const averageWeeklySpend = eightWeekSpend / 8;
  const totalOrderSpend = recentOrders.reduce((sum,item) => sum + Math.abs(item.amount), 0);
  return { payments, averageWeeklySpend, totalOrderSpend };
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
      .filter(order => orderBelongsToMember(order, member) && !['Cancelled','Replaced'].includes(String(order.Status || '')))
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
