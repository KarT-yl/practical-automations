const DEFAULTS = { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:00', skip: '', addLines: true };
const FIELDS = ['start', 'lunchStart', 'lunchEnd', 'end', 'skip'];
const $ = id => document.getElementById(id);

const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const to12 = t => { const [h, m] = t.split(':').map(Number); return [String(h % 12 || 12).padStart(2, '0'), String(m).padStart(2, '0'), h < 12 ? 'AM' : 'PM']; };

function current() {
  const c = {};
  FIELDS.forEach(f => (c[f] = $(f).value.trim()));
  c.addLines = $('addLines').checked;
  return c;
}

function validate(c) {
  if (!c.start || !c.lunchStart || !c.lunchEnd || !c.end) return 'Fill in all four times.';
  if (!(mins(c.start) < mins(c.lunchStart) && mins(c.lunchStart) < mins(c.lunchEnd) && mins(c.lunchEnd) < mins(c.end)))
    return 'Times need to run in order: start, lunch from, lunch to, end.';
  return '';
}

function normalizeDates(s) {
  return s.split(/[\s,;]+/).filter(Boolean).map(d => {
    const p = d.split(/[\/-]/);
    return p.length >= 2 ? p[0].padStart(2, '0') + '/' + p[1].padStart(2, '0') : d;
  });
}

function refresh() {
  const c = current();
  const err = validate(c);
  $('timeError').textContent = err;
  $('total').textContent = err ? '' : `${((mins(c.lunchStart) - mins(c.start) + mins(c.end) - mins(c.lunchEnd)) / 60).toFixed(2)} working hours a day`;
  if (!err) chrome.storage.sync.set(c);
}

function status(kind, lines) {
  const el = $('status');
  el.className = kind;
  el.innerHTML = '';
  lines.forEach(t => { const p = document.createElement('p'); p.textContent = t; el.appendChild(p); });
}

function report(r) {
  if (!r) return status('error', ["Couldn't read the page. Reload MyTE and try again."]);
  if (r.error) return status('error', [r.error]);
  if (!r.days) return status('error', ['No weekday rows found in the Working Hours window.']);
  const lines = [`Filled ${r.days} weekdays.`];
  let kind = 'ok';
  if (r.missing.length) { kind = 'warn'; lines.push(`Only one line on ${r.missing.join(', ')}. Click + on those days, then fill again.`); }
  if (r.extra.length) { kind = 'warn'; lines.push(`${r.extra.join(', ')} have more than two lines. Only the first two were filled.`); }
  if (r.unmatched) { kind = 'warn'; lines.push("Some dropdowns didn't have the time you set. Check the minutes."); }
  lines.push('Check the lines, then click Save in MyTE.');
  status(kind, lines);
}

async function run() {
  const c = current();
  const err = validate(c);
  $('timeError').textContent = err;
  if (err) return;
  chrome.storage.sync.set(c);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/myte\.accenture\.com\//.test(tab.url || '')) return status('error', ['Open MyTE in this tab first.']);

  const payload = {
    am: [...to12(c.start), ...to12(c.lunchStart), ...to12(c.lunchStart), ...to12(c.lunchEnd)],
    pm: [...to12(c.lunchEnd), ...to12(c.end), null, null, 'AM', null, null, 'AM'],
    skip: normalizeDates(c.skip),
    addLines: c.addLines
  };

  $('run').disabled = true;
  status('busy', ['Filling…']);
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fillWorkingHours, args: [payload] });
    report(res && res.result);
  } catch (e) {
    status('error', ["Couldn't run on this page. Reload MyTE and try again."]);
  } finally {
    $('run').disabled = false;
  }
}

