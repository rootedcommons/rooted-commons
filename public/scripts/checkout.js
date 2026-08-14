const configNode=document.querySelector('#checkout-config');
const {products,points,checkoutEmptyHeading,checkoutEmptyText,checkoutConfirmButton,checkoutFreshnessWarning}=JSON.parse(configNode?.textContent||'{}');
const STORAGE_KEY='rooted-commons-basket-v1';
const POINT_KEY='rooted-commons-collection-point-v1';
const REQUEST_KEY='rooted-commons-checkout-request-v2';
localStorage.removeItem('rooted-commons-order-token-v1');
const money=new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'});
const productMap=new Map((products||[]).map(product=>[Number(product.id),product]));
const pointMap=new Map((points||[]).map(point=>[Number(point.id),point]));
const normalise=value=>String(value||'').trim().toLowerCase();
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const requestId=()=>crypto.randomUUID?crypto.randomUUID():`rc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const params=new URLSearchParams(location.search);
const urlToken=params.get('token');
if(urlToken)location.replace(`/api/access?token=${encodeURIComponent(urlToken)}&return=${encodeURIComponent('/checkout/')}`);

let member=null;
let basket={};
try{basket=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{basket={};}
let selectedPointId=0;
let selectedCollectionDay='';
let selectionConfirmed=false;
let usingCustomSelection=false;
let preferenceIssue=null;
let pendingPointId=0;
let pendingDay='';
let ordersTemporarilyClosed=false;
let ordersClosedMessage='';

const basketLines=document.querySelector('#checkout-basket-lines');
const totalElement=document.querySelector('#checkout-total');
const submitButton=document.querySelector('#submit-order');
const submitMessage=document.querySelector('#submit-message');
const collectionPicker=document.querySelector('#checkout-collection-picker');
const changeCollectionButton=document.querySelector('#checkout-change-collection');
const cancelCollectionButton=document.querySelector('#checkout-cancel-collection');
const useCollectionButton=document.querySelector('#checkout-use-collection');
const pointSelect=document.querySelector('#checkout-point-select');
const slotPanel=document.querySelector('#collection-slot-panel');
const slotOptions=document.querySelector('#collection-slot-options');
const collectionMessage=document.querySelector('#collection-message');
const freshnessWarning=document.querySelector('#collection-freshness-warning');
const checkoutPointDetails=document.querySelector('#checkout-point-details');
const checkoutWarning=document.querySelector('#checkout-collection-warning');
const checkoutPointImage=document.querySelector('#checkout-point-image');
const checkoutPointName=document.querySelector('#checkout-point-name');
const checkoutPointTime=document.querySelector('#checkout-point-time');
const checkoutPointAddress=document.querySelector('#checkout-point-address');

const dayRank={Thursday:0,Friday:1,Saturday:2,Sunday:3};
const restrictionRank={'thursday-only':0,'friday-okay':1,'weekend-okay':3};
function restrictionFor(product){return restrictionRank[normalise(product?.lateCollection).replace(/\s+/g,'-')]??3;}
function marketCycle(){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  const day={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[parts.weekday];
  const hour=Number(parts.hour);const minute=Number(parts.minute);
  let toThu=(4-day+7)%7;if(day===4)toThu=7;if(day===3&&(hour>18||(hour===18&&minute>=0)))toThu+=7;
  const d=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)+toThu,12));
  return {marketThursday:d};
}
const ordinal=n=>`${n}${(n%100>=11&&n%100<=13)?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th')}`;
const dateLabel=d=>`${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]} ${ordinal(d.getDate())} ${d.toLocaleDateString('en-GB',{month:'long'})}`;

function selectedItems(){
  return Object.entries(basket).map(([productId,quantity])=>({product:productMap.get(Number(productId)),productId:Number(productId),quantity:Number(quantity)})).filter(item=>item.product&&item.quantity>0);
}
function basketTotal(){return selectedItems().reduce((sum,item)=>sum+(Number(item.product.price)||0)*item.quantity,0);}
function saveBasket(){localStorage.setItem(STORAGE_KEY,JSON.stringify(basket));}
function itemPointCompatible(item,point){
  const explicit=(item.product.collectionPointIds||[]).map(Number).filter(Number.isFinite);
  if(explicit.length&&!explicit.includes(Number(point.id)))return false;
  const supported=(point.availableCategories||[]).map(normalise).filter(Boolean);
  if(!supported.length)return true;
  const categories=(item.product.categories||[]).map(normalise).filter(Boolean);
  return !categories.length||categories.some(category=>supported.includes(category));
}
function pointCompatible(point){return Boolean(point)&&selectedItems().every(item=>itemPointCompatible(item,point));}
function itemDayCompatible(item,day){return (dayRank[day]??99)<=restrictionFor(item.product);}
function availableSlots(point){
  if(!point||!pointCompatible(point))return [];
  return (point.collectionSlots||[]).filter(slot=>selectedItems().every(item=>itemDayCompatible(item,slot.day))).sort((a,b)=>(dayRank[a.day]??99)-(dayRank[b.day]??99));
}
function validPoints(){return (points||[]).filter(point=>pointCompatible(point)&&availableSlots(point).length>0);}
function selectedPoint(){return pointMap.get(Number(selectedPointId));}
function pointReasonItems(point){return selectedItems().filter(item=>!itemPointCompatible(item,point));}
function dayReasonItems(day){return selectedItems().filter(item=>!itemDayCompatible(item,day));}

function evaluatePreferredSelection(){
  if(!member)return;
  const preferredPoint=member.collectionPoint?.id?pointMap.get(Number(member.collectionPoint.id)):null;
  const preferredDay=member.preferredCollectionDay||'';
  preferenceIssue=null;
  selectionConfirmed=false;
  if(!preferredPoint){selectedPointId=0;selectedCollectionDay='';return;}
  const slots=availableSlots(preferredPoint);
  if(!pointCompatible(preferredPoint)||!slots.length){
    selectedPointId=0;selectedCollectionDay='';
    preferenceIssue={type:'point',point:preferredPoint,reasonItems:pointReasonItems(preferredPoint)};
    return;
  }
  if(preferredDay&&!slots.some(slot=>slot.day===preferredDay)){
    selectedPointId=Number(preferredPoint.id);selectedCollectionDay='';
    preferenceIssue={type:'day',point:preferredPoint,preferredDay,suggestedDay:slots[0]?.day||'',reasonItems:dayReasonItems(preferredDay)};
    return;
  }
  selectedPointId=Number(preferredPoint.id);
  selectedCollectionDay=preferredDay||slots[0]?.day||'';
  selectionConfirmed=Boolean(selectedCollectionDay);
  if(selectionConfirmed)localStorage.setItem(POINT_KEY,String(selectedPointId));
}
function validateCustomSelection(){
  if(!selectionConfirmed)return;
  const point=selectedPoint();
  if(!point||!pointCompatible(point)||!availableSlots(point).length){
    preferenceIssue={type:'selected-point',point,reasonItems:point?pointReasonItems(point):[]};
    selectionConfirmed=false;selectedCollectionDay='';return;
  }
  if(!availableSlots(point).some(slot=>slot.day===selectedCollectionDay)){
    const oldDay=selectedCollectionDay;
    preferenceIssue={type:'selected-day',point,preferredDay:oldDay,suggestedDay:availableSlots(point)[0]?.day||'',reasonItems:dayReasonItems(oldDay)};
    selectionConfirmed=false;selectedCollectionDay='';
  }
}
function refreshCollectionState(){
  if(member&&!usingCustomSelection)evaluatePreferredSelection();
  else validateCustomSelection();
}

function renderBasket(){
  const items=selectedItems();
  if(!items.length)basketLines.innerHTML=`<h3>${escapeHtml(checkoutEmptyHeading||'Your basket is empty')}</h3><p>${escapeHtml(checkoutEmptyText||'Return to the shop to add something.')}</p>`;
  else{
    const trash='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/></svg>';
    basketLines.innerHTML=items.map(item=>`<div class="checkout-line"><div><strong>${escapeHtml(item.product.name)}${item.product.size?` – ${escapeHtml(item.product.size)}`:''}</strong><span>${money.format(item.product.price)} each</span></div><div class="checkout-line-controls"><button type="button" data-checkout-action="decrease" data-product-id="${item.productId}" aria-label="Decrease ${escapeHtml(item.product.name)}">−</button><span>${item.quantity}</span><button type="button" data-checkout-action="increase" data-product-id="${item.productId}" aria-label="Increase ${escapeHtml(item.product.name)}">+</button><button type="button" class="checkout-trash" data-checkout-action="remove" data-product-id="${item.productId}" aria-label="Remove ${escapeHtml(item.product.name)}">${trash}</button></div><strong>${money.format(item.product.price*item.quantity)}</strong></div>`).join('');
  }
  totalElement.textContent=money.format(basketTotal());
  refreshCollectionState();
  renderCollectionSummary();
  if(!collectionPicker.hidden)renderCollectionPicker();
  renderMemberSummary();
  updateSubmitState();
}

function pointReasonDetail(items,point,fallback){
  if(items?.length)return items.map(item=>`${escapeHtml(item.product.name)} can’t be collected from ${escapeHtml(point?.name||'this collection point')}.`).join(' ');
  return fallback;
}
function dayReasonDetail(items,day,fallback){
  if(items?.length)return items.map(item=>{
    const latest={0:'Thursday',1:'Friday',2:'Saturday',3:'Sunday'}[restrictionFor(item.product)]||'an earlier day';
    return `${escapeHtml(item.product.name)} needs to be collected by ${latest}.`;
  }).join(' ');
  return fallback;
}
function warningHtml(issue){
  if(!issue)return '';
  const pointName=escapeHtml(issue.point?.name||'your usual collection point');
  if(issue.type==='point'){
    return `<strong>Your usual collection option isn’t available for this order.</strong><p>One or more items in your basket can’t be collected from ${pointName}. <button class="checkout-why-toggle" type="button" data-checkout-why aria-expanded="false">Why?</button></p><p class="checkout-why-detail" data-checkout-why-detail hidden>${pointReasonDetail(issue.reasonItems,issue.point,'This collection point cannot take every category in your basket.')}</p>`;
  }
  if(issue.type==='day'){
    return `<strong>${escapeHtml(issue.preferredDay)} isn’t available for this basket.</strong><p>Some items need to be collected sooner. <button class="checkout-why-toggle" type="button" data-checkout-why aria-expanded="false">Why?</button>${issue.suggestedDay?` You can still collect from ${pointName} on ${escapeHtml(issue.suggestedDay)}.`:''}</p><p class="checkout-why-detail" data-checkout-why-detail hidden>${dayReasonDetail(issue.reasonItems,issue.preferredDay,'One or more items cannot be held until that day.')}</p>`;
  }
  if(issue.type==='selected-point'){
    return `<strong>Your selected collection option isn’t available for this basket.</strong><p>One or more items can’t be collected from ${pointName}. <button class="checkout-why-toggle" type="button" data-checkout-why aria-expanded="false">Why?</button></p><p class="checkout-why-detail" data-checkout-why-detail hidden>${pointReasonDetail(issue.reasonItems,issue.point,'The basket has changed and this point no longer works for every item.')}</p>`;
  }
  return `<strong>${escapeHtml(issue.preferredDay||'That day')} isn’t available for this basket.</strong><p>Some items need to be collected sooner. <button class="checkout-why-toggle" type="button" data-checkout-why aria-expanded="false">Why?</button>${issue.suggestedDay?` ${pointName} is still available on ${escapeHtml(issue.suggestedDay)}.`:''}</p><p class="checkout-why-detail" data-checkout-why-detail hidden>${dayReasonDetail(issue.reasonItems,issue.preferredDay,'The basket has changed and that day no longer works for every item.')}</p>`;
}
function renderCollectionSummary(){
  if(preferenceIssue){
    checkoutPointDetails.hidden=true;
    checkoutWarning.hidden=false;
    checkoutWarning.innerHTML=warningHtml(preferenceIssue);
    changeCollectionButton.textContent='Change collection options';
    return;
  }
  checkoutWarning.hidden=true;checkoutWarning.innerHTML='';
  checkoutPointDetails.hidden=false;
  if(!selectionConfirmed||!selectedPoint()){
    checkoutPointName.textContent='Not selected';checkoutPointTime.textContent='';checkoutPointAddress.textContent='';checkoutPointImage.hidden=true;checkoutPointImage.removeAttribute('src');changeCollectionButton.textContent='Choose collection options';return;
  }
  const point=selectedPoint();
  const slot=(point.collectionSlots||[]).find(item=>item.day===selectedCollectionDay);
  checkoutPointName.textContent=point.name||'';
  checkoutPointTime.textContent=slot?`${slot.day} · ${slot.time}`:(point.collectionTime||'');
  checkoutPointAddress.textContent=point.address||'';
  if(point.image){checkoutPointImage.src=point.image;checkoutPointImage.alt=point.name?`${point.name} collection point`:'';checkoutPointImage.hidden=false;}else{checkoutPointImage.hidden=true;checkoutPointImage.removeAttribute('src');}
  changeCollectionButton.textContent='Change collection options';
}

function pendingPoint(){return pointMap.get(Number(pendingPointId));}
function renderPendingSlots(){
  const point=pendingPoint();
  const slots=availableSlots(point);
  if(!slots.length){slotOptions.innerHTML='';slotPanel.hidden=true;pendingDay='';useCollectionButton.disabled=true;return;}
  if(!slots.some(slot=>slot.day===pendingDay))pendingDay=(member?.preferredCollectionDay&&slots.some(slot=>slot.day===member.preferredCollectionDay))?member.preferredCollectionDay:(slots[0]?.day||'');
  const cycle=marketCycle();
  slotOptions.innerHTML=slots.map(slot=>{
    const d=new Date(cycle.marketThursday);d.setDate(d.getDate()+(dayRank[slot.day]||0));
    return `<label class="collection-slot-option"><input type="radio" name="collection-slot" value="${escapeHtml(slot.day)}" ${slot.day===pendingDay?'checked':''}><span>${dateLabel(d)} · ${escapeHtml(slot.time)}${slot.day==='Thursday'?' <strong>— recommended</strong>':''}</span></label>`;
  }).join('');
  slotPanel.hidden=false;
  useCollectionButton.disabled=!pendingDay;
  const hasFridaySensitive=selectedItems().some(item=>restrictionFor(item.product)===1);
  freshnessWarning.hidden=!(pendingDay==='Friday'&&hasFridaySensitive);
  freshnessWarning.textContent=freshnessWarning.hidden?'':(checkoutFreshnessWarning||'Fresh produce is packed on Thursday and may not be at its best by Friday.');
}
function renderCollectionPicker(){
  const valid=validPoints();
  if(!valid.length){pointSelect.innerHTML='<option value="">No collection option is available for this basket</option>';pointSelect.disabled=true;slotPanel.hidden=true;useCollectionButton.disabled=true;collectionMessage.textContent='No collection point can currently take every item in this basket.';return;}
  pointSelect.disabled=false;
  if(!valid.some(point=>Number(point.id)===Number(pendingPointId))){
    const preferredId=Number(member?.collectionPoint?.id||0);
    pendingPointId=valid.some(point=>Number(point.id)===preferredId)?preferredId:Number(valid[0].id);
    pendingDay='';
  }
  pointSelect.innerHTML=valid.map(point=>`<option value="${Number(point.id)}" ${Number(point.id)===Number(pendingPointId)?'selected':''}>${escapeHtml(point.name)}</option>`).join('');
  collectionMessage.textContent='';
  renderPendingSlots();
}
function openCollectionPicker(){
  pendingPointId=selectionConfirmed?selectedPointId:(preferenceIssue?.point&&validPoints().some(point=>Number(point.id)===Number(preferenceIssue.point.id))?Number(preferenceIssue.point.id):0);
  pendingDay=selectionConfirmed?selectedCollectionDay:'';
  collectionPicker.hidden=false;
  renderCollectionPicker();
  document.querySelector('.checkout-collection-summary')?.scrollIntoView({behavior:'smooth',block:'start'});
}
changeCollectionButton?.addEventListener('click',()=>{if(collectionPicker.hidden)openCollectionPicker();else collectionPicker.hidden=true;});
cancelCollectionButton?.addEventListener('click',()=>{collectionPicker.hidden=true;});
pointSelect?.addEventListener('change',()=>{pendingPointId=Number(pointSelect.value||0);pendingDay='';renderPendingSlots();});
slotOptions?.addEventListener('change',event=>{if(event.target.matches('input[name="collection-slot"]')){pendingDay=event.target.value;renderPendingSlots();}});
useCollectionButton?.addEventListener('click',()=>{
  const point=pendingPoint();
  if(!point||!pointCompatible(point)||!availableSlots(point).some(slot=>slot.day===pendingDay))return;
  selectedPointId=Number(point.id);selectedCollectionDay=pendingDay;selectionConfirmed=true;usingCustomSelection=true;preferenceIssue=null;
  localStorage.setItem(POINT_KEY,String(selectedPointId));collectionPicker.hidden=true;renderCollectionSummary();renderMemberSummary();updateSubmitState();
});
document.addEventListener('click',event=>{
  const why=event.target.closest('[data-checkout-why]');
  if(!why)return;
  const detail=checkoutWarning.querySelector('[data-checkout-why-detail]');
  if(!detail)return;
  const open=detail.hidden;detail.hidden=!open;why.setAttribute('aria-expanded',open?'true':'false');why.textContent=open?'Hide reason':'Why?';
});

function renderMemberSummary(){
  if(!member)return;
  const total=basketTotal();const point=selectionConfirmed?selectedPoint():null;const closing=(Number(member.credit)||0)-total;
  const slot=point?(point.collectionSlots||[]).find(item=>item.day===selectedCollectionDay):null;
  const cycle=marketCycle();const d=new Date(cycle.marketThursday);d.setDate(d.getDate()+(dayRank[selectedCollectionDay]||0));
  const collectionLabel=point&&slot?`${point.name} · ${dateLabel(d)} · ${slot.time}`:'Choose a collection option';
  document.querySelector('#verified-member').innerHTML=`<div class="verified-summary"><p><strong>Hi ${escapeHtml(member.firstName||'member')}</strong></p><dl><div><dt>Member credit</dt><dd>${money.format(member.credit||0)}</dd></div><div><dt>This order</dt><dd>−${money.format(total)}</dd></div><div><dt>Estimated balance</dt><dd class="${closing<0?'amount-negative':''}">${money.format(closing)}</dd></div><div><dt>Collection</dt><dd>${escapeHtml(collectionLabel)}</dd></div></dl>${closing<0?`<div class="checkout-balance-warning"><strong>Extra top-up needed: ${money.format(Math.abs(closing))}</strong><p>You can still reserve your order, but your account must be £0.00 or above before collection.</p></div>`:''}</div>`;
}
function updateSubmitState(){
  const point=selectedPoint();
  const otherwiseReady=Boolean(member&&selectedItems().length&&selectionConfirmed&&point&&pointCompatible(point)&&selectedCollectionDay&&availableSlots(point).some(slot=>slot.day===selectedCollectionDay));
  submitButton.disabled=ordersTemporarilyClosed||!otherwiseReady;
  submitButton.textContent=ordersTemporarilyClosed?'Orders currently closed':checkoutConfirmButton;
  if(ordersTemporarilyClosed)submitMessage.textContent=ordersClosedMessage;
  else if(submitMessage.textContent===ordersClosedMessage)submitMessage.textContent='';
}

async function loadOrderStatus(){
  try{
    const response=await fetch('/api/order-status',{cache:'no-store',headers:{accept:'application/json'}});
    const payload=await response.json();
    if(!response.ok||!payload.ok)return;
    ordersTemporarilyClosed=payload.closed===true;
    ordersClosedMessage=String(payload.message||'Orders are currently closed.');
    updateSubmitState();
  }catch(error){console.warn('Order status could not be loaded',error);}
}

document.addEventListener('click',event=>{
  const button=event.target.closest('[data-checkout-action]');
  if(!button)return;
  const id=button.dataset.productId;const action=button.dataset.checkoutAction;
  if(action==='increase'){const product=productMap.get(Number(id));const maximum=Math.max(0,Number(product?.availableStock??Infinity));basket[id]=Math.min(maximum,Number(basket[id]||0)+1);}
  if(action==='decrease')basket[id]=Math.max(0,Number(basket[id]||0)-1);
  if(action==='remove'||!basket[id])delete basket[id];
  saveBasket();renderBasket();
});

async function loadLiveProducts(){
  try{
    const response=await(window.RootedData?.products?.()||fetch('/api/products',{headers:{accept:'application/json'}}));
    const payload=await response.json();
    if(!response.ok||!payload.ok)throw new Error(payload.message||'Live product data could not be loaded.');
    for(const live of payload.products||[]){
      const product=productMap.get(Number(live.id));if(!product)continue;
      if(Number.isFinite(Number(live.memberPrice)))product.price=Number(live.memberPrice);
      product.availableStock=Math.max(0,Number(live.availableStock||0));product.available=live.available!==false;
    }
    for(const item of selectedItems()){
      const maximum=item.product.available===false?0:Number(item.product.availableStock||0);
      if(item.quantity>maximum){if(maximum>0)basket[item.productId]=maximum;else delete basket[item.productId];}
    }
    saveBasket();renderBasket();
  }catch(error){submitMessage.textContent='Current prices and availability could not be loaded. Please refresh before confirming.';submitButton.disabled=true;console.error(error);}
}
async function verifyMember(){
  const response=await(window.RootedData?.member?.()||fetch('/api/member',{cache:'no-store'}));
  if(!response.ok){if(response.status===401)window.__rootedSetAuthState?.(false);return;}
  window.__rootedSetAuthState?.(true);
  const payload=await response.json();member=payload.member;usingCustomSelection=false;
  document.querySelector('#unverified-member-panel').hidden=true;document.querySelector('#verified-member-panel').hidden=false;
  const joinCard=document.querySelector('#checkout-join-card');if(joinCard)joinCard.hidden=true;
  renderBasket();
}

document.querySelector('#email-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;const message=document.querySelector('#email-message');const button=form.querySelector('button');button.disabled=true;message.textContent='Checking…';
  const response=await fetch('/api/request-link',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:new FormData(form).get('email'),basketSummary:selectedItems().map(item=>({productId:item.productId,quantity:item.quantity})),returnPath:'/checkout/'})});
  const payload=await response.json();message.textContent=payload.message||'Please check your email.';button.disabled=false;
});
submitButton.addEventListener('click',async()=>{
  submitButton.disabled=true;submitButton.textContent='Submitting…';submitMessage.textContent='Checking prices, availability and your member session…';
  let clientRequestId=sessionStorage.getItem(REQUEST_KEY);if(!clientRequestId){clientRequestId=requestId();sessionStorage.setItem(REQUEST_KEY,clientRequestId);}
  const response=await fetch('/api/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientRequestId,collectionPointId:selectedPointId,collectionDay:selectedCollectionDay,items:selectedItems().map(item=>({productId:item.productId,quantity:item.quantity}))})});
  const payload=await response.json();
  if(response.ok&&payload.ok){
    localStorage.removeItem(STORAGE_KEY);sessionStorage.removeItem(REQUEST_KEY);basket={};
    const needsTopup=Number(payload.closingCredit)<0;const confirmationHeading=needsTopup?'Order reserved':'Order confirmed';const openingCopy=needsTopup?'We’ve reserved your produce while you top up your account.':'Your order has been placed successfully.';
    const paymentNotice=needsTopup?`<div class="checkout-payment-required"><h3>Top up before collection</h3><p>Your estimated balance is <strong>${money.format(payload.closingCredit)}</strong>.</p><p>Please ensure your account is <strong>£0.00 or above</strong> before your collection time. If payment has not been received before orders are prepared, your order will be refunded and the produce returned to available stock.</p><p>Bank transfer is recommended. An optional secure online payment link will be available in your confirmation email and membership dashboard.</p></div>`:'';
    document.querySelector('.checkout-shell').innerHTML=`<section class="checkout-card checkout-success"><h2>${confirmationHeading}</h2><p>${openingCopy}</p><p>Order: <strong>${escapeHtml(payload.orderNumber)}</strong><br>Total: <strong>${money.format(payload.total)}</strong><br>Collection: <strong>${escapeHtml(payload.collectionPoint)} · ${escapeHtml(payload.collectionDay)} ${escapeHtml(payload.collectionDate)} · ${escapeHtml(payload.collectionTime)}</strong><br>Estimated closing credit: <strong>${money.format(payload.closingCredit)}</strong></p>${paymentNotice}<a class="button" href="/dashboard/">Return to your dashboard</a></section>`;
  }else{submitMessage.textContent=payload.message||'The order could not be submitted.';submitButton.disabled=false;submitButton.textContent=checkoutConfirmButton;}
});

renderBasket();
loadOrderStatus();
loadLiveProducts();
verifyMember();
