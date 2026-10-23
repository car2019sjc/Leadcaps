# Especificação do módulo de inteligência de conteúdo

Integração com a ferramenta de captação de leads da OnSet Tecnologia

Rodrigues  |  Versão 1.1  |  23 de outubro de 2026

## Objetivo e primeira entrega

Propomos acrescentar pesquisa e inteligência editorial à ferramenta de leads existente. O módulo deverá transformar sinais de interesse em oportunidades explicadas e em briefings revisados, preservando o percurso entre contexto, evidência, decisão e entrega.

A primeira versão permite pesquisar um tema, revisar grupos de dúvidas, selecionar uma oportunidade e entregar um briefing utilizável no sistema atual. O sucesso inicial será medido pela utilidade do briefing e pela integridade da integração. Aumento de leads deverá ser avaliado posteriormente, em campanhas acompanhadas.

## Base da especificação

| Categoria | O que sustenta esta versão |
| --- | --- |
| Documentado e revalidado | Em 23/10/2026, a documentação oficial mantém a API em Alpha para pesquisa, relatórios e respostas de IA, sem geração de artigos ou publicação pela API. [F1] |
| Documentado e revalidado | O fornecedor informa que volume e CPC usam referências do Google do mês anterior. Prompts de IA são sugestões geradas; respostas são amostras datadas. [F2, F3] |
| Observação de interface | O acesso ao projeto OnSet e a leitura de três relatórios salvos foram confirmados nesta etapa. A amostra contém duplicações, termos ambíguos e resultados fora do contexto empresarial. [R2] |
| Proposta própria | Processos, campos, regras, pontuação, telas e contratos descritos neste documento são nosso desenho independente. |
| Validação necessária | Identidade e arquitetura da ferramenta atual; ponto de entrada do briefing; disponibilidade, condições e respostas reais das fontes escolhidas. |

Preservamos o fluxo e as decisões do relatório anterior. As próximas páginas detalham sua execução; nenhuma implementação ou integração é declarada como concluída.

## Entradas e decisões da pesquisa

Cada execução deve fixar a versão do contexto e as condições da consulta. Isso permite explicar um resultado mesmo depois de o cadastro da empresa ou a recomendação ser alterado. As intervenções abaixo ficam disponíveis sem impor aprovações em todas as etapas.

| Etapa e entrada | Decisão do módulo | Saída | Intervenção do usuário |
| --- | --- | --- | --- |
| 1 Contexto<br>Serviços, público, mercado, objetivo e afirmações comprovadas. | Verificar campos essenciais; separar fatos fornecidos de posicionamentos a confirmar. | Contexto versionado e lista de lacunas. | Confirmar serviço e público. Corrigir diferenciais e restrições. |
| 2 Tema<br>Contexto e problema inicial. | Expandir vocabulário técnico e cotidiano; sugerir termos com rótulo de geração. | Termos de pesquisa e exclusões. | Escolher tema, editar termos, idioma e país. |
| 3 Coleta<br>Termos e fontes habilitadas. | Consultar provedor ou importar dados; registrar cobertura, data e falhas. | Lote de sinais e estado por fonte. | Iniciar pesquisa, aceitar custo informado e repetir apenas falhas. |
| 4 Normalização<br>Expressões originais. | Padronizar grafia para comparação, mantendo texto original e vínculos. | Registros normalizados e duplicações técnicas identificadas. | Corrigir siglas e termos ambíguos. |
| 5 Interpretação<br>Sinais, contexto e exclusões. | Propor grupos por problema e intenção; preservar diferenças de resposta esperada. | Grupos editáveis e classificações justificadas. | Unir, separar, renomear e excluir itens com motivo. |

## Requisitos mínimos de entrada

Exigir um serviço ou oferta, um público, um objetivo, um tema, idioma e mercado. Canais, biblioteca e diferenciais podem ser complementados depois. O sistema deve indicar o efeito da ausência: sem biblioteca analisada, a lacuna editorial permanece pendente.

O contexto proposto para iniciar o piloto é OnSet, gestores de TI e o problema de recorrência de incidentes. Serviço, público e objetivo devem ser confirmados no sistema antes da execução real. Dados comerciais de outros projetos não serão associados automaticamente.

## Decisões da oportunidade à campanha

