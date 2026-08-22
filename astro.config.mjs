import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const noIndexPaths = new Set([
  '/404/',
  '/account/',
  '/checkout/',
  '/contact/',
  '/dashboard/',
  '/membership-terms/',
  '/order/',
  '/privacy/',
  '/signin/',
  '/signup/',
  '/terms-of-sale/'
]);

export default defineConfig({
  site: 'https://rootedcommons.uk',
  integrations: [sitemap({
    filter: (page) => !noIndexPaths.has(new URL(page, 'https://rootedcommons.uk').pathname)
  })],
  output: 'static',
  trailingSlash: 'always'
});
