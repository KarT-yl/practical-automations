# MyTE Hours Filler

A small, independent browser extension that enters a standard schedule into MyTE's Working Hours window. It fills page controls; it does not save or submit a timesheet. Review and correct the entries to match hours actually worked before saving.

## Install

1. Download the MyTE ZIP from the repository's **myte-v1.0.2** release and extract it.
2. Open `edge://extensions`, `chrome://extensions`, or `opera://extensions`.
3. Enable Developer mode, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.
4. Sign in to MyTE normally and open the Working Hours window.
5. Click the extension, enter your start/end and lunch times, and list days off as `MM/DD` separated by commas.
6. Fill, inspect every row, correct exceptions, and save in MyTE yourself.

For repository installations, load `tools/myte-hours/extension`.

## Source preservation and improvements

`original-v1.0.1/` contains the four files extracted verbatim between the supplied text file's BEGIN/END markers. The separate `extension/` folder is version 1.0.2:

- Validates time ranges and calendar dates before touching the page.
- Stores preferences in `chrome.storage.local` instead of browser sync, with debounced writes.
- Removes persistent host access; injection uses the temporary `activeTab` permission and the existing MyTE URL check.
- Avoids an arbitrary last-cell click when an add control cannot be identified, and skips controls that remain disabled.
- Clarifies that excluded dates are left unchanged and existing weekday values may be replaced.

## How it works

The popup collects a morning/lunch/afternoon schedule, converts it to the dropdowns' 12-hour format, and injects one self-contained function on the active MyTE tab. That function reads weekday/date labels, locates dropdowns in the grid, selects matching options, and dispatches change events so the page can process the edits. It scrolls the grid to fill rendered rows. When enabled, it tries to add a second line for visible one-line weekdays, then fills again. It reports missing lines, extra lines, or unmatched dropdown choices.

## Limits and validation

This version has been checked against synthetic browser fixtures, not an authenticated MyTE session. Actual page structure, embedded frames, dropdown behavior, and employer-managed browser restrictions may differ. Automatic second-line creation is limited to rows visible during that phase; missing dates are reported for manual correction. It assumes English weekday labels and month/day dates. It does not support overnight shifts or infer hours worked. Skipped days are not cleared. Existing weekday entries can be overwritten, and more than two lines require manual review.

No credentials, employee identifiers, timesheet exports, or workplace screenshots are included. Preferences remain in the browser profile; this code contains no external reporting service. The original version retains its original browser-sync behavior and host permission. No approval or endorsement by Accenture is implied.

Run `node tests/test-myte.cjs` from the repository root after installing development dependencies. Set `PLAYWRIGHT_CHANNEL=msedge` to use installed Edge on Windows.
