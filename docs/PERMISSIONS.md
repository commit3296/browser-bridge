# Permissions

Browser Bridge requests only the permissions needed for local Chromium-family migration. Chrome is the primary supported target for this phase.

## `bookmarks`

Used to read the bookmark tree during export and create imported bookmark folders/items during import.

## `cookies`

Used to read cookies for export and recreate cookies during import. Cookie values are encrypted inside the local archive and are never displayed in the UI.

## `<all_urls>`

Required by Chrome's cookies API so Browser Bridge can access cookies for domains the user selects. Without host access, Chrome rejects cookie reads and writes for many sites.

## `tabs`

Used only for the Open Tabs preset in the cookie domain picker. Browser Bridge reads tab URLs to identify domains that are already open, then selects matching cookie domains.

## `management`

Used to export an installed extension inventory. Browser Bridge does not install, enable, disable, or remove extensions.

## `sidePanel`

Used to show the main Browser Bridge control panel in Chrome's side panel.

## No Remote Transfer

Browser Bridge does not send bookmarks, cookies, extension inventory, archives, or passwords to any server.

## Diagnostics And Reports

Domain health diagnostics and downloadable reports are generated locally from import counters and Chrome API errors. Reports exclude cookie values and archive passwords.
