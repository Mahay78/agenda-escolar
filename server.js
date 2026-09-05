/**
 * server.js - Servidor local ligero para la PWA Agenda Escolar (Sin dependencias externas)
 * Permite ejecutar la aplicación en el navegador con soporte completo para Service Worker y PWA.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.webmanifest': 'application/manifest+json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip'
};

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/' || reqUrl === '') {
    reqUrl = '/index.html';
  }

  // Ruta absoluta del archivo solicitado
  let safePath = path.normalize(decodeURIComponent(reqUrl)).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(BASE_DIR, safePath);

  // Comprobar si existe el archivo
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('404 No encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Cabeceras para Service Worker y PWA
    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    };

    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localUrl = `http://localhost:${PORT}`;
  const ips = getLocalIpAddresses();

  console.log('====================================================');
  console.log('🎒 AGENDA ESCOLAR - SERVIDOR LOCAL PWA EN MARCHA');
  console.log('====================================================');
  console.log(`\n💻 En tu ordenador:  ${localUrl}`);
  if (ips.length > 0) {
    console.log(`📱 En tu móvil (mismo Wi-Fi): http://${ips[0]}:${PORT}`);
  }
  console.log('\n✨ La aplicación funciona 100% Offline con fotos.');
  console.log('Pulsa Ctrl + C en esta consola para detener el servidor.\n');

  // Abrir navegador en Windows automáticamente
  const startCommand = process.platform === 'win32' ? `start ${localUrl}` : process.platform === 'darwin' ? `open ${localUrl}` : `xdg-open ${localUrl}`;
  exec(startCommand, (err) => {
    if (err) console.log('Abre la URL en tu navegador:', localUrl);
  });
});
