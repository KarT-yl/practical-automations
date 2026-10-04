const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const row = (merchant, expiry = '10/6/26') =>
  `<div><div class="logo"><img data-testid="merchantOfferImage" alt="${merchant}"></div><div><h3>${merchant}</h3><div data-testid="overflowTextContainer">Spend $100 or more, earn $20 back, up to 2 times (total of $40).</div><p data-testid="merchantOfferExpiration">Expires ${expiry}</p><button>Terms apply</button></div><div><button>View Details</button><button title="added to list card"><svg width="20" height="20"></svg></button></div></div>`;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
  });
  const page = await browser.newPage();
  await page.route('**/*', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body:
        '<h2>Added to Card (3)</h2>' +
        row('A') +
        row('B') +
        '<button id="more" onclick="this.remove();document.body.insertAdjacentHTML(\'beforeend\',window.rowC)">Show More</button>',
    }),
  );
  await page.goto(
    'https://global.americanexpress.com/offers/enrolled?account_key=PRIVATE_TEST',
  );
  await page.evaluate((rowC) => {
    window.rowC = rowC;
    window.savedReport = null;
    window.chrome = {
      runtime: {
        sendMessage: async (message) => {
          if (message.type === 'PING_REPORTS') return { reporting: true };
          window.savedReport = message.report;
          return { ok: true };
        },
      },
    };
    const timer = setTimeout;
    window.setTimeout = (fn, ms) => timer(fn, Math.max(1, ms * 0.01));
  }, row('C'));
  await page.evaluate(
    fs.readFileSync('tools/amex-offers/extension/offer-data.js', 'utf8'),
  );
  await page.evaluate(
    fs.readFileSync('tools/amex-offers/extension/bridge.js', 'utf8'),
  );
  const initial = await page.evaluate(() => AmexOfferData.scan(true));
  assert.equal(initial.length, 2);
  assert.equal(initial[0].merchant, 'A');
  assert.match(initial[0].description, /Spend \$100/);
  assert.equal(initial[0].expirationText, 'Expires 10/6/26');
  await page.evaluate(
    fs.readFileSync('tools/amex-offers/extension/scan-report.js', 'utf8'),
  );
  await page.waitForFunction(() => window.savedReport);
  const result = await page.evaluate(() => savedReport);
  assert.equal(result.offers.length, 3);
  assert(result.coverage.complete);
  assert(!JSON.stringify(result).includes('PRIVATE_TEST'));
  assert(result.offers.every((row) => row.status === 'added'));
  await browser.close();
  console.log(
    'PASS live-style offer extraction, deduplication, expiration capture, Show More loading, coverage count and account-key exclusion',
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