| Etapa e entrada | Decisão do módulo | Saída | Intervenção do usuário |
| --- | --- | --- | --- |
| 6 Enriquecimento<br>Sinais e biblioteca acessível. | Associar métricas à expressão correta e ao período; comparar necessidade com conteúdos disponíveis. | Métricas qualificadas e cobertura explicada. | Informar conteúdos existentes; validar reaproveitamento ou lacuna. |
| 7 Priorização<br>Grupos, contexto e evidências. | Aplicar critérios avaliados; separar prioridade e qualidade da evidência. | Oportunidades com notas, motivos e pendências. | Revisar notas e escolher oportunidade ou registrar hipótese. |
| 8 Briefing<br>Oportunidade escolhida e formato. | Traduzir o problema em promessa editorial, estrutura, evidências e próxima ação. | Briefing versionado e pontos que exigem confirmação. | Editar abordagem, formato e chamada; aprovar a versão. |
| 9 Produção<br>Briefing aprovado e fontes. | Em evolução futura, redigir e adaptar peças; verificar afirmações e referências. | Rascunhos e conteúdo aprovado em etapa própria. | Revisar, solicitar ajustes e aprovar cada versão de conteúdo. |
| 10 Retorno<br>Vínculos de campanha e resultados. | Em evolução futura, comparar temas e formatos com denominadores e períodos compatíveis. | Leitura agregada e hipóteses de ajuste. | Avaliar utilidade dos contatos e aprovar mudanças no planejamento. |

## Cobertura exige uma base conhecida

Propor quatro estados para um tema: não avaliado, coberto, parcialmente coberto e lacuna identificada. Sempre mostrar quais materiais foram examinados e qual necessidade atendem. Biblioteca ausente, incompleta ou inacessível não comprova ausência de conteúdo.

Os limiares de cobertura descritos pelo AnswerThePublic permanecem uma regra do fornecedor registrada em R1. No módulo próprio, começar pela comparação explicada entre pergunta, público, intenção e trechos dos materiais. Um percentual de similaridade, se adotado depois, precisará de validação própria.

## Escolha de uma oportunidade com informação limitada

Permitir que o usuário selecione uma hipótese mesmo sem volume ou nota completa. Registrar a condição e as validações necessárias. Essa escolha autoriza preparar o briefing; não converte a hipótese em demanda comprovada nem qualifica pessoas ou empresas.

## Como os sinais se transformam em interpretação

## Regras determinísticas e uso de IA

Usar regras verificáveis para validar campos, normalizar texto, calcular pontuação, controlar versões e transmitir objetos. Usar IA para sugerir grupos, interpretar necessidades e elaborar o briefing. O sistema valida a estrutura das respostas de IA e verifica se as referências citadas existem na execução.

| Decisão | Regra proposta | Evidência ou revisão |
| --- | --- | --- |
| Duplicação | Unificar repetições do mesmo registro na mesma coleta. Manter ocorrências distintas por fonte e data vinculadas à mesma expressão. | Guardar texto original, chave de comparação e todas as origens. |
| Mesmo problema | Agrupar quando público, problema e resposta esperada forem compatíveis. Proximidade de palavras é apenas um indício. | Explicar o motivo; permitir divisão e união sem apagar sinais. |
| Variação relevante | Preservar preço, prazo, localidade, negação, comparação, cenário e intenção quando alterarem a resposta. | “Reduzir chamados” e “preço do suporte terceirizado” podem ter relação, mas exigem pautas distintas. |
| Classificação | Permitir múltiplas intenções e estado incerto. Usar taxonomia versionada e justificativa curta. | Registrar autor humano ou modelo, versão da regra e evidências utilizadas. |
| Sugestão gerada | Guardar ideias de IA em coleção identificada. Não contá-las como sinais coletados ou frequência de procura. | Mostrar rótulo e condições da geração. |
| Recomendação | Relacionar uma necessidade a um serviço comprovável e a uma resposta editorial útil. | Exibir por que interessa, o que sustenta a leitura e o que falta confirmar. |

## Qualidade da evidência

Exibir separadamente origem, atualidade, adequação ao mercado e corroboração. Contagens de ocorrências representam apenas o conjunto coletado. Fontes diferentes podem compartilhar a mesma base; registrar dependência conhecida e evitar tratá-las automaticamente como confirmação independente.

Não usar a autoconfiança declarada pelo modelo como probabilidade de acerto. Uma classificação pode estar bem explicada e ainda depender de revisão. Uma resposta de IA também não comprova a afirmação que contém; ela serve como material para análise e pesquisa adicional.

## Priorização explicável das oportunidades

Manter os pesos propostos em R1. São parâmetros do piloto e não uma fórmula do fornecedor. Registrar cada nota com justificativa, evidências, responsável e data. As âncoras abaixo orientam notas inteiras de 0 a 5; os valores intermediários representam situações entre as descritas.

