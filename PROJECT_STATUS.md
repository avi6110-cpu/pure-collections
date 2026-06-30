# PROJECT STATUS

## Current Phase: Collections Work Table V1

**Status:** Complete
**Last Updated:** 2026-06-16

---

## Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 0 | Repository Bootstrap | Complete |
| 1 | Next.js Scaffold + Verification | Complete |
| 2 | Import Engine V0 | Complete |
| 3 | Core UI & Layout | In Progress |
| 4 | Business Logic & Data | Not Started |
| 5 | Launch | Not Started |

---

## Completed Milestones

### Phase 0 — Repository Bootstrap
- [x] Git repository initialized
- [x] README.md, PROJECT_STATUS.md, CURRENT_TASK.md, CHANGELOG.md created
- [x] .gitignore added
- [x] CLAUDE.md — AI collaboration contract

### Phase 1 — Next.js Scaffold
- [x] Next.js 16.2.9, React 19, Tailwind v4, TypeScript 5, ESLint 9
- [x] Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- [x] RTL Hebrew root layout (`lang="he"`, `dir="rtl"`)
- [x] Placeholder routes: `/`, `/work`, `/upload`, `/settings`

### Verification Pass — 2026-06-16
- [x] All routes return HTTP 200
- [x] `npm run lint` — clean, no warnings
- [x] `npm run build` — clean, all pages static, no warnings
- [x] Hebrew content renders correctly in browser

---

## Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-06-16 | Start with docs-first approach | Clean slate, no code yet |
| 2026-06-16 | Scaffold into subdirectory, hoist to root | npm rejects uppercase/space package names |
| 2026-06-16 | Drop Geist fonts from layout | Latin-only font, does not support Hebrew |

---

### Phase 3 — Core UI & Layout (In Progress)
- [x] Basic Collections Table UX (search, sort, aging badges, summary cards)
- [x] Collections Work Table V1 — full-screen workspace layout
  - Full-height table with sticky header
  - Columns: שם לקוח, יתרה לתשלום, זמן חריגה, מסמך, מס׳ מסמך, תאריך מסמך
  - Removed Due Date + Reference (retained in RivhitRow for future debtor view)
  - Remaining Balance: bold + colored (red/green by sign and band)
  - Summary cards: Primary (יתרה לגבייה מיידית), 60+d, 30-60d, Total rows
  - "ייבוא דוח חדש" button in workspace header
- [x] Sort on all visible columns (click header → asc/desc toggle)
- [x] localStorage persistence via AppShell
  - First run: upload screen; subsequent runs: workspace with last report
  - New import replaces stored data in full; cancel returns to saved workspace
- [x] Customer detail slide-over panel — all open documents per customer, summary + doc list, aging highlights
- [x] Customer contacts (phone, email, contact person, notes) — persisted in separate localStorage key, survive report imports
- [x] KPI card filters — click red/yellow card to filter table by aging band; AND-logic with search; cards always show full-report totals
- [x] Customer collection status (לא טופל / בטיפול / הבטיח לשלם / מועמד לתשלום / שולם) — per-customer, separate localStorage key, survives imports; status pills in panel + filter chips in workspace + row border indicator
- [x] Customer activity timeline — per-customer log (status changes, WhatsApp/email opens, manual notes); `pure-collections:activity` key; newest-first display; icon + timestamp per entry; survives imports
- [x] Refined statuses — "הבטיח לשלם" replaced by "ממתין לתשלום"; migrate-on-read for existing data; `expectedPaymentDate?: string` per customer; date picker in Customer Panel when status = "מועמד לתשלום"; date survives status changes and imports
- [x] Document selection for communication drafts — per-document checkboxes in Customer Panel; default selected = 30+ day docs; fresh docs unselected; WhatsApp/Email disabled when no selection; composite docKey prevents type/number collisions
- [x] Document-level collection status — status keyed by `customerName|documentType|documentNumber`; "שולם" docs stay visible (green, bottom of list) but excluded from active totals; migration from old customer-level format on read
- [x] Customer Panel workflow-first layout — CompactHeader (name + contact inline), document list as primary section (flex-1), CommunicationSection below docs, SummaryStrip (4-stat horizontal row), ActivitySection at bottom
- [x] In-app document preview — eye button on each table row and each CustomerPanel document card; calls Document.Copy API; full-screen iframe modal with loading/error/fallback states; Escape and backdrop close
- [x] Robust Excel import — header-name detection replaces fixed column indexes; scans preamble for header row; fails loudly with Hebrew error if required columns missing; confirmed alias "יתרה לתשלום" for balance column
- [x] "במחלוקת" dispute status — per-document workflow flag; mandatory note required; activity log entry on confirm; orange row/card styling; filter chip in status row; disputed docs remain in totals and aging; no dedicated KPI card

