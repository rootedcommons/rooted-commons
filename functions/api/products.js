import { envConfig, json, listRows, number, truthy } from '../_baserow.js';

function stockPayload(row) {
  return {
    id: Number(row.id),
    availableStock: Math.max(0, number(row['Available stock'])),
    lowStockThreshold: Math.max(0, number(row['Low stock threshold'], 5)),
    available: truthy(row.Available, true)
  };
}

export async function onRequestGet({ env }) {
  try {
    const cfg = envConfig(env);
    const rows = await listRows(cfg, cfg.products);
    return json({ ok: true, products: rows.map(stockPayload) });
  } catch (error) {
    return json({ ok: false, message: String(error.message || 'Product availability could not be loaded.') }, 500);
  }
}