| Critério e peso | Nota 0 | Nota 3 | Nota 5 |
| --- | --- | --- | --- |
| Aderência<br>30% | Sem relação com a oferta. | Relação plausível com serviço definido. | Resposta diretamente ligada a serviço e capacidade confirmados. |
| Relevância da dor<br>25% | Baixa relevância confirmada para o público. | Impacto plausível, com fundamento registrado. | Problema importante para o público, sustentado por evidências adequadas. |
| Intenção<br>20% | Consulta sem necessidade editorial identificável após revisão. | Necessidade provável; há ambiguidade residual. | Necessidade e resposta esperada claras no contexto. |
| Lacuna editorial<br>15% | Material existente atende à necessidade. | Cobertura parcial com complemento identificado. | Ausência identificada após examinar uma biblioteca de escopo conhecido. |
| Capacidade de resposta<br>10% | Incapacidade confirmada de responder com qualidade. | Há base útil, com complementos definidos. | Conhecimento e evidências suficientes para uma resposta útil. |

Cálculo com todas as dimensões avaliadas: prioridade = 20 × (0,30A + 0,25D + 0,20I + 0,15L + 0,10C). A escala final vai de 0 a 100. Volume e CPC são contexto adicional e não substituem os cinco critérios.

Antes de pontuar, verificar o sentido da expressão e sua adequação ao contexto da campanha. Itens fora de contexto ficam separados; itens ambíguos exigem revisão. Esse filtro preserva os pesos definidos e evita priorizar o significado errado de uma palavra ou sigla.

## Dimensões pendentes

Ausência de avaliação será null, acompanhada do motivo. Não atribuir zero por falta de dados. Se existir dimensão pendente, priority_score será null e o estado será incomplete. Mostrar as notas já avaliadas e os critérios restantes. Não produzir um ranking numérico que misture notas completas e incompletas.

## Revisão durante o piloto

O usuário poderá escolher uma hipótese incompleta e justificar a decisão. Alterações de notas ou pesos criam nova avaliação; não reescrevem a decisão anterior. Pesos só mudam por configuração explícita, após revisão de uma amostra de oportunidades e campanhas. A qualidade da evidência continuará exibida fora da pontuação.

## Uso da primeira versão

Acrescentar uma entrada de navegação no aplicativo atual, aproveitando seus padrões visuais. A sequência abaixo define funções; não exige cinco telas separadas nem uma nova autenticação.

| Passo | O usuário vê e faz | Condição de avanço |
| --- | --- | --- |
| 1 Pesquisar | Seleciona empresa, serviço e público; informa tema, mercado e fonte. Vê estimativa ou limite de consumo e inicia a consulta. | Contexto mínimo válido; fonte disponível ou arquivo de pesquisa identificável. |
| 2 Entender os sinais | Examina tabela filtrável por origem, data, intenção e estado da métrica. Abre originais e corrige agrupamentos. | Há resultado útil ou o usuário opta explicitamente por trabalhar uma hipótese. |
| 3 Escolher oportunidade | Vê problema, público, resposta esperada, justificativa, notas e pendências. Pode reaproveitar uma pauta existente. | Seleção registrada, incluindo a condição de hipótese quando aplicável. |
| 4 Revisar briefing | Confere promessa, perguntas, estrutura, referências, lacunas e próxima ação. Solicita ajustes e aprova uma versão. | Campos essenciais completos e afirmações sem suporte removidas ou convertidas em tarefas de validação. |
| 5 Entregar ao aplicativo | Escolhe o destino existente, envia a versão aprovada ou exporta no formato suportado. Vê confirmação e vínculo. | Recebimento confirmado; ou exportação entregue com estado exportado, sem alegar integração concluída. |

## Aprovações e alterações

A aprovação de oportunidade registra a escolha editorial. A aprovação de briefing libera seu uso como instrução de produção. A aprovação de conteúdo para campanha será uma decisão posterior, aplicada ao texto e à versão específicos. Um briefing aprovado não deve aparecer como peça pronta para envio.

Editar uma versão aprovada cria uma nova versão em rascunho. O histórico aprovado permanece preservado. Alterar o agrupamento ou o contexto sinaliza os derivados que precisam de revisão e não substitui silenciosamente um briefing já aprovado.

## Permissões

Mapear visualizar, pesquisar, editar, aprovar e encaminhar aos perfis existentes. Um mesmo usuário poderá acumular funções quando o sistema atual permitir. Validar autorização e organização no servidor em toda operação; não confiar em identificadores enviados pela interface.

## Briefing ilustrativo para o piloto OnSet

Exemplo proposto para demonstrar a entrega. As perguntas abaixo são termos a pesquisar e não representam demanda observada. O exemplo permanece em rascunho e exige confirmação do serviço, do público, das fontes e das evidências técnicas.

## Público e problema

Público proposto: gestores responsáveis pelo suporte e pela operação de TI. Problema: incidentes que voltam a ocorrer e geram repetição de trabalho. Objetivo editorial: ajudar o gestor a organizar evidências sobre recorrência e decidir o que investigar.