---

### Cloud Infrastructure — Session 1 Complete (2026-06-29)
- [x] Supabase project provisioned — `pure-collections`, Frankfurt (eu-central-1)
- [x] Auth configured — email/password, invite-only, 1-hour JWT
- [x] Three users created: Avi (owner), Ben (owner), Clerk (clerk)
- [x] Multi-tenant schema: `tenants`, `users`, `rivhit_credentials`, `document_statuses`, `customer_contacts`, `activity_log`, `sync_log`
- [x] `tenants.features` (jsonb) for feature flags
- [x] `tenants.outgoing_email` for business-level sender address
- [x] RLS enabled on all 7 tables — 16 policies verified
- [x] Vault functions for encrypted Rivhit token storage (`service_role` only)
- [x] Supabase CLI installed; baseline migration committed to Git

### Cloud Infrastructure — Session 2 Complete (2026-06-29)
- [x] `@supabase/ssr` installed — browser + server + admin clients
- [x] `src/middleware.ts` — redirects unauthenticated requests to `/login`
- [x] `src/app/login/page.tsx` — Hebrew email/password login form
- [x] `src/app/auth/callback/route.ts` — PKCE callback handler
- [x] `.env.local` (gitignored) + `.env.example` (committed, empty values)
- [x] `AppUser` type — `id`, `tenantId`, `email`, `fullName`, `role` from `users` table
- [x] Rivhit token moved fully to Supabase Vault — never returned to browser
- [x] All 7 `/api/rivhit/*` routes rewritten to call `getVaultToken()` server-side
- [x] Settings page — vault hint display, token save, connection test
- [x] `UploadForm`, `CustomerPanel`, `DocumentPreviewModal`, all dev/sync pages — token header removed entirely

### Cloud Infrastructure — Session 3 Complete (2026-06-29)
- [x] Session 3.1 — Customer contacts: cloud-first read, dual-write, localStorage fallback
- [x] Session 3.2 — Document statuses + expected payment dates: cloud-first read, dual-write
- [x] Session 3.3 — Activity log (including dispute notes): cloud-first read, shared `saveActivity` helper, `ON CONFLICT (id) DO NOTHING` insert
- [x] Session 3.4 — Bulk migration tool: `POST /api/migrate/bulk` (idempotent, newer-wins for contacts/statuses, UUID-based dedup for activity); migration card in `/settings`

### Pilot Readiness QA — Complete (2026-06-30)
- [x] Playwright smoke suite installed — `playwright.config.ts`, `tests/pilot-qa.spec.ts`
- [x] 15 automated tests across two isolated browser contexts (Ben/owner, Clerk/clerk)
- [x] Root cause found and fixed: missing `GRANT` statements for `authenticated` and `service_role` roles on all 7 tables — PostgreSQL returned code 42501 before RLS was ever evaluated
- [x] Migration file updated with complete table-privilege section
- [x] All 15 tests pass: server health, auth, migration, DB verification, cross-user sync, sign-out

### Production Deployment — Complete (2026-06-30)
- [x] Vercel project created: `pure-collections/pure-collections`
- [x] Production URL: **https://pure-collections.vercel.app**
- [x] Three env vars set in Vercel (encrypted): Supabase URL, Publishable Key, Secret Key
- [x] Supabase Auth redirect URLs updated to production domain
- [x] Automated production smoke test: 7/7 checks passed
- [x] Manual verification passed: login, workspace, Settings, Vault hint, Rivhit connection, Sync to Cloud

**Status: LIVE IN PRODUCTION** — ready for tomorrow's clerk pilot.

---

## Blockers

None.
