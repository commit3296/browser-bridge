# Changelog

All notable changes to Browser Bridge are documented here.

## Unreleased

## 0.1.4 - 2026-06-18

### Changed

- Reworked the side panel into a cookie-first transfer flow with simple defaults and advanced controls.
- Added in-app confirmations for all-domain cookie archives and replace-domain imports.
- Replaced technical cookie health labels in the main report with user-facing restore outcomes.

## 0.1.3 - 2026-06-18

### Changed

- Added tested dev-only dependency overrides for WXT runner transitive dependencies so full `npm audit` and production audit are both clean.
- Migrated the UI build from Tailwind CSS 3 to Tailwind CSS 4 with `@tailwindcss/postcss` and CSS-first theme tokens.
- Tightened the cookie preview table rendering for narrow side panel screenshots.

## 0.1.2 - 2026-06-18

### Changed

- Updated safe dev tooling dependencies for Playwright, TypeScript, Vite, Vitest, React types, Chrome types, and Vite React plugin.
- Kept Tailwind CSS on 3.x; Tailwind 4 remains a separate UI migration because it requires dedicated side panel visual QA.

### Fixed

- Preserved backward compatibility for older v2 bookmark archives by defaulting missing Chrome `BookmarkTreeNode.syncing` metadata to `false`.

## 0.1.1 - 2026-06-18

### Changed

- Updated GitHub Actions dependencies for checkout, setup-node, cache, and artifact upload.
- Updated production UI dependencies: Radix checkbox, lucide-react, and tailwind-merge.
- Documented current dev-only dependency audit findings and the blocked dev-tooling migration.
- Made the release workflow derive the Chrome zip name from `package.json` instead of hardcoding `0.1.0`.

### Verified

- `npm run typecheck`
- `npm test`
- `npm run build:chrome`
- `npm run test:e2e`
- `npm audit --omit=dev`
- `npm run zip`

## 0.1.0 - 2026-06-18

### Added

- WXT Chrome MV3 extension with React, TypeScript, Tailwind, Radix-style components, and shadcn-style UI.
- Side panel guided migration flow with popup launcher.
- Password-encrypted schema v2 archives using PBKDF2-SHA-256 and AES-GCM.
- Bookmarks export/import.
- Domain-scoped cookies export/import through Chrome cookies API.
- Cookie import policies: overwrite matching, skip existing, replace selected domains, and dry run.
- Cookie preview without cookie values.
- Domain health diagnostics: Good, Partial, Failed, Needs login.
- Downloadable migration reports without cookie values or archive passwords.
- Extension inventory export; automatic extension installation is intentionally unsupported.
- Dev-only QA diagnostics for test cookies.
- Unit, integration, and Playwright e2e coverage.
- Release docs for privacy, permissions, threat model, Chromium targets, QA, and Chrome Web Store listing.
- Public repository hardening: CI, audit, CodeQL, Scorecard, links, release workflow, CODEOWNERS, issue forms, and security operations docs.

### Limitations

- Chrome is the primary supported target.
- Edge, Brave, Vivaldi, and Opera are compatibility targets pending manual QA.
- Saved browser passwords are not exported or imported.
- Websites may still require login after cookie import if they revoke or revalidate sessions.
