# eHali Privacy Notice

**Last updated: November 18, 2026**

eHali is a browser extension that applies user-configured labels to Gmail message rows.

## Data handled

When Gmail is open, eHali's content script reads the sender information, subject, and preview snippet available in rendered message-list rows. It compares those values against the rules configured by the user.

eHali stores the following settings using Chrome's local extension storage:

- Enabled/paused state
- User-created labels
- Label colors
- Keywords, sender patterns, and exclusion keywords
- Matching preferences
- Optional fallback-label settings

## Data sharing

The packaged extension contains no remote server integration, analytics, advertising, or external API calls. It does not transmit email content or settings to the developer.

## Permissions

- `storage`: save and retrieve extension preferences.
- `https://mail.google.com/*`: run the content script on Gmail to inspect rendered message-list information and display labels.

## Scope and limitations

eHali does not fetch complete email bodies, attachments, or unopened message contents. It works with information Gmail has rendered in the current message list. Gmail may change its interface, which can affect compatibility.

## Contact

Add a project-maintainer contact address here before public distribution.
