import { envConfig, fileUrl, json, linkedIds, linkedValues, listRows, number, truthy, unwrap } from '../_baserow.js';

const norm = (value, fallback='') => (unwrap(value) || fallback).trim().toLowerCase().replace(/\s+/g,'-').replace('centre','center');

function publicSettings(row = {}) {
  const nav=[];
  for(let i=1;i<=5;i++){
    const label=unwrap(row[`Navigation label ${i}`]);
    const url=unwrap(row[`Navigation URL ${i}`]);
    if(label && url) nav.push({order:i,label,url});
  }
  return {
    siteTitle: unwrap(row['Site title']),
    tagline: unwrap(row.Tagline),
    headerText: unwrap(row['Header text']),
    footerText: unwrap(row['Footer text']),
    contactEmail: unwrap(row['Contact email']),
    headerLogo: fileUrl(row['Header logo']),
    footerLogo: fileUrl(row['Footer logo']),
    eyebrowIcon: fileUrl(row['Eyebrow icon']),
    headerButtonText: unwrap(row['Header button text'] || row['Header Button Text'] || row['Join button text']),
    headerButtonUrl: unwrap(row['Header Button URL'] || row['Header button URL'] || row['Join button URL']),
    backgroundColour: unwrap(row['Background colour']),
    surfaceColour: unwrap(row['Surface colour']),
    primaryColour: unwrap(row['Primary colour']),
    highlightColour: unwrap(row['Highlight colour']),
    borderColour: unwrap(row['Border colour']),
    accentColour: unwrap(row['Accent colour']),
    headerLogoSize: norm(row['Header logo size'],'medium'),
    footerLogoSize: norm(row['Footer logo size'],'medium'),
    headerHeight: norm(row['Header height'],'medium'),
    footerHeight: norm(row['Footer height'],'medium'),
    navigationTextSize: norm(row['Navigation text size'],'medium'),
    buttonTextSize: norm(row['Button text size'],'medium'),
    navigationLinks: nav
  };
}

function publicPage(row) {
  return {
    id:Number(row.id), slug:unwrap(row.Slug), title:unwrap(row.Title), intro:unwrap(row.Intro), subtitle:unwrap(row.Subtitle),
    buttonText:unwrap(row['Button text']), buttonUrl:unwrap(row['Button URL']), heroImage:fileUrl(row['Hero image']),
    visible:truthy(row.Visible,true), seoTitle:unwrap(row['SEO title']), seoDescription:unwrap(row['SEO description']),
    heroLayout:norm(row['Hero layout'],'text-only'), titleSize:norm(row['Title size'],'large'), subtitleSize:norm(row['Subtitle size'],'medium'),
    introSize:norm(row['Intro size'],'medium'), heroImageShape:norm(row['Hero image shape'],'landscape'),
    heroImageFit:['show-whole-image','contain'].includes(norm(row['Hero image fit'],'fill-frame'))?'contain':'cover',
    heroImageAlignment:norm(row['Hero image alignment'],'center'), heroAlignment:norm(row['Hero alignment'],'left'),
    heroPadding:norm(row['Hero padding'],'normal'), heroWidth:norm(row['Hero width'],'standard'), heroGap:norm(row['Hero gap'],'normal'),
    heroButtonSize:norm(row['Hero button size'],'medium')
  };
}

function publicSection(row) {
  return {
    id:Number(row.id), key:unwrap(row.Key), page:linkedValues(row.Page)[0] || unwrap(row.Page), visible:truthy(row.Visible,true),
    order:number(row.Order,0), type:norm(row['Section type'],'text'), body:unwrap(row.Body), heading:unwrap(row.Heading), eyebrow:unwrap(row.Eyebrow),
    subheading:unwrap(row.Subheading), eyebrowIcon:fileUrl(row['Eyebrow icon']), icon:fileUrl(row.Icon), image:fileUrl(row.Image), image2:fileUrl(row['Image 2']), image3:fileUrl(row['Image 3']),
    imageAlt:unwrap(row['Image alt text']), image2Alt:unwrap(row['Image 2 alt text']), image3Alt:unwrap(row['Image 3 alt text']),
    watermarkImage:fileUrl(row['Watermark image']), watermarkOpacity:Math.min(100,Math.max(0,number(row['Watermark opacity'],8))),
    buttonText:unwrap(row['Button text']), buttonUrl:unwrap(row['Button URL']), buttonVisible:truthy(row['Button visible'],Boolean(unwrap(row['Button text']))),
    headingSize:norm(row['Heading size'],'large'), subheadingSize:norm(row['Subheading size'],'medium'), bodySize:norm(row['Body size'],'medium'),
    alignment:norm(row.Alignment,'left'), backgroundStyle:norm(row['Background style'],'default'), columns:Math.min(4,Math.max(1,number(row.Columns,3))),
    imageSize:norm(row['Image size'],'medium'), imageFit:norm(row['Image fit'],'cover'), buttonSize:norm(row['Button size'],'medium'),
    spaceAbove:norm(row['Space above'],'medium'), spaceBelow:norm(row['Space below'],'medium'), imagePosition:norm(row['Image position'],'right'),
    metricIds:linkedIds(row.Metrics), metricNames:linkedValues(row.Metrics), productIds:linkedIds(row.Products), productNames:linkedValues(row.Products),
    groupKey:unwrap(row['Group key']), groupHeading:unwrap(row['Group heading']), imageCaption:unwrap(row['Image caption']),
    countdownDate:unwrap(row['Countdown date']), preCountdownLabel:unwrap(row['Pre-countdown label']), preCountdownText:unwrap(row['Pre-countdown text']),
    postCountdownText:unwrap(row['Post-countdown text'])
  };
}

