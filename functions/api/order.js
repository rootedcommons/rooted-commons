import { envConfig, json, listRows, createRow, updateRow, tokenValid, number, linkedIds, linkedValues, unwrap, orderWeek, truthy } from '../_baserow.js';

function productPayload(row) {
  return {
    id:Number(row.id), name:unwrap(row.Product), code:unwrap(row.Code),
    price:number(row['Member price']),
    stock:Math.max(0, number(row['Available stock'])),
    available:truthy(row.Available, true), categories:linkedValues(row.Category),
    collectionPointIds:linkedIds(row['Available collection points'])
  };
}
function parseItems(value) { try { const x=typeof value==='string'?JSON.parse(value):value; return Array.isArray(x)?x:[]; } catch { return []; } }
function sameMember(order, memberId) { return linkedIds(order.Member).includes(Number(memberId)); }
function compatibleWithPoint(product, point) {
  const availableCategories=linkedValues(point['Available to collect here']);
  const categoryCompatible=!availableCategories.length||!product.categories.length||product.categories.some(category=>availableCategories.some(value=>value.toLowerCase()===category.toLowerCase()));
  const pointCompatible=!product.collectionPointIds.length||product.collectionPointIds.includes(Number(point.id));
  return categoryCompatible&&pointCompatible;
}

