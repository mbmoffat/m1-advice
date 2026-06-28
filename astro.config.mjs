// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE = 'https://advice.mortgageonefinance.co.uk';
const PAGES_DIR = fileURLToPath(new URL('./src/pages/', import.meta.url));

// Ultimate fallback only: used when a route cannot be mapped to a source file
// and that file has neither git history nor a frontmatter date. This is one
// timestamp, but it is never stamped uniformly across URLs — each entry resolves
// its own lastmod first and only falls back here in isolation.
const BUILD_DATE = new Date().toISOString();

// Map a sitemap URL back to its .astro source under src/pages. The flat page
// layout makes this practical, so the git date (source priority a) is reachable
// for every real page; directory-style routes fall back to an index file.
function sourceFileFor(url) {
  let route = url.replace(SITE, '').replace(/\/$/, '');
  if (route === '') route = '/index';
  const rel = route.replace(/^\//, '');
  const flat = PAGES_DIR + rel + '.astro';
  if (existsSync(flat)) return flat;
  const nested = PAGES_DIR + rel + '/index.astro';
  if (existsSync(nested)) return nested;
  return null;
}

// (a) git last-commit date of the source file, ISO 8601 with timezone offset
// (%cI). Returns null when git is unavailable or the file is not yet committed.
function gitLastModified(file) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], {
      cwd: PAGES_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

// (b) frontmatter date the page exposes, trying updatedDate then pubDate. No
// current page carries these, but the fallback is kept so dated pages are
// honoured automatically if they are added later.
function frontmatterDate(file) {
  try {
    const src = readFileSync(file, 'utf8');
    const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) return null;
    for (const key of ['updatedDate', 'pubDate']) {
      const m = fm[1].match(new RegExp(`\\b${key}\\s*[:=]\\s*['"]?([0-9T:+\\-.Z ]+)['"]?`));
      if (m) {
        const d = new Date(m[1].trim());
        if (!Number.isNaN(d.getTime())) return d.toISOString();
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Per-page lastmod: git date, then frontmatter date, then the build date. Never
// a single uniform timestamp across all URLs.
function lastmodFor(url) {
  const file = sourceFileFor(url);
  if (file) {
    return gitLastModified(file) || frontmatterDate(file) || BUILD_DATE;
  }
  return BUILD_DATE;
}

export default defineConfig({
  site: SITE,
  trailingSlash: 'never',
  integrations: [
    sitemap({
      // /thank-you, /check and /sitemap are non-content routes kept out of the
      // sitemap. Every other route, including /calculators and all calculator
      // pages, stays in.
      filter: (page) =>
        !/\/thank-you\/?$/.test(page) && !/\/check\/?$/.test(page) && !/\/sitemap\/?$/.test(page),
      serialize(item) {
        item.url = item.url.replace(/\/$/, '');
        item.lastmod = lastmodFor(item.url);
        return item;
      },
    }),
  ],
});
