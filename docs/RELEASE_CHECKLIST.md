# Release Checklist

## Before packaging

- Confirm CI, CodeQL, Audit, Links, and Scorecard workflows are green on `main`.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `npm run build:chrome`.
- Run `npm run test:e2e` in an environment with a Chrome display or `xvfb-run`.
- Confirm e2e tests were executed, not skipped. Skipped e2e is not release-ready.
- Run `npm audit --omit=dev`.
- Review `docs/DEPENDENCY_AUDIT.md` and confirm unresolved full-audit findings are dev-only.
- Run `npm run zip`.
- Generate `SHA256SUMS` with `cd .output && sha256sum "browser-bridge-$(node -p 'require(\"../package.json\").version')-chrome.zip" > SHA256SUMS`.
- Verify the checksum with `cd .output && sha256sum -c SHA256SUMS`.
- Confirm the release workflow uploads the zip and `SHA256SUMS` as artifacts.
- Manually test export/import in a dedicated Chrome profile.

## Chrome Web Store readiness

- Confirm permissions justification for `bookmarks`, `cookies`, `management`, `sidePanel`, `tabs`, and `<all_urls>`.
- Publish or link the privacy policy in `docs/PRIVACY.md`.
- Review `docs/PERMISSIONS.md`.
- Review `docs/STORE_LISTING.md`.
- Review `docs/THREAT_MODEL.md`.
- Review `docs/DEPENDENCY_AUDIT.md`.
- Review `docs/SECURITY_OPERATIONS.md`.
- Review `docs/CHROMIUM_TARGETS.md`.
- Review `docs/REAL_WORLD_QA.md`.
- Fill `docs/RELEASE_NOTES_TEMPLATE.md`.
- Verify icons render at 16, 32, 48, and 128 px.
- Create a production zip with `npm run zip`.
- Test the zip by loading the unpacked `.output/chrome-mv3` build first.
- Confirm the store listing states that passwords are not migrated and extensions are exported as inventory only.
- Confirm downloaded migration reports contain no cookie values or archive passwords.
- Confirm Chrome Web Store privacy and permission copy matches `docs/PRIVACY.md`, `docs/PERMISSIONS.md`, and `docs/STORE_LISTING.md`.

## Manual smoke test

- Open popup and launch side panel.
- Export selected cookie domains with a strong password.
- Confirm the downloaded archive does not contain cookie values as plain text.
- Preview the archive with the correct and incorrect passwords.
- Import into a separate profile and check the import report.
- Download the migration report and review domain health.
- Run cookie policies: `dry_run`, `overwrite`, `skip_existing`, and `replace_selected_domains`.
- Confirm `replace_selected_domains` deletes only selected-domain cookies.
- Confirm extension inventory appears and links can be copied/opened.
- Confirm QA diagnostics are not visible in a normal production side panel.

## Real Chrome QA matrix

- `example.com`: secure HttpOnly persistent cookie.
- `github.com`: secure HttpOnly persistent cookie on a high-value real domain.
- `127.0.0.1`: local host-only HTTP cookie.
- Wrong password preview must fail.
- Encrypted archive must not contain plaintext cookie values.
- Dry run must not mutate browser cookies.
- Replace selected domains must preserve unselected domains.

## Release screenshots

- Generate store screenshots with `npm run screenshots:store`.
- Confirm screenshot dimensions are `1280x800`.
- Inspect `docs/store-assets/screenshots/01-export-cookies.png`.
- Inspect `docs/store-assets/screenshots/02-import-preview.png`.
- Inspect `docs/store-assets/screenshots/03-restore-report.png`.
- Keep `docs/store-assets/screenshots/04-no-data-selected.png` as optional QA evidence unless the store listing needs an empty-state screenshot.
- Confirm screenshots do not show QA diagnostics, cookie values, or revealed archive passwords.
- Confirm trust copy is visible in the export screenshot.

## GitHub release

- Create or push a tag matching the package version, for example `v$(node -p 'require("./package.json").version')`.
- Confirm `.github/workflows/release.yml` passes.
- Download the uploaded zip and `SHA256SUMS` artifacts.
- Run `sha256sum -c SHA256SUMS`.
- Load the unpacked `.output/chrome-mv3` build in a clean Chrome profile.
- Attach final screenshots and release notes from `CHANGELOG.md`.
- Review [STORE_SUBMISSION.md](STORE_SUBMISSION.md) before Chrome Web Store upload.
