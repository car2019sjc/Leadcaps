import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
  assert.equal((await call('/v1/sessions/current', 'DELETE')).status, 204);
  assert.equal((await call('/v1/imports')).status, 401);
  token = (await (await call('/v1/sessions', 'POST', { login: 'teste', password: 'senha-ficticia-1234' })).json()).token;
  const afterLogin = (await (await call(`/v1/imports/${one.id}`)).json()).item;
  assert.deepEqual(afterLogin.pack, beforeLogout.pack);
  await pool.query("UPDATE app_sessions SET expires_at = clock_timestamp() - interval '1 second'");
  assert.equal((await call('/v1/imports')).status, 401);
});
