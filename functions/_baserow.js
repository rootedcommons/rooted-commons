const DEFAULT_API = 'https://api.baserow.io';

export function envConfig(env) {
  return {
    api: env.BASEROW_API_URL || DEFAULT_API,
    token: env.BASEROW_RUNTIME_TOKEN,
    members: env.BASEROW_MEMBERS_TABLE_ID,
    products: env.BASEROW_PRODUCTS_TABLE_ID,
    collectionPoints: env.BASEROW_COLLECTION_POINTS_TABLE_ID,
    orders: env.BASEROW_WEB_ORDERS_TABLE_ID,
    transactions: env.BASEROW_ACCOUNT_TRANSACTIONS_TABLE_ID,
    xeroSyncState: env.BASEROW_XERO_SYNC_STATE_TABLE_ID
  };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

export function normaliseEmail(value = '') { return String(value).trim().toLowerCase(); }
export function unwrap(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(v => unwrap(v?.value ?? v?.name ?? v)).filter(Boolean).join(', ');
  if (typeof value === 'object') return unwrap(value.value ?? value.name ?? value.text);
  return '';
}
export function linkedIds(value) { return Array.isArray(value) ? value.map(v => Number(v?.id ?? v)).filter(Number.isFinite) : []; }
export function linkedValues(value) { return Array.isArray(value) ? value.map(v => unwrap(v?.value ?? v?.name ?? v)).filter(Boolean) : unwrap(value).split(',').map(v=>v.trim()).filter(Boolean); }
export function number(value, fallback = 0) { const n = Number(unwrap(value).replace(/[^0-9.-]/g,'')); return Number.isFinite(n) ? n : fallback; }
export function truthy(value, fallback=true) { if (value == null || value === '') return fallback; if (typeof value === 'boolean') return value; return !['false','0','no','off'].includes(String(value).toLowerCase()); }
export function fileUrl(value) {
  if (Array.isArray(value) && value.length) return value[0]?.url || value[0]?.thumbnails?.large?.url || value[0]?.thumbnails?.card_cover?.url || '';
  return '';
}

async function apiRequest(cfg, path, options = {}) {
  if (!cfg.token) throw new Error('BASEROW_RUNTIME_TOKEN is missing');
  const response = await fetch(`${cfg.api}${path}`, {
    ...options,
    headers: { Authorization: `Token ${cfg.token}`, 'content-type':'application/json', ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`Baserow ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

export async function listRows(cfg, tableId) {
  if (!tableId) throw new Error('A required Baserow table ID is missing');
  const rows=[]; let page=1;
  while (true) {
    const payload=await apiRequest(cfg, `/api/database/rows/table/${tableId}/?user_field_names=true&size=200&page=${page}`);
    rows.push(...(payload.results || []));
    if (!payload.next) return rows;
    page += 1;
  }
}
export async function createRow(cfg, tableId, fields) {
  return apiRequest(cfg, `/api/database/rows/table/${tableId}/?user_field_names=true`, {method:'POST', body:JSON.stringify(fields)});
}
export async function deleteRow(cfg, tableId, rowId) {
  return apiRequest(cfg, `/api/database/rows/table/${tableId}/${rowId}/`, {method:'DELETE'});
}

export async function updateRow(cfg, tableId, rowId, fields) {
  return apiRequest(cfg, `/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`, {method:'PATCH', body:JSON.stringify(fields)});
}

export function tokenValid(member, token) {
  if (!token || String(member['Order token'] || '') !== String(token)) return false;
  if (!truthy(member.Active, false)) return false;
  const expiry = member['Order token expiry'];
  return !expiry || new Date(expiry).getTime() > Date.now();
}


function cleanCollectionTime(value = '') {
  const raw = String(value || '')
    .trim()
    .replace(/^(?:thursday|friday|saturday|sunday)\s*[-–—·:]?\s*/i, '')
    .replace(/[–—]/g, '-');
  const range = raw.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i);
  if (!range) return raw.replace(/(\d{1,2}):(\d{2})/g, '$1.$2');
  let [, h1, m1 = '00', ap1 = '', h2, m2 = '00', ap2 = ''] = range;
  ap1 = ap1.toLowerCase(); ap2 = ap2.toLowerCase();
  if (!ap1 && ap2) ap1 = ap2;
  const to24 = (hour, suffix) => {
    let h = Number(hour);
    if (suffix === 'pm' && h < 12) h += 12;
    if (suffix === 'am' && h === 12) h = 0;
    return h;
  };
  return `${to24(h1, ap1)}.${m1}-${to24(h2, ap2)}.${m2}`;
}

export function publicCollectionPoint(point) {
  if (!point) return null;
  const thursdayTime = cleanCollectionTime(unwrap(point['Thursday collection time'] || point['Collection time'] || point['Collection slot'] || point['Collection day/time']));
  const collectionSlots = [
    { day:'Thursday', time:thursdayTime },
    { day:'Friday', time:cleanCollectionTime(unwrap(point['Friday collection time'])) },
    { day:'Saturday', time:cleanCollectionTime(unwrap(point['Saturday collection time'])) },
    { day:'Sunday', time:cleanCollectionTime(unwrap(point['Sunday collection time'])) }
  ].filter(slot => slot.time);
  return {
    id: Number(point.id),
    name: unwrap(point.Name),
    address: unwrap(point.Address),
    description: unwrap(point.Description),
    image: fileUrl(point.Image),
    link: unwrap(point.Link || point.Website || point.URL),
    collectionTime: thursdayTime,
    collectionSlots,
    ordersClose: 'Wednesday 18.00',
    availableCategories: linkedValues(point['Available to collect here'])
  };
}

export function publicMember(member, { collectionPoint = null, lastOrder = null, currentOrder = null, account = null } = {}) {
  const memberSince = member['Member since'] || member['Joined date'] || member['Join date'] || '';
  const memberId = Number(member.id);
  const founderBadge = unwrap(member['Founder badge'] || member['Founder level'] || member['Membership badge']);
  const sinceTime = memberSince ? new Date(memberSince).getTime() : NaN;
  const membershipWeeks = Number.isFinite(sinceTime) ? Math.max(0, Math.floor((Date.now() - sinceTime) / 604800000)) : null;
  const orderSummary = row => row ? {
    id: Number(row.id),
    orderNumber: unwrap(row['Order number']),
    submittedAt: row['Submitted at'] || '',
    total: number(row['Order total']),
    status: unwrap(row.Status),
    orderWeek: unwrap(row['Order week'])
  } : null;
  return {
    id: memberId,
    firstName: unwrap(member['First name']),
    credit: number(member['Current credit']),
    weeklyCommitment: number(member['Weekly commitment']),
    monthlyEquivalent: number(member['Monthly equivalent']),
    contributionFrequency: unwrap(member['Contribution frequency']) || 'Weekly',
    paymentReference: unwrap(member['Member number']) || `RC-${member.id}`,
    preferredCollectionDay: unwrap(member['Preferred collection day']) || 'Thursday',
    molliePaymentUrl: unwrap(member['Mollie payment URL'] || member['Online payment URL']),
    collectionPoint: collectionPoint || {
      id: linkedIds(member['Collection point'])[0] || null,
      name: linkedValues(member['Collection point'])[0] || ''
    },
    founderBadge,
    memberSince: memberSince || '',
    membershipWeeks,
    volunteerDays: number(member['Volunteer days']),
    workshopsAttended: number(member['Workshops attended']),
    eventsAttended: number(member['Events attended']),
    account: account || { payments: [], averageWeeklySpend: 0, totalOrderSpend: 0, totalPaymentsReceived: 0 },
    lastOrder: orderSummary(lastOrder),
    currentOrder: orderSummary(currentOrder)
  };
}

export function orderWeek(date = new Date()) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(`${date}T12:00:00Z`);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

export function ukMarketCycle(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone:'Europe/London', year:'numeric', month:'2-digit', day:'2-digit', weekday:'short', hour:'2-digit', minute:'2-digit', hourCycle:'h23'
  }).formatToParts(now).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const weekdayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  const weekday=weekdayMap[parts.weekday];
  const hour=Number(parts.hour);
  const minute=Number(parts.minute);
  let daysToThursday=(4-weekday+7)%7;
  if(weekday===4) daysToThursday=7;
  if(weekday===3 && (hour>18 || (hour===18 && minute>=0))) daysToThursday+=7;
  const base=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),12));
  base.setUTCDate(base.getUTCDate()+daysToThursday);
  const marketThursday=base.toISOString().slice(0,10);
  const rollover=(weekday===3 && (hour>18 || (hour===18 && minute>=0))) || weekday===4 || weekday===5 || weekday===6 || weekday===0;
  return { marketThursday, rollover, orderWeek:orderWeek(marketThursday) };
}
