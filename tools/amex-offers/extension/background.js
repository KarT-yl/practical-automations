chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  let supported = false;
  let amex = false;
  try {
    const url = new URL(tab.url);
    amex =
      url.protocol === 'https:' &&
      url.hostname === 'global.americanexpress.com';
    supported = amex && /^\/(?:offers|card-offers)(?:\/|$)/.test(url.pathname);
  } catch {}
  if (!supported) {
    await chrome.action.setBadgeText({ tabId: tab.id, text: 'PAGE' });
    await chrome.action.setBadgeBackgroundColor({
      tabId: tab.id,
      color: '#a34900',
    });
    await chrome.action.setTitle({
      tabId: tab.id,
      title:
        'Open your signed-in Amex Offers page (View All), then click again.',
    });
    if (amex) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            document.getElementById('amex-one-click-page-help')?.remove();
            const panel = document.createElement('div');
            panel.id = 'amex-one-click-page-help';
            panel.style.cssText =
              'position:fixed;bottom:20px;right:20px;z-index:2147483647;max-width:320px;padding:20px;background:#121c32;color:white;border:1px solid #607393;border-radius:12px;font:15px/1.5 system-ui;box-shadow:0 8px 35px #0006';
            const message = document.createElement('p');
            message.textContent =
              'Open the full Amex Offers page, then click the extension again to add your offers.';
            const link = document.createElement('a');
            link.textContent = 'Open all offers';
            link.href = 'https://global.americanexpress.com/offers/eligible';
            link.style.cssText =
              'display:inline-block;background:#e6ecff;color:#121c32;border-radius:8px;padding:8px 12px';
            const close = document.createElement('button');
            close.textContent = 'Close';
            close.style.cssText = 'margin-left:12px;padding:8px;cursor:pointer';
            close.addEventListener('click', () => panel.remove());
            panel.append(message, link, close);
            document.documentElement.append(panel);
          },
        });
      } catch {}
    }
    return;
  }
  try {
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
    await chrome.action.setTitle({
      tabId: tab.id,
      title: 'Add available Amex offers',
    });
    const addedView =
      /^\/(?:offers|card-offers)\/(?:enrolled|added)(?:\/|$)/.test(
        new URL(tab.url).pathname,
      );
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [
        'bridge.js',
        'offer-data.js',
        addedView ? 'scan-report.js' : 'offers.js',
      ],
    });
  } catch {
    await chrome.action.setBadgeText({ tabId: tab.id, text: 'ERR' });
    await chrome.action.setTitle({
      tabId: tab.id,
      title: 'Could not start. Refresh the Amex Offers page and click again.',
    });
  }
});

const supportedSender = (sender) => {
  try {
    const url = new URL(sender.url);
    return (
      sender.id === chrome.runtime.id &&
      url.protocol === 'https:' &&
      url.hostname === 'global.americanexpress.com' &&
      /^\/(?:offers|card-offers)(?:\/|$)/.test(url.pathname)
    );
  } catch {
    return false;
  }
};
const saveReport = async (report) => {
  const statuses = new Set(['added', 'confirmed', 'unverified', 'pending']);
  if (!report || !Array.isArray(report.offers) || !report.offers.length)
    throw new Error(
      'No offer details were captured. Open the full Added to Card list and try again.',
    );
  const offers = report.offers
    .slice(0, 1000)
    .map((item) => ({
      merchant: String(item.merchant || '').slice(0, 300),
      description: String(item.description || '').slice(0, 4000),
      expirationText: String(item.expirationText || '').slice(0, 150),
      rawText: String(item.rawText || '').slice(0, 4000),
      status: statuses.has(item.status) ? item.status : 'unverified',
    }))
    .filter((item) => item.merchant && item.description);
  if (!offers.length) throw new Error('No complete offer rows were found.');
  const saved = {
    schema: 1,
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    source: String(report.source || 'Offer scan').slice(0, 100),
    coverage: {
      found: offers.length,
      expected: Number.isInteger(report.coverage?.expected)
        ? report.coverage.expected
        : null,
      complete: report.coverage?.complete === true,
    },
    offers,
  };
  const data = await chrome.storage.local.get('reports');
  await chrome.storage.local.set({
    reports: [saved, ...(data.reports || [])].slice(0, 10),
  });
  await chrome.tabs.create({
    url: chrome.runtime.getURL('report.html') + '?id=' + saved.id,
  });
  return { ok: true, id: saved.id };
};
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!supportedSender(sender)) return;
  if (message.type === 'PING_REPORTS') {
    respond({
      ok: true,
      reporting: true,
      version: chrome.runtime.getManifest().version,
    });
    return;
  }
  if (message.type === 'SAVE_REPORT') {
    saveReport(message.report)
      .then(respond)
      .catch((error) => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'OPEN_ADDED_REPORT' && sender.tab?.id) {
    (async () => {
      // Keep the current card's routing context inside the Amex tab only.
      const current = new URL(sender.url);
      const url = new URL('/offers/enrolled', current);
      url.search = current.search;
      await chrome.storage.session.set({
        ['pendingReport_' + sender.tab.id]: Date.now(),
      });
      await chrome.tabs.update(sender.tab.id, { url: url.href });
      respond({ ok: true });
    })().catch((error) => respond({ ok: false, error: error.message }));
    return true;
  }
});
chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (change.status !== 'complete') return;
  const key = 'pendingReport_' + tabId;
  const pending = (await chrome.storage.session.get(key))[key];
  if (!pending) return;
  await chrome.storage.session.remove(key);
  if (Date.now() - pending > 120000) return;
  try {
    const url = new URL(tab.url);
    if (
      url.hostname !== 'global.americanexpress.com' ||
      !/^\/offers\/enrolled(?:\/|$)/.test(url.pathname)
    )
      return;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['bridge.js', 'offer-data.js', 'scan-report.js'],
    });
  } catch {}
});
