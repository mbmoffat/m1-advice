// src/lib/library.js
//
// Builds the Mortgage Library data set at build time and returns it ready to
// render. It combines two sources:
//
//   M2 (this repo)  — enumerated from src/pages via import.meta.glob so every
//                     future page auto-registers. Title, description and the
//                     noindex flag are read straight from each page's source.
//   M1 (main site)  — read from the committed cache data/m1-index.json, then
//                     topped up with any brand-new sitemap URLs fetched live at
//                     build. A network failure never breaks the build: it falls
//                     back silently to the cache.
//
// Every entry is categorised into one section by the shared rules in
// data/library-config.mjs. Card text is scrubbed so a stray phone or email in
// external metadata can never trip the G2 guard.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import site from '../config/site.ts';
import {
  M1_BASE,
  SECTIONS,
  excludeM1,
  categorise,
  typeOf,
  stripBrand,
  FORBIDDEN_WORDS,
  M2_CARD_OVERRIDES,
} from '../../data/library-config.mjs';

// Cluster hubs and pillars, surfaced first inside their section.
const HUBS = new Set([
  '/mortgage-as-a-seafarer',
  '/can-an-expat-get-a-uk-mortgage',
  '/self-employed-mortgage',
  '/limited-company-buy-to-let-mortgage',
]);

// Routes that are not guide-shelf content: the homepage, the library itself,
// the quiz interstitial, the thank-you and 404 steps, and the sitemap utility.
const M2_EXCLUDE = new Set(['/', '/index', '/library', '/404', '/thank-you', '/check', '/sitemap']);

const APPROVED_EMAIL = 'enquiry@mortgageonefinance.co.uk';
const APPROVED_PHONES = new Set(['01202155992', '441202155992']);

// Remove any email or phone-like run that the G2 guard would reject, so no card
// can ever fail the build. Approved contact details are left untouched.
function scrub(text) {
  if (!text) return '';
  let out = text;
  for (const em of out.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []) {
    if (em.toLowerCase() !== APPROVED_EMAIL) out = out.split(em).join('');
  }
  for (const seq of out.match(/\+?\d[\d\s().-]{7,}\d/g) || []) {
    let n = seq.replace(/\D/g, '');
    if (n.startsWith('440')) n = '44' + n.slice(3);
    if (!APPROVED_PHONES.has(n)) out = out.split(seq).join('');
  }
  return out.replace(/\s+/g, ' ').trim();
}

// A descriptor is only kept if it survives scrubbing unchanged; otherwise the
// card renders title-only rather than showing mangled or invented text.
function safeDescriptor(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const scrubbed = scrub(clean);
  return scrubbed === clean ? clean : '';
}

