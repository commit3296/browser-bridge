# Release Notes Template

## Version

`x.y.z`

## Summary

- Chrome-to-Chrome encrypted archive migration.
- Bookmarks export/import.
- Domain-scoped cookies export/import with preview and reports.
- Extension inventory export.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run build:chrome`
- `npm run test:e2e` with a real display or Xvfb
- `npm audit --omit=dev`
- `npm run zip`

## Known Limitations

- Saved passwords are not migrated.
- Extensions are exported as inventory only and must be installed manually.
- Cookie archives can contain session secrets and must be kept private.

## Store Notes

- Confirm privacy policy URL.
- Confirm permission justifications.
- Confirm screenshots match the published build.
