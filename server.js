const http = require('http');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const mime = {
  '.html':'text/html','.js':'application/javascript','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json'
};
const PORT = process.argv[2] || 3456;
http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  const fp = path.join(DIR, u);
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
    res.writeHead(200, {'Content-Type': mime[ext]||'application/octet-stream', 'Access-Control-Allow-Origin':'*'});
    fs.createReadStream(fp).pipe(res);
  });
}).listen(PORT, () => console.log('Server running on http://localhost:' + PORT));
