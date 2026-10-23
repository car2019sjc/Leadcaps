import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const scriptSafeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');

export async function loadDemoPack() {
  const code = await readFile(resolve(root, 'src/js/ingest.js'), 'utf8');
  const ing = runInNewContext(code + '\nING;', { TextDecoder, Uint8Array, Blob });
  const csv = await readFile(resolve(root, 'examples/contatos-demo.csv'));
  const raw = await ing.readFile({ name: 'contatos-demo.csv', arrayBuffer: async () => csv.buffer.slice(csv.byteOffset, csv.byteOffset + csv.byteLength) });
  return JSON.parse(JSON.stringify(ing.pack(ing.build(raw, ing.mapCols(Object.keys(raw[0]))))));
}

export function validatePack(pack) {
  if (!pack?.dic || !pack?.cols || !Array.isArray(pack.cols.n)) throw new Error('Base sem dicionário e colunas válidos.');
  const count = pack.cols.n.length;
  for (const [key, values] of Object.entries(pack.cols)) {
    if (!Array.isArray(values) || values.length !== count) throw new Error(`Comprimento inválido da coluna ${key}.`);
  }
  return count;
}

export async function build({ privateData = false, output = resolve(root, 'dist/index.html') } = {}) {
  const meta = JSON.parse(await readFile(resolve(root, 'data/base.metadata.json'), 'utf8'));
  const pack = privateData
    ? JSON.parse(await readFile(resolve(root, 'data/private/base.pack.json'), 'utf8'))
    : await loadDemoPack();
  const count = validatePack(pack);
  let app = await readFile(resolve(root, 'src/js/app.js'), 'utf8');
  const localMeta = privateData
    ? await readFile(resolve(root, 'data/private/base.metadata.json'), 'utf8').then(JSON.parse).catch(() => meta)
    : null;
  const date = privateData ? localMeta.base_date || meta.base_date : '2026-10-23';
  const apiUrl = process.env.LEADCAPS_API_URL || '';
  if (apiUrl && !/^https?:\/\//.test(apiUrl)) throw new Error('LEADCAPS_API_URL precisa ser uma URL HTTP(S).');
  app = app.replace("'__BASE_DATE__'", scriptSafeJson(date)).replace("'__APP_BUILD__'", "'2026.10.23-repo.2'").replace("'__API_URL__'", scriptSafeJson(apiUrl));
  app = (await readFile(resolve(root, 'src/js/database.js'), 'utf8')) + '\n' + app;
  const entries = {
    CONSOLE_CSS: await readFile(resolve(root, 'src/styles/console.css'), 'utf8'),
    XLSX_EXPORT_JS: await readFile(resolve(root, 'src/js/xlsx-export.js'), 'utf8'),
    INGEST_JS: await readFile(resolve(root, 'src/js/ingest.js'), 'utf8'),
    BRAZIL_MAP_JS: await readFile(resolve(root, 'src/js/brazil-map.js'), 'utf8'),
    APP_JS: `const PACK = ${scriptSafeJson(pack)};\n/*PACK_END*/\n${app}`,
    LOGO_1_URI: 'data:image/png;base64,' + (await readFile(resolve(root, 'src/assets/logo-1.png'))).toString('base64'),
  };
  let html = await readFile(resolve(root, 'src/template.html'), 'utf8');
  for (const [key, value] of Object.entries(entries)) html = html.replaceAll(`@@${key}@@`, () => value);
  if (/@@[A-Z_0-9]+@@/.test(html)) throw new Error('Compilação contém marcadores sem resolução.');
  if (!privateData) {
    html = html.replace('<body>', '<body>\n<div role="status" style="position:fixed;bottom:12px;right:14px;z-index:200;background:#fff3cc;border:1px solid #d8ae35;border-radius:8px;padding:8px 12px;color:#382d0e;font:13px system-ui">Base inicial fictícia · importe sua planilha</div>');
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html);
  return { output, records: count, privateData };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await build({ privateData: process.argv.includes('--private-data') });
  console.log(`HTML gerado: ${result.records} contatos ${result.privateData ? 'da base local' : 'fictícios'} em dist/index.html`);
}
