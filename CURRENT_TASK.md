# CURRENT TASK

## Long-Term Environment Architecture (Session 5)

**Status:** In Progress
**Started:** 2026-07-02

---

## What's Approved

Full target-state design documented in [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md), approved in principle by Avi on 2026-07-02, to be built **incrementally** — each step requires separate sign-off.

Explicitly NOT yet approved: Vercel production env var changes, production Supabase data/schema changes, production deployment changes, Git branch restructuring, auto-deploy, CI setup.

## Current Checkpoint

**Step 1 of 6 — done:** Long-term workflow documented (`docs/DEVELOPMENT_WORKFLOW.md`).

**Step 2 of 6 — done (2026-07-02):** Created and verified a fully isolated Supabase Staging project.
- Project: `pure-collections-staging`, ref `nfrecdfkogznwtwlvkoe`, Frankfurt (eu-central-1), same org as prod (`pure water systems`)
- Baseline migration (`20260629000000_initial_schema.sql`) applied and confirmed tracked remotely
- Local Supabase CLI authenticated via `npx supabase login` (browser OAuth, run by Avi in his own terminal) and linked to the staging project only — prod remains unlinked
- Credentials: staging URL + publishable key written to new `.env.staging.local` (gitignored); secret key was never fetched/printed; a one-time DB password was generated locally to create the project, then deleted after use
- Isolation verified: distinct project ref from prod, `.env.local` (prod) untouched, staging REST endpoint returns HTTP 200 with RLS enforced (no data without auth), no prod ref found anywhere in staging config
- No Vercel changes, no production Supabase changes, no git branch changes made in this step

Next steps (3–6: Git branch restructuring, Vercel environment wiring, CI, formal promotion process) remain **not approved** and will not begin without separate sign-off.

---

## Pilot UX Fixes (Session 4)

**Status:** Complete ✅
**Completed:** 2026-07-01

---

## What Was Done

UX review identified three findings; two confirmed fixes were approved and implemented:

1. **Escape in contact edit closes panel** (confirmed bug) — fixed with `data-contact-edit-form` attribute on the edit wrapper + `e.target.closest()` guard in CustomerPanel's document Escape handler. Escape now cancels the edit only; the panel and document selection are unaffected. (Initial `stopPropagation`-only approach was insufficient against native `document.addEventListener` in Next.js App Router — corrected in `29329f9`.)
2. **Logout button has no confirmation** (UX improvement) — fixed with `window.confirm` on the sign-out form's `onSubmit`. One accidental click can no longer sign the clerk out.

Third finding (email/WhatsApp activity logged on client open, not on send) deferred — to be observed during clerk pilot before changing log semantics.

Commits: `62c3a17` (logout confirm + initial Escape fix), `29329f9` (robust Escape fix)
Deployed: manually via Vercel CLI — Vercel GitHub auto-deploy is NOT configured.
Production verified: both fixes confirmed live via Chrome browser testing.

---

## Previous Tasks

| Task | Status | Completed |
|------|--------|-----------|
| Session 1 — Supabase Foundation | Complete | 2026-06-29 |
| Session 2 — Auth Integration + Rivhit Vault | Complete | 2026-06-29 |
| Session 3.1 — Customer Contacts cloud migration | Complete | 2026-06-29 |
| Session 3.2 — Document Statuses cloud migration | Complete | 2026-06-29 |
| Session 3.3 — Activity Log cloud migration | Complete | 2026-06-29 |
| Session 3.4 — Bulk migration tool | Complete | 2026-06-29 |
| Pilot Readiness QA — 15-test automated smoke suite | Complete | 2026-06-30 |
| Production Deployment to Vercel | Complete | 2026-06-30 |
| Pilot UX Fixes (Session 4) | Complete | 2026-07-01 |

---

## Context

Following successful 15/15 Pilot Readiness QA, the app was deployed to Vercel for the clerk pilot.

## What Was Done

- Vercel CLI installed and authenticated
- Vercel project created: `pure-collections/pure-collections`
- Three production environment variables set (encrypted): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
- Production deployment succeeded — clean build, 21 routes
- Supabase Auth redirect URLs updated to production domain
- Automated smoke test: 7/7 checks passed
- Manual production verification passed: login, workspace, Settings, Vault token hint, Rivhit connection test, Sync to Cloud — all working

## Production URL

**https://pure-collections.vercel.app**

---

## Previous Tasks

| Task | Status | Completed |
|------|--------|-----------|
| Session 1 — Supabase Foundation | Complete | 2026-06-29 |
| Session 2 — Auth Integration + Rivhit Vault | Complete | 2026-06-29 |
| Session 3.1 — Customer Contacts cloud migration | Complete | 2026-06-29 |
| Session 3.2 — Document Statuses cloud migration | Complete | 2026-06-29 |
| Session 3.3 — Activity Log cloud migration | Complete | 2026-06-29 |
| Session 3.4 — Bulk migration tool | Complete | 2026-06-29 |
| Pilot Readiness QA — 15-test automated smoke suite | Complete | 2026-06-30 |
| Production Deployment to Vercel | Complete | 2026-06-30 |
