(async () => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const stored = await chrome.storage.local.get([
    'reports',
    'reportPreferences',
  ]);
  const report = id
    ? (stored.reports || []).find((item) => item.id === id)
    : (stored.reports || [])[0];
  if (!report) {
    $('metadata').textContent =
      'No saved report yet. Open Added to Card on Amex and click the extension to create one.';
    return;
  }
  const prefs = stored.reportPreferences?.[report.id] || {};
  const planned = new Set(prefs.planned || []);
  $('asof').value = AmexAnalysis.chicagoDate();
  const money = (value) =>
    value === null
      ? '—'
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2,
        }).format(value);
  const number = (value) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
  const percent = (value) => (value === null ? '—' : number(value * 100) + '%');
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const daysText = (row) =>
    row.days === null
      ? 'Date unclear'
      : row.days < 0
        ? 'Expired'
        : row.days === 0
          ? 'Expires today'
          : row.days === 1
            ? '1 day left'
            : `${row.days} days left`;
  const rewardText = (row) =>
    row.kind === 'cash'
      ? row.cashReward !== null
        ? money(row.cashReward) + ' back'
        : percent(row.cashRate) + ' back'
      : row.kind === 'points'
        ? row.pointsPerDollar !== null
          ? '+' + number(row.pointsPerDollar) + ' points / $'
          : row.points !== null
            ? number(row.points) + ' points'
            : 'See description'
        : 'See description';
  const valueText = (row) =>
    row.complex
      ? 'Review terms'
      : row.kind === 'cash'
        ? percent(row.cashRate)
        : row.kind === 'points' && row.pointsEfficiency !== null
          ? number(row.pointsEfficiency) + ' points / $'
          : 'Not calculated';
  let rows = [];
  const persist = async () => {
    const value = await chrome.storage.local.get('reportPreferences');
    const preferences = value.reportPreferences || {};
    preferences[report.id] = { planned: [...planned] };
    await chrome.storage.local.set({ reportPreferences: preferences });
  };
  const pickList = (target, items, mode) => {
    const box = $(target);
    box.replaceChildren();
    if (!items.length) {
      box.append(node('p', 'No qualifying offers in this snapshot.', 'empty'));
      return;
    }
    for (const row of items.slice(0, 5)) {
      const el = node('div', undefined, 'pick');
      el.append(node('strong', row.merchant), node('span', row.description));
      const why =
        mode === 'soon'
          ? daysText(row)
          : mode === 'cash'
            ? `${percent(row.cashRate)} return${row.threshold !== null ? ' at ' + money(row.threshold) + ' qualifying spend' : ''}`
            : `${number(row.pointsEfficiency)} bonus points per dollar`;
      el.append(
        node(
          'span',
          (planned.has(row.index) ? 'Planned purchase · ' : '') + why,
          'why',
        ),
      );
      box.append(el);
    }
  };
  const render = () => {
    if (!$('asof').value) return;
    rows = AmexAnalysis.analyze(
      report.offers,
      $('asof').value,
      report.generatedAt,
    );
    const enrolled = rows.filter((row) => row.enrolled && !row.expired);
    $('metadata').textContent =
      `${report.source} · captured ${new Date(report.generatedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} Central · analysis date ${$('asof').value}`;
    const unverified = rows.filter((row) => !row.enrolled).length;
    const coverage = report.coverage || {};
    $('coverage').textContent =
      `${report.offers.length} offers captured${coverage.expected ? ' / ' + coverage.expected + ' shown by Amex' : ''}. ${coverage.complete === true ? 'The count matches the saved-offers list.' : 'Coverage is limited to rows loaded during the scan; filters, pagination, or Show More can leave offers out.'}${unverified ? ' ' + unverified + ' enrollment(s) need verification and are excluded from recommendations.' : ''} Each report covers the selected card at scan time.`;
    const stats = [
      ['Saved offers', rows.filter((row) => row.enrolled).length],
      [
        'Expire within 7 days',
        enrolled.filter((row) => row.days !== null && row.days <= 7).length,
      ],
      ['Cash offers', enrolled.filter((row) => row.kind === 'cash').length],
      ['Points offers', enrolled.filter((row) => row.kind === 'points').length],
    ];
    $('stats').replaceChildren(
      ...stats.map(([label, value]) => {
        const el = node('div', undefined, 'stat');
        el.append(node('strong', String(value)), node('span', label));
        return el;
      }),
    );
    const preferred = [...planned];
    pickList(
      'soon',
      AmexAnalysis.sort(
        enrolled.filter((row) => row.days !== null && row.days <= 30),
        'soon',
        preferred,
      ),
      'soon',
    );
    pickList(
      'cashbest',
      AmexAnalysis.sort(
        enrolled.filter((row) => row.cashComparable),
        'cash',
        preferred,
      ),
      'cash',
    );
    pickList(
      'pointsbest',
      AmexAnalysis.sort(
        enrolled.filter(
          (row) =>
            row.pointsComparable && /membership rewards/i.test(row.description),
        ),
        'points',
        preferred,
      ),
      'points',
    );
    const query = $('search').value.toLowerCase(),
      kind = $('kind').value;
    const budget = $('budget').value === '' ? null : Number($('budget').value);
    let filtered = rows.filter(
      (row) =>
        (!row.expired || $('expired').checked) &&
        (kind === 'all' ||
          (kind === 'other'
            ? row.kind === 'other' || row.complex
            : row.kind === kind)) &&
        (!query ||
          [row.merchant, row.description]
            .join(' ')
            .toLowerCase()
            .includes(query)) &&
        (!$('plannedonly').checked || planned.has(row.index)) &&
        (budget === null ||
          (row.threshold !== null
            ? row.threshold <= budget
            : (row.cashRate !== null && row.cashReward === null) ||
              row.pointsPerDollar !== null)),
    );
    // A points-dollar ratio only compares points of the same program.
    if ($('sort').value === 'points')
      filtered = filtered.sort(
        (a, b) =>
          Number(/membership rewards/i.test(b.description)) -
          Number(/membership rewards/i.test(a.description)),
      );
    filtered = AmexAnalysis.sort(filtered, $('sort').value, preferred);
    $('visiblecount').textContent =
      `${filtered.length} of ${rows.length} offers`;
    $('offers').replaceChildren();
    for (const row of filtered) {
      const tr = node('tr');
      const plan = node('input');
      plan.type = 'checkbox';
      plan.checked = planned.has(row.index);
      plan.setAttribute('aria-label', 'Planned purchase at ' + row.merchant);
      plan.addEventListener('change', () => {
        if (plan.checked) planned.add(row.index);
        else planned.delete(row.index);
        persist().catch((error) => {
          $('error').textContent = error.message;
        });
        render();
      });
      const planCell = node('td');
      planCell.append(plan);
      tr.append(planCell);
      const merchant = node('td');
      merchant.append(
        node('strong', row.merchant),
        node('span', row.description, 'sub'),
      );
      if (!row.enrolled)
        merchant.append(node('span', 'Verify enrollment', 'badge urgent'));
      if (row.complex)
        merchant.append(node('span', 'Review conditions', 'badge urgent'));
      tr.append(merchant);
      const date = node('td', row.expiry || 'Unknown');
      date.append(
        node(
          'span',
          daysText(row),
          row.days !== null && row.days <= 7
            ? 'badge ' + (row.expired ? 'expired' : 'urgent')
            : 'sub',
        ),
      );
      tr.append(date);
      const spend = node(
        'td',
        row.threshold !== null
          ? money(row.threshold)
          : row.cashReward === null &&
              (row.cashRate !== null || row.pointsPerDollar !== null)
            ? 'No minimum shown'
            : 'Not stated',
      );
      if (row.spendToCap !== null)
        spend.append(
          node(
            'span',
            money(row.spendToCap) + ' to advertised cap / full repeats',
            'sub',
          ),
        );
      tr.append(spend);
      const reward = node('td', rewardText(row));
      if (row.cashCap !== null)
        reward.append(
          node('span', 'Potential cap: ' + money(row.cashCap), 'sub'),
        );
      if (row.pointsCap !== null)
        reward.append(
          node(
            'span',
            'Potential cap: ' + number(row.pointsCap) + ' points',
            'sub',
          ),
        );
      if (row.repetitions > 1)
        reward.append(
          node('span', 'Up to ' + row.repetitions + ' uses', 'sub'),
        );
      tr.append(reward);
      tr.append(node('td', valueText(row)));
      const notes = node('td');
      notes.append(
        node('span', row.notes.join(' ') || 'Full Amex terms apply.', 'sub'),
      );
      const details = node('details');
      details.append(
        node('summary', 'Original page text'),
        node('p', row.rawText),
      );
      notes.append(details);
      tr.append(notes);
      $('offers').append(tr);
    }
    if (!filtered.length) {
      const tr = node('tr');
      const cell = node('td', 'No offers match these filters.', 'empty');
      cell.colSpan = 7;
      tr.append(cell);
      $('offers').append(tr);
    }
  };
  for (const id of [
    'asof',
    'search',
    'kind',
    'sort',
    'budget',
    'plannedonly',
    'expired',
  ])
    $(id).addEventListener('input', render);
  const download = (text, type, name) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = node('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const csvValue = (value) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const exportRows = () => AmexAnalysis.sort(rows, 'soon', [...planned]);
  $('csv').addEventListener('click', () => {
    const header = [
      'Merchant',
      'Description',
      'Status',
      'Expiry',
      'Days left',
      'Required spend USD',
      'Reward type',
      'Cash reward USD',
      'Cash return percent',
      'Cash cap USD',
      'Points reward',
      'Bonus points per dollar',
      'Points cap',
      'Uses shown',
      'Spend to cap or full repeats USD',
      'Planned purchase',
      'Review notes',
    ];
    const data = exportRows().map((r) => [
      r.merchant,
      r.description,
      r.status,
      r.expiry,
      r.days,
      r.threshold,
      r.kind,
      r.cashReward,
      r.cashRate === null ? null : r.cashRate * 100,
      r.cashCap,
      r.points,
      r.pointsPerDollar,
      r.pointsCap,
      r.repetitions,
      r.spendToCap,
      planned.has(r.index) ? 'Yes' : 'No',
      r.notes.join(' '),
    ]);
    download(
      '\ufeff' +
        [header, ...data]
          .map((row) => row.map(csvValue).join(','))
          .join('\r\n'),
      'text/csv;charset=utf-8',
      `amex-offers-${$('asof').value}.csv`,
    );
  });
  $('html').addEventListener('click', () => {
    const doc = document.implementation.createHTMLDocument('Amex offer report');
    const style = doc.createElement('style');
    style.textContent =
      'body{font:15px/1.5 system-ui;margin:32px;color:#142033}table{border-collapse:collapse;width:100%}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{background:#f2f5fa}p{color:#5d697c}small{display:block}';
    doc.head.append(style);
    doc.body.append(
      node('h1', 'Your Amex offer report'),
      node('p', $('metadata').textContent),
      node('p', $('coverage').textContent),
      node(
        'p',
        'Use planned purchases first. Cash and points stay separate. Caps assume no prior redemptions. Read full Amex terms before spending.',
      ),
    );
    const table = node('table'),
      thead = node('thead'),
      head = node('tr');
    for (const text of [
      'Merchant / offer',
      'Use by',
      'Spend',
      'Reward',
      'Value',
      'Notes',
    ])
      head.append(node('th', text));
    thead.append(head);
    table.append(thead);
    const body = node('tbody');
    for (const r of exportRows()) {
      const tr = node('tr');
      for (const text of [
        r.merchant +
          ' — ' +
          r.description +
          (planned.has(r.index) ? ' (planned)' : ''),
        [r.expiry, daysText(r)].filter(Boolean).join(' · '),
        r.threshold !== null ? money(r.threshold) : 'See terms',
        rewardText(r) +
          (r.cashCap !== null ? ' · cap ' + money(r.cashCap) : '') +
          (r.pointsCap !== null
            ? ' · cap ' + number(r.pointsCap) + ' points'
            : ''),
        valueText(r),
        r.notes.join(' ') + ' · ' + r.status,
      ])
        tr.append(node('td', text));
      body.append(tr);
    }
    table.append(body);
    doc.body.append(table);
    download(
      '<!doctype html>\n' + doc.documentElement.outerHTML,
      'text/html;charset=utf-8',
      `amex-offer-report-${$('asof').value}.html`,
    );
  });
  $('print').addEventListener('click', () => window.print());
  $('clear').addEventListener('click', async () => {
    if (
      !confirm(
        'Clear all reports and planned-purchase selections stored by this extension? Export any report you want to keep first.',
      )
    )
      return;
    await chrome.storage.local.remove(['reports', 'reportPreferences']);
    location.reload();
  });
  render();
})().catch((error) => {
  document.getElementById('error').textContent =
    'Could not load the report: ' + error.message;
});
