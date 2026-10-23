# Leadcaps

Projeto específico da OnSet Tecnologia para prospecção e desenvolvimento do módulo de inteligência de conteúdo.

## Estado atual

A versão inicial organiza o HTML entregue por Rodrigues em fontes separadas, preservando o comportamento do console. O módulo de pesquisa de temas, oportunidades e briefings está especificado em `docs/especificacao-modulo-conteudo.md`; sua interface e seus serviços ainda serão implementados.

O console já oferece filtros por cargo, setor, porte, localização e faturamento, seleção de contatos, mapa do Brasil, importação CSV/XLSX, exportação Excel, geração de um HTML com a base atualizada e dossiê de empresa com análise de IA.

## Executar

Requer Node.js 24 ou superior. Não há pacotes de terceiros para instalar.

```bash
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
src/js/xlsx-export.js       Geração de Excel
src/js/brazil-map.js        Geometria do mapa
src/assets/                Imagens incorporadas na compilação
data/                      Metadados e base privada local ignorada
examples/                  Planilha fictícia para testes
scripts/                   Compilação, execução e validação
tests/                     Testes de importação e portabilidade
docs/                      Arquitetura e especificação do módulo
reference/                 Orientações e HTML privado local ignorado
```

## Dados e acesso

O repositório Leadcaps criado por Rodrigues é público. Por isso, somente código, documentação, metadados e exemplos fictícios são publicados. A base recebida de 5.157 contatos contém nomes, cargos, empresas, e-mails reconstruíveis e perfis de LinkedIn e permanece fora do Git. Não publicar o HTML produzido por `build:local`. Planilhas de trabalho, exportações e arquivos `.env` também ficam fora do Git. O campo `private` do package.json impede publicar o pacote no npm e não muda a visibilidade do GitHub.

A análise de IA do HTML original solicita uma chave da Anthropic e faz a chamada diretamente do navegador. Essa chave começa vazia e fica na memória da aba. Esta migração preserva esse comportamento; não adiciona autenticação, backend ou novas chamadas de IA. O próximo desenho deverá mover credenciais e consultas para o servidor antes de uma operação compartilhada. Nenhuma consulta paga é necessária para executar os testes.

## Próxima etapa

Confirmar o modo de uso do console e implementar o ciclo tema → sinais com origem → classificação por pertinência → oportunidade → briefing revisado. O contexto editorial e o score de contatos são objetos diferentes: prioridade de conteúdo não qualifica uma pessoa automaticamente.

Os pesos e as regras do módulo são propostas próprias. A implementação não usa código nem algoritmo proprietário do AnswerThePublic.
