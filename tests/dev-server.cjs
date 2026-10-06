// Loopback-only, read-only development server. No packages or accounts required.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png' };
http.createServer((req, res) => {
  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
  const route = new URL(req.url, 'http://127.0.0.1').pathname;
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(route)); }
  catch { res.writeHead(400); return res.end(); }
  if (!file.startsWith(root + path.sep) || !['.html','.css','.js','.png'].includes(path.extname(file))) {
    res.writeHead(403); return res.end();
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    if (route === '/extension/popup.html') data = Buffer.from(data.toString().replace('<script src="settings.js"', '<script src="/tests/preview-mock.js"></script><script src="settings.js"'));
    res.writeHead(200, {'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'}); res.end(data);
  });
}).listen(8765, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:8765/tests/browser.html'));
