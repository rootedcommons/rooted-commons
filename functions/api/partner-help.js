import { cachedPublicGet, envConfig, getRow, json, jsonCached, truthy, unwrap } from '../_baserow.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) return json({ ok:false, message:'A valid partner ID is required.' }, 400);
  return cachedPublicGet(context, async () => {
  try {
    const cfg = envConfig(env);
    const row = await getRow(cfg, cfg.networkPartners, id);
    if (!row || !truthy(row.Active, true) || !unwrap(row.Name)) return json({ ok:false, message:'Partner not found.' }, 404);
    return jsonCached({
      ok:true,
      partner:{
        id:Number(row.id),
        name:unwrap(row.Name),
        priceExplanation:unwrap(row['Price explanation'])
      }
    }, 200, 'public, max-age=300, s-maxage=900, stale-while-revalidate=1800');
  } catch (error) {
    console.error('partner price help failed', error);
    return json({ ok:false, message:'Partner information could not be loaded.' }, 500);
  }
  });
}
