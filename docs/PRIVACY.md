# Privacy

The shipped extension requests `activeTab`, `scripting`, and `storage`. It has no broad host permissions and runs when you click its icon on an eligible Amex page.

Offer snapshots contain merchant names, visible descriptions, expiry text, captured original summary text, and enrollment status. The latest ten snapshots and planned-purchase selections are stored in `chrome.storage.local`. This is local storage, not browser sync. A temporary scan-start timestamp is stored in session storage.

It does not collect bank passwords, cookies, card numbers, transaction history, or account URLs in reports. It has no telemetry, analytics, remote code, or external reporting service. The normal Amex page communicates with Amex as its own enrollment buttons are clicked.

During automatic navigation to the saved list, the current page's routing query is preserved inside the Amex tab so the selected-card context is retained. It is not added to the saved report.

Use **Clear local reports** in a report's footer to remove snapshots and selections. Files you export are separate copies; deleting browser reports does not remove downloaded HTML, CSV, or PDF files. Treat real exports as personal financial information. Repository screenshots, examples, and test fixtures use fictional data.
