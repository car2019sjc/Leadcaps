/* Pesquisa de sinais: fonte externa no servidor; agrupamento inicial por regras, com revisão humana. */
const DS=(()=>{
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lines=value=>value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  const date=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  const names={queued:'Aguardando',running:'Coletando',completed:'Concluída',partial:'Parcial',failed:'Falha',unknown:'Consumo incerto',empty:'Sem sugestões',skipped:'Não executada'};
  let callbacks,config=null,current=null,selected=new Set(),revisionSignal=null,busy=false,epoch=0,timer,page=null,active=false;
  const retries=new Map();
  const note=value=>{$('dsMessage').textContent=value;};
  function reset(){epoch++;clearTimeout(timer);current=null;config=null;selected.clear();retries.clear();busy=false;active=false;revisionSignal=null;$('dsPanel').hidden=true;$('dsEditor').hidden=true;for(const id of ['dsMap','dsRows','dsHistory','dsQueriesResult','dsComparison','dsExports'])$(id).replaceChildren();note('');status();}
  function status(){
    $('dsRun').disabled=!config?.enabled||busy;
    $('dsExport').disabled=busy||!current||['queued','running'].includes(current.run.status)||selected.size<1||selected.size>80;
    $('dsCount').textContent=`${selected.size} expressões selecionadas · máximo 80 para a etapa editorial`;
    $('dsSaveReview').disabled=busy;
    $('dsCompare').disabled=busy||!current||['queued','running'].includes(current.run.status);
  }
  async function perform(work){if(busy)return;const e=epoch;busy=true;status();try{await work(e);}catch(error){if(e===epoch)note(error.message);}finally{if(e===epoch){busy=false;status();}}}
  const alive=e=>e===epoch&&DB.connected();
  function requestBody(key,body){const signature=JSON.stringify(body),old=retries.get(key);if(!old||old.signature!==signature)retries.set(key,{signature,id:crypto.randomUUID()});return {...body,request_id:retries.get(key).id};}
  function plan(){const seed=$('dsSeed').value.trim();if(!seed){note('Informe um termo inicial curto, como service desk.');return;}const words={pt:['como','o que é','preço','ou','problemas'],en:['how','what is','price','vs','problems'],es:['cómo','qué es','precio','o','problemas']}[$('dsLanguage').value];$('dsQueries').value=[seed,`${words[0]} ${seed}`,`${words[1]} ${seed}`,`${seed} ${words[2]}`,`${seed} ${words[3]}`,`${seed} ${words[4]}`].join('\n');note('Plano preparado. Você pode editar as consultas antes da coleta. São termos de consulta, não resultados observados.');}
  async function history(append=false,e=epoch){
    const data=await DB.request('/v1/search/runs'+(append?`?offset=${page}`:''));if(!alive(e))return;
    if(!append)$('dsHistory').replaceChildren();
    for(const item of data.items){const button=document.createElement('button');button.className='ci-history-item';button.innerHTML=`<strong>${esc(item.seed)}</strong><span>${esc(names[item.status])} · ${esc(item.provider)} · ${esc(date(item.created_at))}</span>`;button.onclick=()=>perform(n=>load(item.id,n));$('dsHistory').append(button);}
    if(!append&&!data.items.length)$('dsHistory').textContent='Nenhuma coleta Google salva.';
    page=data.next_offset;$('dsMore').hidden=page===null;
  }
  async function open(){const e=epoch;try{const data=await DB.request('/v1/search/config');if(!alive(e))return;config=data;$('dsRun').textContent=`Pesquisar no Google via ${data.provider}`;$('dsConfig').textContent=data.enabled?`Google Autocomplete via ${data.provider} · ${data.reserved.month}/${data.monthly_limit} consultas reservadas neste mês UTC · ${data.reserved.hour}/${data.hourly_limit} na última hora. Limites do Leadcaps; cota da conta é separada.`:`Configure ${data.provider} na VPS para habilitar a coleta. O fluxo manual continua disponível.`;status();await history(false,e);if(active&&current&&alive(e))await load(current.run.id,e);}catch(error){if(alive(e))$('dsConfig').textContent=error.message;}}
  async function start(){await perform(async e=>{
    if(!$('ciResearchForm').reportValidity())return;
    const inputs=callbacks.inputs();
    const queries=lines($('dsQueries').value);if(!queries.length||queries.length>8)throw Error('Prepare de 1 a 8 consultas. O plano pode consumir uma consulta da fonte por linha.');
    const body=requestBody('run',{...inputs,seed:$('dsSeed').value.trim(),queries,exclusions:lines($('dsExclusions').value),country:$('dsCountry').value,language:$('dsLanguage').value});
    const data=await DB.request('/v1/search/runs',{method:'POST',body});if(!alive(e))return;await history(false,e);await load(data.id,e);await open();if(alive(e))retries.delete('run');
  });}
  async function load(runId,e=epoch){
    clearTimeout(timer);const data=await DB.request(`/v1/search/runs/${runId}`);if(!alive(e))return;
    if(current?.run.id!==data.run.id){selected.clear();$('dsTextFilter').value='';$('dsDisposition').value='all';$('dsGroupFilter').value='';$('dsComparison').replaceChildren();}
    current=data;active=true;for(const value of selected)if(!data.signals.some(s=>s.id===value&&s.disposition!=='excluded'))selected.delete(value);callbacks.showRun();$('dsPanel').hidden=false;$('dsEditor').hidden=true;render();
    if(['queued','running'].includes(data.run.status))schedule(runId,e);
    else await history(false,e);
  }
  function schedule(runId,e){clearTimeout(timer);timer=setTimeout(()=>{if(!alive(e)||!active||!$('contentModule').classList.contains('on'))return;if(busy){schedule(runId,e);return;}perform(n=>load(runId,n));},1800);}
  function visible(){const term=$('dsTextFilter').value.toLocaleLowerCase('pt-BR'),group=$('dsGroupFilter').value,state=$('dsDisposition').value;return current.signals.filter(s=>(!group||s.group===group)&&(state==='all'||s.disposition===state)&&(!term||s.text.toLocaleLowerCase('pt-BR').includes(term)));}
  function render(){
    const data=current,run=data.run;
    $('dsTitle').textContent=run.data.seed;
    $('dsSummary').textContent=`${names[run.status]} · ${run.data.provider} · ${date(run.created_at)} (Brasília) · ${run.data.country.toUpperCase()} / ${run.data.language} · ${data.signals.length} expressões distintas · ${data.occurrences} ocorrências na amostra · revisão ${run.latest_revision}.`;
    const active=['queued','running'].includes(run.status);
    const finished=data.queries.filter(q=>!['queued','running'].includes(q.status)).length;
    $('dsProgress').textContent=active?`Coletando: ${finished}/${data.queries.length} consultas concluídas. Fechar a janela não cancela o plano.`:run.status==='completed'?(data.signals.length?'Coleta concluída. Explore os grupos e escolha as expressões úteis.':'A fonte não retornou sugestões para este plano. Isso não comprova ausência de interesse no mercado.'):'O plano terminou com falha ou incerteza. Consulte os estados abaixo; não houve repetição automática.';
    const group=$('dsGroupFilter').value;
    $('dsGroupFilter').innerHTML='<option value="">Todos os grupos</option>'+data.groups.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
    $('dsGroupFilter').value=data.groups.includes(group)?group:'';
    $('dsMap').innerHTML=data.groups.map(g=>{const items=data.signals.filter(s=>s.group===g);return `<button type="button" class="ds-group${group===g?' selected':''}" data-ds-group="${esc(g)}"><strong>${esc(g)}</strong><span>${items.length} expressões · ${items.filter(s=>s.disposition==='excluded').length} excluídas</span></button>`;}).join('')||'<p>Nenhuma expressão disponível.</p>';
    $('dsMap').querySelectorAll('[data-ds-group]').forEach(b=>b.onclick=()=>{$('dsGroupFilter').value=b.dataset.dsGroup;render();});
    $('dsQueriesResult').innerHTML=data.queries.map(q=>`<li><strong>${esc(q.query_text)}</strong> · ${esc(names[q.status])}${q.provider_id?' · ID da fonte: '+esc(q.provider_id):''}${q.finished_at?' · '+esc(date(q.finished_at)):''}${q.provider_created_at?' · resultado da fonte: '+esc(date(q.provider_created_at)):''}${q.error_message?'<br>'+esc(q.error_message):''}</li>`).join('');
    $('dsExports').innerHTML=data.exports.map(x=>`<button type="button" class="btn" data-ds-research="${x.research_id}">Abrir seleção editorial · revisão ${x.revision}</button>`).join('');
    $('dsExports').querySelectorAll('[data-ds-research]').forEach(b=>b.onclick=()=>callbacks.editorial(b.dataset.dsResearch));
    renderRows();status();
  }
  function renderRows(){
    if(!current)return;
    const items=visible(),active=['queued','running'].includes(current.run.status);
    $('dsVisible').textContent=`${items.length} expressões neste filtro. Contagens representam esta coleta, não volume de buscas.`;
    $('dsRows').innerHTML=items.map(s=>`<article class="ds-signal"><label class="ds-select"><input type="checkbox" data-ds-select="${s.id}" ${selected.has(s.id)?'checked':''} ${s.disposition==='excluded'||active?'disabled':''}><strong>${esc(s.text)}</strong></label><p>${esc(s.group)} · ${esc({keep:'Manter',review:'Revisar',excluded:'Excluída'}[s.disposition])} · ${s.occurrences.length} ocorrência(s) na amostra</p><p>${esc(s.reason)} <small>(${s.author_type==='human'?'revisão humana':'classificação por regra'})</small></p><details><summary>Origem e consultas</summary>${s.occurrences.map(o=>`<p>Google Autocomplete via ${esc(current.run.data.provider)} · consulta: ${esc(o.query)} · posição ${o.position} · ${esc(date(o.collected_at))}<br>ID da consulta: ${esc(o.query_id)}${o.provider_id?' · ID da fonte: '+esc(o.provider_id):''}<br>Expressão original: ${esc(o.original)}</p>`).join('')}<p>Volume: indisponível · CPC: indisponível.</p></details><div class="db-actions"><button type="button" class="btn" data-ds-edit="${s.id}" ${active?'disabled':''}>Revisar grupo / pertinência</button><a class="btn" href="${esc('https://www.google.com/search?'+new URLSearchParams({q:s.text,gl:current.run.data.country,hl:current.run.data.language}))}" target="_blank" rel="noopener noreferrer">Consultar expressão no Google</a></div></article>`).join('')||'<p>Nenhuma expressão neste filtro.</p>';
    $('dsRows').querySelectorAll('[data-ds-select]').forEach(box=>box.onchange=()=>{if(box.checked)selected.add(box.dataset.dsSelect);else selected.delete(box.dataset.dsSelect);status();});
    $('dsRows').querySelectorAll('[data-ds-edit]').forEach(b=>b.onclick=()=>edit(current.signals.find(s=>s.id===b.dataset.dsEdit)));
  }
  function edit(signal){revisionSignal=signal;$('dsEditor').hidden=false;$('dsEditTitle').textContent=signal.text;$('dsEditGroup').value=signal.group;$('dsEditState').value=signal.disposition;$('dsEditReason').value=signal.reason;$('dsEditor').scrollIntoView({behavior:'smooth',block:'start'});}
  async function saveReview(){await perform(async e=>{
    const data=await DB.request(`/v1/search/runs/${current.run.id}/reviews`,{method:'POST',body:{expected_revision:current.run.latest_revision,signal_id:revisionSignal.id,group:$('dsEditGroup').value.trim(),disposition:$('dsEditState').value,reason:$('dsEditReason').value.trim()}});
    if(!alive(e))return;current=data;for(const s of data.signals)if(s.disposition==='excluded')selected.delete(s.id);$('dsEditor').hidden=true;render();note('Revisão salva. As expressões originais e as revisões anteriores foram preservadas.');
  });}
  async function editorial(){await perform(async e=>{
    const body=requestBody('editorial',{expected_revision:current.run.latest_revision,signal_ids:[...selected]});
    const data=await DB.request(`/v1/search/runs/${current.run.id}/editorial`,{method:'POST',body});if(!alive(e))return;retries.delete('editorial');hide();await callbacks.editorial(data.research_id);
  });}
  async function compare(){await perform(async e=>{const result=await DB.request(`/v1/search/runs/${current.run.id}/comparison`);if(!alive(e))return;$('dsComparison').innerHTML=`<p>Comparação com ${esc(date(result.previous_at))}: ${result.shared} expressões em comum. ${result.different_provider?'Os provedores diferem: '+esc(result.previous_provider)+' → '+esc(result.current_provider)+'. ':''}${result.different_plan?'Os planos de consulta diferem; a cobertura não é equivalente.':''} Diferenças são da amostra, não uma tendência de procura medida.</p><h4>Observadas apenas nesta coleta (${result.added.length})</h4><ul>${result.added.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h4>Ausentes nesta coleta (${result.absent.length})</h4><ul>${result.absent.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;});}
  function hide(){active=false;clearTimeout(timer);$('dsPanel').hidden=true;}
  function pause(){clearTimeout(timer);$('dsPanel').hidden=true;}
  function init(options){callbacks=options;$('dsPlan').onclick=plan;$('dsRun').onclick=start;$('dsRefresh').onclick=()=>perform(e=>load(current.run.id,e));$('dsMore').onclick=()=>perform(e=>history(true,e));$('dsTextFilter').oninput=renderRows;$('dsGroupFilter').onchange=render;$('dsDisposition').onchange=renderRows;$('dsSaveReview').onclick=saveReview;$('dsCancelReview').onclick=()=>{$('dsEditor').hidden=true;};$('dsExport').onclick=editorial;$('dsCompare').onclick=compare;
    $('dsSelectVisible').onclick=()=>{const ids=visible().filter(s=>s.disposition!=='excluded').map(s=>s.id);if(new Set([...selected,...ids]).size>80){note('Há mais de 80 expressões. Refine o filtro ou selecione manualmente; nada foi descartado.');return;}ids.forEach(id=>selected.add(id));renderRows();status();};
    $('dsClearSelection').onclick=()=>{selected.clear();renderRows();status();};reset();
  }
  return {init,open,reset,hide,pause,load:runId=>perform(e=>load(runId,e))};
})();
