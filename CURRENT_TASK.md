# CURRENT TASK

## CustomerPanel Default Selection Fix — Complete

**Status:** Complete
**Completed:** 2026-06-22
**Commit:** TBD

---

## Objective

The default document selection in CustomerPanel used `ageDays >= 30`, selecting only yellow/red band documents. For customers with large fresh invoices and small old invoices, this caused the panel to open with only the tiny overdue amount selected — e.g. ₪28 selected while ₪21,946 was missed. This created incorrect WhatsApp/Email communication risk.

## Deliverables

| Item | Result |
|------|--------|
| Initial `selectedDocs` filter updated to match "בחר הכל" | Done ✓ |
| Credit invoices excluded from initial selection | Done ✓ |
| All non-paid non-credit docs selected by default | Done ✓ |
| דרכא: 9 ייכללו, ₪21,974.20 (was ₪28) | Done ✓ |
| הנהלת בתי המשפט: 1 ייכללו (was 0) | Done ✓ |
| Credit cards remain unselectable (no checkbox) | Done ✓ |
| `npx tsc --noEmit` | Zero errors ✓ |
| `npx next build` | Clean ✓ |

## Files Changed

- `src/components/CustomerPanel.tsx` — removed `ageDays >= 30` from initial selection filter; added `CREDIT_INVOICE_TYPE` exclusion

---

## Previous Task

KPI Band Alignment Fix — Complete (2026-06-22, commit 4ac65c7)

---

## Objective

Aging-band KPI cards (60+, 30–60, <30) were computing from `enriched` (all 481 rows including credit invoices), while the table body was computing from `tableRows` (256 actionable invoices). This caused a negative 60+ balance (−₪42,523) and a KPI/table count mismatch (250 vs 51 rows).

## Deliverables

| Item | Result |
|------|--------|
| Band KPI balances sourced from `tableRows` | Done ✓ |
| Band KPI counts sourced from `tableRows` | Done ✓ |
| Main KPI net balance stays on `enriched` | Done ✓ |
| 60+ click → table shows same count | 51 = 51 ✓ |
| 30–60 click → table shows same count | 9 = 9 ✓ |
| No negative KPI values | Done ✓ |
| `npx tsc --noEmit` | Zero errors ✓ |
| `npx next build` | Clean ✓ |

## Files Changed

- `src/components/CollectionsTable.tsx` — moved `tableRows` before `summary`; split `summary` into two passes: `enriched` for `totalBalance`, `tableRows` for all band KPIs and counts

---

## Previous Task

Credit Invoice Exclusion from Work Queue — Complete (2026-06-22, commit 3c90168)

---

## Next Task

To be defined by user.

---

## Credit Invoice Exclusion from Work Queue — Complete

**Status:** Complete
**Completed:** 2026-06-22
**Commit:** 3c90168

---

## Objective

Credit invoices (חשבונית מס זיכוי) are accounting context documents, not actionable
collection tasks. Exclude them from the main collections table while keeping them
visible inside CustomerPanel as read-only context, and preserving their negative
remainingBalance values in all KPI and customer balance calculations.

---

## Deliverables

| Item | Result |
|------|--------|
| `CREDIT_INVOICE_TYPE` constant exported from `parseRivhit.ts` | Done ✓ |
| `tableRows` useMemo excludes credit invoices from main table display pipeline | Done ✓ |
| `enriched` (KPI source) unchanged — net balance math preserved | Done ✓ |
| `customerRows` sourced from `enriched` — customer panel totals include credits | Done ✓ |
| "מתוך" denominator uses `tableRows.length` (non-credit count) | Done ✓ |
| `selectAll` excludes credit invoices from selection | Done ✓ |
| Credit DocCard: gray background, no checkbox, no status picker, no follow-up badge | Done ✓ |
| Credit DocCard: "זיכוי" label, eye/preview button retained | Done ✓ |
| `npx tsc --noEmit` | Zero errors ✓ |
| `npx next build` | Clean ✓ |

---

## Files Changed

- `src/lib/parseRivhit.ts` — added `CREDIT_INVOICE_TYPE` constant
- `src/components/CollectionsTable.tsx` — `tableRows` useMemo, redirected `bandFiltered`, fixed denominator
- `src/components/CustomerPanel.tsx` — `selectAll` filter, credit DocCard early-return branch

---

## Previous Task

"במחלוקת" Dispute Status — Complete (2026-06-22, commit dfd5190)

---

## Next Task

To be defined by user.
