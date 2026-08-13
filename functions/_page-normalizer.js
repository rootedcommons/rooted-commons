const keyToken = (value='') => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const rawValue = (row={}, ...keys) => {
  for (const key of keys) {
    if (key in row) return row[key];
    const wanted = keyToken(key);
    const actual = Object.keys(row).find((candidate) => keyToken(candidate) === wanted);
    if (actual) return row[actual];
  }
  return undefined;
};

const unwrapValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map((item) => unwrapValue(item?.value ?? item?.name ?? item)).filter(Boolean).join(', ');
  if (typeof value === 'object') return unwrapValue(value.value ?? value.name ?? value.text ?? value.plain_text);
  return '';
};

const textValue = (row, keys, fallback='') => {
  const value = unwrapValue(rawValue(row, ...keys));
  return value || fallback;
};

const booleanValue = (row, keys, fallback=true) => {
  const value = rawValue(row, ...keys);
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return !['false','0','no','off'].includes(String(value).toLowerCase());
};

const fileValue = (row, keys, fallback='') => {
  const value = rawValue(row, ...keys);
  if (Array.isArray(value) && value.length) return value[0]?.url || value[0]?.thumbnails?.large?.url || value[0]?.thumbnails?.card_cover?.url || fallback;
  if (typeof value === 'object' && value) return value.url || value?.thumbnails?.large?.url || fallback;
  if (typeof value === 'string') return value || fallback;
  return fallback;
};

export const normalizeCmsChoice = (value, fallback='') => {
  const result = (unwrapValue(value) || fallback).trim().toLowerCase().replace(/\s+/g, '-').replace('centre','center');
  return result;
};

const normalizeHeroFit = (value) => ['show-whole-image','contain'].includes(normalizeCmsChoice(value,'fill-frame')) ? 'contain' : 'cover';
const normalizeHeroWidth = (value) => {
  const result = normalizeCmsChoice(value,'standard');
  return result === 'normal' || result === 'medium' ? 'standard' : result;
};
const normalizeHeroImageAlignment = (value) => {
  const result = normalizeCmsChoice(value,'centre');
  const aliases = {left:'center-left',right:'center-right',top:'top-center',bottom:'bottom-center','top-center':'top-center','center-left':'center-left','center-right':'center-right','bottom-center':'bottom-center'};
  return aliases[result] || result;
};

/** Canonical Pages row used by the Astro build. CMS page changes now publish on redeploy rather than through a client hydrator. */
export function normalizePageRow(row={}) {
  const slug = textValue(row,['Slug','slug']);
  const heroImage = fileValue(row,['Hero image','heroImage']);
  const heroAlignment = normalizeCmsChoice(textValue(row,['Hero alignment','heroAlignment']),'left');
  return {
    id: Number(row.id) || row.id,
    slug,
    title: textValue(row,['Title','title']),
    subtitle: textValue(row,['Subtitle','subtitle']),
    intro: textValue(row,['Intro','intro']),
    buttonText: textValue(row,['Button text','buttonText']),
    buttonUrl: textValue(row,['Button URL','buttonUrl']),
    heroImage,
    visible: booleanValue(row,['Visible','visible'],true),
    seoTitle: textValue(row,['SEO title','seoTitle']),
    seoDescription: textValue(row,['SEO description','seoDescription']),
    heroLayout: normalizeCmsChoice(textValue(row,['Hero layout','heroLayout']), heroImage ? 'text-left' : 'text-only'),
    heroAlignment,
    heroHeadingAlignment: normalizeCmsChoice(textValue(row,['Hero heading alignment','heroHeadingAlignment']), slug === 'home' ? 'center' : heroAlignment),
    heroPadding: normalizeCmsChoice(textValue(row,['Hero padding','heroPadding']),'normal'),
    heroWidth: normalizeHeroWidth(textValue(row,['Hero width','heroWidth'])),
    heroSplit: normalizeCmsChoice(textValue(row,['Hero split','heroSplit']),'50-50').replace(':','-'),
    heroGap: normalizeCmsChoice(textValue(row,['Hero gap','heroGap']),'normal'),
    heroButtonSize: normalizeCmsChoice(textValue(row,['Hero button size','heroButtonSize']),'medium'),
    titleSize: normalizeCmsChoice(textValue(row,['Title size','titleSize']),'large'),
    subtitleSize: normalizeCmsChoice(textValue(row,['Subtitle size','subtitleSize']),'medium'),
    introSize: normalizeCmsChoice(textValue(row,['Intro size','introSize']),'medium'),
    heroImageShape: normalizeCmsChoice(textValue(row,['Hero image shape','heroImageShape']),'landscape'),
    heroImageFit: normalizeHeroFit(textValue(row,['Hero image fit','heroImageFit'])),
    heroImageAlignment: normalizeHeroImageAlignment(textValue(row,['Hero image alignment','heroImageAlignment']))
  };
}
