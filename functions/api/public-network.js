import { cachedPublicGet, envConfig, fileUrl, json, jsonCached, linkedIds, linkedValues, listRows, publicCollectionPoint, truthy, unwrap, updateRow } from '../_baserow.js';

function originalFileUrl(value) {
  return Array.isArray(value) && value.length ? String(value[0]?.url || '') : '';
}
import { hasComputedValueField, memberStats, metricTemplate, needsMemberStats, needsTransactionStats, resolveMetricTemplate, transactionStats } from '../_public-metrics.js';

function publicStatsSection(row) {
  return {
    id: Number(row.id),
    key: unwrap(row.Key),
    metricIds: linkedIds(row.Metrics),
    metricNames: linkedValues(row.Metrics),
    columns: Math.min(4, Math.max(1, Number(unwrap(row.Columns) || 3)))
  };
}

function publicPartner(row) {
  return {
    id: Number(row.id),
    name: unwrap(row.Name),
    role: linkedValues(row['Network role'] || row.Role),
    summary: unwrap(row.Summary),
    longDescription: unwrap(row['Long description']),
    howWeWorkTogether: unwrap(row['How we work together']),
    priceExplanation: unwrap(row['Price explanation']),
    address: unwrap(row.Address),
    latitude: Number(unwrap(row.Latitude)) || null,
    longitude: Number(unwrap(row.Longitude)) || null,
    website: unwrap(row.Website),
    volunteerUrl: unwrap(row['Volunteer URL']),
    socialUrl: unwrap(row['Social URL']),
    offeringText: {
      'Refills': unwrap(row['Refills']),
      'Coffee': unwrap(row['Coffee']),
      'Evening drinks': unwrap(row['Evening drinks']),
      'Workshops': unwrap(row['Workshops']),
      'Volunteering': unwrap(row['Volunteering']),
      'Pick your Own': unwrap(row['Pick your Own']),
      "Kid's club": unwrap(row["Kid's club"]),
      'Bees': unwrap(row['Bees']),
      'Food bank': unwrap(row['Food bank'])
    },
    image: originalFileUrl(row.Image),
    image2: originalFileUrl(row['Image 2']),
    image3: originalFileUrl(row['Image 3']),
    imageAlt: unwrap(row['Image alt text']),
    image2Alt: unwrap(row['Image 2 alt text']),
    image3Alt: unwrap(row['Image 3 alt text']),
    productBadge: originalFileUrl(row['Product badge']),
    order: Number(unwrap(row['Display order'] || row.Order) || 9999),
    acceptsMemberCreditDonations: truthy(row['Accepts Member Credit donations'], false)
  };
}

function publicMetric(row, { members = null, transactions = null, partnerCount = 0 } = {}) {
  const partnerNames = linkedValues(row['Network Partner'] || row['Network partner']);
  const computed = unwrap(row['Computed value']);
  const template = computed || metricTemplate(row);
  const value = computed || resolveMetricTemplate(template, { members, transactions, partnerCount });
  return {
    id: Number(row.id),
    name: unwrap(row.Name),
    value,
    description: unwrap(row.Description),
    icon: fileUrl(row.Icon),
    placements: linkedValues(row.Placement),
    networkPartner: partnerNames[0] || '',
    order: Number(unwrap(row['Display order'] || row.Order) || 9999),
    acceptsMemberCreditDonations: truthy(row['Accepts Member Credit donations'], false)
  };
}

async function safeTable(cfg, tableId, label) {
  if (!tableId) return { ok:false, label, rows:[] };
  try { return { ok:true, label, rows:await listRows(cfg, tableId) }; }
  catch (error) { console.error(`Public network: ${label} failed`, error); return { ok:false, label, rows:[] }; }
}

export async function onRequestGet(context) {
  return cachedPublicGet(context, async () => {
    const cfg = envConfig(context.env);
    const [partnersResult, metricsResult, sectionsResult, collectionPointsResult] = await Promise.all([
      safeTable(cfg, cfg.networkPartners, 'networkPartners'),
      safeTable(cfg, cfg.metrics, 'metrics'),
      safeTable(cfg, cfg.sections, 'sections'),
      safeTable(cfg, cfg.collectionPoints, 'collectionPoints')
    ]);

    const publicPoints = collectionPointsResult.rows
      .filter(row => truthy(row.Active, true) && unwrap(row.Name))
      .map(row => ({ point: publicCollectionPoint(row), partnerIds: linkedIds(row['Network Partner']) }));

    const partners = partnersResult.rows
      .filter(row => truthy(row.Active, true) && unwrap(row.Name))
      .map(row => {
        const partner = publicPartner(row);
        const matches = publicPoints.filter(item => item.partnerIds.includes(partner.id)).map(item => item.point);
        return { ...partner, collectionPoints: matches, collectionPoint: matches[0] || null };
      })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    const metricRows = metricsResult.rows.filter(row => truthy(row.Active, true) && truthy(row.Public, true) && unwrap(row.Name));
    const unresolvedMemberRows = metricRows.filter(row => needsMemberStats(row) && !unwrap(row['Computed value']));
    const unresolvedTransactionRows = metricRows.filter(row => needsTransactionStats(row) && !unwrap(row['Computed value']));

    let members = null;
    let transactions = null;
    const extraErrors = [];
    if (unresolvedMemberRows.length && cfg.members) {
      const result = await safeTable(cfg, cfg.members, 'members');
      if (result.ok) members = memberStats(result.rows); else extraErrors.push(result.label);
    }
    if (unresolvedTransactionRows.length && cfg.transactions) {
      const result = await safeTable(cfg, cfg.transactions, 'transactions');
      if (result.ok) transactions = transactionStats(result.rows); else extraErrors.push(result.label);
    }

    // Backward-compatible bootstrap: once the optional Computed value field exists,
    // fill it from the fallback calculation so future public requests do not scan Members.
    const canPersist = metricRows.some(hasComputedValueField);
    if (canPersist && unresolvedMemberRows.length && members) {
      const writes = unresolvedMemberRows
        .filter(hasComputedValueField)
        .map(row => updateRow(cfg,cfg.metrics,row.id,{
          'Computed value':resolveMetricTemplate(metricTemplate(row),{members,partnerCount:partners.length})
        }).catch(error => console.warn('Unable to cache public metric', error)));
      if (writes.length && typeof context.waitUntil === 'function') context.waitUntil(Promise.all(writes));
    }

    const statSections = sectionsResult.rows
      .filter(row => truthy(row.Visible, true) && unwrap(row['Section type']).trim().toLowerCase() === 'stats')
      .map(publicStatsSection);

    const metrics = metricRows
      .map(row => publicMetric(row, { members, transactions, partnerCount:partners.length }))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    const coreOk = partnersResult.ok || metricsResult.ok;
    const payload = {
      ok: coreOk,
      partners,
      metrics,
      statSections,
      errors:[partnersResult, metricsResult, sectionsResult, collectionPointsResult].filter(result => !result.ok).map(result => result.label).concat(extraErrors)
    };
    return coreOk
      ? jsonCached(payload, 200, 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
      : json(payload, 503);
  });
}
