const money = new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP' });
const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const safeHref = (value='') => /^(?:\/|#|https?:\/\/|mailto:|tel:)/i.test(String(value).trim()) ? String(value).trim() : '#';
const richText = (value='') => {
  const source = String(value || '').replace(/\r\n?/g,'\n').trim();
  if (!source) return '';
  const inline = (line) => escapeHtml(line)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_,label,href) => `<a href="${escapeHtml(safeHref(href))}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g,'$1<em>$2</em>');
  return source.split(/\n\s*\n+/).map((block) => {
    const lines = block.split('\n').filter((line) => line.trim());
    const isList = lines.length && lines.every((line) => /^\s*(?:[-*•])\s+/.test(line));
    if (isList) return `<ul>${lines.map((line) => `<li>${inline(line.replace(/^\s*(?:[-*•])\s+/,''))}</li>`).join('')}</ul>`;
    return `<p>${block.split('\n').map(inline).join('<br>')}</p>`;
  }).join('');
};
const escapeRegExp = (value='') => String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const highlightAllergens = (ingredients='', allergens='') => {
  let html = escapeHtml(ingredients);
  String(allergens || '').split(/[,;|]/).map((value) => value.trim()).filter(Boolean).sort((a,b)=>b.length-a.length).forEach((allergen) => {
    html = html.replace(new RegExp(`(${escapeRegExp(escapeHtml(allergen))})`,'gi'),'<strong>$1</strong>');
  });
  return html;
};

const productMap = new Map();
document.querySelectorAll('[data-product-grid-data]').forEach((node) => {
  try {
    const payload = JSON.parse(node.textContent || '{}');
    for (const product of payload.products || []) productMap.set(String(product.id), { ...product, priceHelp: payload.priceHelp || {} });
  } catch (error) {
    console.warn('Unable to read product interaction data', error);
  }
});

let detailDialog;
let detailContent;
function ensureDetailDialog(){
  if (detailDialog) return detailDialog;
  detailDialog=document.createElement('dialog');
  detailDialog.className='product-detail-dialog';
  detailDialog.innerHTML='<button class="product-detail-close" type="button" aria-label="Close product information">×</button><div data-product-detail-content></div>';
  document.body.appendChild(detailDialog);
  detailContent=detailDialog.querySelector('[data-product-detail-content]');
  detailDialog.querySelector('.product-detail-close')?.addEventListener('click',()=>detailDialog.close());
  detailDialog.addEventListener('click',(event)=>{if(event.target===detailDialog)detailDialog.close();});
  return detailDialog;
}
function productDetailHtml(product){
  const sections=[];
  if(product.ingredients) sections.push(`<section><h3>Ingredients</h3><p class="rich-body">${highlightAllergens(product.ingredients, product.allergens)}</p></section>`);
  if(product.mayContain) sections.push(`<section><h3>May contain</h3><div class="rich-body">${richText(product.mayContain)}</div></section>`);
  if(product.storage) sections.push(`<section><h3>How to store / once opened</h3><div class="rich-body">${richText(product.storage)}</div></section>`);
  if(product.fboImporter) sections.push(`<section><h3>FBO / importer</h3><div class="rich-body">${richText(product.fboImporter)}</div></section>`);
  const originRows=[
    product.origin ? `<p class="product-detail-origin"><strong>Origin</strong><span>${escapeHtml(product.origin)}</span></p>` : '',
    product.secondaryOrigin ? `<p class="product-detail-origin"><strong>Secondary origin</strong><span>${escapeHtml(product.secondaryOrigin)}</span></p>` : ''
  ].join('');
  const nutrition=(product.nutritionRows||[]).length ? `<aside class="nutrition-section product-detail-nutrition"><h3>Nutrition</h3><table class="nutrition-table"><thead><tr><th scope="col">Typical values</th><th scope="col">${escapeHtml(product.nutritionBasis||'Per 100 g')}</th></tr></thead><tbody>${product.nutritionRows.map(([label,value])=>`<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody></table></aside>` : '';
  return `<div class="product-detail-layout product-detail-information-layout"><div class="product-detail-copy"><h2>${escapeHtml(product.name)}${product.size?` – ${escapeHtml(product.size)}`:''}</h2>${product.image?`<figure class="product-detail-image"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}"></figure>`:''}${originRows}${(product.expandedDescription||product.description)?`<div class="product-detail-overview rich-body">${richText(product.expandedDescription||product.description)}</div>`:''}${sections.join('')}<p class="product-detail-note">Product information can change. Always check the pack before use, particularly for allergens.</p></div>${nutrition}</div>`;
}
function openProductDetail(product){
  const dialog=ensureDetailDialog();
  if(!detailContent)return;
  detailContent.innerHTML=productDetailHtml(product);
  dialog.showModal();
}

let priceDialog;
let priceContent;
let activePriceToggle=null;
function ensurePriceDialog(){
  if(priceDialog)return priceDialog;
  priceDialog=document.createElement('dialog');
  priceDialog.className='price-breakdown-dialog';
  priceDialog.setAttribute('aria-label','Price breakdown');
  priceDialog.innerHTML='<div data-price-breakdown-content></div>';
  priceContent=priceDialog.querySelector('[data-price-breakdown-content]');
  priceDialog.addEventListener('close',()=>{
    activePriceToggle?.setAttribute('aria-expanded','false');
    activePriceToggle=null;
  });
  priceDialog.addEventListener('click',(event)=>{
    const rect=priceDialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)priceDialog.close();
  });
  document.body.appendChild(priceDialog);
  return priceDialog;
}
function explanationHtml(kind, text, linkHtml=''){
  return `<div class="price-breakdown-explanation" data-price-help="${kind}" hidden><p>${escapeHtml(text)}</p>${linkHtml}</div>`;
}
function priceRow({kind,label,value,explanation,linkHtml='',total=false,partnerId=0}){
  return `<div class="price-breakdown-item${total?' price-breakdown-total':''}"><div class="price-breakdown-summary"><button class="price-breakdown-label" type="button" data-price-help-toggle="${kind}" aria-expanded="false"${partnerId?` data-partner-id="${Number(partnerId)}"`:''}>${total?`<strong>${escapeHtml(label)}</strong>`:`<span>${escapeHtml(label)}</span>`}<span class="price-info-icon" aria-hidden="true">ⓘ</span></button><strong class="price-breakdown-value">${money.format(Math.abs(Number(value||0)))}</strong></div>${explanationHtml(kind,explanation,linkHtml)}</div>`;
}
function priceBreakdownHtml(product){
  const help=product.priceHelp||{};
  const partnerLabel=help.partnerLinkLabel || `Learn more about ${product.sourceValueRecipientName} →`;
  const sourceLink=product.sourceValueRecipientId?`<a href="/our-network/?partner=${encodeURIComponent(String(product.sourceValueRecipientId))}" target="_blank" rel="noopener noreferrer">${escapeHtml(partnerLabel)}</a>`:'';
  const rows=[priceRow({kind:'source',label:product.sourceValueRecipientName,value:product.sourceValue,explanation:help.source||'',linkHtml:sourceLink,partnerId:product.sourceValueRecipientId})];
  if(Math.abs(Number(product.commonsBalance||0))>=0.005){
    const positive=Number(product.commonsBalance)>0;
    const commonsLink=help.commonsLinkUrl?`<a href="${escapeHtml(safeHref(help.commonsLinkUrl))}" target="_blank" rel="noopener noreferrer">${escapeHtml(help.commonsLinkLabel||'Learn more in FAQs →')}</a>`:'';
    rows.push(priceRow({kind:'commons',label:positive?'Commons contribution':'Commons subsidy',value:product.commonsBalance,explanation:positive?(help.contribution||''):(help.subsidy||''),linkHtml:commonsLink}));
  }
  rows.push(priceRow({kind:'member',label:'Member price',value:product.priceNumber,explanation:help.member||'',total:true}));
  return `<h3 class="price-breakdown-product-name">${escapeHtml(product.name)}</h3><h4>Where your money goes</h4><div class="price-breakdown-list">${rows.join('')}</div>`;
}
async function hydratePartnerHelp(button,panel){
  if(!button||!panel||button.dataset.partnerLoaded==='true')return;
  const partnerId=Number(button.dataset.partnerId||0);
  if(!partnerId)return;
  button.dataset.partnerLoaded='true';
  try{
    const response=await (window.RootedData?.partnerHelp?.(partnerId)||fetch(`/api/partner-help?id=${encodeURIComponent(String(partnerId))}`,{headers:{accept:'application/json'}}));
    if(!response.ok)return;
    const payload=await response.json();
    if(payload?.partner?.priceExplanation){
      const paragraph=panel.querySelector('p');
      if(paragraph)paragraph.textContent=payload.partner.priceExplanation;
    }
  }catch(error){
    button.dataset.partnerLoaded='false';
    console.warn('Unable to load partner price explanation',error);
  }
}
function openPriceBreakdown(product,toggle){
  const dialog=ensurePriceDialog();
  if(!priceContent)return;
  priceContent.innerHTML=priceBreakdownHtml(product);
  activePriceToggle?.setAttribute('aria-expanded','false');
  activePriceToggle=toggle;
  toggle?.setAttribute('aria-expanded','true');
  dialog.showModal();
}

document.addEventListener('click',(event)=>{
  const productOpener=event.target.closest('[data-open-product]');
  if(productOpener){
    const id=productOpener.closest('[data-product-card]')?.dataset.id;
    const product=productMap.get(String(id||''));
    if(product?.hasDetails){event.preventDefault();openProductDetail(product);}return;
  }
  const priceToggle=event.target.closest('[data-price-breakdown-toggle]');
  if(priceToggle){
    const id=priceToggle.closest('[data-product-card]')?.dataset.id;
    const product=productMap.get(String(id||''));
    if(product?.hasPriceBreakdown){event.preventDefault();openPriceBreakdown(product,priceToggle);}return;
  }
  const helpToggle=event.target.closest('.price-breakdown-dialog [data-price-help-toggle]');
  if(helpToggle){
    event.preventDefault();
    const panel=priceContent?.querySelector(`[data-price-help="${helpToggle.dataset.priceHelpToggle}"]`);
    if(!panel)return;
    const open=panel.hidden;
    panel.hidden=!open;
    helpToggle.setAttribute('aria-expanded',open?'true':'false');
    if(open&&helpToggle.dataset.priceHelpToggle==='source')hydratePartnerHelp(helpToggle,panel);
  }
});
