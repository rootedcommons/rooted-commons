import { envConfig, json, listRows, tokenValid, publicMember, publicCollectionPoint, linkedIds } from '../_baserow.js';

function belongsToMember(order, memberId) {
  return linkedIds(order.Member).includes(Number(memberId));
}

export async function onRequestGet({ request, env }) {
  try {
    const token = new URL(request.url).searchParams.get('token') || '';
    if (!token) return json({authenticated:false}, 401);
    const cfg = envConfig(env);
    const [members, orders, points] = await Promise.all([
      listRows(cfg, cfg.members),
      cfg.orders ? listRows(cfg, cfg.orders) : Promise.resolve([]),
      cfg.collectionPoints ? listRows(cfg, cfg.collectionPoints) : Promise.resolve([])
    ]);
    const member = members.find(row => tokenValid(row, token));
    if (!member) return json({authenticated:false},401);
    const pointId = linkedIds(member['Collection point'])[0];
    const point = points.find(row => Number(row.id) === Number(pointId));
    const memberOrders = orders
      .filter(order => belongsToMember(order, member.id) && !['Cancelled','Replaced'].includes(String(order.Status || '')))
      .sort((a,b) => new Date(b['Submitted at'] || 0) - new Date(a['Submitted at'] || 0));
    return json({authenticated:true, member:publicMember(member, { collectionPoint: publicCollectionPoint(point), lastOrder: memberOrders[0] || null })});
  } catch (error) {
    return json({error:'Member lookup failed', detail:String(error.message||error)},500);
  }
}
