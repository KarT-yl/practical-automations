(function (root) {
  'use strict';
  const number = (value) => Number(String(value).replace(/,/g, ''));
  const cash = '\\$([\\d,]+(?:\\.\\d{1,2})?)';
  const chicagoDate = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  const isoDate = (year, month, day) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    )
      return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  const parseDate = (text, capturedAt) => {
    let match = String(text || '').match(
      /\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/,
    );
    if (match)
      return isoDate(
        number(match[3]) + (match[3].length === 2 ? 2000 : 0),
        number(match[1]),
        number(match[2]),
      );
    match = String(text || '').match(/\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/);
    if (match) {
      const month =
        [
          'jan',
          'feb',
          'mar',
          'apr',
          'may',
          'jun',
          'jul',
          'aug',
          'sep',
          'oct',
          'nov',
          'dec',
        ].indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
      return month ? isoDate(number(match[3]), month, number(match[2])) : null;
    }
    match = String(text || '').match(/\bexpires? in (\d+) days?\b/i);
    if (match && capturedAt) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(capturedAt));
      const date = new Date(parts + 'T00:00:00Z');
      date.setUTCDate(date.getUTCDate() + number(match[1]));
      return date.toISOString().slice(0, 10);
    }
    return null;
  };
  const parse = (offer, capturedAt) => {
    const text = String(offer.description || '')
      .replace(/®|™/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const lower = text.toLowerCase();
    const notes = [];
    const expiry = parseDate(offer.expirationText, capturedAt);
    if (!expiry) notes.push('Expiration unclear; check the offer.');
    const thresholdMatch = text.match(
      new RegExp(
        '(?:spend|spending|purchase(?:s)? (?:of|totaling))\\s*' + cash,
        'i',
      ),
    );
    const threshold = thresholdMatch ? number(thresholdMatch[1]) : null;
    const repetitions = number(text.match(/up to (\d+) times?\b/i)?.[1] || 1);
    const hasPoints = /points?\b/i.test(text);
    const rateMatch = text.match(
      /(?:earn|get|receive)\s*(\d+(?:\.\d+)?)\s*%\s*(?:back|cash ?back)/i,
    );
    const rewardMatch = text.match(
      new RegExp(
        '(?:earn|get|receive)\\s*' +
          cash +
          '\\s*(?:back|(?:statement )?credit)',
        'i',
      ),
    );
    const totalMatch = text.match(
      new RegExp('(?:up to (?:a )?(?:total of )?|total of )' + cash, 'i'),
    );
    const pointsRateMatch = text.match(
      /(?:earn|get|receive)\s*\+?\s*([\d,.]+)\s*(?:membership rewards\s*)?(?:bonus\s*)?points?\s+per\s+(?:eligible\s+)?dollar/i,
    );
    const fixedPoints = text.match(
      /(?:earn|get|receive)\s*\+?\s*([\d,]+)\s*(?:bonus\s*)?(?:membership rewards\s*)?(?:bonus\s*)?points?\b/i,
    );
    const pointCap = text.match(
      /up to\s*([\d,]+)\s*(?:bonus\s*)?(?:membership rewards\s*)?points?\b/i,
    );
    let kind = 'other',
      cashReward = null,
      cashRate = null,
      cashCap = null,
      points = null,
      pointsPerDollar = null,
      pointsCap = null,
      spendToCap = null;
    let complex =
      (text.match(/\bspend\s*\$/gi) || []).length > 1 ||
      /\b(?:monthly|per month|each month|per quarter|tiers?|new card|additional card|add (?:an?|additional) card)\b/i.test(
        lower,
      );
    if (hasPoints && (rewardMatch || rateMatch)) complex = true;
    if (hasPoints) {
      kind = 'points';
      pointsPerDollar = pointsRateMatch ? number(pointsRateMatch[1]) : null;
      points = !pointsPerDollar && fixedPoints ? number(fixedPoints[1]) : null;
      pointsCap = pointCap
        ? number(pointCap[1])
        : points !== null
          ? points * repetitions
          : null;
      if (pointsPerDollar && pointsCap)
        spendToCap = pointsCap / pointsPerDollar;
      else if (threshold && points) spendToCap = threshold * repetitions;
    } else if (rateMatch) {
      kind = 'cash';
      cashRate = number(rateMatch[1]) / 100;
      cashCap = totalMatch ? number(totalMatch[1]) : null;
      if (cashCap && cashRate)
        spendToCap = Math.ceil((cashCap / cashRate) * 100 - 1e-8) / 100;
    } else if (rewardMatch) {
      kind = 'cash';
      cashReward = number(rewardMatch[1]);
      cashRate = threshold ? cashReward / threshold : null;
      cashCap = totalMatch
        ? number(totalMatch[1])
        : repetitions > 1
          ? cashReward * repetitions
          : null;
      if (threshold && repetitions > 1) spendToCap = threshold * repetitions;
    }
    if (kind === 'other')
      notes.push('Reward not parsed; read the original description.');
    if (complex)
      notes.push('Complex or mixed conditions; excluded from value rankings.');
    if (!threshold && !rateMatch && !pointsRateMatch)
      notes.push(
        'Required spending is not clear from the visible description.',
      );
    if (/single purchase|one purchase/.test(lower))
      notes.push('Single qualifying purchase required.');
    if (/online|website|\.com\b/.test(lower))
      notes.push('Online/channel restrictions may apply.');
    if (/subscription|membership(?! rewards)|auto.?renew/.test(lower))
      notes.push('Check subscription or renewal conditions.');
    if (/up to/.test(lower) && !totalMatch && !pointCap && repetitions === 1)
      notes.push('A limit is mentioned but was not parsed.');
    return {
      ...offer,
      expiry,
      threshold,
      repetitions,
      kind,
      cashReward,
      cashRate,
      cashCap,
      points,
      pointsPerDollar,
      pointsCap,
      spendToCap,
      complex,
      notes,
    };
  };
  const analyze = (offers, asOf = chicagoDate(), capturedAt) =>
    offers.map((offer, index) => {
      const parsed = parse(offer, capturedAt);
      const days = parsed.expiry
        ? Math.round(
            (Date.parse(parsed.expiry + 'T00:00:00Z') -
              Date.parse(asOf + 'T00:00:00Z')) /
              86400000,
          )
        : null;
      const enrolled = ['added', 'confirmed'].includes(offer.status);
      return {
        ...parsed,
        index,
        days,
        expired: days !== null && days < 0,
        enrolled,
        cashComparable:
          enrolled &&
          !parsed.complex &&
          parsed.kind === 'cash' &&
          parsed.cashRate !== null,
        pointsComparable:
          enrolled &&
          !parsed.complex &&
          parsed.kind === 'points' &&
          (parsed.pointsPerDollar !== null ||
            (parsed.points !== null && parsed.threshold > 0)),
        pointsEfficiency:
          parsed.pointsPerDollar ??
          (parsed.threshold > 0 && parsed.points !== null
            ? parsed.points / parsed.threshold
            : null),
      };
    });
  const sort = (rows, mode = 'soon', planned = []) =>
    [...rows].sort((a, b) => {
      const pref =
        Number(planned.includes(b.index)) - Number(planned.includes(a.index));
      if (pref) return pref;
      if (mode === 'cash')
        return (
          (b.cashRate ?? -1) - (a.cashRate ?? -1) ||
          (a.days ?? 99999) - (b.days ?? 99999)
        );
      if (mode === 'points') {
        const program =
          Number(/membership rewards/i.test(b.description)) -
          Number(/membership rewards/i.test(a.description));
        if (program) return program;
        return (
          (b.pointsEfficiency ?? -1) - (a.pointsEfficiency ?? -1) ||
          (a.days ?? 99999) - (b.days ?? 99999)
        );
      }
      if (mode === 'spend')
        return (
          (a.threshold ?? Infinity) - (b.threshold ?? Infinity) ||
          a.merchant.localeCompare(b.merchant)
        );
      return (
        (a.days ?? 99999) - (b.days ?? 99999) ||
        a.merchant.localeCompare(b.merchant)
      );
    });
  const api = { parse, parseDate, analyze, sort, chicagoDate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AmexAnalysis = api;
})(globalThis);
