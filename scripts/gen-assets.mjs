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
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
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

// ── Hero illustration ────────────────────────────────────────
// The source is line art on a near-white paper ground. Compositing it
// with mix-blend-mode does not work: any `filter` on the element makes
// its own stacking context, so the blend is dropped and you get a white
// rectangle on the cream. Instead, bake a real alpha channel — darkness
// becomes opacity — so the strokes composite correctly on any ground.
const src = join(root, 'assets/portrait-source.jpg');
if (existsSync(src)) {
  const { data, info } = await sharp(src)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = info.width * info.height;
  const out = Buffer.alloc(px * 4);

  // Ink tone, matching --ink. Alpha is driven by how dark the source
  // pixel is, which keeps the antialiasing on every stroke.
  const [r, g, b] = [0x14, 0x12, 0x0f];

  for (let i = 0; i < px; i++) {
    // 255 = paper, 0 = ink.
    let a = 255 - data[i];
    // Lift the paper texture to fully transparent and push the strokes
    // to fully opaque, keeping the ramp between them smooth.
    a = Math.round((a - 12) * 1.35);
    a = a < 0 ? 0 : a > 255 ? 255 : a;

    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = a;
  }

  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(join(pub, 'portrait.png'));

  console.log(`Wrote portrait.png (${info.width}x${info.height}, alpha cut)`);
}

console.log('Wrote og.png, apple-touch-icon.png, favicon-32.png');
