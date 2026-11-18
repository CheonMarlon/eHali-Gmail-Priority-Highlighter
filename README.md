# eHali — Gmail Priority Highlighter

**eHali helps you recognize the Gmail messages that matter using labels and matching rules you control.**

Version: 1.0.0  
Platform: Google Chrome / Chromium browsers supporting Manifest V3  
Processing: Local in your browser

## Features

- **Gmail label filters:** click any eHali badge beside a message to filter the current Gmail message list to that label. Use the eHali filter chips above the list to switch labels or return to All. This filters the current Gmail view locally; it does not create, rename, or modify Gmail labels. Gmail virtualizes and paginates messages, so the count reflects messages currently rendered in the view.

- Custom labels, colors, and keywords.
- Match against sender, subject, and the preview snippet shown in Gmail's message list.
- Sender address or domain matching.
- Any-condition or all-condition matching.
- Phrase/contains and whole-word keyword matching.
- Exclusion keywords to prevent unwanted matches.
- Rule enable/disable and priority ordering.
- Optional fallback label for messages that match no rule (off by default).
- Live subject-line preview in the extension popup.
- Import and export settings as JSON.
- Local settings storage; no account, backend, analytics, or external API is required.

## Install locally

1. Download and extract the eHali package.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted `eHali` folder (the folder containing `manifest.json`).
6. Open or refresh Gmail at `https://mail.google.com/`.

To update an existing unpacked installation, replace its files with this version and press **Reload** on the extension card. Refresh Gmail afterward.

## Use

1. Open eHali from the Chrome toolbar.
2. Enable or pause highlighting with the switch in the header.
3. Add a label, choose its color, and configure keywords and/or sender addresses.
4. Choose which email fields to inspect.
5. Choose whether any condition or every condition must match.
6. Add exclusion keywords when a message should not receive the label.
7. Move rules up or down to change priority. The first two matching rules are shown.
8. Use the preview box to test a subject line.
9. Export settings periodically if you want a portable backup.

### Matching behavior

- Matching is case-insensitive.
- Phrase/contains matching looks for the entered text as a sequence.
- Whole-word matching checks word boundaries.
- Sender entries use case-insensitive substring matching. For example, `@example.com` matches addresses at that domain.
- Exclusion keywords are checked against the selected text fields. If any exclusion matches, that rule is skipped.
- When a rule has keywords and sender entries, the selected ANY/ALL mode applies across those conditions.
- Earlier rules have higher priority. At most two labels are displayed on a message.
- If no rule matches, the optional fallback label is applied only when enabled.

## What eHali can and cannot inspect

eHali works with message rows currently rendered in Gmail. It reads the sender information, subject, and preview snippet available in those rows, according to each rule's selected fields.

It does **not** fetch or read the complete body of unopened emails, attachments, or messages that Gmail has not rendered in the current view. It does not classify mail on Gmail's servers. Gmail may virtualize or dynamically replace rows; eHali observes page changes and re-scans the visible message list.

Gmail's internal DOM is not a stable public API. A future Gmail interface change may require an update to the row and field selectors in `content.js`.

## Privacy

eHali is designed to work locally:

- It does not send email content or settings to an eHali server.
- It does not use remote analytics, advertising, tracking pixels, or external APIs.
- The extension's settings are stored using `chrome.storage.local` in the browser profile.
- The content script reads only the Gmail message-list information needed to apply the user's matching rules.

The extension requires the `storage` permission to save preferences and access to `https://mail.google.com/*` to apply labels within Gmail.

This privacy description reflects the code in this package. If the project later adds remote services, analytics, or other data processing, update the privacy notice before distributing that version.

## Project structure

```text
eHali/
├── manifest.json
├── defaults.js
├── content.js
├── style.css
├── popup.html
├── popup.css
├── popup.js
├── icons/
│   ├── logo.svg
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── README.md
└── PRIVACY.md
```

## Troubleshooting

- **Labels do not appear:** confirm the extension is enabled, refresh Gmail, and check `chrome://extensions` for errors.
- **A label is unexpected:** use the preview box, review its selected fields, sender entries, exclusions, and rule order.
- **Settings do not persist:** check whether Chrome is reporting extension storage errors and ensure the extension is not disabled.
- **Gmail changed its layout:** inspect the message row and sender/subject/snippet selectors in `content.js`.

## Development note

This is a local browser extension, not an official Gmail feature. It is not affiliated with or endorsed by Google.
