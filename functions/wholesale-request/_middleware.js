import { envConfig } from '../_baserow.js';
import { authenticatedMember } from '../_auth.js';

export async function onRequest(context) {
  const cfg = envConfig(context.env);
  const auth = await authenticatedMember(cfg, context.request, context.env, '');
  if (!auth) return Response.redirect(new URL('/signin/?return=/wholesale-request/', context.request.url), 302);
  return context.next();
}
