// data/library-config.mjs
//
// Single source of truth for the Mortgage Library (/library). Shared by:
//   - scripts/library/refresh-m1-index.mjs  (builds data/m1-index.json)
//   - src/lib/library.js                     (renders the page at build time)
//
// Pure ESM, no Node-only imports, so it loads in both the build script and the
// Astro/Vite build. Everything Matt needs to tune the index lives here: the
// section list and copy, the M1 exclusion rules, and the categorisation rules.

export const M1_BASE = 'https://www.mortgageonefinance.co.uk';

// The nine sections, in the exact render order from the brief. A section with
// zero entries is hidden by the page, never removed from this list.
export const SECTIONS = [
  {
    id: 'seafarer',
    title: 'Seafarer mortgages',
    intro: 'Mortgages for merchant navy officers, yacht crew and offshore professionals paid at sea.',
  },
  {
    id: 'expat',
    title: 'Expat mortgages',
    intro: 'UK mortgages for British nationals living and working overseas.',
  },
  {
    id: 'self-employed',
    title: 'Self-employed and complex income',
    intro: 'Lending for directors, contractors and anyone whose income does not fit a standard payslip.',
  },
  {
    id: 'buy-to-let',
    title: 'Buy-to-let and limited company',
    intro: 'Personal and SPV borrowing for landlords, from a first purchase to a full portfolio.',
  },
  {
    id: 'later-life',
    title: 'Later life lending',
    intro: 'Mortgage options for borrowers in their late fifties, sixties and beyond.',
  },
  {
    id: 'first-time',
    title: 'First-time buyers',
    intro: 'The essentials from first viewing to completion.',
  },
  {
    id: 'moving',
    title: 'Moving home and remortgaging',
    intro: 'Rates, timing and switching for existing homeowners.',
  },
  {
    id: 'calculators',
    title: 'Calculators',
    intro: 'Quick illustrative tools for repayments, borrowing and more.',
  },
  {
    id: 'more',
    title: 'More from the main site',
    intro: 'Everything else on the Mortgage One guide shelf.',
  },
];

// ---------------------------------------------------------------------------
// M1 EXCLUSIONS
// ---------------------------------------------------------------------------
// Applied to every www.mortgageonefinance.co.uk sitemap URL. Returns a short
// human reason string when the URL must be dropped, or null to keep it. Every
// dropped URL is logged in the pull request body so Matt can eyeball the list.

// News / dated market commentary. The main site publishes a heavy stream of
// rate, budget and forecast articles. The library is an evergreen guide shelf,
// so these are excluded. An entry is news when it matches a dated or market
// marker below AND is not shielded by the evergreen guard (a page that is
// clearly a guide, hub or calculator is never treated as news).
const NEWS_MARKERS = [
  /^\/news(\/|$)/, // the /news section itself
  /mortgage-news/, // /mortgage-news, /uk-mortgage-news, /261124-uk-mortgage-news
  /\b(19|20)\d\d\b/, // any four-digit year (2008, 2024, 2025, 2026, 2029, ...)
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/,
  // rate / market / political commentary vocabulary
  /rate-cut|cut-rate|rates-rise|rates-rising|rise-again|rates-fall|rates-falling|rates-slide|rates-edge|rates-steady|hold-rate|holds-rate|rate-forecast|rate-projection|rates-outlook|rate-outlook|interest-rate/,
  /base-rate|baserate|bank-rate|\bboe\b|bank-of-england|\bmpc\b|\bfca-calls\b/,
  /budget|gilt|forecast|outlook|market-update|price-war|price-surges|record-high|reeves|trump|treasury|recession|turmoil|instability|yield-curve|mansion-tax|economy-slows|uk-economy|affordability-rules|approvals-rise|criteria-changes|criteria-and-mortgage-deals/,
  /fix-now|fix-my-mortgage|lock-in-low|secure-great-mortgage|secure-your-mortgage|lowest-mortgage-rate|current-uk-mortgage-rates|mortgage-rates-in-uk|higher-mortgage-costs|lending-rates-surge|18-month-low|smallest-deposit|house-price|house-prices|home-sales-lowest|housing-market/,
];
// A page that is unambiguously a guide, hub or location index is never treated
// as news, even if its title mentions a rate or a year. Deliberately does NOT
// shield on "calculator": the real calculator tools carry no news markers, so
// leaving it out lets rate-outlook articles that merely end in "calculators"
// (e.g. .../rates-outlook-2026-bank-rate-calculators) fall out as news.
const EVERGREEN_GUARD = /-guide$|-guide-|guides-by-location|hub$/;

// Structural pages that are not part of the guide shelf.
const STRUCTURAL = [
  { re: /^\/(home)?$/, reason: 'homepage' },
  { re: /^\/contact(\/|$)|contact-form$/, reason: 'contact page' },
  { re: /privacy/, reason: 'privacy page' },
  { re: /^\/terms(-and-conditions)?(\/|$)/, reason: 'terms page' },
  { re: /cookie/, reason: 'cookies page' },
  { re: /thank-you/, reason: 'thank-you page' },
  { re: /^\/mortgage-guides(\/|$)/, reason: '/mortgage-guides index' },
];

