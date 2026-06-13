// prebuild.mjs — runs before `astro build`.
//  (a) FORM_ENDPOINT must be the approved FormSubmit email endpoint or a hashed token.
//  (b) every file in locked-manifest.json must exist and its sha256 must match.
//  (c) no working-tree file may contain a high-signal secret, and no .env file may be committed.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
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

// (c) secret-leak scan over working-tree files. High-signal patterns only, to
// stay false-positive free on normal code. Secret values are never printed.
const SECRET_PATTERNS = [
  { name: 'OpenAI-style secret key', re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'GitHub token', re: /\bgh[posru]_[A-Za-z0-9]{30,}\b/ },
  { name: 'AWS access key id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'private key block', re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/ },
];
const SECRET_SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', '.git']);
const SECRET_SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.avif', '.ico', '.gif',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.pdf', '.zip',
]);

function secretWalk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SECRET_SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) secretWalk(full, out);
    else out.push(full);
  }
  return out;
}

const secretFindings = [];
for (const full of secretWalk(ROOT, [])) {
  const base = full.slice(full.lastIndexOf('/') + 1);
  const rel = full.slice(ROOT.length);
  if (base === '.env' || base.startsWith('.env.')) {
    secretFindings.push(`environment file committed: ${rel}`);
    continue;
  }
  const dot = base.lastIndexOf('.');
  const ext = dot === -1 ? '' : base.slice(dot).toLowerCase();
  if (SECRET_SKIP_EXT.has(ext)) continue;
  let content;
  try {
    content = readFileSync(full, 'utf8');
  } catch {
    continue;
  }
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(content)) secretFindings.push(`possible ${name} in ${rel}`);
  }
}
if (secretFindings.length) {
  fail('secret scan tripped (remove secrets, never commit them):\n  - ' + secretFindings.join('\n  - '));
}

console.log('prebuild guard passed: FORM_ENDPOINT valid, locked files match manifest, no secrets detected.');
