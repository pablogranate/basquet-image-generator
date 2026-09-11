// Browser smoke test: serves the app with server.js and drives it in headless
// Chromium. Asserts on external behaviour only: requests, errors, draws, restore.
// Image folders are gitignored, so image paths may 404; assertions count and
// inspect requests rather than pixels.
//
// Playwright is resolved from node_modules or from $PLAYWRIGHT_PATH.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) {}
  if (process.env.PLAYWRIGHT_PATH) return require(process.env.PLAYWRIGHT_PATH);
  return null;
}
const pw = loadPlaywright();
const PORT = 3458;
const BASE = `http://localhost:${PORT}/`;
const BIG_TEAM = { league: 'LIGA NACIONAL', team: 'Racing (CH)' };

let server, browser;
before(async () => {
  if (!pw) return;
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 600));
  browser = await pw.chromium.launch();
});
after(async () => { if (browser) await browser.close(); if (server) server.kill(); });

async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const log = { errors: [], images: [], failed: 0 };
  page.on('pageerror', e => log.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) log.errors.push(m.text()); });
  page.on('request', r => { if (r.resourceType() === 'image') log.images.push(decodeURIComponent(new URL(r.url()).pathname)); });
  page.on('requestfailed', () => log.failed++);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  return { page, log };
}

const skip = !pw && 'playwright not resolvable (set PLAYWRIGHT_PATH)';

test('loads without JS errors and fetches only thumbnails for the background gallery', { skip }, async () => {
  const { page, log } = await openPage();
  assert.deepEqual(log.errors, []);
  const fullBackgrounds = log.images.filter(u => u.startsWith('/FONDOS/'));
  assert.equal(fullBackgrounds.length, 0, 'no full-size background requested on load');
  assert.ok(log.images.filter(u => u.startsWith('/FONDOS_THUMBS/')).length > 0, 'gallery uses thumbnails');
  await page.close();
});

test('library.js is served gzip-compressed with cache validators', { skip }, async () => {
  const res = await fetch(BASE + 'library.js', { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(res.headers.get('content-encoding'), 'gzip');
  assert.ok(res.headers.get('etag'));
  const font = await fetch(BASE + 'assets/fonts/Loos-Normal-Bold.woff2');
  assert.match(font.headers.get('cache-control'), /immutable/);
});

test('selecting the largest team never fetches full-size photos and lazy-loads thumbnails', { skip }, async () => {
  const { page, log } = await openPage();
  const before = log.images.length;
  await page.selectOption('#mainLeagueSelect', BIG_TEAM.league);
  await page.selectOption('#libTeam1Select', BIG_TEAM.team);
  await page.waitForTimeout(1500);
  const thumbs = await page.$$eval('#libPlayer1Thumbs img', els => els.length);
  assert.ok(thumbs > 10, `team has a thumbnail strip (${thumbs})`);
  const after = log.images.slice(before);
  const mediaFull = after.filter(u => /^\/MEDIA/.test(u) && !u.startsWith('/MEDIA_THUMBS/'));
  // Exactly the selected player's photo is loaded for the canvas, nothing else full-size.
  assert.ok(mediaFull.length <= 1, `full media requests: ${mediaFull.length}`);
  assert.ok(after.length < thumbs, `requests (${after.length}) stay below thumbnail count (${thumbs})`);
  const hasThumbs = await page.evaluate(([l, t]) => LIBRARY.leagues[l].teams[t].players.some(p => p.thumb), [BIG_TEAM.league, BIG_TEAM.team]);
  if (hasThumbs) {
    // Scrolling the strip into view triggers more thumbnail requests
    await page.evaluate(() => { const c = document.querySelector('.controls'); c.scrollTop = c.scrollHeight; });
    await page.waitForTimeout(800);
    assert.ok(log.images.length > before + after.length, 'more thumbnails requested after scroll');
  } else {
    // Library generated without thumbnails: placeholders, zero thumbnail traffic
    assert.equal(after.filter(u => u.startsWith('/MEDIA_THUMBS/')).length, 0);
    assert.equal(await page.locator('#libPlayer1Thumbs img.lib-thumb-missing').count(), thumbs);
  }
  assert.deepEqual(log.errors, []);
  await page.close();
});

test('render calls coalesce to one draw per frame and drags hit the player layer cache', { skip }, async () => {
  const { page, log } = await openPage();
  await page.selectOption('#mainLeagueSelect', BIG_TEAM.league);
  await page.selectOption('#libTeam1Select', BIG_TEAM.team);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    let n = 0; const times = []; const o = window.renderNow;
    window.renderNow = (...a) => { n++; const t0 = performance.now(); const r = o(...a); times.push(performance.now() - t0); return r; };
    window.__draws = () => n; window.__frameTimes = () => times;
  });
  await page.evaluate(() => { for (let i = 0; i < 50; i++) render(); });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__draws()), 1);
  // Photos may be absent locally: give slot 1 a synthetic player image
  await page.evaluate(() => new Promise(res => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 600;
    const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(60, 40, 180, 560);
    const img = new Image(); img.onload = () => { setImageToBox('player1', 'boxPlayer1', img); res(); }; img.src = c.toDataURL();
  }));
  // Turn on effects that use blur layers AND pooled temp canvases, then drag: layers must be reused
  for (const id of ['#fx_glow', '#fx_shadow', '#fx_neonOutline', '#fx_grain', '#fx_pixelate']) await page.check(id);
  await page.evaluate(() => { renderNow(); playerLayerStats.hits = 0; playerLayerStats.misses = 0; window.__frameTimes().length = 0; });
  const bounds = await page.evaluate(() => getPlayerBounds('player1', 2304, 720, 'desktop'));
  assert.ok(bounds && bounds.w > 0, 'player 1 is on the desktop canvas');
  const box = await page.$('#canvasDesktop').then(c => c.boundingBox());
  const x0 = box.x + (bounds.x + bounds.w / 2) / 2304 * box.width, y0 = box.y + (bounds.y + bounds.h / 2) / 720 * box.height;
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 20; i++) { await page.mouse.move(x0 + i * 4, y0); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.waitForTimeout(200);
  const stats = await page.evaluate(() => ({ ...playerLayerStats }));
  assert.ok(stats.hits > stats.misses, `cache hits (${stats.hits}) exceed misses (${stats.misses}) during a horizontal drag`);
  const times = await page.evaluate(() => window.__frameTimes());
  const cached = times.slice(1); // first frame builds the layers
  const avg = cached.reduce((a, b) => a + b, 0) / Math.max(1, cached.length);
  assert.ok(avg < 100, `average cached-frame draw time ${avg.toFixed(1)}ms stays under budget`);
  assert.deepEqual(log.errors, []);
  await page.close();
});

