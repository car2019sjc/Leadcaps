import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { once } from 'node:events';
(async () => {
  await mkdir('test-results', {recursive:true});
  const web = spawn(process.execPath, ['scripts/serve.mjs', '--port=8013'], {stdio:['ignore','pipe','inherit']});
  await once(web.stdout, 'data');
  let browser;
  try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/fonts.googleapis.com/**', route => route.abort());
  await page.route('**/fonts.gstatic.com/**', route => route.abort());
  const bases = []; let session = false;
  await page.route('http://127.0.0.1:8327/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { 'access-control-allow-origin': 'http://127.0.0.1:8013', 'access-control-allow-headers': 'Content-Type, Authorization', 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS' };
    const reply = (status, value) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(value) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/v1/sessions' && request.method() === 'POST') { session = true; return reply(201, { token: 'x'.repeat(43), user: { name: 'Pessoa de teste' } }); }
    if (!session) return reply(401, { error: 'Sessão expirada' });
    if (url.pathname === '/v1/sessions/current') { session = false; return route.fulfill({ status: 204, headers }); }
    if (url.pathname === '/v1/imports' && request.method() === 'POST') {
      const body = request.postDataJSON();
      const item = { id: '11111111-1111-4111-8111-111111111111', description: body.description, filename: body.filename, record_count: body.pack.cols.n.length, pack: body.pack, imported_at: '2026-10-23T18:00:00Z', imported_by: 'Pessoa de teste' };
      bases.push(item); return reply(201, { item });
    }
    if (url.pathname === '/v1/imports') return reply(200, { items: bases.map(({pack, ...item}) => item), next_offset: null });
    return reply(200, { item: bases[0] });
  });
  await page.goto('http://127.0.0.1:8013', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('tblN').textContent === '3');
  assert.equal(await page.locator('#btnContent').count(),0,'Módulo de conteúdo retirado');
  assert.equal(await page.locator('#contentModule').count(),0,'Tela editorial não deve ser compilada');
  await page.locator('#btnUp').click();
  const csv = { name: 'manufatura.csv', mimeType: 'text/csv', buffer: Buffer.from('Nome;Cargo;Empresa;Email;Estado\nContato Nova Pesquisa;CIO;Industria Exemplo;novo@example.com;SP\n') };
  await page.locator('#file').setInputFiles(csv);
  await page.waitForFunction(() => document.getElementById('uplmsg').textContent.includes('Descreva do que'));
  assert.equal(bases.length, 0);
  await page.locator('#uplx').click(); await page.locator('#btnBases').click();
  await page.locator('#dbApi').fill('http://127.0.0.1:8327');
  await page.locator('#dbUsername').fill('teste'); await page.locator('#dbPassword').fill('senha-ficticia-1234');
  await page.locator('#dbConnect').click();
  await page.waitForFunction(() => document.getElementById('dbMessage').textContent.includes('Nenhuma base salva'));
  await page.locator('#dbNew').click(); await page.locator('#baseDescription').fill('Contatos de manufatura — teste');
  assert.equal(await page.locator('#importMode').isVisible(), false);
  await page.locator('#file').setInputFiles(csv);
  await page.waitForFunction(() => document.getElementById('uplmsg').textContent.includes('salva com 1 contatos'));
  assert.equal(bases.length, 1);
  assert.equal(await page.locator('#tblN').textContent(), '3', 'Salvar não pode ativar a base');
  await page.locator('#uplmsg button').click();
  await page.waitForFunction(() => document.getElementById('tblN').textContent === '1');
  assert.match(await page.locator('#srcbar').textContent(), /manufatura/);
  assert.match(await page.locator('#tbody').textContent(), /Contato Nova Pesquisa/);
  await page.locator('#btnBases').click(); await page.waitForFunction(() => document.querySelectorAll('.db-card').length === 1);
  assert.match(await page.locator('.db-card').textContent(), /15:00:00 \(Brasília\)/);
  await page.screenshot({ path: 'test-results/bases-desktop.png', fullPage: true });
  await page.locator('#dbLogout').click();
  await page.waitForFunction(() => document.getElementById('tblN').textContent === '3');
  assert.equal(await page.locator('#dbLogin').isVisible(), true);
  assert.equal(errors.length, 0, errors.join('\n'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/bases-mobile.png', fullPage: true });
  console.log('UI real: descrição obrigatória, login, salvar sem ativar, escolher base, listar metadados e sair — 7 verificações OK; nenhum erro JavaScript.');
  } finally {
    if (browser) await browser.close();
    web.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });
