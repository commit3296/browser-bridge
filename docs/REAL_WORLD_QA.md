# Real-World QA Matrix

Use this matrix after automated e2e passes. Real account checks stay manual because login state, 2FA, and site risk controls cannot be safely automated.

## Matrix

| Site | Source state | Target state | Policy | Expected result | Notes |
| --- | --- | --- | --- | --- | --- |
| Gmail | Signed in | Clean profile | Overwrite matching | Logged in or login required with clear `needs_login` report | Google may invalidate sessions by device/profile. |
| GitHub | Signed in | Clean profile | Overwrite matching | Logged in or partial session with domain health explanation | Check `github.com` and `github.githubassets.com` if needed. |
| Figma | Signed in | Clean profile | Overwrite matching | Logged in or explicit login required | Confirm WebGL issue is unrelated to cookie import. |
| Notion | Signed in | Used profile | Skip existing | Existing target session remains intact | Confirm skipped existing count. |
| Slack | Signed in | Clean profile | Dry run then overwrite | Dry run reports domain health before mutation | Workspace-specific domains may be required. |
| GitHub | Signed in | Used profile | Replace selected domains | Only selected-domain cookies are deleted before import | Confirm unrelated domains remain unchanged. |

## Manual QA Template

- Date:
- Tester:
- Source browser/profile:
- Target browser/profile:
- Site/domain:
- Selected domains:
- Import policy:
- Archive password strength: weak / acceptable / strong:
- Dry-run health:
- Import report health:
- Observed post-import behavior: logged in / partial / login required:
- Report JSON attached: yes / no:
- Notes:

## Acceptance

- Exported archive does not contain plaintext cookie values.
- Downloaded report JSON does not contain cookie values or archive passwords.
- Domain health explains failed, partial, and login-required outcomes.
- `replace_selected_domains` deletes only selected-domain cookies.
- Production builds do not expose dev diagnostics unless opened with an explicit QA query flag during local testing.
