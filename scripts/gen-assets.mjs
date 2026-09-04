/**
 * Regenerates the raster brand assets from their SVG sources.
 *
 *   node scripts/gen-assets.mjs
 *
 * Outputs are committed to public/, so this only needs re-running when
 * you edit assets/og.svg or public/favicon.svg. Not part of the build —
 * Netlify never runs it.
 *
 * Uses the `sharp` that ships with Astro's image pipeline.
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
mkdirSync(pub, { recursive: true });

// ── Social preview card ──────────────────────────────────────
const og = readFileSync(join(root, 'assets/og.svg'));
await sharp(og, { density: 144 })
  .resize(1200, 630, { fit: 'fill' })
  .png({ compressionLevel: 9 })
  .toFile(join(pub, 'og.png'));

// ── Icons ────────────────────────────────────────────────────
const favicon = readFileSync(join(pub, 'favicon.svg'));

await sharp(favicon, { density: 600 })
  .resize(180, 180)
  .png({ compressionLevel: 9 })
  .toFile(join(pub, 'apple-touch-icon.png'));

await sharp(favicon, { density: 600 })
  .resize(32, 32)
  .png({ compressionLevel: 9 })
  .toFile(join(pub, 'favicon-32.png'));

console.log('Wrote og.png, apple-touch-icon.png, favicon-32.png');