function publicInterface(rows=[]) {
  const out={};
  for(const row of rows){ const key=unwrap(row.Key); if(key) out[key]=unwrap(row.Content); }
  return out;
}

function cleanCollectionTime(value='') {
  const raw=String(value||'').trim().replace(/^(?:thursday|friday|saturday|sunday)\s*[-–—·:]?\s*/i,'').replace(/[–—]/g,'-');
  const range=raw.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i);
  if(!range)return raw.replace(/(\d{1,2}):(\d{2})/g,'$1.$2');
  let [,h1,m1='00',ap1='',h2,m2='00',ap2='']=range; ap1=ap1.toLowerCase();ap2=ap2.toLowerCase();if(!ap1&&ap2)ap1=ap2;
  const to24=(h,s)=>{let n=Number(h);if(s==='pm'&&n<12)n+=12;if(s==='am'&&n===12)n=0;return n;};
  return `${to24(h1,ap1)}.${m1}-${to24(h2,ap2)}.${m2}`;
}
function publicCollectionPoint(row){
  const th=cleanCollectionTime(unwrap(row['Thursday collection time']||row['Collection time']||row['Collection slot']||row['Collection day/time']));
  return {id:Number(row.id),name:unwrap(row.Name),address:unwrap(row.Address),description:unwrap(row.Description),image:fileUrl(row.Image),link:unwrap(row.Link||row.Website||row.URL),
    latitude:number(row.Latitude,NaN),longitude:number(row.Longitude,NaN),active:truthy(row.Active,true),collectionSlots:[
      {day:'Thursday',time:th},{day:'Friday',time:cleanCollectionTime(unwrap(row['Friday collection time']))},{day:'Saturday',time:cleanCollectionTime(unwrap(row['Saturday collection time']))},{day:'Sunday',time:cleanCollectionTime(unwrap(row['Sunday collection time']))}
    ].filter(x=>x.time),availableCategories:linkedValues(row['Available to collect here'])};
}

async function safeTable(cfg, tableId, label){
  if(!tableId) return {ok:false,label,rows:[],error:'not-configured'};
  try { return {ok:true,label,rows:await listRows(cfg,tableId)}; }
  catch(error){ console.error(`Public content: ${label} failed`,error); return {ok:false,label,rows:[],error:'unavailable'}; }
}

export async function onRequestGet({env}){
  const cfg=envConfig(env);
  const [settingsResult,pagesResult,sectionsResult,interfaceResult,collectionsResult]=await Promise.all([
    safeTable(cfg,cfg.settings,'settings'), safeTable(cfg,cfg.pages,'pages'), safeTable(cfg,cfg.sections,'sections'),
    safeTable(cfg,cfg.interfaceContent,'interfaceContent'), safeTable(cfg,cfg.collectionPoints,'collectionPoints')
  ]);
  const settingsRow=(settingsResult.rows||[]).find(r=>unwrap(r['Site title'])||fileUrl(r['Header logo'])) || settingsResult.rows?.[0] || {};
  const payload={
    ok:[settingsResult,pagesResult,sectionsResult,interfaceResult,collectionsResult].some(r=>r.ok),
    settings:settingsResult.ok?publicSettings(settingsRow):null,
    pages:pagesResult.ok?pagesResult.rows.filter(r=>truthy(r.Visible,true)&&unwrap(r.Slug)).map(publicPage):null,
    sections:sectionsResult.ok?sectionsResult.rows.filter(r=>unwrap(r.Key)).map(publicSection):null,
    interfaceContent:interfaceResult.ok?publicInterface(interfaceResult.rows):null,
    collectionPoints:collectionsResult.ok?collectionsResult.rows.filter(r=>truthy(r.Active,true)&&unwrap(r.Name)).map(publicCollectionPoint):null,
    errors:[settingsResult,pagesResult,sectionsResult,interfaceResult,collectionsResult].filter(r=>!r.ok).map(r=>r.label)
  };
  return json(payload,payload.ok?200:503);
}
