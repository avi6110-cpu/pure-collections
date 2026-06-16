# CLAUDE.md — AI Collaboration Contract
# PURE COLLECTIONS

This file governs how Claude Code operates in this repository.
Read it before every session. Follow it without exception.

---

## Project Identity

- **Name:** PURE COLLECTIONS
- **Type:** Curated e-commerce platform
- **Stack:** Next.js (App Router), TypeScript, Tailwind CSS
- **Owner:** Avi (avi6110@gmail.com)
- **Repo:** Local only — no remote configured yet
- **Sibling project:** PURE_QUOTES (separate repo, never touch it from here)

---

## Phase Gate Rules

Work is organized into sequential phases. Each phase has tasks.
**Never begin a new phase or task without explicit user approval.**

| Phase | Name | Gate |
|-------|------|------|
| 0 | Repository Bootstrap | Approved |
| 1 | Next.js Scaffold | Requires approval |
| 2 | Core UI & Layout | Requires approval |
| 3 | Product Catalog | Requires approval |
| 4 | Cart & Checkout | Requires approval |
| 5 | Launch | Requires approval |

Within a phase:
- Propose the next task first, with a summary of what it will do.
- Wait for "Approved" before executing.
- Complete one task fully before proposing the next.

---

## Commit Rules

- Every commit must be approved by the user before it is made,
  unless the user explicitly says "go ahead and commit."
- Commit message format:

  ```
  <type>: <short imperative description>

  <optional body — one paragraph max>

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```

- Allowed types: `chore`, `feat`, `fix`, `docs`, `style`, `refactor`, `test`
- No `--amend` on published commits.
- No `--no-verify` ever.
- Never force-push.

---

## File & Folder Conventions

- All source code will live under `src/` once scaffolded.
- Components: `src/components/`
- Pages/routes: `src/app/` (Next.js App Router)
- Styles: `src/styles/`
- Types: `src/types/`
- Utilities: `src/lib/`
- Public assets: `public/`
- Documentation files stay at repo root.

---

## What Claude Must Never Do Without Explicit Approval

- Install, add, or remove any package (`npm install`, `pnpm add`, etc.)
- Run `npx create-next-app` or any scaffolding tool
- Push to any remote (`git push`)
- Delete files or directories
- Create or drop database schemas
- Add or modify environment variables in `.env*` files
- Touch anything outside this repository (especially PURE_QUOTES)
- Make a commit without showing the diff and waiting for approval
- Modify this file (`CLAUDE.md`) without explicit instruction

---

## What Claude Should Always Do

- Propose before acting on anything non-trivial.
- Show file contents or diffs before committing.
- Update `CURRENT_TASK.md` when a task changes state.
- Update `PROJECT_STATUS.md` when a phase item completes.
- Update `CHANGELOG.md` when a commit is made.
- Keep responses concise — one clear action at a time.
- Set git identity locally (`user.email`, `user.name`) — already configured.

---

## Memory

Claude's persistent memory for this project is stored at:
`C:\Users\User\.claude\projects\...\memory\`

Memory covers: user profile, feedback, project decisions, references.
Do not duplicate memory content into this file.

---

## Session Start Checklist

Before doing any work in a new session:

1. Read `CURRENT_TASK.md` — know what is in progress.
2. Read `PROJECT_STATUS.md` — know what phase we are in.
3. Confirm the working directory is `PURE COLLECTIONS` (not PURE_QUOTES).
4. Do not assume anything is approved from a prior session unless it is
   recorded as complete in `PROJECT_STATUS.md`.

---

*Last updated: 2026-06-16 — Phase 0, Task 2*
