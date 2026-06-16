# CURRENT TASK

## Upload Screen Skeleton

**Status:** In Progress
**Started:** 2026-06-16
**Assigned to:** Claude Code

---

## Objective

Implement a basic file-upload UI on `/upload`. Client-side only.
Allow selecting an `.xlsx` file, show file name and size, and validate the selection.
No file parsing, no database, no Prisma, no auth.

---

## Completed Steps

1. [x] Scaffold verification passed (all routes 200, lint clean, build clean)
2. [ ] Create `src/components/UploadForm.tsx` — client component
3. [ ] Update `src/app/upload/page.tsx` — import UploadForm
4. [ ] lint + build pass
5. [ ] Commit

---

## Validation Rules

- File extension must be `.xlsx`
- File size must be ≤ 20 MB
- Show error message in Hebrew if invalid
- Show success state and file details if valid

## Constraints

- No xlsx parsing
- No server actions
- No API routes
- No database
