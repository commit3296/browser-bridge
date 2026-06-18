# Chrome Web Store Listing Draft

## Short Description

Move Chrome cookies between profiles using an encrypted local archive. Bookmarks and extension lists are optional.

## Full Description

Browser Bridge is a local Chrome-first cookie transfer tool for controlled browser-to-browser profile moves. The archive format is designed for Chromium-family compatibility, with Chrome as the primary tested target.

It exports cookies into a password-protected archive file and imports that archive into another Chrome profile. Cookies are the default data type. Bookmarks and an extension list are opt-in, and there is no stepper to complete before export/import.

All detected cookie domains are selected by default, the user must confirm that the encrypted file can keep websites signed in, and domains can be reviewed before export. The password field stays hidden by default and includes generate, copy, and view controls.

Browser Bridge does not send browser data to any server. Archives are local files encrypted with PBKDF2-SHA-256 and AES-GCM. Archive passwords are used only in memory and are never stored. Import reports can be downloaded locally and include cookie restore outcomes, but never cookie values.

## What It Migrates

- Cookies for selected domains, with all detected domains selected by default.
- Optional bookmarks.
- Optional installed extension list: name, id, version, enabled state, and available URLs.

## Limitations

- Saved browser passwords are not exported or imported.
- Extensions are not installed automatically; Browser Bridge exports inventory only.
- Cookie imports may restore website sessions, so archive files must be stored privately.
- Websites can still require login after cookie import if they revoke or revalidate sessions.
- Default cookie import restores matching cookies without deleting unrelated browser data.

## Permission Justification

- `bookmarks`: export and import bookmark trees.
- `cookies`: read and recreate selected-domain cookies.
- `<all_urls>`: allow cookie access across user-selected domains.
- `tabs`: build the optional Open Tabs domain preset.
- `management`: export installed extension inventory.
- `sidePanel`: provide the main migration interface.
