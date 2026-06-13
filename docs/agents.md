# Agent configuration

The production layer for advice.mortgageonefinance.co.uk. This document records the intended setup. No schedule is enabled yet. Nothing here grants merge rights.

## Governing principle

Non-autonomous. Every agent opens pull requests only. No agent self-merges. Every merge is approved by the repo owner. All pull requests must pass the build, guards included, before they are eligible for review.

## Connectors

GitHub, Ahrefs, and Google Search Console (GSC) only. No other connector is authorised for these agents.

## Agents

### Daily improver
- Scope: existing pages only.
- Output: one pull request per run.
- Never adds, removes, or renames pages.
- Never touches locked files (src/components/locked/**, src/config/site.ts, src/config/form.ts, vercel.json, astro.config.mjs, scripts/guards/**).
- 7-day anti-churn per page: a page touched in the last 7 days is off limits.
- Opens a pull request. Never self-merges.

### Page builder
- Scope: new pages only.
- Output: one pull request per page. Never combines pages.
- Never self-merges.
- Checks the CLAUDE.md "Never target" blocklist and forbidden-topics list before starting.
- Per-page protocol, run before writing the page:
  1. Ahrefs keyword and difficulty check for the target keyword.
  2. M1 rank check (is www or news already ranking, to avoid cannibalisation).
  3. Source verification for every figure and claim.
- Every fourth page is a citable data asset built on sourced figures.
- Follows the build order and the two-to-four pages per day cadence in CLAUDE.md.

### Polisher
- Scope: copy and SEO refinement on existing pages.
- Output: one pull request per run.
- Never self-merges.

### Daily digest
- Scope: read-only summary (pipeline status, what shipped, what is queued, anomalies).
- No merges. No write access required beyond posting its summary.

## Merge safety

### Observed state (verified at commit time)

1. GitHub auto-merge is OFF for the repository: `allow_auto_merge: false`. Confirmed via the GitHub API.
2. Branch protection and repository rulesets are NOT available on this repository. It is private on a free plan, and both the branch-protection and rulesets endpoints return HTTP 403 "Upgrade to GitHub Pro or make this repository public to enable this feature." So GitHub cannot currently enforce a required-approval gate on `main`.

### What this means

Auto-merge being off, plus agents that only ever open pull requests and never self-merge, means nothing reaches `main` except by a manual merge performed by the owner. That is the effective control today. It is enforced by process and by the owner being the sole person who merges, not yet by a GitHub branch-protection rule.

### To make required approval enforceable by GitHub (owner decision, not done here)

Pick one:
- Upgrade the repository to GitHub Pro, Team, or Enterprise, then enable branch protection or a ruleset on `main` requiring a pull request and at least one approving review.
- Move the repository into a GitHub organisation that has the feature.
- Make the repository public (not recommended for this project).

Do not enable any agent schedule until a GitHub-enforced approval gate is in place, or until the owner accepts the process-only control above as sufficient.

## Enabling a schedule

Out of scope for now. When the owner decides to enable cadence, a schedule is added separately and this document is updated in the same change. Until then, agents are run manually and every result is reviewed by hand.
