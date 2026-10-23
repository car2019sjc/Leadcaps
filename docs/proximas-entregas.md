# Desenvolvimento do módulo

## Entrega 0.4.1: primeiro piloto de descoberta

A [pesquisa automática com Serper/SerpAPI](pesquisa-automatica.md) implementa coleta de Google Autocomplete, mapa por regras linguísticas, revisão humana, comparação de amostras e seleção rastreável para o fluxo editorial. Inclui configuração privada pelo PowerShell e atualização isolada da API. O piloto real ainda precisa confirmar a utilidade dos resultados. Métricas, agrupamento semântico, outras fontes e critérios completos do segmento continuam pendentes. As prioridades abaixo registram o plano que motivou essa entrega; não significam que todos os itens já foram concluídos.

A versão 0.3 implementa o fluxo editorial, com entrada manual e geração de hipóteses. Rodrigues relatou a geração de um briefing, mas o piloto confirmou que esse recorte não entrega a pesquisa de temas e dúvidas solicitada a partir do AnswerThePublic. A [correção de escopo e os critérios de aceite](pesquisa-automatica-prioridade.md) passam a orientar a próxima entrega. Instalação e uso da versão existente continuam em [Módulo de conteúdo](modulo-conteudo.md).

## Prioridade imediata: descoberta com evidências

1. Confirmar acesso, condições e orçamento de uma fonte de pesquisa; a chave Anthropic não substitui esse acesso. Preparar adaptador independente, com Google Autocomplete como primeiro recorte e métricas separadas quando disponíveis.
2. Implementar coleta automática com origem, datas, parâmetros, custo informado, ausência de resultados e falhas parciais. Não exigir colagem manual para o uso principal.
3. Entregar tabela e mapa de dúvidas, grupos por problema/intenção, filtros de contexto, correção de agrupamento e acesso aos originais.
4. Acrescentar métricas com plataforma, período e estados explícitos; sem converter ausências em zero ou sugestões em frequência de busca.
5. Vincular sinais e revisões às oportunidades e aos briefings já existentes. Preservar a referência da base no perfil e acrescentar os critérios exatos do segmento.
6. Validar o percurso tema → coleta → mapa → evidências → oportunidade → briefing em um piloto real. Não considerar apenas o texto gerado como aceite dessa etapa.

Artigos, campanhas e aperfeiçoamento cosmético do briefing deixam de ser a próxima prioridade. São entregas posteriores à validação da descoberta.

## Roteiro anterior, preservado como referência

1. Implantar a API e o PostgreSQL exclusivos na VPS, depois de confirmar HTTPS, proxy, origem Netlify e acesso operacional. Validar backup e retomada de bases.
2. Confirmar se todos os usuários devem compartilhar as bases (comportamento implementado na v1) ou se serão necessárias permissões por base. Confirmar o destino do briefing.
3. Acrescentar contexto empresarial e contexto de público a partir dos filtros escolhidos.
4. Implementar importação de sinais reais com fonte, mercado, data e estado das métricas.
5. Implementar pertinência antes da prioridade: relevante, revisão ou fora de contexto.
6. Agrupar equivalentes sem perder variações de intenção; preservar evidências e correções.
7. Selecionar oportunidade e produzir briefing com referências e validações pendentes.
8. Aprovar versão e exportar briefing; confirmar recebimento se houver outro sistema de destino.

Critérios do piloto estão na especificação. Siglas ambíguas, móveis em Service Desk, termos de carreira, duplicações e ausência de métricas integram a amostra de validação. A produção de artigos e a leitura de resultados de campanha serão etapas posteriores.