// Forbidden topics, matched on word boundaries in the slug or the title. These
// mirror the CLAUDE.md forbidden list; the library never surfaces them.
export const FORBIDDEN_WORDS = /\b(iva|ccj|dmp|debt[- ]management|bankruptcy|bankrupt|bad[- ]credit|declined|refused)\b/i;

export function excludeM1(pathname, title = '') {
  const p = pathname.toLowerCase();

  for (const { re, reason } of STRUCTURAL) {
    if (re.test(p)) return reason;
  }

  if (FORBIDDEN_WORDS.test(p)) return `forbidden topic in slug (${p.match(FORBIDDEN_WORDS)[0]})`;
  if (title && FORBIDDEN_WORDS.test(title)) return `forbidden topic in title (${title.match(FORBIDDEN_WORDS)[0]})`;

  if (!EVERGREEN_GUARD.test(p)) {
    for (const re of NEWS_MARKERS) {
      if (re.test(p)) return 'news / dated market commentary';
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// CATEGORISATION
// ---------------------------------------------------------------------------
// Ordered rules. First match wins, so order matters: calculators are pulled out
// first (a self-employed calculator belongs with the tools, not the guides),
// then seafarer and expat run before the broader buy-to-let and self-employed
// rules because those clusters share vocabulary. Anything unmatched lands in
// "More from the main site" so a new page is never silently dropped.
const CATEGORY_RULES = [
  { id: 'calculators', re: /calculator|calculate-your-mortgage|repayment-calc|stress-test/ },
  { id: 'seafarer', re: /seafarer|merchant-navy|superyacht|yacht-crew|cruise-crew|liveaboard/ },
  {
    id: 'expat',
    re: /expat|non-uk-resident|living-abroad|from-abroad|overseas|foreign-currency|foreign-income|foreign-national|returning-to-uk|returning-expat|british-expats/,
  },
  {
    id: 'self-employed',
    re: /self-employed|company-director|director|contractor|retained-profit|years-accounts|newly-self-employed|complex-income|professionals|umbrella|sole-trader|day-rate/,
  },
  {
    id: 'buy-to-let',
    re: /buy-to-let|\bbtl\b|\bspv\b|special-purpose-vehicle|limited-company|landlord|portfolio|holiday-let|\bhmo\b|first-time-landlord|rental/,
  },
  {
    id: 'later-life',
    re: /later-life|retirement|equity-release|lifetime|over-55|over55|55-to-70|pensioner|using-equity|equity-for-children/,
  },
  {
    id: 'first-time',
    re: /first-time|help-to-buy|shared-ownership|help-children-get-mortgage|smallest-deposit|right-to-buy/,
  },
  {
    id: 'moving',
    re: /remortgage|moving-home|homeowners-moving|home-mover|product-transfer|additional-mortgage-borrowing|second-home|second-charge|new-build|residential-mortgages-hub|residential/,
  },
];

// Slugs whose pattern would otherwise land in the wrong section. Keyed slug to
// section id, checked before the ordered rules. Mirrors the sitemap override so
// the residential-through-a-company page sits with complex income, not with the
// landlord borrowing in buy-to-let.
const OVERRIDES = {
  '/residential-mortgage-through-limited-company': 'self-employed',
};

export function categorise(slug) {
  const s = slug.toLowerCase();
  if (OVERRIDES[s]) return OVERRIDES[s];
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(s)) return rule.id;
  }
  return 'more';
}

// ---------------------------------------------------------------------------
// TYPE CHIP
// ---------------------------------------------------------------------------
// One of Guide, Calculator, Scenario, Tool. Calculators and the calculator hub
// are tools; M2 question pages (can..., how much..., how many...) read as
// scenarios; everything else is a guide.
const CALC_HUB = /^\/calculators$/;
const SCENARIO = /^\/(can-|how-much-|how-many-|will-|do-i-|what-)/;

export function typeOf({ slug, section }) {
  const s = slug.toLowerCase();
  if (CALC_HUB.test(s)) return 'Tool';
  if (section === 'calculators' || /calculator|calculate-your-mortgage|stress-test/.test(s)) return 'Calculator';
  if (SCENARIO.test(s)) return 'Scenario';
  return 'Guide';
}

// ---------------------------------------------------------------------------
// TITLE CLEANUP
// ---------------------------------------------------------------------------
// Strip a trailing brand suffix so cards read cleanly. Handles "| Mortgage One",
// "- Mortgage One", "| Mortgage One Finance", en dashes and pipe variants.
export function stripBrand(title) {
  if (!title) return '';
  let t = title.replace(/\s+/g, ' ').trim();
  // Squarespace appends its own " — Mortgage One" site title on top of an SEO
  // title that often already ends "| Mortgage One", so peel repeatedly.
  const brand = /\s*[|·•–—\-]\s*mortgage\s*one(\s*finance)?\s*(ltd|limited)?\.?\s*$/i;
  let prev;
  do {
    prev = t;
    t = t.replace(brand, '').trim();
  } while (t !== prev && t.length);
  return t;
}