## Tema e promessa editorial

Título provisório: Checklist para investigar por que os mesmos incidentes de TI voltam a ocorrer. Promessa: orientar uma revisão inicial dos registros e das ações adotadas, sem prometer percentual de redução ou solução automática.

## Perguntas que orientam a pesquisa e o material

Quais incidentes se repetem? Os registros permitem identificar serviço, sintoma, causa e solução aplicada? O encerramento resolve a causa ou restaura o serviço temporariamente? Há responsável, ação preventiva e acompanhamento da recorrência?

## Estrutura proposta

Abrir com um cenário ilustrativo identificado. Explicar como definir recorrência e separar sintomas de causas. Apresentar uma sequência de verificação dos registros, uma tabela para organizar achados e critérios para escolher a próxima investigação. Encerrar com limites da avaliação e uma ação de continuidade.

## Material de conversão e próxima ação

Material proposto: checklist com registro de incidente, evidência disponível, repetição observada, ação adotada, responsável e próxima verificação. Próxima ação sugerida: avaliar a situação da empresa ou solicitar uma conversa de diagnóstico, conforme oferta e destino que a OnSet confirmar.

## Evidências e limites editoriais

Exigir referências técnicas verificadas e revisão de especialista para recomendações de gestão de incidentes e problemas. Usar casos e números da OnSet somente com comprovação e autorização de uso. Evitar atribuir toda recorrência à terceirização, à equipe ou à ausência de uma ferramenta.

## Critério de aceite do briefing

Uma pessoa que não participou da pesquisa deve conseguir produzir o material sabendo para quem escreve, qual pergunta responde, quais afirmações pode sustentar, quais referências consultar e qual ação propor. O briefing deve levar consigo os vínculos da oportunidade e das evidências.

## Modelo de dados e rastreabilidade

Usar identificadores e relacionamentos do aplicativo sempre que existirem. As entidades abaixo descrevem responsabilidades lógicas; podem ser implementadas em tabelas, documentos ou estruturas já disponíveis.

| Objeto | Campos essenciais e relações |
| --- | --- |
| Contexto | ID, referência da organização, versão, serviço, público, objetivo, mercado, idioma, diferenciais e referências de comprovação. |
| Pesquisa e coleta | ID, contexto e versão, termos, fontes, estado, início e fim, requisição externa, custo conhecido ou pendente e resumo de falhas por fonte. |
| Sinal e origem | ID, pesquisa, texto original e normalizado, tipo, plataforma, provedor, referência da fonte, mercado, idioma e data da coleta. Manter origem mesmo após agrupamento. |
| Métrica | Sinal ou expressão exata, nome, valor, estado, unidade, moeda quando cabível, provedor, plataforma medida, mercado, período de referência e data de obtenção. |
| Grupo e classificação | Sinais vinculados, problema, público, intenção ou intenções, justificativa, taxonomia, autor humano ou modelo e versão. |
| Oportunidade e avaliação | Grupo, serviço relacionado, proposta de resposta, evidências, notas por critério, pesos versionados, pendências, prioridade e decisão do usuário. |
| Briefing e aprovação | ID, oportunidade, versão, corpo estruturado, referências, validações pendentes, estado, autor, revisor e aprovação da versão. |
| Entrega e vínculo | ID, briefing e versão, sistema e destino externos, chave de idempotência, estado, tentativas, confirmação e identificador retornado. |

## Estados com significado explícito

Pesquisa: queued, running, completed, partial, failed ou cancelled. Um resultado sem sugestões pode estar completed, com contagem zero; isso não significa ausência de interesse no mercado. Falhas de fontes produzem partial quando existe resultado aproveitável.

Briefing: draft, in_review, approved ou archived. Entrega: pending, confirmed, failed, unknown ou exported. Em unknown, o sistema deve verificar o recebimento antes de reenviar. Exported significa arquivo gerado; não confirma importação pelo aplicativo.

## Arquitetura e pontos de integração

## Aproveitamento do sistema atual

Priorizar um módulo interno quando o aplicativo comportar execução no servidor, armazenamento e processamento de tarefas. Avaliar um serviço separado somente se a arquitetura existente ou o isolamento de operações demoradas justificar. Não escolher linguagem, banco, fila ou hospedagem antes de examinar o sistema atual.

Organizar responsabilidades em interface, coordenação da pesquisa, adaptadores de fonte, interpretação, montagem do briefing e entrega ao aplicativo. Essa divisão não exige novos serviços. Operações longas devem permitir acompanhamento e retomada; usar o mecanismo de tarefas existente quando disponível.

