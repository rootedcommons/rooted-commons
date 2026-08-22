import { envConfig } from '../_baserow.js';
import { authenticatedMember } from '../_auth.js';
import { wholesalePerkAccess } from '../_perks.js';

export async function onRequest(context) {
  const cfg = envConfig(context.env);
  const auth = await authenticatedMember(cfg, context.request, context.env, '');
  if (!auth) return Response.redirect(new URL('/signin/?return=/wholesale-request/', context.request.url), 302);
  const access = await wholesalePerkAccess(cfg, auth.member);
  if (!access.unlocked) return Response.redirect(new URL('/dashboard/', context.request.url), 302);
  return context.next();
}