// Runs inside the MyTE page. Must be fully self-contained.
async function fillWorkingHours(p) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const mask = document.querySelector('.popup-mask');
  if (!mask || !mask.querySelector('select.dropdown-list')) return { error: 'Open the Working Hours window first.' };

  const DAY = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*(\d{2}\/\d{2})/;
  const skip = new Set(p.skip);
  let unmatched = 0;

  const fire = s => s.dispatchEvent(new Event('change', { bubbles: true }));
  function setSel(s, v) {
    if (!s) return;
    for (let i = 0; i < s.options.length; i++) {
      const o = s.options[i];
      if (v === null ? o.text.trim() === '' : (o.value == v || o.text.trim() == v)) {
        if (s.selectedIndex !== i) { s.selectedIndex = i; fire(s); }
        return;
      }
    }
    if (v !== null) unmatched++;
  }
  const fill = (row, vals) => { const s = row.querySelectorAll('select.dropdown-list'); vals.forEach((v, i) => setSel(s[i], v)); };

  const rowIdx = r => { const x = r.getAttribute('row-index'); return x === null ? 0 : +x; };
  function days() {
    const rows = [...mask.querySelectorAll('.ag-row')].sort((a, b) => rowIdx(a) - rowIdx(b));
    const out = [];
    let d = null;
    rows.forEach(r => {
      const m = r.innerText.match(DAY);
      if (m && (!d || d.date !== m[2])) { d = { dow: m[1], date: m[2], lines: [] }; out.push(d); }
      if (!d) return;
      if (r.querySelectorAll('select.dropdown-list').length >= 12) d.lines.push(r);
    });
    return out;
  }
  const isWork = d => !/Sat|Sun/.test(d.dow) && !skip.has(d.date);

  function findPlus(row) {
    const direct = row.querySelector('myte-punch-clock-action-cell-renderer button');
    if (direct) return direct;
    const re = /(^|[\s_-])(add|plus)/i;
    const hits = [...row.querySelectorAll('*')].filter(el => {
      if (el.closest('select')) return false;
      const meta = ['class', 'aria-label', 'title', 'src', 'mattooltip'].map(a => el.getAttribute(a)).filter(Boolean).join(' ');
      return re.test(meta) || (el.children.length === 0 && el.textContent.trim() === '+');
    });
    if (hits.length) { const el = hits[hits.length - 1]; return el.closest('button,[role="button"],a') || el; }
    const cells = [...row.querySelectorAll('.ag-cell')].sort((a, b) => (+a.getAttribute('aria-colindex') || 0) - (+b.getAttribute('aria-colindex') || 0));
    const last = cells[cells.length - 1];
    if (last && !last.querySelector('select')) return last.querySelector('button,[role="button"],a,img,svg,i,span') || last.firstElementChild;
    return null;
  }

  let seen = {};
  const pass = () => days().forEach(d => {
    if (!isWork(d)) return;
    d.lines.slice(0, 2).forEach((r, i) => fill(r, i === 0 ? p.am : p.pm));
    seen[d.date] = Math.max(seen[d.date] || 0, d.lines.length);
  });

  const vp = mask.querySelector('.ag-body-viewport');
  async function fillAll() {
    seen = {};
    if (vp && vp.scrollHeight > vp.clientHeight + 4) {
      vp.scrollTop = 0; await sleep(250);
      for (let n = 0; n < 60; n++) {
        pass();
        if (vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 2) break;
        vp.scrollTop += Math.max(80, Math.floor(vp.clientHeight * 0.6));
        await sleep(250);
      }
      vp.scrollTop = 0; await sleep(150);
    } else {
      pass();
    }
  }

  // The + button stays disabled until the first line has valid times,
  // so fill first, then add the afternoon lines, then fill again.
  await fillAll();

  if (p.addLines && Object.values(seen).some(n => n < 2)) {
    await sleep(300);
    const tried = new Set();
    for (let n = 0; n < 40; n++) {
      const d = days().find(x => isWork(x) && x.lines.length === 1 && !tried.has(x.date));
      if (!d) break;
      tried.add(d.date);
      const btn = findPlus(d.lines[0]);
      if (!btn) continue;
      for (let w = 0; w < 10 && (btn.disabled || btn.getAttribute('aria-disabled') === 'true'); w++) await sleep(150);
      btn.scrollIntoView({ block: 'nearest' });
      btn.click();
      await sleep(400);
    }
    await fillAll();
  }

  const dates = Object.keys(seen);
  return { days: dates.length, missing: dates.filter(d => seen[d] < 2), extra: dates.filter(d => seen[d] > 2), unmatched };
}

document.addEventListener('DOMContentLoaded', async () => {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  FIELDS.forEach(f => ($(f).value = cfg[f]));
  $('addLines').checked = cfg.addLines;
  refresh();
  FIELDS.forEach(f => $(f).addEventListener('input', refresh));
  $('addLines').addEventListener('change', refresh);
  $('run').addEventListener('click', run);
});