| Integração | Contrato proposto | Confirmação necessária |
| --- | --- | --- |
| Contexto | Ler organização, serviços, público e objetivo com a identidade atual. Salvar a versão usada na análise. | Cadastros reais, permissões e referência estável da organização. |
| Biblioteca | Receber lista de materiais, versões e conteúdo acessível para comparação. | Existência, formatos, acesso e cobertura da biblioteca. |
| Fontes | Adaptador recebe termo e mercado; devolve sinais, métricas e falhas com origem. | Provedor, acesso, condições de uso, formatos reais e limites. |
| IA | Receber contexto mínimo e evidências referenciadas; devolver estrutura validável e justificativas. | Provedor já adotado, modelos disponíveis, custo e configuração. |
| Destino editorial | Criar ou anexar briefing ao objeto existente, com versão, estado editorial e referências. | Editor, pauta, campanha ou outro ponto de entrada efetivamente disponível. |
| Resultados futuros | Receber eventos ou agregados por identificadores de campanha, peça e período. | Eventos existentes e critérios reais de qualificação e avanço. |

## Estratégia para a fonte de pesquisa

A primeira versão terá um adaptador estável para dados coletados. Uma exportação legítima de pesquisa, com origem e data, permite validar o processo antes de automatizar consultas. Uma API poderá ser conectada ao mesmo contrato após verificação técnica e das condições de uso. A geração de perguntas por IA será uma função separada, identificada como ideação.

A documentação pública informa que os detalhes de endpoints e formatos do AnswerThePublic ficam na página API Access do painel. [F1] Nenhum endpoint do fornecedor foi presumido nesta especificação. A sessão e o acesso privado da conversa anterior não foram considerados transferidos.

## Contrato técnico proposto para o módulo

Operações abaixo pertencem ao nosso módulo. Se houver API HTTP, os caminhos são sugestões locais; se a integração for interna, as mesmas operações poderão ser funções de aplicação. Identidade e autorização serão obtidas no servidor.

| Operação sugerida | Entrada e resultado esperado |
| --- | --- |
| POST /content-intelligence/researches | context_ref e versão, tema, idioma, mercado e fontes. Retorna research_id, estado e referência para acompanhamento. Operação longa pode responder 202. |
| GET /content-intelligence/researches/{id} | Retorna andamento, resultado parcial ou completo, sinais, grupos e erros por fonte. Não repetir a coleta como efeito da leitura. |
| PATCH /content-intelligence/groups/{id} | Recebe revisão esperada e alterações de agrupamento ou classificação. Retorna nova revisão; conflito exige conciliação. |
| POST /content-intelligence/opportunities | Recebe grupos e avaliação ou solicita sugestões estruturadas. Retorna oportunidades com evidências e critérios pendentes. |
| POST /content-intelligence/briefs | Recebe oportunidade e versão, formato e orientações. Gera briefing em draft; nunca o aprova implicitamente. |
| POST /content-intelligence/briefs/{id}/approvals | Recebe versão exata e confirmação do revisor autorizado. Verifica os campos obrigatórios e registra a aprovação. |
| POST /content-intelligence/deliveries | Recebe briefing, versão e destino conhecido. Retorna entrega e estado; confirmed exige confirmação do aplicativo receptor. |

## Validação comum

Usar schema_version no envelope de integração, datas em ISO 8601, identificadores estáveis e null explícito para ausência. Limites de texto e quantidade serão configurados após amostras reais. Conteúdo importado será tratado como dados: instruções embutidas não poderão mudar permissões, fontes ou operações.

Rejeitar vínculo entre organizações diferentes; versão desatualizada; campo obrigatório ausente; métrica inválida; referência inexistente; e entrega de briefing sem aprovação da versão. Retornar erros estáveis, por exemplo validation_error, version_conflict, source_unavailable, quota_exceeded e target_unavailable, com ação de recuperação compreensível.

## Exemplo do pacote de entrega

Envelope mínimo proposto. Os identificadores são ilustrativos e deverão corresponder aos objetos reais. O corpo completo do briefing fica em body, com as seções editoriais da página 7. O aplicativo receptor deverá guardar a versão e devolver seu próprio identificador.

