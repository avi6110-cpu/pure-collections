# KNOWN ISSUES — PURE COLLECTIONS

> Track all known bugs, unresolved items, and technical debt.
> Close an issue by marking it ✅ and recording the fix commit.
> For roadmap context see [MASTER_STATUS.md](./MASTER_STATUS.md).

Last Updated: 2026-06-18 (BUG-001 closed)

---

## Table of Contents

1. [Open Issues](#1-open-issues)
2. [Under Investigation](#2-under-investigation)
3. [Closed Issues](#3-closed-issues)

---

## 1. Open Issues

---

### BUG-002 · Net +30 Overdue Calculation Not Implemented

**Severity:** Medium (functional gap, not crash)
**Status:** Open
**Discovered:** 2026-06-18
**Affects:** Aging bands, KPI cards, row colors, Customer Panel badges

**Description:**
The current `ageDays` calculation counts days from the document date. The intended business logic is Net +30: a document enters "overdue" status only after 30 days from the document date. Before day 30, it is current.

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

### CLOSED-003 · Customer Contact Carry-Over Bug (BUG-001)

**Severity:** High
**Closed:** 2026-06-18 — commit `e003b2d`
**Affects:** Customer Panel — all contact fields and communication section

**Symptom:** Switching customers showed both customers' contact sections and WhatsApp/Email buttons simultaneously — stale data from the previous customer remained visible.

**Root Cause:**
`CustomerPanel.tsx` used `startTransition(() => setSelectedDocs(defaults))` inside a `useEffect`. React's concurrent rendering mode kept the **old** CustomerPanel subtree in the DOM while mounting the new one, causing dual-render of all contact UI.

**Fix:**
1. `CollectionsTable.tsx` — added `key={selectedRow?.customerName ?? ""}` to `<CustomerPanel>`. Forces full unmount+remount on every customer switch; eliminates all state leakage by design.
2. `CustomerPanel.tsx` — replaced `useEffect` + `startTransition` for `selectedDocs` with a lazy `useState` initializer. No deferred transition needed when the component always mounts fresh.

**Verified:** Switched between 3 test customers (Alpha Tech, Beta Systems, Gamma Ltd) repeatedly. Each panel showed only the selected customer's data. No stale fields, no duplicate sections.

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
