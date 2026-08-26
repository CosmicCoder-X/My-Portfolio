// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://divyansh404.xyz',
  markdown: {
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
});
