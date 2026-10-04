(() => {
  'use strict';
  if (
    location.protocol !== 'https:' ||
    location.hostname !== 'global.americanexpress.com' ||
    !/^\/(?:offers|card-offers)(?:\/|$)/.test(location.pathname)
  )
    return;
  const key = '__amexOffersOneClickV1';
  if (globalThis[key]?.running) {
    globalThis[key].host.scrollIntoView({ block: 'nearest' });
    return;
  }
  globalThis[key]?.host.remove();
  const state = {
    running: true,
    stopped: false,
    clicks: 0,
    confirmed: 0,
    removed: 0,
  };
  const captured = new Map();
  if (globalThis.AmexOfferData)
    for (const offer of AmexOfferData.scan(false))
      captured.set(AmexOfferData.identity(offer), offer);
  globalThis[key] = state;
  const startURL = location.href;
  const host = document.createElement('div');
  state.host = host;
  host.style.cssText =
    'position:fixed;right:20px;bottom:20px;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>
    :host{all:initial} section{font:14px/1.5 system-ui,sans-serif;width:310px;max-width:calc(100vw - 60px);padding:20px;color:#eef3ff;background:#121c32;border:1px solid #607393;border-radius:16px;box-shadow:0 8px 35px #0006}
    h2{font-size:17px;margin:0 0 8px} p{margin:8px 0;overflow-wrap:anywhere} small{color:#c1cce0} button{font:inherit;border:0;border-radius:8px;background:#e6ecff;color:#121c32;padding:8px 16px;cursor:pointer;margin-top:8px} button:focus-visible{outline:3px solid #62c9ff;outline-offset:3px}
  </style><section aria-label="Amex offer automation"><h2>Amex Offers · One Click</h2><p id="status" role="status" aria-live="polite">Looking for available offers…</p><p id="counts"></p><small>Selected card only. Keep this page open.</small><br><button id="stop" type="button">Stop</button> <button id="report" type="button" disabled>Report this run</button><br><button id="saved" type="button" disabled>Analyze all saved offers</button></section>`;
  document.documentElement.append(host);
  const status = root.getElementById('status');
  const counts = root.getElementById('counts');
  const stop = root.getElementById('stop');
  const reportButton = root.getElementById('report');
  const savedButton = root.getElementById('saved');
  const request = (message) => {
    if (!globalThis.AmexBridge)
      throw new Error(
        'Reload Amex Offers in opera://extensions and refresh this Amex tab to load the reporting update.',
      );
    return AmexBridge.request(message);
  };
  reportButton.addEventListener('click', async () => {
    reportButton.disabled = true;
    update('Saving this run and opening its report…');
    try {
      const result = await request({
        type: 'SAVE_REPORT',
        report: AmexOfferData.makeReport(
          [...captured.values()],
          'This enrollment run',
          { found: captured.size, expected: null, complete: false },
        ),
      });
      if (!result?.ok)
        throw new Error(result?.error || 'Could not open the report.');
      update('Your run report opened in a new tab.');
    } catch (error) {
      update(error.message);
    } finally {
      reportButton.disabled = false;
    }
  });
  savedButton.addEventListener('click', async () => {
    savedButton.disabled = true;
    update('Opening Added to Card to read your saved offers…');
    try {
      const result = await request({ type: 'OPEN_ADDED_REPORT' });
      if (!result?.ok)
        throw new Error(result?.error || 'Could not open saved offers.');
    } catch (error) {
      update(error.message);
      savedButton.disabled = false;
    }
  });
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalize = (text) =>
    (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const visible = (el) =>
    el.isConnected &&
    el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== 'hidden' &&
    getComputedStyle(el).display !== 'none';
  const isAdd = (el) => {
    if (
      !visible(el) ||
      el.disabled ||
      el.getAttribute('aria-disabled') === 'true'
    )
      return false;
    const labels = [
      el.textContent,
      el.getAttribute('title'),
      el.getAttribute('aria-label'),
    ].map(normalize);
    // The live list view uses title="add to list card" on its plus button.
    // Match the enrollment label, never an arbitrary plus icon.
    return labels.some((label) =>
      /^(add to (?:list )?card|add offer|activate offer)$/.test(label),
    );
  };
  const buttons = () =>
    [
      ...document.querySelectorAll(
        'button, a.offer-cta, [role="button"].offer-cta',
      ),
    ].filter(isAdd);
  const errors = () =>
    [...document.querySelectorAll('[role="alert"], [data-testid*="error" i]')]
      .filter(visible)
      .map((el) => normalize(el.textContent))
      .filter((text) =>
        /\b(error|unable|failed|failure|try again|something went wrong|cannot|could not|couldn't|not eligible|limit reached)\b/.test(
          text,
        ),
      );
  const cardFor = (button) => {
    let el = button.parentElement;
    for (let depth = 0; el && depth < 7; depth++, el = el.parentElement) {
      if (
        el.querySelector(
          'h2,h3,h4,[data-testid="merchantOfferImage"], [data-testid="merchantOfferExpiration"]',
        )
      )
        return el;
    }
    return button.parentElement;
  };
  const update = (message) => {
    if (message) status.textContent = message;
    counts.textContent = `${state.clicks} clicked · ${state.confirmed} marked added · ${state.removed} button updates to verify`;
  };
  const cancel = () => {
    state.stopped = true;
    update('Stopping after the current click.');
  };
  stop.addEventListener('click', cancel);
  // A manual page interaction could select another card or change the offer list.
  const manual = (event) => {
    if (event.isTrusted && !event.composedPath().includes(host)) cancel();
  };
  document.addEventListener('click', manual, true);
  document.addEventListener('change', manual, true);
  document.addEventListener('keydown', manual, true);
  const checked = new WeakSet();
  const fingerprints = new Set();
  const initialErrors = new Set(errors());
  const guard = () => {
    if (state.stopped)
      throw new Error('Stopped. You can click the extension to continue.');
    if (location.href !== startURL)
      throw new Error(
        'The page changed. Open the offers for your selected card and start again.',
      );
    if (
      document.querySelector('[role="dialog"][aria-modal="true"]') &&
      [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some(
        visible,
      )
    ) {
      throw new Error(
        'Amex opened a dialog. Complete it yourself, then click the extension again.',
      );
    }
    if (errors().some((text) => !initialErrors.has(text)))
      throw new Error('Amex displayed a message. Check it before continuing.');
  };
  const run = async () => {
    if (globalThis.chrome?.runtime) {
      const readiness = await request({ type: 'PING_REPORTS' });
      if (!readiness?.reporting)
        throw new Error(
          'Reload the extension and refresh this Amex tab to activate reporting.',
        );
    }
    let emptyRounds = 0;
    while (state.clicks < 500) {
      guard();
      const button = buttons().find((el) => !checked.has(el));
      if (!button) {
        if (++emptyRounds >= (state.clicks ? 3 : 10)) {
          state.completed = true;
          update(
            state.clicks
              ? 'Finished with the offers loaded on this page. Check Added to Card to verify.'
              : 'No add buttons found. Choose Available offers and View All, then click again.',
          );
          return;
        }
        // Trigger lazy loading without clicking unrelated controls or changing cards.
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'instant',
        });
        await sleep(1200);
        continue;
      }
      emptyRounds = 0;
      const card = cardFor(button);
      const title = card?.querySelector('h2,h3,h4')?.textContent?.trim();
      const fingerprint = title
        ? normalize(
            title +
              ' ' +
              card.textContent.replace(
                /add to (?:list )?card|add offer|activate offer/gi,
                '',
              ),
          )
        : null;
      if (fingerprint && fingerprints.has(fingerprint)) {
        throw new Error(
          'An offer reappeared after a click. Check the page before restarting.',
        );
      }
      checked.add(button);
      if (fingerprint) fingerprints.add(fingerprint);
      button.scrollIntoView({ block: 'center', behavior: 'instant' });
      await sleep(250);
      guard();
      if (!isAdd(button)) continue;
      const priorCardText = normalize(card?.textContent);
      const snapshot = globalThis.AmexOfferData?.extract(card, 'pending');
      if (snapshot) captured.set(AmexOfferData.identity(snapshot), snapshot);
      update(title ? `Adding ${title}…` : 'Adding the next offer…');
      button.click();
      state.clicks++;
      update();
      let outcome = null;
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        await sleep(250);
        guard();
        const cardText = normalize(card?.textContent);
        const buttonLabel = normalize(
          [
            button.textContent,
            button.title,
            button.getAttribute('aria-label'),
          ].join(' '),
        );
        if (
          (button.isConnected &&
            /added to (?:list )?card|offer added|enrolled/.test(buttonLabel)) ||
          (card?.isConnected &&
            cardText !== priorCardText &&
            /added to (?:list )?card|offer added|successfully enrolled/.test(
              cardText,
            ))
        ) {
          outcome = 'confirmed';
          break;
        }
        // Removal is a page response, not proof of server-side enrollment.
        if (!button.isConnected) {
          await sleep(1000);
          guard();
          if (!button.isConnected) {
            outcome = 'removed';
            break;
          }
        }
      }
      if (!outcome)
        throw new Error(
          'Amex did not confirm this click within 12 seconds. Check the offer before restarting.',
        );
      state[outcome]++;
      if (snapshot)
        snapshot.status = outcome === 'confirmed' ? 'confirmed' : 'unverified';
      update();
      await sleep(1300);
    }
    update(
      'Stopped at 500 clicks. Check your added offers before another run.',
    );
  };
  run()
    .catch((error) => update(error.message))
    .finally(async () => {
      state.running = false;
      document.removeEventListener('click', manual, true);
      document.removeEventListener('change', manual, true);
      document.removeEventListener('keydown', manual, true);
      stop.removeEventListener('click', cancel);
      stop.textContent = 'Close';
      if (globalThis.AmexOfferData)
        for (const offer of AmexOfferData.scan(false))
          captured.set(AmexOfferData.identity(offer), offer);
      reportButton.disabled = captured.size === 0;
      savedButton.disabled = false;
      stop.addEventListener('click', () => host.remove(), { once: true });
      if (state.completed && globalThis.AmexOfferData) {
        update('Offers finished. Opening Added to Card to build your report…');
        try {
          const result = await request({ type: 'OPEN_ADDED_REPORT' });
          if (!result?.ok)
            throw new Error(
              result?.error ||
                'Use Analyze all saved offers to build the report.',
            );
        } catch (error) {
          update(error.message);
        }
      }
    });
})();
