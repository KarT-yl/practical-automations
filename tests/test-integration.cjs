const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const source = path.resolve('tools/amex-offers/extension');
const fixture = path.resolve('artifacts/integration-extension');
fs.mkdirSync(fixture, { recursive: true });
for (const file of fs.readdirSync(source))
  if (fs.statSync(path.join(source, file)).isFile())
    fs.copyFileSync(path.join(source, file), path.join(fixture, file));
const manifest = JSON.parse(
  fs.readFileSync(path.join(fixture, 'manifest.json'), 'utf8'),
);
// The test copy alone gets a synthetic-page grant so headless tests can inject.
// Delivered permissions remain activeTab + scripting + storage.
manifest.host_permissions = ['https://global.americanexpress.com/*'];
fs.writeFileSync(path.join(fixture, 'manifest.json'), JSON.stringify(manifest));
const offer = (title) =>
  `<article><h3>${title}</h3><div>Spend $100 or more, earn $20 back</div><p data-testid="merchantOfferExpiration">Expires 11/2/26</p><button title="added to list card">Added to Card</button></article>`;
(async () => {
  const context = await chromium.launchPersistentContext(
    path.resolve('artifacts/integration-profile-' + Date.now()),
    {
      headless: true,
      channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
      args: [
        `--disable-extensions-except=${fixture}`,
        `--load-extension=${fixture}`,
      ],
    },
  );
  try {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent('serviceworker'));
    const page = await context.newPage();
    await page.route('https://global.americanexpress.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<h2>Added to Card (2)</h2>' + offer('First') + offer('Second'),
      }),
    );
    await page.goto('https://global.americanexpress.com/offers');
    const tabId = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({
        url: 'https://global.americanexpress.com/*',
      });
      return tabs[0].id;
    });
    await worker.evaluate(async (id) => {
      await chrome.scripting.executeScript({
        target: { tabId: id },
        files: ['bridge.js', 'offer-data.js', 'offers.js'],
      });
    }, tabId);
    // The first page already contains saved rows; add loop reaches its normal end
    // and uses the real background message handler to navigate + scan + open report.
    const report = await context
      .waitForEvent('page', {
        predicate: (p) =>
          p.url().startsWith('chrome-extension://') ||
          p.url() === 'about:blank',
        timeout: 30000,
      })
      .catch(async (error) => {
        console.error(
          'Page text:',
          (await page.locator('body').innerText()).slice(-2000),
        );
        console.error(
          'Worker version:',
          await worker.evaluate(() => chrome.runtime.getManifest().version),
        );
        throw error;
      });
    await report.waitForURL(/report\.html\?id=/);
    await report.locator('#offers tr').first().waitFor();
    assert.equal(await report.locator('#offers tr').count(), 2);
    assert.match(
      await report.locator('#coverage').innerText(),
      /2 offers captured/,
    );
    const stored = await worker.evaluate(
      async () => await chrome.storage.local.get('reports'),
    );
    assert.equal(stored.reports[0].offers.length, 2);
    // Verify SAVE_REPORT through the actual isolated content world, not a mock.
    const secondPage = context.waitForEvent('page');
    await worker.evaluate(
      async (id) =>
        await chrome.scripting.executeScript({
          target: { tabId: id },
          func: () =>
            chrome.runtime.sendMessage({
              type: 'SAVE_REPORT',
              report: AmexOfferData.makeReport(
                AmexOfferData.scan(true),
                'This enrollment run',
                { expected: null, complete: false },
              ),
            }),
        }),
      tabId,
    );
    const runReport = await secondPage;
    await runReport.waitForURL(/report\.html\?id=/);
    await runReport.locator('#offers tr').first().waitFor();
    assert.equal(await runReport.locator('#offers tr').count(), 2);
    console.log(
      'PASS real extension messages, automatic Added to Card navigation, isolated collector, local persistence, new report tabs and run reports',
    );
  } finally {
    await context.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
