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

async function request(cfg, path, options = {}) {
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
    const payload=await request(cfg, `/api/database/rows/table/${tableId}/?user_field_names=true&size=200&page=${page}`);
    rows.push(...(payload.results || []));
    if (!payload.next) return rows;
    page += 1;
  }
}
export async function createRow(cfg, tableId, fields) {
  return request(cfg, `/api/database/rows/table/${tableId}/?user_field_names=true`, {method:'POST', body:JSON.stringify(fields)});
}
export async function updateRow(cfg, tableId, rowId, fields) {
  return request(cfg, `/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`, {method:'PATCH', body:JSON.stringify(fields)});
}

export function tokenValid(member, token) {
  if (!token || String(member['Order token'] || '') !== String(token)) return false;
  if (!truthy(member.Active, false)) return false;
  const expiry = member['Order token expiry'];
  return !expiry || new Date(expiry).getTime() > Date.now();
}
export function publicMember(member) {
  return {
    firstName: unwrap(member['First name']),
    credit: number(member['Current credit']),
    weeklyCommitment: number(member['Weekly commitment']),
    collectionPoint: linkedValues(member['Collection point'])[0] || '',
    collectionPointIds: linkedIds(member['Collection point'])
  };
}
export function orderWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate()+4-day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week = Math.ceil((((d-yearStart)/86400000)+1)/7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}
