# Threat Model

## Assets

- Cookies and session secrets.
- Bookmarks.
- Installed extension inventory.
- Encrypted archive files.
- Archive passwords.
- Migration reports.

## Architecture

Browser Bridge runs locally as a browser extension. It reads selected data through Chrome extension APIs, writes a user-selected encrypted archive, and imports that archive into another profile. It does not use a remote server.

## Main Risks

- Stolen archive file.
- Weak archive password.
- Shared or compromised machine.
- Malicious browser extension in the same profile.
- Importing sessions into an untrusted profile.
- Misunderstanding `replace_selected_domains`.

## Mitigations

- Archives use PBKDF2-SHA-256 and AES-GCM.
- Archive passwords are used only in memory and are not stored.
- Cookie values are never shown in preview, reports, diagnostics, or screenshots.
- Migration report exports contain counts, health, reason codes, warnings, and errors only.
- Default import is merge/overwrite and does not delete unrelated cookies.
- Destructive domain replacement requires explicit user confirmation.

## Out Of Scope

- Saved browser passwords.
- Automatic extension installation.
- Remote backup or sync.
- Guaranteeing that every imported web session remains valid; sites can revoke sessions based on their own risk systems.
