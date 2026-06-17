# CHANGELOG

All notable changes to PURE COLLECTIONS are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

<!-- New entries go here until a version is tagged -->

---

## [0.12.0] — 2026-06-17 — Refined Statuses + Expected Payment Date

### Changed
- `src/types/status.ts` — replaced `"הבטיח לשלם"` with `"ממתין לתשלום"` in `CollectionStatus` union and `ALL_STATUSES`; added `expectedPaymentDate?: string` (ISO "YYYY-MM-DD") to `CustomerStatus`
- `src/components/AppShell.tsx` — migrate-on-read in `readStatuses()`: detects legacy `"הבטיח לשלם"` entries, remaps to `"ממתין לתשלום"`, writes back immediately (one-time, silent); new `handleSaveExpectedDate(customerName, date)` handler — writes updated `CustomerStatus` without touching other fields; clears field by omitting it rather than storing `undefined`; passes handler to table
- `src/components/CollectionsTable.tsx` — renamed key in `STATUS_ROW_BORDER` and `STATUS_CHIP_ACTIVE`; threads `onSaveExpectedDate` prop through to `CustomerPanel`
- `src/components/CustomerPanel.tsx` — renamed key in `STATUS_PILL`; `StatusSection` now renders `type="date"` input below status pills when `effectiveStatus === "מועמד לתשלום"`; auto-saves on `onChange`; hidden for all other statuses; stored date reappears if customer returns to `"מועמד לתשלום"`

### Verified
- `npm run lint` — clean
- `npm run build` — clean, all pages static

---

## [0.11.0] — 2026-06-17 — Customer Activity Timeline

### Added
- `src/types/activity.ts` — `ActivityType` union (`status_changed | whatsapp_opened | email_opened | manual_note`), `ActivityEntry` interface (`id, type, text, createdAt`), `ActivityLog = Record<string, ActivityEntry[]>`
- `pure-collections:activity` localStorage key — separate from report/contacts/status; never overwritten on import
- Automatic activity entries:
  - Status change → `סטטוס שונה מ"X" ל"Y"` (old + new status, skipped when status is set to the same value)
  - WhatsApp draft open → `טיוטת WhatsApp נפתחה`
  - Email draft open → `טיוטת אימייל נפתחה`
- `ActivitySection` in `CustomerPanel` — note input with "הוסף" / Enter, entries shown newest-first, per-type icon (◎ W @ •) + color, he-IL short timestamp, `max-h-40` scroll, empty state text
- `handleAddActivity(customerName, type, text)` in `AppShell` for external callers

### Changed
- `AppShell.tsx` — 6-field workspace state adds `activityLog`; `handleSaveStatus` inlines activity entry to avoid stale-closure conflict (single `setState` updates both `statuses` and `activityLog`); all import/cancel paths read all 4 localStorage keys; passes `activityLog` + `onAddActivity` to `CollectionsTable`
- `CollectionsTable.tsx` — `activityLog` + `onAddActivity` props; `customerActivity` memo per selected customer; both passed to `CustomerPanel`
- `CustomerPanel.tsx` — `activityEntries` + `onAddActivity` props; `CommunicationSection` calls `onAddActivity` after WhatsApp/email opens; `ActivitySection` added after document list; `key={customerName}` resets note input on customer switch

### Verified
- `npm run lint` — clean
- `npm run build` — clean, all pages static

---

## [0.10.0] — 2026-06-17 — Customer Collection Status

### Added
- `src/types/status.ts` — `CollectionStatus` union (5 statuses), `ALL_STATUSES` constant, `CustomerStatus` interface, `StatusMap`
- `StatusSection` in `CustomerPanel` — 5 colored pill buttons, one-click saves, purely controlled (no edit-mode toggle); `STATUS_PILL` map with active (solid fill) and inactive (tinted border) styles
- Status filter chip strip in `CollectionsTable` search section (always visible row 2); toggle on click; `STATUS_CHIP_ACTIVE` color map
- 4px colored right border on שם לקוח cell per row, reflecting customer status at a glance (`STATUS_ROW_BORDER` map; empty for לא טופל)
- `pure-collections:status` localStorage key with `readStatuses()` / `writeStatuses()` in AppShell