{
  "schema_version": "content_intelligence.brief.v1",
  "handoff_id": "handoff_demo_01",
  "organization_ref": "org_demo_onset",
  "brief_id": "brief_demo_01",
  "version": 1,
  "status": "approved",
  "usage": "editorial_brief",
  "opportunity_ref": "opp_demo_01",
  "context_version": 1,
  "research_refs": ["research_demo_01"],
  "evidence_refs": [],
  "validation_status": "hypothesis",
  "body": {
    "title": "Checklist de recorrencia de incidentes",
    "audience": "Gestores de TI",
    "objective": "Orientar uma revisao inicial",
    "format": "checklist",
    "primary_question": "Por que os incidentes voltam?",
    "outline": ["Cenario", "Verificacoes", "Proxima acao"],
    "next_action": "Avaliar uma conversa de diagnostico",
    "claim_constraints": ["Nao prometer reducao percentual"],
    "references": [],
    "research_tasks": ["Confirmar referencias tecnicas"]
  },
  "approval": {
    "approved_by_ref": "user_demo_01",
    "approved_at": "2026-10-23T14:00:00-03:00"
  },
  "target": {"kind": "editorial_item", "ref": null}
}

Este exemplo ilustra uma hipótese editorial aprovada para orientar pesquisa e produção. Evidence_refs vazio exige validation_status hypothesis e tarefas de pesquisa visíveis. Aprovar esse briefing não libera a publicação de afirmações sem referência.

## Confirmação e repetição

Enviar handoff_id como chave de idempotência ou equivalente suportado pelo destino. A resposta deve incluir external_ref, received_version e received_at. Se houver confirmação perdida, consultar pelo mesmo identificador ou reconciliar antes de reenviar. Um arquivo exportado carregará a mesma identidade para evitar duplicação na importação.

## Integridade dos dados e recuperação

| Situação | Comportamento especificado |
| --- | --- |
| Métrica igual a zero | Guardar value 0 e status reported. Informar fonte, período e definição; não interpretar automaticamente como inexistência de demanda. |
| Métrica indisponível | Guardar value null e status unavailable, com motivo quando fornecido. A expressão continua utilizável. |
| Falha de consulta da métrica | Guardar value null e status error, com referência da falha. Oferecer tentativa controlada. |
| Período não informado | Manter período null e indicar ausência. Não atribuir o mês anterior por regra própria a outros provedores. |
| Resultado parcial ou vazio | Distinguir fonte sem sugestões de fonte com falha. Mostrar o que foi consultado e o que permaneceu sem resposta. |
| Consulta repetida | Calcular chave com organização, contexto relevante, termos, idioma, mercado, fontes e parâmetros. Reusar tarefa idêntica ou exigir atualização explícita. |
| Limite e custo | Usar orçamento configurado, estimativa quando disponível e consumo efetivo separado. Retentar falhas transitórias com limites; respeitar espera indicada pelo provedor. |
| Timeout após envio | Marcar entrega unknown. Consultar ou reconciliar antes de reenviar; evitar novo gasto ou novo objeto por repetição cega. |
| Edição após aprovação | Criar draft de nova versão. Exigir aprovação dessa versão para nova entrega. Preservar vínculos das versões antigas. |
| Fonte ou modelo alterado | Registrar adaptador, regra, modelo e versão disponível. Reprocessar como nova execução com os dados necessários preservados. |

## Limites de acesso e armazenamento

Usar credenciais apenas no servidor, em configuração segura. Aplicar as políticas existentes de acesso, retenção e auditoria. O módulo de pesquisa trabalha com dados agregados; dados pessoais dos leads permanecem sob as funções e permissões do aplicativo atual.

Conservar evidências originais somente conforme as condições de cada fonte. Quando o conteúdo integral não puder ser mantido, guardar os metadados e referências permitidos e informar o limite da reconstrução. Registrar erros técnicos sem expor tokens ou informações privadas em tela ou logs de uso comum.

## Escopo e aceite da primeira versão

## Entrega incluída

Contexto versionado; uma modalidade real de coleta ou importação com origem; pesquisa por tema; normalização; grupos editáveis; oportunidade explicada; notas e pendências; briefing estruturado; revisão e aprovação; histórico; e um caminho de entrega compatível com o aplicativo atual.

Produção completa de artigos, materiais diagramados, peças derivadas, calendário, publicação, novas automações e leitura de desempenho formarão etapas posteriores. A biblioteca existente poderá ser informada manualmente no piloto; uma análise automática de cobertura exige escopo e acesso confirmados.

| Critério de aceite | Evidência de conclusão |
| --- | --- |
| Pesquisar com rastreabilidade | Um tema retorna dados reais ou um arquivo de pesquisa identificado. Toda expressão exibida tem tipo, origem, mercado e data ou ausência explícita desses metadados. |
| Preservar significado | A amostra inclui variações equivalentes e intenções distintas. O revisor consegue separar grupos, recuperar os originais e identificar sugestões geradas. |
| Priorizar sem preencher lacunas | Notas possuem motivos. Com uma dimensão pendente, a prioridade final permanece null; a interface mostra a pendência. |
| Produzir briefing utilizável | Briefing contém público, problema, objetivo, promessa, perguntas, estrutura, formato, próxima ação, referências e validações. Um redator consegue utilizá-lo. |
| Preservar aprovação e versão | Uma edição posterior gera rascunho novo. A versão aprovada anterior e seu vínculo continuam acessíveis. |
| Entregar com confirmação | Aplicativo recebe a versão correta e devolve vínculo. Se houver apenas exportação, o estado permanece exported até confirmar a importação. |
| Recuperar falha sem duplicar | Repetir a mesma solicitação não duplica entrega. Falhas e resultados parciais continuam identificados. Acesso entre organizações é rejeitado. |

