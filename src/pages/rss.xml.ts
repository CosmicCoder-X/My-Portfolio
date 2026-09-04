import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { person } from '../data/site';

// Hand-rolled rather than pulling in a dependency — the feed is four
// fields per item and the escaping is the only part that matters.
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const GET: APIRoute = async ({ site }) => {
  const base = site?.toString().replace(/\/$/, '') ?? 'https://divyansh404.xyz';

  const writeups = (await getCollection('writeups', ({ data }) => !data.draft)).map((w) => ({
    title: w.data.title,
    link: `${base}/writeups/${w.id}/`,
    date: w.data.date,
    summary: w.data.summary,
    category: 'Writeup',
  }));

  const posts = (await getCollection('blog', ({ data }) => !data.draft)).map((p) => ({
    title: p.data.title,
    link: `${base}/blog/${p.id}/`,
    date: p.data.date,
    summary: p.data.summary,
    category: 'Blog',
  }));

  const items = [...writeups, ...posts]
    .sort((a, b) => b.date.valueOf() - a.date.valueOf())
    .slice(0, 50);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(person.name)} — writeups &amp; notes</title>
    <link>${base}/</link>
    <description>${esc(person.tagline)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml" />
${items
  .map(
    (i) => `    <item>
      <title>${esc(i.title)}</title>
      <link>${esc(i.link)}</link>
      <guid isPermaLink="true">${esc(i.link)}</guid>
      <pubDate>${i.date.toUTCString()}</pubDate>
      <category>${esc(i.category)}</category>
      <description>${esc(i.summary)}</description>
    </item>`,
  )
  .join('\n')}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
