# Pesquisa automática de temas e dúvidas — correção de escopo

Rodrigues / OnSet Tecnologia — 23/10/2026.

**Estado: plano funcional e técnico; a coleta descrita abaixo ainda não foi implementada.** A versão 0.3 já gera oportunidades e briefings, mas recebe expressões manualmente ou trabalha como hipótese. O piloto demonstrou que esse recorte não entrega o núcleo solicitado a partir do AnswerThePublic. A prioridade passa a ser pesquisa e exploração das evidências, antes de ampliar a redação de conteúdo.

## Objetivo de produto

O usuário informa um tema, idioma, mercado e contexto empresarial; o aplicativo consulta fontes de busca, organiza as expressões observadas, permite investigar perguntas e intenções e explica as oportunidades. O briefing é a etapa posterior à escolha de uma oportunidade sustentada por esse percurso.

Um agente com ferramentas e dados também pode realizar parte desse trabalho. O valor do aplicativo deve estar na coleta repetível, organização explorável, histórico comparável, origem verificável, filtros de contexto e ligação com o público selecionado. Não atribuir vantagem exclusiva à geração por IA nem afirmar superioridade ao AnswerThePublic sem um piloto comparativo.

## Estado conferido no código

| Capacidade | Estado da 0.3 |
| --- | --- |
| Bases de contatos preservadas, autenticação e seleção por filtros | Implementado. |
| Perfil agregado do filtro atual | Implementado e opcional; inclui referência `base_id` quando a base foi salva. |
| Expressões de pesquisa | Coladas pelo usuário com fonte e data declaradas; sem consulta automática. |
| Normalização e repetição textual | Implementação conservadora, preservando o original. |
| Mapa explorável e grupos de dúvidas editáveis | Não implementado; a IA retorna de 1 a 3 oportunidades. |
| Volume, CPC e evolução da procura | Sem coleta; volume e CPC ficam indisponíveis. |
| Revisão de oportunidade e critérios de prioridade | Implementado; inferências, pesos propostos e pendências explícitos. |
| Briefing, versões, aprovação e exportação | Implementado; Rodrigues relatou a geração no piloto. |
| Campanhas e retorno comercial | Não implementado. |

Há vínculo opcional de origem pelo perfil da base; falta guardar os critérios exatos do segmento e oferecer navegação entre pesquisa e público. A lista de contatos não demonstra o que essas pessoas pesquisaram.

## Primeira entrega a implementar

| Ação do usuário | Decisão e processamento | Resultado verificável |
| --- | --- | --- |
| Informar tema, Brasil/português e serviço/público | Preparar termos e variantes para consulta; separar termos sugeridos por IA dos resultados observados | Plano de consulta editável, fonte habilitada e quantidade de requisições previstas. |
| Clicar em Pesquisar | Coletar sugestões de busca e preservar origem, parâmetros, horário e estado de cada consulta | Tabela de expressões realmente retornadas; sucesso, ausência de resultados e falha separados. |
| Explorar os resultados | Normalizar sem perder sentido; propor agrupamentos por pergunta, problema e intenção | Mapa de temas com acesso à lista de expressões de cada grupo, filtros e correções de união/divisão. |
| Examinar uma expressão | Recuperar métricas quando disponíveis e compatíveis com idioma/local | Métrica com plataforma medida, provedor, período e moeda; ausências explícitas. |
| Avaliar um grupo | Aplicar pertinência ao negócio antes da prioridade; explicar ambiguidades e exclusões | Necessidade, público provável, intenção inferida, fontes utilizadas e justificativas. |
| Selecionar oportunidade | Reutilizar o fluxo editorial existente, levando as referências e revisões | Briefing ligado aos sinais e ao grupo escolhido; pendências preservadas. |

Primeiro recorte de fonte: sugestões do Google e métricas de Google Ads quando disponíveis. Outras plataformas entram depois da validação dessa coleta. Não apresentar dados de Google Ads como volume de YouTube, redes sociais ou de uma população de CIOs.

## Fonte de dados e decisão ainda necessária

**Recomendação técnica preliminar: um provedor independente do AnswerThePublic**, com adaptadores substituíveis. DataForSEO documenta Google Autocomplete e Google Ads Search Volume; SerpAPI documenta Google Autocomplete. Não há integração instalada com esses provedores. A credencial Anthropic atual interpreta e escreve; não fornece automaticamente esse conjunto de dados.

O AnswerThePublic também documenta uma API Alpha. É alternativa de fornecimento se a conta tiver plano elegível e se for aceita a dependência desse fornecedor; endpoints e limites reais devem ser examinados na documentação da conta. Não é acesso ao código ou algoritmo proprietário. Não presumir elegibilidade de uma conta em teste ou de plano vitalício.

Antes de chamadas reais, confirmar acesso à fonte, condições de uso/armazenamento e orçamento do piloto. Uma chave de pesquisa será configurada de forma privada na VPS. Não contratar serviço nem adicionar saldo como parte deste plano.

As páginas atuais da DataForSEO informam cobrança por uso, crédito de teste de US$ 1 para novas contas e recarga mínima de US$ 50. Crédito de teste e sandbox não equivalem à validação de uma integração em produção; o sandbox retorna exemplos. A disponibilidade efetiva deve ser conferida na conta. Não estimar um custo por pesquisa sem fixar endpoints, modo de execução e número de requisições.