## Validação do piloto

Propor três temas do mesmo serviço, escolhidos com Rodrigues, para observar variações de problema e intenção. Registrar tempo até oportunidade aceita, correções de grupos, tempo de revisão, motivos de recusa e custo por briefing aprovado. Comparar com a forma atual de preparar pautas, sem fixar metas antes da linha de base.

Na etapa de campanhas, acompanhar visitas, conversões e avanço por conteúdo, material e período. Definir os denominadores com o aplicativo atual. Relatar associação e limitações de atribuição; não tratar aumento observado como efeito causal demonstrado do módulo.

## Confirmações para o encaixe no aplicativo

Para transformar o contrato proposto em tarefas de implementação, precisamos identificar somente a ferramenta atual e seu ponto de entrada editorial. A análise técnica deverá usar sua versão corrente, sem associá-la automaticamente a outros aplicativos da OnSet.

| Informação necessária agora | Como pode ser fornecida | O que permite decidir |
| --- | --- | --- |
| Nome e endereço da ferramenta | Nome e URL atual, inclusive ambiente de teste se houver. | Localizar a aplicação correta e reconhecer seu fluxo. |
| Base técnica acessível | Repositório ou arquivos do projeto. Se não estiverem disponíveis, informar plataforma de construção e responsável técnico. | Escolher módulo interno ou serviço e mapear dados, autenticação e tarefas. |
| Uso pretendido do briefing | Indicar onde o time trabalha hoje: editor, pauta, campanha, automação ou outro destino. | Definir campos, formato e confirmação de recebimento. |

## Verificações durante a análise técnica

Confirmar entidades e permissões existentes; entrada de briefing ou anexos; suporte a API, importação ou funções internas; disponibilidade de processamento no servidor; e mecanismos atuais de logs e versões. Só então detalhar alterações de tabelas, componentes, rotas e configuração.

Para uma integração direta com AnswerThePublic, confirmar elegibilidade da conta e consultar os formatos técnicos reais. A autorização para leitura de relatórios foi recebida nesta conversa. A leitura dos artigos privados permanece pendente de confirmação específica após bloqueio da revisão automática.

Verificação de acesso em 23/10/2026: o acesso autenticado ao projeto OnSet foi confirmado. Foram lidos os relatórios salvos de Governança de TI, IA para Service Desk e SOC. O painel exibia 40 pesquisas, 21 artigos planejados, 5 gerados e 0 publicados. São estados observados da conta, não resultados de desempenho.

## Fontes e continuidade

[R1] Relatório recebido: AnswerThePublic Inteligência de Conteúdo e Módulo de Leads, 23/10/2026, 10 páginas. Base de continuidade para fluxo, entregas, pesos e observação histórica de interface.

[F1] AnswerThePublic. Does AnswerThePublic Have an API. Atualização informada em 30/09/2026; revalidado em 23/10/2026.

https://answerthepublic.zendesk.com/hc/en-us/articles/15219088022555

[F2] AnswerThePublic. How AnswerThePublic Collects Data. Atualização informada em 09/10/2026; revalidado em 23/10/2026.

https://answerthepublic.zendesk.com/hc/en-us/articles/7299190956827

[F3] AnswerThePublic. AI Models Report in AnswerThePublic. Atualização informada em 09/10/2026; revalidado em 23/10/2026.

https://answerthepublic.zendesk.com/hc/en-us/articles/46695217018651

Vídeo fornecido: vimeo.com/1191894275. A página pública foi identificada como Meet the new AnswerThePublic; o conteúdo audiovisual não foi analisado e não sustenta decisões desta especificação.

## Observações dos relatórios salvos

[R2] Amostra lida na interface autenticada do projeto OnSet em 23/10/2026: Governança de TI, atualizado em 19/09; IA para Service Desk e SOC, atualizados em 18/09. Os três exibiam aviso de relatório gerado no plano anterior. A inspeção descreve essa amostra e não demonstra a ausência de filtros ou recursos em todas as áreas do produto.

