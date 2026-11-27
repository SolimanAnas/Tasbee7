const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.onnx': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.db': 'application/octet-stream',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0].split('#')[0];
  const decodedPath = decodeURIComponent(urlPath);
  let filePath = path.join(ROOT, decodedPath === '/' ? 'index.html' : decodedPath);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Service-Worker-Allowed': '/',
      'Accept-Ranges': 'bytes',
    };
    // Real hosts answer byte ranges, and a browser can only seek in a video that way.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      const size = data.length;
      let start = range[1] ? parseInt(range[1], 10) : size - parseInt(range[2], 10);
      let end = range[1] && range[2] ? parseInt(range[2], 10) : size - 1;
      start = Math.max(0, start); end = Math.min(size - 1, end);
      if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
      res.end(data.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': data.length });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Static server running at http://localhost:${PORT}`);
});

module.exports = server;