function attr(src, name) {
  const m = src.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`));
  return m ? (m[1] ?? m[2] ?? '') : '';
}

function isNoindex(src) {
  const eq = src.match(/\bnoindex\s*=\s*\{?\s*(true|false)\b/i);
  if (eq) return eq[1].toLowerCase() === 'true';
  return /\bnoindex\b(?!\s*=)/.test(src);
}

// --- M2: this repo's own pages -------------------------------------------
function getM2Entries() {
  const modules = import.meta.glob('../pages/**/*.astro', { query: '?raw', import: 'default', eager: true });
  const entries = [];
  for (const [path, raw] of Object.entries(modules)) {
    const slug =
      path
        .replace(/^\.\.\/pages/, '')
        .replace(/\.astro$/, '')
        .replace(/\/index$/, '') || '/';
    if (M2_EXCLUDE.has(slug)) continue;
    if (isNoindex(raw)) continue; // hard rule: noindex pages never appear

    const override = M2_CARD_OVERRIDES[slug] || {};
    const title = scrub(stripBrand(override.title ?? attr(raw, 'title'))) || slug.replace(/^\//, '');
    if (FORBIDDEN_WORDS.test(slug) || FORBIDDEN_WORDS.test(title)) continue;
    const section = categorise(slug);
    entries.push({
      source: 'm2',
      slug,
      href: slug,
      url: site.host + slug,
      title,
      description: safeDescriptor(override.description ?? attr(raw, 'description')),
      section,
      type: typeOf({ slug, section }),
    });
  }
  return entries;
}

// --- M1: main-site guide shelf -------------------------------------------
function readCache() {
  try {
    const json = readFileSync(fileURLToPath(new URL('../../data/m1-index.json', import.meta.url)), 'utf8');
    const data = JSON.parse(json);
    return Array.isArray(data.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

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

async function getText(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Best-effort: append any sitemap URLs not already cached. Wrapped so any
// failure (offline build, timeout, parse error) leaves the cache untouched.
async function liveAppend(byPath) {
  try {
    const xml = await getText(`${M1_BASE}/sitemap.xml`, 6000);
    let locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
    if (/<sitemapindex[\s>]/i.test(xml)) {
      const nested = [];
      for (const child of locs.slice(0, 20)) {
        try {
          const sub = await getText(child, 6000);
          nested.push(...[...sub.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]));
        } catch {
          /* skip this sub-sitemap */
        }
      }
      locs = nested;
    }
    const fresh = [...new Set(locs.map((u) => u.replace(M1_BASE, '').replace(/\/$/, '') || '/'))]
      .filter((p) => !byPath.has(p) && !excludeM1(p))
      .slice(0, 40); // bound live work
    for (const path of fresh) {
      try {
        const html = await getText(M1_BASE + path, 6000);
        const rawTitle = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<[^>]+>/g, ''));
        if (!rawTitle || FORBIDDEN_WORDS.test(rawTitle)) continue;
        const dm =
          html.match(/<meta[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"']*)["'][^>]*>/i) ||
          html.match(/<meta[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']description["'][^>]*>/i) ||
          html.match(/<meta[^>]*\bproperty=["']og:description["'][^>]*\bcontent=["']([^"']*)["'][^>]*>/i);
        byPath.set(path, { path, url: M1_BASE + path, title: stripBrand(rawTitle), description: dm ? decodeEntities(dm[1]) : '' });
      } catch {
        /* skip this page */
      }
    }
  } catch {
    /* network unavailable — cache only */
  }
}

async function getM1Entries() {
  const byPath = new Map();
  for (const e of readCache()) byPath.set(e.path, e);
  await liveAppend(byPath);

  const entries = [];
  for (const e of byPath.values()) {
    // Re-apply exclusions defensively in case config rules tightened since the
    // cache was written.
    if (excludeM1(e.path, e.title)) continue;
    const title = scrub(stripBrand(e.title)) || e.path.replace(/^\//, '');
    const section = categorise(e.path);
    entries.push({
      source: 'm1',
      slug: e.path,
      href: e.url,
      url: e.url,
      title,
      description: safeDescriptor(e.description),
      section,
      type: typeOf({ slug: e.path, section }),
    });
  }
  return entries;
}

function firstLetter(title) {
  const c = (title || '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

function sortEntries(a, b) {
  const ah = HUBS.has(a.slug) ? 0 : 1;
  const bh = HUBS.has(b.slug) ? 0 : 1;
  if (ah !== bh) return ah - bh;
  if (a.source !== b.source) return a.source === 'm2' ? -1 : 1; // this hub first
  return a.title.localeCompare(b.title, 'en-GB');
}

export async function buildLibrary() {
  const all = [...getM2Entries(), ...(await getM1Entries())];

  // De-duplicate by resolved URL, preferring the M2 (local) version.
  const seen = new Map();
  for (const e of all.sort((a, b) => (a.source === 'm2' ? -1 : 1))) {
    const key = e.url.replace(/\/$/, '').toLowerCase();
    if (!seen.has(key)) seen.set(key, e);
  }
  const entries = [...seen.values()].map((e) => ({ ...e, letter: firstLetter(e.title) }));

  const sections = SECTIONS.map((s) => ({
    ...s,
    entries: entries.filter((e) => e.section === s.id).sort(sortEntries),
  })).filter((s) => s.entries.length > 0);

  const calculators = entries.filter((e) => e.type === 'Calculator').length;
  const guides = entries.length - calculators;
  const buildDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return {
    sections,
    entries,
    stats: {
      total: entries.length,
      m1: entries.filter((e) => e.source === 'm1').length,
      m2: entries.filter((e) => e.source === 'm2').length,
      guides,
      calculators,
      buildDate,
    },
  };
}
