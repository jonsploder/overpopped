// Serve the report locally with a working "Regenerate" button.
//
//   npm run report:serve      then open http://localhost:5299
//
// The button downloads new logs (fetch-traces) and rebuilds report/index.html, then reloads.
import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const PORT = 5299;
const run = (script) => new Promise((resolve) => {
  const p = spawn('npm', ['run', script], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
  p.stderr.on('data', (d) => { out += d; process.stderr.write(d); });
  p.on('close', (code) => resolve({ code, out }));
});

let busy = null;
async function regen() {
  const f = await run('fetch-traces');
  if (f.code !== 0) return { ok: false, log: f.out };
  const r = await run('report');
  return { ok: r.code === 0, log: f.out + r.out };
}

http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/regen') {
    busy ??= regen().finally(() => { busy = null; });
    const result = await busy;
    res.writeHead(result.ok ? 200 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    if (!fs.existsSync('report/index.html')) await run('report');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync('report/index.html'));
    return;
  }
  res.writeHead(404).end();
}).listen(PORT, '127.0.0.1', () => console.log(`Report at http://localhost:${PORT}  (Ctrl+C to stop)`));
