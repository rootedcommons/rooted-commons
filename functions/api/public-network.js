import { envConfig, fileUrl, json, linkedIds, linkedValues, listRows, number, truthy, unwrap } from '../_baserow.js';


function publicStatsSection(row) {
  return {
    id: Number(row.id),
    key: unwrap(row.Key),
    metricIds: linkedIds(row.Metrics),
    metricNames: linkedValues(row.Metrics),
    columns: Math.min(4, Math.max(1, number(row.Columns, 3)))
  };
}

function publicPartner(row) {
  return {
    id: Number(row.id),
    name: unwrap(row.Name),
    role: linkedValues(row['Network role'] || row.Role),
    summary: unwrap(row.Summary),
    longDescription: unwrap(row['Long description']),
    whatTheyBring: unwrap(row['What they bring']),
    howWeWorkTogether: unwrap(row['How we work together']),
    address: unwrap(row.Address),
    website: unwrap(row.Website),
    volunteerUrl: unwrap(row['Volunteer URL']),
    socialUrl: unwrap(row['Social URL']),
    getInvolvedLabel: unwrap(row['Get involved label']) || 'Get involved',
    getInvolvedUrl: unwrap(row['Get involved URL']),
    image: fileUrl(row.Image),
    image2: fileUrl(row['Image 2']),
    image3: fileUrl(row['Image 3']),
    imageAlt: unwrap(row['Image alt text']),
    image2Alt: unwrap(row['Image 2 alt text']),
    image3Alt: unwrap(row['Image 3 alt text']),
    order: number(row['Display order'] || row.Order, 9999)
  };
}

function tokenResolver({ members, partners, transactions, availability = {} }) {
  const activeMembers = members.filter(row => truthy(row.Active, true));
  const totalMembers = activeMembers.length;
  const totalCommitments = activeMembers.reduce((sum, row) => sum + number(row['Weekly commitment'], 0), 0);
  const totalNetworkPartners = partners.length;
  const orderChargeTotal = Math.abs(transactions
    .filter(row => ['order-charge', 'order-charges'].includes(unwrap(row.Type).trim().toLowerCase().replace(/\s+/g, '-')))
    .reduce((sum, row) => sum + number(row.Amount, 0), 0));
  const tokens = {
    '{{members}}': availability.members ? totalMembers.toLocaleString('en-GB') : '—',
    '{{total_members}}': availability.members ? totalMembers.toLocaleString('en-GB') : '—',
    '{{network_partners}}': availability.partners ? totalNetworkPartners.toLocaleString('en-GB') : '—',
    '{{total_commitments}}': availability.members ? totalCommitments.toLocaleString('en-GB', { maximumFractionDigits: 2 }) : '—',
    '{{member_spending}}': availability.transactions ? orderChargeTotal.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : '—'
  };
  return value => Object.entries(tokens).reduce((result, [token, replacement]) => result.replaceAll(token, replacement), String(value || ''));
}

function publicMetric(row, resolveTokens) {
  const partnerNames = linkedValues(row['Network Partner'] || row['Network partner']);
  return {
    id: Number(row.id),
    name: unwrap(row.Name),
    value: resolveTokens(unwrap(row.Value)),
    description: unwrap(row.Description),
    icon: fileUrl(row.Icon),
    placements: linkedValues(row.Placement),
    networkPartner: partnerNames[0] || '',
    order: number(row['Display order'] || row.Order, 9999)
  };
}

async function safeTable(cfg, tableId, label) {
  if (!tableId) return { ok:false, label, rows:[] };
  try { return { ok:true, label, rows:await listRows(cfg, tableId) }; }
  catch (error) { console.error(`Public network: ${label} failed`, error); return { ok:false, label, rows:[] }; }
}

export async function onRequestGet(context) {
  const cfg = envConfig(context.env);
  const [partnersResult, metricsResult, sectionsResult, membersResult, transactionsResult] = await Promise.all([
    safeTable(cfg, cfg.networkPartners, 'networkPartners'),
    safeTable(cfg, cfg.metrics, 'metrics'),
    safeTable(cfg, cfg.sections, 'sections'),
    safeTable(cfg, cfg.members, 'members'),
    safeTable(cfg, cfg.transactions, 'transactions')
  ]);

  const partners = partnersResult.rows
    .filter(row => truthy(row.Active, true) && unwrap(row.Name))
    .map(publicPartner)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const statSections = sectionsResult.rows
    .filter(row => truthy(row.Visible, true) && unwrap(row['Section type']).trim().toLowerCase() === 'stats')
    .map(publicStatsSection);

  const resolveTokens = tokenResolver({ members:membersResult.rows, partners, transactions:transactionsResult.rows, availability:{members:membersResult.ok,partners:partnersResult.ok,transactions:transactionsResult.ok} });
  const metrics = metricsResult.rows
    .filter(row => truthy(row.Active, true) && truthy(row.Public, true) && unwrap(row.Name))
    .map(row => publicMetric(row, resolveTokens))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const coreOk = partnersResult.ok || metricsResult.ok;
  return json({
    ok: coreOk,
    partners,
    metrics,
    statSections,
    errors:[partnersResult, metricsResult, sectionsResult, membersResult, transactionsResult].filter(result => !result.ok).map(result => result.label)
  }, coreOk ? 200 : 503);
}
