# DEVELOPMENT WORKFLOW — PURE COLLECTIONS

> Long-term development workflow for PURE COLLECTIONS as a commercial SaaS product.
> Architecture approved in principle: 2026-07-02.
> Status: **incremental rollout in progress** — see [CURRENT_TASK.md](../CURRENT_TASK.md) for what's live vs. planned.

This document is the target-state design. It is not all implemented yet. Each section notes its rollout status.

---

## 1. Git Workflow

- **`master`** — production. Always deployable, always matches what's live for customers.
- **`develop`** — integration branch. Finished features land here before they're proven safe. Doubles as the trigger for the Staging environment.
- **`feature/*`** — one branch per unit of work (e.g. `feature/whatsapp-business`). Branches off `develop`, PRs back into `develop`.
- **`hotfix/*`** — branched off `master` for urgent production bugs; merged to both `master` and `develop`.

All merges into `develop` or `master` go through a PR — no direct pushes to either. Enforced via GitHub branch protection once configured.

**Status: not yet implemented.** Repo currently has only `master`.

---

## 2. Vercel Environments

| Tier | Git source | Purpose |
|---|---|---|
| Production | `master` | Live customer traffic. Only tier holding production Supabase credentials. |
| Staging | `develop` (fixed alias URL) | Stable QA target — one URL, not a new one per merge. |
| Preview | every PR / `feature/*` | Ephemeral, automatic, one per branch — review before merging to `develop`. |

Requires switching from the current manual `vercel --prod` CLI deploys to GitHub-integrated auto-deploy, scoped per branch.

**Status: not yet implemented.** Production deploys remain manual via Vercel CLI until this is explicitly approved.

---

## 3. Supabase Environments

**Decision: two fully separate Supabase projects, not shared schemas in one project.**

- **`pure-collections-prod`** (existing, ref `rlkanhhisiftqgdeugvb`) — real tenants, real customer data, real Rivhit vault tokens.
- **`pure-collections-staging`** (new) — fake tenants, synthetic data, sandbox-only credentials. Same region (Frankfurt / eu-central-1) as prod.

Rationale: full project separation means a staging mistake (bad migration, runaway script, RLS misconfiguration) is structurally incapable of touching production — it's a different database instance entirely, not a boundary enforced by policy alone.

Both projects are driven by the same files in `supabase/migrations/`. Apply to staging first, verify, then apply to production as a distinct, explicit, manual step — never simultaneously.

**Status: in progress — first implementation step.** Staging project creation requires the account owner's Supabase login; see [CURRENT_TASK.md](../CURRENT_TASK.md) for the current checkpoint.

---

## 4. Environment Variables

Vercel scopes env vars per environment (Production / Preview / Development), and Preview vars can be further scoped to a specific branch.

| Scope | Points at |
|---|---|
| Production (Vercel) | Production Supabase project |
| Preview (Vercel) — covers `develop`/staging and all `feature/*` previews | Staging Supabase project |
| Local `.env.local` | Production (today) — **do not change this without explicit approval** |
| Local `.env.staging.local` (new, gitignored) | Staging Supabase project |

Planned safety net: a startup check that fails loudly if `NODE_ENV=production` but the Supabase project ref doesn't match the known production ref — catches copy-paste mistakes before they ship.

**Status: not yet implemented.** No Vercel environment variables will be touched until the staging project exists and is verified in isolation.

---

## 5. Demo/Test Data Strategy

- Staging gets a seed script creating 1–2 fake tenants, fake users (mirroring owner/manager/clerk roles), and synthetic collections data — never a copy of real customer records.
- A "reset staging" task wipes and reseeds staging on demand, so QA always starts from a known state.
- Rivhit and future integrations (WhatsApp Business, email) get sandbox/test credentials in staging; real API keys stay in production env vars only.

**Status: not yet implemented.**

---

## 6. Deployment Workflow

1. Branch off `develop` → `feature/x`. PR into `develop`; CI runs lint/build/tests; Vercel generates a Preview URL.
2. Merge into `develop` → auto-deploys to Staging, backed by staging Supabase. QA happens here.
3. Once staging is verified, open a PR `develop` → `master`. This PR **is** the release.
4. Merge to `master` → auto-deploys to Production. Schema changes are applied to production Supabase as an explicit, separate, approved step — never bundled silently into the deploy.

**Status: not yet implemented.** Current deployment remains: manual `vercel --prod` from `master`, as documented in `docs/daily/2026-06-30.md`.

---

## 7. Rollback Workflow

- **App code:** Vercel keeps immutable deployment history — rollback = promote a previous deployment. Near-instant, zero downtime.
- **Database:** migrations must be backward-compatible (expand/contract pattern) — add new columns/tables in one release, drop old ones only in a later release once nothing depends on them. This guarantees an app rollback never lands on a schema the old code can't read. Supabase project backups / point-in-time recovery are the last resort beyond that.
- **Git:** rollback via `git revert` on `master`, never `force-push` or `reset --hard` — consistent with the existing Git Safety Protocol.

**Status: documented, not yet exercised.**

---

## 8. How QA Should Work

- The existing 15-test Playwright suite (Pilot Readiness QA, 2026-06-30) becomes the baseline regression suite, run against the Staging URL + staging Supabase, expanded as new modules land.
- CI runs it automatically on every PR into `develop`, and again on the `develop → master` release PR.
- Manual smoke test on staging (Avi/Ben) is the human gate before approving promotion.
- New integrations (WhatsApp Business, Email) are built and tested end-to-end in staging with sandbox credentials first; production credentials are added only once staging proves the flow works.

**Status: not yet implemented** — CI setup explicitly deferred per current approval.

---

## 9. Promotion: Staging → Production

A `develop → master` PR, merged only once:
1. Automated tests pass,
2. Manual staging QA is signed off, and
3. Any migration has already been proven on staging.

No automatic promotion. This is the one gate that stays manual permanently — it's the only door into production data.

**Status: not yet implemented** (no `develop` branch exists yet).

---

## Rollout Order (Incremental Approval)

Per approval on 2026-07-02, this is being built incrementally, not all at once. Each step requires separate sign-off:

1. ✅ Document this workflow (this file).
2. 🔄 **Current step:** Create and verify an isolated Supabase Staging project. No Vercel changes, no production changes, no git restructuring.
3. ⏳ Not yet approved: Git branch restructuring (`develop`, branch protection).
4. ⏳ Not yet approved: Vercel environment wiring (branch env vars, GitHub auto-deploy).
5. ⏳ Not yet approved: CI pipeline (GitHub Actions).
6. ⏳ Not yet approved: Formal promotion process end-to-end.

See [CURRENT_TASK.md](../CURRENT_TASK.md) for live status.
