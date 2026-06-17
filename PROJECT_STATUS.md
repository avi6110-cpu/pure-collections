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

---

## Blockers

None.
