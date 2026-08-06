import { json } from '../../_baserow.js';
import { syncMemberPayments } from './_sync.js';

function constantTimeEqual(expected, supplied) {
  expected = String(expected || '');
  supplied = String(supplied || '');
  if (!expected || !supplied || expected.length !== supplied.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i += 1) {
    difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  }
  return difference === 0;
}

function suppliedKey(request) {
  const auth = String(request.headers.get('authorization') || '');
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1].trim();
  return String(request.headers.get('x-rooted-sync-key') || '').trim();
}

export async function onRequestGet() {
  return json({
    ok: false,
    message: 'Xero automatic sync accepts POST requests only.'
  }, 405);
}

export async function onRequestPost({ request, env }) {
  try {
    const expected = String(env.XERO_SYNC_KEY || '').trim();
    if (!expected) return json({ ok:false, error:'XERO_SYNC_KEY is not configured' }, 503);
    if (!constantTimeEqual(expected, suppliedKey(request))) {
      return json({ ok:false, error:'Unauthorized' }, 401);
    }

    const result = await syncMemberPayments(env);
    return json(result, 200);
  } catch (error) {
    return json({ ok:false, error:String(error?.message || error) }, 500);
  }
}
