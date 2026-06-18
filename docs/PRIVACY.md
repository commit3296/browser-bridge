# Browser Bridge Privacy Policy

Browser Bridge is a local Chromium-family cookie transfer tool. Chrome is the primary supported target for the current release phase.

## Data handled

The extension can read cookies, bookmarks, open tab URLs, and installed extension metadata after the user grants the required Chrome extension permissions.

Browser Bridge uses:

- `bookmarks` to export and import bookmark trees.
- `cookies` and `<all_urls>` to read and recreate cookies for user-selected domains.
- `management` to export an installed extension inventory. Browser Bridge does not install extensions automatically.
- `sidePanel` to show the main migration UI.
- `tabs` to offer the optional "Open tabs" cookie-domain preset.

## Data storage and transfer

Browser Bridge does not send browser data to any server. Exports are written to a local archive file selected by the user. Cookies are selected by default in the simple flow; bookmarks and extension inventory are opt-in. All detected cookie domains are selected by default, and the user must acknowledge that the encrypted archive may keep websites signed in before creating an all-domain cookie archive. Archives that contain migrated data use password-based encryption with PBKDF2-SHA-256 and AES-GCM.

Migration reports can be downloaded as local JSON files. Reports include counts, domain health, reason codes, warnings, errors, and durations. They do not include cookie values or archive passwords.

## Password handling

Archive passwords are used only in memory for encryption or decryption. Browser Bridge does not store archive passwords. The UI can generate a strong password and offers copy/view controls, but the password remains hidden by default and is not logged.

## Cookies

Cookies can contain session secrets and authentication state. Browser Bridge shows cookie domains, counts, and import actions in previews, but does not display cookie values in the UI. Users can review and change which domains are exported or imported.

Cookie imports are merge-based by default and keep unrelated browser data. The destructive `replace selected domains` mode deletes cookies only for explicitly selected domains and asks for confirmation before running.

## Passwords

Browser Bridge does not export or import saved browser passwords.

## Diagnostics

Cookie restore diagnostics classify domain results into user-facing outcomes such as `Likely restored`, `May need login`, and `Not restored`. These labels are derived from local import counts and Chrome API errors. They are intended to explain likely outcomes; websites may still require login based on their own session policies.

## Contact

This project is currently a local development build. Add project owner contact details before publishing to any extension store.
