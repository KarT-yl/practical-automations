(() => {
  'use strict';
  if (
    location.protocol !== 'https:' ||
    location.hostname !== 'global.americanexpress.com' ||
    !/^\/(?:offers\/(?:enrolled|added)|card-offers\/(?:enrolled|added))(?:\/|$)/.test(
      location.pathname,
    )
  )
    return;
  if (globalThis.__amexReportScanning) return;
  globalThis.__amexReportScanning = true;
  const start = location.href;
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;right:20px;bottom:20px;z-index:2147483647;padding:20px;border-radius:12px;background:#121c32;color:white;font:15px/1.5 system-ui;max-width:320px';
  const text = document.createElement('p');
  text.textContent = 'Reading saved offers and expiration dates…';
  const stop = document.createElement('button');
  stop.textContent = 'Stop scan';
  host.append(text, stop);
  document.documentElement.append(host);
  let cancelled = false;
  stop.addEventListener('click', () => {
    cancelled = true;
  });
  const manual = (event) => {
    if (event.isTrusted && !event.composedPath().includes(host))
      cancelled = true;
  };
  document.addEventListener('click', manual, true);
  document.addEventListener('change', manual, true);
  const run = async () => {
    if (!globalThis.AmexBridge)
      throw new Error(
        'Reload the extension in opera://extensions and refresh this Amex tab to load reporting.',
      );
    const readiness = await AmexBridge.request({ type: 'PING_REPORTS' });
    if (!readiness?.reporting)
      throw new Error(
        'Reload the extension and refresh this Amex tab to activate reporting.',
      );
    const offers = new Map();
    let stable = 0,
      height = 0;
    for (let round = 0; round < 60; round++) {
      if (cancelled || location.href !== start)
        throw new Error(
          'Scan stopped. Stay on Added to Card and click the extension to scan again.',
        );
      const prior = offers.size;
      for (const offer of AmexOfferData.scan(true))
        offers.set(AmexOfferData.identity(offer), offer);
      text.textContent = `Reading saved offers… ${offers.size} found`;
      const nextHeight = document.documentElement.scrollHeight;
      stable = offers.size === prior && nextHeight === height ? stable + 1 : 0;
      height = nextHeight;
      const more = [...document.querySelectorAll('button')].find(
        (button) =>
          button.getClientRects().length &&
          !button.disabled &&
          /^(?:show|load|view) more(?: offers)?$/i.test(
            button.textContent.trim(),
          ),
      );
      if (more) {
        more.click();
        stable = 0;
      }
      if (stable >= 3 && offers.size && !more) break;
      window.scrollTo({ top: height, behavior: 'instant' });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (round === 14 && !offers.size)
        throw new Error(
          'No saved offer rows found. Choose the full Added to Card list, then try again.',
        );
    }
    const pageText = document.body.innerText;
    const expected =
      Number(pageText.match(/Added to Card\s*\((\d+)\)/i)?.[1]) || null;
    const coverage = {
      found: offers.size,
      expected,
      complete: expected !== null ? offers.size >= expected : null,
    };
    const report = AmexOfferData.makeReport(
      [...offers.values()],
      'Added to Card list',
      coverage,
    );
    text.textContent = `Saving ${offers.size} offers and opening your report…`;
    const result = await AmexBridge.request({ type: 'SAVE_REPORT', report });
    if (!result?.ok)
      throw new Error(
        result?.error ||
          'Could not save the report. Reload the extension and try again.',
      );
    text.textContent = `Report opened with ${offers.size} saved offers.`;
  };
  run()
    .catch((error) => {
      text.textContent = error.message;
    })
    .finally(() => {
      globalThis.__amexReportScanning = false;
      document.removeEventListener('click', manual, true);
      document.removeEventListener('change', manual, true);
      stop.textContent = 'Close';
      stop.addEventListener('click', () => host.remove(), { once: true });
    });
})();
