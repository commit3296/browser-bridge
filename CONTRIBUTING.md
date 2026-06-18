# Contributing

Thanks for helping improve Browser Bridge.

## Development Setup

```bash
npm ci
npm run dev:chrome
```

Load the extension from `.output/chrome-mv3` when testing production builds.

## Required Checks

Before opening a pull request, run:

```bash
npm run typecheck
npm test
npm run build:chrome
```

For release-facing changes, also run:

```bash
npm run test:e2e
npm audit --omit=dev
npm run zip
```

On Linux without a display:

```bash
xvfb-run --auto-servernum npm run test:e2e
```

## Data Safety Rules

- Do not add UI that displays cookie values.
- Do not log archive passwords, decrypted payloads, or cookie values.
- Do not make destructive import behavior the default.
- Keep archive schema changes backward-compatible unless a migration plan is included.
- Keep extension installation as inventory-only unless Chrome policies change.

## Pull Request Expectations

- Keep changes scoped.
- Add or update tests for migration behavior, archive validation, reports, and UI flows.
- Update docs when permissions, data handling, or user-visible behavior changes.
- Include screenshots for side panel UI changes when practical.
