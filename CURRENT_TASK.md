# CURRENT TASK

## Collections Work Table V1 (with Persistence) — Complete

**Status:** Complete
**Completed:** 2026-06-16
**Assigned to:** Claude Code

---

## Objective

Upgrade the collections screen into a real persistent workspace:
- Remove operational noise (Due Date, Reference)
- Rename "גיל חוב" → "זמן חריגה"
- Add sort on all visible columns
- Add localStorage persistence so the app reopens directly into the workspace

---

## Deliverables

| Item | Result |
|------|--------|
| Remove Due Date column | Done — field kept in RivhitRow for future use ✓ |
| Remove Reference column | Done — field kept in RivhitRow for future use ✓ |
| Rename column header | גיל חוב → זמן חריגה ✓ |
| Sort on all 6 visible columns | Click header to sort asc/desc; active column highlighted ✓ |
| localStorage persistence | `pure-collections:report` key, survives browser close ✓ |
| AppShell top-level state | loading → upload | workspace; `startTransition` for hydration ✓ |
| UploadForm pure UI | Accepts `onImport` + optional `onCancel` props only ✓ |
| CollectionsTable `importedAt` | Shows "עודכן: …" timestamp in top bar ✓ |
| "ייבוא דוח חדש" does not clear data | localStorage untouched until new import succeeds ✓ |
| New import replaces stored report in full | No merge logic needed ✓ |
| Back-to-workspace button | "→ חזרה לרשומות" shown when canCancel=true ✓ |
| `npm run lint` | Clean ✓ |
| `npm run build` | Clean, all pages static ✓ |

---

## Files Changed

- `src/components/AppShell.tsx` — NEW: top-level persistence/routing shell
- `src/app/upload/page.tsx` — now renders `<AppShell />`
- `src/components/UploadForm.tsx` — pure UI, `onImport` + `onCancel` props
- `src/components/CollectionsTable.tsx` — 6 columns, sort, `importedAt`, זמן חריגה

---

## Next Task

To be defined. Candidates:
- Column sort (already done!)
- Row detail / debtor panel (reference & due date available from RivhitRow)
- Export filtered view to CSV
