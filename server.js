const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (req.url === '/manifest.json') {
        filePath = path.join(__dirname, 'manifest.json');
        fs.readFile(filePath, (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Manifest not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(data2);
        });
        return;
      }
      filePath = path.join(__dirname, 'index.html');
      fs.readFile(filePath, (err2, data2) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(3000, () => {
  console.log('==================================================');
  console.log('🚀 PulseGrid Frontend');
  console.log('==================================================');
  console.log('Frontend: http://localhost:3000');
  console.log('Backend:  http://localhost:5000 (run separately)');
  console.log('==================================================');
  console.log('');
  console.log('To start backend:');
  console.log('  cd backend');
  console.log('  node server.js');
  console.log('');
});
