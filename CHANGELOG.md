# CHANGELOG

All notable changes to PURE COLLECTIONS are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

<!-- New entries go here until a version is tagged -->

---

## [0.4.0] — 2026-06-16 — Upload Screen Skeleton

### Added
- `src/components/UploadForm.tsx` — client component: `.xlsx`-only file picker,
  20 MB size cap, shows filename + size, Hebrew error/success messages,
  submit button disabled until valid file selected
- `src/app/upload/page.tsx` — updated from placeholder to full upload screen

---

## [0.3.1] — 2026-06-16 — Scaffold Verification Pass

### Verified
- All four routes (`/`, `/work`, `/upload`, `/settings`) return HTTP 200
- `npm run lint` — clean, zero warnings
- `npm run build` — clean, all pages compile as static, zero warnings
- Hebrew RTL content renders correctly in browser

---

## [0.3.0] — 2026-06-16 — Phase 0: App Foundation Scaffold

### Added
- Next.js 16.2.9, React 19, Tailwind v4, ESLint 9, TypeScript 5 (App Router, src/ layout)
- `tsconfig.json`: strict mode + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- `src/app/layout.tsx`: RTL Hebrew root layout (`lang="he"`, `dir="rtl"`, system font)
- `src/app/page.tsx`: בית (Home) placeholder
- `src/app/work/page.tsx`: עבודה (Work) placeholder
- `src/app/upload/page.tsx`: העלאת דוח (Upload Report) placeholder
- `src/app/settings/page.tsx`: הגדרות (Settings) placeholder

---

## [0.2.0] — 2026-06-16 — Phase 0: AI Collaboration Contract

### Added
- `CLAUDE.md` — AI collaboration contract: phase gate rules, commit conventions,
  file/folder structure, never-do list, always-do list, memory pointer, session checklist

---

## [0.1.0] — 2026-06-16 — Phase 0: Repository Bootstrap

### Added
- Git repository initialized (`8efb453`)
- `README.md` — project overview, tech stack, and 5-phase roadmap
- `PROJECT_STATUS.md` — phase tracker, decisions log, and blockers
- `CURRENT_TASK.md` — active task tracking with per-task checklists
- `CHANGELOG.md` — this file, following Keep a Changelog format
- `.gitignore` — Node.js / Next.js standard ignores
