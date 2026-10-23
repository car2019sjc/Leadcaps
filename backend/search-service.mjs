import { randomUUID } from 'node:crypto';
import { HttpError } from './validation.mjs';
import { id, object } from './content-contract.mjs';
import { validateSearch, collectSignals, reviewSignal, selectedResearch, signature, normalize } from './search-contract.mjs';
import { searchProvider } from './search-provider.mjs';

const limit=(value,fallback,max)=>Number.isInteger(value)&&value>=1&&value<=max?value:fallback;
const queryFields='id,run_id,position,query_text,status,started_at,finished_at,result,provider_id,provider_created_at,error_code,error_message';
export function createSearchService({pool,provider=searchProvider(),monthlyLimit=200,hourlyLimit=40}) {
  monthlyLimit=limit(monthlyLimit,200,10000);hourlyLimit=limit(hourlyLimit,40,1000);
  let timer,running,stopping=false;
  const abort=new AbortController();
  async function transaction(work) {
    const client=await pool.connect();
    try {await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}
    catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async function counters(client=pool) {
    return (await client.query("SELECT count(*) FILTER(WHERE created_at>=date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::integer AS month,count(*) FILTER(WHERE created_at>=clock_timestamp()-interval '1 hour')::integer AS hour FROM search_queries WHERE created_at>=LEAST(date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',clock_timestamp()-interval '1 hour')")).rows[0];
  }
  async function detail(runId,client=pool) {
    const run=(await client.query('SELECT id,data,status,created_at,finished_at,latest_revision FROM search_runs WHERE id=$1',[id(runId)])).rows[0];
    if(!run)throw new HttpError(404,'Coleta não encontrada.');
    const queries=(await client.query(`SELECT ${queryFields} FROM search_queries WHERE run_id=$1 ORDER BY position`,[runId])).rows;
    const revision=(await client.query('SELECT reviews FROM search_run_revisions WHERE run_id=$1 AND revision=$2',[runId,run.latest_revision])).rows[0];
    const signals=collectSignals(queries,run.data.exclusions,revision?.reviews||{});
    const exports=(await client.query('SELECT research_id,revision,created_at FROM search_exports WHERE run_id=$1 ORDER BY created_at DESC',[runId])).rows;
    return {run,queries,signals,exports,groups:[...new Set(signals.map(s=>s.group))],occurrences:signals.reduce((n,s)=>n+s.occurrences.length,0)};
  }
  async function create(input,user) {
    const data=validateSearch(input,{provider:provider.name}),digest=signature(data);
    return transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(741309232)');
      const existing=(await client.query('SELECT id,payload_hash FROM search_runs WHERE created_by=$1 AND request_id=$2',[user.id,input.request_id])).rows[0];
      if(existing){if(existing.payload_hash!==digest)throw new HttpError(409,'Solicitação já usada para outro plano de pesquisa.');return {id:existing.id,reused:true};}
      if(!provider.enabled)throw new HttpError(503,'Configure o provedor de pesquisa na VPS para pesquisar automaticamente.');
      const counts=await counters(client);
      if(counts.month+data.queries.length>monthlyLimit || counts.hour+data.queries.length>hourlyLimit)throw new HttpError(429,'O plano excede o limite de consultas reservado no Leadcaps. Reduza as consultas ou aguarde a renovação do limite.');
      if((await client.query("SELECT count(*)::integer AS n FROM search_runs WHERE status IN ('queued','running')")).rows[0].n>=4)throw new HttpError(429,'Há coletas aguardando. Aguarde a conclusão.');
      if(data.profile?.base_id && !(await client.query('SELECT id FROM lead_imports WHERE id=$1',[data.profile.base_id])).rowCount)throw new HttpError(400,'Base do perfil não encontrada.');
      const runId=randomUUID();
      await client.query("INSERT INTO search_runs(id,request_id,payload_hash,created_by,status,data) VALUES($1,$2,$3,$4,'queued',$5)",[runId,input.request_id,digest,user.id,JSON.stringify(data)]);
      await client.query("INSERT INTO search_run_revisions(run_id,revision,reviews,created_by) VALUES($1,1,'{}',$2)",[runId,user.id]);
      for(const [position,query] of data.queries.entries())await client.query("INSERT INTO search_queries(id,run_id,position,query_text,status) VALUES($1,$2,$3,$4,'queued')",[randomUUID(),runId,position,query]);
      return {id:runId,reused:false};
    });
  }
  async function finalize(client) {
    await client.query(`UPDATE search_runs r SET status=CASE
      WHEN EXISTS(SELECT 1 FROM search_queries q WHERE q.run_id=r.id AND q.status IN ('completed','empty'))
        THEN CASE WHEN EXISTS(SELECT 1 FROM search_queries q WHERE q.run_id=r.id AND q.status IN ('failed','unknown','skipped')) THEN 'partial' ELSE 'completed' END
      WHEN EXISTS(SELECT 1 FROM search_queries q WHERE q.run_id=r.id AND q.status='unknown') THEN 'unknown' ELSE 'failed' END,
      finished_at=clock_timestamp()
      WHERE r.status IN ('queued','running') AND NOT EXISTS(SELECT 1 FROM search_queries q WHERE q.run_id=r.id AND q.status IN ('queued','running'))`);
  }
  async function processNext() {
    const client=await pool.connect();let locked=false;
    try {
      locked=(await client.query('SELECT pg_try_advisory_lock(741309233) AS locked')).rows[0].locked;
      if(!locked)return;
      const interrupted=await client.query("UPDATE search_queries SET status='unknown',error_code='search_unknown',error_message='Consulta interrompida; consumo incerto. Não haverá repetição automática.',finished_at=clock_timestamp() WHERE status='running' RETURNING run_id");
      for(const runId of new Set(interrupted.rows.map(r=>r.run_id)))await client.query("UPDATE search_queries SET status='skipped',error_code='run_interrupted',error_message='Plano interrompido após consulta de consumo incerto.',finished_at=clock_timestamp() WHERE run_id=$1 AND status='queued'",[runId]);
      await finalize(client);
      const next=(await client.query("SELECT q.id,q.run_id,q.query_text,r.data FROM search_queries q JOIN search_runs r ON r.id=q.run_id WHERE q.status='queued' AND r.status IN ('queued','running') ORDER BY q.created_at,q.run_id,q.position LIMIT 1")).rows[0];
      if(!next)return;
      await client.query("UPDATE search_queries SET status='running',started_at=clock_timestamp() WHERE id=$1",[next.id]);
      await client.query("UPDATE search_runs SET status='running' WHERE id=$1",[next.run_id]);
      try {
        if(!provider.enabled)throw Object.assign(new Error(),{code:'search_disabled'});
        if(next.data.provider!==provider.name)throw Object.assign(new Error(),{code:'search_provider_changed'});
        const result=await provider.autocomplete(next.query_text,next.data,abort.signal);
        await client.query("UPDATE search_queries SET status=$2,result=$3,provider_id=$4,provider_created_at=$5,finished_at=clock_timestamp() WHERE id=$1",[next.id,result.items.length?'completed':'empty',JSON.stringify(result.items),result.provider_id,result.provider_created_at]);
      }catch(error){
        const code=/^search_(http_\d+|invalid|unknown|provider_error|provider_changed|disabled)$/.test(error.code||'')?error.code:'search_invalid';
        const uncertain=code==='search_unknown';
        const message=uncertain?'Consulta interrompida; consumo incerto. Não haverá repetição automática.':code==='search_provider_changed'?'O provedor configurado mudou. O plano foi interrompido para preservar sua origem; crie uma nova coleta.':code==='search_http_429'?'Limite da fonte atingido. O restante do plano foi interrompido.':'A consulta falhou. Confira configuração, cota e parâmetros; o restante do plano foi interrompido.';
        await client.query("UPDATE search_queries SET status=$2,error_code=$3,error_message=$4,finished_at=clock_timestamp() WHERE id=$1",[next.id,uncertain?'unknown':'failed',code,message]);
        await client.query("UPDATE search_queries SET status='skipped',error_code='plan_stopped',error_message='Consulta não executada após falha no plano.',finished_at=clock_timestamp() WHERE run_id=$1 AND status='queued'",[next.run_id]);
      }
      await finalize(client);
    }finally{if(locked)await client.query('SELECT pg_advisory_unlock(741309233)');client.release();}
  }
  async function tick(){if(running||stopping)return running;running=processNext().finally(()=>{running=null;});return running;}
  async function handle(req,url,user,readJson,send) {
    if(!url.pathname.startsWith('/v1/search/'))return false;
    const path=url.pathname.slice('/v1/search/'.length);
    if(path==='config'&&req.method==='GET') {
      send(200,{enabled:provider.enabled,provider:provider.name,platform:'Google Autocomplete',max_queries:8,monthly_limit:monthlyLimit,hourly_limit:hourlyLimit,reserved:await counters(),metrics_available:false});return true;
    }
    if(path==='runs'&&req.method==='POST'){const result=await create(await readJson(req),user);send(result.reused?200:202,result);return true;}
    if(path==='runs'&&req.method==='GET') {
      const offset=Number(url.searchParams.get('offset')||0);
      if(!Number.isInteger(offset)||offset<0||offset>100000)throw new HttpError(400,'Página inválida.');
      const {rows}=await pool.query("SELECT r.id,r.created_at,r.status,r.data->>'seed' AS seed,r.data->>'country' AS country,r.data->>'language' AS language,r.data->>'provider' AS provider,u.display_name AS author FROM search_runs r JOIN app_users u ON u.id=r.created_by ORDER BY r.created_at DESC,r.id DESC LIMIT 21 OFFSET $1",[offset]);
      send(200,{items:rows.slice(0,20),next_offset:rows.length>20?offset+20:null});return true;
    }
    const match=/^runs\/([^/]+)(?:\/(reviews|editorial|comparison))?$/.exec(path);
    if(!match)throw new HttpError(404,'Operação de pesquisa não encontrada.');
    const [,runId,operation]=match;id(runId);
    if(req.method==='GET'&&!operation){send(200,await detail(runId));return true;}
    if(req.method==='GET'&&operation==='comparison') {
      const current=await detail(runId);
      if(['queued','running'].includes(current.run.status))throw new HttpError(409,'Aguarde a conclusão da coleta para comparar.');
      const previous=(await pool.query("SELECT id FROM search_runs WHERE id<>$1 AND created_at<=$2 AND data->>'country'=$3 AND data->>'language'=$4 AND data->>'seed_normalized'=$5 AND status IN ('completed','partial') ORDER BY created_at DESC,id DESC LIMIT 1",[runId,current.run.created_at,current.run.data.country,current.run.data.language,normalize(current.run.data.seed)])).rows[0];
      const older=previous?await detail(previous.id):null;
      if(!older)throw new HttpError(404,'Ainda não há outra coleta anterior desse termo, país e idioma.');
      const a=new Map(current.signals.map(s=>[s.normalized,s.text])),b=new Map(older.signals.map(s=>[s.normalized,s.text]));
      send(200,{previous_id:older.run.id,previous_provider:older.run.data.provider,current_provider:current.run.data.provider,different_provider:older.run.data.provider!==current.run.data.provider,previous_at:older.run.created_at,current_at:current.run.created_at,different_plan:signature(current.run.data.queries)!==signature(older.run.data.queries),added:[...a].filter(([key])=>!b.has(key)).map(([,v])=>v),absent:[...b].filter(([key])=>!a.has(key)).map(([,v])=>v),shared:[...a.keys()].filter(key=>b.has(key)).length});return true;
    }
    if(req.method==='POST'&&operation==='reviews') {
      const input=await readJson(req);
      const result=await transaction(async client=>{
        await client.query('SELECT id FROM search_runs WHERE id=$1 FOR UPDATE',[runId]);
        const data=await detail(runId,client);
        if(['queued','running'].includes(data.run.status))throw new HttpError(409,'Aguarde a coleta antes de revisar os grupos.');
        if(data.run.latest_revision!==input.expected_revision)throw new HttpError(409,'Outra revisão foi salva. Atualize a coleta.');
        const review=reviewSignal(input,data.signals);
        const current=(await client.query('SELECT reviews FROM search_run_revisions WHERE run_id=$1 AND revision=$2',[runId,data.run.latest_revision])).rows[0].reviews;
        const revision=data.run.latest_revision+1;
        await client.query('INSERT INTO search_run_revisions(run_id,revision,reviews,created_by) VALUES($1,$2,$3,$4)',[runId,revision,JSON.stringify({...current,[input.signal_id]:review}),user.id]);
        await client.query('UPDATE search_runs SET latest_revision=$2 WHERE id=$1',[runId,revision]);
        return detail(runId,client);
      });send(200,result);return true;
    }
    if(req.method==='POST'&&operation==='editorial') {
      const input=object(await readJson(req),['request_id','expected_revision','signal_ids']);id(input.request_id);
      const digest=signature(input);
      const result=await transaction(async client=>{
        await client.query('SELECT pg_advisory_xact_lock(741309234)');
        const previous=(await client.query('SELECT research_id,payload_hash,run_id FROM search_exports WHERE created_by=$1 AND request_id=$2',[user.id,input.request_id])).rows[0];
        if(previous){if(previous.payload_hash!==digest||previous.run_id!==runId)throw new HttpError(409,'Solicitação já usada para outra seleção.');return {research_id:previous.research_id,reused:true};}
        await client.query('SELECT id FROM search_runs WHERE id=$1 FOR UPDATE',[runId]);
        const data=await detail(runId,client);
        if(['queued','running'].includes(data.run.status))throw new HttpError(409,'Aguarde a conclusão da coleta.');
        if(data.run.latest_revision!==input.expected_revision)throw new HttpError(409,'Outra revisão foi salva. Atualize a coleta.');
        const snapshot=selectedResearch(data.run,data.signals,input.signal_ids,input.request_id),researchId=randomUUID();
        if((await client.query('SELECT id FROM content_researches WHERE created_by=$1 AND request_id=$2',[user.id,input.request_id])).rowCount)throw new HttpError(409,'Identificador já usado em outra pesquisa editorial.');
        await client.query('INSERT INTO content_researches(id,request_id,payload_hash,created_by,data) VALUES($1,$2,$3,$4,$5)',[researchId,input.request_id,signature(snapshot),user.id,JSON.stringify(snapshot)]);
        await client.query('INSERT INTO search_exports(run_id,research_id,revision,created_by,request_id,payload_hash,signal_ids) VALUES($1,$2,$3,$4,$5,$6,$7)',[runId,researchId,data.run.latest_revision,user.id,input.request_id,digest,JSON.stringify(input.signal_ids)]);
        return {research_id:researchId,reused:false};
      });send(result.reused?200:201,result);return true;
    }
    throw new HttpError(404,'Operação de pesquisa não encontrada.');
  }
  return {handle,tick,start(){timer=setInterval(()=>tick().catch(()=>console.error('SEARCH_WORKER_ERROR')),1000);timer.unref();},async stop(){stopping=true;clearInterval(timer);abort.abort();if(running)await running;}};
}
