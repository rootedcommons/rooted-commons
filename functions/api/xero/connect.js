import { authorizationUrl } from './_oauth.js';

export async function onRequestGet({ request, env }) {
  try {
    const location = await authorizationUrl(request, env);
    return Response.redirect(location, 302);
  } catch (error) {
    return new Response(`Xero connection could not be started: ${String(error.message || error)}`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
}