## Contrato e implantação propostos

Reutilizar Node.js, PostgreSQL, autenticação, gateway, redes exclusivas, frontend HTML e publicação manual existentes. A busca precisa rodar na VPS. Não executar coleta pelo navegador do usuário nem expor credenciais no HTML. A implementação seguinte deve acrescentar migrações, sem reescrever as pesquisas ou os briefings da 0.3.

| Objeto | Informação a preservar |
| --- | --- |
| Execução de pesquisa | Contexto, tema, idioma, localização, plano de consultas, autor, datas, fonte, orçamento/reserva e estados. |
| Consulta de origem | Termo enviado, parâmetros, ID do provedor, horário, estado, custo informado e resposta sanitizada quando permitido. |
| Expressão e ocorrências | Texto original, normalizado, fonte/plataforma, consultas de origem e data; repetições vinculadas sem apagar ocorrências. |
| Métrica | Expressão exata, plataforma medida, provedor, local, idioma, período, unidade/moeda e estado do valor. |
| Grupo e revisão | Membros, problema, pergunta, intenção inferida, pertinência, justificativa e autor humano/IA. |
| Público de referência | Base salva, critérios do filtro, resumo agregado e data; sem atribuir interesse individual. |

O adaptador retorna dados e estados; não produz texto inventado para completar uma fonte vazia. O limite atual de 80 expressões da pesquisa editorial não deve provocar descarte silencioso de uma coleta maior. Guardar os sinais em estrutura paginável e definir um contrato versionado de evidências selecionadas para as etapas de oportunidade e briefing, mantendo compatibilidade com os registros anteriores.

A fila de coleta deve ter orçamento e estados separados das gerações Anthropic. Mostrar o plano e o limite de consultas antes da execução. Registrar falhas parciais e consumo incerto; não repetir automaticamente operações de custo desconhecido. Cache depende dos parâmetros e das condições do provedor; uma execução reutilizada deve mostrar a data original.

## Regras de inteligência e apresentação

- Exibir três naturezas de informação: coletada da fonte, classificação inferida e sugestão gerada por IA.
- Um resultado de autocomplete é uma sugestão observada, não uma contagem de usuários nem comprovação de frequência. Contagem de ocorrências é apenas da amostra coletada.
- Usar estados de métrica distintos para valor informado, zero reportado, indisponível e falha. Mostrar o período efetivo do provedor; não importar automaticamente a regra de período do AnswerThePublic para outro serviço.
- Preservar negação, comparação, preço, prazo, cenário e localidade quando mudarem a resposta necessária. Corrigir siglas ambíguas e permitir ver os itens excluídos com seu motivo.
- Oferecer mapa por tema/intenção e tabela filtrável. A visualização serve para abrir e examinar evidências; quantidade e aparência de uma roda não validam demanda.
- Prioridade e qualidade da evidência continuam separadas. Pesos 30/25/20/15/10 são proposta do piloto, e dimensões sem avaliação permanecem pendentes.
- Biblioteca ausente não confirma lacuna editorial. Ampliar a análise de cobertura somente quando houver materiais e escopo de exame registrados.

## Critérios de aceite do próximo piloto

1. Um tema iniciado no aplicativo deve executar ao menos uma coleta real e mostrar as expressões retornadas com origem e data. Não exigir que Rodrigues procure e cole os resultados manualmente.
2. Uma coleta vazia deve aparecer como concluída sem resultados; falha deve aparecer como falha. Nenhuma delas pode ser preenchida com supostos resultados de IA.
3. Deve ser possível navegar de um grupo para cada expressão original, corrigir o agrupamento e examinar itens fora de contexto.
4. Perguntas sobre redução de incidentes e sobre preço de terceirização podem se relacionar, mas preservam intenções e pautas distintas.
5. Uma métrica inexistente permanece indisponível. Se existir, sua origem e seu período precisam ser verificáveis e independentes da origem da sugestão.
6. Oportunidade e briefing devem carregar referências estáveis da pesquisa. Registros e versões anteriores permanecem consultáveis.
7. Pesquisas do mesmo tema em datas distintas devem permitir comparar o conjunto observado, sem apresentar essa diferença como tendência populacional medida.
8. Avaliar uma amostra dos relatórios OnSet já observados: duplicações, siglas ambíguas, conteúdo fora do serviço e variações relevantes. A melhoria depende dessa comparação, não da autoconfiança da IA.

## Referências oficiais revalidadas em 23/10/2026

- AnswerThePublic, escopo e elegibilidade da API: https://answerthepublic.zendesk.com/hc/en-us/articles/15219088022555-Does-AnswerThePublic-Have-an-API
- DataForSEO, Google Autocomplete: https://docs.dataforseo.com/v3/serp-google-autocomplete-live-advanced/
- DataForSEO, Google Ads Search Volume: https://docs.dataforseo.com/v3/keywords_data-google_ads-search_volume-live/
- DataForSEO, cobrança e teste: https://dataforseo.com/pricing
- SerpAPI, Google Autocomplete: https://serpapi.com/google-autocomplete-api
