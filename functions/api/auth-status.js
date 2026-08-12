import { envConfig, json } from '../_baserow.js';
import { authenticatedMember } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const cfg = envConfig(env);
    const auth = await authenticatedMember(cfg, request, env);
    if (!auth) return json({ authenticated:false }, 401);
    return json({ authenticated:true });
  } catch (error) {
    console.error('auth status lookup failed', error);
    return json({ error:'Authentication status could not be checked.' }, 503);
  }
}
