const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const source = fs.readFileSync('tools/myte-hours/extension/popup.js', 'utf8');
const context = vm.createContext({ document: { addEventListener() {} } });
vm.runInContext(source, context);
const config = {
  start: '08:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  end: '17:00',
  skip: '',
};
assert.equal(context.validate(config), '');
for (const patch of [
  { start: '25:00' },
  { end: '09:00' },
  { skip: '2/30' },
  { skip: 'holiday' },
  { skip: '13/1' },
])
  assert.notEqual(context.validate({ ...config, ...patch }), '');
assert.equal(context.validate({ ...config, skip: '2/29, 11/26' }), '');
assert.deepEqual(Array.from(context.normalizeDates('1/2; 11-26')), [
  '01/02',
  '11/26',
]);
assert.deepEqual(Array.from(vm.runInContext("to12('00:05')", context)), [
  '12',
  '05',
  'AM',
]);
assert.deepEqual(Array.from(vm.runInContext("to12('12:00')", context)), [
  '12',
  '00',
  'PM',
]);
const manifest = JSON.parse(
  fs.readFileSync('tools/myte-hours/extension/manifest.json'),
);
assert.equal(manifest.host_permissions, undefined);
assert(!source.includes('chrome.storage.sync'));
const dropdowns = () =>
  Array.from(
    { length: 12 },
    (_, i) =>
      `<select class="dropdown-list">${['', '08', '12', '01', '05', '00', 'AM', 'PM'].map((v) => `<option>${v}</option>`).join('')}</select>`,
  ).join('');
const row = (date, index) =>
  `<div class="ag-row" row-index="${index}">${date}${dropdowns()}</div>`;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
  });
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<div class="popup-mask">' +
        row('Mon, 10/05', 0) +
        row('', 1) +
        row('Tue, 10/06', 2) +
        row('Sat, 10/10', 3) +
        '</div><button id="save" onclick="throw Error(\'Save must not run\')">Save</button>',
    );
    const payload = {
      am: [
        '08',
        '00',
        'AM',
        '12',
        '00',
        'PM',
        '12',
        '00',
        'PM',
        '01',
        '00',
        'PM',
      ],
      pm: [
        '01',
        '00',
        'PM',
        '05',
        '00',
        'PM',
        null,
        null,
        'AM',
        null,
        null,
        'AM',
      ],
      skip: ['10/06'],
      addLines: false,
    };
    const result = await page.evaluate(context.fillWorkingHours, payload);
    assert.equal(result.days, 1);
    assert.equal(result.unmatched, 0);
    assert.equal(result.missing.length, 0);
    assert.deepEqual(
      await page
        .locator('.ag-row')
        .nth(0)
        .locator('select')
        .evaluateAll((xs) => xs.map((x) => x.value)),
      payload.am,
    );
    for (const index of [2, 3])
      assert(
        (
          await page
            .locator('.ag-row')
            .nth(index)
            .locator('select')
            .evaluateAll((xs) => xs.map((x) => x.value))
        ).every((v) => v === ''),
      );
    await page.setContent(
      '<div class="popup-mask">' +
        row('Mon, 10/05', 0).replace(
          '</div>',
          '<div class="ag-cell"><button onclick="window.wrongClick=true">Delete</button></div></div>',
        ) +
        '</div>',
    );
    const missing = await page.evaluate(context.fillWorkingHours, {
      ...payload,
      addLines: true,
    });
    assert.equal(missing.missing.length, 1);
    assert.equal(await page.evaluate(() => window.wrongClick), undefined);
    await page.setContent('<p>No modal</p>');
    assert.match(
      (await page.evaluate(context.fillWorkingHours, payload)).error,
      /Open the Working Hours/,
    );
    console.log(
      'PASS MyTE validation, time conversion, weekday fill, skip/weekend preservation, missing-line guard, and modal guard (synthetic DOM).',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
