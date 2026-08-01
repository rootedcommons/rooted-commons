import { verifyState, exchangeCode, fetchConnections, saveConnection } from './_oauth.js';

function html(title, message, status = 200) {
  const safe = String(message).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:4rem auto;padding:0 1.5rem;line-height:1.55;color:#2d2528}h1{font-size:1.7rem}a{color:inherit}</style></head><body><h1>${title}</h1><p>${safe}</p><p><a href="/">Return to Rooted Commons</a></p></body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) return html('Xero connection cancelled', url.searchParams.get('error_description') || error, 400);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !(await verifyState(env, state))) return html('Xero connection failed', 'The callback was missing a valid authorization code or security state. Please start the connection again.', 400);

  try {
    const tokens = await exchangeCode(request, env, code);
    if (!tokens.access_token || !tokens.refresh_token) throw new Error('Xero did not return the expected access and refresh tokens');
    const connections = await fetchConnections(tokens.access_token);
    if (!Array.isArray(connections) || connections.length === 0) throw new Error('No Xero organisation was connected');
    if (connections.length > 1) throw new Error('More than one Xero organisation is connected. Disconnect the unwanted organisation(s) and run the connection again.');
    const connection = connections[0];
    await saveConnection(env, {
      tenantId: connection.tenantId,
      refreshToken: tokens.refresh_token,
      tenantName: connection.tenantName || ''
    });
    return html('Xero connected', `${connection.tenantName || 'Your Xero organisation'} is now connected to Rooted Commons. The tenant ID and rotating refresh token have been saved to the private Xero Sync State table.`);
  } catch (error) {
    return html('Xero connection failed', String(error.message || error), 500);
  }
}
