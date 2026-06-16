# CHANGELOG

All notable changes to PURE COLLECTIONS are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

<!-- New entries go here until a version is tagged -->

---

## [0.6.0] — 2026-06-16 — Collections Work Table V1 with Persistence

### Added
- `src/components/AppShell.tsx` — top-level state owner:
  - Reads `localStorage` key `pure-collections:report` on mount via `startTransition`
  - `loading` → `upload` (first run) or `workspace` (returning user)
  - `handleImport`: writes new report to localStorage, transitions to workspace
  - `handleRequestNewImport`: switches to upload without clearing localStorage
  - `handleCancelUpload`: reads saved report back, returns to workspace
- "→ חזרה לרשומות" link in `UploadForm` when `onCancel` prop is provided

### Changed
- `src/app/upload/page.tsx` — renders `<AppShell />` (replaces `<UploadForm />`)
- `src/components/UploadForm.tsx` — pure upload UI: accepts `onImport` + optional `onCancel`; no longer owns workspace state
- `src/components/CollectionsTable.tsx`:
  - Removed Due Date column (field retained in `RivhitRow` for future detail view)
  - Removed Reference column (field retained in `RivhitRow` for future detail view)
  - Renamed "גיל חוב" → "זמן חריגה"
  - Sort on all 6 visible columns: שם לקוח, יתרה לתשלום, זמן חריגה, מסמך, מס׳ מסמך, תאריך מסמך
  - Column header click toggles asc/desc; active column shows ↑/↓ in blue
  - Accepts `importedAt: number` prop; renders "עודכן: …" timestamp in top bar
  - Prop renamed: `onReset` → `onNewImport`

### Verified
- `npm run lint` — clean
- `npm run build` — clean, all pages static

---

## [0.5.0] — 2026-06-16 — Collections Work Table V1

### Changed
- `src/app/upload/page.tsx` — simplified to bare `<UploadForm />` (removed `max-w-xl` wrapper)
- `src/components/UploadForm.tsx` — dual-mode layout:
  - Upload mode: centered card (idle / parsing / error)
  - Workspace mode: renders `<CollectionsTable rows onReset>` directly, covering full screen
  - "ייבוא הקובץ" button label stays in upload mode; workspace gets its own "ייבוא דוח חדש" button
- `src/components/CollectionsTable.tsx` — full workspace redesign:
  - Full-screen layout: `h-screen flex-col`, table fills remaining height with sticky header
  - Column order: שם לקוח, יתרה לתשלום, גיל חוב, מסמך, מס׳ מסמך, אסמכתא, תאריך מסמך, תאריך פרעון
  - Remaining Balance: `text-base font-bold`, colored red (60+ band or negative), green (credit)
  - Aging badges: gray <30d, amber 30–60d, red 60+d
  - Summary cards: Primary blue card = יתרה לגבייה מיידית (total), plus 60+d / 30–60d / total rows
  - New `onReset` prop — top-bar "ייבוא דוח חדש" button triggers reset to upload mode
  - Source data fidelity preserved: no merging, no hiding, no modification

### Verified
- `npm run lint` — clean
- `npm run build` — clean, all pages static

---

## [0.4.1] — 2026-06-16 — Import Engine V0 Confirmation Pass

### Verified (no code changes)
- Canonical file confirmed: `דוח גבייה דוגמה.xlsx` (727 rows, 2 sheets)
- Active sheet: `מסמכים לתשלום`; `גיליון1` unused
- Header row at index 8; repeats 37× across month sections
- All 9 column positions confirmed correct (no drift)
- Data-row filter (`col[7]` is numeric) yields exactly 492 rows, 0 false positives
- Non-data rows (blanks, month headers, repeated header rows, subtotals) all excluded
- 222 credit note rows (`חשבונית מס זיכוי`), negative totals handled correctly
- 0 rows with missing dates, names, document types, or document numbers
- `npm run lint` clean; `npm run build` clean

---

## [0.4.0] — 2026-06-16 — Upload Screen Skeleton

### Added
- `src/components/UploadForm.tsx` — client component: `.xlsx`-only file picker,
  20 MB size cap, shows filename + size, Hebrew error/success messages,
  submit button disabled until valid file selected
- `src/app/upload/page.tsx` — updated from placeholder to full upload screen

---

## [0.3.1] — 2026-06-16 — Scaffold Verification Pass

### Verified
- All four routes (`/`, `/work`, `/upload`, `/settings`) return HTTP 200
- `npm run lint` — clean, zero warnings
- `npm run build` — clean, all pages compile as static, zero warnings
- Hebrew RTL content renders correctly in browser

---

## [0.3.0] — 2026-06-16 — Phase 0: App Foundation Scaffold

### Added
- Next.js 16.2.9, React 19, Tailwind v4, ESLint 9, TypeScript 5 (App Router, src/ layout)
- `tsconfig.json`: strict mode + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- `src/app/layout.tsx`: RTL Hebrew root layout (`lang="he"`, `dir="rtl"`, system font)
- `src/app/page.tsx`: בית (Home) placeholder
- `src/app/work/page.tsx`: עבודה (Work) placeholder
- `src/app/upload/page.tsx`: העלאת דוח (Upload Report) placeholder
- `src/app/settings/page.tsx`: הגדרות (Settings) placeholder

---

## [0.2.0] — 2026-06-16 — Phase 0: AI Collaboration Contract

### Added
- `CLAUDE.md` — AI collaboration contract: phase gate rules, commit conventions,
  file/folder structure, never-do list, always-do list, memory pointer, session checklist

---

## [0.1.0] — 2026-06-16 — Phase 0: Repository Bootstrap

### Added
- Git repository initialized (`8efb453`)
- `README.md` — project overview, tech stack, and 5-phase roadmap
- `PROJECT_STATUS.md` — phase tracker, decisions log, and blockers
- `CURRENT_TASK.md` — active task tracking with per-task checklists
- `CHANGELOG.md` — this file, following Keep a Changelog format
- `.gitignore` — Node.js / Next.js standard ignores
