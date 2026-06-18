# KNOWN ISSUES — PURE COLLECTIONS

> Track all known bugs, unresolved items, and technical debt.
> Close an issue by marking it ✅ and recording the fix commit.
> For roadmap context see [MASTER_STATUS.md](./MASTER_STATUS.md).

Last Updated: 2026-06-18

---

## Table of Contents

1. [Open Issues](#1-open-issues)
2. [Under Investigation](#2-under-investigation)
3. [Closed Issues](#3-closed-issues)

---

## 1. Open Issues

---

### BUG-001 · Customer Contact Carry-Over Bug

**Severity:** High
**Status:** Open
**Discovered:** 2026-06-18
**Affects:** Contact data persistence across report imports

**Description:**
In certain scenarios, customer contacts do not survive a report re-import correctly. The exact reproduction path is not fully confirmed, but the symptom is that contacts entered via the Customer Panel are not visible after importing a new Excel file or triggering an API sync.

**Expected behavior:**
Contacts stored in `pure-collections:contacts` (localStorage) must never be overwritten or reset by any import operation. The `handleImport` function in `AppShell.tsx` explicitly avoids writing the contacts key — it only calls `readContacts()` after import and sets the workspace state from it.

**Hypotheses:**
- The bug may only occur when the user imports while the Customer Panel is open (stale state in panel)
- It may be a race condition between `writeContacts` (from API sync contact autofill) and `readContacts` (in `handleImport`) when both happen in quick succession during an API sync
- It may be a browser localStorage serialization issue on certain data

**Reproduction steps (unconfirmed):**
1. Enter contacts for 2–3 customers
2. Trigger a new API sync or Excel import
3. Observe whether contacts are still visible in Customer Panel

**Fix approach:**
- Add a reproduction test with explicit localStorage state inspection before and after import
- Review `handleApiSync` — Step 6 calls `handleImport(rows, "api")` which calls `readContacts()`. If `writeContacts(merged)` in Step 5 and `readContacts()` in Step 6 race, contacts may be read before write completes. Verify sequence is strictly synchronous.

**Files to examine:**
- `src/components/AppShell.tsx` — `handleApiSync`, `handleImport`, `readContacts`, `writeContacts`

---

### BUG-002 · Net +30 Overdue Calculation Not Implemented

**Severity:** Medium (functional gap, not crash)
**Status:** Open
**Discovered:** 2026-06-18
**Affects:** Aging bands, KPI cards, row colors, Customer Panel badges

**Description:**
The current `ageDays` calculation counts days from the document date. The intended business logic is Net +30: a document enters "overdue" status only after 30 days from the document date. Before day 30, it is current.

**Current behavior:**
- A document dated yesterday shows `ageDays = 1` → gray (current) ✓
- A document dated 25 days ago shows `ageDays = 25` → gray (current) — **should still be current** ✓
- A document dated 35 days ago shows `ageDays = 35` → amber (overdue) — **correct under Net +30** ✓
- A document dated 20 days ago shows `ageDays = 20` → gray — **correct** ✓

**Wait — re-examining:**
The current bands are: <30d gray, 30–60d amber, 60+d red.
Under Net +30, "overdue" starts at day 30 from document date. This is actually consistent with the current bands.

**The real gap:** The label "זמן חריגה" (overdue time) implies time *past* the due date. The due date is document date + 30. So `ageDays` should be `max(0, daysSinceDocumentDate - 30)` for display. A document 35 days old has been overdue for 5 days, not 35.

**Impact:**
- The displayed "זמן חריגה" value overstates overdue time by 30 days for all documents
- KPI cards showing 60+d documents are actually showing 90+d documents (60 days overdue = 90 days since document date)
- Customer Panel "max overdue days" is inflated

**Fix approach:**
In `src/components/CollectionsTable.tsx`, in the `enriched` memo where `ageDays` is computed:
```ts
// Current:
ageDays: Math.floor((now - row.documentDateMs) / MS_PER_DAY)

// Corrected (Net +30):
ageDays: Math.max(0, Math.floor((now - row.documentDateMs) / MS_PER_DAY) - 30)
```

Band thresholds remain the same: <30 (overdue <30d), 30–60, 60+.

**Requires decision:** Confirm whether the 30-day offset should apply to all documents or only those without an explicit due date in the Rivhit data.

---

## 2. Under Investigation

None currently.

---

## 3. Closed Issues

---

### CLOSED-001 · "הבטיח לשלם" Status Data Migration

**Severity:** Medium
**Closed:** 2026-06-17 — commit `98d8ace` (v0.12.0)

**Description:** The collection status "הבטיח לשלם" was renamed to "ממתין לתשלום". Existing localStorage data stored the old string value.

**Fix:** Migrate-on-read in `readStatuses()` — detects the old value, remaps, writes back immediately. Silent and one-time.

---

### CLOSED-002 · WhatsApp Message 10-Document Cap

**Severity:** Low
**Closed:** 2026-06-17 — commit `3ee4533` (v0.13.0)

**Description:** `buildWhatsAppMessage` had a hard cap of 10 documents (`WA_DOC_LIMIT`) and appended "ועוד N מסמכים נוספים". This was inconsistent with the document selection feature.

**Fix:** Removed cap entirely. Message now includes exactly the documents the caller passes. Document selection is the user's control mechanism.
