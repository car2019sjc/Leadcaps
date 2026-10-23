import { randomUUID } from 'node:crypto';
export function researchInput({ hypothesis = false } = {}) {
  return { request_id: randomUUID(), context: { company:'Empresa Fictícia', service:'Serviços gerenciados de TI', audience:'Gestores de TI de indústrias', goal:'Organizar conversas de diagnóstico', market:'Brasil', language:'Português do Brasil', proofs:'Equipe de suporte informada para o teste', library:'' }, theme:'Recorrência de incidentes de TI', profile:null, allow_hypothesis:hypothesis, signals:hypothesis ? [] : [
    {text:'Como reduzir incidentes recorrentes?',source:'Amostra fictícia de pesquisa',url:'https://example.com/pesquisa',collected_at:new Date().toISOString().slice(0,10)},
    {text:'Como não repetir a mesma falha?',source:'Amostra fictícia de pesquisa',url:'https://example.com/pesquisa',collected_at:new Date().toISOString().slice(0,10)}
  ] };
}
export function opportunityFixture(research) {
  return {title:'Checklist de incidentes recorrentes',problem:'Incidentes que voltam a ocorrer na operação',audience:research.context.audience,intent:'Investigar causas e ações de prevenção',format:'Checklist com artigo de apoio',rationale:'A proposta ajuda o gestor a organizar evidências sobre recorrência.',relevance:'relevant',questions:['Quais incidentes se repetem?','O que investigar nos registros?'],evidence_refs:research.signals.map(s=>s.id),pending:['Validar exemplos técnicos com um especialista'],scores:Object.fromEntries(['business','pain','intent','gap','capability'].map(key=>[key,{value:key==='gap'?null:3,reason:key==='gap'?'Biblioteca ainda não examinada':'Avaliação ilustrativa para validar o fluxo'}]))};
}
export function briefFixture(input) {
  return {title:'Checklist para investigar incidentes recorrentes',audience:input.research.context.audience,objective:input.research.context.goal,promise:'Organizar as evidências antes de escolher uma ação de melhoria',format:'Checklist e artigo de apoio',angle:'Separar sintomas, causas e ações preventivas',conversion_material:'Planilha de investigação com responsável e próxima verificação',cta:'Solicitar uma conversa de diagnóstico',editorial_notes:'Não usar percentuais de redução sem comprovação. Revisar com especialista.',questions:['Quais incidentes se repetem?','Há evidência de causa confirmada?'],outline:['Definir recorrência e delimitar o período','Organizar os registros e as evidências','Definir a próxima investigação'],validation_tasks:['Confirmar referências técnicas'],evidence_refs:input.opportunity.data.evidence_refs};
}
