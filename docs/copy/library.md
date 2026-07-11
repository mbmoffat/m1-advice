# Library index page copy

Route: `/library` (canonical, no trailing slash)

- **SEO title:** Mortgage Library: Every Guide & Calculator | Mortgage One
- **Meta description:** Browse every Mortgage One guide, calculator and specialist advice page in one place. Search by topic or A-Z and find the right starting point for your case.
- **Breadcrumb:** Home > Library

## Fixed copy (verbatim)

- **Eyebrow:** The Mortgage Library
- **H1:** Every mortgage guide, tool and calculator in one place
- **Intro under H1:** One index for the whole of Mortgage One. Specialist advice from this hub and every guide on the main site, grouped by the situation you are in. Search it, browse by topic, or scan the A-Z.
- **Stats line (computed at build):** {n} guides · {n} calculators · updated {build date, e.g. 11 July 2026}
- **Search label:** Search the library
- **Search placeholder:** Search by topic, lender type or situation
- **Empty search state:** No matches. Tell us your situation instead and we will point you the right way.
  - **Button:** Check your eligibility → `/check`
- **View toggle labels:** By topic / A-Z
- **Mid-page CTA band (after section 3):** Not sure which page you need? Answer a few quick questions and we will point you at the right one.
  - **Button:** Check your eligibility → `/check`
- **M1 card tag:** Main site

## Sections (render order, a section with zero entries is hidden)

1. **Seafarer mortgages** — Mortgages for merchant navy officers, yacht crew and offshore professionals paid at sea.
2. **Expat mortgages** — UK mortgages for British nationals living and working overseas.
3. **Self-employed and complex income** — Lending for directors, contractors and anyone whose income does not fit a standard payslip.
4. **Buy-to-let and limited company** — Personal and SPV borrowing for landlords, from a first purchase to a full portfolio.
5. **Later life lending** — Mortgage options for borrowers in their late fifties, sixties and beyond.
6. **First-time buyers** — The essentials from first viewing to completion.
7. **Moving home and remortgaging** — Rates, timing and switching for existing homeowners.
8. **Calculators** — Quick illustrative tools for repayments, borrowing and more.
9. **More from the main site** — Everything else on the Mortgage One guide shelf.

## Structure

Eyebrow + H1, intro, stats line, large search field (hero). Sticky filter bar with
category pills (live counts) and a By topic / A-Z view toggle. Card grid grouped by
section, each section led by its one-line intro. Mid-page CTA band after section 3.
Site-standard CTA block into `/check` at the end, then the standard footer.

Each card carries a type chip (Guide, Calculator, Scenario or Tool). Cards that point
at the main site (`www.mortgageonefinance.co.uk`) carry a "Main site" tag and an
outbound arrow. A card with no descriptor renders title-only, never invented text.

## Data

- M2 entries are enumerated from `src/pages` at build time, so every future page
  auto-registers. Pages that set `noindex`, plus the homepage, library, quiz, thank-you,
  404 and sitemap routes, are excluded.
- M1 entries come from `data/m1-index.json` (built by
  `scripts/library/refresh-m1-index.mjs`), topped up by a best-effort live sitemap fetch
  at build. Exclusions and categorisation rules live in `data/library-config.mjs`.
