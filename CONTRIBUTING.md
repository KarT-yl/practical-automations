# Contributing

Open an issue with the problem, expected behavior, browser/version, and a redacted example of the offer wording. Do not share account URLs, routing keys, card numbers, bank credentials, real exports, or screenshots with personal account details.

For a change:

1. Install development dependencies with `npm ci` and `npx playwright install chromium`.
2. Make the smallest change that solves the problem. Keep permissions limited and analysis explicit.
3. Add a meaningful regression fixture when changing enrollment, extraction, messaging, or calculations.
4. Run `npm test` and `npm run format:check`. Use `npm run format` to format changes.
5. Explain the trigger, resulting behavior, and checks in the pull request.

Future tools belong under `tools/<tool-name>/`, with their own usage guide and tests. Keep generated browser profiles and local offer data out of version control.
