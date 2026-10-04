const assert = require('node:assert/strict');
const {
  analyze,
  parseDate,
  sort,
} = require('../tools/amex-offers/extension/analysis.js');
const parse = (description) =>
  analyze(
    [
      {
        merchant: 'Merchant',
        description,
        expirationText: 'Expires 10/6/26',
        status: 'added',
      },
    ],
    '2026-10-03',
    '2026-10-04T00:00:00Z',
  )[0];
let row = parse(
  'Spend $100 or more, earn $20 back, up to 2 times (total of $40).',
);
assert.equal(row.threshold, 100);
assert.equal(row.cashReward, 20);
assert.equal(row.cashRate, 0.2);
assert.equal(row.cashCap, 40);
assert.equal(row.spendToCap, 200);
assert.equal(row.days, 3);
assert(row.cashComparable);
row = parse('Earn 4% back on purchases, up to a total of $250');
assert.equal(row.cashRate, 0.04);
assert.equal(row.cashCap, 250);
assert.equal(row.spendToCap, 6250);
assert.equal(row.threshold, null);
row = parse('Earn 15% back on a single purchase, up to a total of $50');
assert.equal(row.spendToCap, 333.34);
assert(row.notes.some((text) => text.includes('Single')));
row = parse(
  'Spend $3,000+, earn 3,000 Membership Rewards® points, up to 3 times',
);
assert.equal(row.points, 3000);
assert.equal(row.pointsCap, 9000);
assert.equal(row.pointsEfficiency, 1);
assert.equal(row.spendToCap, 9000);
assert.equal(row.cashReward, null);
row = parse(
  'Earn +5 Membership Rewards® points per eligible dollar spent, up to 5,000 points',
);
assert.equal(row.pointsPerDollar, 5);
assert.equal(row.pointsCap, 5000);
assert.equal(row.spendToCap, 1000);
assert.equal(row.points, null);
row = parse('Spend $500, earn $100 back or spend $1,000, earn $250 back');
assert(row.complex);
assert(!row.cashComparable);
row = parse('Get a special benefit');
assert.equal(row.kind, 'other');
assert.equal(row.cashRate, null);
assert(row.notes.length);
row = parse('Spend $50, earn $10 back');
assert.equal(row.cashCap, null);
assert.equal(row.spendToCap, null);
row = parse('Earn 20,000 bonus points when you add an Additional Card');
assert(row.complex);
assert(!row.pointsComparable);
row = parse('Earn $10 back monthly');
assert(row.complex);
assert(!row.cashComparable);
assert.equal(parseDate('Expires 2/30/26'), null);
assert.equal(parseDate('Expires October 6, 2026'), '2026-10-06');
assert.equal(
  parseDate('Expires in 3 days', '2026-10-04T00:00:00Z'),
  '2026-10-06',
);
row = analyze(
  [
    {
      merchant: 'Expired',
      description: 'Spend $50, earn $10 back',
      expirationText: 'Expires 10/2/26',
      status: 'unverified',
    },
  ],
  '2026-10-03',
)[0];
assert(row.expired);
assert(!row.cashComparable);
assert(!row.enrolled);
const rows = analyze(
  [
    {
      merchant: 'A',
      description: 'Spend $50, earn $10 back',
      expirationText: 'Expires 10/3/26',
      status: 'added',
    },
    {
      merchant: 'B',
      description: 'Spend $50, earn $20 back',
      expirationText: 'Expires 10/6/26',
      status: 'added',
    },
  ],
  '2026-10-03',
);
assert.equal(sort(rows, 'cash')[0].merchant, 'B');
assert.equal(sort(rows, 'soon')[0].merchant, 'A');
assert.equal(sort(rows, 'cash', [0])[0].merchant, 'A');
assert.equal(rows[0].days, 0);
assert(!rows[0].expired);
console.log(
  'PASS cash/points parsing, repeats, caps, ambiguous conditions, date boundaries, enrollment exclusion and ranking',
);
