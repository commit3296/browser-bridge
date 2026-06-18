# Changelog

All notable changes to Browser Bridge are documented here.

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
