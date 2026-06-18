# Dependency Audit Notes

## Release Gate

The release gate is:

```bash
npm audit --omit=dev
```

This checks production dependencies included in the extension runtime. It must pass before release.

## Dev Tooling Audit

`npm audit` without `--omit=dev` is currently clean.

`wxt` and `@wxt-dev/module-react` are already on their latest published versions. WXT's development runner still depends on older tooling ranges, so this repository uses focused dev-only `overrides` for patched leaf dependencies in that chain. These overrides are accepted only after the full build, e2e, and audit gate passes.

The `@types/chrome` update required a focused compatibility migration because `chrome.bookmarks.BookmarkTreeNode.syncing` is required in newer type definitions. Older encrypted v2 bookmark payloads remain valid; schema validation defaults missing `syncing` metadata to `false`.

Tailwind CSS remains pinned to the latest 3.x release in this phase. The Tailwind 4 PostCSS migration caused side panel visual QA regressions and should be handled as a dedicated UI migration with screenshot review.

The security operations process is documented in `docs/SECURITY_OPERATIONS.md`.

## Policy

- Do not ignore production dependency vulnerabilities.
- Keep Dependabot enabled for npm and GitHub Actions.
- Prefer normal dependency updates over `overrides`.
- Allow dev-only `overrides` only when a focused test pass proves the override is safe.
- Document any unresolved audit findings in release notes.
