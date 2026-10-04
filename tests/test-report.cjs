const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const dir = path.resolve('tools/amex-offers/extension');
const offers = [
  {
    merchant: 'Soon store',
    description:
      'Spend $100 or more, earn $20 back, up to 2 times (total of $40).',
    expirationText: 'Expires 10/6/26',
    status: 'added',
    rawText:
      'Soon store Spend $100 or more, earn $20 back, up to 2 times (total of $40). Expires 10/6/26',
  },
  {
    merchant: 'Best cash',
    description: 'Spend $50, earn $25 back',
    expirationText: 'Expires 11/2/26',
    status: 'added',
    rawText: 'Best cash Spend $50, earn $25 back Expires 11/2/26',
  },
  {
    merchant: 'Points store',
    description:
      'Earn +5 Membership Rewards points per eligible dollar spent, up to 5,000 points',
    expirationText: 'Expires 10/20/26',
    status: 'added',
    rawText: 'Original points terms',
  },
  {
    merchant: '=HYPERLINK("https://example.com")',
    description: 'Spend $50, earn $40 back',
    expirationText: 'Expires 10/20/26',
    status: 'unverified',
    rawText: '<img src=x onerror=alert(1)>',
  },
  {
    merchant: 'Expired store',
    description: 'Spend $50, earn $10 back',
    expirationText: 'Expires 10/2/26',
    status: 'added',
    rawText: 'expired',
  },
];
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
  });
  const page = await browser.newPage({
    acceptDownloads: true,
    viewport: { width: 1500, height: 1000 },
  });
  await page.route('https://report.test/**', (route) => {
    const name =
      new URL(route.request().url()).pathname.slice(1) || 'report.html';
    route.fulfill({
      contentType: name.endsWith('.js')
        ? 'text/javascript'
        : name.endsWith('.css')
          ? 'text/css'
          : 'text/html',
      body: fs.readFileSync(path.join(dir, name)),
    });
  });
  await page.addInitScript(
    ({ offers }) => {
      let data = {
        reports: [
          {
            id: 'test',
            source: 'Added to Card list',
            generatedAt: '2026-10-04T00:00:00Z',
            coverage: { expected: 5, complete: true },
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
  await page.goto('https://report.test/report.html?id=test');
  await page.locator('#asof').fill('2026-10-03');
  await page.waitForFunction(() =>
    document.querySelector('#offers').textContent.includes('Soon store'),
  );
  assert.equal(await page.locator('#offers tr').count(), 4);
  assert.match(await page.locator('#soon').innerText(), /Soon store/);
  assert(!(await page.locator('#cashbest').innerText()).includes('HYPERLINK'));
  assert.match(
    await page.locator('#cashbest .pick').first().innerText(),
    /Best cash/,
  );
  assert.match(await page.locator('#pointsbest').innerText(), /5 bonus points/);
  await page.locator('#search').fill('Best cash');
  assert.equal(await page.locator('#offers tr').count(), 1);
  await page.locator('#offers input[type=checkbox]').check();
  await page.locator('#search').fill('');
  await page.locator('#plannedonly').check();
  assert.equal(await page.locator('#offers tr').count(), 1);
  await page.locator('#plannedonly').uncheck();
  await page.locator('#kind').selectOption('cash');
  assert.equal(await page.locator('#offers tr').count(), 3);
  await page.locator('#budget').fill('60');
  assert.equal(await page.locator('#offers tr').count(), 2);
  await page.locator('#budget').fill('');
  await page.locator('#kind').selectOption('all');
  const csvDownload = page.waitForEvent('download');
  await page.locator('#csv').click();
  const csv = await csvDownload;
  const csvPath = await csv.path();
  const csvText = fs.readFileSync(csvPath, 'utf8');
  assert(csvText.includes("'=HYPERLINK"));
  assert(csvText.includes('Expired store'));
  assert(csvText.includes('Points store'));
  const htmlDownload = page.waitForEvent('download');
  await page.locator('#html').click();
  const html = await htmlDownload;
  const htmlPath = await html.path();
  const htmlText = fs.readFileSync(htmlPath, 'utf8');
  assert(!htmlText.includes('<script'));
  assert(!htmlText.includes('<img src=x'));
  assert(htmlText.includes('Soon store'));
  await page.locator('#kind').selectOption('all');
  await page.screenshot({
    path: 'artifacts/report-preview.png',
    fullPage: true,
  });
  await browser.close();
  console.log(
    'PASS report rendering, urgent/value recommendations, enrollment exclusions, planned purchases, search, filters, safe CSV and standalone HTML exports',
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
