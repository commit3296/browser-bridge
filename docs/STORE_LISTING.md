# Chrome Web Store Listing Draft

## Short Description

Move Chrome bookmarks, cookies, and extension inventory between profiles using an encrypted local archive.

## Full Description

Browser Bridge is a local Chrome-first migration tool for controlled browser-to-browser transfers. The archive format is designed for Chromium-family compatibility, with Chrome as the primary tested target.

It exports selected browser data into a password-protected archive file and imports that archive into another Chrome profile. Cookie transfers are domain-scoped, previewed before import, and reported with structured success, skipped, failed, created, updated, and deleted counts.

Browser Bridge does not send browser data to any server. Archives are local files encrypted with PBKDF2-SHA-256 and AES-GCM. Archive passwords are used only in memory and are never stored. Import reports can be downloaded locally and include domain health diagnostics, but never cookie values.

## What It Migrates

- Bookmarks.
- Cookies for user-selected domains.
- Installed extension inventory: name, id, version, enabled state, and available URLs.

## Limitations

- Saved browser passwords are not exported or imported.
- Extensions are not installed automatically; Browser Bridge exports inventory only.
- Cookie imports can restore sessions, so archive files must be stored privately.
- Websites can still require login after cookie import if they revoke or revalidate sessions.

## Permission Justification

- `bookmarks`: export and import bookmark trees.
- `cookies`: read and recreate selected-domain cookies.
- `<all_urls>`: allow cookie access across user-selected domains.
- `tabs`: build the optional Open Tabs domain preset.
- `management`: export installed extension inventory.
- `sidePanel`: provide the main migration interface.
