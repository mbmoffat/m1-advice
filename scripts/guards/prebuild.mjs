// prebuild.mjs — runs before `astro build`.
//  (a) FORM_ENDPOINT must be the approved FormSubmit email endpoint or a hashed token.
//  (b) every file in locked-manifest.json must exist and its sha256 must match.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function fail(msg) {
  console.error(`prebuild guard failed: ${msg}`);
  process.exit(1);
}

// (a) FORM_ENDPOINT shape
const formSrc = readFileSync(join(ROOT, 'src/config/form.ts'), 'utf8');
const m = formSrc.match(/FORM_ENDPOINT\s*=\s*'([^']+)'/);
if (!m) fail('could not find FORM_ENDPOINT in src/config/form.ts');
const endpoint = m[1];
const ENDPOINT_RE = /^https:\/\/formsubmit\.co\/(enquiry@mortgageonefinance\.co\.uk|[a-f0-9]{16,})$/;
if (!ENDPOINT_RE.test(endpoint)) {
  fail(`FORM_ENDPOINT in src/config/form.ts is "${endpoint}" which does not match the approved pattern ${ENDPOINT_RE}`);
}

// (b) locked manifest integrity
const MANIFEST = join(ROOT, 'scripts/guards/locked-manifest.json');
if (!existsSync(MANIFEST)) fail('scripts/guards/locked-manifest.json is missing — run npm run lock');

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
} catch (e) {
  fail(`could not parse scripts/guards/locked-manifest.json: ${e.message}`);
}

for (const [rel, expected] of Object.entries(manifest)) {
  const full = join(ROOT, rel);
  if (!existsSync(full)) fail(`locked file is missing: ${rel}`);
  const actual = createHash('sha256').update(readFileSync(full)).digest('hex');
  if (actual !== expected) {
    fail(`locked file changed without re-locking: ${rel}\n  expected sha256 ${expected}\n  actual   sha256 ${actual}\n  If this change is intentional and human-approved, run npm run lock.`);
  }
}

console.log('prebuild guard passed: FORM_ENDPOINT valid and all locked files match manifest.');
