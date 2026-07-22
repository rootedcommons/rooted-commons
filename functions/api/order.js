import { envConfig, json, listRows, createRow, updateRow, tokenValid, number, linkedIds, linkedValues, unwrap, orderWeek } from '../_baserow.js';

function productPayload(row) {
  return {
    id:Number(row.id), name:unwrap(row.Product), code:unwrap(row.Code), price:number(row['Member price']),
    stock:number(row['Current stock']), available:row.Available !== false,
    collectionPointIds:linkedIds(row['Available collection points']), collectionPointNames:linkedValues(row['Available collection points'])
  };
}
function parseItems(value) { try { const x=typeof value==='string'?JSON.parse(value):value; return Array.isArray(x)?x:[]; } catch { return []; } }
function sameMember(order, memberId) { return linkedIds(order.Member).includes(Number(memberId)); }

export async function onRequestPost({request,env}) {
  try {
    const body=await request.json(); const token=String(body.token||'');
    const requested=Array.isArray(body.items)?body.items:[];
    if (!token || !requested.length) return json({ok:false,message:'Your basket or secure link is missing.'},400);
    const cfg=envConfig(env);
    const [members,productRows,orders]=await Promise.all([listRows(cfg,cfg.members),listRows(cfg,cfg.products),listRows(cfg,cfg.orders)]);
    const member=members.find(row=>tokenValid(row,token));
    if (!member) return json({ok:false,message:'This ordering link is invalid or has expired.'},401);
    const week=orderWeek();
    const previous=orders.find(row=>sameMember(row,member.id) && String(row['Order week']||'')===week && !['Replaced','Cancelled'].includes(String(row.Status||'')));
    const oldItems=previous?parseItems(previous['Item JSON']):[];
    const oldQty=new Map(oldItems.map(i=>[Number(i.productId),Number(i.quantity||0)]));
    const products=new Map(productRows.map(row=>[Number(row.id),productPayload(row)]));
    const memberPointIds=linkedIds(member['Collection point']); const memberPointNames=linkedValues(member['Collection point']);
    const lines=[];
    for (const item of requested) {
      const id=Number(item.productId), quantity=Math.floor(Number(item.quantity||0)); const product=products.get(id);
      if (!product || quantity<1) continue;
      if (!product.available) return json({ok:false,message:`${product?.name||'An item'} is currently unavailable.`},409);
      if (product.collectionPointIds.length && !product.collectionPointIds.some(id=>memberPointIds.includes(id))) return json({ok:false,message:`${product.name} is not available at your collection point.`},409);
      const effectiveStock=product.stock+(oldQty.get(id)||0);
      if (effectiveStock < quantity) return json({ok:false,message:`Only ${Math.max(0,effectiveStock)} of ${product.name} are currently available.`},409);
      lines.push({productId:id,code:product.code,name:product.name,quantity,unitPrice:product.price,lineTotal:Math.round(product.price*quantity*100)/100});
    }
    if (!lines.length) return json({ok:false,message:'Your basket is empty.'},400);
    const total=Math.round(lines.reduce((s,l)=>s+l.lineTotal,0)*100)/100;
    const startingCredit=number(member['Current credit']);
    if (previous) {
      await updateRow(cfg,cfg.orders,previous.id,{Status:'Replaced'});
      for (const item of oldItems) await createRow(cfg,cfg.stock,{
        Date:new Date().toISOString(), 'Stock movement':Math.abs(Number(item.quantity||0)), 'Movement type':'Order reversal',
        Reference:`Replacement of ${previous['Order number']||previous.id}`, Order:[previous.id], 'Product name':[Number(item.productId)], Notes:'Automatic reversal before replacement order'
      });
      const oldTotal=number(previous['Order total']);
      if (oldTotal) await createRow(cfg,cfg.transactions,{
        Date:new Date().toISOString(), 'Xero Contact ID':[member.id], Type:'Order reversal', Amount:Math.abs(oldTotal), Order:[previous.id],
        Notes:`Automatic reversal of ${previous['Order number']||previous.id}`, 'Transaction reference':`REV-${previous.id}-${Date.now()}`
      });
    }
    const orderNumber=`RC-${week.replace('-W','')}-${String(Date.now()).slice(-6)}`;
    const order=await createRow(cfg,cfg.orders,{
      'Submitted at':new Date().toISOString(), 'Order source':'Website', 'Order week':week,
      'Collection point':memberPointIds.length?[memberPointIds[0]]:memberPointNames[0]||'',
      'Item JSON':JSON.stringify(lines), 'Order total':total, 'Starting credit':startingCredit,
      'Estimated closing credit':Math.round((startingCredit-total)*100)/100, Status:'Submitted', 'Order number':orderNumber,
      Member:[member.id], Email:member.Email||''
    });
    for (const line of lines) await createRow(cfg,cfg.stock,{
      Date:new Date().toISOString(), 'Stock movement':-Math.abs(line.quantity), 'Movement type':'Order', Reference:orderNumber,
      Order:[order.id], 'Product name':[line.productId], Notes:'Website order'
    });
    await createRow(cfg,cfg.transactions,{
      Date:new Date().toISOString(), 'Xero Contact ID':[member.id], Type:'Order', Amount:-Math.abs(total), Order:[order.id],
      Email:member.Email||'', Notes:`Website order ${orderNumber}`, 'Transaction reference':orderNumber
    });
    return json({ok:true,orderNumber,total,startingCredit,closingCredit:Math.round((startingCredit-total)*100)/100,message:'Your order has been submitted.'});
  } catch (error) { return json({ok:false,message:'The order could not be submitted.',detail:String(error.message||error)},500); }
}
