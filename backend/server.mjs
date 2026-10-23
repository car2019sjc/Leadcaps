import { createServer } from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createPool, migrate } from './db.mjs';
import { newToken, tokenHash, passwordHash, passwordMatches } from './auth.mjs';
import { HttpError, text, validateImport } from './validation.mjs';

const MAX_BODY = 10 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const metadata = 'i.id, i.description, i.filename, i.source_sha256, i.imported_at, i.record_count, i.pack_version, u.display_name AS imported_by';

async function readJson(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Envie application/json.');
  if (Number(req.headers['content-length']) > MAX_BODY) throw new HttpError(413, 'Limite de 10 MB por carga.');
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Limite de 10 MB por carga.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'JSON inválido.'); }
}

export async function createApi({ pool, origins }) {
  if (!origins?.length) throw new Error('Configure ALLOWED_ORIGINS com o endereço exato do frontend.');
  const dummyHash = await passwordHash(randomUUID());
  const attempts = new Map();
  return createServer(async (req, res) => {
    const requestId = randomUUID();
    const send = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(value === undefined ? undefined : JSON.stringify(value));
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('Vary', 'Origin');
    try {
      const origin = req.headers.origin;
      if (origin && !origins.includes(origin)) throw new HttpError(403, 'Origem não autorizada.');
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '600');
        return send(204);
      }
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') {
        await pool.query('SELECT 1');
        return send(200, { status: 'ok' });
      }
      if (req.method === 'POST' && url.pathname === '/v1/sessions') {
        const key = req.socket.remoteAddress;
        const now = Date.now();
        for (const [ip, bucket] of attempts) if (bucket.until < now) attempts.delete(ip);
        const bucket = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
        if (bucket.count >= 15 || attempts.size > 1000) throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos.');
        bucket.count++; attempts.set(key, bucket);
        const input = await readJson(req);
        const login = text(input?.login, 'Login', 3, 100).toLowerCase();
        if (typeof input?.password !== 'string' || !input.password.length || input.password.length > 200) throw new HttpError(400, 'Senha inválida.');
        const password = input.password;
        const { rows } = await pool.query('SELECT * FROM app_users WHERE login = $1 AND active = true', [login]);
        const user = rows[0];
        if (!(await passwordMatches(password, user?.password_hash || dummyHash)) || !user) throw new HttpError(401, 'Login ou senha inválidos.');
        attempts.delete(key);
        await pool.query('DELETE FROM app_sessions WHERE expires_at < clock_timestamp()');
        const token = newToken();
        const { rows: sessions } = await pool.query("INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES ($1,$2,clock_timestamp() + interval '8 hours') RETURNING expires_at", [tokenHash(token), user.id]);
        return send(201, { token, expires_at: sessions[0].expires_at, user: { id: user.id, name: user.display_name } });
      }
      const bearer = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '');
      if (!bearer) throw new HttpError(401, 'Entre para acessar as bases salvas.');
      const hash = tokenHash(bearer[1]);
      const { rows: users } = await pool.query('SELECT u.id, u.display_name FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > clock_timestamp() AND u.active=true', [hash]);
      const user = users[0];
      if (!user) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
      if (req.method === 'DELETE' && url.pathname === '/v1/sessions/current') {
        await pool.query('DELETE FROM app_sessions WHERE token_hash = $1', [hash]);
        return send(204);
      }
      if (req.method === 'GET' && url.pathname === '/v1/imports') {
        const offset = Number(url.searchParams.get('offset') || 0);
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) throw new HttpError(400, 'Página inválida.');
        const { rows } = await pool.query(`SELECT ${metadata} FROM lead_imports i JOIN app_users u ON u.id=i.imported_by ORDER BY i.imported_at DESC, i.id DESC LIMIT 101 OFFSET $1`, [offset]);
        return send(200, { items: rows.slice(0, 100), next_offset: rows.length > 100 ? offset + 100 : null });
      }
      if (req.method === 'POST' && url.pathname === '/v1/imports') {
        const input = validateImport(await readJson(req));
        const digest = createHash('sha256').update(JSON.stringify(input)).digest('hex');
        const { rows: inserted } = await pool.query(`INSERT INTO lead_imports(id, request_id, description, filename, source_sha256, payload_sha256, imported_by, record_count, pack) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(imported_by,request_id) DO NOTHING RETURNING id`,
          [randomUUID(), input.request_id, input.description, input.filename, input.source_sha256, digest, user.id, input.record_count, JSON.stringify(input.pack)]);
        const { rows } = await pool.query(`SELECT ${metadata}, i.payload_sha256 FROM lead_imports i JOIN app_users u ON u.id=i.imported_by WHERE i.imported_by=$1 AND i.request_id=$2`, [user.id, input.request_id]);
        const item = rows[0];
        if (item.payload_sha256 !== digest) throw new HttpError(409, 'Identificador já utilizado por uma carga diferente.');
        delete item.payload_sha256;
        return send(inserted.length ? 201 : 200, { item });
      }
      const match = /^\/v1\/imports\/([^/]+)$/.exec(url.pathname);
      if (req.method === 'GET' && match) {
        if (!uuid.test(match[1])) throw new HttpError(400, 'Identificador inválido.');
        const { rows } = await pool.query(`SELECT ${metadata}, i.pack FROM lead_imports i JOIN app_users u ON u.id=i.imported_by WHERE i.id=$1`, [match[1]]);
        if (!rows[0]) throw new HttpError(404, 'Base não encontrada.');
        return send(200, { item: rows[0] });
      }
      throw new HttpError(404, 'Rota não encontrada.');
    } catch (error) {
      if (!res.headersSent) {
        if (!error.status) console.error(JSON.stringify({ request_id: requestId, code: error.code || 'INTERNAL_ERROR' }));
        send(error.status || 500, { error: error.status ? error.message : 'Falha interna. Tente novamente.', request_id: requestId });
      } else res.end();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pool = createPool();
  await migrate(pool);
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  const server = await createApi({ pool, origins });
  server.requestTimeout = 60000;
  server.headersTimeout = 15000;
  server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.log('Leadcaps API iniciada.'));
  const close = () => server.close(async () => { await pool.end(); process.exit(0); });
  process.on('SIGTERM', close); process.on('SIGINT', close);
}
