import { randomUUID, createHash } from 'node:crypto';
import { HttpError } from './validation.mjs';
import { id, object, validateResearch, validateOpportunity, validateBrief, briefMarkdown, WEIGHTS, LABELS } from './content-contract.mjs';
import { anthropicProvider, PROMPT_VERSION } from './anthropic.mjs';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const publicJob = row => { const { input, payload_hash, ...safe } = row; return safe; };
const opportunitySelect = `SELECT o.*, r.data, r.author_type, r.author_id, r.created_at AS evaluated_at FROM content_opportunities o JOIN content_opportunity_revisions r ON r.opportunity_id=o.id AND r.revision=o.latest_revision`;

export function createContentService({ pool, provider = anthropicProvider(), dailyLimit = 20 }) {
  dailyLimit = Number.isInteger(dailyLimit) && dailyLimit >= 1 && dailyLimit <= 100 ? dailyLimit : 20;
  let timer, running, stopping = false;
  const abort = new AbortController();
  async function research(researchId, client = pool) {
    const { rows } = await client.query('SELECT * FROM content_researches WHERE id=$1', [id(researchId)]);
    if (!rows[0]) throw new HttpError(404, 'Pesquisa não encontrada.'); return rows[0];
  }
  async function opportunity(opportunityId, client = pool) {
    const { rows } = await client.query(opportunitySelect + ' WHERE o.id=$1', [id(opportunityId)]);
    if (!rows[0]) throw new HttpError(404, 'Oportunidade não encontrada.'); return rows[0];
  }
  async function transaction(work) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; }
    catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }
  async function enqueue(input, user) {
    object(input, ['request_id', 'research_id', 'action', 'opportunity_id', 'expected_revision']);
    id(input.request_id); id(input.research_id);
    if (!['opportunities', 'brief'].includes(input.action)) throw new HttpError(400, 'Ação inválida.');
    const digest = hash(input);
    return transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(741309230)');
      const existing = (await client.query('SELECT * FROM content_jobs WHERE created_by=$1 AND request_id=$2', [user.id, input.request_id])).rows[0];
      if (existing) {
        if (existing.payload_hash !== digest) throw new HttpError(409, 'Esta solicitação já foi usada para outra geração.');
        return { job: publicJob(existing), reused: true };
      }
      if (!provider.enabled) throw new HttpError(503, 'A Anthropic ainda precisa ser configurada na VPS.');
      const source = await research(input.research_id, client);
      const { rows: count } = await client.query("SELECT count(*)::integer AS n FROM content_jobs WHERE created_at >= date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'");
      if (count[0].n >= dailyLimit) throw new HttpError(429, 'Limite diário de gerações reservado. Tente no próximo dia UTC.');
      const queued = (await client.query("SELECT count(*)::integer AS n FROM content_jobs WHERE status IN ('queued','running')")).rows[0].n;
      if (queued >= 8) throw new HttpError(429, 'Há gerações aguardando. Aguarde o processamento.');
      const snapshot = { research: source.data };
      if (input.action === 'brief') {
        const selected = await opportunity(input.opportunity_id, client);
        if (selected.research_id !== source.id) throw new HttpError(400, 'Oportunidade não pertence à pesquisa.');
        if (selected.latest_revision !== input.expected_revision) throw new HttpError(409, 'A oportunidade foi alterada. Atualize antes de gerar.');
        if (selected.data.relevance !== 'relevant') throw new HttpError(409, 'Revise a pertinência da oportunidade antes de gerar o briefing.');
        snapshot.opportunity = { id: selected.id, revision: selected.latest_revision, data: selected.data };
      }
      const { rows } = await client.query(`INSERT INTO content_jobs(id,request_id,payload_hash,research_id,created_by,action,status,input,model,prompt_version) VALUES($1,$2,$3,$4,$5,$6,'queued',$7,$8,$9) RETURNING *`, [randomUUID(), input.request_id, digest, source.id, user.id, input.action, JSON.stringify(snapshot), provider.model, PROMPT_VERSION]);
      return { job: publicJob(rows[0]), reused: false };
    });
  }
  async function getBrief(briefId, client = pool) {
    const brief = (await client.query('SELECT * FROM content_briefs WHERE id=$1', [id(briefId)])).rows[0];
    if (!brief) throw new HttpError(404, 'Briefing não encontrado.');
    const { rows } = await client.query('SELECT v.*, u.display_name AS author, a.display_name AS approver FROM content_brief_versions v JOIN app_users u ON u.id=v.created_by LEFT JOIN app_users a ON a.id=v.approved_by WHERE brief_id=$1 ORDER BY version DESC', [brief.id]);
    return { brief, versions: rows };
  }
  async function handle(req, url, user, readJson, send) {
    if (!url.pathname.startsWith('/v1/content/')) return false;
    const path = url.pathname.slice('/v1/content/'.length);
    if (req.method === 'GET' && path === 'config') {
      const { rows } = await pool.query("SELECT count(*)::integer AS n FROM content_jobs WHERE created_at >= date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'");
      send(200, { enabled: provider.enabled, provider: 'Anthropic', model: provider.model, max_output_tokens: provider.maxTokens || 4096, daily_limit: dailyLimit, reserved_today: rows[0].n, weights: WEIGHTS, labels: LABELS }); return true;
    }
    if (path === 'researches' && req.method === 'POST') {
      const input = await readJson(req), data = validateResearch(input), digest = hash(data);
      if (data.profile?.base_id && !(await pool.query('SELECT id FROM lead_imports WHERE id=$1', [data.profile.base_id])).rowCount) throw new HttpError(400, 'Base do perfil não encontrada.');
      const { rows: inserted } = await pool.query('INSERT INTO content_researches(id,request_id,payload_hash,created_by,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(created_by,request_id) DO NOTHING RETURNING id', [randomUUID(), input.request_id, digest, user.id, JSON.stringify(data)]);
      const item = (await pool.query('SELECT id,data,payload_hash,created_at FROM content_researches WHERE created_by=$1 AND request_id=$2', [user.id, input.request_id])).rows[0];
      if (item.payload_hash !== digest) throw new HttpError(409, 'Esta solicitação já foi usada para outra pesquisa.');
      delete item.payload_hash; send(inserted.length ? 201 : 200, { item }); return true;
    }
    if (path === 'researches' && req.method === 'GET') {
      const offset = Number(url.searchParams.get('offset') || 0);
      if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new HttpError(400, 'Página inválida.');
      const { rows } = await pool.query("SELECT r.id,r.created_at,r.data->>'theme' AS theme,r.data->'context'->>'company' AS company,u.display_name AS author FROM content_researches r JOIN app_users u ON u.id=r.created_by ORDER BY r.created_at DESC,r.id DESC LIMIT 31 OFFSET $1", [offset]);
      send(200, { items: rows.slice(0,30), next_offset: rows.length > 30 ? offset + 30 : null }); return true;
    }
    const match = /^(researches|jobs|opportunities|briefs)\/([^/]+)(?:\/(reviews|versions|approvals|export))?$/.exec(path);
    if (path === 'jobs' && req.method === 'POST') { const value = await enqueue(await readJson(req), user); send(value.reused ? 200 : 202, value); return true; }
    if (!match) throw new HttpError(404, 'Operação editorial não encontrada.');
    const [, kind, itemId, operation] = match; id(itemId);
    if (kind === 'jobs' && req.method === 'GET' && !operation) {
      const item = (await pool.query('SELECT * FROM content_jobs WHERE id=$1', [itemId])).rows[0];
      if (!item) throw new HttpError(404, 'Geração não encontrada.'); send(200, { job: publicJob(item) }); return true;
    }
    if (kind === 'researches' && req.method === 'GET' && !operation) {
      const item = await research(itemId);
      const opportunities = (await pool.query(opportunitySelect + ' WHERE o.research_id=$1 ORDER BY o.created_at DESC,o.id', [itemId])).rows;
      const jobs = (await pool.query('SELECT * FROM content_jobs WHERE research_id=$1 ORDER BY created_at DESC LIMIT 40', [itemId])).rows.map(publicJob);
      const briefs = (await pool.query('SELECT b.id,b.latest_version,v.status,v.data->>\'title\' AS title FROM content_briefs b JOIN content_brief_versions v ON v.brief_id=b.id AND v.version=b.latest_version WHERE b.research_id=$1 ORDER BY b.created_at DESC', [itemId])).rows;
      delete item.payload_hash; delete item.request_id;
      send(200, { item, opportunities, jobs, briefs }); return true;
    }
    if (kind === 'opportunities' && operation === 'reviews' && req.method === 'POST') {
      const input = object(await readJson(req), ['expected_revision', 'data']);
      const item = await transaction(async client => {
        await client.query('SELECT id FROM content_opportunities WHERE id=$1 FOR UPDATE', [itemId]);
        const current = await opportunity(itemId, client);
        if (current.latest_revision !== input.expected_revision) throw new HttpError(409, 'Outra revisão foi salva. Atualize a pesquisa.');
        const source = await research(current.research_id, client);
        const data = validateOpportunity(input.data, source.data);
        const revision = current.latest_revision + 1;
        await client.query("INSERT INTO content_opportunity_revisions(opportunity_id,revision,data,author_type,author_id) VALUES($1,$2,$3,'human',$4)", [itemId, revision, JSON.stringify(data), user.id]);
        await client.query('UPDATE content_opportunities SET latest_revision=$2 WHERE id=$1', [itemId, revision]);
        return opportunity(itemId, client);
      }); send(200, { item }); return true;
    }
    if (kind === 'briefs' && req.method === 'GET' && !operation) { send(200, await getBrief(itemId)); return true; }
    if (kind === 'briefs' && req.method === 'POST' && ['versions','approvals'].includes(operation)) {
      const input = object(await readJson(req), operation === 'versions' ? ['expected_version','data'] : ['expected_version','reviewed']);
      const item = await transaction(async client => {
        await client.query('SELECT id FROM content_briefs WHERE id=$1 FOR UPDATE', [itemId]);
        const { brief, versions } = await getBrief(itemId, client);
        if (brief.latest_version !== input.expected_version) throw new HttpError(409, 'Outra versão foi salva. Atualize o briefing.');
        if (operation === 'approvals') {
          if (input.reviewed !== true) throw new HttpError(400, 'Confirme a revisão editorial desta versão.');
          await client.query("UPDATE content_brief_versions SET status='approved',approved_by=$3,approved_at=clock_timestamp() WHERE brief_id=$1 AND version=$2 AND status='draft'", [itemId, brief.latest_version, user.id]);
        } else {
          const source = await research(brief.research_id, client);
          const original = (await client.query('SELECT data FROM content_opportunity_revisions WHERE opportunity_id=$1 AND revision=$2', [brief.opportunity_id, brief.opportunity_revision])).rows[0];
          const data = validateBrief(input.data, source.data, original.data);
          const version = brief.latest_version + 1;
          await client.query('INSERT INTO content_brief_versions(brief_id,version,data,created_by) VALUES($1,$2,$3,$4)', [itemId, version, JSON.stringify(data), user.id]);
          await client.query('UPDATE content_briefs SET latest_version=$2 WHERE id=$1', [itemId, version]);
        }
        return getBrief(itemId, client);
      }); send(200, item); return true;
    }
    if (kind === 'briefs' && operation === 'export' && req.method === 'GET') {
      const { brief, versions } = await getBrief(itemId);
      const requested = Number(url.searchParams.get('version') || brief.latest_version);
      const version = versions.find(x => x.version === requested);
      if (!version || version.status !== 'approved') throw new HttpError(409, 'A exportação requer uma versão aprovada.');
      const source = await research(brief.research_id);
      const selected = (await pool.query('SELECT data FROM content_opportunity_revisions WHERE opportunity_id=$1 AND revision=$2', [brief.opportunity_id, brief.opportunity_revision])).rows[0];
      send(200, { filename: `briefing-${brief.id}-v${version.version}.md`, markdown: briefMarkdown(brief, version, source.data, selected.data) }); return true;
    }
    throw new HttpError(404, 'Operação editorial não encontrada.');
  }
  async function tick() {
    if (running || stopping) return running;
    running = processNext().finally(() => { running = null; });
    return running;
  }
  async function processNext() {
    const client = await pool.connect(); let locked = false;
    try {
      locked = (await client.query('SELECT pg_try_advisory_lock(741309229) AS locked')).rows[0].locked;
      if (!locked) return;
      // Só o detentor do lock pode executar uma chamada. Após queda, não repetir consumo incerto.
      await client.query("UPDATE content_jobs SET status='unknown',error_code='worker_interrupted',error_message='Processamento interrompido; consumo não confirmado. Não haverá repetição automática.',finished_at=clock_timestamp() WHERE status='running'");
      const job = (await client.query("UPDATE content_jobs SET status='running',started_at=clock_timestamp() WHERE id=(SELECT id FROM content_jobs WHERE status='queued' ORDER BY created_at,id LIMIT 1) RETURNING *")).rows[0];
      if (!job) return;
      let generated, inTransaction = false;
      try {
        generated = await provider.generate(job.action, job.input, abort.signal);
        let result;
        await client.query('BEGIN');
        inTransaction = true;
        if (job.action === 'opportunities') {
          object(generated.data, ['opportunities']);
          if (!Array.isArray(generated.data.opportunities) || !generated.data.opportunities.length || generated.data.opportunities.length > 3) throw new HttpError(400, 'A IA deve retornar de 1 a 3 oportunidades.');
          const items = generated.data.opportunities.map(raw => ({ id: randomUUID(), data: validateOpportunity(raw, job.input.research, { ai: true }) }));
          for (const item of items) {
            await client.query('INSERT INTO content_opportunities(id,research_id,job_id) VALUES($1,$2,$3)', [item.id, job.research_id, job.id]);
            await client.query("INSERT INTO content_opportunity_revisions(opportunity_id,revision,data,author_type) VALUES($1,1,$2,'ai')", [item.id, JSON.stringify(item.data)]);
          }
          result = { opportunity_ids: items.map(x => x.id) };
        } else {
          const data = validateBrief(generated.data, job.input.research, job.input.opportunity.data);
          const briefId = randomUUID();
          await client.query('INSERT INTO content_briefs(id,research_id,opportunity_id,opportunity_revision,job_id) VALUES($1,$2,$3,$4,$5)', [briefId, job.research_id, job.input.opportunity.id, job.input.opportunity.revision, job.id]);
          await client.query('INSERT INTO content_brief_versions(brief_id,version,data,created_by) VALUES($1,1,$2,$3)', [briefId, JSON.stringify(data), job.created_by]);
          result = { brief_id: briefId };
        }
        await client.query("UPDATE content_jobs SET status='completed',result=$2,usage=$3,model=$4,provider_request_id=$5,finished_at=clock_timestamp() WHERE id=$1", [job.id, JSON.stringify(result), JSON.stringify(generated.usage || null), generated.model || job.model, generated.request_id || null]);
        await client.query('COMMIT');
        inTransaction = false;
      } catch (error) {
        if (inTransaction) await client.query('ROLLBACK');
        const unknown = error.code === 'provider_unknown';
        const knownProviderError = typeof error.code === 'string' && /^(anthropic_http_\d+|incomplete_output|invalid_output|provider_unknown)$/.test(error.code);
        await client.query('UPDATE content_jobs SET status=$2,error_code=$3,error_message=$4,usage=$5,provider_request_id=$6,finished_at=clock_timestamp() WHERE id=$1', [job.id, unknown ? 'unknown' : 'failed', knownProviderError ? error.code : 'invalid_result', knownProviderError ? error.message : 'Resultado não passou pela validação; nenhuma oportunidade ou versão foi publicada. Não haverá repetição automática.', JSON.stringify(generated?.usage || error.usage || null), generated?.request_id || error.request_id || null]);
      }
    } finally { if (locked) await client.query('SELECT pg_advisory_unlock(741309229)'); client.release(); }
  }
  return {
    handle, tick,
    start() { timer = setInterval(() => tick().catch(() => console.error('CONTENT_WORKER_ERROR')), 1500); timer.unref(); },
    async stop() { stopping = true; clearInterval(timer); abort.abort(); if (running) await running; }
  };
}
