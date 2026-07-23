const DEFAULT_API = 'https://api.baserow.io';

export function envConfig(env) {
  return {
    api: env.BASEROW_API_URL || DEFAULT_API,
    token: env.BASEROW_RUNTIME_TOKEN,
    members: env.BASEROW_MEMBERS_TABLE_ID,
    products: env.BASEROW_PRODUCTS_TABLE_ID,
    collectionPoints: env.BASEROW_COLLECTION_POINTS_TABLE_ID,
    orders: env.BASEROW_WEB_ORDERS_TABLE_ID,
    stock: env.BASEROW_STOCK_MOVEMENT_TABLE_ID,
    transactions: env.BASEROW_ACCOUNT_TRANSACTIONS_TABLE_ID,
    enableLedgers: String(env.ENABLE_LEDGER_WRITES || '').toLowerCase() === 'true'
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
export function number(value, fallback = 0) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g,'')); return Number.isFinite(n) ? n : fallback; }
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
export async function updateRow(cfg, tableId, rowId, fields) {
  return apiRequest(cfg, `/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`, {method:'PATCH', body:JSON.stringify(fields)});
}

export function tokenValid(member, token) {
  if (!token || String(member['Order token'] || '') !== String(token)) return false;
  if (!truthy(member.Active, false)) return false;
  const expiry = member['Order token expiry'];
  return !expiry || new Date(expiry).getTime() > Date.now();
}

export function publicCollectionPoint(point) {
  if (!point) return null;
  return {
    id: Number(point.id),
    name: unwrap(point.Name),
    address: unwrap(point.Address),
    description: unwrap(point.Description),
    image: fileUrl(point.Image),
    link: unwrap(point.Link || point.Website || point.URL),
    collectionTime: unwrap(point['Collection time'] || point['Collection slot'] || point['Collection day/time']),
    ordersClose: unwrap(point['Orders close'] || point['Order deadline']),
    availableCategories: linkedValues(point['Available to collect here'])
  };
}

export function publicMember(member, { collectionPoint = null, lastOrder = null, account = null } = {}) {
  const memberSince = member['Member since'] || member['Joined date'] || member['Join date'] || '';
  const founderBadge = unwrap(member['Founder badge'] || member['Founder level'] || member['Membership badge']);
  const sinceTime = memberSince ? new Date(memberSince).getTime() : NaN;
  const membershipWeeks = Number.isFinite(sinceTime) ? Math.max(0, Math.floor((Date.now() - sinceTime) / 604800000)) : null;
  return {
    id: Number(member.id),
    firstName: unwrap(member['First name']),
    credit: number(member['Current credit']),
    weeklyCommitment: number(member['Weekly commitment']),
    collectionPoint: collectionPoint || {
      id: linkedIds(member['Collection point'])[0] || null,
      name: linkedValues(member['Collection point'])[0] || ''
    },
    founderBadge,
    memberSince: memberSince || '',
    membershipWeeks,
    account: account || { payments: [], averageWeeklySpend: 0, totalOrderSpend: 0 },
    lastOrder: lastOrder ? {
      orderNumber: unwrap(lastOrder['Order number']),
      submittedAt: lastOrder['Submitted at'] || '',
      total: number(lastOrder['Order total']),
      status: unwrap(lastOrder.Status)
    } : null
  };
}

export function orderWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}
