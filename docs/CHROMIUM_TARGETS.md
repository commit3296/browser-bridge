# Chromium-Family Targets

Browser Bridge remains Chrome-first for release. The archive format is browser-neutral within the Chromium extension API surface, so these browsers are compatibility targets until manual QA passes.

| Browser | Status | Load path | QA checklist |
| --- | --- | --- | --- |
| Google Chrome | Primary | `chrome://extensions` | Full automated and manual QA required. |
| Microsoft Edge | Compatibility | `edge://extensions` | Load unpacked, export/import cookies, verify side panel. |
| Brave | Compatibility | `brave://extensions` | Repeat Chrome QA with Shields enabled and disabled. |
| Vivaldi | Compatibility | `vivaldi://extensions` | Verify side panel access and cookie import report. |
| Opera | Compatibility | `opera://extensions` | Verify extension UI surfaces and cookie import behavior. |

## Compatibility Rules

- Use the existing encrypted `schemaVersion: 2` archive.
- Do not add browser-specific archive schemas.
- Treat Chrome as the only fully supported target until the manual matrix passes for another browser.
- Keep passwords out of scope.
- Keep extension installation out of scope; extension data remains inventory only.
