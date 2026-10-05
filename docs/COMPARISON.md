# How this compares with paid tools

Checked **October 5, 2026** against the vendors' official pages. Prices are U.S. list prices; promotions, taxes, and future changes can differ. This is a feature comparison, not a hands-on benchmark of the competing apps.

## The short answer

This is a **free, open-source alternative for one narrow workflow**: activate available Amex offers on your selected card, scan saved offers, and generate a local report. It is not the free edition of any vendor's product and does not reproduce their complete feature set.

| Tool            | Cost for the relevant paid offering         | Relevant capabilities                                                                                         | When it is a better fit                                                               |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| This extension  | Free, MIT licensed                          | Selected-card Amex activation; saved-offer scanning; separate cash/points rankings; CSV, HTML, and print      | You want a simple local Amex workflow without a subscription or another account       |
| CardPointers+   | $99.99/year; $11.99/month; $299.99 lifetime | Offer automation across six major banks, shopping prompts, expiry reminders, and broader card recommendations | You want a wider card ecosystem and reminders integrated into shopping and mobile use |
| MaxRewards Gold | Starts at $9/month, billed $108/year        | Offer activation and consolidation, benefit and bonus trackers, alongside linked card/account information     | You want consolidated cards, benefits, and account information in an app              |
| CardStack+      | $12.99/month or $89.99/year                 | Amex/Chase offer activation, automated credit tracking, spending analysis, and best-card suggestions          | You want offer activation plus tracking of credits and spending                       |

CardPointers pricing comes from its [official pricing FAQ](https://help.cardpointers.com/article/43-how-much-does-cardpointers-cost); capabilities and free/paid distinctions come from the [plan comparison](https://cardpointers.com/pro/) and [extension page](https://cardpointers.com/extension/). Its free version exists; a free extension download does not mean all paid automation features are free.

MaxRewards pricing and account integration are described on its [official app page](https://maxrewards.com/app); [subscription tiers](https://help.maxrewards.com/en/articles/12747576-what-are-the-maxrewards-subscription-tiers) place offer activation in Gold. Its Bronze tier is free and includes other core features.

CardStack's [pricing page](https://cardstack.money/pricing) distinguishes free manual tracking from the paid features. Its [offer-activation page](https://cardstack.money/app/features/auto-add-offers) describes Amex and Chase support.

## Reasons to choose this project

- **Zero subscription cost:** activation and reports are included without a trial ending.
- **Inspectable and adaptable:** all extension source is in this repository, with no production dependencies or server to maintain.
- **No extra account:** you sign in to Amex yourself. The extension does not ask for your bank password or a separate service login.
- **Portable reports:** CSV and standalone HTML let you review offers outside the extension.
- **Explicit assumptions:** cash and points stay separate; ambiguous conditions are flagged; return calculations and original summaries are visible.

Those are benefits of this project's design, not claims that every competitor lacks them. In particular, CardPointers also documents an extension workflow that does not require handing over bank logins.

## Reasons to choose a paid product

This extension supports only English-language U.S. Amex pages and operates on the currently selected card. It has no mobile app, shopping-site reminders, cross-device synchronization, automatic redemption tracking, background scheduling, or broader best-card engine. Scans are snapshots taken when you run the extension.

Amex offer placement across multiple cards can matter. This project does not allocate offers among cards. CardPointers and MaxRewards document card-priority behavior in their respective [multi-card guide](https://help.cardpointers.com/article/71-adding-an-offer-to-multiple-cards) and [Amex priority guide](https://help.maxrewards.com/en/articles/16863744-choose-which-amex-cards-get-priority-for-offers). Select your intended card before running this tool.

The report shows potential rewards, not money already saved. Purchase eligibility, exclusions, remaining uses, and posting deadlines still come from the full Amex terms.

CardPointers also documents [offer filtering and sorting](https://help.cardpointers.com/article/57-filtering-and-sorting-offers), and MaxRewards Gold includes [sorting, Best Card integration, and expiry alerts](https://help.maxrewards.com/en/articles/4655178-what-is-maxrewards-gold). Enrollment plus analysis is not unique to this project. Its defensible advantages are free use, inspectable code, no separate account, and local portable reports for a narrow Amex workflow. No comparative speed or reliability benchmark has been performed.