| Observação direta | Implicação para o nosso módulo |
| --- | --- |
| Governança de TI mistura questões empresariais com curso, pós-graduação, vagas e salário. A mesma expressão aparece sob modificadores diferentes. | Classificar público e necessidade antes de sugerir pauta. Unificar expressões equivalentes mantendo ocorrências e modificadores; não somar volumes repetidos. |
| IA para Service Desk contém perguntas sobre salário e ramificações de RH e e-mail na árvore PAA. O shopping mostra escrivaninhas e estações de trabalho. | Preservar a relação pai e filho da árvore e verificar a pertinência de cada nó. Reconhecer que desk físico não corresponde ao serviço de TI e separar esses itens. |
| SOC mostra 110.0K no resumo, enquanto inclui soc login, soc sistema, soc shopee betim e outros termos de significados distintos. | Confirmar que SOC significa centro de operações de segurança no contexto do projeto. Não atribuir o volume do termo amplo à demanda de cibersegurança. |
| IA para Service Desk mostra volume 0 no resumo e na linha orgânica; CPC 0 no resumo e traço na linha. Há prompts de IA apresentados à parte. | Preservar escopo, campo e representação da origem. Não converter traço em zero nem inventar um motivo para a diferença. Prompts gerados não substituem evidência de procura. |
| Governança de TI mostra 10 de 673 linhas orgânicas e 10 de 25 prompts na vista inicial. Há aviso de limitação ligada ao plano anterior. | Registrar o conjunto efetivamente lido e a restrição de acesso. Contagem de linhas não equivale a perguntas únicas nem a cobertura completa do mercado. |

## Limites das métricas observadas

Os valores são os exibidos em relatórios históricos, e não consultas atualizadas de demanda. Data da leitura, data do relatório e período da métrica são campos separados. O período efetivo da métrica não foi confirmado nos trechos examinados. Não atualizar uma referência histórica para o mês anterior apenas porque a página foi aberta hoje.

O acesso ao detalhe de um prompt de Governança de TI mostrou intenção Comercial e sentimento EM BREVE. A presença de um campo ou ação não comprova uma análise concluída. Não foi validado um percurso completo de geração, revisão ou publicação de artigo nesta amostra.

## Critérios de qualidade para superar a amostra

A diretriz de produto definida com Rodrigues é melhorar a utilidade da decisão editorial. A superioridade será avaliada por pertinência das pautas, rastreabilidade, correções exigidas e tempo até briefing aprovado. A comparação inicial se limita aos casos observados; metas gerais dependem do piloto.

## Filtro anterior à priorização

Cada item recebe relevance_status: relevant, needs_review ou out_of_scope, com reason, meaning, audience, evidence_refs e classificação versionada. A classificação incerta não é descartada. O usuário pode corrigir o destino e registrar o motivo; as regras de exclusão ficam vinculadas ao contexto e ao objetivo da campanha.

O filtro considera significado, público, necessidade e relação com a oferta. A lista principal apresenta itens pertinentes; os demais continuam acessíveis em revisão ou fora de contexto. Um tema de carreira pode servir a recrutamento, mas não deve entrar automaticamente numa pauta destinada a compradores de serviços. Volume alto não contorna esse filtro.

| Caso do piloto | Comportamento esperado |
| --- | --- |
| 1 Móveis em Service Desk | Classificar escrivaninhas e estações de trabalho físicas como fora do contexto de suporte de TI, com motivo visível. |
| 2 Carreira em campanha empresarial | Separar vagas, salários e cursos quando o público definido for gestor contratante. Permitir revisão conforme outro objetivo. |
| 3 SOC ambíguo | Separar termos explicitamente ligados à Shopee. Encaminhar login ou sistema ambíguos para revisão antes de atribuir sentido de cibersegurança. |
| 4 Repetição e significado | Agrupar duplicações equivalentes de expressão. Preservar perguntas sobre preço, implantação, contratação e negação quando exigirem respostas distintas. |
| 5 Zero e ausência | Manter zero reportado e dado indisponível distintos, com a localização e o escopo da informação. Sinalizar diferenças entre resumo e linha. |
| 6 Prompt de IA | Mostrar que é sugestão gerada. Sua inclusão não aumenta a contagem de sinais de procura coletados. |
| 7 Amostra e atualização | Exibir data, alcance efetivamente analisado e aviso de limitação. Não anunciar como atuais os dados históricos. |
| 8 Briefing com justificativa | Levar ao redator a pergunta central, o público, o motivo da escolha, os sinais de apoio, os limites da evidência e a próxima ação. |

Esses casos serão uma amostra de referência revisada por Rodrigues e pelo responsável pelo conteúdo. São critérios propostos, ainda sem execução em um módulo implementado. Registrar aceitações e correções para aperfeiçoar a classificação; mudanças de regras e pesos continuarão explícitas e versionadas.
