# CURRENT TASK

## Refined Statuses + Expected Payment Date — Complete

**Status:** Complete
**Completed:** 2026-06-17
**Assigned to:** Claude Code

---

## Objective

Replace "הבטיח לשלם" with "ממתין לתשלום".
Add optional expected payment date per customer (ISO string, stored in CustomerStatus).
Date shown only when status = "מועמד לתשלום"; hidden but preserved for all other statuses.
Migrate existing localStorage entries silently on read.

---

## Deliverables

| Item | Result |
|------|--------|
| Replace `"הבטיח לשלם"` → `"ממתין לתשלום"` in union + array | Done ✓ |
| `expectedPaymentDate?: string` added to `CustomerStatus` | Done ✓ |
| Migrate-on-read in `readStatuses()` — writes back if changed | Done ✓ |
| `handleSaveExpectedDate` in AppShell | Done ✓ |
| Date picker in StatusSection (shown only for "מועמד לתשלום") | Done ✓ |
| Auto-save on `onChange`, no extra button | Done ✓ |
| Date hidden but preserved on status change | Done ✓ |
| All style maps updated (STATUS_PILL, STATUS_ROW_BORDER, STATUS_CHIP_ACTIVE) | Done ✓ |
| No new localStorage key | Done ✓ |
| `npm run lint` | Clean ✓ |
| `npm run build` | Clean, all pages static ✓ |

---

## Files Changed

- `src/types/status.ts` — renamed status, added `expectedPaymentDate?`
- `src/components/AppShell.tsx` — migrate-on-read, `handleSaveExpectedDate`, prop passthrough
- `src/components/CollectionsTable.tsx` — style maps updated, prop threaded
- `src/components/CustomerPanel.tsx` — date picker in StatusSection, style maps updated

---

## Next Task

To be defined by user.
