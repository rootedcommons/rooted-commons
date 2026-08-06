import { envConfig, listRows, updateRow } from '../../_baserow.js';

const AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
const TOKEN_URL = 'https://identity.xero.com/connect/token';
const CONNECTIONS_URL = 'https://api.xero.com/connections';
const DEFAULT_SCOPES = 'openid profile email offline_access accounting.banktransactions.read accounting.contacts.read';
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function requireEnv(env, name) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

function base64Url(bytes) {
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return base64Url(new Uint8Array(signature));
}

export function redirectUri(request, env) {
  if (env.XERO_REDIRECT_URI) return String(env.XERO_REDIRECT_URI).trim();
  const url = new URL(request.url);
  return `${url.origin}/api/xero/callback`;
}

export async function createState(env) {
  const secret = requireEnv(env, 'XERO_STATE_SECRET');
  const issuedAt = Date.now().toString();
  const nonce = crypto.randomUUID();
  const payload = `${issuedAt}.${nonce}`;
  const signature = await hmac(secret, payload);
  return `${payload}.${signature}`;
}

export async function verifyState(env, value) {
  const secret = requireEnv(env, 'XERO_STATE_SECRET');
  const [issuedAt, nonce, signature, ...rest] = String(value || '').split('.');
  if (!issuedAt || !nonce || !signature || rest.length) return false;
  const timestamp = Number(issuedAt);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > STATE_MAX_AGE_MS) return false;
  const expected = await hmac(secret, `${issuedAt}.${nonce}`);
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return mismatch === 0;
}

export async function authorizationUrl(request, env) {
  const clientId = requireEnv(env, 'XERO_CLIENT_ID');
  const state = await createState(env);
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri(request, env));
  url.searchParams.set('scope', String(env.XERO_SCOPES || DEFAULT_SCOPES));
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCode(request, env, code) {
  const clientId = requireEnv(env, 'XERO_CLIENT_ID');
  const clientSecret = requireEnv(env, 'XERO_CLIENT_SECRET');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(request, env)
    })
  });
  if (!response.ok) throw new Error(`Xero token exchange ${response.status}: ${await response.text()}`);
  return response.json();
}

export async function fetchConnections(accessToken) {
  const response = await fetch(CONNECTIONS_URL, {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Xero connections ${response.status}: ${await response.text()}`);
  return response.json();
}


export async function loadConnection(env) {
  const cfg = envConfig(env);
  if (!cfg.xeroSyncState) throw new Error('BASEROW_XERO_SYNC_STATE_TABLE_ID is missing');
  const rows = await listRows(cfg, cfg.xeroSyncState);
  const row = rows.find(item => String(item.Name || '').trim().toLowerCase() === 'xero primary connection') || rows[0];
  if (!row) throw new Error('Xero Sync State table has no connection row');
  const tenantId = String(row['Tenant ID'] || '').trim();
  const refreshToken = String(row['Refresh token'] || '').trim();
  if (!tenantId || !refreshToken) throw new Error('The Xero connection row is missing its tenant ID or refresh token');
  return { cfg, row, tenantId, refreshToken };
}

export async function refreshTokens(env, refreshToken) {
  const clientId = requireEnv(env, 'XERO_CLIENT_ID');
  const clientSecret = requireEnv(env, 'XERO_CLIENT_SECRET');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  if (!response.ok) throw new Error(`Xero token refresh ${response.status}: ${await response.text()}`);
  const tokens = await response.json();
  if (!tokens.access_token || !tokens.refresh_token) throw new Error('Xero did not return the expected access and rotated refresh tokens');
  return tokens;
}

export async function refreshedConnection(env) {
  const connection = await loadConnection(env);
  try {
    const tokens = await refreshTokens(env, connection.refreshToken);
    // Xero refresh tokens rotate. Persist the new token before using the access token
    // so a later request never falls back to the now-replaced token.
    await updateRow(connection.cfg, connection.cfg.xeroSyncState, connection.row.id, {
      'Refresh token': tokens.refresh_token,
      'Connection status': 'Connected',
      'Last error': '',
      'Consecutive failures': 0
    });
    return { ...connection, accessToken: tokens.access_token };
  } catch (error) {
    const failures = Number(connection.row['Consecutive failures'] || 0) + 1;
    await updateRow(connection.cfg, connection.cfg.xeroSyncState, connection.row.id, {
      'Connection status': 'Error',
      'Last error': String(error.message || error).slice(0, 4000),
      'Consecutive failures': failures
    }).catch(() => {});
    throw error;
  }
}

export async function saveConnection(env, { tenantId, refreshToken, tenantName = '' }) {
  const cfg = envConfig(env);
  if (!cfg.xeroSyncState) throw new Error('BASEROW_XERO_SYNC_STATE_TABLE_ID is missing');
  const rows = await listRows(cfg, cfg.xeroSyncState);
  const row = rows.find(item => String(item.Name || '').trim().toLowerCase() === 'xero primary connection') || rows[0];
  if (!row) throw new Error('Xero Sync State table has no row to update');
  await updateRow(cfg, cfg.xeroSyncState, row.id, {
    'Tenant ID': tenantId,
    'Refresh token': refreshToken,
    'Connection status': 'Connected',
    'Last error': '',
    'Consecutive failures': 0,
    ...(tenantName ? { 'Tenant name': tenantName } : {})
  });
  return row.id;
}
