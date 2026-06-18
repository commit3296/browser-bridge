# Security Operations

This document is the release operator checklist for Browser Bridge.

## Dependency Audits

The blocking release gate is:

```bash
npm audit --omit=dev
```

This checks dependencies that ship into the extension runtime. It must pass before release.

Run the full audit before public announcements:

```bash
npm audit
```

Current full-audit findings are documented in `docs/DEPENDENCY_AUDIT.md` and come through WXT development tooling. Do not ignore production dependency findings.

## Updating Dependencies

1. Prefer normal dependency updates through Dependabot PRs.
2. Run `npm ci`.
3. Run `npm run typecheck`.
4. Run `npm test`.
5. Run `npm run build:chrome`.
6. Run `npm run test:e2e`.
7. Run `npm audit --omit=dev`.
8. Update `docs/DEPENDENCY_AUDIT.md` if the full-audit situation changes.

Avoid `overrides` unless a focused test pass proves the override is safe with WXT.

## Permission Review

Before release, compare `wxt.config.ts` with `docs/PERMISSIONS.md` and `docs/STORE_LISTING.md`.

Current permissions:

- `bookmarks`
- `cookies`
- `management`
- `sidePanel`
- `tabs`
- `<all_urls>`

Any permission change requires:

- updated permission docs;
- updated privacy docs;
- updated Chrome Web Store justification;
- a fresh e2e run;
- manual clean-profile QA.

## Release Zip Verification

Build the release artifact:

```bash
npm run zip
```

Generate and verify checksum:

```bash
cd .output
sha256sum "browser-bridge-$(node -p 'require("../package.json").version')-chrome.zip" > SHA256SUMS
sha256sum -c SHA256SUMS
```

Load `.output/chrome-mv3` as an unpacked extension before uploading the zip anywhere.

## Secret Handling

Never publish:

- archive passwords;
- decrypted archives;
- cookie values;
- screenshots that show cookie values;
- migration reports before confirming they contain no cookie values or archive passwords.

## Incident Response

For security bugs involving cookies, archive encryption, archive passwords, destructive import behavior, or decrypted payload exposure:

1. Do not discuss details in public issues.
2. Use GitHub private advisories.
3. Reproduce on a clean profile.
4. Patch with regression tests.
5. Cut a patch release and update `CHANGELOG.md`.
