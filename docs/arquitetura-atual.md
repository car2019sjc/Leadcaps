# Arquitetura confirmada no arquivo recebido

## Aplicação atual

- Aplicação estática em HTML, CSS e JavaScript, executada no navegador.
- Quatro blocos principais: exportação XLSX, importação/classificação, mapa e interface.
- Dados em formato de dicionários e colunas, hidratados na memória.
- A base contém 5.157 registros; a data declarada no código é 21/10/2026.
- Não há backend, banco de dados, autenticação, cadastro de campanhas nem armazenamento persistente identificados neste arquivo.
- Importação substitui ou adiciona dados na sessão. A função de salvar gera outro HTML com a base incorporada.
- A chamada de IA existente usa Anthropic no navegador; a chave não está gravada no HTML.
- Fontes tipográficas vêm do Google Fonts. Links de e-mail, pesquisa e LinkedIn abrem serviços externos.

## Decisões desta migração

Manter JavaScript nativo e o HTML portátil. Separar fontes, dados e ferramentas de compilação. Preservar o original para comparação. Não recalibrar scores, alterar a classificação de contatos ou executar consultas pagas nesta etapa.

A serialização da base incorporada passa a escapar o caractere `<`, preservando textos de planilhas que contenham sequências como fechamento de tag de script. Isso evita quebrar a estrutura do HTML regenerado.

## Evolução 0.2 — nova implementação própria

Rodrigues definiu backend Docker/PostgreSQL em VPS compartilhada e frontend atualizado manualmente no Netlify. O código agora inclui uma API Node.js com autenticação e snapshots de importações, além da biblioteca de bases no console. Não altera a constatação sobre o HTML original: estas funções foram acrescentadas neste repositório.

O banco é exclusivo do projeto. As cargas mantêm descrição obrigatória, data/hora do servidor, usuário autenticado, arquivo de origem, hash e contagem. Salvar e carregar são ações separadas. Não há deduplicação nem substituição entre bases persistidas. O modo local herdado continua disponível e identificado como temporário.

O [contrato](bases-e-importacoes.md) e o [plano de implantação](implantacao.md) distinguem código implementado, configuração proposta e validação ainda necessária na VPS. Não houve implantação em produção nesta etapa.

## Escopo ativo 0.5

Rodrigues encerrou o módulo de inteligência de conteúdo em 23/10/2026. O console original e a persistência de bases seguem ativos. A API atende apenas autenticação, importações e saúde do banco. As tabelas editoriais já existentes permanecem inativas, preservadas; novas instalações criam apenas as tabelas de bases e acesso.
