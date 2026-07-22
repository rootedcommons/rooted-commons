import { fallbackCollectionPoints, fallbackPages, fallbackProducts, fallbackSections, fallbackSettings } from '../data/fallback';

const API_URL = import.meta.env.BASEROW_API_URL || 'https://api.baserow.io';
const TOKEN = import.meta.env.BASEROW_TOKEN;

const TABLES = {
  settings: import.meta.env.BASEROW_SITE_SETTINGS_TABLE_ID,
  pages: import.meta.env.BASEROW_PAGES_TABLE_ID,
  sections: import.meta.env.BASEROW_SECTIONS_TABLE_ID,
  products: import.meta.env.BASEROW_PRODUCTS_TABLE_ID,
  collectionPoints: import.meta.env.BASEROW_COLLECTION_POINTS_TABLE_ID
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
const fileUrl = (row: Row | undefined, key: string, fallback = '') => {
  const value = raw(row, key);
  if (Array.isArray(value) && value.length) {
    return value[0]?.url || value[0]?.thumbnails?.large?.url || value[0]?.thumbnails?.card_cover?.url || fallback;
  }
  return fallback;
};

async function listRows(tableId?: string): Promise<Row[] | null> {
  if (!TOKEN || !tableId) return null;
  const rows: Row[] = [];
  let page = 1;
  try {
    while (true) {
      const response = await fetch(`${API_URL}/api/database/rows/table/${tableId}/?user_field_names=true&size=200&page=${page}`, {
        headers: { Authorization: `Token ${TOKEN}` }
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


export async function getSiteData() {
  const [settingsRows, pageRows, sectionRows, productRows, collectionRows] = await Promise.all([
    listRows(TABLES.settings),
    listRows(TABLES.pages),
    listRows(TABLES.sections),
    listRows(TABLES.products),
    listRows(TABLES.collectionPoints)
  ]);

  const validSettingsRow = settingsRows?.find((row) => text(row, 'Site title') || fileUrl(row, 'Header logo'));
  const settings = validSettingsRow ? {
    siteTitle: text(validSettingsRow, 'Site title', fallbackSettings.siteTitle),
    headerText: text(validSettingsRow, 'Header text'),
    footerText: text(validSettingsRow, 'Footer text', fallbackSettings.footerText),
    joinButtonText: text(validSettingsRow, 'Join button text', fallbackSettings.joinButtonText),
    joinButtonUrl: text(validSettingsRow, 'Join button URL', fallbackSettings.joinButtonUrl),
    backgroundColour: text(validSettingsRow, 'Background colour', fallbackSettings.backgroundColour),
    primaryColour: text(validSettingsRow, 'Primary colour', fallbackSettings.primaryColour),
    highlightColour: text(validSettingsRow, 'Highlight colour', fallbackSettings.highlightColour),
    borderColour: text(validSettingsRow, 'Border colour', fallbackSettings.borderColour),
    headerLogo: fileUrl(validSettingsRow, 'Header logo'),
    footerLogo: fileUrl(validSettingsRow, 'Footer logo'),
    contactEmail: text(validSettingsRow, 'Contact email', fallbackSettings.contactEmail),
    tagline: text(validSettingsRow, 'Tagline', fallbackSettings.tagline),
    headerLogoSize: normalized(choice(validSettingsRow, 'Header logo size'), fallbackSettings.headerLogoSize),
    footerLogoSize: normalized(choice(validSettingsRow, 'Footer logo size'), fallbackSettings.footerLogoSize),
    headerHeight: normalized(choice(validSettingsRow, 'Header height'), fallbackSettings.headerHeight),
    footerHeight: normalized(choice(validSettingsRow, 'Footer height'), fallbackSettings.footerHeight),
    navigationTextSize: normalized(choice(validSettingsRow, 'Navigation text size'), fallbackSettings.navigationTextSize),
    buttonTextSize: normalized(choice(validSettingsRow, 'Button text size'), fallbackSettings.buttonTextSize)
  } : fallbackSettings;

  const sourcePages = pageRows?.length ? pageRows : fallbackPages;
  const pages = sourcePages.map((row: any) => {
    const heroImage = fileUrl(row, 'Hero image', row.heroImage || '');
    return {
      id: row.id,
      slug: text(row, 'Slug', row.slug),
      title: text(row, 'Title', row.title),
      subtitle: text(row, 'Subtitle', row.subtitle || ''),
      intro: text(row, 'Intro', row.intro || ''),
      buttonText: text(row, 'Button text', row.buttonText || ''),
      buttonUrl: text(row, 'Button URL', row.buttonUrl || ''),
      heroImage,
      visible: boolean(row, 'Visible', row.visible ?? true),
      seoTitle: text(row, 'SEO title', row.seoTitle || ''),
      seoDescription: text(row, 'SEO description', row.seoDescription || ''),
      heroLayout: normalized(choice(row, 'Hero layout'), heroImage ? 'text-left-image-right' : 'text-only'),
      titleSize: normalized(choice(row, 'Title size'), 'large'),
      subtitleSize: normalized(choice(row, 'Subtitle size'), 'medium'),
      introSize: normalized(choice(row, 'Intro size'), 'medium'),
      heroImageHeight: numeric(row, 'Hero image height', 0),
      heroImageFit: normalized(choice(row, 'Hero image fit'), 'cover'),
      heroImageAlignment: normalized(choice(row, 'Hero image alignment'), 'center')
    };
  }).filter((page: any) => page.slug && page.visible);

  const sourceSections = sectionRows?.length ? sectionRows : fallbackSections;
  const sections = sourceSections.map((row: any) => {
    const groupKey = text(row, 'Group key', row.groupKey || '');
    const explicitType = choice(row, 'Section type', row.type || '');
    const image = fileUrl(row, 'Image', row.image || '');
    const inferredType = groupKey ? 'Cards' : image ? 'Image and text' : 'Text';
    return {
      id: row.id,
      key: text(row, 'Key', row.key || ''),
      page: linkedValues(raw(row, 'Page') ?? row.page)[0] || text(row, 'Page', row.page || ''),
      body: text(row, 'Body', row.body || ''),
      heading: text(row, 'Heading', row.heading || ''),
      image,
      order: numeric(row, 'Order', row.order || 0),
      visible: boolean(row, 'Visible', row.visible ?? true),
      type: explicitType || inferredType,
      eyebrow: text(row, 'Eyebrow'),
      subheading: text(row, 'Subheading'),
      imageAlt: text(row, 'Image alt text'),
      buttonText: text(row, 'Button text'),
      buttonUrl: text(row, 'Button URL'),
      headingSize: normalized(choice(row, 'Heading size'), 'large'),
      subheadingSize: normalized(choice(row, 'Subheading size'), 'medium'),
      bodySize: normalized(choice(row, 'Body size'), 'medium'),
      alignment: normalized(choice(row, 'Alignment'), 'left'),
      backgroundStyle: normalized(choice(row, 'Background style'), 'default'),
      columns: Math.min(4, Math.max(1, numeric(row, 'Columns', 3))),
      imageSize: normalized(choice(row, 'Image size'), 'medium'),
      imageFit: normalized(choice(row, 'Image fit'), 'cover'),
      buttonSize: normalized(choice(row, 'Button size'), 'medium'),
      spaceAbove: normalized(choice(row, 'Space above'), 'medium'),
      spaceBelow: normalized(choice(row, 'Space below'), 'medium'),
      gridSource: choice(row, 'Grid source'),
      gridCategory: choice(row, 'Grid category'),
      imagePosition: normalized(choice(row, 'Image position'), 'right'),
      buttonVisible: boolean(row, 'Button visible', Boolean(text(row, 'Button text'))),
      groupKey,
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
    description: text(row, 'Description'),
    image: fileUrl(row, 'Image', '/images/placeholder.svg'),
    link: text(row, 'Product Link', text(row, 'Link')),
    order: numeric(row, 'Display order', numeric(row, 'Order', 9999)),
    available: boolean(row, 'Available', true),
    category: choice(row, 'Category', 'Other') || 'Other',
    collectionPointIds: linkedIds(raw(row, 'Available collection points')),
    collectionPointNames: linkedValues(raw(row, 'Available collection points'))
  })).filter((product: any) => product.name && product.available).sort((a: any, b: any) => a.order - b.order || a.name.localeCompare(b.name));

  const sourceCollections = collectionRows?.length ? collectionRows : fallbackCollectionPoints;
  const collectionPoints = sourceCollections.map((row: any) => ({
    id: Number(row.id),
    name: text(row, 'Name'),
    address: text(row, 'Address'),
    active: boolean(row, 'Active', true)
  })).filter((point: any) => point.name && point.active);

  return { settings, pages, sections, products, collectionPoints };
}
