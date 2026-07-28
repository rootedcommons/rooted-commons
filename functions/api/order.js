import { envConfig, json, listRows, createRow, tokenValid, number, linkedIds, linkedValues, unwrap, orderWeek, truthy } from '../_baserow.js';

function productPayload(row) {
  return {
    id: Number(row.id),
    name: unwrap(row.Product),
    code: unwrap(row.Code),
    price: number(row['Member price']),
    stock: Math.max(0, number(row['Available stock'])),
    available: truthy(row.Available, true),
    categories: linkedValues(row.Category),
    collectionPointIds: linkedIds(row['Available collection points'])
  };
}

function sameMember(order, memberId) {
  return linkedIds(order.Member).includes(Number(memberId));
}

function compatibleWithPoint(product, point) {
  const availableCategories = linkedValues(point['Available to collect here']);
  const categoryCompatible = !availableCategories.length || !product.categories.length || product.categories.some(
    category => availableCategories.some(value => value.toLowerCase() === category.toLowerCase())
  );
  const pointCompatible = !product.collectionPointIds.length || product.collectionPointIds.includes(Number(point.id));
  return categoryCompatible && pointCompatible;
}

export async function onRequestPost({ request, env }) {
  const cfg = envConfig(env);

  try {
    const body = await request.json();
    const token = String(body.token || '');
    const clientRequestId = String(body.clientRequestId || '').trim();
    const requested = Array.isArray(body.items) ? body.items : [];
    const selectedPointId = Number(body.collectionPointId || 0);

    if (!token || !clientRequestId || !requested.length) {
      return json({ ok: false, message: 'Your basket or secure link is missing.' }, 400);
    }
    if (!selectedPointId) {
      return json({ ok: false, message: 'Choose a collection point before confirming your order.' }, 400);
    }

    const [members, productRows, orders, points] = await Promise.all([
      listRows(cfg, cfg.members),
      listRows(cfg, cfg.products),
      listRows(cfg, cfg.orders),
      listRows(cfg, cfg.collectionPoints)
    ]);

    const member = members.find(row => tokenValid(row, token));
    if (!member) {
      return json({ ok: false, message: 'This ordering link is invalid or has expired.' }, 401);
    }

    const duplicate = orders.find(
      row => String(row['Client request ID'] || '') === clientRequestId && sameMember(row, member.id)
    );
    if (duplicate) {
      const duplicateTotal = number(duplicate['Order total']);
      const currentCredit = number(member['Current credit']);
      return json({
        ok: true,
        orderNumber: unwrap(duplicate['Order number']),
        total: duplicateTotal,
        closingCredit: Math.round((currentCredit - duplicateTotal) * 100) / 100,
        collectionPoint: linkedValues(duplicate['Collection point'])[0],
        status: unwrap(duplicate.Status) || 'Processing',
        duplicate: true,
        message: 'Your order has already been received.'
      });
    }

    const selectedPoint = points.find(row => Number(row.id) === selectedPointId && truthy(row.Active, true));
    if (!selectedPoint) {
      return json({ ok: false, message: 'That collection point is not currently available.' }, 409);
    }

    const week = orderWeek();
    const existingOrder = orders.find(
      row => sameMember(row, member.id)
        && String(row['Order week'] || '') === week
        && ['Processing', 'Confirmed'].includes(String(unwrap(row.Status) || ''))
    );
    if (existingOrder) {
      return json({
        ok: false,
        message: `You already have an order for this ordering week (${unwrap(existingOrder['Order number']) || 'order already received'}). Please email us if it needs changing.`
      }, 409);
    }

    const products = new Map(productRows.map(row => [Number(row.id), productPayload(row)]));
    const lines = [];

    for (const item of requested) {
      const id = Number(item.productId);
      const quantity = Math.floor(Number(item.quantity || 0));
      const product = products.get(id);

      if (!product || quantity < 1) continue;
      if (!product.available) {
        throw Object.assign(new Error(`${product.name || 'An item'} is currently unavailable.`), { status: 409 });
      }
      if (!compatibleWithPoint(product, selectedPoint)) {
        throw Object.assign(new Error(`${product.name} is not available at ${unwrap(selectedPoint.Name)}.`), { status: 409 });
      }
      if (product.stock < quantity) {
        throw Object.assign(
          new Error(`Only ${Math.max(0, product.stock)} of ${product.name} are currently available.`),
          { status: 409 }
        );
      }

      const unitPrice = Math.round(product.price * 100) / 100;
      const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
      lines.push({
        product_id: id,
        product_name: product.name,
        product_code: product.code,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal
      });
    }

    if (!lines.length) {
      throw Object.assign(new Error('Your basket is empty.'), { status: 400 });
    }

    const total = Math.round(lines.reduce((sum, line) => sum + line.line_total, 0) * 100) / 100;
    const startingCredit = number(member['Current credit']);
    const orderNumber = `RC-${week.replace('-W', '')}-${String(Date.now()).slice(-6)}`;
    const submittedAt = new Date().toISOString();
    const movementDate = submittedAt.replace(/\.\d{3}Z$/, 'Z');
    const stockMovementRows = lines.map((line) => ({
      'Product code': [line.product_id],
      'Quantity change': -Math.abs(line.quantity),
      'Unit price': line.unit_price,
      'Movement type': 'Order',
      Order: [orderNumber],
      Date: movementDate,
      'Idempotency key': `order-${orderNumber}-product-${line.product_id}`,
      Active: true
    }));

    await createRow(cfg, cfg.orders, {
      'Submitted at': submittedAt,
      'Order source': 'Website',
      'Order week': week,
      'Collection point': [selectedPoint.id],
      'Item JSON': JSON.stringify(lines),
      'Stock Movement JSON': JSON.stringify(stockMovementRows),
      'Order total': total,
      Status: 'Processing',
      'Order number': orderNumber,
      'Client request ID': clientRequestId,
      Member: [member.id],
      Email: member.Email || ''
    });

    return json({
      ok: true,
      orderNumber,
      total,
      startingCredit,
      closingCredit: Math.round((startingCredit - total) * 100) / 100,
      collectionPoint: unwrap(selectedPoint.Name),
      status: 'Processing',
      message: 'Your order has been received and is being processed.'
    });
  } catch (error) {
    return json(
      { ok: false, message: String(error.message || 'The order could not be submitted.') },
      Number(error.status) || 500
    );
  }
}
