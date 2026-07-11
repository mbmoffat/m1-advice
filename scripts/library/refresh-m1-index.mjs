// scripts/library/refresh-m1-index.mjs
//
// Rebuilds data/m1-index.json: the cached list of evergreen guide pages on the
// main site (www.mortgageonefinance.co.uk) that the Mortgage Library links to.
//
//   node scripts/library/refresh-m1-index.mjs
//
// It fetches the main-site sitemap (handling the sitemap-index format Squarespace
// can emit), drops every URL the library config excludes, then fetches each
// surviving page once to read its <title> and meta description. Titles have any
// "| Mortgage One" style brand suffix stripped. The result is written to
// data/m1-index.json and committed, so the page builds with no network at all.
//
// Re-run it whenever the main site adds or removes guide pages.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { M1_BASE, excludeM1, FORBIDDEN_WORDS, stripBrand } from '../../data/library-config.mjs';

const OUT = fileURLToPath(new URL('../../data/m1-index.json', import.meta.url));
const TIMEOUT_MS = 12000;
const CONCURRENCY = 6;

function decodeEntities(s) {
  return s
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x2013;|&ndash;/g, '–')
    .replace(/&#x2014;|&mdash;/g, '—')
    .replace(/&#x2026;|&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

async function getText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'MortgageOneLibraryBot/1.0 (+https://advice.mortgageonefinance.co.uk/library)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Collect every <loc> from a sitemap, following one level of sitemap-index
// nesting (a <sitemapindex> of child <sitemap> documents).
async function collectSitemapUrls(url, seen = new Set()) {
  if (seen.has(url)) return [];
  seen.add(url);
  const xml = await getText(url);
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  if (/<sitemapindex[\s>]/i.test(xml)) {
    const out = [];
    for (const child of locs) out.push(...(await collectSitemapUrls(child, seen)));
    return out;
  }
  return locs;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].replace(/<[^>]+>/g, '')) : '';
}

// Read a named meta description, tolerating either attribute order and quote
// style. Falls back to og:description.
function extractDescription(html) {
  const byName = (attr, val) => {
    const a = new RegExp(`<meta[^>]*\\b${attr}=["']${val}["'][^>]*\\bcontent=["']([^"']*)["'][^>]*>`, 'i');
    const b = new RegExp(`<meta[^>]*\\bcontent=["']([^"']*)["'][^>]*\\b${attr}=["']${val}["'][^>]*>`, 'i');
    const m = html.match(a) || html.match(b);
    return m ? decodeEntities(m[1]) : '';
  };
  return byName('name', 'description') || byName('property', 'og:description') || '';
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  console.log(`Fetching sitemap from ${M1_BASE}/sitemap.xml ...`);
  const locs = await collectSitemapUrls(`${M1_BASE}/sitemap.xml`);
  const paths = [...new Set(locs.map((u) => u.replace(M1_BASE, '').replace(/\/$/, '') || '/'))].sort();
  console.log(`Sitemap returned ${paths.length} unique URLs.`);

  const kept = [];
  const excluded = [];
  for (const path of paths) {
    const reason = excludeM1(path);
    if (reason) excluded.push({ path, reason });
    else kept.push(path);
  }
  console.log(`After slug exclusions: ${kept.length} to fetch, ${excluded.length} excluded.`);

  const entries = [];
  await mapLimit(kept, CONCURRENCY, async (path) => {
    const url = M1_BASE + path;
    try {
      const html = await getText(url);
      const rawTitle = extractTitle(html);
      const title = stripBrand(rawTitle);
      // Forbidden topics can hide in a title even when the slug is clean.
      if (FORBIDDEN_WORDS.test(rawTitle)) {
        excluded.push({ path, reason: `forbidden topic in title (${rawTitle.match(FORBIDDEN_WORDS)[0]})` });
        return;
      }
      const description = extractDescription(html);
      entries.push({ path, url, title, description });
      console.log(`  ok  ${path}  ->  ${title}`);
    } catch (err) {
      // A page that will not fetch is skipped, not fatal. It simply will not
      // appear until the next successful refresh.
      excluded.push({ path, reason: `fetch failed (${err.message})` });
      console.log(`  skip ${path}  (${err.message})`);
    }
  });

  entries.sort((a, b) => a.path.localeCompare(b.path));
  excluded.sort((a, b) => a.path.localeCompare(b.path));

  const payload = {
    base: M1_BASE,
    generatedAt: new Date().toISOString(),
    count: entries.length,
    entries,
    excluded,
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
  console.log(`\nWrote ${entries.length} entries and ${excluded.length} exclusions to data/m1-index.json`);
}

main().catch((err) => {
  console.error('refresh-m1-index failed:', err);
  process.exit(1);
});
