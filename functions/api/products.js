import { cachedPublicGet, envConfig, json, jsonCached, listRows, number, truthy } from '../_baserow.js';

function stockPayload(row) {
  return {
    id: Number(row.id),
    availableStock: Math.max(0, number(row['Available stock'])),
    lowStockThreshold: Math.max(0, number(row['Low stock threshold'], 5)),
    available: truthy(row.Available, true),
    memberPrice: Math.round(number(row['Member price']) * 100) / 100
  };
}

export async function onRequestGet(context) {
  return cachedPublicGet(context, async () => {
  try {
    const cfg = envConfig(context.env);
    const rows = await listRows(cfg, cfg.products);
    return jsonCached({ ok: true, products: rows.map(stockPayload) }, 200, 'public, max-age=5, s-maxage=10, stale-while-revalidate=20');
  } catch (error) {
    console.error('product availability failed',error);
    return json({ok:false,message:'Product availability could not be loaded.'},500);
  }
  });
}
