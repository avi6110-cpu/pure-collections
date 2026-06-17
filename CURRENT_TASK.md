# CURRENT TASK

## Customer Activity Timeline V1 — Complete

**Status:** Complete
**Completed:** 2026-06-17
**Assigned to:** Claude Code

---

## Objective

Track what happened with each customer over time.
Automatic entries for status changes, WhatsApp opens, email opens.
Manual note input. Persisted in separate localStorage key.

---

## Deliverables

| Item | Result |
|------|--------|
| `src/types/activity.ts` — `ActivityType`, `ActivityEntry`, `ActivityLog` | Done ✓ |
| `pure-collections:activity` localStorage key (survives imports) | Done ✓ |
| Auto-entry on status change: `סטטוס שונה מ"X" ל"Y"` | Done ✓ |
| Auto-entry on WhatsApp open: `טיוטת WhatsApp נפתחה` | Done ✓ |
| Auto-entry on email open: `טיוטת אימייל נפתחה` | Done ✓ |
| Manual note input with "הוסף" button + Enter key support | Done ✓ |
| "יומן פעילות" section in Customer Panel | Done ✓ |
| Entries displayed newest-first | Done ✓ |
| Empty state: `אין פעילות מתועדת עדיין` | Done ✓ |
| Per-entry icon (◎ W @ •) + color by type | Done ✓ |
| Timestamp on each entry (he-IL short date + time) | Done ✓ |
| `key={customerName}` on ActivitySection — resets note input on customer switch | Done ✓ |
| Stale closure avoided — status change and activity logged in single setState | Done ✓ |
| `npm run lint` | Clean ✓ |
| `npm run build` | Clean, all pages static ✓ |

---

## Files Changed

- `src/types/activity.ts` — NEW
- `src/components/AppShell.tsx` — 4th localStorage key, `handleAddActivity`, inline activity in `handleSaveStatus`
- `src/components/CollectionsTable.tsx` — `activityLog` + `onAddActivity` props, `customerActivity` memo
- `src/components/CustomerPanel.tsx` — `ActivitySection`, updated `CommunicationSection`, new props

---

## Next Task

To be defined by user.
