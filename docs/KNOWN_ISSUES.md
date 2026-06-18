# KNOWN ISSUES — PURE COLLECTIONS

> Track all known bugs, unresolved items, and technical debt.
> Close an issue by marking it ✅ and recording the fix commit.
> For roadmap context see [MASTER_STATUS.md](./MASTER_STATUS.md).

Last Updated: 2026-06-18 (BUG-001 + BUG-002 closed)

---

## Table of Contents

1. [Open Issues](#1-open-issues)
2. [Under Investigation](#2-under-investigation)
3. [Closed Issues](#3-closed-issues)

---

## 1. Open Issues

None currently.

---

## 2. Under Investigation

None currently.

---

## 3. Closed Issues

---

### CLOSED-004 · Net +30 Overdue Calculation Not Implemented (BUG-002)

**Severity:** Medium
**Closed:** 2026-06-18 — commit `725121a`
**Affects:** Aging bands, KPI cards, row colors, Customer Panel badges, WhatsApp/email drafts

**Root Cause:** `ageDays` was counting days from document date, not from the due date. The result was that recent invoices showed as yellow/red before the customer was actually late.

**Fix:** Added `computeDueDate()` in `CollectionsTable.tsx`. Due date = end of document month + 30 days (שוטף + 30). `ageDays` now counts days past that due date only. `toBand()` thresholds unchanged — the bands still represent 0–29 / 30–59 / 60+ days of actual overdue time.

**Business impact verified (18/06/2026):**
- Invoice 25/04/2026 (due 30/05/2026): was yellow (54d old) → now fresh (19d overdue) ✅
- Invoice 10/05/2026 (due 30/06/2026): was yellow (39d old) → now fresh (due date not yet reached) ✅
- Invoice 20/03/2026 (due 30/04/2026): was red (89d old) → now yellow (49d overdue) ✅

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
