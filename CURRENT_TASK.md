# CURRENT TASK

## "במחלוקת" Dispute Status — Complete

**Status:** Complete
**Completed:** 2026-06-22
**Commit:** dfd5190

---

## Objective

Add a per-document "במחלוקת" (dispute) status to the collection workflow.
Disputed documents remain in totals and aging — dispute is a workflow flag, not a KPI.

---

## Deliverables

| Item | Result |
|------|--------|
| `"במחלוקת"` added to `CollectionStatus` union and `ALL_STATUSES` | Done ✓ |
| Orange filter chip in status row | Done ✓ |
| Orange row background in main table | Done ✓ |
| Orange DocCard background in CustomerPanel | Done ✓ |
| Mandatory dispute note before saving status | Done ✓ |
| Activity log entry written on confirm (`סומן כ׳במחלוקת׳: <note>`) | Done ✓ |
| Disputed docs included in `totalBalance` and aging bands | Done ✓ |
| No dedicated KPI card (workflow status, not top-level metric) | Done ✓ |
| Paid auto-deselect still works; WhatsApp/email flows unchanged | Done ✓ |
| `npx tsc --noEmit` | Zero errors ✓ |
| `npx next build` | Clean ✓ |

---

## Files Changed

- `src/types/status.ts` — added `"במחלוקת"` to union and array
- `src/components/CollectionsTable.tsx` — filter chip, row styling, STATUS maps
- `src/components/CustomerPanel.tsx` — dispute note flow, DocCard orange styling, activity log

---

## Next Task

To be defined by user.
