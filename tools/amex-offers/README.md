# Amex Offers — One Click + Reports (2.0.1)

## Install in Opera GX

1. Download the extension ZIP from the [latest GitHub release](https://github.com/KarT-yl/practical-automations/releases/tag/v2.0.1) and extract it. Keep the extracted folder somewhere permanent.
2. Open `opera://extensions` in Opera GX.
3. Turn on **Developer mode**, then click **Load unpacked**.
4. Select the extracted `amex-offers-one-click` folder containing `manifest.json`. If you downloaded or cloned the whole repository, select `tools/amex-offers/extension` instead.
5. Pin **Amex Offers — One Click** using Opera's extensions menu for easy access.

## Use

After updating these files, **reload the extension at opera://extensions and refresh the Amex tab**. Both are needed: an old background process can otherwise display new buttons without being able to open reports. Version 2.0.1 detects that mismatch and gives a clear reload message.

Log into Amex normally. Select the card you want, open **Amex Offers → View All → Available**, and click the extension icon once. A panel shows progress and a **Stop** button. Keep the page open while it runs; interacting with the page stops the run so you can change cards yourself. After a completed run, it opens **Added to Card**, scans your saved offers, and opens a report in a new tab.

To analyze existing offers without adding anything, open **Added to Card → View All** (`/offers/enrolled`) and click the icon. It reads the saved list and opens a report.

After a stopped enrollment run, **Report this run** reports captured offers; unresolved enrollment states are excluded from recommendations. **Analyze all saved offers** opens and reads the complete saved-offers list. The buttons display progress, success, or errors.

## Report features

- Expiration date and days remaining, with an adjustable analysis date (default: today in Central time).
- Spending requirements, fixed cash rewards, percentage returns, stated caps, repeats, and bonus points.
- Offers to use soon; best cash returns; best Membership Rewards points per dollar. Cash and points remain separate.
- Planned-purchase selections, merchant search, spending-limit filters, and optional expired-offer visibility.
- CSV export, standalone HTML export, and printing to PDF.

Rankings favor planned purchases and exclude expired offers, unresolved enrollments, and complex or mixed conditions. Fixed-reward returns are calculated at the displayed spending threshold; spending more can reduce the percentage return. Caps assume no prior redemption. The report does not read transactions, track remaining uses, or replace the full Amex terms. It shows original offer text and flags unclear details instead of inventing values.

Supported U.S. page addresses start with `https://global.americanexpress.com/offers/` or `https://global.americanexpress.com/card-offers/`. On the Amex dashboard, a visible panel now provides an **Open all offers** link. Open that page, then click the extension again. On other sites, the icon displays `PAGE`; its tooltip explains where to go.

The extension adds offers using the page's own Add to Card / Activate Offer buttons, including plus buttons labelled Add to Card and add to list card. It scrolls to load more offers, but does not change filters, cards, or pagination. If there is a Show More button or another page, load it yourself and run again. It finishes when no more add buttons appear after three checks.

## What the counts mean

- **Clicked:** enrollment buttons clicked, including an unresolved final click.
- **Marked added:** the page changed the button or offer to an added/enrolled state.
- **Button updates to verify:** the original button disappeared after a click. This is not proof of enrollment; the subsequent Added to Card scan verifies which offers appear on the saved list.

An error, dialog, page navigation, repeated offer, or unresponsive button stops the run. A Stop request cannot undo a click already sent to Amex. Account and offer terms still apply; this utility does not purchase anything.

## Privacy and permissions

Only `activeTab`, `scripting`, and `storage` are requested. Access is granted when you click the extension. Offer summaries and the latest ten reports are saved locally in the browser so report tabs can read them. Planned-purchase selections stay local as well. No account URLs, account keys, card numbers, cookies, transaction history, analytics, external libraries, or remote code are stored in reports or sent elsewhere. Use **Clear local reports** in the report footer to remove saved reports and selections.

## Validation and limitations

Built as a Manifest V3 extension using Chromium extension APIs. Enrollment scenarios, calculation and date-boundary checks, collector coverage, report rendering and exports, background messages, and a complete installed-extension flow were tested. The complete flow checks real isolated content scripts, background messages, saved-offers navigation, local storage, and report tabs. A complete saved-offers list was also verified live in Opera GX. English-language U.S. pages only; Amex layout changes may require updates. Scans read loaded offer rows, scroll for lazy loading, and expand Show More; the report displays captured versus expected counts when available. Clear filters before scanning. Pagination that is not a Show More control may need to be loaded manually.

## Troubleshooting

| Symptom                                            | What to do                                                                                                                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clicking shows `PAGE`                              | Open the full Amex Offers list on `global.americanexpress.com`, then click again.                                                                                                                   |
| No offers found                                    | On Available, ensure offers are loaded and there are Add to Card buttons. On Added to Card, open View All and clear filters. Already saved offers have no add button; scan them from Added to Card. |
| Report buttons do nothing / background unavailable | Reload at `opera://extensions`, check the installed version, and refresh the Amex tab. The current extension displays a reload message for mismatched background versions.                          |
| A dialog or error stops the run                    | Resolve it on Amex, check whether the last offer was saved, then restart.                                                                                                                           |
| Captured count is lower than expected              | Clear filters, let the page load, and scan again. Load any pagination that is not a Show More control yourself.                                                                                     |
| An offer's value is unknown                        | Open its full terms. Unclear or complex conditions are deliberately excluded from recommendations.                                                                                                  |

## Screenshots and examples

The [report overview](https://github.com/KarT-yl/practical-automations/blob/main/docs/images/report-overview.png), [offer table](https://github.com/KarT-yl/practical-automations/blob/main/docs/images/report-details.png), and [sample HTML report](https://github.com/KarT-yl/practical-automations/blob/main/docs/demo-report.html) use fictional merchants and offers. Download the sample HTML and open it locally.

References: [Opera extension testing](https://help.opera.com/en/extensions/testing/), [Chromium activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [Amex offer enrollment FAQ](https://www.americanexpress.com/us/customer-service/faq.find-add-amex-offers.html).

Independent project; not affiliated with American Express. [MIT license](https://github.com/KarT-yl/practical-automations/blob/main/LICENSE).
