# Privacy

The Amex extension requests `activeTab`, `scripting`, and `storage`. It has no broad host permissions and runs when you click its icon on an eligible Amex page.

MyTE v1.0.2 uses the same three permissions, with no persistent host permission. It stores schedule preferences and excluded month/day dates in local browser storage and changes controls only when you click Fill on the MyTE page. It does not save or submit timesheets or send data to a reporting service. The preserved original v1.0.1 uses browser-sync settings and a MyTE host permission; it is included for source fidelity, separately from the improved version.

Offer snapshots contain merchant names, visible descriptions, expiry text, captured original summary text, and enrollment status. The latest ten snapshots and planned-purchase selections are stored in `chrome.storage.local`. This is local storage, not browser sync. A temporary scan-start timestamp is stored in session storage.

It does not collect bank passwords, cookies, card numbers, transaction history, or account URLs in reports. It has no telemetry, analytics, remote code, or external reporting service. The normal Amex page communicates with Amex as its own enrollment buttons are clicked.

During automatic navigation to the saved list, the current page's routing query is preserved inside the Amex tab so the selected-card context is retained. It is not added to the saved report.

Use **Clear local reports** in a report's footer to remove snapshots and selections. Files you export are separate copies; deleting browser reports does not remove downloaded HTML, CSV, or PDF files. Treat real exports as personal financial information. Repository screenshots, examples, and test fixtures use fictional data.
