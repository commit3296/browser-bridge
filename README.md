# Browser Bridge

[![CI](https://github.com/commit3296/browser-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/commit3296/browser-bridge/actions/workflows/ci.yml)
[![CodeQL](https://github.com/commit3296/browser-bridge/actions/workflows/codeql.yml/badge.svg)](https://github.com/commit3296/browser-bridge/actions/workflows/codeql.yml)
[![Audit](https://github.com/commit3296/browser-bridge/actions/workflows/audit.yml/badge.svg)](https://github.com/commit3296/browser-bridge/actions/workflows/audit.yml)
[![Scorecard](https://api.scorecard.dev/projects/github.com/commit3296/browser-bridge/badge)](https://scorecard.dev/viewer/?uri=github.com/commit3296/browser-bridge)
[![Release](https://github.com/commit3296/browser-bridge/actions/workflows/release.yml/badge.svg)](https://github.com/commit3296/browser-bridge/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Browser Bridge is a Chrome-first cookie transfer extension for moving website cookies between browser profiles through a local encrypted archive.

It is built for controlled profile-to-profile transfers: export cookies from one Chromium-family browser profile, move the encrypted archive file yourself, then import it into another profile. Bookmarks and an extension list can be included with the same archive.

## Features

- Cookie-first side panel flow with advanced controls.
- Popup launcher for quick access.
- Password-encrypted schema v2 archives using PBKDF2-SHA-256 and AES-GCM.
- All-domain cookies export by default, with explicit encrypted-file acknowledgement.
- Domain-scoped cookie review and import through the Chrome cookies API.
- Optional bookmarks export/import.
- Cookie import policies:
  - overwrite matching;
  - skip existing;
  - replace selected domains;
  - dry run.
- Cookie preview and migration reports without showing cookie values.
- User-facing cookie restore outcomes: likely restored, may need login, not restored.
- Optional installed extension list export.
- Dev-only QA diagnostics for safe test cookies.

## Current Scope

Chrome is the primary supported browser for this release phase.

Edge, Brave, Vivaldi, and Opera are Chromium-family compatibility targets until their manual QA matrices pass. Firefox builds are kept as an early compatibility check; Firefox browser API behavior still needs dedicated QA before release.

Browser Bridge does not:

- export or import saved browser passwords;
- automatically install extensions;
- send browser data to a server;
- guarantee that every imported web session remains valid after a website revalidates or revokes it.

## Data Safety

Cookies can contain active session secrets. Browser Bridge treats them as sensitive data:

- cookie values are encrypted inside the archive;
- cookie values are never displayed in preview, diagnostics, screenshots, or downloaded reports;
- archive passwords are used only in memory and are not stored;
- default import restores matching cookies without deleting unrelated browser data;
- all-domain cookie export requires explicit in-app acknowledgement;
- destructive replacement is limited to selected domains and requires confirmation.

Read more:

- [Privacy](docs/PRIVACY.md)
- [Permissions](docs/PERMISSIONS.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Chromium targets](docs/CHROMIUM_TARGETS.md)
- [Real-world QA](docs/REAL_WORLD_QA.md)
- [Dependency audit notes](docs/DEPENDENCY_AUDIT.md)
- [Security operations](docs/SECURITY_OPERATIONS.md)

## Install For Local Testing

```bash
npm ci
npm run build:chrome
```

Then load the extension:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `.output/chrome-mv3`.

## Development

```bash
npm ci
npm run dev:chrome
```

`npm run dev:chrome` opens a dedicated test Chrome profile with Browser Bridge loaded. WXT rebuilds and reloads the extension when source files change.

Reset the dedicated profile:

```bash
npm run dev:chrome:fresh
```

## Verification

Required checks:

```bash
npm run typecheck
npm test
npm run build:chrome
npm run test:e2e
npm audit --omit=dev
npm run zip
```

On Linux without a display:

```bash
xvfb-run --auto-servernum npm run test:e2e
```

Playwright extension QA uses bundled Chromium by default. Set `PLAYWRIGHT_CHROME_EXECUTABLE=/path/to/browser` only for explicit local browser experiments.

## Release

Create the Chrome release zip:

```bash
npm run zip
```

The release artifact is written to:

```bash
node -p '`.output/browser-bridge-${require("./package.json").version}-chrome.zip`'
```

Before publishing, review:

- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Chrome Web Store listing draft](docs/STORE_LISTING.md)
- [Release notes template](docs/RELEASE_NOTES_TEMPLATE.md)
- [Changelog](CHANGELOG.md)

Verify the release zip:

```bash
cd .output
sha256sum "browser-bridge-$(node -p 'require("../package.json").version')-chrome.zip" > SHA256SUMS
sha256sum -c SHA256SUMS
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before opening issues or pull requests that touch cookies, archive encryption, permissions, or import behavior.

## License

MIT. See [LICENSE](LICENSE).
