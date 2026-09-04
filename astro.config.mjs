// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { rehypeArticle } from './src/lib/rehype-article.mjs';

export default defineConfig({
  site: 'https://divyansh404.xyz',

  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
  ],

  markdown: {
    shikiConfig: {
      // Light theme to match the cream ground; `wrap` keeps long
      // command lines readable instead of forcing a scrollbar.
      theme: 'github-light',
      wrap: true,
    },
    rehypePlugins: [rehypeArticle],
  },

  build: {
    // Trailing-slash-consistent output; matches every internal link.
    format: 'directory',
  },

  vite: {
    build: {
      // Astro inlines small module scripts into the HTML by default,
      // which would force 'unsafe-inline' into the CSP in netlify.toml.
      // Emitting them as files keeps script-src at 'self'.
      assetsInlineLimit: 0,
    },
  },
});
