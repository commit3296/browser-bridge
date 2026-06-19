# Chrome Web Store Submission Pack

This document tracks the Browser Bridge Chrome Web Store package for the current public release.

## Current Release

- Version: `0.1.5`
- GitHub release: <https://github.com/commit3296/browser-bridge/releases/tag/v0.1.5>
- Chrome zip: `browser-bridge-0.1.5-chrome.zip`
- Checksum file: `SHA256SUMS`
- Source listing copy: [STORE_LISTING.md](STORE_LISTING.md)
- Privacy copy: [PRIVACY.md](PRIVACY.md)
- Permissions copy: [PERMISSIONS.md](PERMISSIONS.md)

## Store Screenshots

Chrome's image guidance recommends `1280x800` screenshots and notes that screenshots are downscaled to `640x400` in the store UI:
<https://developer.chrome.com/docs/webstore/images>

Regenerate screenshots with:

```bash
npm run screenshots:store
```

The command builds `.output/chrome-mv3`, launches the extension in an isolated Playwright Chromium profile, creates synthetic cookies only, and captures PNG screenshots without cookie values or revealed passwords.

| Upload order | File | Purpose | Publish? |
| --- | --- | --- | --- |
| 1 | `docs/store-assets/screenshots/01-export-cookies.png` | Cookie-first export, encrypted local archive, generated hidden password | Yes |
| 2 | `docs/store-assets/screenshots/02-import-preview.png` | Import archive preview, default non-destructive restore copy | Yes |
| 3 | `docs/store-assets/screenshots/03-restore-report.png` | Domain health report and download report action | Yes |
| 4 | `docs/store-assets/screenshots/04-no-data-selected.png` | Disabled no-data state for QA/review evidence | Optional, not recommended for first listing |

Before upload, manually inspect every image and confirm:

- no cookie values;
- no archive password text;
- no QA diagnostics;
- no horizontal overflow;
- text is readable after downscaling.

## Store Metadata

- Category: Productivity.
- Language: English.
- Support URL: <https://github.com/commit3296/browser-bridge/issues>
- Security reports: <https://github.com/commit3296/browser-bridge/security/advisories/new>
- Privacy policy URL: use a hosted copy of [PRIVACY.md](PRIVACY.md), or the GitHub file URL if accepted by the store dashboard.

## Submission Checklist

- Upload `browser-bridge-0.1.5-chrome.zip` from the GitHub release assets.
- Verify the release asset checksum with `sha256sum -c SHA256SUMS`.
- Paste short/full listing copy from [STORE_LISTING.md](STORE_LISTING.md).
- Paste permission justifications from [PERMISSIONS.md](PERMISSIONS.md).
- Confirm data handling states that Browser Bridge has no remote transfer and does not migrate saved passwords.
- Confirm screenshots are the generated `1280x800` PNG files listed above.
- Confirm the production side panel does not expose QA diagnostics.
- Confirm archive/report JSON do not contain cookie values or archive passwords.

## Manual QA Still Required

Automated e2e covers synthetic cookies, bookmarks, preview/report, and store screenshots. Real account checks remain manual because login state, 2FA, device trust, and site risk scoring cannot be safely automated.

Run [REAL_WORLD_QA.md](REAL_WORLD_QA.md) before submission for:

- Gmail;
- GitHub;
- Figma;
- Notion;
- Slack.

Record each result as `logged in`, `partial`, or `login required`, and attach the downloaded migration report JSON after confirming it contains no cookie values.
