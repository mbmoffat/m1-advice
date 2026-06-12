// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://advice.mortgageonefinance.co.uk',
  trailingSlash: 'never',
  integrations: [
    sitemap({
      serialize(item) {
        item.url = item.url.replace(/\/$/, '');
        return item;
      },
      filter: (page) => !/\/thank-you\/?$/.test(page),
    }),
  ],
});
