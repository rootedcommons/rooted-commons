import { createRow, deleteRow, envConfig, json } from '../_baserow.js';
import { authenticatedMember } from '../_auth.js';
import { wholesalePerkAccess } from '../_perks.js';

const clean = (value, max = 500) => String(value || '').trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  try {
    const cfg = envConfig(env);
    const auth = await authenticatedMember(cfg, request, env, '');
    if (!auth) return json({ ok:false, message:'Please sign in to submit a wholesale request.' }, 401);
    const access = await wholesalePerkAccess(cfg, auth.member);
    if (!access.unlocked) return json({ ok:false, message:'This perk has not been unlocked yet.' }, 403);
    if (!cfg.wholesaleRequests || !cfg.wholesaleRequestLines) return json({ ok:false, message:'Wholesale requests are not configured yet.' }, 503);

    const body = await request.json();
    const lines = Array.isArray(body.lines) ? body.lines.map((line) => ({
      productName: clean(line.productName, 200),
      productCode: clean(line.productCode, 120),
      quantity: Math.max(0, Number(line.quantity) || 0),
      supplier: clean(line.supplier, 200),
      notes: clean(line.notes, 1000)
    })).filter((line) => line.productName && line.quantity > 0) : [];
    if (!lines.length) return json({ ok:false, message:'Add at least one product and quantity.' }, 400);
    if (lines.length > 30) return json({ ok:false, message:'Please submit no more than 30 products at a time.' }, 400);

    const parent = await createRow(cfg, cfg.wholesaleRequests, {
      Member: [Number(auth.member.id)],
      'Submitted at': new Date().toISOString(),
      Status: 'New',
      Notes: clean(body.notes, 2000)
    });
    const createdLineIds = [];
    try {
      for (const line of lines) {
        const row = await createRow(cfg, cfg.wholesaleRequestLines, {
          Request: [Number(parent.id)],
          'Product name': line.productName,
          'Product code': line.productCode,
          Quantity: line.quantity,
          Supplier: line.supplier,
          Notes: line.notes
        });
        createdLineIds.push(Number(row.id));
      }
    } catch (error) {
      await Promise.allSettled(createdLineIds.map((id) => deleteRow(cfg, cfg.wholesaleRequestLines, id)));
      await deleteRow(cfg, cfg.wholesaleRequests, parent.id).catch(()=>{});
      throw error;
    }
    return json({ ok:true, requestId:Number(parent.id), message:'Your wholesale request has been sent.' });
  } catch (error) {
    console.error('wholesale request failed', error);
    return json({ ok:false, message:'We could not submit your wholesale request. Please try again.' }, 500);
  }
}
