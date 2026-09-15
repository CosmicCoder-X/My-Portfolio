// One-off: shrink public/writeups/**/*.png in place (same filename, same
// extension — no markdown edits needed). Screenshots are displayed in a
// ~640-740px article column, so a 1400px cap covers 2x retina with room
// to spare; palette quantization keeps text fully crisp while cutting
// the lossless-PNG noise that was bloating these files.
import { readdirSync, statSync, renameSync } from 'node:fs';
import { join, extname } from 'node:path';
import sharp from 'sharp';

const root = join(process.cwd(), 'public', 'writeups');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (extname(entry.name).toLowerCase() === '.png') out.push(p);
  }
  return out;
}

const files = walk(root);
let totalBefore = 0;
let totalAfter = 0;
let changed = 0;

for (const src of files) {
  const before = statSync(src).size;
  const tmp = src + '.tmp';

  await sharp(src)
    .resize({ width: 1400, withoutEnlargement: true })
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(tmp);

  const after = statSync(tmp).size;
  totalBefore += before;

  if (after < before) {
    renameSync(tmp, src);
    totalAfter += after;
    changed++;
    if (before - after > 20_000) {
      console.log(`${src.slice(root.length)}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`);
    }
  } else {
    // Recompression made it bigger (already-optimized small file) — keep original.
    (await import('node:fs')).unlinkSync(tmp);
    totalAfter += before;
  }
}

console.log(`\n${files.length} files, ${changed} shrunk.`);
console.log(`Total: ${(totalBefore / 1024 / 1024).toFixed(1)}MB -> ${(totalAfter / 1024 / 1024).toFixed(1)}MB`);
