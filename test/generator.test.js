// Runs generate-library.js against a throwaway fixture root and checks the
// emitted library.js. Needs `sharp` resolvable (NODE_PATH or node_modules)
// for the thumbnail assertions; those are skipped when sharp is absent.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const GEN = path.join(__dirname, '..', 'generate-library.js');
// 1x1 opaque PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

let hasSharp = false;
try { require.resolve('sharp'); hasSharp = true; } catch (e) {}

const fixtures = [];
after(() => { for (const r of fixtures) fs.rmSync(r, { recursive: true, force: true }); });

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'libgen-'));
  fixtures.push(root);
  const put = (rel) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, PNG); };
  put('LOGOS LIGAS/4 - LOGOS LIGAS/LIGA NACIONAL.png');
  put('LOGOS LN/RACING CH.png');
  // Same player photographed 3 times + one distinct player + a variant "x2"
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/1-Juan Perez 1.png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/1-Juan Perez 2.png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/1-Juan Perez 10.png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/5 - Ana Gomez.png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/5 - Ana Gomez x2.png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/7 - Pedro Roca   LN (1)(1).png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/7 - Pedro Roca   LN (12).png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/(3)   Suplente   Luis Sosa.png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/(4)   Suplente   Luis Sosa.png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/Utilero (2) Gabriel Diaz.png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/Utilero   Gabriel Diaz.png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/001. Santiago Perez.png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/002. Santiago Perez.png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/Union Basquet 96175 Nicolas Cabrera.png');
  put('MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/Union Basquet 96235 Nicolas Cabrera.png');
  // Unnamed batch: 45 different people, must NOT collapse
  for (let i = 1; i <= 45; i++) put(`MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/RacingMediaDay ${String(i).padStart(3, '0')}.png`);
  put('FONDOS/fondo uno.png');
  put('ESCUDOS LIGA DOS/Huachipato.png');
  return root;
}

function run(root, args = []) {
  execFileSync(process.execPath, [GEN, '--strict', ...args], { cwd: root, env: { ...process.env, LIBRARY_ROOT: root }, stdio: 'pipe' });
  const src = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
  const m = src.match(/^const LIBRARY = ([\s\S]*);\n$/);
  assert.ok(m, 'library.js has expected wrapper');
  return { src, lib: JSON.parse(m[1]) };
}

test('collapses numbered photo variants of the same player into one entry', () => {
  const { lib } = run(makeFixture());
  const players = lib.leagues['LIGA NACIONAL'].teams['Racing (CH)'].players;
  const named = players.filter(p => !p.name.startsWith('RacingMediaDay'));
  const byName = (a, b) => a[0].localeCompare(b[0]);
  assert.deepEqual(named.map(p => [p.name, p.number]).sort(byName), [
    ['Juan Perez', '1'], ['Ana Gomez', '5'], ['Pedro Roca LN', '7'],
    ['Santiago Perez', ''], ['Suplente Luis Sosa', ''], ['Union Basquet Nicolas Cabrera', ''], ['Utilero Gabriel Diaz', ''],
  ].sort(byName));
  assert.equal(players.filter(p => p.name.startsWith('RacingMediaDay')).length, 45, 'unnamed batch kept intact');
  assert.equal(players[0].file, 'MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/1-Juan Perez 1.png');
});

test('emits compact JSON by default and pretty JSON with --pretty', () => {
  const root = makeFixture();
  const compact = run(root).src;
  assert.ok(!compact.includes('\n  "leagues"'), 'compact output has no indentation');
  const pretty = run(root, ['--pretty']).src;
  assert.ok(pretty.includes('\n  "leagues"'), 'pretty output is indented');
});

test('uses the uppercase ESCUDOS LIGA DOS folder', () => {
  const { lib } = run(makeFixture());
  assert.equal(lib.leagues['LIGA DOS'].teams['Huachipato'].logo, 'ESCUDOS LIGA DOS/Huachipato.png');
});

test('--strict drops leagues whose folders are missing instead of reusing stale entries', () => {
  const root = makeFixture();
  // Seed a stale library claiming LUB has players
  fs.writeFileSync(path.join(root, 'library.js'), 'const LIBRARY = ' + JSON.stringify({ leagues: { LUB: { logo: 'x', teams: { Stale: { logo: '', players: [{ name: 'Ghost', number: '', file: 'MEDIA DAY LUB/x.png' }] } } } }, backgrounds: [] }) + ';\n');
  const { lib } = run(root);
  assert.deepEqual(lib.leagues['LUB'].teams, {});
});

test('generates player and background thumbnails and records their paths', { skip: !hasSharp && 'sharp not resolvable' }, () => {
  const root = makeFixture();
  const { lib } = run(root);
  const p = lib.leagues['LIGA NACIONAL'].teams['Racing (CH)'].players[0];
  assert.equal(p.thumb, 'MEDIA_THUMBS/MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG/1-Juan Perez 1.jpg');
  assert.ok(fs.existsSync(path.join(root, p.thumb)), 'player thumb file exists');
  assert.deepEqual(lib.backgrounds, [{ full: 'FONDOS/fondo uno.png', thumb: 'FONDOS_THUMBS/fondo uno.jpg' }]);
  assert.ok(fs.existsSync(path.join(root, 'FONDOS_THUMBS/fondo uno.jpg')), 'background thumb file exists');
  // Only deduplicated players get thumbs: 7 named + 45 batch
  assert.equal(fs.readdirSync(path.join(root, 'MEDIA_THUMBS/MEDIA DAY LIGA NACIONAL/MEDIA DAY/Racing (CH)/PNG')).length, 52);
});
