import { fallbackCollectionPoints, fallbackInterfaceContent, fallbackPages, fallbackProducts, fallbackSections, fallbackSettings } from '../data/fallback';
import { normalizePageRow } from '../../functions/_page-normalizer.js';

const API_URL = import.meta.env.BASEROW_API_URL || 'https://api.baserow.io';
const TOKEN = import.meta.env.BASEROW_TOKEN;

const TABLES = {
  settings: import.meta.env.BASEROW_SITE_SETTINGS_TABLE_ID,
  pages: import.meta.env.BASEROW_PAGES_TABLE_ID,
  sections: import.meta.env.BASEROW_SECTIONS_TABLE_ID,
  products: import.meta.env.BASEROW_PRODUCTS_TABLE_ID,
  collectionPoints: import.meta.env.BASEROW_COLLECTION_POINTS_TABLE_ID,
  interfaceContent: import.meta.env.BASEROW_INTERFACE_CONTENT_TABLE_ID,
  networkPartners: import.meta.env.BASEROW_NETWORK_PARTNERS_TABLE_ID,
  metrics: import.meta.env.BASEROW_METRICS_TABLE_ID || import.meta.env.BASEROW_IMPACT_METRICS_TABLE_ID
};

type Row = Record<string, any>;

function raw(row: Row | undefined, key: string): any {
  if (!row) return undefined;
  if (key in row) return row[key];
  const wanted = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  const actual = Object.keys(row).find((candidate) => candidate.toLowerCase().replace(/[^a-z0-9]/g, '') === wanted);
  return actual ? row[actual] : undefined;
}

function unwrap(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map((item) => unwrap(item?.value ?? item?.name ?? item)).filter(Boolean).join(', ');
  if (typeof value === 'object') return unwrap(value.value ?? value.name ?? value.text ?? value.plain_text);
  return '';
}

const text = (row: Row | undefined, key: string, fallback = '') => unwrap(raw(row, key)) || fallback;
const numeric = (row: Row | undefined, key: string, fallback = 0) => {
  const value = raw(row, key);
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const boolean = (row: Row | undefined, key: string, fallback = true) => {
  const value = raw(row, key);
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return !['false', '0', 'no', 'off'].includes(String(value).toLowerCase());
};
const choice = (row: Row | undefined, key: string, fallback = '') => text(row, key, fallback);
const linkedValues = (value: any): string[] => Array.isArray(value)
  ? value.map((item) => unwrap(item?.value ?? item?.name ?? item)).filter(Boolean)
  : unwrap(value).split(',').map((item) => item.trim()).filter(Boolean);
const linkedIds = (value: any): number[] => Array.isArray(value)
  ? value.map((item) => Number(item?.id ?? item)).filter(Number.isFinite)
  : [];
const fileValue = (row: Row | undefined, key: string) => {
  const value = raw(row, key);
  return Array.isArray(value) && value.length ? value[0] : null;
};
const fileUrl = (row: Row | undefined, key: string, fallback = '') => {
  const file = fileValue(row, key);
  return file?.url || file?.thumbnails?.large?.url || file?.thumbnails?.card_cover?.url || fallback;
};
const originalFileUrl = (row: Row | undefined, key: string, fallback = '') => {
  const file = fileValue(row, key);
  return file?.url || fallback;
};
const fileLargeUrl = (row: Row | undefined, key: string, fallback = '') => {
  const file = fileValue(row, key);
  return file?.thumbnails?.large?.url || file?.url || file?.thumbnails?.card_cover?.url || fallback;
};
const fileCardUrl = (row: Row | undefined, key: string, fallback = '') => {
  const file = fileValue(row, key);
  return file?.thumbnails?.large?.url || file?.url || file?.thumbnails?.card_cover?.url || fallback;
};

async function listRows(tableId?: string, token = TOKEN): Promise<Row[] | null> {
  if (!token || !tableId) return null;
  const rows: Row[] = [];
  let page = 1;
  try {
    while (true) {
      const response = await fetch(`${API_URL}/api/database/rows/table/${tableId}/?user_field_names=true&size=200&page=${page}`, {
        headers: { Authorization: `Token ${token}` }
      });
      if (!response.ok) throw new Error(`Baserow returned HTTP ${response.status}`);
      const payload = await response.json();
      rows.push(...(payload.results || []));
      if (!payload.next) break;
      page += 1;
    }
    return rows;
  } catch (error) {
    console.warn(`Baserow table ${tableId} could not be read; fallback content will be used.`, error);
    return null;
  }
}

function normalized(value: string, fallback: string) {
  const result = (value || fallback).trim().toLowerCase().replace(/\s+/g, '-');
  return result === 'centre' ? 'center' : result;
}


function cleanCollectionTime(value: string) {
  const raw = String(value || '')
    .trim()
    .replace(/^(?:thursday|friday|saturday|sunday)\s*[-–—·:]?\s*/i, '')
    .replace(/[–—]/g, '-');
  const range = raw.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i);
  if (!range) return raw.replace(/(\d{1,2}):(\d{2})/g, '$1.$2');
  let [, h1, m1 = '00', ap1 = '', h2, m2 = '00', ap2 = ''] = range;
  ap1 = ap1.toLowerCase(); ap2 = ap2.toLowerCase();
  if (!ap1 && ap2) ap1 = ap2;
  const to24 = (hour: string, suffix: string) => {
    let h = Number(hour);
    if (suffix === 'pm' && h < 12) h += 12;
    if (suffix === 'am' && h === 12) h = 0;
    return h;
  };
  return `${to24(h1, ap1)}.${m1}-${to24(h2, ap2)}.${m2}`;
}

