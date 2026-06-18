# Dependency Audit Notes

## Release Gate

The release gate is:

```bash
npm audit --omit=dev
```

This checks production dependencies included in the extension runtime. It must pass before release.

## Dev Tooling Audit

`npm audit` without `--omit=dev` currently reports vulnerabilities through WXT development tooling:

- `wxt -> web-ext-run -> fx-runner -> shell-quote`
- `wxt -> web-ext-run -> tmp`
- `wxt -> web-ext-run -> node-notifier -> uuid`
- WXT's nested `esbuild`

As of this release prep, `wxt` and `@wxt-dev/module-react` are already on their latest published versions. These findings affect local development/test tooling rather than extension runtime code. Track upstream updates and re-run the full audit before public announcements.

The security operations process is documented in `docs/SECURITY_OPERATIONS.md`.

## Policy

- Do not ignore production dependency vulnerabilities.
- Keep Dependabot enabled for npm and GitHub Actions.
- Prefer normal dependency updates over `overrides` unless a focused test pass proves the override is safe.
- Document any unresolved dev-only audit findings in release notes.
