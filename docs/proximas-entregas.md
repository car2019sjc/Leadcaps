# Desenvolvimento do módulo

A versão 0.3 implementa um primeiro recorte deste roteiro. Estado e instalação em [Módulo de conteúdo](modulo-conteudo.md). A entrada de pesquisa é manual com fonte/data; coleta automática, gestão completa de grupos e campanhas continuam futuras. Pesos e interpretações precisam de validação editorial no piloto.

1. Implantar a API e o PostgreSQL exclusivos na VPS, depois de confirmar HTTPS, proxy, origem Netlify e acesso operacional. Validar backup e retomada de bases.
2. Confirmar se todos os usuários devem compartilhar as bases (comportamento implementado na v1) ou se serão necessárias permissões por base. Confirmar o destino do briefing.
3. Acrescentar contexto empresarial e contexto de público a partir dos filtros escolhidos.
4. Implementar importação de sinais reais com fonte, mercado, data e estado das métricas.
5. Implementar pertinência antes da prioridade: relevante, revisão ou fora de contexto.
6. Agrupar equivalentes sem perder variações de intenção; preservar evidências e correções.
7. Selecionar oportunidade e produzir briefing com referências e validações pendentes.
8. Aprovar versão e exportar briefing; confirmar recebimento se houver outro sistema de destino.

Critérios do piloto estão na especificação. Siglas ambíguas, móveis em Service Desk, termos de carreira, duplicações e ausência de métricas integram a amostra de validação. A produção de artigos e a leitura de resultados de campanha serão etapas posteriores.
