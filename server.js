// Local static server. Header behaviour mirrors the production nginx block so
// that local testing reflects what generator.basket-app.com does.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const DIR = __dirname;
const mime = {
  '.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp',
  '.otf':'font/otf','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2'
};
// Images and fonts never change under the same name: cache for a month.
const IMMUTABLE = new Set(['.png','.jpg','.jpeg','.gif','.svg','.webp','.otf','.ttf','.woff','.woff2']);
const COMPRESSIBLE = new Set(['.html','.js','.css','.json','.svg']);
// Generated thumbnails are rewritten in place by generate-library.js, so they
// must revalidate; originals never change under the same name.
const REGENERATED_DIRS = ['/MEDIA_THUMBS/', '/FONDOS_THUMBS/'];
function cacheControl(urlPath, ext) {
  if (REGENERATED_DIRS.some(d => urlPath.startsWith(d))) return 'public, max-age=86400';
  return IMMUTABLE.has(ext) ? 'public, max-age=2592000, immutable' : 'no-cache';
}
const PORT = process.argv[2] || 3456;

http.createServer((req, res) => {
  let u;
  try { u = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); res.end('Bad request'); return; }
  if (u === '/') u = '/index.html';
  const fp = path.join(DIR, u);
  if (fp !== DIR && !fp.startsWith(DIR + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.stat(fp, (e, s) => {
    if (e) { res.writeHead(404); res.end('Not found'); return; }
    if (s.isDirectory()) {
      fs.readdir(fp, (e2, files) => {
        res.writeHead(200, {'Content-Type':'text/html'});
        res.end(files.map(f => '<a href="'+u+'/'+f+'">'+f+'</a>').join('<br>'));
      });
      return;
    }
    const ext = path.extname(fp).toLowerCase();
    const etag = `W/"${s.size.toString(16)}-${Math.floor(s.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'ETag': etag,
      'Last-Modified': s.mtime.toUTCString(),
      'Cache-Control': cacheControl(u, ext)
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return; }
    const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (gzip) { headers['Content-Encoding'] = 'gzip'; headers['Vary'] = 'Accept-Encoding'; }
    else headers['Content-Length'] = s.size;
    res.writeHead(200, headers);
    const stream = fs.createReadStream(fp);
    if (gzip) stream.pipe(zlib.createGzip()).pipe(res); else stream.pipe(res);
  });
}).listen(PORT, () => console.log('Server running on http://localhost:' + PORT));