function heroImageFit(value: string) {
  const normalizedValue = normalized(value, 'fill-frame');
  if (normalizedValue === 'show-whole-image' || normalizedValue === 'contain') return 'contain';
  return 'cover';
}

function heroImageAlignment(value: string) {
  const normalizedValue = normalized(value, 'centre');
  const aliases: Record<string, string> = {
    center: 'center',
    centre: 'center',
    left: 'center-left',
    right: 'center-right',
    top: 'top-center',
    bottom: 'bottom-center',
    'top-centre': 'top-center',
    'centre-left': 'center-left',
    'centre-right': 'center-right',
    'bottom-centre': 'bottom-center'
  };
  return aliases[normalizedValue] || normalizedValue;
}

function heroWidth(value: string) {
  const normalizedValue = normalized(value, 'standard');
  return normalizedValue === 'normal' || normalizedValue === 'medium' ? 'standard' : normalizedValue;
}


let siteDataPromise: Promise<any> | null = null;

export function getSiteData() {
  siteDataPromise ||= loadSiteData();
  return siteDataPromise;
}

async function loadSiteData() {
  const [settingsRows, pageRows, sectionRows, productRows, collectionRows, interfaceRows, networkPartnerRows, metricRows] = await Promise.all([
    listRows(TABLES.settings),
    listRows(TABLES.pages),
    listRows(TABLES.sections),
    listRows(TABLES.products),
    listRows(TABLES.collectionPoints),
    listRows(TABLES.interfaceContent),
    // Network Partners and Metrics are hydrated only where their live grids are present,
    // so the static build token does not need access to those runtime tables.
    Promise.resolve([]),
    Promise.resolve([])
  ]);

  const validSettingsRow = settingsRows?.find((row) => text(row, 'Site title') || fileUrl(row, 'Header logo'));
  const settings = validSettingsRow ? {
    siteTitle: text(validSettingsRow, 'Site title', fallbackSettings.siteTitle),
    headerText: text(validSettingsRow, 'Header text'),
    footerText: text(validSettingsRow, 'Footer text', fallbackSettings.footerText),
    joinButtonText: text(validSettingsRow, 'Join button text', fallbackSettings.joinButtonText),
    joinButtonUrl: text(validSettingsRow, 'Join button URL', fallbackSettings.joinButtonUrl),
    headerButtonText: text(validSettingsRow, 'Header button text', text(validSettingsRow, 'Header Button Text', fallbackSettings.headerButtonText)),
    headerButtonUrl: text(validSettingsRow, 'Header Button URL', text(validSettingsRow, 'Header button URL', fallbackSettings.headerButtonUrl)),
    backgroundColour: text(validSettingsRow, 'Background colour', fallbackSettings.backgroundColour),
    surfaceColour: text(validSettingsRow, 'Surface colour', fallbackSettings.surfaceColour),
    primaryColour: text(validSettingsRow, 'Primary colour', fallbackSettings.primaryColour),
    highlightColour: text(validSettingsRow, 'Highlight colour', fallbackSettings.highlightColour),
    borderColour: text(validSettingsRow, 'Border colour', fallbackSettings.borderColour),
    accentColour: text(validSettingsRow, 'Accent colour', fallbackSettings.accentColour),
    eyebrowIcon: fileUrl(validSettingsRow, 'Eyebrow icon', fallbackSettings.eyebrowIcon || ''),
    headerLogo: fileUrl(validSettingsRow, 'Header logo'),
    footerLogo: fileUrl(validSettingsRow, 'Footer logo'),
    contactEmail: text(validSettingsRow, 'Contact email', fallbackSettings.contactEmail),
    tagline: text(validSettingsRow, 'Tagline', fallbackSettings.tagline),
    headerLogoSize: normalized(choice(validSettingsRow, 'Header logo size'), fallbackSettings.headerLogoSize),
    footerLogoSize: normalized(choice(validSettingsRow, 'Footer logo size'), fallbackSettings.footerLogoSize),
    headerHeight: normalized(choice(validSettingsRow, 'Header height'), fallbackSettings.headerHeight),
    footerHeight: normalized(choice(validSettingsRow, 'Footer height'), fallbackSettings.footerHeight),
    navigationTextSize: normalized(choice(validSettingsRow, 'Navigation text size'), fallbackSettings.navigationTextSize),
    buttonTextSize: normalized(choice(validSettingsRow, 'Button text size'), fallbackSettings.buttonTextSize),
    soilAssociationLogo: fileUrl(validSettingsRow, 'Soil Association logo'),
    euOrganicLogo: fileUrl(validSettingsRow, 'EU Organic logo'),
    wildfarmedLogo: fileUrl(validSettingsRow, 'Wildfarmed logo'),
    glutenFreeLogo: fileUrl(validSettingsRow, 'Gluten Free logo'),
    organicFoodFederationLogo: fileUrl(validSettingsRow, 'Organic Food Federation logo'),
    showInvolvementCard: boolean(validSettingsRow, 'Show involvement card', false),
    founder10Badge: fileUrl(validSettingsRow, 'Founder 10 badge'),
    founder25Badge: fileUrl(validSettingsRow, 'Founder 25 badge'),
    founder50Badge: fileUrl(validSettingsRow, 'Founder 50 badge'),
    memberBadge: fileUrl(validSettingsRow, 'Member badge'),
    membershipPerks: (() => {
      const configured = Object.keys(validSettingsRow)
        .map((key) => {
          const match = key.match(/^Perk\s*(\d+)\s*text$/i);
          if (!match) return null;
          const number = match[1];
          const label = text(validSettingsRow, key);
          const unlockWeeks = numeric(validSettingsRow, `Perk ${number} unlock weeks`, 0);
          const explainer = text(validSettingsRow, `Perk ${number} explainer`);
          return label ? { order: Number(number), label, unlockWeeks, explainer } : null;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.unlockWeeks - b.unlockWeeks || a.order - b.order);
      return configured.length ? configured : fallbackSettings.membershipPerks;
    })(),
    bankAccountName: text(validSettingsRow, 'Bank account name', fallbackSettings.bankAccountName),
    bankSortCode: text(validSettingsRow, 'Bank sort code', fallbackSettings.bankSortCode),
    bankAccountNumber: text(validSettingsRow, 'Bank account number', fallbackSettings.bankAccountNumber),
    historicTotalMemberSpending: numeric(validSettingsRow, 'Historic total member spending', 0),
    ordersTemporarilyClosed: boolean(validSettingsRow, 'Orders temporarily closed', false),
    ordersClosedMessage: text(validSettingsRow, 'Orders closed message', 'Orders are currently closed. Please check back when the next market opens.'),
    navigationLinks: Object.keys(validSettingsRow)
      .map((key) => {
        const match = key.match(/^Navigation label\s*(\d+)$/i);
        if (!match) return null;
        const number = match[1];
        const label = text(validSettingsRow, key);
        const url = text(validSettingsRow, `Navigation URL ${number}`);
        return label && url ? { order: Number(number), label, url } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.order - b.order)
  } : fallbackSettings;

  const sourcePages = pageRows?.length ? pageRows : fallbackPages;
  const pages = sourcePages.map((row: any) => normalizePageRow(row)).filter((page: any) => page.slug && page.visible);

  const sourceSections = sectionRows?.length ? sectionRows : fallbackSections;

  // Aggregate Metrics are runtime-only. Static CMS builds never read private Members
  // or Account Transactions merely to resolve public stat tokens.
  const totalNetworkPartners = networkPartnerRows?.length
    ? networkPartnerRows.filter((row: any) => boolean(row, 'Active', true) && text(row, 'Name')).length
    : 0;
  const statTokens: Record<string, string> = {
    '{{members}}': '—',
    '{{total_members}}': '—',
    '{{network_partners}}': totalNetworkPartners ? totalNetworkPartners.toLocaleString('en-GB') : '—',
    '{{member_spending}}': '—',
    '{{total_commitments}}': '—'
  };
  const resolveStatTokens = (value: string) => Object.entries(statTokens)
    .reduce((result, [token, replacement]) => result.replaceAll(token, replacement), value || '');

  const sections = sourceSections.map((row: any) => {
    const groupKey = text(row, 'Group key', row.groupKey || '');
    const explicitType = choice(row, 'Section type', row.type || '');
    const useOriginalCardImages = String(groupKey || '').trim().toLowerCase() === 'how-it-works';
    const image = useOriginalCardImages ? originalFileUrl(row, 'Image', row.image || '') : fileUrl(row, 'Image', row.image || '');
    const image2 = useOriginalCardImages ? originalFileUrl(row, 'Image 2', row.image2 || '') : fileUrl(row, 'Image 2', row.image2 || '');
    const image3 = useOriginalCardImages ? originalFileUrl(row, 'Image 3', row.image3 || '') : fileUrl(row, 'Image 3', row.image3 || '');
    const watermarkImage = fileUrl(row, 'Watermark image', row.watermarkImage || '');
    const icon = fileUrl(row, 'Icon', row.icon || '');
    const eyebrowIcon = fileUrl(row, 'Eyebrow icon', row.eyebrowIcon || '');
    const inferredType = groupKey ? 'Cards' : image ? 'Image and text' : 'Text';
    return {
      id: row.id,
      key: text(row, 'Key', row.key || ''),
      page: linkedValues(raw(row, 'Page') ?? row.page)[0] || text(row, 'Page', row.page || ''),
      body: text(row, 'Body', row.body || ''),
      heading: resolveStatTokens(text(row, 'Heading', row.heading || '')),
      image,
      image2,
      image3,
      watermarkImage,
      icon,
      eyebrowIcon,
      watermarkOpacity: Math.min(100, Math.max(0, numeric(row, 'Watermark opacity', 8))),
      order: numeric(row, 'Order', row.order || 0),
      visible: boolean(row, 'Visible', row.visible ?? true),
      type: explicitType || inferredType,
      eyebrow: text(row, 'Eyebrow'),
      subheading: text(row, 'Subheading'),
      imageAlt: text(row, 'Image alt text'),
      image2Alt: text(row, 'Image 2 alt text'),
      image3Alt: text(row, 'Image 3 alt text'),
      buttonText: text(row, 'Button text'),
      buttonUrl: text(row, 'Button URL'),
      headingSize: normalized(choice(row, 'Heading size'), 'large'),
      subheadingSize: normalized(choice(row, 'Subheading size'), 'medium'),
      bodySize: normalized(choice(row, 'Body size'), 'medium'),
      alignment: normalized(choice(row, 'Alignment'), 'left'),
      headingAlignment: normalized(choice(row, 'Heading alignment'), normalized(choice(row, 'Alignment'), 'left')),
      backgroundStyle: normalized(choice(row, 'Background style'), 'default'),
      columns: Math.min(4, Math.max(1, numeric(row, 'Columns', 3))),
      imageSize: normalized(choice(row, 'Image size'), 'medium'),
      imageFit: normalized(choice(row, 'Image fit'), 'cover'),
      buttonSize: normalized(choice(row, 'Button size'), 'medium'),
      spaceAbove: normalized(choice(row, 'Space above'), 'medium'),
      spaceBelow: normalized(choice(row, 'Space below'), 'medium'),
      productIds: linkedIds(raw(row, 'Products') ?? raw(row, 'Grid source')),
      productNames: linkedValues(raw(row, 'Products') ?? raw(row, 'Grid source')),
      metricIds: linkedIds(raw(row, 'Metrics')),
      metricNames: linkedValues(raw(row, 'Metrics')),
      gridCategory: choice(row, 'Grid category'),
      catalogueCategory: choice(row, 'Catalogue category', text(row, 'Catalogue category')),
      imagePosition: normalized(choice(row, 'Image position'), 'right'),
      buttonVisible: boolean(row, 'Button visible', Boolean(text(row, 'Button text'))),
      groupKey,
      groupHeading: text(row, 'Group heading'),
      countdownDate: text(row, 'Countdown date'),
      preCountdownLabel: text(row, 'Pre-countdown label'),
      preCountdownText: text(row, 'Pre-countdown text'),
      postCountdownText: text(row, 'Post-countdown text'),
      imageCaption: text(row, 'Image caption')
    };
  }).filter((section: any) => section.page && section.visible).sort((a: any, b: any) => a.order - b.order);

  const sourceProducts = productRows?.length ? productRows : fallbackProducts;
  const products = sourceProducts.map((row: any, index: number) => ({
    id: Number(row.id) || index + 1,
    code: text(row, 'Code'),
    size: text(row, 'size', text(row, 'Size')),
    name: text(row, 'Product', text(row, 'Name')),
    producer: text(row, 'Producer'),
    price: text(row, 'Member price', text(row, 'Price')),
    priceNumber: numeric(row, 'Member price', numeric(row, 'Price', 0)),
    sourceValue: numeric(row, 'Source value', 0),
    sourceValueRecipientIds: linkedIds(raw(row, 'Source value recipient')),
    sourceValueRecipientNames: linkedValues(raw(row, 'Source value recipient')),
    sourceValueRecipientId: linkedIds(raw(row, 'Source value recipient'))[0] || null,
    sourceValueRecipientName: linkedValues(raw(row, 'Source value recipient'))[0] || '',
    description: text(row, 'Description'),
    expandedDescription: text(row, 'Expanded description'),
    origin: text(row, 'Origin'),
    cropInfo: text(row, 'Crop info'),
    packagingAndDisposal: text(row, 'Packaging and disposal'),
    nutritionBasis: text(row, 'Nutrition basis', 'Per 100 g'),
    energyKj: raw(row, 'Energy kJ'),
    energyKcal: raw(row, 'Energy kcal'),
    fat: raw(row, 'Fat'),
    saturates: raw(row, 'Saturates'),
    carbohydrate: raw(row, 'Carbohydrate'),
    sugars: raw(row, 'Sugars'),
    fibre: raw(row, 'Fibre'),
    protein: raw(row, 'Protein'),
    salt: raw(row, 'Salt'),
    ingredients: text(row, 'Ingredients'),
    allergens: text(row, 'Allergens'),
    mayContain: text(row, 'May contain'),
    storage: text(row, 'Storage'),
    onceOpened: text(row, 'Once opened'),
    howToCook: text(row, 'How to cook', text(row, 'Suggested uses')),
    packaging: text(row, 'Packaging'),
    disposal: text(row, 'Disposal', text(row, 'Packaging and disposal')),
    fboImporter: text(row, 'FBO / importer', text(row, 'FBO/importer')),
    suggestedUses: text(row, 'Suggested uses'),
    whyWeStockIt: text(row, 'Why we stock it'),
    sourceUrl: text(row, 'Source URL'),
    image: fileLargeUrl(row, 'Image', '/images/placeholder.svg'),
    cardImage: fileCardUrl(row, 'Image', '/images/placeholder.svg'),
    link: text(row, 'Product Link', text(row, 'Link')),
    unitsSold: numeric(row, 'Units sold', 0),
    popularity: numeric(row, 'Popularity', 9999),
    available: boolean(row, 'Available', true),
    availableStock: numeric(row, 'Available stock', 0),
    lowStockThreshold: numeric(row, 'Low stock threshold', 5),
    categories: linkedValues(raw(row, 'Category')).length ? linkedValues(raw(row, 'Category')) : ['Other'],
    category: linkedValues(raw(row, 'Category'))[0] || 'Other',
    subcategories: linkedValues(raw(row, 'Subcategory')).length ? linkedValues(raw(row, 'Subcategory')) : ['Other'],
    subcategory: linkedValues(raw(row, 'Subcategory'))[0] || 'Other',
    producedIn: linkedValues(raw(row, 'Produced in')),
    certifications: linkedValues(raw(row, 'Certification')),
    collectionPointIds: linkedIds(raw(row, 'Available collection points')),
    collectionPointNames: linkedValues(raw(row, 'Available collection points')),
    lateCollection: normalized(choice(row, 'Late collection'), 'thursday-only')
  })).filter((product: any) => product.name && product.available).sort((a: any, b: any) => b.unitsSold - a.unitsSold || a.popularity - b.popularity || a.name.localeCompare(b.name));

  const sourceCollections = collectionRows?.length ? collectionRows : fallbackCollectionPoints;
  const collectionPoints = sourceCollections.map((row: any) => ({
    id: Number(row.id),
    name: text(row, 'Name'),
    address: text(row, 'Address'),
    active: boolean(row, 'Active', true),
    image: originalFileUrl(row, 'Image'),
    link: text(row, 'Link', text(row, 'Website', text(row, 'URL'))),
    description: text(row, 'Description'),
    latitude: (() => { const value = Number(text(row, 'Latitude')); return Number.isFinite(value) ? value : NaN; })(),
    longitude: (() => { const value = Number(text(row, 'Longitude')); return Number.isFinite(value) ? value : NaN; })(),
    collectionTime: cleanCollectionTime(text(row, 'Thursday collection time', text(row, 'Collection time', text(row, 'Collection slot', text(row, 'Collection day/time'))))),
    collectionSlots: [
      { day: 'Thursday', time: cleanCollectionTime(text(row, 'Thursday collection time', text(row, 'Collection time', text(row, 'Collection slot', text(row, 'Collection day/time'))))) },
      { day: 'Friday', time: cleanCollectionTime(text(row, 'Friday collection time')) },
      { day: 'Saturday', time: cleanCollectionTime(text(row, 'Saturday collection time')) },
      { day: 'Sunday', time: cleanCollectionTime(text(row, 'Sunday collection time')) }
    ].filter((slot) => slot.time),
    ordersClose: 'Wednesday 18.00',
    availableCategories: linkedValues(raw(row, 'Available to collect here'))
  })).filter((point: any) => point.name && point.active);

  const networkPartners = (networkPartnerRows || []).map((row: any, index: number) => ({
    id: Number(row.id) || index + 1,
    name: text(row, 'Name'),
    role: linkedValues(raw(row, 'Network role')).length ? linkedValues(raw(row, 'Network role')) : linkedValues(raw(row, 'Role')),
    summary: text(row, 'Summary'),
    longDescription: text(row, 'Long description'),
    howWeWorkTogether: text(row, 'How we work together'),
    priceExplanation: text(row, 'Price explanation'),
    address: text(row, 'Address'),
    latitude: numeric(row, 'Latitude', NaN),
    longitude: numeric(row, 'Longitude', NaN),
    website: text(row, 'Website'),
    volunteerUrl: text(row, 'Volunteer URL'),
    socialUrl: text(row, 'Social URL'),
    offeringText: {
      'Refills': text(row, 'Refills'),
      'Coffee': text(row, 'Coffee'),
      'Evening drinks': text(row, 'Evening drinks'),
      'Workshops': text(row, 'Workshops'),
      'Volunteering': text(row, 'Volunteering'),
      'Pick your Own': text(row, 'Pick your Own'),
      'Social Saturdays': text(row, 'Social Saturdays'),
      "Kid's club": text(row, "Kid's club"),
      'Bees': text(row, 'Bees'),
      'Food bank': text(row, 'Food bank')
    },
    image: originalFileUrl(row, 'Image'),
    image2: originalFileUrl(row, 'Image 2'),
    image3: originalFileUrl(row, 'Image 3'),
    imageAlt: text(row, 'Image alt text'),
    image2Alt: text(row, 'Image 2 alt text'),
    image3Alt: text(row, 'Image 3 alt text'),
    productBadge: originalFileUrl(row, 'Product badge'),
    order: numeric(row, 'Display order', numeric(row, 'Order', 9999)),
    active: boolean(row, 'Active', true)
  })).filter((partner: any) => partner.name && partner.active).sort((a: any, b: any) => a.order - b.order || a.name.localeCompare(b.name));

  const metrics = (metricRows || []).map((row: any, index: number) => {
    const valueText = resolveStatTokens(text(row, 'Value'));
    const displayValue = resolveStatTokens(text(row, 'Display value'));
    const numericText = valueText.replace(/,/g, '').trim();
    const parsedValue = /^-?\d+(?:\.\d+)?$/.test(numericText) ? Number(numericText) : null;
    return {
      id: Number(row.id) || index + 1,
      name: text(row, 'Name'),
      value: parsedValue,
      valueText,
      unit: text(row, 'Unit'),
      displayValue,
      description: text(row, 'Description'),
      icon: fileUrl(row, 'Icon'),
      placements: linkedValues(raw(row, 'Placement')),
      order: numeric(row, 'Display order', numeric(row, 'Order', 9999)),
      active: boolean(row, 'Active', true),
      public: boolean(row, 'Public', true),
      tomTheme: choice(row, 'TOM Theme', text(row, 'TOM theme')),
      tomOutcome: text(row, 'TOM Outcome'),
      tomMeasure: text(row, 'TOM Measure'),
      calcMethod: text(row, 'Calc method'),
      evidenceSource: text(row, 'Evidence / source'),
      lastUpdated: text(row, 'Last updated'),
      networkPartner: linkedValues(raw(row, 'Network Partner') ?? raw(row, 'Network partner'))[0] || ''
    };
  }).filter((metric: any) => metric.name && metric.active && metric.public).sort((a: any, b: any) => a.order - b.order || a.name.localeCompare(b.name));

  const interfaceContent = { ...fallbackInterfaceContent };
  for (const row of interfaceRows || []) {
    const key = text(row, 'Key');
    const content = resolveStatTokens(text(row, 'Content'));
    if (key && content) interfaceContent[key] = content;
  }

  // FAQs are paired by the editor-facing Label field rather than by the legacy Key.
  // This keeps numbering/order, question/answer pairing and URL anchors independent.
  const faqMap = new Map<number, any>();
  for (const row of interfaceRows || []) {
    if (text(row, 'Area').trim().toLowerCase() !== 'faqs') continue;
    const match = text(row, 'Label').trim().match(/^(Question|Answer)\s*(\d+)$/i);
    if (!match) continue;
    const order = Number(match[2]);
    if (!Number.isFinite(order)) continue;
    const item = faqMap.get(order) || { order, question: '', answer: '', questionAnchor: '', answerAnchor: '' };
    const content = resolveStatTokens(text(row, 'Content')).trim();
    const anchor = text(row, 'Anchor').trim().replace(/^#/, '');
    if (match[1].toLowerCase() === 'question') { item.question = content; item.questionAnchor = anchor; }
    else { item.answer = content; item.answerAnchor = anchor; }
    faqMap.set(order, item);
  }

  let faqs = [...faqMap.values()]
    .filter((item) => item.question && item.answer)
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      order: item.order,
      question: item.question,
      answer: item.answer,
      anchor: item.questionAnchor || item.answerAnchor || `faq-${item.order}`
    }));

  if (!faqs.length) {
    faqs = Object.entries(fallbackInterfaceContent)
      .map(([key, value]) => {
        const match = key.match(/^faq\.(\d+)\.question$/i);
        if (!match) return null;
        const number = match[1];
        const order = Number(number);
        const question = String(value || '').trim();
        const answer = String((fallbackInterfaceContent as Record<string, string>)[`faq.${number}.answer`] || '').trim();
        return question && answer ? { order, question, answer, anchor: `faq-${order}` } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.order - b.order);
  }

  return { settings, interfaceContent, faqs, pages, sections, products, collectionPoints, networkPartners, metrics };
}
