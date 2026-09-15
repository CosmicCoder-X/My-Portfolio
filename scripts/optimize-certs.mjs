// One-off: re-encode public/certifications/*.png as compressed .jpg
// to cut View Transitions snapshot cost on the certifications page.
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

const dir = join(process.cwd(), 'public', 'certifications');
const files = readdirSync(dir).filter((f) => extname(f).toLowerCase() === '.png');

let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const src = join(dir, file);
  const before = statSync(src).size;
  const outName = basename(file, extname(file)) + '.jpg';
  const out = join(dir, outName);

  await sharp(src)
    .resize({ width: 2000, withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(out);

  const after = statSync(out).size;
  totalBefore += before;
  totalAfter += after;
  unlinkSync(src);

  console.log(`${file} -> ${outName}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`);
}

console.log(`\nTotal: ${(totalBefore / 1024 / 1024).toFixed(2)}MB -> ${(totalAfter / 1024 / 1024).toFixed(2)}MB`);
