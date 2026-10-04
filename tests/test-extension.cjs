const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const dir = path.resolve('tools/amex-offers/extension');
const script = fs.readFileSync(path.join(dir, 'offers.js'), 'utf8');
const url = 'https://global.americanexpress.com/offers/eligible';
const offer = (id, label = 'Add to Card') =>
  `<article id="${id}"><h3>${id}</h3><p>Spend $50, earn $10 back</p><button title="${label}" onclick="window.calls.push('${id}'); window.handle(this)">${label === 'add to card' ? '+' : label}</button></article>`;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
  });
  const results = [];
  async function test(name, html, handler, check, target = url) {
    const page = await browser.newPage();
    await page.route('**/*', (route) =>
      route.fulfill({ contentType: 'text/html', body: html }),
    );
    await page.goto(target);
    await page.evaluate((handler) => {
      window.calls = [];
      window.handle = new Function('button', handler);
      const timer = window.setTimeout.bind(window);
      window.setTimeout = (fn, ms, ...args) =>
        timer(fn, Math.max(1, ms * 0.01), ...args);
      const originalNow = Date.now.bind(Date);
      const epoch = originalNow();
      Date.now = () => epoch + (originalNow() - epoch) * 100;
      const attach = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (options) {
        return attach.call(this, { ...options, mode: 'open' });
      };
    }, handler);
    await page.evaluate(script);
    await check(page);
    results.push(name);
    await page.close();
  }
  const done = (page) =>
    page.waitForFunction(() => !globalThis.__amexOffersOneClickV1?.running);
  const state = (page) =>
    page.evaluate(() => {
      const s = globalThis.__amexOffersOneClickV1;
      return {
        clicks: s.clicks,
        confirmed: s.confirmed,
        removed: s.removed,
        message: s.host.shadowRoot.getElementById('status').textContent,
        calls: window.calls,
      };
    });
  await test(
    'sequential enrollment and plus buttons; unrelated controls untouched',
    offer('A') +
      offer('B', 'add to card') +
      '<button onclick="calls.push(\'BAD\')">View Details</button>',
    "setTimeout(()=>{button.textContent='Added to Card';button.title='Added to Card'}, 500)",
    async (page) => {
      await done(page);
      const s = await state(page);
      assert.deepEqual(s.calls, ['A', 'B']);
      assert.equal(s.confirmed, 2);
      assert.match(s.message, /Finished/);
    },
  );
  await test(
    'button removal reported separately',
    offer('A') + offer('B'),
    'button.closest("article").remove()',
    async (page) => {
      await done(page);
      const s = await state(page);
      assert.equal(s.removed, 2);
      assert.equal(s.confirmed, 0);
    },
  );
  await test(
    'live Amex list-view title is recognized',
    '<article><h3>List view offer</h3><button data-testid="merchantOfferListAddButton" title="add to list card" onclick="calls.push(\'list\');handle(this)"><span></span><svg width="20" height="20"></svg></button></article>',
    "button.title='added to list card'",
    async (page) => {
      await done(page);
      const s = await state(page);
      assert.deepEqual(s.calls, ['list']);
      assert.equal(s.confirmed, 1);
    },
  );
  await test(
    'unlabelled unrelated plus is never clicked',
    '<button onclick="calls.push(\'BAD\')">+</button>' + offer('A'),
    "button.textContent='Added to Card';button.title='Added to Card'",
    async (page) => {
      await done(page);
      assert.deepEqual((await state(page)).calls, ['A']);
    },
  );
  await test(
    'slow initial rendering is allowed',
    '<h1>Loading offers</h1>',
    "button.textContent='Added to Card';button.title='Added to Card'",
    async (page) => {
      await page.evaluate(
        (html) =>
          setTimeout(
            () => document.body.insertAdjacentHTML('beforeend', html),
            6000,
          ),
        offer('late'),
      );
      await done(page);
      assert.deepEqual((await state(page)).calls, ['late']);
    },
  );
  await test(
    'timeout stops before next offer',
    offer('A') + offer('B'),
    '',
    async (page) => {
      await done(page);
      const s = await state(page);
      assert.equal(s.clicks, 1);
      assert.match(s.message, /12 seconds/);
    },
  );
  await test(
    'page errors stop enrollment',
    offer('A') + offer('B'),
    `document.body.insertAdjacentHTML('beforeend','<p role="alert">Unable to enroll</p>')`,
    async (page) => {
      await done(page);
      const s = await state(page);
      assert.equal(s.clicks, 1);
      assert.match(s.message, /message/);
    },
  );
  await test(
    'success alerts do not stop enrollment',
    offer('A') + offer('B'),
    `button.textContent='Added to Card';button.title='Added to Card'; document.body.insertAdjacentHTML('beforeend','<p role="alert">Offer successfully added to card</p>')`,
    async (page) => {
      await done(page);
      const s = await state(page);
      assert.equal(s.confirmed, 2);
      assert.match(s.message, /Finished/);
    },
  );
  await test(
    'dialog requires manual completion',
    offer('A') + offer('B'),
    `document.body.insertAdjacentHTML('beforeend','<div role="dialog" aria-modal="true">Confirm enrollment</div>')`,
    async (page) => {
      await done(page);
      const s = await state(page);
      assert.equal(s.clicks, 1);
      assert.match(s.message, /dialog/);
    },
  );
  await test(
    'duplicate invocation does not double click',
    offer('A') + offer('B'),
    "setTimeout(()=>{button.textContent='Added to Card';button.title='Added to Card'},1000)",
    async (page) => {
      await page.evaluate(script);
      await done(page);
      const s = await state(page);
      assert.deepEqual(s.calls, ['A', 'B']);
    },
  );
  await test(
    'Stop prevents further clicks',
    offer('A') + offer('B'),
    "globalThis.__amexOffersOneClickV1.host.shadowRoot.getElementById('stop').click()",
    async (page) => {
      await done(page);
      const s = await state(page);
      assert.equal(s.clicks, 1);
      assert.match(s.message, /Stopped/);
    },
  );
  await test(
    'navigation stops before next offer',
    offer('A') + offer('B'),
    "history.pushState({},'', '/offers/eligible?card=other')",
    async (page) => {
      await done(page);
      const s = await state(page);
      assert.equal(s.clicks, 1);
      assert.match(s.message, /page changed/);
    },
  );
  await test(
    'rerendered unchanged offer is not retried',
    offer('A') + offer('B'),
    "button.closest('article').outerHTML=button.closest('article').outerHTML",
    async (page) => {
      await done(page);
      const s = await state(page);
      assert.equal(s.clicks, 1);
      assert.match(s.message, /reappeared/);
    },
  );
  await test(
    'lazy-loaded offers are picked up',
    offer('A'),
    `button.textContent='Added to Card';button.title='Added to Card'; if (calls.length === 1) setTimeout(()=>document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(offer('B'))}),1500)`,
    async (page) => {
      await done(page);
      const s = await state(page);
      assert.deepEqual(s.calls, ['A', 'B']);
    },
  );
  await test(
    'wrong domain does nothing',
    offer('A'),
    'button.remove()',
    async (page) => {
      assert.equal(
        await page.evaluate(() => globalThis.__amexOffersOneClickV1),
        undefined,
      );
      assert.deepEqual(await page.evaluate(() => calls), []);
    },
    'https://global.americanexpress.com.evil.example/offers/eligible',
  );
  await test(
    'old background reporting support is detected before adding',
    offer('A'),
    'button.remove()',
    async (page) => {
      await done(page);
      await page.evaluate(() => {
        window.chrome = { runtime: { sendMessage: async () => undefined } };
      });
      await page.evaluate(script);
      await done(page);
      const s = await state(page);
      assert.equal(s.clicks, 0);
      assert.match(s.message, /Reload Amex Offers/);
    },
  );
  await test(
    'hidden and disabled buttons skipped',
    '<div style="display:none">' +
      offer('hidden') +
      '</div>' +
      offer('disabled').replace('<button ', '<button disabled ') +
      offer('A'),
    "button.textContent='Added to Card';button.title='Added to Card'",
    async (page) => {
      await done(page);
      assert.deepEqual((await state(page)).calls, ['A']);
    },
  );
  await browser.close();
  console.log(
    `PASS ${results.length} browser scenarios:\n` +
      results.map((x) => '- ' + x).join('\n'),
  );
  fs.writeFileSync(
    path.resolve('artifacts/test-results.txt'),
    `PASS ${results.length} browser scenarios\n` + results.join('\n'),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
