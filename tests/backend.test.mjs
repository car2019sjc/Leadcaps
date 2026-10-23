import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { loadDemoPack } from '../scripts/build.mjs';
import { validateImport } from '../backend/validation.mjs';
import { passwordHash, passwordMatches, tokenHash } from '../backend/auth.mjs';
import { migrate } from '../backend/db.mjs';
import { createApi } from '../backend/server.mjs';

async function sample() {
  return { description: 'CIOs fictícios de São Paulo', filename: 'contatos-demo.csv', source_sha256: 'a'.repeat(64), request_id: randomUUID(), pack: await loadDemoPack() };
}

test('contrato de carga exige descrição e protege os índices do console', async () => {
  const input = await sample();
  const value = validateImport(input);
  assert.equal(value.record_count, 3);
  input.description = '  ';
  assert.throws(() => validateImport(input), /Descrição/);
  input.description = value.description;
  input.pack.cols.dp[0] = 999999;
  assert.throws(() => validateImport(input), /Referência/);
});

test('senhas são verificadas por hash e tokens não usam o valor em claro no banco', async () => {
  const hash = await passwordHash('senha-ficticia-de-teste');
  assert.ok(await passwordMatches('senha-ficticia-de-teste', hash));
  assert.equal(await passwordMatches('outra-senha', hash), false);
  assert.equal(tokenHash('token-de-teste').length, 64);
  assert.doesNotMatch(hash, /senha-ficticia/);
});

test('PostgreSQL: cargas independentes, idempotência, retomada e controle de acesso', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  // Schema aleatório exclusivo do teste: nunca migra nem limpa tabelas de uma aplicação existente.
  const schema = 'test_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}`, max: 4 });
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
  });
  await migrate(pool); await migrate(pool);
  assert.equal((await pool.query("SELECT to_regclass('content_researches') AS table_name")).rows[0].table_name, null, 'Instalação nova cria somente acesso e bases');
  await pool.query('INSERT INTO app_users(id,login,display_name,password_hash) VALUES ($1,$2,$3,$4)', [randomUUID(), 'teste', 'Pessoa de Teste', await passwordHash('senha-ficticia-1234')]);
  server = await createApi({ pool, origins: ['https://exemplo.netlify.app'] });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let token = '';
  const call = (path, method = 'GET', body, origin = 'https://exemplo.netlify.app') => fetch(base + path, { method, headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.equal((await call('/v1/imports')).status, 401);
  assert.equal((await call('/health', 'GET', undefined, 'https://outro.example')).status, 403);
  assert.equal((await call('/v1/sessions', 'POST', { login: 'teste', password: 'senha-errada' })).status, 401);
  let response = await call('/v1/sessions', 'POST', { login: 'teste', password: 'senha-ficticia-1234' });
  token = (await response.json()).token; assert.ok(token);
  const first = await sample();
  response = await call('/v1/imports', 'POST', first); assert.equal(response.status, 201);
  const one = (await response.json()).item;
  assert.equal(one.imported_by, 'Pessoa de Teste');
  assert.ok(Math.abs(new Date(one.imported_at).getTime() - Date.now()) < 10000);
  response = await call('/v1/imports', 'POST', first); assert.equal(response.status, 200);
  assert.equal((await response.json()).item.id, one.id);
  assert.equal((await call('/v1/imports', 'POST', { ...first, description: 'Carga diferente com mesma chave' })).status, 409);
  const second = structuredClone(first); second.request_id = randomUUID(); second.description = 'Manufatura, pesquisa mais recente';
  second.pack.cols.t[0] = 'CTO (pesquisa diferente)';
  response = await call('/v1/imports', 'POST', second); assert.equal(response.status, 201);
  const two = (await response.json()).item; assert.notEqual(one.id, two.id);
  const beforeLogout = (await (await call(`/v1/imports/${one.id}`)).json()).item;
  assert.deepEqual(beforeLogout.pack, validateImport(first).pack);
  assert.notEqual(beforeLogout.pack.cols.t[0], second.pack.cols.t[0]);
  assert.equal((await call('/v1/imports', 'POST', { ...first, request_id: randomUUID(), description: '' })).status, 400);
  const items = (await (await call('/v1/imports')).json()).items;
  assert.equal(items.length, 2); assert.ok(items.every(item => !('pack' in item)));
  // Simula uma instalação que já recebeu o módulo encerrado, sem apagar seu histórico.
  for (const [version, file] of [[2,'002_content.sql'],[3,'003_search.sql']]) {
    await pool.query(await readFile(new URL('../backend/migrations/'+file,import.meta.url),'utf8'));
    await pool.query('INSERT INTO schema_migrations(version) VALUES($1)',[version]);
  }
  const userId=(await pool.query("SELECT id FROM app_users WHERE login='teste'")).rows[0].id;
  const legacyId=randomUUID();
  await pool.query("INSERT INTO content_researches(id,request_id,payload_hash,created_by,data) VALUES($1,$2,'legacy',$3,$4)",[legacyId,randomUUID(),userId,JSON.stringify({preserved:true})]);
  const runId=randomUUID();
  await pool.query("INSERT INTO search_runs(id,request_id,payload_hash,created_by,status,data) VALUES($1,$2,'legacy',$3,'queued','{}')",[runId,randomUUID(),userId]);
  await migrate(pool);
  assert.deepEqual((await pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(r=>r.version),[1,2,3]);
  assert.deepEqual((await pool.query('SELECT data FROM content_researches WHERE id=$1',[legacyId])).rows[0].data,{preserved:true});
  assert.equal((await pool.query('SELECT status FROM search_runs WHERE id=$1',[runId])).rows[0].status,'queued');
  assert.equal(server.content,undefined);assert.equal(server.discovery,undefined);
  for (const path of ['/v1/content/config','/v1/search/config']) assert.equal((await call(path)).status,404);
  for (const path of ['/v1/content/jobs','/v1/search/runs']) assert.equal((await call(path,'POST',{})).status,404);
  assert.deepEqual((await(await call(`/v1/imports/${one.id}`)).json()).item.pack,beforeLogout.pack);
  assert.equal((await call('/v1/sessions/current', 'DELETE')).status, 204);
  assert.equal((await call('/v1/imports')).status, 401);
  token = (await (await call('/v1/sessions', 'POST', { login: 'teste', password: 'senha-ficticia-1234' })).json()).token;
  const afterLogin = (await (await call(`/v1/imports/${one.id}`)).json()).item;
  assert.deepEqual(afterLogin.pack, beforeLogout.pack);
  await pool.query("UPDATE app_sessions SET expires_at = clock_timestamp() - interval '1 second'");
  assert.equal((await call('/v1/imports')).status, 401);
});
