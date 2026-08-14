const configNode=document.querySelector('#shop-config');
const {basketEmptyText='',basketNotice='',broadCategories=[],collectionPointsForMemberBar=[]}=JSON.parse(configNode?.textContent||'{}');
    const STORAGE_KEY = 'rooted-commons-basket-v1';
    localStorage.removeItem('rooted-commons-order-token-v1');
    const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
    const normalise = (value) => String(value || '').trim().toLowerCase();
    const slugify = (value) => normalise(value).replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const splitValues = (value) => String(value || '').split('|').map(item => item.trim()).filter(Boolean);

    const params = new URLSearchParams(location.search);
    const urlToken = params.get('token');
    if(urlToken)location.replace(`/api/access?token=${encodeURIComponent(urlToken)}&return=${encodeURIComponent('/orders/')}`);
    const token='';
    const dayRank={Thursday:0,Friday:1,Saturday:2,Sunday:3};
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
    const shortDate=d=>`${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]} ${ordinal(d.getDate())} ${d.toLocaleDateString('en-GB',{month:'long'})}`;
    const cycle=marketCycle();
    const rolloverNotice=document.querySelector('#market-rollover-notice');
    const showNormalRollover=()=>{if(cycle.rollover&&rolloverNotice){rolloverNotice.innerHTML=`<strong>Orders for collection this week have closed. This order is for collection from ${shortDate(cycle.marketThursday)}.</strong>`;rolloverNotice.hidden=false;}};
    if(rolloverNotice){
      fetch('/api/order-status',{cache:'no-store',headers:{accept:'application/json'}})
        .then(response=>response.ok?response.json():null)
        .then(payload=>{
          if(payload?.closed){rolloverNotice.innerHTML=`<strong>${String(payload.message||'Orders are currently closed.').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}</strong>`;rolloverNotice.hidden=false;}
          else showNormalRollover();
        })
        .catch(showNormalRollover);
    }

    let basket = {};
    try { basket = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { basket = {}; }

    const cards = [...document.querySelectorAll('[data-product-card]')];
    const categoryTabs = [...document.querySelectorAll('[data-shop-category]')];
    const panels = [...document.querySelectorAll('[data-catalogue-panel]')];
    const filterSelect = document.querySelector('#product-filter');
    const search = document.querySelector('#product-search');
    const sort = document.querySelector('#product-sort');
    const grid = document.querySelector('#shop-products .product-grid');

    const state = {
      category: broadCategories.find(category => slugify(category) === slugify(params.get('category'))) || broadCategories[0] || '',
      subcategory: 'all',
      search: '',
      sort: 'popularity'
    };
    let member = null;

    const drawer = document.querySelector('#basket-drawer');
    const backdrop = document.querySelector('#basket-backdrop');
    const floating = document.querySelector('#floating-basket');
    function openDrawer(){drawer?.classList.add('open');drawer?.setAttribute('aria-hidden','false');if(backdrop)backdrop.hidden=false;floating?.setAttribute('aria-expanded','true');document.body.classList.add('basket-open');}
    function closeDrawer(){drawer?.classList.remove('open');drawer?.setAttribute('aria-hidden','true');if(backdrop)backdrop.hidden=true;floating?.setAttribute('aria-expanded','false');document.body.classList.remove('basket-open');}
    floating?.addEventListener('click',openDrawer);
    document.querySelector('#close-basket')?.addEventListener('click',closeDrawer);
    backdrop?.addEventListener('click',closeDrawer);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDrawer();});

    const memberSummaryForm=document.querySelector('#member-summary-form');
    const memberSummaryMessage=document.querySelector('#member-summary-message');
    document.querySelector('#member-summary-change')?.addEventListener('click',()=>{memberSummaryForm.hidden=false;document.querySelector('#member-summary-change').hidden=true;});
    document.querySelector('#member-summary-cancel')?.addEventListener('click',()=>{memberSummaryForm.hidden=true;document.querySelector('#member-summary-change').hidden=false;memberSummaryMessage.textContent='';});
    memberSummaryForm?.addEventListener('submit',async event=>{
      event.preventDefault();
      const collectionPointId=Number(document.querySelector('#member-summary-select').value);
      const preferredCollectionDay=document.querySelector('#member-summary-day').value;
      memberSummaryMessage.textContent='Saving…';
      try{
        const response=await fetch('/api/member',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({collectionPointId,preferredCollectionDay})});
        const payload=await response.json();
        if(!response.ok||!payload.ok)throw new Error(payload.message||'Unable to update collection point.');
        window.RootedData?.invalidate?.('member');
        member.collectionPoint=payload.collectionPoint;
        member.preferredCollectionDay=payload.preferredCollectionDay;
        renderMemberCollection();
        memberSummaryMessage.textContent='Collection point updated.';
        setTimeout(()=>{memberSummaryForm.hidden=true;document.querySelector('#member-summary-change').hidden=false;memberSummaryMessage.textContent='';},900);
      }catch(error){memberSummaryMessage.textContent=error.message||'Unable to update collection point.';}
    });


    const pointSelectEl=document.querySelector('#member-summary-select');
    const daySelectEl=document.querySelector('#member-summary-day');
    function selectedSummaryPoint(){return collectionPointsForMemberBar.find(point=>Number(point.id)===Number(pointSelectEl?.value||member?.collectionPoint?.id||0));}
    function populateSummaryDays(selectedDay=''){
      const point=selectedSummaryPoint();
      const slots=point?.collectionSlots||[];
      if(daySelectEl){daySelectEl.innerHTML=slots.map(slot=>`<option value="${slot.day}">${slot.day} — ${slot.time}</option>`).join(''); if(slots.some(slot=>slot.day===selectedDay))daySelectEl.value=selectedDay;}
    }
    function renderMemberCollection(){
      const point=collectionPointsForMemberBar.find(item=>Number(item.id)===Number(member?.collectionPoint?.id||0));
      const preferred=member?.preferredCollectionDay||'Thursday';
      const slot=(point?.collectionSlots||[]).find(item=>item.day===preferred)||(point?.collectionSlots||[])[0];
      document.querySelector('#member-summary-point').textContent=point?`${point.name}${slot?` · ${slot.day} · ${slot.time}`:''}`:'Not selected';
      if(pointSelectEl&&point)pointSelectEl.value=String(point.id); populateSummaryDays(slot?.day||preferred);
    }
    pointSelectEl?.addEventListener('change',()=>populateSummaryDays(''));

    function categoriesFor(card){ return splitValues(card.dataset.categories); }
    function primaryCategoryFor(card){ return String(card.dataset.primaryCategory || categoriesFor(card)[0] || '').trim(); }
    function subcategoriesFor(card){ return splitValues(card.dataset.subcategories); }
    function matchesValue(values, selected){ return values.some(value => normalise(value) === normalise(selected)); }

    function relevantCards(){
      return cards.filter(card => normalise(primaryCategoryFor(card)) === normalise(state.category));
    }

    function rebuildSubcategories(){
      const relevant = relevantCards();
      const values = [...new Set(relevant.flatMap(subcategoriesFor))].sort((a,b)=>a.localeCompare(b));
      if (!values.some(value => normalise(value) === normalise(state.subcategory))) state.subcategory = 'all';
      if (filterSelect) {
        filterSelect.innerHTML = `<option value="all">All (${relevant.length})</option>` + values.map(value => `<option value="${String(value).replace(/"/g,'&quot;')}">${value} (${relevant.filter(card=>matchesValue(subcategoriesFor(card),value)).length})</option>`).join('');
        filterSelect.value = state.subcategory;
      }
    }

    function visibleCards(){
      const query = normalise(state.search);
      return cards.filter(card => {
        // A search intentionally searches the entire catalogue, irrespective of selected category.
        if (query) return normalise(card.dataset.search || card.textContent).includes(query);
        if (normalise(primaryCategoryFor(card)) !== normalise(state.category)) return false;
        if (state.subcategory !== 'all' && !matchesValue(subcategoriesFor(card), state.subcategory)) return false;
        return true;
      });
    }

    function compareCards(a,b){
      if(state.sort==='price-asc') return Number(a.dataset.price)-Number(b.dataset.price);
      if(state.sort==='price-desc') return Number(b.dataset.price)-Number(a.dataset.price);
      if(state.sort==='name') return String(a.dataset.name).localeCompare(String(b.dataset.name));
      if(state.sort==='country') return String(a.dataset.country||'').localeCompare(String(b.dataset.country||'')) || String(a.dataset.name).localeCompare(String(b.dataset.name));
      return Number(a.dataset.popularity||9999)-Number(b.dataset.popularity||9999) || String(a.dataset.name).localeCompare(String(b.dataset.name));
    }

    function renderCatalogue({ updateUrl = false, rebuildTabs = false } = {}){
      categoryTabs.forEach(tab => tab.classList.toggle('active', normalise(tab.dataset.shopCategory) === normalise(state.category)));
      panels.forEach(panel => panel.hidden = normalise(panel.dataset.cataloguePanel) !== normalise(state.category));
      if (rebuildTabs) rebuildSubcategories();
      const visible = new Set(visibleCards());
      cards.sort(compareCards).forEach(card => {
        card.hidden = !visible.has(card);
        grid?.appendChild(card);
      });
      if(updateUrl){
        const url = new URL(location.href);
        url.searchParams.set('category',slugify(state.category));
        history.pushState({category:state.category},'',url);
      }
    }

    categoryTabs.forEach(tab => tab.addEventListener('click',()=>{
      state.category = tab.dataset.shopCategory || broadCategories[0] || '';
      state.subcategory = 'all';
      state.search = '';
      if(search) search.value = '';
      renderCatalogue({updateUrl:true,rebuildTabs:true});
    }));
    filterSelect?.addEventListener('change',()=>{
      state.subcategory = filterSelect.value || 'all';
      renderCatalogue();
    });
    search?.addEventListener('input',()=>{
      state.search = search.value;
      renderCatalogue();
    });
    sort?.addEventListener('change',()=>{
      state.sort = sort.value;
      renderCatalogue();
    });
    addEventListener('popstate',()=>{
      const value = new URL(location.href).searchParams.get('category');
      state.category = broadCategories.find(category=>slugify(category)===slugify(value)) || broadCategories[0] || '';
      state.subcategory = 'all';
      state.search = '';
      if(search) search.value='';
      renderCatalogue({rebuildTabs:true});
    });

    async function loadMember(){
      const response=await (window.RootedData?.member?.() || fetch('/api/member',{cache:'no-store'}));
      if(!response.ok){if(response.status===401)window.__rootedSetAuthState?.(false);return;}
      window.__rootedSetAuthState?.(true);
      const payload=await response.json();
      member=payload.member;
      const box=document.querySelector('#member-summary');
      box.hidden=false;
      document.querySelector('#member-summary-greeting').textContent=`Hello ${member.firstName||'member'}`;
      document.querySelector('#member-summary-credit').textContent=money.format(member.credit||0);
      const pointSelect=document.querySelector('#member-summary-select');
      pointSelect.innerHTML=collectionPointsForMemberBar.map(point=>`<option value="${point.id}">${point.name}</option>`).join('');
      const currentId=Number(member.collectionPoint?.id||0);
      if(currentId) pointSelect.value=String(currentId);
      renderMemberCollection();
      renderBasket();
    }
    function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(basket));}
    function selected(){return cards.map(card=>({id:card.dataset.id,name:card.querySelector('h3')?.textContent||'',size:card.querySelector('.product-size')?.textContent?.trim()||'',price:Number(card.dataset.price||0),stock:Number(card.dataset.stock||0),quantity:Number(basket[card.dataset.id]||0)})).filter(item=>item.quantity>0);}

    function applyAvailability(card, product){
      const stock = Math.max(0, Number(product.availableStock || 0));
      const threshold = Math.max(0, Number(product.lowStockThreshold ?? 5));
      const outOfStock = product.available === false || stock < 1;
      const lowStock = !outOfStock && stock <= threshold;
      card.dataset.stock = String(stock);
      card.dataset.outOfStock = outOfStock ? 'true' : 'false';
      if (Number.isFinite(Number(product.memberPrice))) {
        card.dataset.price = String(Number(product.memberPrice));
        const priceElement = card.querySelector('.product-price');
        if (priceElement) priceElement.textContent = money.format(Number(product.memberPrice));
      }
      card.classList.toggle('product-card-out-of-stock', outOfStock);
      card.classList.toggle('product-card-low-stock', lowStock);
      const outMessage = card.querySelector('[data-stock-out]');
      const lowMessage = card.querySelector('[data-stock-low]');
      const stockCount = card.querySelector('[data-stock-count]');
      const quantityControl = card.querySelector('[data-quantity-control]');
      if (outMessage) outMessage.hidden = !outOfStock;
      if (lowMessage) lowMessage.hidden = !lowStock;
      if (stockCount) stockCount.textContent = String(stock);
      if (quantityControl) {
        quantityControl.hidden = outOfStock;
        quantityControl.querySelectorAll('button').forEach((button) => { button.disabled = outOfStock; });
      }
      const id = card.dataset.id;
      if (id && Number(basket[id] || 0) > stock) {
        if (stock > 0) basket[id] = stock;
        else delete basket[id];
      }
    }

    async function loadLiveAvailability(){
      const status = document.querySelector('#product-availability-status');
      const productShell = document.querySelector('#shop-products');
      try {
        const response = await (window.RootedData?.products?.() || fetch('/api/products', { headers: { accept: 'application/json' } }));
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.message || 'Availability request failed.');
        const byId = new Map((payload.products || []).map(product => [String(product.id), product]));
        cards.forEach(card => {
          const product = byId.get(String(card.dataset.id));
          if (product) applyAvailability(card, product);
          else applyAvailability(card, { available: false, availableStock: 0, lowStockThreshold: 5 });
        });
        save();
        renderBasket();
        if (status) status.textContent = 'Availability updated.';
      } catch (error) {
        cards.forEach(card => applyAvailability(card, { available: false, availableStock: 0, lowStockThreshold: 5 }));
        save();
        renderBasket();
        if (status) status.textContent = 'Current availability could not be loaded. Products are temporarily unavailable.';
        console.error(error);
      } finally {
        productShell?.setAttribute('aria-busy', 'false');
      }
    }
    function renderBasket(){
      const items=selected();
      const trashIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/></svg>';
      const lineHtml=(item)=>`<div class="basket-line"><div class="basket-line-copy"><strong>${item.name}${item.size?` · ${item.size}`:''}</strong><span>${money.format(item.price)} each</span></div><div class="basket-line-actions"><span class="basket-quantity-stepper"><button type="button" data-basket-action="decrease" data-product-id="${item.id}" aria-label="Decrease ${item.name}">−</button><span>${item.quantity}</span><button type="button" data-basket-action="increase" data-product-id="${item.id}" aria-label="Increase ${item.name}">+</button></span><button type="button" class="basket-remove" data-basket-action="remove" data-product-id="${item.id}" aria-label="Remove ${item.name} from basket">${trashIcon}</button></div><strong class="basket-line-total">${money.format(item.price*item.quantity)}</strong></div>`;
      document.querySelectorAll('[data-basket-lines]').forEach(element=>{element.innerHTML=items.length?items.map(lineHtml).join(''):`<p>${basketEmptyText}</p>`;});
      const total=items.reduce((sum,item)=>sum+item.price*item.quantity,0);
      document.querySelectorAll('[data-basket-total]').forEach(element=>element.textContent=money.format(total));
      document.querySelectorAll('[data-basket-count]').forEach(element=>element.textContent=String(items.reduce((sum,item)=>sum+item.quantity,0)));
      const creditText=member?`Estimated balance after this basket: ${money.format((member.credit||0)-total)}. Final figures are confirmed on submission.`:basketNotice;
      document.querySelectorAll('[data-credit-line]').forEach(element=>element.textContent=creditText);
      cards.forEach(card=>{const output=card.querySelector('[data-quantity]');if(output)output.textContent=String(basket[card.dataset.id]||0);});
    }

    document.addEventListener('click',event=>{
      const basketButton=event.target.closest('[data-basket-action]');
      if(basketButton){
        const id=basketButton.dataset.productId;
        const action=basketButton.dataset.basketAction;
        if(action==='increase'){const card=cards.find(item=>item.dataset.id===id);basket[id]=Math.min(Number(card?.dataset.stock||0),Number(basket[id]||0)+1);}
        if(action==='decrease')basket[id]=Math.max(0,Number(basket[id]||0)-1);
        if(action==='remove'||!basket[id])delete basket[id];
        save();renderBasket();return;
      }
      const quantityButton=event.target.closest('[data-quantity-change]');
      if(quantityButton){
        const card=quantityButton.closest('[data-product-card]');
        if(!card)return;
        const id=card.dataset.id;
        const stock=Math.max(0,Number(card.dataset.stock||0));
        if(card.dataset.outOfStock==='true')return;
        basket[id]=Math.min(stock,Math.max(0,Number(basket[id]||0)+Number(quantityButton.dataset.quantityChange)));
        if(!basket[id])delete basket[id];
        save();renderBasket();
        if(Number(quantityButton.dataset.quantityChange)>0){floating?.classList.remove('basket-bump');void floating?.offsetWidth;floating?.classList.add('basket-bump');}
      }
    });
    document.querySelectorAll('[data-checkout-link]').forEach(link=>link.addEventListener('click',event=>{if(!selected().length){event.preventDefault();alert('Add at least one item before checkout.');}}));

    state.sort = sort?.value || 'popularity';
    rebuildSubcategories();
    renderCatalogue();
    renderBasket();
    loadLiveAvailability();
    loadMember();
  
