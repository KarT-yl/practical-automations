const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
let listener, messageListener, updated;
const calls = [];
let data = {},
  session = {};
const context = {
  URL,
  crypto,
  chrome: {
    runtime: {
      id: 'extension-test',
      getManifest: () => ({ version: '2.0.1' }),
      getURL: (name) => 'chrome-extension://extension-test/' + name,
      onMessage: { addListener: (fn) => (messageListener = fn) },
    },
    storage: {
      local: {
        get: async () => data,
        set: async (value) => (data = { ...data, ...value }),
      },
      session: {
        get: async (key) => ({ [key]: session[key] }),
        set: async (value) => (session = { ...session, ...value }),
        remove: async (key) => delete session[key],
      },
    },
    tabs: {
      create: async (args) => calls.push(['tab', args]),
      update: async (id, args) => calls.push(['navigate', id, args]),
      onUpdated: { addListener: (fn) => (updated = fn) },
    },
    action: {
      onClicked: { addListener: (fn) => (listener = fn) },
      setBadgeText: async (args) => calls.push(['badge', args]),
      setBadgeBackgroundColor: async (args) => calls.push(['color', args]),
      setTitle: async (args) => calls.push(['title', args]),
    },
    scripting: { executeScript: async (args) => calls.push(['inject', args]) },
  },
};
vm.runInNewContext(
  fs.readFileSync('tools/amex-offers/extension/background.js', 'utf8'),
  context,
);
const message = (input, sender) =>
  new Promise((resolve) => {
    if (!messageListener(input, sender, resolve)) resolve(undefined);
  });
(async () => {
  for (const url of [
    'https://example.com/offers/eligible',
    'https://global.americanexpress.com.evil.example/offers/eligible',
    'http://global.americanexpress.com/offers/eligible',
    'https://global.americanexpress.com/account',
    'opera://extensions',
  ]) {
    calls.length = 0;
    await listener({ id: 7, url });
    assert(!calls.some(([name, args]) => name === 'inject' && args.files));
    assert(
      calls.some(([name, args]) => name === 'badge' && args.text === 'PAGE'),
    );
  }
  calls.length = 0;
  await listener({
    id: 7,
    url: 'https://global.americanexpress.com/dashboard',
  });
  assert(
    calls.some(
      ([name, args]) => name === 'inject' && typeof args.func === 'function',
    ),
  );
  calls.length = 0;
  await listener({
    id: 7,
    url: 'https://global.americanexpress.com/offers/eligible',
  });
  assert(
    calls.some(
      ([name, args]) => name === 'inject' && args.files.includes('offers.js'),
    ),
  );
  calls.length = 0;
  await listener({
    id: 7,
    url: 'https://global.americanexpress.com/offers/enrolled',
  });
  assert(
    calls.some(
      ([name, args]) =>
        name === 'inject' && args.files.includes('scan-report.js'),
    ),
  );
  assert(
    !calls.some(
      ([name, args]) => name === 'inject' && args.files.includes('offers.js'),
    ),
  );
  const sender = {
    id: 'extension-test',
    url: 'https://global.americanexpress.com/offers?account_key=TEST_ONLY',
    tab: { id: 7 },
  };
  assert((await message({ type: 'PING_REPORTS' }, sender)).reporting);
  assert.equal(
    await message(
      { type: 'SAVE_REPORT', report: { offers: [] } },
      { ...sender, url: 'https://evil.example/offers' },
    ),
    undefined,
  );
  const response = await message(
    {
      type: 'SAVE_REPORT',
      report: {
        source: 'Added to Card list',
        coverage: { expected: 1, complete: true },
        offers: [
          {
            merchant: 'Test',
            description: 'Spend $50, earn $10 back',
            expirationText: 'Expires 10/6/26',
            status: 'added',
            account_key: 'must-not-store',
          },
        ],
      },
    },
    sender,
  );
  assert(response.ok);
  assert.equal(data.reports.length, 1);
  assert(!JSON.stringify(data).includes('account_key'));
  assert(
    calls.some(
      ([name, args]) => name === 'tab' && args.url.includes('report.html?id='),
    ),
  );
  const empty = await message(
    { type: 'SAVE_REPORT', report: { offers: [] } },
    sender,
  );
  assert(!empty.ok);
  calls.length = 0;
  await message({ type: 'OPEN_ADDED_REPORT' }, sender);
  assert(session.pendingReport_7);
  assert(
    calls.some(
      ([name, id, args]) =>
        name === 'navigate' &&
        args.url ===
          'https://global.americanexpress.com/offers/enrolled?account_key=TEST_ONLY',
    ),
  );
  await updated(
    7,
    { status: 'complete' },
    { url: 'https://global.americanexpress.com/offers/enrolled' },
  );
  assert(
    calls.some(
      ([name, args]) =>
        name === 'inject' && args.files.includes('scan-report.js'),
    ),
  );
  assert(!session.pendingReport_7);
  context.chrome.scripting.executeScript = async () => {
    throw new Error('No access');
  };
  calls.length = 0;
  await listener({ id: 7, url: sender.url });
  assert(calls.some(([name, args]) => name === 'badge' && args.text === 'ERR'));
  const manifest = JSON.parse(
    fs.readFileSync('tools/amex-offers/extension/manifest.json', 'utf8'),
  );
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'storage']);
  for (const file of [
    'background.js',
    'offers.js',
    'offer-data.js',
    'scan-report.js',
    'analysis.js',
    'report.html',
    'report.css',
    'report.js',
  ])
    assert(fs.existsSync('tools/amex-offers/extension/' + file));
  console.log(
    'PASS URL gating, separate add/report actions, local report persistence, sender validation, empty reports, card-routing preservation and automatic scan navigation',
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
