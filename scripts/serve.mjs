import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { root } from './build.mjs';

const directory = resolve(root, 'dist');
const portArg = process.argv.find(v => v.startsWith('--port='));
const port = Number(portArg?.split('=')[1] || 8000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta inválida.');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
await stat(resolve(directory, 'index.html')).catch(() => { throw new Error('Execute npm run build antes de iniciar.'); });
createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const path = resolve(directory, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(directory + sep)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Arquivo não encontrado.'); }
}).listen(port, '127.0.0.1', () => console.log(`Leadcaps: http://127.0.0.1:${port}`));
