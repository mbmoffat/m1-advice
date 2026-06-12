// lock.mjs — writes scripts/guards/locked-manifest.json with sha256 of every
// locked file. Run after any human edit to a locked file.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MANIFEST = join(ROOT, 'scripts/guards/locked-manifest.json');

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const explicit = [
  'CLAUDE.md',
  'vercel.json',
  'astro.config.mjs',
  'src/config/site.ts',
  'src/config/form.ts',
];

const files = new Set();
for (const rel of explicit) {
  const full = join(ROOT, rel);
  if (!existsSync(full)) {
    console.error(`lock: expected locked file is missing: ${rel}`);
    process.exit(1);
  }
  files.add(full);
}
for (const f of walk(join(ROOT, 'src/components/locked'))) files.add(f);
for (const f of walk(join(ROOT, 'scripts/guards'))) {
  if (f === MANIFEST) continue; // never hash the manifest itself
  files.add(f);
}

const manifest = {};
for (const full of [...files].sort()) {
  const rel = relative(ROOT, full).split(sep).join('/');
  const hash = createHash('sha256').update(readFileSync(full)).digest('hex');
  manifest[rel] = hash;
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`lock: wrote ${Object.keys(manifest).length} hashes to scripts/guards/locked-manifest.json`);
