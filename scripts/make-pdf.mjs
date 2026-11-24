#!/usr/bin/env node
/**
 * 把已建置的宜蘭列印頁輸出為 A4 PDF，寫入 public/pdfs/ 與 dist/pdfs/。
 */
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync, createReadStream } from 'node:fs';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
if (!existsSync(dist)) {
  console.error('找不到 dist/，請先執行 npm run build。');
  process.exit(1);
}

const chrome = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  .map((c) => spawnSync('which', [c], { encoding: 'utf8' }))
  .find((r) => r.status === 0);
if (!chrome) {
  console.warn('找不到 Chrome / Chromium，略過 PDF。本機或員工機器安裝 Chrome 後可執行 npm run pdf。');
  process.exit(0);
}
const chromePath = chrome.stdout.trim();

const dates = readdirSync(path.join(root, 'src/content/yilan'))
  .filter((n) => n.endsWith('.md'))
  .map((n) => n.replace(/\.md$/, ''));

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(dist, urlPath);
  if (existsSync(file) && statSync(file).isDirectory()) {
    file = path.join(file, 'index.html');
  }
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(file);
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

const port = await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

const publicDir = path.join(root, 'public/pdfs');
const distPdf = path.join(dist, 'pdfs');
mkdirSync(publicDir, { recursive: true });
mkdirSync(distPdf, { recursive: true });

try {
  for (const date of dates) {
    const url = `http://127.0.0.1:${port}/yilan/${date}/print/`;
    const dest = path.join(publicDir, `yilan-${date}.pdf`);
    const r = spawnSync(chromePath, [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-dbus',
      '--no-pdf-header-footer',
      `--print-to-pdf=${dest}`,
      url,
    ], { encoding: 'utf8', timeout: 90000 });
    if (!existsSync(dest) || statSync(dest).size < 1000) {
      throw new Error(`PDF 失敗 ${date} (status ${r.status}): ${r.stderr || r.stdout}`);
    }
    console.warn(r.stderr || '');
    copyFileSync(dest, path.join(distPdf, `yilan-${date}.pdf`));
    console.log('pdf', dest);
  }
} finally {
  server.close();
}