export async function onRequestPost({request,env}) {
  const cfg=envConfig(env);
  let createdOrder=null;
  try {
    const body=await request.json();
    const token=String(body.token||'');
    const clientRequestId=String(body.clientRequestId||'').trim();
    const requested=Array.isArray(body.items)?body.items:[];
    const selectedPointId=Number(body.collectionPointId||0);
    if(!token||!clientRequestId||!requested.length)return json({ok:false,message:'Your basket or secure link is missing.'},400);
    if(!selectedPointId)return json({ok:false,message:'Choose a collection point before confirming your order.'},400);

    const [members,productRows,orders,points]=await Promise.all([
      listRows(cfg,cfg.members), listRows(cfg,cfg.products), listRows(cfg,cfg.orders),
      listRows(cfg,cfg.collectionPoints)
    ]);

    const member=members.find(row=>tokenValid(row,token));
    if(!member)return json({ok:false,message:'This ordering link is invalid or has expired.'},401);
    const duplicate=orders.find(row=>String(row['Client request ID']||'')===clientRequestId&&sameMember(row,member.id));
    if(duplicate){
      const duplicateTotal=number(duplicate['Order total']);
      const storedClosing=number(duplicate['Estimated closing credit'],NaN);
      const currentCredit=number(member['Current credit']);
      return json({
        ok:true,
        orderNumber:unwrap(duplicate['Order number']),
        total:duplicateTotal,
        closingCredit:Number.isFinite(storedClosing)?storedClosing:Math.round((currentCredit-duplicateTotal)*100)/100,
        collectionPoint:linkedValues(duplicate['Collection point'])[0],
        duplicate:true
      });
    }
    const selectedPoint=points.find(row=>Number(row.id)===selectedPointId&&truthy(row.Active,true));
    if(!selectedPoint)return json({ok:false,message:'That collection point is not currently available.'},409);

    const week=orderWeek();
    const previous=orders.find(row=>sameMember(row,member.id)&&String(row['Order week']||'')===week&&!['Replaced','Cancelled'].includes(String(row.Status||'')));
    const oldItems=previous?parseItems(previous['Item JSON']):[];
    const oldQty=new Map(oldItems.map(i=>[Number(i.productId),Number(i.quantity||0)]));
    const products=new Map(productRows.map(row=>[Number(row.id),productPayload(row)]));
    const lines=[];
    for(const item of requested){
      const id=Number(item.productId), quantity=Math.floor(Number(item.quantity||0));
      const product=products.get(id); if(!product||quantity<1)continue;
      if(!product.available)throw Object.assign(new Error(`${product.name||'An item'} is currently unavailable.`),{status:409});
      if(!compatibleWithPoint(product,selectedPoint))throw Object.assign(new Error(`${product.name} is not available at ${unwrap(selectedPoint.Name)}.`),{status:409});
      const effectiveStock=product.stock+(oldQty.get(id)||0);
      if(effectiveStock<quantity)throw Object.assign(new Error(`Only ${Math.max(0,effectiveStock)} of ${product.name} are currently available.`),{status:409});
      lines.push({productId:id,code:product.code,name:product.name,quantity,unitPrice:product.price,lineTotal:Math.round(product.price*quantity*100)/100,categories:product.categories});
    }
    if(!lines.length)throw Object.assign(new Error('Your basket is empty.'),{status:400});
    const total=Math.round(lines.reduce((sum,line)=>sum+line.lineTotal,0)*100)/100;
    const startingCredit=number(member['Current credit']);
    const orderNumber=`RC-${week.replace('-W','')}-${String(Date.now()).slice(-6)}`;

    const order=createdOrder=await createRow(cfg,cfg.orders,{
      'Submitted at':new Date().toISOString(),'Order source':'Website','Order week':week,
      'Collection point':[selectedPoint.id],'Item JSON':JSON.stringify(lines),'Order total':total,Status:'Processing','Order number':orderNumber,
      'Client request ID':clientRequestId,Member:[member.id],Email:member.Email||'',...(previous?{'Replaces order':[previous.id]}:{})
    });
    if(!cfg.stock||!cfg.transactions||!cfg.orderLines)throw new Error('The Stock Movement, Account Transactions or Order Lines table ID is missing.');
    if(previous){
      for(const item of oldItems){
        await createRow(cfg,cfg.stock,{Date:new Date().toISOString(),'Quantity change':Math.abs(Number(item.quantity||0)),'Movement type':'Release',Reference:`Replacement of ${previous['Order number']||previous.id}`,Order:[previous.id],'Product name':[Number(item.productId)],'Idempotency key':`${clientRequestId}:release:${item.productId}`,Active:true,Notes:'Automatic release before replacement order'});
      }
      await createRow(cfg,cfg.transactions,{Date:new Date().toISOString(),Member:[member.id],Type:'Order reversal',Amount:Math.abs(number(previous['Order total'])),Order:[previous.id],Email:member.Email||'',Notes:`Reversal for replaced website order ${previous['Order number']||previous.id}`,'Transaction reference':`${previous['Order number']||previous.id}-REV`,'Included in credit':true});
    }
    for(const line of lines){
      const movement=await createRow(cfg,cfg.stock,{Date:new Date().toISOString(),'Quantity change':-Math.abs(line.quantity),'Movement type':'Order',Reference:orderNumber,Order:[order.id],'Product name':[line.productId],'Idempotency key':`${clientRequestId}:order:${line.productId}`,Active:true,Notes:'Website order'});
      const orderLine=await createRow(cfg,cfg.orderLines,{Order:[order.id],Product:[line.productId],Quantity:line.quantity,'Unit price':line.unitPrice,'Product name snapshot':line.name,'Unit snapshot':line.code||'',Status:'Active','Stock movement':[movement.id]});
      await updateRow(cfg,cfg.stock,movement.id,{'Order Line':[orderLine.id]});
    }
    await createRow(cfg,cfg.transactions,{Date:new Date().toISOString(),Member:[member.id],Type:'Order charge',Amount:-Math.abs(total),Order:[order.id],Email:member.Email||'',Notes:`Website order ${orderNumber}`,'Transaction reference':orderNumber,'Included in credit':true});
    await updateRow(cfg,cfg.orders,order.id,{Status:'Confirmed','Confirmed at':new Date().toISOString()});
    if(previous)await updateRow(cfg,cfg.orders,previous.id,{Status:'Replaced'});
    return json({ok:true,orderNumber,total,startingCredit,closingCredit:Math.round((startingCredit-total)*100)/100,collectionPoint:unwrap(selectedPoint.Name),message:'Your order has been confirmed.'});
  }catch(error){
    if(createdOrder){try{await updateRow(cfg,cfg.orders,createdOrder.id,{Status:'Rejected'});}catch{}}
    return json({ok:false,message:String(error.message||'The order could not be submitted.')},Number(error.status)||500);
  }
}
