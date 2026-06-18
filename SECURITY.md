# Security Policy

Browser Bridge handles sensitive local browser data, especially cookies that can represent active sessions.

## Supported Versions

Only the latest release branch is supported during the pre-1.0 phase.

## Reporting A Vulnerability

Do not open a public issue for a vulnerability that exposes cookie values, archive passwords, decrypted archives, or a way to bypass user confirmation for destructive imports.

Use GitHub private advisories:

```text
https://github.com/commit3296/browser-bridge/security/advisories/new
```

If the public repository is published under a different owner, replace the owner in that URL before release.

We aim to acknowledge reports within a few days. Include:

- Browser and OS version.
- Extension version or commit.
- Minimal reproduction steps.
- Whether cookie values, archive passwords, or decrypted payloads were exposed.
- Any relevant screenshots or logs with secrets redacted.

Never attach archive passwords, decrypted archives, or cookie values to a public issue.

## Security Expectations

- Archive passwords must never be stored.
- Cookie values must never be displayed in UI, screenshots, diagnostics, or exported reports.
- `replace_selected_domains` must delete only explicitly selected-domain cookies.
- Imports must continue after individual cookie failures and report the failures.
- Browser Bridge must not transmit browser data to remote services.
