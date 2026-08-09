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

function tokenResolver({ members, partners, transactions }) {
  const activeMembers = members.filter(row => truthy(row.Active, true));
  const totalMembers = activeMembers.length;
  const totalCommitments = activeMembers.reduce((sum, row) => sum + number(row['Weekly commitment'], 0), 0);
  const totalNetworkPartners = partners.length;
  const orderChargeTotal = Math.abs(transactions
    .filter(row => ['order-charge', 'order-charges'].includes(unwrap(row.Type).trim().toLowerCase().replace(/\s+/g, '-')))
    .reduce((sum, row) => sum + number(row.Amount, 0), 0));
  const tokens = {
    '{{members}}': totalMembers.toLocaleString('en-GB'),
    '{{total_members}}': totalMembers.toLocaleString('en-GB'),
    '{{network_partners}}': totalNetworkPartners.toLocaleString('en-GB'),
    '{{total_commitments}}': totalCommitments.toLocaleString('en-GB', { maximumFractionDigits: 2 }),
    '{{member_spending}}': orderChargeTotal.toLocaleString('en-GB', { maximumFractionDigits: 0 })
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

export async function onRequestGet(context) {
  try {
    const cfg = envConfig(context.env);
    if (!cfg.networkPartners || !cfg.metrics || !cfg.sections) {
      return json({ error: 'Public network data is not configured.' }, 503);
    }

    // Metrics and Network Partners are deliberately read with the runtime token so
    // edits in Baserow are visible without rebuilding the static Astro site.
    const [partnerRows, metricRows, sectionRows, memberRows, transactionRows] = await Promise.all([
      listRows(cfg, cfg.networkPartners),
      listRows(cfg, cfg.metrics),
      listRows(cfg, cfg.sections),
      cfg.members ? listRows(cfg, cfg.members) : Promise.resolve([]),
      cfg.transactions ? listRows(cfg, cfg.transactions) : Promise.resolve([])
    ]);

    const partners = partnerRows
      .filter(row => truthy(row.Active, true) && unwrap(row.Name))
      .map(publicPartner)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    const statSections = sectionRows
      .filter(row => truthy(row.Visible, true) && unwrap(row['Section type']).trim().toLowerCase() === 'stats')
      .map(publicStatsSection);

    const resolveTokens = tokenResolver({ members: memberRows, partners, transactions: transactionRows });
    const metrics = metricRows
      .filter(row => truthy(row.Active, true) && truthy(row.Public, true) && unwrap(row.Name))
      .map(row => publicMetric(row, resolveTokens))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    return json({ partners, metrics, statSections });
  } catch (error) {
    console.error('Public network endpoint failed', error);
    return json({ error: 'Unable to load network data.' }, 500);
  }
}
