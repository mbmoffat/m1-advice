// One-off: resize the M1 favicon source into the PNG sizes the site needs.
// Resize only — no recolour, crop or other alteration.
import sharp from 'sharp';

const SRC = '/tmp/m1favicon.webp';
const targets = [
  { out: 'public/favicon-16.png', size: 16 },
  { out: 'public/favicon-32.png', size: 32 },
  { out: 'public/apple-touch-icon.png', size: 180 },
];

for (const { out, size } of targets) {
  await sharp(SRC).resize(size, size).png().toFile(out);
  console.log(`wrote ${out} (${size}x${size})`);
}
