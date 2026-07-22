export const fallbackSettings = {
  siteTitle: 'Rooted Commons',
  headerText: '',
  footerText: 'Rooted Commons is a pilot project operated by Roots to Fruits CIC.',
  joinButtonText: 'Join our growing network',
  joinButtonUrl: '/volunteering/',
  backgroundColour: '#ded8cc',
  primaryColour: '#5a2d4d',
  highlightColour: '#eef3ea',
  borderColour: '#c8c6b1',
  headerLogo: '',
  footerLogo: '',
  contactEmail: 'info@rootedcommons.uk',
  tagline: 'An experiment in community wealth building, bringing together local producers, retailers and residents.',
  headerLogoSize: 'medium',
  footerLogoSize: 'medium',
  headerHeight: 'medium',
  footerHeight: 'medium',
  navigationTextSize: 'medium',
  buttonTextSize: 'medium'
};

export const fallbackPages = [
  { slug: 'home', title: 'Rooted Commons', intro: 'Get fresh, local produce and organic cupboard staples at wholesale-to-community prices, while helping build the infrastructure local producers need to thrive.', visible: true },
  { slug: 'our-partners', title: 'Our Partners', intro: 'Rooted Commons depends on growers, retailers, volunteers and residents working together.', visible: true },
  { slug: 'cupboard-staples', title: 'Cupboard Staples', intro: 'Affordable organic staples make it possible to shift a small, dependable share of weekly spending into the local food economy.', visible: true },
  { slug: 'fresh-produce', title: 'Fresh Produce', intro: 'Seasonal produce grown by people and organisations in our local network, coordinated through shared distribution.', visible: true },
  { slug: 'volunteering', title: 'Get Involved', intro: 'Learn, spend time outdoors and support the people building a stronger local food system.', visible: true }
];

export const fallbackSections = [
  { key: 'how-1', page: 'home', heading: '1. Move £10 a week from your supermarket shop to us', body: 'Become a member and commit to a weekly BACS payment of £10 or more. Unspent credit rolls over and payments can be paused for holidays.', order: 10, visible: true, type: 'Cards', groupKey: 'how-it-works' },
  { key: 'how-2', page: 'home', heading: '2. Buy local produce and organic cupboard staples at fair prices', body: 'Members receive a weekly order form with cupboard staples and local seasonal produce.', order: 20, visible: true, type: 'Cards', groupKey: 'how-it-works' },
  { key: 'how-3', page: 'home', heading: '3. Collect from your nearest pick-up point', body: 'Local producers, volunteers and retailers coordinate harvesting, packing and deliveries.', order: 30, visible: true, type: 'Cards', groupKey: 'how-it-works' }
];

export const fallbackProducts = [];
export const fallbackCollectionPoints = [];