### Changed
- `AppShell.tsx` — `statuses: StatusMap` added to workspace state; `handleImport` never writes status key; new `handleSaveStatus(customerName, status)` handler; all workspace setState calls carry 5 fields
- `CollectionsTable.tsx` — `statusFiltered` memo between band and search filters; `"לא טופל"` filter matches both explicit and undefined entries; `customerStatus` computed and passed to panel; "נקה הכל" resets both filters
- Filter pipeline: enriched → bandFiltered → statusFiltered → searched → sorted (AND logic throughout)
- KPI totals still computed from full `enriched` set — unaffected by any filter

### Verified
- `npm run lint` — clean
- `npm run build` — clean, all pages static

---

## [0.9.0] — 2026-06-17 — Customer Contacts + KPI Filters

### Added
- `src/types/contacts.ts` — `CustomerContact` interface (contactPerson, phone, email, notes, updatedAt) and `ContactMap = Record<string, CustomerContact>`
- `ContactSection` in `CustomerPanel` — view + edit modes for customer contact data:
  - View mode: shows saved fields, "עריכה" / "+ הוסף" button
  - Edit mode: 4 inputs + textarea for notes, שמור / ביטול buttons
  - `key={customerName}` on component causes automatic state reset when customer changes
  - `startEdit()` re-initializes draft from current prop so re-edit always reflects latest save
- KPI card filters in `CollectionsTable`:
  - Red card → filter to 60+ day rows; yellow card → 30–60 day rows; primary/neutral → reset
  - Toggle behavior: clicking an active filter resets to "all"
  - Active filter pill in search bar row with ✕ to clear
  - AND logic: band filter + search filter combined
  - Summary cards always reflect full unfiltered report totals

### Changed
- `AppShell.tsx`:
  - New `pure-collections:contacts` localStorage key with `readContacts()` / `writeContacts()`
  - `contacts: ContactMap` added to workspace state
  - `handleImport` never touches the contacts key — data persists across report imports
  - New `handleSaveContact(customerName, contact)` — merges one entry, writes contacts key only
- `CollectionsTable.tsx`:
  - Accepts `contacts: ContactMap` and `onSaveContact` props
  - Computes `customerContact` for selected customer and passes to `CustomerPanel`
  - Count display shows band-scoped total when filter is active

### Verified
- `npm run lint` — clean
- `npm run build` — clean, all pages static

---

## [0.8.0] — 2026-06-16 — Customer Detail Panel

### Added
- `src/components/CustomerPanel.tsx` — customer-scoped slide-over panel:
  - Header: customer name + ✕ close button (Escape key also closes)
  - 2×2 summary grid: total open balance, open document count, max overdue days, 60+ balance
  - Scrollable document list sorted by `ageDays` descending (most overdue first)
  - Each document shown as a card: type · number, balance, dates, aging badge
  - Aging band colours on cards (amber/red); blue highlight on the clicked document
  - Clicking the same row a second time closes the panel

### Changed
- `src/components/CollectionsTable.tsx`:
  - Adds `customerRows` memo — filters all enriched rows by `selectedRow.customerName`
  - Row click toggles panel (clicking selected row closes it)
  - Passes `customerRows`, `clickedRow`, `onClose` to `CustomerPanel`

### Removed
- `src/components/DebtorPanel.tsx` — replaced by `CustomerPanel`; product concept changed from single-document to customer-scoped detail

### Verified
- `npm run lint` — clean
- `npm run build` — clean, all pages static

---

## [0.7.0] — 2026-06-16 — Debtor Detail Slide-Over Panel

### Added
- `src/types/collections.ts` — shared `AgingBand` and `EnrichedRow` types (extracted from CollectionsTable so DebtorPanel can import them without circular deps)
- `src/components/DebtorPanel.tsx` — fixed-position right-side slide-over panel:
  - Slides in with `translate-x-full → translate-x-0`, `duration-200`
  - Sections: customer header + ✕ close button, balance & aging strip, document details grid (2-col), financial summary with highlighted יתרה footer
  - Closes via ✕ button or Escape key
  - Read-only; no notes/status/history
  - `paidAmount` labelled as "סכום ששולם / נסגר"

### Changed
- `src/components/CollectionsTable.tsx`:
  - Imports `AgingBand` and `EnrichedRow` from `@/types/collections`
  - Adds `selectedRow: EnrichedRow | null` state and stable `closePanel` via `useCallback`
  - Table rows: `cursor-pointer`, `bg-blue-50` highlight on selected row
  - Renders `<DebtorPanel row={selectedRow} onClose={closePanel} />` at component root

### Verified
- `npm run lint` — clean
- `npm run build` — clean, all pages static

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
