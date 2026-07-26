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
  const cfg=envConfig(env); let submission=null;
  try {
    const body=await request.json();
    const token=String(body.token||'');
    const clientRequestId=String(body.clientRequestId||'').trim();
    const requested=Array.isArray(body.items)?body.items:[];
    const selectedPointId=Number(body.collectionPointId||0);
    if(!token||!clientRequestId||!requested.length)return json({ok:false,message:'Your basket or secure link is missing.'},400);
    if(!selectedPointId)return json({ok:false,message:'Choose a collection point before confirming your order.'},400);

    const [members,productRows,orders,points,submissions]=await Promise.all([
      listRows(cfg,cfg.members), listRows(cfg,cfg.products), listRows(cfg,cfg.orders),
      listRows(cfg,cfg.collectionPoints), cfg.submissions?listRows(cfg,cfg.submissions):Promise.resolve([])
    ]);
    const existingSubmission=submissions.find(row=>String(row['Client request ID']||'')===clientRequestId);
    if(existingSubmission&&String(existingSubmission.Status||'')==='Rejected')return json({ok:false,message:unwrap(existingSubmission['Failure reason'])||'This order was rejected.'},409);

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

    if(cfg.submissions&&!existingSubmission)submission=await createRow(cfg,cfg.submissions,{
      'Client request ID':clientRequestId, Member:[member.id], 'Collection point':[selectedPoint.id],
      'Basket payload':JSON.stringify(requested), Status:'Processing', 'Submitted at':new Date().toISOString(), 'Attempt count':1
    });

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

    const order=await createRow(cfg,cfg.orders,{
      'Submitted at':new Date().toISOString(),'Confirmed at':new Date().toISOString(),'Order source':'Website','Order week':week,
      'Collection point':[selectedPoint.id],'Item JSON':JSON.stringify(lines),'Order total':total,Status:'Confirmed','Order number':orderNumber,
      'Client request ID':clientRequestId,Member:[member.id],Email:member.Email||'',...(previous?{'Replaces order':[previous.id]}:{})
    });
    if(previous)await updateRow(cfg,cfg.orders,previous.id,{Status:'Replaced'});

    if(cfg.enableLedgers){
      if(previous){for(const item of oldItems)await createRow(cfg,cfg.stock,{Date:new Date().toISOString(),'Quantity change':Math.abs(Number(item.quantity||0)),'Movement type':'Release',Reference:`Replacement of ${previous['Order number']||previous.id}`,Order:[previous.id],'Product name':[Number(item.productId)],'Idempotency key':`${clientRequestId}:release:${item.productId}`,Active:true,Notes:'Automatic release before replacement order'});}
      for(const line of lines){
        let movement=null;
        movement=await createRow(cfg,cfg.stock,{Date:new Date().toISOString(),'Quantity change':-Math.abs(line.quantity),'Movement type':'Order',Reference:orderNumber,Order:[order.id],'Product name':[line.productId],'Idempotency key':`${clientRequestId}:order:${line.productId}`,Active:true,Notes:'Website order'});
        if(cfg.orderLines)await createRow(cfg,cfg.orderLines,{Order:[order.id],Product:[line.productId],Quantity:line.quantity,'Unit price':line.unitPrice,'Product name snapshot':line.name,'Unit snapshot':line.code||'',Status:'Active',...(movement?{'Stock movement':[movement.id]}:{})});
      }
      await createRow(cfg,cfg.transactions,{Date:new Date().toISOString(),'Xero Contact ID':[member.id],Type:'Order',Amount:-Math.abs(total),Order:[order.id],Email:member.Email||'',Notes:`Website order ${orderNumber}`,'Transaction reference':orderNumber,'Included in credit':true});
    }
    if(submission)await updateRow(cfg,cfg.submissions,submission.id,{Status:'Accepted','Processing completed at':new Date().toISOString(),'Result order':[order.id]});
    return json({ok:true,orderNumber,total,startingCredit,closingCredit:Math.round((startingCredit-total)*100)/100,collectionPoint:unwrap(selectedPoint.Name),message:'Your order has been confirmed.'});
  }catch(error){
    if(submission){try{await updateRow(cfg,cfg.submissions,submission.id,{Status:'Rejected','Processing completed at':new Date().toISOString(),'Failure reason':String(error.message||error)});}catch{}}
    return json({ok:false,message:String(error.message||'The order could not be submitted.')},Number(error.status)||500);
  }
}
