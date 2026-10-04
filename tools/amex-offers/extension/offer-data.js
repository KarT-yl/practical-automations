(() => {
  'use strict';
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const norm = (value) => clean(value).toLowerCase();
  const findCard = (element) => {
    for (
      let el = element.parentElement, depth = 0;
      el && depth < 12;
      el = el.parentElement, depth++
    ) {
      if (
        el.querySelector('h3,h4') &&
        /expires|expiration/i.test(el.textContent)
      )
        return el;
    }
    return null;
  };
  const isAdded = (card) =>
    [...card.querySelectorAll('button,[role="button"],[data-testid]')].some(
      (el) =>
        /added to (?:list )?card|offer added|enrolled/.test(
          norm(
            [el.title, el.getAttribute('aria-label'), el.textContent].join(' '),
          ),
        ) ||
        /^merchantOffer.*(?:Added|Enrolled)/i.test(
          el.getAttribute('data-testid') || '',
        ),
    );
  const extract = (card, status = 'added') => {
    const heading = card.querySelector('h3,h4');
    if (!heading) return null;
    const merchant = clean(heading.textContent).slice(0, 300);
    const rawText = clean(card.innerText || card.textContent).slice(0, 4000);
    const exp = card.querySelector('[data-testid="merchantOfferExpiration"]');
    const expirationText = clean(
      exp?.textContent ||
        rawText.match(
          /(?:expires?|expiration)\s*:?\s*(?:\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|in\s+\d+\s+days?)/i,
        )?.[0],
    );
    const description = clean(
      rawText
        .replace(merchant, '')
        .replace(expirationText, '')
        .replace(
          /terms apply|view details|add to (?:list )?card|added to (?:list )?card|^new\b/gi,
          '',
        ),
    );
    if (!merchant || !description) return null;
    return { merchant, description, expirationText, rawText, status };
  };
  const identity = (offer) =>
    norm([offer.merchant, offer.description, offer.expirationText].join('|'));
  const scan = (forceAdded) => {
    const cards = new Set();
    document
      .querySelectorAll('[data-testid="merchantOfferExpiration"],h3,h4')
      .forEach((el) => {
        const card = findCard(el);
        if (card) cards.add(card);
      });
    const offers = new Map();
    for (const card of cards) {
      if (!forceAdded && !isAdded(card)) continue;
      const offer = extract(card, 'added');
      if (offer) offers.set(identity(offer), offer);
    }
    return [...offers.values()];
  };
  const makeReport = (offers, source, coverage) => ({
    schema: 1,
    generatedAt: new Date().toISOString(),
    source,
    coverage,
    // Never save the page URL, account keys, card numbers, or cookies.
    offers: offers.slice(0, 1000),
  });
  globalThis.AmexOfferData = {
    findCard,
    extract,
    identity,
    scan,
    isAdded,
    makeReport,
  };
})();
