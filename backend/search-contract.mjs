import { createHash } from 'node:crypto';
import { HttpError, text } from './validation.mjs';
import { object, id, strings, validateResearch } from './content-contract.mjs';

export const normalize = value => value.normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
export const DEFAULT_GROUPS = ['Como fazer', 'Definição', 'Motivos e causas', 'Preço e contratação', 'Comparações', 'Problemas', 'Local e momento', 'Termos relacionados'];
export const signature = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function validateSearch(input,{provider='SerpAPI'}={}) {
  if(!['SerpAPI','Serper'].includes(provider))throw new HttpError(503,'Provedor de pesquisa não configurado.');
  object(input, ['request_id','context','theme','profile','seed','queries','exclusions','country','language']);
  const editorial = validateResearch({request_id:input.request_id,context:input.context,theme:input.theme,profile:input.profile,signals:[],allow_hypothesis:true});
  const seed = text(input.seed,'Termo inicial',2,100);
  const queries = strings(input.queries,'Consultas',8,1,180);
  if (new Set(queries.map(normalize)).size !== queries.length) throw new HttpError(400,'Remova consultas repetidas do plano.');
  const exclusions = strings(input.exclusions,'Exclusões',20,0,60);
  if (!['br','us','pt','es','mx'].includes(input.country) || !['pt','en','es'].includes(input.language)) throw new HttpError(400,'País ou idioma de pesquisa inválido.');
  return {context:editorial.context,theme:editorial.theme,profile:editorial.profile,seed,seed_normalized:normalize(seed),queries,exclusions,country:input.country,language:input.language,provider,platform:'Google Autocomplete',...(provider==='SerpAPI'?{client:'chrome'}:{}),schema_version:'search.run.v1'};
}
export function initialClassification(value, exclusions=[]) {
  const clean = normalize(value);
  const plain = s => ' '+normalize(s).replace(/[^\p{L}\p{N}]+/gu,' ')+' ';
  const excluded = exclusions.find(term => plain(value).includes(plain(term)));
  let group = 'Termos relacionados', rule = 'Sem padrão linguístico específico; revisão de contexto necessária.';
  for (const [pattern,label,reason] of [
    [/\b(vs|versus)\b|\bou\b|diferen[çc]a|compar/iu,'Comparações','Expressão contém comparação ou alternativas.'],
    [/pre[çc]o|custo|or[çc]amento|contrat|quanto custa/iu,'Preço e contratação','Expressão contém preço, custo ou contratação.'],
    [/problema|erro|falha|incidente|n[aã]o funciona/iu,'Problemas','Expressão contém um problema ou falha.'],
    [/^como\b|\bcomo\b/iu,'Como fazer','Expressão contém uma pergunta de procedimento.'],
    [/o que|significa|defini[çc][aã]o/iu,'Definição','Expressão contém uma pergunta de definição.'],
    [/por que|porque|motivo|causa/iu,'Motivos e causas','Expressão contém pergunta de motivo ou causa.'],
    [/onde|quando|perto de/iu,'Local e momento','Expressão contém local ou momento.']
  ]) if (pattern.test(clean)) {group=label;rule=reason;break;}
  return {group,disposition:excluded?'excluded':'review',reason:excluded?`Exclusão pelo termo informado: ${excluded}`:rule,author_type:'rule'};
}
export function collectSignals(queries, exclusions=[], reviews={}) {
  const map = new Map();
  for (const query of queries) {
    if (!['completed','empty'].includes(query.status)) continue;
    for (const [index,item] of (query.result || []).entries()) {
      const normalized = normalize(item.text);
      const signalId = 'sig_'+signature(normalized).slice(0,24);
      let signal = map.get(normalized);
      if (!signal) {
        signal = {id:signalId,text:item.text,normalized,occurrences:[],metrics:{volume:{value:null,status:'unavailable'},cpc:{value:null,status:'unavailable'}},...initialClassification(item.text,exclusions)};
        map.set(normalized,signal);
      }
      signal.occurrences.push({query_id:query.id,query:query.query_text,original:item.text,position:index+1,provider_id:query.provider_id,collected_at:query.finished_at,provider_created_at:query.provider_created_at});
    }
  }
  for (const signal of map.values()) if (reviews[signal.id]) Object.assign(signal,reviews[signal.id],{author_type:'human'});
  return [...map.values()];
}
export function reviewSignal(input, signals) {
  object(input,['expected_revision','signal_id','group','disposition','reason']);
  if (!Number.isInteger(input.expected_revision) || input.expected_revision < 1) throw new HttpError(400,'Revisão inválida.');
  if (!signals.some(s=>s.id===input.signal_id)) throw new HttpError(400,'Expressão não pertence à coleta.');
  if (!['keep','review','excluded'].includes(input.disposition)) throw new HttpError(400,'Estado de revisão inválido.');
  return {group:text(input.group,'Grupo',2,80),disposition:input.disposition,reason:text(input.reason,'Justificativa',3,500)};
}
export function selectedResearch(run, signals, selectedIds, requestId) {
  id(requestId);
  if (!Array.isArray(selectedIds) || selectedIds.length < 1 || selectedIds.length > 80 || new Set(selectedIds).size !== selectedIds.length) throw new HttpError(400,'Selecione de 1 a 80 expressões, sem repetição. A coleta completa permanece salva.');
  const selected = selectedIds.map(value=>signals.find(s=>s.id===value));
  if (selected.some(s=>!s || s.disposition==='excluded')) throw new HttpError(400,'Há expressão inexistente ou excluída na seleção.');
  const provider=run.data.provider;
  const snapshot = validateResearch({request_id:requestId,context:run.data.context,theme:run.data.theme,profile:run.data.profile,allow_hypothesis:false,signals:selected.map(s=>({text:s.text,source:'Google Autocomplete via '+provider,url:'https://www.google.com/search?'+new URLSearchParams({q:s.text,gl:run.data.country,hl:run.data.language}),collected_at:new Date(s.occurrences[0].collected_at).toISOString().slice(0,10)}))});
  snapshot.signals.forEach((item,index)=>{
    const original=selected[index];
    Object.assign(item,{id:original.id,kind:'collected_autocomplete',duplicate_of:null,classification:{group:original.group,disposition:original.disposition,reason:original.reason,author_type:original.author_type},collection:{run_id:run.id,query_ids:[...new Set(original.occurrences.map(o=>o.query_id))],provider,platform:'Google Autocomplete',country:run.data.country,language:run.data.language,collected_at:original.occurrences[0].collected_at}});
  });
  snapshot.schema_version='content.research.v2';
  snapshot.search_origin={run_id:run.id,revision:run.latest_revision,status:run.status,provider,platform:'Google Autocomplete',country:run.data.country,language:run.data.language};
  if (Buffer.byteLength(JSON.stringify(snapshot))>100000) throw new HttpError(400,'Seleção muito extensa. Escolha menos expressões; nenhum resultado foi descartado.');
  return snapshot;
}
