# Browser Bridge QA Workflow

## Development Profile

- Start the persistent development profile with `npm run dev:chrome`.
- Reset it with `npm run dev:chrome:fresh`.
- The profile lives in `.wxt/chrome-profile` and is separate from the main Chrome profile.
- The WXT dev runner loads the extension and opens the configured start URLs.

## Build And E2E

- Build Chrome output with `npm run build:chrome`.
- Run mocked unit/integration tests with `npm test`.
- Install the Playwright extension-test browser with `npx playwright install chromium`.
- Run real Chrome extension QA with `npm run test:e2e`.
- Run headed Chrome QA with `npm run qa:chrome`.
- On Fedora, install virtual display support with `sudo dnf install xorg-x11-server-Xvfb`.
- In headless CI/Linux without a display, run `xvfb-run --auto-servernum npm run test:e2e`.
- E2E uses Playwright bundled Chromium by default because current Google Chrome and Edge do not support the side-load extension flags Playwright needs. Set `PLAYWRIGHT_CHROME_EXECUTABLE=/path/to/browser` only for explicit local experiments.
- E2E must execute and pass before release. A skipped e2e run is useful during development but is not release-ready.
- UI QA screenshots are written to `test-results/sidepanel-*.png`.

## Store Screenshots

- Generate Chrome Web Store screenshots with `npm run screenshots:store`.
- Screenshots are written to `docs/store-assets/screenshots/*.png`.
- The screenshot harness uses synthetic cookies only and must not reveal cookie values, archive passwords, or QA diagnostics.
- Review [STORE_SUBMISSION.md](STORE_SUBMISSION.md) before uploading screenshots.

## Dev Diagnostics

- Open the side panel with `?qa=1` or use a dev build to show QA diagnostics.
- Use `Create test cookies` to create Browser Bridge test cookies only.
- Use `Refresh counts` to list domains, counts, names, path/security flags, and no values.
- Use `Quick dry run` to run a QA dry-run preview.
- Use `Clear QA cookies` to remove only cookies named `bridge_qa_*`.

## Manual Cookie Scenarios

1. Open the popup and launch the side panel.
2. Export cookies with a strong password.
3. Confirm the archive JSON does not contain plaintext cookie values.
4. Preview with a wrong password and confirm it fails.
5. Preview with the correct password and review cookie domain counts.
6. Run `Dry run` and confirm browser cookies are unchanged.
7. Run `Overwrite matching` and confirm selected cookies are recreated.
8. Run `Skip existing` and confirm existing cookies keep their values.
9. Run `Replace selected domains` and confirm only selected-domain cookies are deleted before import.
10. Confirm unselected domains remain unchanged.

## Manual Release Acceptance

- Bookmarks import into a new `Browser Bridge Import ...` folder.
- Cookies import report shows totals, created, updated, deleted, skipped, warnings, and errors.
- Extension inventory appears, but extensions are not installed automatically.
- Saved browser passwords are not exported or imported.
- Archives are local files encrypted with the user-provided password.
- Store screenshots are `1280x800` PNG files and have been visually inspected.
