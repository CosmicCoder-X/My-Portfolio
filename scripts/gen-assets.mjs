/**
 * Regenerates the raster brand assets from their SVG sources.
 *
 *   node scripts/gen-assets.mjs
 *
 * Outputs are committed to public/, so this only needs re-running when
 * you edit assets/og.svg or public/favicon.svg. Not part of the build:
 * Cloudflare Pages never runs it.
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
const src = join(root, 'assets/portrait-source.png');
if (existsSync(src)) {
  const { data, info } = await sharp(src)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const px = width * height;

  // Ink tone, matching --ink in global.css. Keep these in sync by hand —
  // this runs outside the build and has no access to the CSS custom
  // property.
  const [r, g, b] = [0x25, 0x28, 0x30];

  // Flood-fill the jacket's enclosed cells (the diamond quilting, the
  // collar) to solid ink — plain line art reads as a soft pencil sketch;
  // filled shapes read as a graphic illustration. Confined to a box
  // over the jacket so it can never touch the face or hair, and capped
  // by component size so a gap in the linework can leak into at most
  // one small cell rather than the whole background.
  const JACKET_BOX = { x0: 250, y0: 480, x1: 1100, y1: height };
  const WALL = 235; // grey below this = ink stroke, blocks the fill
  const MIN_CELL = 25;
  const MAX_CELL = 60000;

  const isWall = (x, y) => data[y * width + x] < WALL;
  const idx = (x, y) => y * width + x;
  const visited = new Uint8Array(px);
  const fillMask = new Uint8Array(px);

  for (let y = JACKET_BOX.y0; y < JACKET_BOX.y1; y++) {
    for (let x = JACKET_BOX.x0; x < JACKET_BOX.x1; x++) {
      const i = idx(x, y);
      if (visited[i] || isWall(x, y)) continue;

      const queue = [i];
      visited[i] = 1;
      const members = [i];
      let leaked = false;

      while (queue.length) {
        const cur = queue.pop();
        const cx = cur % width;
        const cy = (cur - cx) / width;

        if (cx <= JACKET_BOX.x0 || cx >= JACKET_BOX.x1 - 1 || cy <= JACKET_BOX.y0 || cy >= JACKET_BOX.y1 - 1) {
          leaked = true;
        }

        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
          if (nx < JACKET_BOX.x0 || nx >= JACKET_BOX.x1 || ny < JACKET_BOX.y0 || ny >= JACKET_BOX.y1) continue;
          const ni = idx(nx, ny);
          if (visited[ni] || isWall(nx, ny)) continue;
          visited[ni] = 1;
          queue.push(ni);
          members.push(ni);
        }
        if (members.length > MAX_CELL) { leaked = true; break; }
      }

      if (!leaked && members.length >= MIN_CELL && members.length <= MAX_CELL) {
        for (const m of members) fillMask[m] = 1;
      }
    }
  }

  const out = Buffer.alloc(px * 4);
  for (let i = 0; i < px; i++) {
    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;

    if (fillMask[i]) {
      out[o + 3] = 255;
      continue;
    }

    // 255 = paper, 0 = ink. Bolder ramp than a plain darkness->alpha
    // copy: pushes mid-tone strokes toward full opacity faster, so the
    // line work reads as bold ink rather than a soft pencil sketch.
    let a = 255 - data[i];
    a = Math.round((a - 8) * 1.55);
    a = a < 0 ? 0 : a > 255 ? 255 : a;
    out[o + 3] = a;
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(join(pub, 'portrait.png'));

  console.log(`Wrote portrait.png (${width}x${height}, bold ink + jacket fill)`);
}

console.log('Wrote og.png, apple-touch-icon.png, favicon-32.png');
