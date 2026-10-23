import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {validateSearch,collectSignals,selectedResearch} from '../backend/search-contract.mjs';
import {serpapiProvider} from '../backend/serpapi.mjs';
import {serperProvider} from '../backend/serper.mjs';
import {searchProvider} from '../backend/search-provider.mjs';
import {validateResearch} from '../backend/content-contract.mjs';
import {createApi} from '../backend/server.mjs';
import {migrate} from '../backend/db.mjs';
import {passwordHash} from '../backend/auth.mjs';
import {researchInput,opportunityFixture,briefFixture} from './content-fixtures.mjs';
import {searchInput,fakeSearchProvider} from './search-fixtures.mjs';

test('plano de coleta tem limites, contexto e exclusões explícitos',()=>{
  const input=searchInput(),plan=validateSearch(input);assert.equal(plan.country,'br');assert.equal(plan.platform,'Google Autocomplete');
  assert.throws(()=>validateSearch({...input,queries:Array(9).fill('termo')}),/quantidade/);
  assert.throws(()=>validateSearch({...input,queries:['Service Desk','service  desk']}),/repetidas/);
  assert.throws(()=>validateSearch({...input,country:'invalid'}),/País/);
});
test('mapa preserva ocorrências, originais e negação; contagem não vira volume',()=>{
  const queries=[{id:randomUUID(),query_text:'termo',status:'completed',result:[{text:'Como reduzir falhas?'},{text:'Como não reduzir falhas?'},{text:'service desk vagas'}],finished_at:new Date()},{id:randomUUID(),query_text:'outro',status:'completed',result:[{text:'COMO  reduzir falhas?'}],finished_at:new Date()}];
  const signals=collectSignals(queries,['vagas']);assert.equal(signals.length,3);assert.equal(signals[0].occurrences.length,2);assert.equal(signals[0].occurrences[1].original,'COMO  reduzir falhas?');assert.notEqual(signals[0].id,signals[1].id);assert.equal(signals[0].metrics.volume.value,null);assert.equal(signals[2].disposition,'excluded');
  const run={id:randomUUID(),latest_revision:1,status:'completed',data:validateSearch(searchInput())};
  assert.throws(()=>selectedResearch(run,signals,[signals[2].id],randomUUID()),/excluída/);
  const snapshot=selectedResearch(run,signals,[signals[0].id],randomUUID());assert.equal(snapshot.signals[0].id,signals[0].id);assert.equal(snapshot.signals[0].kind,'collected_autocomplete');assert.equal(snapshot.search_origin.run_id,run.id);assert.equal(snapshot.signals[0].collection.query_ids.length,2);
});
test('SerpAPI usa endpoint fixo e não propaga chave nem corpo de erro',async()=>{
  const key='fictitious-serpapi-key-for-tests';let calls=0;
  const provider=serpapiProvider({key,fetchImpl:async(url,options)=>{calls++;assert.equal(url.origin,'https://serpapi.com');assert.equal(url.searchParams.get('api_key'),key);assert.equal(url.searchParams.get('engine'),'google_autocomplete');assert.equal(url.searchParams.get('gl'),'br');assert.equal(options.redirect,'error');return new Response(JSON.stringify({search_metadata:{id:'provider-test',status:'Success'},suggestions:[{value:'Como reduzir incidentes?'}]}));}});
  const result=await provider.autocomplete('incidentes',{country:'br',language:'pt'});assert.equal(calls,1);assert.equal(result.items[0].text,'Como reduzir incidentes?');assert.ok(!JSON.stringify(result).includes(key));
  const empty=serpapiProvider({key,fetchImpl:async()=>new Response(JSON.stringify({search_metadata:{status:'Success'},suggestions:[]}))});assert.deepEqual((await empty.autocomplete('termo',{country:'br',language:'pt'})).items,[]);
  for(const response of [new Response(key,{status:401}),new Response(JSON.stringify({error:key,search_metadata:{status:'Error'}})),new Response(JSON.stringify({search_metadata:{status:'Success'},suggestions:'invalid'}))]){
    const bad=serpapiProvider({key,fetchImpl:async()=>response});await assert.rejects(()=>bad.autocomplete('termo',{country:'br',language:'pt'}),error=>!error.message.includes(key)&&/^search_/.test(error.code));
  }
  const offline=serpapiProvider({key,fetchImpl:async()=>{throw new TypeError('Network '+key);}});await assert.rejects(()=>offline.autocomplete('termo',{country:'br',language:'pt'}),error=>error.code==='search_unknown'&&!error.message.includes(key));
});
test('Serper envia chave somente no header e preserva falha, vazio e metadados ausentes',async()=>{
  const key='fictitious-serper-key-1234567890';let calls=0;
  const provider=serperProvider({key,fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://google.serper.dev/autocomplete');assert.ok(!url.includes(key));assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.headers['X-API-KEY'],key);
    assert.deepEqual(JSON.parse(options.body),{q:'service desk',gl:'br',hl:'pt'});
    return new Response(JSON.stringify({suggestions:[{value:' service desk preço '}],credits:1}));
  }});
  const result=await provider.autocomplete('service desk',{country:'br',language:'pt'});assert.equal(calls,1);assert.deepEqual(result,{items:[{text:'service desk preço'}],provider_id:null,provider_created_at:null});assert.ok(!JSON.stringify(result).includes(key));
  const source=data=>serperProvider({key,fetchImpl:async()=>new Response(JSON.stringify(data))});
  assert.deepEqual((await source({suggestions:[]}).autocomplete('termo',{country:'br',language:'pt'})).items,[]);
  for(const data of [{},{suggestions:'invalid'},{suggestions:[{value:''}]},{message:key},{error:key}])await assert.rejects(()=>source(data).autocomplete('termo',{country:'br',language:'pt'}),e=>/^search_/.test(e.code)&&!e.message.includes(key));
  const unauthorized=serperProvider({key,fetchImpl:async()=>new Response(key,{status:401})});await assert.rejects(()=>unauthorized.autocomplete('termo',{country:'br',language:'pt'}),e=>e.code==='search_http_401'&&!e.message.includes(key));
  const unknown=serperProvider({key,fetchImpl:async()=>{throw new Error(key);}});await assert.rejects(()=>unknown.autocomplete('termo',{country:'br',language:'pt'}),e=>e.code==='search_unknown'&&!e.message.includes(key));
});
test('seleção de fonte é explícita, preserva instalação SerpAPI e não confunde credenciais',()=>{
  assert.equal(searchProvider({env:{}}).name,'Serper');assert.equal(searchProvider({env:{}}).enabled,false);
  assert.equal(searchProvider({env:{SERPAPI_API_KEY:'old-fictitious'}}).name,'SerpAPI');
  assert.equal(searchProvider({env:{SERPER_API_KEY:'new-fictitious',SERPAPI_API_KEY:'old-fictitious'}}).name,'Serper');
  assert.equal(searchProvider({env:{SEARCH_PROVIDER:'serper',SERPAPI_API_KEY:'old-fictitious'}}).enabled,false);
  assert.equal(searchProvider({env:{SEARCH_PROVIDER:'serpapi',SERPER_API_KEY:'new-fictitious'}}).enabled,false);
  assert.throws(()=>searchProvider({env:{SEARCH_PROVIDER:'invalid'}}),/SEARCH_PROVIDER/);
});
test('PostgreSQL: coleta, revisão, seleção editorial, rastreabilidade, falha parcial e limite', {skip:!process.env.TEST_DATABASE_URL},async t=>{
  const admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL}),schema='search_'+randomUUID().replaceAll('-','');await admin.query(`CREATE SCHEMA ${schema}`);
  const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${schema}`,max:4});let server,calls=0;
  t.after(async()=>{if(server){await Promise.all([server.content.stop(),server.discovery.stop()]);await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
  await pool.query(await readFile(new URL('../backend/migrations/001_initial.sql',import.meta.url),'utf8'));await pool.query(await readFile(new URL('../backend/migrations/002_content.sql',import.meta.url),'utf8'));
  await pool.query('CREATE TABLE schema_migrations(version integer PRIMARY KEY,applied_at timestamptz DEFAULT clock_timestamp())');await pool.query('INSERT INTO schema_migrations(version) VALUES(1),(2)');
  const userId=randomUUID();await pool.query('INSERT INTO app_users(id,login,display_name,password_hash) VALUES($1,$2,$3,$4)',[userId,'pesquisa','Pesquisador fictício',await passwordHash('senha-ficticia-1234')]);
  const old=researchInput(),legacyId=randomUUID();await pool.query('INSERT INTO content_researches(id,request_id,payload_hash,created_by,data) VALUES($1,$2,$3,$4,$5)',[legacyId,old.request_id,'legacy',userId,JSON.stringify(validateResearch(old))]);
  await migrate(pool);await migrate(pool);assert.equal((await pool.query('SELECT id FROM content_researches WHERE id=$1',[legacyId])).rowCount,1);
  const provider=fakeSearchProvider(()=>calls++);
  server=await createApi({pool,origins:['https://test.example'],searchProvider:provider,searchMonthlyLimit:10,searchHourlyLimit:10,contentProvider:{enabled:true,model:'fictitious-model',generate:async(action,input)=>({data:action==='opportunities'?{opportunities:[opportunityFixture(input.research)]}:briefFixture(input)})}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;let token='';
  const call=(path,method='GET',body)=>fetch(base+path,{method,headers:{Origin:'https://test.example',...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  assert.equal((await call('/v1/search/config')).status,401);token=(await(await call('/v1/sessions','POST',{login:'pesquisa',password:'senha-ficticia-1234'})).json()).token;
  const input=searchInput();let response=await call('/v1/search/runs','POST',input);assert.equal(response.status,202);const runId=(await response.json()).id;
  assert.equal((await call('/v1/search/runs','POST',input)).status,200);assert.equal(calls,0);assert.equal((await call('/v1/search/runs','POST',{...input,seed:'outro termo'})).status,409);
  for(let i=0;i<3;i++)await server.discovery.tick();assert.equal(calls,3);
  let data=await(await call(`/v1/search/runs/${runId}`)).json();assert.equal(data.run.status,'completed');assert.equal(data.signals.length,4);assert.equal(data.occurrences,5);assert.equal(data.queries[2].status,'empty');
  const how=data.signals.find(s=>s.text==='Como reduzir chamados?'),excluded=data.signals.find(s=>s.disposition==='excluded');
  response=await call(`/v1/search/runs/${runId}/reviews`,'POST',{expected_revision:1,signal_id:how.id,group:'Reduzir recorrência',disposition:'keep',reason:'Pergunta compatível com a oferta de suporte.'});assert.equal(response.status,200);data=await response.json();assert.equal(data.run.latest_revision,2);
  assert.equal((await call(`/v1/search/runs/${runId}/reviews`,'POST',{expected_revision:1,signal_id:how.id,group:'Grupo antigo',disposition:'keep',reason:'Revisão antiga'})).status,409);
  assert.equal((await call(`/v1/search/runs/${runId}/editorial`,'POST',{request_id:randomUUID(),expected_revision:2,signal_ids:[excluded.id]})).status,400);
  const selection={request_id:randomUUID(),expected_revision:2,signal_ids:[how.id]};response=await call(`/v1/search/runs/${runId}/editorial`,'POST',selection);assert.equal(response.status,201);const researchId=(await response.json()).research_id;
  assert.equal((await call(`/v1/search/runs/${runId}/editorial`,'POST',selection)).status,200);
  const editorial=await(await call(`/v1/content/researches/${researchId}`)).json();assert.equal(editorial.item.data.signals[0].collection.run_id,runId);assert.equal(editorial.item.data.signals[0].id,how.id);assert.equal(editorial.item.data.signals[0].metrics.cpc.value,null);
  const job=await(await call('/v1/content/jobs','POST',{request_id:randomUUID(),research_id:researchId,action:'opportunities'})).json();await server.content.tick();const done=await(await call(`/v1/content/jobs/${job.job.id}`)).json();assert.equal(done.job.status,'completed');
  const generated=await(await call(`/v1/content/researches/${researchId}`)).json();assert.equal(generated.opportunities[0].data.evidence_quality.verification,'collected_from_provider');
  provider.name='Serper';
  const partialInput={...searchInput(),queries:['service desk','fail','not executed']};const partial=(await(await call('/v1/search/runs','POST',partialInput)).json()).id;await server.discovery.tick();await server.discovery.tick();
  const partialData=await(await call(`/v1/search/runs/${partial}`)).json();assert.equal(partialData.run.status,'partial');assert.equal(partialData.queries[2].status,'skipped');assert.equal(calls,5);
  const comparison=await(await call(`/v1/search/runs/${partial}/comparison`)).json();assert.equal(comparison.previous_id,runId);assert.equal(comparison.different_plan,true);
  assert.equal(comparison.different_provider,true);assert.equal(partialData.run.data.provider,'Serper');
  const newerExport=await(await call(`/v1/search/runs/${partial}/editorial`,'POST',{request_id:randomUUID(),expected_revision:1,signal_ids:[partialData.signals[0].id]})).json();
  const newer=await(await call(`/v1/content/researches/${newerExport.research_id}`)).json();assert.equal(newer.item.data.search_origin.provider,'Serper');assert.equal(newer.item.data.signals[0].collection.provider,'Serper');assert.equal(newer.item.data.signals[0].source,'Google Autocomplete via Serper');
  assert.equal((await(await call(`/v1/content/researches/${researchId}`)).json()).item.data.search_origin.provider,'SerpAPI');
  const interrupted=(await(await call('/v1/search/runs','POST',{...searchInput(),queries:['one','two']})).json()).id;
  await pool.query("UPDATE search_queries SET status='running' WHERE run_id=$1 AND position=0",[interrupted]);await server.discovery.tick();const recovered=await(await call(`/v1/search/runs/${interrupted}`)).json();assert.equal(recovered.run.status,'unknown');assert.equal(calls,5);
  const changed=(await(await call('/v1/search/runs','POST',{...searchInput(),queries:['change','not executed']})).json()).id;
  provider.name='SerpAPI';await server.discovery.tick();const stopped=await(await call(`/v1/search/runs/${changed}`)).json();assert.equal(stopped.run.data.provider,'Serper');assert.equal(stopped.run.status,'failed');assert.equal(stopped.queries[0].error_code,'search_provider_changed');assert.equal(stopped.queries[1].status,'skipped');assert.equal(calls,5);
  assert.equal((await call('/v1/search/runs','POST',{...searchInput(),queries:['over limit']})).status,429);
  assert.equal((await(await call('/v1/search/config')).json()).reserved.month,10);
});
