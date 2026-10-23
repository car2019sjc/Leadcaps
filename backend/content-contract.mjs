import { HttpError, text } from './validation.mjs';
export const WEIGHTS = { business: .30, pain: .25, intent: .20, gap: .15, capability: .10 };
export const LABELS = { business: 'Aderência ao negócio', pain: 'Relevância da dor', intent: 'Intenção', gap: 'Lacuna editorial', capability: 'Capacidade de resposta' };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw new HttpError(400, 'Campos não reconhecidos no conteúdo.');
  return value;
}
export function id(value) { if (!UUID.test(value)) throw new HttpError(400, 'Identificador inválido.'); return value; }
const optional = (value, label, max = 2000) => value === undefined || value === null || value === '' ? '' : text(value, label, 0, max);
export function strings(value, label, max = 20, min = 0, size = 600) {
  if (!Array.isArray(value) || value.length > max || value.length < min) throw new HttpError(400, `${label}: quantidade inválida.`);
  return value.map(x => text(x, label, 1, size));
}
function referenceUrl(value) {
  if (!value) return '';
  try { const u = new URL(value); if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw Error(); return u.href; }
  catch { throw new HttpError(400, 'Referência deve ser uma URL HTTP(S) sem credenciais.'); }
}
export function validateResearch(input) {
  object(input, ['request_id', 'context', 'theme', 'signals', 'profile', 'allow_hypothesis']);
  id(input.request_id);
  object(input.context, ['company', 'service', 'audience', 'goal', 'market', 'language', 'proofs', 'library']);
  const context = {};
  for (const key of ['company', 'service', 'audience', 'goal', 'market', 'language']) context[key] = text(input.context[key], key, 2, key === 'language' ? 40 : 500);
  context.proofs = optional(input.context.proofs, 'Evidências da empresa', 1500);
  context.library = optional(input.context.library, 'Biblioteca examinada', 1500);
  if (typeof input.allow_hypothesis !== 'boolean') throw new HttpError(400, 'Informe se deseja trabalhar com hipóteses.');
  if (!Array.isArray(input.signals) || input.signals.length > 80) throw new HttpError(400, 'Use no máximo 80 expressões por pesquisa.');
  const seen = new Map();
  const signals = input.signals.map((raw, i) => {
    object(raw, ['text', 'source', 'url', 'collected_at']);
    const original = text(raw.text, 'Expressão', 3, 300);
    const key = original.normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
    const date = text(raw.collected_at, 'Data da coleta', 10, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || Date.parse(date) > Date.now() + 86400000) throw new HttpError(400, 'Data da coleta inválida.');
    const signalId = `signal_${String(i + 1).padStart(3, '0')}`;
    const signal = { id: signalId, text: original, normalized: key, duplicate_of: seen.get(key) || null, kind: 'user_supplied_research', source: text(raw.source, 'Fonte', 2, 150), url: referenceUrl(optional(raw.url, 'URL', 1000)), collected_at: date, metrics: { volume: { value: null, status: 'unavailable' }, cpc: { value: null, status: 'unavailable' } } };
    if (!seen.has(key)) seen.set(key, signalId);
    return signal;
  });
  if (!signals.length && !input.allow_hypothesis) throw new HttpError(400, 'Inclua resultados de pesquisa ou escolha explicitamente trabalhar como hipótese.');
  let profile = null;
  if (input.profile) {
    const p = object(input.profile, ['base_id', 'kind', 'count', 'roles', 'sectors', 'regions']);
    if (!['saved', 'demo', 'local'].includes(p.kind) || !Number.isInteger(p.count) || p.count < 0 || p.count > 100000) throw new HttpError(400, 'Perfil agregado inválido.');
    profile = { base_id: p.base_id ? id(p.base_id) : null, kind: p.kind, count: p.count };
    for (const key of ['roles', 'sectors', 'regions']) {
      if (!Array.isArray(p[key]) || p[key].length > 5) throw new HttpError(400, 'Perfil agregado inválido.');
      profile[key] = p[key].map(item => {
        object(item, ['label', 'count']);
        if (!Number.isInteger(item.count) || item.count < 0 || item.count > p.count) throw new HttpError(400, 'Contagem agregada inválida.');
        return { label: text(item.label, 'Categoria agregada', 1, 100), count: item.count };
      });
    }
  }
  const data = { context, theme: text(input.theme, 'Tema', 3, 300), signals, profile, allow_hypothesis: input.allow_hypothesis, schema_version: 'content.research.v1' };
  if (Buffer.byteLength(JSON.stringify(data)) > 50000) throw new HttpError(400, 'Reduza o contexto e as expressões: limite de 50 KB por pesquisa editorial.');
  return data;
}
export function refs(value, signals) {
  const list = strings(value, 'Referências', 80, 0, 30);
  const allowed = new Set(signals.map(s => s.id));
  if (list.some(r => !allowed.has(r)) || new Set(list).size !== list.length) throw new HttpError(400, 'Referência inexistente ou repetida.');
  return list;
}
export function evaluate(scores) {
  object(scores, Object.keys(WEIGHTS));
  const result = {};
  for (const key of Object.keys(WEIGHTS)) {
    const criterion = object(scores[key], ['value', 'reason']);
    if (criterion.value !== null && (!Number.isInteger(criterion.value) || criterion.value < 0 || criterion.value > 5)) throw new HttpError(400, 'Notas devem ser inteiras de 0 a 5 ou pendentes.');
    result[key] = { value: criterion.value, reason: text(criterion.reason, 'Justificativa da avaliação', 3, 500) };
  }
  const complete = Object.values(result).every(x => x.value !== null);
  return { scores: result, priority_score: complete ? Math.round(200 * Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + weight * result[key].value, 0)) / 10 : null, priority_state: complete ? 'complete' : 'incomplete', weights: WEIGHTS, weights_version: 'pilot.v1' };
}
export function validateOpportunity(raw, research, { ai = false } = {}) {
  object(raw, ['title', 'problem', 'audience', 'intent', 'format', 'rationale', 'relevance', 'questions', 'evidence_refs', 'scores', 'pending']);
  const data = {};
  for (const key of ['title', 'problem', 'audience', 'intent', 'format', 'rationale']) data[key] = text(raw[key], key, 3, key === 'rationale' ? 1200 : 600);
  if (!['relevant', 'review', 'out_of_context'].includes(raw.relevance)) throw new HttpError(400, 'Pertinência inválida.');
  data.relevance = raw.relevance;
  data.questions = strings(raw.questions, 'Perguntas', 8, 1);
  data.evidence_refs = refs(raw.evidence_refs, research.signals);
  data.pending = strings(raw.pending, 'Pendências', 12);
  object(raw.scores, Object.keys(WEIGHTS));
  const scores = structuredClone(raw.scores);
  if (ai && !research.context.library) scores.gap = { value: null, reason: 'Biblioteca de conteúdos não examinada.' };
  Object.assign(data, evaluate(scores));
  data.hypothesis = data.evidence_refs.length === 0;
  data.evidence_quality = { supplied_expressions: data.evidence_refs.length, sources_declared: new Set(research.signals.filter(s => data.evidence_refs.includes(s.id)).map(s => s.source + '|' + s.url)).size, verification: 'not_independently_verified', measured_demand: false };
  return data;
}
export const BRIEF_TEXT = ['title', 'audience', 'objective', 'promise', 'format', 'angle', 'conversion_material', 'cta', 'editorial_notes'];
export const BRIEF_LISTS = ['questions', 'outline', 'validation_tasks'];
export function validateBrief(raw, research, opportunity) {
  object(raw, [...BRIEF_TEXT, ...BRIEF_LISTS, 'evidence_refs']);
  const data = {};
  for (const key of BRIEF_TEXT) data[key] = text(raw[key], key, 3, key === 'editorial_notes' ? 2000 : 1000);
  for (const key of BRIEF_LISTS) data[key] = strings(raw[key], key, 15, key === 'validation_tasks' ? 0 : 1, 800);
  data.evidence_refs = refs(raw.evidence_refs, research.signals);
  if (data.evidence_refs.some(r => !opportunity.evidence_refs.includes(r))) throw new HttpError(400, 'O briefing cita sinal fora da oportunidade selecionada.');
  data.hypothesis = opportunity.hypothesis;
  return data;
}
const str = { type: 'string' }, list = { type: 'array', items: str };
const obj = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const criterion = obj({ value: { anyOf: [{ type: 'integer' }, { type: 'null' }] }, reason: str });
export const OPPORTUNITIES_SCHEMA = obj({ opportunities: { type: 'array', items: obj({
  title: str, problem: str, audience: str, intent: str, format: str, rationale: str,
  relevance: { type: 'string', enum: ['relevant', 'review', 'out_of_context'] }, questions: list, evidence_refs: list,
  scores: obj(Object.fromEntries(Object.keys(WEIGHTS).map(k => [k, criterion]))), pending: list
}) } });
export const BRIEF_SCHEMA = obj(Object.fromEntries([...BRIEF_TEXT.map(k => [k, str]), ...[...BRIEF_LISTS, 'evidence_refs'].map(k => [k, list])]));
export function briefMarkdown(brief, version, research, opportunity) {
  const d = version.data;
  const sections = [['Público', d.audience], ['Objetivo', d.objective], ['Promessa editorial', d.promise], ['Formato', d.format], ['Abordagem', d.angle], ['Perguntas', d.questions.map(x => '- ' + x).join('\n')], ['Estrutura', d.outline.map((x,i) => `${i+1}. ${x}`).join('\n')], ['Material de conversão', d.conversion_material], ['Próxima ação', d.cta], ['Validações pendentes', d.validation_tasks.length ? d.validation_tasks.map(x => '- ' + x).join('\n') : 'Nenhuma tarefa registrada; referências ainda exigem conferência editorial.'], ['Orientações editoriais', d.editorial_notes]];
  const sources = research.signals.filter(s => d.evidence_refs.includes(s.id)).map(s => `- ${s.id}: ${s.text}\n  Fonte informada: ${s.source}; coleta declarada: ${s.collected_at}${s.url ? '; ' + s.url : ''}`).join('\n');
  return `# ${d.title}\n\nBriefing editorial aprovado — versão ${version.version}\nEmpresa: ${research.context.company}\nServiço: ${research.context.service}\nTema: ${research.theme}\nBriefing: ${brief.id}\nOportunidade: ${brief.opportunity_id} — revisão ${brief.opportunity_revision}\nAprovado em: ${new Date(version.approved_at).toISOString()}\n\n${opportunity.hypothesis ? 'Hipótese editorial: demanda não validada.\n\n' : 'As expressões fornecidas não comprovam frequência de busca ou demanda de mercado.\n\n'}${sections.map(([title, value]) => `## ${title}\n\n${value}`).join('\n\n')}\n\n## Rastreabilidade\n\n${sources || 'Ideação gerada por IA, sem resultados de pesquisa fornecidos.'}\n\nConteúdo preparado com apoio da Anthropic. Fontes fornecidas pelo usuário, sem verificação automática. Este briefing orienta a produção; não é uma peça aprovada para campanha.\n`;
}
