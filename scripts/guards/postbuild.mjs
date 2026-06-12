// postbuild.mjs — runs against dist/ only, after `astro build`.
// G1 every form action equals FORM_ENDPOINT.
// G2 only the approved email and phone may appear in visible text / tel / mailto.
// G3 pathname, <title> and every <h1> must not contain a forbidden topic.
// G5 every anchor inside <main> points only to an approved destination.
// G6 every FAQPage question name must appear in the page's visible text.
// G7 every internal href resolves to a built file, with no trailing slash and no index.html.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIST = join(ROOT, 'dist');

const failures = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);

// --- approved values ---
const formSrc = readFileSync(join(ROOT, 'src/config/form.ts'), 'utf8');
const FORM_ENDPOINT = formSrc.match(/FORM_ENDPOINT\s*=\s*'([^']+)'/)?.[1];

const siteSrc = readFileSync(join(ROOT, 'src/config/site.ts'), 'utf8');
const QUILTER = siteSrc.match(/privacyNotice:\s*'([^']+)'/)?.[1];
const TRUSTPILOT = siteSrc.match(/trustpilot:\s*'([^']+)'/)?.[1];

const HOST = 'https://advice.mortgageonefinance.co.uk';
const WWW = 'https://www.mortgageonefinance.co.uk';
const TEL = 'tel:+441202155992';
const MAILTO = 'mailto:enquiry@mortgageonefinance.co.uk';
const APPROVED_EMAIL = 'enquiry@mortgageonefinance.co.uk';
const APPROVED_PHONES = new Set(['01202155992', '441202155992']);
const FORBIDDEN = /\b(iva|ccj|dmp|debt management|bankrupt|bankruptcy|bad credit|defaults?|benefits?)\b/;

if (!FORM_ENDPOINT) fail('src/config/form.ts', 'could not read FORM_ENDPOINT');
if (!QUILTER) fail('src/config/site.ts', 'could not read privacyNotice');

// --- helpers ---
function walkHtml(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkHtml(full));
    else if (full.endsWith('.html')) out.push(full);
  }
  return out;
}

function decodeEntities(s) {
  return s
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function visibleText(html) {
  const noScript = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  return decodeEntities(noScript.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function norm(s) {
  return decodeEntities(s).replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalisePhone(s) {
  let digits = s.replace(/\D/g, '');
  if (digits.startsWith('440')) digits = '44' + digits.slice(3); // strip +44 (0) trunk zero
  return digits;
}

function pathnameFor(file) {
  const rel = relative(DIST, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'/index.html'.length);
  if (rel.endsWith('.html')) return '/' + rel.slice(0, -'.html'.length);
  return '/' + rel;
}

function mainOf(html) {
  const m = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  return m ? m[1] : '';
}

function attrsValues(html, attr) {
  const re = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

// hrefs from <a> tags only — navigational links, not stylesheet/preconnect assets.
function anchorHrefs(html) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*\shref\s*=\s*["']([^"']*)["'][^>]*>/gi)) out.push(m[1]);
  return out;
}

function targetExists(pathPart) {
  if (pathPart === '/' || pathPart === '') return existsSync(join(DIST, 'index.html'));
  const clean = pathPart.replace(/^\//, '');
  return existsSync(join(DIST, clean, 'index.html')) || existsSync(join(DIST, clean + '.html'));
}

// --- run ---
const files = walkHtml(DIST);
if (files.length === 0) fail('dist', 'no HTML files found — did the build run?');

for (const file of files) {
  const rel = relative(DIST, file).split(sep).join('/');
  const html = readFileSync(file, 'utf8');
  const visible = visibleText(html);
  const main = mainOf(html);

  // G1 — form actions
  const forms = html.match(/<form\b[^>]*>/gi) || [];
  for (const f of forms) {
    const action = f.match(/action\s*=\s*["']([^"']*)["']/i)?.[1];
    if (action !== FORM_ENDPOINT) {
      fail(rel, `G1 form action "${action ?? '(none)'}" does not equal FORM_ENDPOINT "${FORM_ENDPOINT}"`);
    }
  }

  // G2 — emails and phones
  const emails = new Set();
  for (const e of visible.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []) emails.add(e.toLowerCase());
  for (const h of attrsValues(html, 'href')) {
    if (/^mailto:/i.test(h)) emails.add(h.slice(7).split('?')[0].toLowerCase());
  }
  for (const e of emails) {
    if (e !== APPROVED_EMAIL) fail(rel, `G2 disallowed email "${e}" (only ${APPROVED_EMAIL} permitted)`);
  }

  const phones = new Set();
  for (const p of visible.match(/\+?\d[\d\s().-]{7,}\d/g) || []) phones.add(p);
  for (const h of attrsValues(html, 'href')) {
    if (/^tel:/i.test(h)) phones.add(h.slice(4));
  }
  for (const p of phones) {
    const n = normalisePhone(p);
    if (!APPROVED_PHONES.has(n)) fail(rel, `G2 disallowed phone "${p.trim()}" (normalised ${n})`);
  }

  // G3 — forbidden topics
  const pathname = pathnameFor(file);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, ''));
  for (const [label, value] of [['pathname', pathname], ['title', decodeEntities(title)], ...h1s.map((h) => ['h1', decodeEntities(h)])]) {
    if (FORBIDDEN.test(value.toLowerCase())) {
      fail(rel, `G3 forbidden topic in ${label}: "${value.trim()}"`);
    }
  }

  // G5 — anchors inside <main>
  for (const href of attrsValues(main, 'href')) {
    const ok =
      href.startsWith('/') ||
      href.startsWith(HOST) ||
      href.startsWith(WWW) ||
      href === QUILTER ||
      href === TEL ||
      href === MAILTO ||
      (TRUSTPILOT && href === TRUSTPILOT);
    if (!ok) fail(rel, `G5 disallowed anchor in <main>: "${href}"`);
  }

  // G6 — FAQPage question names appear in visible text
  const ldBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const visibleNorm = norm(visible);
  for (const [, raw] of ldBlocks) {
    let data;
    try {
      data = JSON.parse(raw.trim());
    } catch (e) {
      fail(rel, `G6 invalid JSON-LD block: ${e.message}`);
      continue;
    }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      if (node && node['@type'] === 'FAQPage' && Array.isArray(node.mainEntity)) {
        for (const q of node.mainEntity) {
          const name = q?.name;
          if (typeof name === 'string' && !visibleNorm.includes(norm(name))) {
            fail(rel, `G6 FAQPage question not found in visible text: "${name}"`);
          }
        }
      }
    }
  }

  // G7 — internal anchor hrefs
  for (const href of anchorHrefs(html)) {
    if (!href.startsWith('/')) continue;
    if (href.includes('index.html')) {
      fail(rel, `G7 href contains index.html: "${href}"`);
      continue;
    }
    const pathPart = href.split('#')[0].split('?')[0];
    if (pathPart !== '/' && pathPart.endsWith('/')) {
      fail(rel, `G7 internal href has a trailing slash: "${href}"`);
    }
    if (!targetExists(pathPart)) {
      fail(rel, `G7 internal href does not resolve to a built file: "${href}" (looked for ${pathPart}/index.html and ${pathPart}.html)`);
    }
  }
}

if (failures.length) {
  console.error(`postbuild guards failed (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`postbuild guards passed: ${files.length} HTML files checked (G1, G2, G3, G5, G6, G7).`);
