import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://rootedcommons.uk',
  integrations: [sitemap()],
  output: 'static',
  trailingSlash: 'always'
});
