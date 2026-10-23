/* Inteligência editorial: usa a sessão do console; nenhum segredo ou contato individual é enviado. */
const CI = (() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  const labels = { business:'Aderência ao negócio', pain:'Relevância da dor', intent:'Intenção', gap:'Lacuna editorial', capability:'Capacidade de resposta' };
  const weights = { business:30, pain:25, intent:20, gap:15, capability:10 };
  const oppText = { title:'Título', problem:'Problema', audience:'Público', intent:'Intenção', format:'Formato', rationale:'Justificativa' };
  const briefText = { title:'Título', audience:'Público', objective:'Objetivo', promise:'Promessa editorial', format:'Formato', angle:'Abordagem', conversion_material:'Material de conversão', cta:'Próxima ação', editorial_notes:'Orientações editoriais' };
  const briefLists = { questions:'Perguntas, uma por linha', outline:'Estrutura, uma etapa por linha', validation_tasks:'Validações pendentes, uma por linha' };
  let profileFn, profile = null, research = null, selected = null, brief = null, version = null, config = null;
  let epoch = 0, page = null, pollTimer, activeJob = null, busy = false, dirtyOpportunity = false, dirtyBrief = false;
  const retryKeys = new Map();
  const date = value => new Date(value).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo' });
  const lines = value => value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const message = text => { $('ciMessage').textContent = text; };
  function clear() {
    epoch++; clearTimeout(pollTimer); activeJob = null; busy = false;
    profile = null; research = selected = brief = version = config = null; retryKeys.clear();
    $('ciResearchForm').reset(); $('ciDate').value = new Date().toISOString().slice(0,10);
    for (const name of ['ciHistory','ciEvidence','ciOpportunities','ciBriefList','ciOpportunityFields','ciReviewSignals','ciScores','ciBriefFields']) $(name).replaceChildren();
    for (const name of ['ciResearchResult','ciOpportunityForm','ciBriefSection','ciClearProfile']) $(name).hidden = true;
    $('ciResearchForm').hidden = false; $('ciProfilePreview').textContent = 'Opcional: somente cargos, setores, estados e contagens.';
    message('');
    DS.reset();
  }
  function status() {
    $('ciAuth').hidden = DB.connected(); $('ciConnected').hidden = !DB.connected();
    const enabled = !!config?.enabled && !busy && !activeJob;
    $('ciAnalyze').disabled = !enabled;
    $('ciGenerateBrief').disabled = !enabled || dirtyOpportunity || selected?.data.relevance !== 'relevant';
    $('ciApprove').disabled = !version || version.status !== 'draft' || dirtyBrief || !$('ciReviewed').checked || version.version !== brief?.brief.latest_version;
    $('ciExport').disabled = !version || version.status !== 'approved' || dirtyBrief;
    $('ciSaveBrief').disabled = !version || !dirtyBrief || version.version !== brief?.brief.latest_version;
    $('ciSaveResearch').disabled = busy;
    $('ciReviewed').disabled = !version || version.status === 'approved' || dirtyBrief;
  }
  async function perform(work) {
    if (busy) return;
    const current = epoch; busy = true; status();
    try { await work(current); }
    catch (error) { if (epoch === current) message(error.message); }
    finally { if (epoch === current) { busy = false; status(); } }
  }
  const alive = current => current === epoch && DB.connected();
  async function loadConfig(current) {
    const data = await DB.request('/v1/content/config'); if (!alive(current)) return;
    config = data;
    $('ciConfig').textContent = data.enabled
      ? `Anthropic · ${data.model} · até ${data.max_output_tokens.toLocaleString('pt-BR')} tokens de saída por geração · ${data.reserved_today}/${data.daily_limit} solicitações reservadas hoje (UTC). Cobrança conforme sua conta.`
      : 'Configure a API Anthropic na VPS para habilitar as gerações. Você já pode salvar contexto e resultados de pesquisa.';
    status();
  }
  async function history(append = false, current = epoch) {
    const data = await DB.request('/v1/content/researches' + (append ? `?offset=${page}` : ''));
    if (!alive(current)) return;
    if (!append) $('ciHistory').replaceChildren();
    data.items.forEach(item => {
      const button = document.createElement('button'); button.className = 'ci-history-item';
      const title = document.createElement('strong'); title.textContent = item.theme;
      const detail = document.createElement('span'); detail.textContent = `${item.company} · ${date(item.created_at)} · ${item.author}`;
      button.append(title, detail); button.onclick = () => perform(n => loadResearch(item.id, n)); $('ciHistory').append(button);
    });
    if (!data.items.length && !append) $('ciHistory').textContent = 'Nenhuma pesquisa salva.';
    page = data.next_offset; $('ciMore').hidden = page === null;
  }
  async function open() {
    $('contentModule').classList.add('on'); $('contentModule').setAttribute('aria-hidden','false'); status();
    if (DB.connected()) await perform(async current => { await loadConfig(current); await history(false,current); await DS.open(); if (research && alive(current)) await loadResearch(research.item.id,current); });
  }
  function close() { $('contentModule').classList.remove('on'); $('contentModule').setAttribute('aria-hidden','true'); clearTimeout(pollTimer); DS.pause(); }
  function inputs() {
    const context={};
    for(const [key,field] of Object.entries({company:'Company',service:'Service',audience:'Audience',goal:'Goal',market:'Market',language:'Language',proofs:'Proofs',library:'Library'}))context[key]=$('ci'+field).value.trim();
    return {context,theme:$('ciTheme').value.trim(),profile};
  }
  function idempotentBody(key, body) {
    const signature = JSON.stringify(body), existing = retryKeys.get(key);
    if (!existing || existing.signature !== signature) retryKeys.set(key, { signature, id:crypto.randomUUID() });
    return { ...body, request_id:retryKeys.get(key).id };
  }
  async function saveResearch(event) {
    event.preventDefault();
    await perform(async current => {
      const texts = lines($('ciSignals').value);
      if (texts.length > 80) throw Error('Use no máximo 80 expressões nesta pesquisa.');
      if (texts.length && (!$('ciSource').value.trim() || !$('ciDate').value)) throw Error('Informe fonte e data dos resultados.');
      const context = {};
      for (const [key, field] of Object.entries({company:'Company',service:'Service',audience:'Audience',goal:'Goal',market:'Market',language:'Language',proofs:'Proofs',library:'Library'})) context[key] = $('ci'+field).value.trim();
      const body = idempotentBody('research', { context, theme:$('ciTheme').value.trim(), signals:texts.map(text => ({ text, source:$('ciSource').value.trim(), collected_at:$('ciDate').value, url:$('ciSourceUrl').value.trim() })), profile, allow_hypothesis:$('ciHypothesis').checked });
      const data = await DB.request('/v1/content/researches',{ method:'POST',body }); if (!alive(current)) return;
      retryKeys.delete('research'); await history(false,current); if (alive(current)) { await loadResearch(data.item.id,current); message('Pesquisa salva. A geração só começa quando você solicitar.'); }
    });
  }
  async function loadResearch(researchId, current = epoch) {
    const data = await DB.request(`/v1/content/researches/${researchId}`); if (!alive(current)) return;
    clearTimeout(pollTimer); activeJob = null; research = data; selected = brief = version = null;
    DS.hide();
    $('ciResearchForm').hidden = true; $('ciResearchResult').hidden = false; $('ciOpportunityForm').hidden = true; $('ciBriefSection').hidden = true;
    renderResearch();
    const pending = data.jobs.find(j => ['queued','running'].includes(j.status));
    if (pending) watch(pending.id,current);
    else if (data.jobs[0] && ['unknown','failed'].includes(data.jobs[0].status)) message(data.jobs[0].error_message);
    status();
  }
  function renderResearch() {
    const d = research.item.data;
    $('ciResearchTitle').textContent = d.theme;
    $('ciResearchSummary').textContent = `${d.context.company} · ${d.context.service} · ${d.context.audience} · ${d.signals.length} expressões ${d.search_origin?'coletadas e selecionadas':'fornecidas'} · ${date(research.item.created_at)} (Brasília). Volume e CPC indisponíveis.`;
    $('ciOpenCollection').hidden=!d.search_origin;$('ciOpenCollection').onclick=()=>DS.load(d.search_origin.run_id);
    $('ciEvidence').innerHTML = `<p><b>Objetivo:</b> ${esc(d.context.goal)} · ${esc(d.context.market)} · ${esc(d.context.language)}</p><p><b>Capacidades informadas:</b> ${esc(d.context.proofs || 'Não informadas')}</p><p><b>Biblioteca examinada:</b> ${esc(d.context.library || 'Não informada; lacuna editorial pendente')}</p>${d.profile ? `<p><b>Perfil agregado ${d.profile.kind === 'demo' ? '(base fictícia)' : ''}:</b> ${d.profile.count} contatos · ${esc([...d.profile.roles,...d.profile.sectors,...d.profile.regions].map(x=>x.label+' ('+x.count+')').join(' · '))}</p>` : ''}<ol>${d.signals.map(s=>`<li><b>${esc(s.text)}</b><br><small>${esc(s.source)} · ${esc(s.collected_at)}${s.duplicate_of ? ' · repetição textual preservada' : ''}</small>${s.url ? ` · <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Abrir referência</a>`:''}</li>`).join('')}</ol>${!d.signals.length ? '<p>Ideação sem expressões de pesquisa: demanda não validada.</p>' : '<p>Fontes declaradas pelo usuário, sem verificação automática. Contagens representam somente esta amostra.</p>'}`;
    if(d.search_origin)$('ciEvidence').lastElementChild.textContent='Expressões coletadas de Google Autocomplete via SerpAPI. Contagens são desta amostra; volume e CPC não foram medidos. A origem de cada expressão está na coleta vinculada.';
    $('ciOpportunities').innerHTML = research.opportunities.length ? research.opportunities.map(item => `<article class="ci-opportunity"><span class="ci-kicker">${item.data.hypothesis ? 'Hipótese editorial' : 'Interpretação de IA com expressões referenciadas'} · ${esc({relevant:'Pertinente',review:'Revisão necessária',out_of_context:'Fora de contexto'}[item.data.relevance])}</span><h4>${esc(item.data.title)}</h4><p>${esc(item.data.problem)}</p><p>${esc(item.data.rationale)}</p><p><b>${item.data.priority_score === null ? 'Prioridade incompleta' : `Prioridade sugerida: ${item.data.priority_score}/100`}</b> · ${item.data.evidence_quality.supplied_expressions} expressões · ${item.data.evidence_quality.verification==='collected_from_provider'?'coletadas da fonte; frequência não medida':'fontes declaradas'}</p><button class="btn" data-ci-select="${item.id}">Selecionar e revisar</button></article>`).join('') : '<p class="ci-muted">As oportunidades aparecerão após a geração.</p>';
    $('ciOpportunities').querySelectorAll('[data-ci-select]').forEach(button => { button.onclick = () => selectOpportunity(research.opportunities.find(item=>item.id===button.dataset.ciSelect)); });
    $('ciBriefList').innerHTML = research.briefs.length ? research.briefs.map(item=>`<button class="ci-history-item" data-ci-brief="${item.id}"><strong>${esc(item.title)}</strong><span>Versão ${item.latest_version} · ${item.status === 'approved' ? 'aprovada' : 'rascunho'}</span></button>`).join('') : '<p class="ci-muted">Nenhum briefing nesta pesquisa.</p>';
    $('ciBriefList').querySelectorAll('[data-ci-brief]').forEach(button=>{ button.onclick=()=>perform(n=>loadBrief(button.dataset.ciBrief,n)); });
  }
  function field(key, label, value, prefix) { return `<label class="db-field">${esc(label)}<textarea id="${prefix}${key}" required maxlength="${prefix === 'ciO' ? 1200 : 2000}">${esc(value)}</textarea></label>`; }
  function selectOpportunity(item) {
    selected = item; dirtyOpportunity = false; $('ciOpportunityForm').hidden = false;
    $('ciOpportunityFields').innerHTML = Object.entries(oppText).map(([key,label])=>field(key,label,item.data[key],'ciO')).join('') + `<label class="db-field">Pertinência<select id="ciORelevance"><option value="relevant">Pertinente ao contexto</option><option value="review">Revisão necessária</option><option value="out_of_context">Fora de contexto</option></select></label>` + field('questions','Perguntas, uma por linha',item.data.questions.join('\n'),'ciO') + field('pending','Pendências, uma por linha',item.data.pending.join('\n'),'ciO');
    $('ciOpending').required = false; $('ciORelevance').value = item.data.relevance;
    $('ciReviewSignals').innerHTML = research.item.data.signals.length ? research.item.data.signals.map(s=>`<label class="ci-check"><input type="checkbox" data-ci-ref="${esc(s.id)}" ${item.data.evidence_refs.includes(s.id)?'checked':''}>${esc(s.text)} · ${esc(s.source)}</label>`).join('') : '<p>Hipótese sem expressões fornecidas.</p>';
    $('ciScores').innerHTML = Object.entries(labels).map(([key,label])=>`<div class="ci-score"><label>${esc(label)} · ${weights[key]}%<select id="ciScore${key}" aria-label="Nota ${esc(label)}"><option value="">Pendente</option>${[0,1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label><label>Justificativa<input id="ciReason${key}" required minlength="3" maxlength="500" value="${esc(item.data.scores[key].reason)}"></label></div>`).join('');
    Object.keys(labels).forEach(key=>{ $('ciScore'+key).value=item.data.scores[key].value ?? ''; });
    $('ciPriority').textContent = `${item.data.priority_score === null ? 'Prioridade incompleta: existem dimensões pendentes.' : `Prioridade: ${item.data.priority_score}/100.`} Revisão ${item.latest_revision} · avaliação ${item.author_type === 'ai' ? 'sugerida pela IA' : 'revisada por usuário'}. ${research?.item.data.search_origin ? 'Evidência: expressões coletadas do provedor; aderência e intenção são interpretações, sem volume medido.' : 'Qualidade da evidência: fontes declaradas, sem verificação independente.'}`;
    status(); $('ciOpportunityForm').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function opportunityBody() {
    const data = {};
    Object.keys(oppText).forEach(key=>{ data[key]=$('ciO'+key).value.trim(); });
    data.relevance=$('ciORelevance').value; data.questions=lines($('ciOquestions').value); data.pending=lines($('ciOpending').value);
    data.evidence_refs=[...$('ciReviewSignals').querySelectorAll('input:checked')].map(el=>el.dataset.ciRef);
    data.scores=Object.fromEntries(Object.keys(labels).map(key=>[key,{value:$('ciScore'+key).value === '' ? null : Number($('ciScore'+key).value),reason:$('ciReason'+key).value.trim()}]));
    return data;
  }
  async function saveOpportunity(event) {
    event.preventDefault(); await perform(async current=>{
      const data=await DB.request(`/v1/content/opportunities/${selected.id}/reviews`,{method:'POST',body:{expected_revision:selected.latest_revision,data:opportunityBody()}});
      if (!alive(current)) return;
      const index=research.opportunities.findIndex(x=>x.id===data.item.id); research.opportunities[index]=data.item; renderResearch(); selectOpportunity(data.item); message('Revisão salva. As avaliações anteriores foram preservadas.');
    });
  }
  async function generate(action) {
    await perform(async current=>{
      if (action==='brief' && dirtyOpportunity) throw Error('Salve a revisão da oportunidade antes de gerar.');
      const body=idempotentBody('job', {research_id:research.item.id,action,...(action==='brief'?{opportunity_id:selected.id,expected_revision:selected.latest_revision}:{})});
      const data=await DB.request('/v1/content/jobs',{method:'POST',body}); if (!alive(current)) return;
      retryKeys.delete('job'); watch(data.job.id,current); await loadConfig(current);
    });
  }
  function watch(jobId,current) {
    clearTimeout(pollTimer); activeJob=jobId; status();
    const poll=async()=>{
      try {
        const {job}=await DB.request(`/v1/content/jobs/${jobId}`); if (!alive(current) || activeJob!==jobId || !$('contentModule').classList.contains('on')) return;
        if (['queued','running'].includes(job.status)) { message(job.status==='queued'?'Geração aguardando processamento…':'Anthropic preparando a proposta… Você pode fechar esta janela e retomar pela pesquisa salva.'); pollTimer=setTimeout(poll,2000); return; }
        activeJob=null; status();
        if (job.status!=='completed') { message(job.error_message || 'Geração interrompida. Não haverá repetição automática.'); return; }
        await loadResearch(research.item.id,current); if (!alive(current)) return;
        if (job.result.brief_id) await loadBrief(job.result.brief_id,current);
        const usage=job.usage; message(`Geração salva para revisão.${usage ? ` Consumo informado: ${usage.input_tokens ?? 'não informado'} tokens de entrada e ${usage.output_tokens ?? 'não informado'} de saída.` : ''}`);
      } catch (error) { if (alive(current)) { activeJob=null; status(); message(error.message+' Use Atualizar pesquisa para retomar a consulta; a geração não será repetida.'); } }
    };
    poll();
  }
  async function loadBrief(briefId,current=epoch) {
    const data=await DB.request(`/v1/content/briefs/${briefId}`); if (!alive(current)) return;
    brief=data; $('ciBriefSection').hidden=false;
    $('ciVersion').innerHTML=data.versions.map(v=>`<option value="${v.version}">v${v.version} · ${v.status==='approved'?'aprovada':'rascunho'}</option>`).join('');
    showVersion(data.versions[0]); $('ciBriefSection').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function showVersion(item) {
    version=item; dirtyBrief=false; $('ciReviewed').checked=item.status==='approved'; $('ciVersion').value=item.version;
    $('ciBriefStatus').textContent=`Versão ${item.version} · ${item.status==='approved' ? 'aprovada por '+item.approver : 'rascunho'} · ${date(item.created_at)} (Brasília).${item.data.hypothesis ? ' Hipótese editorial, sem demanda validada.' : ''}`;
    $('ciBriefFields').innerHTML=Object.entries(briefText).map(([key,label])=>field(key,label,item.data[key],'ciB')).join('')+Object.entries(briefLists).map(([key,label])=>field(key,label,item.data[key].join('\n'),'ciB')).join('')+`<p class="ci-muted">Referências vinculadas: ${item.data.evidence_refs.length} expressões da oportunidade selecionada. Consulte o histórico da pesquisa.</p>`;
    $('ciBvalidation_tasks').required=false;
    $('ciBriefFields').querySelectorAll('textarea').forEach(el=>{ el.readOnly=item.version!==brief.brief.latest_version; });
    status();
  }
  async function saveBrief(event) {
    event.preventDefault(); await perform(async current=>{
      const data=Object.fromEntries(Object.keys(briefText).map(key=>[key,$('ciB'+key).value.trim()]));
      Object.keys(briefLists).forEach(key=>{ data[key]=lines($('ciB'+key).value); }); data.evidence_refs=version.data.evidence_refs;
      const result=await DB.request(`/v1/content/briefs/${brief.brief.id}/versions`,{method:'POST',body:{expected_version:brief.brief.latest_version,data}});
      if (!alive(current)) return; brief=result; $('ciVersion').innerHTML=result.versions.map(v=>`<option value="${v.version}">v${v.version} · ${v.status==='approved'?'aprovada':'rascunho'}</option>`).join(''); showVersion(result.versions[0]); message('Nova versão salva em rascunho. Aprovações anteriores foram preservadas.');
    });
  }
  async function approve() {
    await perform(async current=>{
      await DB.request(`/v1/content/briefs/${brief.brief.id}/approvals`,{method:'POST',body:{expected_version:version.version,reviewed:$('ciReviewed').checked}});
      if (!alive(current)) return; await loadBrief(brief.brief.id,current); message('Esta versão do briefing foi aprovada. Você já pode exportá-la.');
    });
  }
  async function exportBrief() {
    await perform(async current=>{
      const data=await DB.request(`/v1/content/briefs/${brief.brief.id}/export?version=${version.version}`); if (!alive(current)) return;
      const url=URL.createObjectURL(new Blob([data.markdown],{type:'text/markdown;charset=utf-8'}));
      const a=document.createElement('a'); a.href=url; a.download=data.filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); message('Briefing exportado. O arquivo não confirma recebimento por outro aplicativo.');
    });
  }
  function init(getProfile) {
    profileFn=getProfile; clear();
    $('btnContent').onclick=open; $('ciClose').onclick=close;
    $('contentModule').onclick=e=>{ if(e.target.id==='contentModule')close(); };
    $('ciConnect').onclick=()=>{close();DB.open();};
    $('ciNew').onclick=()=>{clear();status();if(DB.connected())perform(async n=>{await loadConfig(n);await history(false,n);await DS.open();});};
    $('ciMore').onclick=()=>perform(n=>history(true,n));
    $('ciResearchForm').onsubmit=saveResearch;
    $('ciProfile').onclick=()=>{profile=profileFn();$('ciClearProfile').hidden=false;$('ciProfilePreview').textContent=`${profile.count} contatos no filtro${profile.kind==='demo'?' (base fictícia)':''}. Cargos: ${profile.roles.map(x=>x.label+' ('+x.count+')').join(', ')}. Setores: ${profile.sectors.map(x=>x.label+' ('+x.count+')').join(', ')}. Estados: ${profile.regions.map(x=>x.label+' ('+x.count+')').join(', ')}. Somente estes agregados serão incluídos.`;};
    $('ciClearProfile').onclick=()=>{profile=null;$('ciClearProfile').hidden=true;$('ciProfilePreview').textContent='Perfil agregado removido.';};
    $('ciRefresh').onclick=()=>perform(n=>loadResearch(research.item.id,n));
    $('ciAnalyze').onclick=()=>generate('opportunities'); $('ciGenerateBrief').onclick=()=>generate('brief');
    $('ciOpportunityForm').onsubmit=saveOpportunity;
    $('ciOpportunityForm').oninput=()=>{dirtyOpportunity=true;message('Há alterações na oportunidade. Salve a revisão antes de gerar o briefing.');status();};
    $('ciBriefForm').onsubmit=saveBrief; $('ciBriefForm').oninput=()=>{dirtyBrief=true;$('ciReviewed').checked=false;status();};
    $('ciReviewed').onchange=status; $('ciApprove').onclick=approve; $('ciExport').onclick=exportBrief;
    $('ciVersion').onchange=()=>showVersion(brief.versions.find(v=>v.version===Number($('ciVersion').value)));
    document.addEventListener('leadcaps:session',()=>{clear();status();});
    DS.init({inputs,showRun:()=>{research=selected=brief=version=null;clearTimeout(pollTimer);$('ciResearchForm').hidden=true;$('ciResearchResult').hidden=true;$('ciBriefSection').hidden=true;},editorial:researchId=>perform(async n=>{await history(false,n);if(alive(n))await loadResearch(researchId,n);})});
  }
  return { init, open, close };
})();
