// All merchants, offer summaries, and dates below are fictional demonstration data.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const extension = path.join(root, 'tools/amex-offers/extension');
const output = path.join(root, 'docs');
const examples = [
  [
    'Maple Market',
    'Spend $100 or more, earn $20 back, up to 2 times (total of $40).',
    '10/8/26',
  ],
  ['Northline Outfitters', 'Spend $150 or more, earn $50 back', '11/15/26'],
  [
    'Field & Form',
    'Earn 15% back on eligible purchases, up to a total of $30',
    '10/21/26',
  ],
  [
    'Juniper Coffee',
    'Spend $50 or more, earn 1,000 Membership Rewards points',
    '10/20/26',
  ],
  [
    'Vista Travel',
    'Earn +3 Membership Rewards points per eligible dollar spent, up to 3,000 points',
    '11/30/26',
  ],
  [
    'Cloud Studio',
    'Spend $12 or more, earn $12 back, up to 3 times (total of $36).',
    '10/25/26',
  ],
  ['Corner Bookstore', 'Spend $25 or more, earn $5 back', '10/6/26'],
  ['Riverside Dining', 'Spend $100 or more, earn $15 back', '11/10/26'],
];
const offers = examples.map(([merchant, description, expiry]) => ({
  merchant,
  description,
  expirationText: `Expires ${expiry}`,
  status: 'added',
  rawText: `${merchant}\n${description}\nExpires ${expiry}\nFictional offer for demonstration only.`,
}));

(async () => {
  fs.mkdirSync(path.join(output, 'images'), { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1500, height: 1040 },
      acceptDownloads: true,
    });
    await page.route('https://report.test/**', (route) => {
      const file = new URL(route.request().url()).pathname.slice(1);
      return route.fulfill({
        contentType: file.endsWith('.js')
          ? 'text/javascript'
          : file.endsWith('.css')
            ? 'text/css'
            : 'text/html',
        body: fs.readFileSync(path.join(extension, file)),
      });
    });
    await page.addInitScript(
      ({ offers }) => {
        let data = {
          reports: [
            {
              id: 'fictional-demo',
              source: 'Fictional demonstration — selected card',
              generatedAt: '2026-10-04T12:00:00Z',
              coverage: { expected: offers.length, complete: true },
              offers,
            },
          ],
        };
        window.chrome = {
          storage: {
            local: {
              get: async () => data,
              set: async (value) => {
                data = { ...data, ...value };
              },
              remove: async (keys) => {
                for (const key of keys) delete data[key];
              },
            },
          },
        };
      },
      { offers },
    );
    await page.goto('https://report.test/report.html?id=fictional-demo');
    await page.locator('#offers tr').first().waitFor();
    await page.locator('#asof').fill('2026-10-04');
    await page.locator('h1').click();
    await page.screenshot({
      path: path.join(output, 'images/report-overview.png'),
    });
    await page
      .locator('.list')
      .screenshot({ path: path.join(output, 'images/report-details.png') });
    const download = page.waitForEvent('download');
    await page.locator('#html').click();
    await (await download).saveAs(path.join(output, 'demo-report.html'));

    const demo = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    const cards = offers
      .slice(0, 4)
      .map(
        (offer) =>
          `<article><h3>${offer.merchant}</h3><p>${offer.description}</p><p data-testid="merchantOfferExpiration">${offer.expirationText}</p><button title="add to list card" onclick="this.title='added to list card';this.textContent='Added to Card'">+ Add to Card</button></article>`,
      )
      .join('');
    await demo.route('https://global.americanexpress.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<html><head><title>Fictional offers demonstration</title><style>body{margin:0;background:#f4f7fc;font:16px/1.6 system-ui;color:#142033}header{background:#121c32;color:white;padding:32px 60px}header p{color:#bacbe6}main{padding:32px 60px}section{display:grid;grid-template-columns:1fr 1fr;gap:22px;max-width:970px}article{background:white;border:1px solid #dae2ee;border-radius:16px;padding:26px}h1{margin:0;font-size:32px}h3{margin:0;font-size:20px}button{border:0;border-radius:8px;padding:10px 14px;background:#1558d6;color:white;font:inherit;cursor:pointer}.label{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#a9d5ff}</style></head><body><header><div class="label">Practical Automations / fictional demo</div><h1>One click. Offers ready to use.</h1><p>Demonstration page with fictional offers. No bank account is connected.</p></header><main><h2>Available offers</h2><section>${cards}</section></main></body></html>`,
      }),
    );
    await demo.goto('https://global.americanexpress.com/offers/eligible');
    await demo.evaluate(() => {
      window.chrome = {
        runtime: {
          sendMessage: async (message) =>
            message.type === 'PING_REPORTS'
              ? { ok: true, reporting: true }
              : { ok: true },
        },
      };
      const original = setTimeout;
      window.setTimeout = (fn, ms) => original(fn, Math.max(1, ms * 0.02));
    });
    for (const file of ['bridge.js', 'offer-data.js', 'offers.js'])
      await demo.evaluate(fs.readFileSync(path.join(extension, file), 'utf8'));
    await demo.waitForFunction(
      () => !globalThis.__amexOffersOneClickV1.running,
    );
    await demo.screenshot({ path: path.join(output, 'images/enrollment.png') });
    console.log(
      'Generated fictional report, report screenshots, and enrollment screenshot.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
