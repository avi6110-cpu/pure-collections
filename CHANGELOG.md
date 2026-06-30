# CHANGELOG

All notable changes to PURE COLLECTIONS are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

<!-- New entries go here until a version is tagged -->

---

## [0.28.0] — 2026-06-30 — Production Deployment to Vercel

### Added
- Vercel project `pure-collections/pure-collections` created and linked to GitHub
- Production URL: https://pure-collections.vercel.app
- Three encrypted environment variables set in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
- Supabase Auth redirect URLs updated to production domain
- `.env.local` on home machine updated to new Supabase API key variable names (`PUBLISHABLE_KEY` / `SECRET_KEY`)
- `.env*` added to `.gitignore` (Vercel CLI addition — broader catch-all alongside existing specific entries)

### Verified
- Automated production smoke test: 7/7 checks pass (redirect, login page, Hebrew content, route protection ×2, API 401, callback)
- Manual production verification: login, workspace, Settings, Vault token hint, Rivhit connection test, Sync to Cloud — all working

---

## [0.27.0] — 2026-06-30 — Pilot Readiness QA

### Added
- Playwright smoke suite: `playwright.config.ts`, `tests/pilot-qa.spec.ts`
- 15 automated tests across two isolated browser contexts (Ben/owner, Clerk/clerk)

### Fixed
- Missing `GRANT` statements for `authenticated` and `service_role` on all 7 tables — PostgreSQL was returning error 42501 before RLS was evaluated
- Migration file updated with complete table-privilege section
- Supabase API key format migrated to new `sb_publishable_` / `sb_secret_` format

---

## [0.26.0] — 2026-06-29 — Cloud Foundation: Supabase Session 1

### Added
- Supabase project provisioned in eu-central-1 (Frankfurt) — project ref `rlkanhhisiftqgdeugvb`
- Multi-tenant PostgreSQL schema: `tenants`, `users`, `rivhit_credentials`, `document_statuses`, `customer_contacts`, `activity_log`, `sync_log`
- `tenants.features` (jsonb, default `{}`) — per-tenant feature flags for future gated capabilities
- `tenants.outgoing_email` — business-level sender address, decoupled from individual user accounts
- `user_role` enum: `owner`, `manager`, `clerk`
- 9 performance indexes on all frequently-queried columns
- Row Level Security enabled on all 7 tables — 16 policies enforce strict tenant isolation
- `auth_tenant_id()` and `auth_user_role()` SECURITY DEFINER helper functions
- `upsert_rivhit_token()` and `get_rivhit_token()` Vault functions — token stored encrypted server-side, never exposed to browser; restricted to `service_role` only
- Three users seeded: Avi (owner), Ben (owner), Clerk (clerk) — all linked to `Pure Water Systems` tenant
- `supabase` CLI installed as dev dependency
- `supabase/migrations/20260629000000_initial_schema.sql` — baseline migration (idempotent, additive-only)

---

## [0.25.0] — 2026-06-22 — Business-Days Today Follow-Up Grace Period

### Fixed
- Today Follow-Up grace period now uses business days (Sunday–Thursday in Israel) instead of calendar days. A document whose follow-up date falls on a Friday will not carry over the weekend as overdue; weekends are skipped.
- `isTodayFollowUp()` in `src/lib/followUp.ts` updated to count only working days.

---

## [0.24.0] — 2026-06-22 — Urgency-First Default Sort

### Changed
- Default table sort order changed from alphabetical by customer name to urgency-first: red band (60+ days) rows first, then yellow (30–60 days), then fresh (<30 days). Within each band, rows sorted by remaining balance descending.
- `BAND_RANK` map introduced in `sortRows()` in `CollectionsTable.tsx` to group by aging band before comparing balance.

---

## [0.23.0] — 2026-06-22 — CustomerPanel Default Selection Fix

### Fixed
- Default document selection in CustomerPanel changed from "docs ≥ 30 days overdue" to "all non-credit, non-paid open documents." The previous logic caused the panel to open with only a tiny overdue amount selected when a customer had large fresh invoices alongside a small old one (e.g. ₪28 selected instead of ₪21,974).
- Credit invoices are excluded from the default selection.

---

## [0.22.0] — 2026-06-22 — Today Follow-Up Filter