test('auto-save keeps images out of localStorage and restores inputs after reload', { skip }, async () => {
  const { page, log } = await openPage();
  await page.selectOption('#mainLeagueSelect', BIG_TEAM.league);
  await page.selectOption('#libTeam1Select', BIG_TEAM.team);
  await page.fill('#team1Name', 'Racing Smoke');
  await page.evaluate(() => new Promise(res => {
    const c = document.createElement('canvas'); c.width = 120; c.height = 120; c.getContext('2d').fillRect(0, 0, 120, 120);
    const img = new Image(); img.onload = () => { setImageToBox('team1Logo', 'boxTeam1Logo', img); res(); }; img.src = c.toDataURL();
  }));
  await page.evaluate(() => render());
  await page.waitForTimeout(1600); // past the save debounce
  const saved = await page.evaluate(() => localStorage.getItem('basquet_gen_state'));
  assert.ok(saved && saved.length < 20000, `localStorage payload is small (${saved && saved.length} bytes)`);
  assert.ok(!saved.includes('data:image'), 'no embedded images in localStorage');
  const slots = await page.evaluate(() => new Promise(res => {
    const req = indexedDB.open('basquet_custom_players');
    req.onsuccess = () => { const db = req.result; const tx = db.transaction('slotImages', 'readonly'); const g = tx.objectStore('slotImages').getAllKeys(); g.onsuccess = () => res(g.result); };
  }));
  assert.ok(slots.includes('team1Logo'), `slot image persisted to IndexedDB (${slots.join(',')})`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  assert.equal(await page.inputValue('#team1Name'), 'Racing Smoke');
  assert.equal(await page.inputValue('#libTeam1Select'), BIG_TEAM.team);
  // Removing an image right after assigning it must not leave a stale row behind
  await page.evaluate(() => new Promise(res => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; c.getContext('2d').fillRect(0, 0, 64, 64);
    const img = new Image(); img.onload = () => { setImageToBox('sec1LogoA', 'boxSec1LogoA', img); removeImage(new Event('click'), 'sec1LogoA', 'boxSec1LogoA'); res(); }; img.src = c.toDataURL();
  }));
  await page.waitForTimeout(500);
  const slotsAfter = await page.evaluate(() => new Promise(res => {
    const req = indexedDB.open('basquet_custom_players');
    req.onsuccess = () => { const db = req.result; const g = db.transaction('slotImages', 'readonly').objectStore('slotImages').getAllKeys(); g.onsuccess = () => res(g.result); };
  }));
  assert.ok(!slotsAfter.includes('sec1LogoA'), 'removed slot is not resurrected by a late persist');
  assert.deepEqual(log.errors, []);
  await page.close();
});

test('legacy saves with embedded images are migrated to IndexedDB', { skip }, async () => {
  const { page } = await openPage();
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  await page.evaluate((png) => {
    localStorage.setItem('basquet_gen_state', JSON.stringify({ template: 0, inputs: { team2Name: 'Legacy' }, checks: {}, images: { team2Logo: png } }));
  }, png);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  assert.equal(await page.inputValue('#team2Name'), 'Legacy');
  const after = await page.evaluate(() => localStorage.getItem('basquet_gen_state'));
  assert.ok(!after.includes('data:image'), 'embedded image removed from localStorage');
  const hasLogo = await page.evaluate(() => !!state.images.team2Logo);
  assert.equal(hasLogo, true, 'migrated image restored into its slot');
  await page.close();
});

test('download renders synchronously without selection handles', { skip }, async () => {
  const { page, log } = await openPage();
  const result = await page.evaluate(async () => {
    selectedElement = { canvas: 'desktop', key: 'player1' };
    const clicks = []; const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { clicks.push(this.download); };
    downloadImage('desktop');
    await new Promise(r => setTimeout(r, 500));
    HTMLAnchorElement.prototype.click = origClick;
    return { clicks, size: [canvasDesktop.width, canvasDesktop.height] };
  });
  assert.equal(result.clicks.length, 1);
  assert.match(result.clicks[0], /^Home Horizontal .*\.png$/);
  assert.deepEqual(result.size, [2304, 720]);
  assert.deepEqual(log.errors, []);
  await page.close();
});
