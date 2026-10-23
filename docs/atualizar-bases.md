# Atualização 0.5 — somente bases de dados

Rodrigues encerrou o módulo de inteligência de conteúdo em 23/10/2026. Esta atualização retira suas telas, rotas, filas e configurações do código ativo. A API atende autenticação, bases e saúde do banco. O console original continua com filtros, importação, escolha de bases e exportações.

Cada Excel/CSV continua sendo uma carga independente, com descrição obrigatória, autoria e data/hora do servidor. Salvar outra pesquisa não combina nem substitui automaticamente as anteriores. O usuário escolhe qual base carregar no painel. Atualizar os contatos significa importar outra versão identificada; não existe sincronização automática por pessoa nesta versão.

## 1. Atualizar a API pelo PowerShell do Windows

```powershell
ssh root@177.153.38.233 'cd /opt/leadcaps && git pull --ff-only && bash deploy/update-bases.sh'
if ($LASTEXITCODE -ne 0) { throw 'Atualização da API interrompida. Confira a mensagem.' }
```

O script cria e verifica um dump PostgreSQL, preserva a configuração privada e registra a imagem anterior. Depois compila e atualiza somente a API do Leadcaps. Usa o Compose padrão, incluindo o override do gateway existente. Não recria o banco, não remove volumes e não atua sobre outros projetos da VPS. A checagem final deve retornar `{"status":"ok"}`.

As tabelas editoriais já instaladas e as versões 002/003 registradas no banco permanecem preservadas e inativas. Nenhum `DROP`, limpeza de filas ou rollback destrutivo é executado. Novas instalações criam apenas o esquema 001 de acesso e bases. Os arquivos SQL antigos continuam no repositório como referência de compatibilidade e testes; não devem ser executados manualmente.

O Compose deixa de passar credenciais Anthropic, Serper e SerpAPI para a API. Linhas antigas no `.env` e backups privados não são apagadas por esta atualização. Nenhum serviço editorial é iniciado e as rotas antigas retornam 404 após autenticação. A retirada do módulo só estará aplicada na VPS depois da atualização acima.

## 2. Compilar o frontend no Windows

```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Projetos\Leadcaps'
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw 'Falha ao atualizar o código.' }
npm.cmd ci --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependências.' }
$env:LEADCAPS_API_URL = 'https://api-leadcaps.synapseia.com.br'
try {
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Falha na compilação.' }
} finally {
    Remove-Item Env:LEADCAPS_API_URL -ErrorAction SilentlyContinue
}
explorer.exe 'C:\Projetos\Leadcaps'
```

Publique somente a pasta `dist` no projeto Leadcaps existente no Netlify, pelo upload manual. O HTML público contém três contatos fictícios; os contatos reais continuam no banco. Não publique `build:local` nem o repositório inteiro.

## 3. Conferir

Abra https://leadcaps.synapseia.com.br, atualize com Ctrl+F5 e entre em **Conectar banco**. O botão **Inteligência de conteúdo** deve ter desaparecido. Abra **Bases salvas** e escolha uma base existente; confira descrição, quantidade, usuário e horário. Novas importações continuam exigindo descrição e sua ativação no painel depende da escolha do usuário.

O código e os documentos anteriores permanecem no histórico Git, caso sejam necessários para auditoria. Essa preservação não reativa o módulo nem agenda seu desenvolvimento.
