import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import handler from '../api/index.js';
import { securityHeaders } from './security.js';

const assets = {
  '/style.css': 'text/css',
  '/app.js': 'text/javascript',
  '/icon.svg': 'image/svg+xml'
};
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path.startsWith('/api/')) return handler(req, res);
  const asset = assets[path] ? path : '/index.html';
  for (const [name, value] of Object.entries(securityHeaders)) res.setHeader(name, value);
  res.setHeader('Content-Type', (assets[path] || 'text/html') + '; charset=utf-8');
  res.end(await readFile(new URL('../public' + asset, import.meta.url)));
}).listen(process.env.PORT || 3000, () => console.log('PeScurt · http://localhost:' + (process.env.PORT || 3000)));
