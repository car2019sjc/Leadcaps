import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runInNewContext, Script } from 'node:vm';
import { build, root, loadDemoPack, validatePack, scriptSafeJson } from '../scripts/build.mjs';

async function importer() {
  return runInNewContext((await readFile(resolve(root, 'src/js/ingest.js'), 'utf8')) + '\nING;', { TextDecoder, Uint8Array, Blob });
}

test('CSV com acentos e campos entre aspas preserva nome, empresa e e-mail', async () => {
  const ing = await importer();
  const content = Buffer.from('Nome;Cargo;Empresa;Email;Estado\r\n"Pessoa, Fictícia";CIO;"Empresa; Exemplo";ficticio@example.com;São Paulo\r\n');
  const raw = await ing.readFile({ name: 'demo.csv', arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) });
  const rows = ing.build(raw, ing.mapCols(Object.keys(raw[0])));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].n, 'Pessoa, Fictícia');
  assert.equal(rows[0].c, 'Empresa; Exemplo');
  assert.equal(rows[0].e, 'ficticio@example.com');
  assert.equal(rows[0].uf, 'SP');
  assert.equal(rows[0].ti, true);
});

test('empacotamento e hidratação preservam os dados da amostra fictícia', async () => {
  const pack = await loadDemoPack();
  assert.equal(validatePack(pack), 3);
  const ing = await importer();
  const app = await readFile(resolve(root, 'src/js/app.js'), 'utf8');
  const hydrateCode = app.slice(app.indexOf('const LIBASE'), app.indexOf('let HAS_REV'));
  const rows = runInNewContext(hydrateCode + '\nROWS;', { PACK: pack, ING: ing });
  assert.equal(rows[0].n, 'Pessoa Exemplo A');
  assert.equal(rows[0].e, 'exemplo.a@example.com');
  assert.equal(rows[2].e, '');
  assert.equal(rows[2].rev, null);
  assert.deepEqual(JSON.parse(JSON.stringify(ing.pack(rows))), pack);
});

test('faturamento ausente permanece distinto de zero', async () => {
  const ing = await importer();
  assert.equal(ing.revOf(''), null);
  assert.equal(ing.revOf('0'), 0);
  assert.equal(ing.revOf('US$ 10 mi'), 10000000);
});

test('compilação padrão produz HTML portátil e somente três contatos fictícios', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'leadcaps-'));
  try {
    const output = join(directory, 'index.html');
    const result = await build({ output });
    const html = await readFile(output, 'utf8');
    assert.equal(result.records, 3);
    assert.match(html, /Base inicial fictícia · importe sua planilha/);
    assert.doesNotMatch(html, /<script[^>]+src=/i);
    assert.doesNotMatch(html, /@@[A-Z_0-9]+@@/);
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    assert.equal(scripts.length, 4);
    for (const [i, block] of scripts.entries()) new Script(block[1], { filename: `inline-${i}.js` });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('serialização impede que dados fechem uma tag script', () => {
  const value = { n: ['</script><script>alert(1)</script>'] };
  const serialized = scriptSafeJson(value);
  assert.doesNotMatch(serialized, /<\/script/i);
  assert.deepEqual(JSON.parse(serialized), value);
});

test('regenerar o app preserva código e dados que contêm fechamento de script', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'leadcaps-export-'));
  try {
    const output = join(directory, 'index.html');
    await build({ output });
    const html = await readFile(output, 'utf8');
    const app = await readFile(resolve(root, 'src/js/app.js'), 'utf8');
    const start = app.indexOf('function saveApp()');
    const end = app.indexOf('\n}\n', start) + 3;
    let downloaded, filename;
    const maliciousPack = { n: ['</script>'] };
    runInNewContext(app.slice(start, end) + '\nsaveApp();', {
      SELF_HEAD: html.match(/<head>[\s\S]*?<\/head>/)[0],
      SELF_BODY: html.match(/<body>([\s\S]*)<\/body>/)[1],
      ROWS: [], SOURCE: { when: new Date('2026-10-23T12:00:00Z') },
      ING: { pack: () => maliciousPack }, Blob, console,
      stamp: () => 'teste', toast: () => {},
      download: (value, name) => { downloaded = value; filename = name; },
    });
    assert.ok(downloaded, 'A função deve gerar o arquivo.');
    const exported = await downloaded.text();
    assert.match(filename, /\.html$/);
    assert.equal([...exported.matchAll(/<\/script>/gi)].length, 4);
    assert.match(exported, /\\u003c\/script>/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('exportação Excel gera pacote XLSX nativo com planilha e strings', async () => {
  const code = await readFile(resolve(root, 'src/js/xlsx-export.js'), 'utf8');
  const xl = runInNewContext(code + '\nXL;', { TextEncoder, Uint8Array, Uint32Array, DataView, Blob });
  const blob = xl.build([{ name: 'Teste', cols: [{ h: 'Nome', w: 24, t: 's' }], rows: [['Pessoa fictícia']] }]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /xl\/worksheets\/sheet1.xml/);
  assert.match(text, /Pessoa fictícia/);
});

test('validação rejeita base com colunas de comprimentos diferentes', () => {
  assert.throws(() => validatePack({ dic: {}, cols: { n: ['demo'], t: [] } }), /Comprimento inválido/);
});
