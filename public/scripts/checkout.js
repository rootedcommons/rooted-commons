const configNode=document.querySelector('#checkout-config');
const {products,points,checkoutEmptyHeading,checkoutEmptyText,checkoutConfirmButton,checkoutSuccessHeading,checkoutFreshnessWarning}=JSON.parse(configNode?.textContent||'{}');
    const STORAGE_KEY='rooted-commons-basket-v1';
    localStorage.removeItem('rooted-commons-order-token-v1');
    const POINT_KEY='rooted-commons-collection-point-v1';
    const REQUEST_KEY='rooted-commons-checkout-request-v2';
    const money=new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'});
    const productMap=new Map(products.map(product=>[Number(product.id),product]));
    const pointMap=new Map(points.map(point=>[Number(point.id),point]));
    const normalise=value=>String(value||'').trim().toLowerCase();
    const requestId=()=>crypto.randomUUID?crypto.randomUUID():`rc-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const params=new URLSearchParams(location.search);
    const urlToken=params.get('token');
    if(urlToken)location.replace(`/api/access?token=${encodeURIComponent(urlToken)}&return=${encodeURIComponent('/checkout/')}`);
    let token='';
    let member=null;
    let selectedPointId=Number(localStorage.getItem(POINT_KEY)||0);
    let selectedCollectionDay='';
    let basket={};
    try{basket=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{basket={};}

    const basketLines=document.querySelector('#checkout-basket-lines');
    const totalElement=document.querySelector('#checkout-total');
    const collectionCards=[...document.querySelectorAll('[data-collection-point]')];
    const collectionMessage=document.querySelector('#collection-message');
    const submitButton=document.querySelector('#submit-order');
    const submitMessage=document.querySelector('#submit-message');
    const slotPanel=document.querySelector('#collection-slot-panel');
    const slotOptions=document.querySelector('#collection-slot-options');
    const freshnessWarning=document.querySelector('#collection-freshness-warning');
    const collectionPicker=document.querySelector('#checkout-collection-picker');
    const changeCollectionButton=document.querySelector('#checkout-change-collection');
    const checkoutPointImage=document.querySelector('#checkout-point-image');
    const checkoutPointName=document.querySelector('#checkout-point-name');
    const checkoutPointTime=document.querySelector('#checkout-point-time');
    const checkoutPointPreference=document.querySelector('#checkout-point-preference');
    const checkoutPointAddress=document.querySelector('#checkout-point-address');
    const checkoutPointDeadline=document.querySelector('#checkout-point-deadline');
    const checkoutPointLink=document.querySelector('#checkout-point-link');


    const dayRank={Thursday:0,Friday:1,Saturday:2,Sunday:3};
    const restrictionRank={'thursday-only':0,'friday-okay':1,'weekend-okay':3};
    function marketCycle(){
      const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
      const day={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[parts.weekday];
      const hour=Number(parts.hour); const minute=Number(parts.minute);
      let toThu=(4-day+7)%7; if(day===4)toThu=7; if(day===3&&(hour>18||(hour===18&&minute>=0)))toThu+=7;
      const d=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)+toThu,12));
      const rollover=(day===3&&(hour>18||(hour===18&&minute>=0)))||[4,5,6,0].includes(day);
      return {marketThursday:d,rollover};
    }
    const ordinal=n=>`${n}${(n%100>=11&&n%100<=13)?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th')}`;
    const dateLabel=d=>`${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]} ${ordinal(d.getDate())} ${d.toLocaleDateString('en-GB',{month:'long'})}`;
    function basketLatestRank(){return selectedItems().reduce((rank,item)=>Math.min(rank,restrictionRank[normalise(item.product.lateCollection).replace(/\s+/g,'-')]??3),3);}
    function availableSlots(point){
      const max=basketLatestRank();
      return (point?.collectionSlots||[]).filter(slot=>(dayRank[slot.day]??99)<=max);
    }
    function renderSlots(){
      const point=selectedPoint();
      if(!point){slotPanel.hidden=true;selectedCollectionDay='';return;}
      const slots=availableSlots(point);
      if(!slots.some(slot=>slot.day===selectedCollectionDay)){
        const preferred=member?.preferredCollectionDay;
        selectedCollectionDay=slots.some(slot=>slot.day===preferred)?preferred:(slots[0]?.day||'');
      }
      const cycle=marketCycle();
      slotOptions.innerHTML=slots.map(slot=>{
        const d=new Date(cycle.marketThursday); d.setDate(d.getDate()+(dayRank[slot.day]||0));
        const checked=slot.day===selectedCollectionDay?'checked':'';
        const recommended=slot.day==='Thursday'?' <strong>— recommended</strong>':'';
        return `<label class="collection-slot-option"><input type="radio" name="collection-slot" value="${slot.day}" ${checked}><span>${dateLabel(d)} · ${slot.time}${recommended}</span></label>`;
      }).join('');
      slotPanel.hidden=!slots.length;
      const hasFridaySensitive=selectedItems().some(item=>normalise(item.product.lateCollection).replace(/\s+/g,'-')==='friday-okay');
      if(freshnessWarning){
        freshnessWarning.hidden=!(selectedCollectionDay==='Friday'&&hasFridaySensitive);
        freshnessWarning.textContent=freshnessWarning.hidden?'':checkoutFreshnessWarning;
      }
    }
    slotOptions?.addEventListener('change',event=>{if(event.target.matches('input[name="collection-slot"]')){selectedCollectionDay=event.target.value;renderMemberSummary();updateSubmitState();}});

    function selectedItems(){
      return Object.entries(basket)
        .map(([productId,quantity])=>({product:productMap.get(Number(productId)),productId:Number(productId),quantity:Number(quantity)}))
        .filter(item=>item.product&&item.quantity>0);
    }
    function basketTotal(){return selectedItems().reduce((sum,item)=>sum+(Number(item.product.price)||0)*item.quantity,0);}
    function basketCategories(){return [...new Set(selectedItems().flatMap(item=>item.product.categories||[]).filter(Boolean))];}
    function saveBasket(){localStorage.setItem(STORAGE_KEY,JSON.stringify(basket));}
    function pointCompatible(point){
      const supported=(point.availableCategories||[]).map(normalise);
      if(!supported.length)return true;
      return selectedItems().every(item=>{
        const categories=(item.product.categories||[]).map(normalise);
        return !categories.length||categories.some(category=>supported.includes(category));
      });
    }
    function selectedPoint(){return pointMap.get(Number(selectedPointId));}

    function renderBasket(){
      const items=selectedItems();
      if(!items.length){
        basketLines.innerHTML=`<h3>${checkoutEmptyHeading}</h3><p>${checkoutEmptyText}</p>`;
      }else{
        const trash='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/></svg>';
        basketLines.innerHTML=items.map(item=>`<div class="checkout-line"><div><strong>${item.product.name}${item.product.size?` – ${item.product.size}`:''}</strong><span>${money.format(item.product.price)} each</span></div><div class="checkout-line-controls"><button type="button" data-checkout-action="decrease" data-product-id="${item.productId}" aria-label="Decrease ${item.product.name}">−</button><span>${item.quantity}</span><button type="button" data-checkout-action="increase" data-product-id="${item.productId}" aria-label="Increase ${item.product.name}">+</button><button type="button" class="checkout-trash" data-checkout-action="remove" data-product-id="${item.productId}" aria-label="Remove ${item.product.name}">${trash}</button></div><strong>${money.format(item.product.price*item.quantity)}</strong></div>`).join('');
      }
      totalElement.textContent=money.format(basketTotal());
      renderCollectionPoints();
      renderSlots();
      renderMemberSummary();
      renderCollectionSummary();
    }

    function renderCollectionSummary(){
      const point=selectedPoint();
      if(!point){
        checkoutPointName.textContent='Not selected';
        checkoutPointTime.textContent='';
        checkoutPointPreference.textContent='';
        checkoutPointAddress.textContent='';
        checkoutPointDeadline.textContent='';
        checkoutPointImage.hidden=true;
        checkoutPointImage.removeAttribute('src');
        checkoutPointLink.hidden=true;
        changeCollectionButton.textContent='Choose collection point';
        return;
      }
      const slot=availableSlots(point).find(item=>item.day===selectedCollectionDay)||(point.collectionSlots||[]).find(item=>item.day===member?.preferredCollectionDay)||(point.collectionSlots||[])[0];
      checkoutPointName.textContent=point.name||'Not selected';
      checkoutPointTime.textContent=slot?`${slot.day} · ${slot.time}`:(point.collectionTime||'');
      checkoutPointPreference.textContent=slot?'Your preferred collection slot. Checkout confirms what is available for each basket.':'';
      checkoutPointAddress.textContent=point.address||'';
      checkoutPointDeadline.textContent='Orders close Wednesday 18.00.';
      if(point.image){
        checkoutPointImage.src=point.image;
        checkoutPointImage.alt=point.name?`${point.name} collection point`:'';
        checkoutPointImage.hidden=false;
      }else{
        checkoutPointImage.hidden=true;
        checkoutPointImage.removeAttribute('src');
      }
      if(point.link){checkoutPointLink.href=point.link;checkoutPointLink.hidden=false;}else{checkoutPointLink.hidden=true;checkoutPointLink.removeAttribute('href');}
      changeCollectionButton.textContent='Change collection point';
    }

    changeCollectionButton?.addEventListener('click',()=>{
      collectionPicker.hidden=!collectionPicker.hidden;
      if(!collectionPicker.hidden)collectionPicker.scrollIntoView({behavior:'smooth',block:'start'});
    });

    function renderCollectionPoints(){
      const categories=basketCategories();
      collectionCards.forEach(card=>{
        const point=pointMap.get(Number(card.dataset.pointId));
        const compatible=point&&pointCompatible(point)&&availableSlots(point).length>0;
        card.disabled=!compatible;
        card.classList.toggle('incompatible',!compatible);
        card.classList.toggle('selected',compatible&&Number(point.id)===Number(selectedPointId));
        const label=card.querySelector('.collection-select-label');
        if(label)label.textContent=!compatible?'Not available':Number(point.id)===Number(selectedPointId)?'Selected':'Select';
      });
      const current=selectedPoint();
      if(current&&!pointCompatible(current)){
        selectedPointId=0;
        localStorage.removeItem(POINT_KEY);
      }
      collectionMessage.textContent=categories.length?`This basket includes: ${categories.join(', ')}.`:'';
      renderSlots();
      updateSubmitState();
    }

    function renderMemberSummary(){
      if(!member)return;
      const total=basketTotal();
      const point=selectedPoint();
      const closing=(Number(member.credit)||0)-total;
      const slot=(point?.collectionSlots||[]).find(item=>item.day===selectedCollectionDay);
      const cycle=marketCycle(); const d=new Date(cycle.marketThursday); d.setDate(d.getDate()+(dayRank[selectedCollectionDay]||0));
      const collectionLabel=point&&slot?`${point.name} · ${dateLabel(d)} · ${slot.time}`:(point?point.name:'Choose a collection point');
      document.querySelector('#verified-member').innerHTML=`<div class="verified-summary"><p><strong>Hi ${member.firstName||'member'}</strong></p><dl><div><dt>Member credit</dt><dd>${money.format(member.credit||0)}</dd></div><div><dt>This order</dt><dd>−${money.format(total)}</dd></div><div><dt>Estimated balance</dt><dd class="${closing<0?'amount-negative':''}">${money.format(closing)}</dd></div><div><dt>Collection</dt><dd>${collectionLabel}</dd></div></dl>${closing<0?`<div class="checkout-balance-warning"><strong>Extra top-up needed: ${money.format(Math.abs(closing))}</strong><p>You can still reserve your order, but your account must be £0.00 or above before collection.</p></div>`:''}</div>`;
      updateSubmitState();
    }

    function updateSubmitState(){
      const point=selectedPoint();
      submitButton.disabled=!(member&&selectedItems().length&&point&&pointCompatible(point)&&selectedCollectionDay&&availableSlots(point).some(slot=>slot.day===selectedCollectionDay));
    }

    collectionCards.forEach(card=>card.addEventListener('click',()=>{
      if(card.disabled)return;
      selectedPointId=Number(card.dataset.pointId);
      localStorage.setItem(POINT_KEY,String(selectedPointId));
      renderCollectionPoints();
      renderSlots();
      renderMemberSummary();
      renderCollectionSummary();
      collectionPicker.hidden=true;
    }));

    document.addEventListener('click',event=>{
      const button=event.target.closest('[data-checkout-action]');
      if(!button)return;
      const id=button.dataset.productId;
      const action=button.dataset.checkoutAction;
      if(action==='increase'){const product=productMap.get(Number(id));const maximum=Math.max(0,Number(product?.availableStock??Infinity));basket[id]=Math.min(maximum,Number(basket[id]||0)+1);}
      if(action==='decrease')basket[id]=Math.max(0,Number(basket[id]||0)-1);
      if(action==='remove'||!basket[id])delete basket[id];
      saveBasket();
      renderBasket();
    });

    async function loadLiveProducts(){
      try{
        const response=await (window.RootedData?.products?.() || fetch('/api/products',{headers:{accept:'application/json'}}));
        const payload=await response.json();
        if(!response.ok||!payload.ok)throw new Error(payload.message||'Live product data could not be loaded.');
        for(const live of payload.products||[]){
          const product=productMap.get(Number(live.id));
          if(!product)continue;
          if(Number.isFinite(Number(live.memberPrice)))product.price=Number(live.memberPrice);
          product.availableStock=Math.max(0,Number(live.availableStock||0));
          product.available=live.available!==false;
        }
        for(const item of selectedItems()){
          const maximum=item.product.available===false?0:Number(item.product.availableStock||0);
          if(item.quantity>maximum){
            if(maximum>0)basket[item.productId]=maximum;
            else delete basket[item.productId];
          }
        }
        saveBasket();
        renderBasket();
      }catch(error){
        submitMessage.textContent='Current prices and availability could not be loaded. Please refresh before confirming.';
        submitButton.disabled=true;
        console.error(error);
      }
    }

    async function verifyMember(){
      const response=await (window.RootedData?.member?.() || fetch('/api/member',{cache:'no-store'}));
      if(!response.ok){if(response.status===401)window.__rootedSetAuthState?.(false);return;}
      window.__rootedSetAuthState?.(true);
      const payload=await response.json();
      member=payload.member;
      document.querySelector('#unverified-member-panel').hidden=true;
      document.querySelector('#verified-member-panel').hidden=false;
      const joinCard=document.querySelector('#checkout-join-card');
      if(joinCard)joinCard.hidden=true;
      selectedCollectionDay=member.preferredCollectionDay||'';
      if(member.collectionPoint?.id){
        const preferred=pointMap.get(Number(member.collectionPoint.id));
        if(preferred&&pointCompatible(preferred)){
          selectedPointId=Number(preferred.id);
          localStorage.setItem(POINT_KEY,String(selectedPointId));
        }
      }
      renderBasket();
    }

    document.querySelector('#email-form').addEventListener('submit',async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const message=document.querySelector('#email-message');
      const button=form.querySelector('button');
      button.disabled=true;
      message.textContent='Checking…';
      const response=await fetch('/api/request-link',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:new FormData(form).get('email'),basketSummary:selectedItems().map(item=>({productId:item.productId,quantity:item.quantity})),returnPath:'/checkout/'})});
      const payload=await response.json();
      message.textContent=payload.message||'Please check your email.';
      button.disabled=false;
    });

    submitButton.addEventListener('click',async()=>{
      submitButton.disabled=true;
      submitButton.textContent='Submitting…';
      submitMessage.textContent='Checking prices, availability and your member session…';
      let clientRequestId=sessionStorage.getItem(REQUEST_KEY);
      if(!clientRequestId){clientRequestId=requestId();sessionStorage.setItem(REQUEST_KEY,clientRequestId);}
      const response=await fetch('/api/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientRequestId,collectionPointId:selectedPointId,collectionDay:selectedCollectionDay,items:selectedItems().map(item=>({productId:item.productId,quantity:item.quantity}))})});
      const payload=await response.json();
      if(response.ok&&payload.ok){
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(REQUEST_KEY);
        basket={};
        const needsTopup=Number(payload.closingCredit)<0;
        const confirmationHeading=needsTopup?'Order reserved':'Order confirmed';
        const openingCopy=needsTopup
          ? 'We’ve reserved your produce while you top up your account.'
          : 'Your order has been placed successfully.';
        const paymentNotice=needsTopup?`<div class="checkout-payment-required"><h3>Top up before collection</h3><p>Your estimated balance is <strong>${money.format(payload.closingCredit)}</strong>.</p><p>Please ensure your account is <strong>£0.00 or above</strong> before your collection time. If payment has not been received before orders are prepared, your order will be refunded and the produce returned to available stock.</p><p>Bank transfer is recommended. An optional secure online payment link will be available in your confirmation email and membership dashboard.</p></div>`:'';
        document.querySelector('.checkout-shell').innerHTML=`<section class="checkout-card checkout-success"><h2>${confirmationHeading}</h2><p>${openingCopy}</p><p>Order: <strong>${payload.orderNumber}</strong><br>Total: <strong>${money.format(payload.total)}</strong><br>Collection: <strong>${payload.collectionPoint} · ${payload.collectionDay} ${payload.collectionDate} · ${payload.collectionTime}</strong><br>Estimated closing credit: <strong>${money.format(payload.closingCredit)}</strong></p>${paymentNotice}<a class="button" href="/dashboard/">Return to your dashboard</a></section>`;
      }else{
        submitMessage.textContent=payload.message||'The order could not be submitted.';
        submitButton.disabled=false;
        submitButton.textContent=checkoutConfirmButton;
      }
    });

    renderBasket();
    loadLiveProducts();
    verifyMember();
  
