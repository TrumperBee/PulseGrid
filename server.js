const http = require('http');
const fs = require('fs');
const path = require('path');

/*
 * PULSEGRID FRONTEND SERVER
 * =========================
 * This serves the frontend (index.html) on port 3000.
 * 
 * BACKEND API runs SEPARATELY on port 5000.
 * To run the backend:
 *   cd backend
 *   node server.js
 * 
 * Make sure PostgreSQL is running and configured in backend/.env
 */

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading index.html');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
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
