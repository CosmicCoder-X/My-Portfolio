/**
 * One-off: rasterize certificate PDFs to PNG for the cert gallery.
 *
 * Not part of the build — run manually when a new PDF certificate needs
 * converting:
 *
 *   node scripts/pdf-to-png.mjs "<path to pdf>" "<output png path>" [dpi]
 *
 * Uses pdfjs-dist (legacy Node build) + @napi-rs/canvas, both installed
 * as one-off devDependencies (`npm install --no-save pdfjs-dist
 * @napi-rs/canvas`) — sharp's bundled libvips has no PDF support, and
 * headless Chrome's screenshot path does not paint its PDF viewer
 * plugin, so neither of the tools already in this repo could do this.
 */
import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pdfjsRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'pdfjs-dist');

const [, , inPath, outPath, dpiArg] = process.argv;
if (!inPath || !outPath) {
  console.error('Usage: node scripts/pdf-to-png.mjs <in.pdf> <out.png> [dpi]');
  process.exit(1);
}

const dpi = Number(dpiArg) || 200;
const scale = dpi / 72;

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const data = new Uint8Array(readFileSync(inPath));
const doc = await pdfjs.getDocument({
  data,
  isEvalSupported: false,
  // Without these, a PDF that references a standard (non-embedded) font
  // silently fails to shape text and glyphs render as fragments of the
  // wrong character — it does not throw, so the first sign is a corrupt
  // image. Both directories ship inside the pdfjs-dist package itself.
  standardFontDataUrl: `${join(pdfjsRoot, 'standard_fonts')}/`.replace(/\\/g, '/'),
  cMapUrl: `${join(pdfjsRoot, 'cmaps')}/`.replace(/\\/g, '/'),
  cMapPacked: true,
}).promise;
const page = await doc.getPage(1);
const viewport = page.getViewport({ scale });

const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
const ctx = canvas.getContext('2d');

await page.render({ canvasContext: ctx, viewport }).promise;

mkdirSync(dirname(outPath), { recursive: true });
const png = canvas.toBuffer('image/png');
(await import('node:fs')).writeFileSync(outPath, png);

console.log(`${inPath} -> ${outPath} (${canvas.width}x${canvas.height} @ ${dpi}dpi)`);
