# Leadcaps

Console de prospecção da OnSet Tecnologia com bases de contatos preservadas no PostgreSQL.

## Escopo ativo — versão 0.5.1

Rodrigues encerrou o módulo de inteligência de conteúdo em 23/10/2026. O projeto mantém o console original e a gestão de bases: login, importação Excel/CSV, descrição obrigatória, data/hora do servidor, autoria, consulta e escolha de qual base carregar. Cada carga é independente; uma importação não apaga, combina nem ativa automaticamente outras pesquisas.

Em **Bases salvas**, **Atualizar lista** mostra horário e quantidade consultada. **Excluir base** permite remover permanentemente uma carga importada pelo próprio usuário, após confirmação. Excluir a carga ativa também a retira do painel; as demais permanecem salvas.

O console oferece filtros por cargo, setor, porte, localização e faturamento, seleção de contatos, mapa do Brasil e exportação Excel. As regras originais de classificação e score não foram recalibradas. O dossiê opcional herdado do HTML é separado do módulo editorial retirado; a API de bases não possui integrações com fornecedores de IA ou pesquisa.

## Atualizar a instalação existente

Siga [Atualizar bases — PowerShell, VPS e Netlify](docs/atualizar-bases.md). A atualização verifica backup e recria somente a API do Leadcaps. As bases, o volume PostgreSQL e os outros aplicativos da VPS são preservados. As tabelas editoriais antigas ficam inativas, sem exclusão de dados. Novas instalações criam somente acesso e bases.

O frontend continua sendo publicado manualmente no Netlify. O upload de `dist` não modifica os contatos salvos no banco.

## Executar

Requer Node.js 24 ou superior.

```bash
npm ci --ignore-scripts
npm run validate
npm start
```

Abra `http://127.0.0.1:8000`. `npm run build` gera `dist/index.html`, um HTML portátil com três contatos fictícios. O servidor local disponibiliza somente `dist`.

Para uso privado com o HTML original:

```bash
npm run import:html -- "caminho/OnSet_Console_Decisores_v3.html"
npm run build:local
npm start
```

Nunca publique o resultado de `build:local`. O repositório é público; planilhas reais, contatos, HTML original, `.env` e backups ficam fora do Git. O pacote original recebido tinha 5.157 contatos e permanece separado do exemplo público. A escolha das bases reais ocorre pelo aplicativo autenticado.

## Documentação

- [Contrato de bases e importações](docs/bases-e-importacoes.md)
- [Operação pelo PowerShell](docs/powershell.md)
- [Implantação e isolamento Docker](docs/implantacao.md)
- [Gateway HTTPS existente](docs/https-vps.md)
- [Arquitetura e evolução](docs/arquitetura-atual.md)

## Verificação

`npm run validate` verifica sintaxe, contratos, autenticação, importação, exportação e compilação. Sem `TEST_DATABASE_URL`, a integração PostgreSQL é indicada como ignorada. No GitHub Actions, banco exclusivo e navegador verificam preservação de bases, atualização de uma instalação antiga, retirada das rotas editoriais e operação da interface. O workflow também valida Docker e o gateway HTTPS. Não são necessárias chamadas pagas.