### Added
- "לטיפול היום" filter chip in the collections workspace — filters the table to rows where a follow-up date is set and falls on today or earlier.
- `isTodayFollowUp(date: string): boolean` and `todayDateStr(): string` exported from new `src/lib/followUp.ts`.
- Both `CollectionsTable.tsx` and `CustomerPanel.tsx` import from `followUp.ts`.

---

## [0.21.0] — 2026-06-22 — Per-Document Dispute Status

### Added
- `"במחלוקת"` (disputed) added to `DocumentStatus` union in `src/types/status.ts`.
- Documents marked as disputed receive distinct orange visual treatment in both the workspace table row and in the CustomerPanel document list.

---

## [0.20.0] — 2026-06-22 — KPI Band Alignment Fix

### Fixed
- Aging-band KPI cards (60+, 30–60, <30) now source balances and record counts from `tableRows` (256 actionable invoices) instead of `enriched` (481 rows). Previously, credit invoices in the red band produced a negative 60+ balance (−₪42,523) and a KPI/table mismatch (250 records shown, 51 in table).
- Main KPI net balance (₪637,624) remains sourced from `enriched` — Rivhit source of truth preserved.
- `tableRows` declaration moved before `summary` useMemo to resolve dependency order.

### Before / After
| KPI | Before | After |
|---|---|---|
| 60+ יום | −₪42,523 · 250 records | ₪98,981 · 51 records |
| 30–60 יום | ₪26,327 · 19 records | ₪29,804 · 9 records |
| <30 יום | ₪653,820 · 212 records | ₪659,076 · 196 records |
| Main net | ₪637,624 · 481 count | ₪637,624 · 256 count |

---

## [0.19.0] — 2026-06-22 — Credit Invoice Exclusion from Work Queue

### Changed
- Main collections table now shows only actionable documents; credit invoices (חשבונית מס זיכוי) are filtered out via a new `tableRows` useMemo that sits between `enriched` and `bandFiltered`
- `enriched` (KPI source) and `customerRows` (CustomerPanel source) are unchanged — net balance math and customer panel totals continue to include credit invoice negative values exactly as Rivhit provides them
- "מתוך N" denominator in table footer uses `tableRows.length` (non-credit count) rather than `summary.totalRows`
- `selectAll` in CustomerPanel now excludes credit invoices from checkbox selection
- Credit invoice DocCards in CustomerPanel render as read-only context: neutral gray background, alignment placeholder instead of checkbox, no status picker, no "לטיפול היום" badge, no opacity-40 effect, "זיכוי" label badge; eye/preview button retained

### Added
- `CREDIT_INVOICE_TYPE = "חשבונית מס זיכוי"` constant exported from `src/lib/parseRivhit.ts` (single source of truth used by both components)

---

## [0.13.0] — 2026-06-17 — Document Selection for Communication Drafts

### Added
- `docKey(doc)` helper — composite key `documentType|documentNumber|documentDate`; prevents collisions when different document types share a number
- `selectedDocs: Set<string>` state in `CustomerPanel` — resets via `useEffect` (with `startTransition`) whenever `customerName` or `customerRows` changes
- Per-document checkboxes in the document list — `<label>` wrapper makes the entire card row clickable; unchecked cards rendered at `opacity-40`
- Selection controls in document list header: "N ייכללו · בחר הכל · נקה"
- `selectAll` / `deselectAll` / `toggleDoc` functions
- `selectedRows` memo — filters `customerRows` to checked keys; passed to `CommunicationSection` in place of `customerRows`

### Changed
- `CommunicationSection` — receives `selectedRows` instead of `customerRows`; WhatsApp and Email buttons disabled when `selectedRows.length === 0`; tooltip priority: "לא נבחרו מסמכים לשליחה" (no selection) takes precedence over "הוסף טלפון/אימייל" (missing contact)
- `buildWhatsAppMessage` — removed `WA_DOC_LIMIT = 10` cap and "ועוד N מסמכים נוספים" line; message is built from whatever rows the caller passes
- Default selection: `ageDays >= 30` (yellow + red bands) selected; `ageDays < 30` (fresh) unselected
- React key on `DocCard` changed from `doc.documentNumber` to `docKey(doc)` for correctness

### Verified
- `npm run lint` — clean
- `npm run build` — clean, all pages static

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
