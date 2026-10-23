# Leadcaps

Projeto específico da OnSet Tecnologia para prospecção e desenvolvimento do módulo de inteligência de conteúdo.

## Estado atual

A versão inicial organiza o HTML entregue por Rodrigues em fontes separadas, preservando o comportamento do console. O módulo de pesquisa de temas, oportunidades e briefings está especificado em `docs/especificacao-modulo-conteudo.md`; sua interface e seus serviços ainda serão implementados.

A versão 0.2 acrescenta o backend de bases: login, descrição obrigatória, data/hora do servidor, autoria e contatos preservados por importação. **Bases salvas** permite escolher qual pesquisa carregar, sem substituir ou combinar automaticamente cargas anteriores. Código preparado para Docker/PostgreSQL na VPS e frontend manual no Netlify; implantação em produção ainda pendente.

O console já oferece filtros por cargo, setor, porte, localização e faturamento, seleção de contatos, mapa do Brasil, importação CSV/XLSX, exportação Excel, geração de um HTML com a base atualizada e dossiê de empresa com análise de IA.

## Executar

Requer Node.js 24 ou superior. O frontend usa JavaScript nativo; o backend utiliza o driver PostgreSQL `pg`.

```bash
npm ci --ignore-scripts
npm run validate
npm start
```

Abra `http://127.0.0.1:8000`. O servidor disponibiliza somente `dist/`, evitando servir o repositório inteiro. Para outra porta, use `npm start -- --port=8001`.

`npm run build` produz `dist/index.html`, um HTML independente com três contatos fictícios. `npm run build:demo` faz a mesma compilação de demonstração. A interface identifica essa base como fictícia. A pasta `dist/` é gerada e não vai para o Git.

Para uso local com a base real, execute:

```bash
npm run import:html -- "caminho/OnSet_Console_Decisores_v3.html"
npm run build:local
npm start
```

A extração lê somente o JSON incorporado e não executa o HTML. O original e a base extraída ficam em `reference/private/` e `data/private/`, fora do Git. Os metadados do arquivo recebido, incluindo quantidade e hash, estão em `data/base.metadata.json`; os da última importação ficam na pasta privada.

## Estrutura

```text
src/template.html           Estrutura da interface
src/styles/console.css      Estilos existentes
src/js/app.js               Estado, filtros, telas e dossiê
src/js/ingest.js            Leitura e normalização de planilhas
src/js/database.js          Login e escolha de bases persistidas
src/js/xlsx-export.js       Geração de Excel
src/js/brazil-map.js        Geometria do mapa
src/assets/                Imagens incorporadas na compilação
data/                      Metadados e base privada local ignorada
examples/                  Planilha fictícia para testes
scripts/                   Compilação, execução e validação
tests/                     Testes de importação e portabilidade
backend/                   API, autenticação e migrações PostgreSQL
compose.yaml               Serviços e volume exclusivos do Leadcaps
docs/                      Arquitetura e especificação do módulo
reference/                 Orientações e HTML privado local ignorado
```

## Dados e acesso

O repositório Leadcaps criado por Rodrigues é público. Por isso, somente código, documentação, metadados e exemplos fictícios são publicados. A base recebida de 5.157 contatos contém nomes, cargos, empresas, e-mails reconstruíveis e perfis de LinkedIn e permanece fora do Git. Não publicar o HTML produzido por `build:local`. Planilhas de trabalho, exportações e arquivos `.env` também ficam fora do Git. O campo `private` do package.json impede publicar o pacote no npm e não muda a visibilidade do GitHub.

A análise de IA do HTML original solicita uma chave da Anthropic e faz a chamada diretamente do navegador. Essa chave começa vazia e fica na memória da aba. O novo backend trata bases e autenticação; ainda não oferece proxy de IA. Mover as consultas de IA para o servidor faz parte da próxima etapa editorial. Nenhuma consulta paga é necessária para executar os testes.

## Backend e Netlify

Para executar a partir do Windows, siga o [roteiro completo de PowerShell](docs/powershell.md): pasta local, primeira instalação na VPS, HTTPS, compilação, publicação manual, backup e atualizações.

Consulte [o contrato de bases](docs/bases-e-importacoes.md) e [as instruções de implantação](docs/implantacao.md). O Compose mantém PostgreSQL sem porta pública, API restrita ao loopback, volume e redes próprios. O endereço HTTPS da API e a origem exata do frontend precisam ser configurados para a implantação real. As credenciais e os contatos permanecem fora do Git.

O upload manual no Netlify usa a pasta `dist`, compilada com dados fictícios. Atualizar essa pasta não altera as bases salvas no banco. O workflow também disponibiliza o artefato `leadcaps-netlify-demo` para download depois das verificações.

Sem `TEST_DATABASE_URL`, o teste de integração de banco é indicado como ignorado; os demais executam localmente. No GitHub Actions, um PostgreSQL exclusivo permite executar a integração, além de validar o Compose e construir a imagem Docker.

## Próxima etapa

Implantar e validar a persistência na infraestrutura informada e implementar o ciclo tema → sinais com origem → classificação por pertinência → oportunidade → briefing revisado. O contexto editorial e o score de contatos são objetos diferentes: prioridade de conteúdo não qualifica uma pessoa automaticamente.

Os pesos e as regras do módulo são propostas próprias. A implementação não usa código nem algoritmo proprietário do AnswerThePublic.
