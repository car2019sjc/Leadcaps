# Leadcaps — execução e atualização pelo PowerShell

Escopo ativo: importação e escolha de bases no PostgreSQL. Para atualizar a instalação existente e retirar o módulo de conteúdo, siga [Atualizar bases](atualizar-bases.md).

## Onde fica cada parte

| Local | Conteúdo |
|---|---|
| GitHub: car2019sjc/Leadcaps | Código e documentação, sem a base real |
| Windows: C:\Projetos\Leadcaps | Sua cópia de trabalho, criada pelos comandos abaixo |
| VPS: /opt/leadcaps | Backend Docker e configuração privada |
| Volume leadcaps_postgres_data | PostgreSQL e bases importadas |
| Netlify | Somente o conteúdo da pasta dist, publicado manualmente |

O trabalho no chat não cria uma pasta automaticamente no seu Windows. Se você ainda não clonou ou baixou o repositório, crie a cópia conforme a etapa 2. Os comandos abaixo não foram executados no seu PC nem na VPS pelo assistente.

Os blocos `powershell` são executados no Windows. Depois de entrar por `ssh`, os blocos `bash` são executados no Linux da VPS, no mesmo terminal. `exit` encerra a conexão e retorna ao PowerShell. Faça uma etapa por vez; se um comando falhar, interrompa essa etapa e confira a mensagem antes de continuar.

## 1. Conferir os programas no Windows

Abra o PowerShell e execute:

```powershell
git --version
node --version
npm.cmd --version
ssh -V
```

São necessários Git, Node.js 24 ou superior (incluindo npm) e o cliente OpenSSH. Se algum programa não for encontrado, instale-o antes de prosseguir e abra novamente o PowerShell. Usamos `npm.cmd` para executar o npm no Windows sem depender da execução do arquivo `npm.ps1`.

## 2. Criar sua pasta local — uma vez

Primeiro confira:

```powershell
Test-Path 'C:\Projetos\Leadcaps'
```

Se retornar `False`, execute:

```powershell
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path 'C:\Projetos' -Force | Out-Null
git clone https://github.com/car2019sjc/Leadcaps.git 'C:\Projetos\Leadcaps'
if ($LASTEXITCODE -ne 0) { throw 'O download do projeto falhou.' }
Set-Location 'C:\Projetos\Leadcaps'
Get-ChildItem
```

Se retornar `True`, não repita o clone. Confira se essa pasta contém este projeto:

```powershell
git -C 'C:\Projetos\Leadcaps' remote -v
```

O destino `origin` deve ser `car2019sjc/Leadcaps` no GitHub. Não use uma pasta de outro aplicativo. O clone não baixa os 5.157 contatos privados; a compilação pública contém três contatos fictícios.

## 3. Conferir a VPS — leitura antes da instalação

No PowerShell, informe o destino SSH localmente, por exemplo `root@IP-DA-SUA-VPS`:

```powershell
$VpsDestino = Read-Host 'Destino SSH da VPS (usuario@IP)'
ssh $VpsDestino
```

Conclua a autenticação no terminal. Não envie senhas ou chaves privadas pelo chat. Já dentro da VPS, execute:

```bash
docker --version
docker compose version
git --version
openssl version
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
ss -ltnp 'sport = :8310'
free -h
df -h /opt
```

Confira se a porta 8310 está livre, se há recursos para o novo projeto e se o nome de projeto `leadcaps` já está em uso. Se já houver uma instalação do Leadcaps, use a etapa de atualização. Docker/Compose precisam estar disponíveis; este roteiro não reinstala o Docker nem modifica aplicações existentes.

## 4. Primeira instalação do backend — uma vez, dentro da VPS

O bloco usa o diretório exclusivo `/opt/leadcaps` e a porta 8310. Se a porta estiver ocupada, escolha outra e ajuste a variável `LEADCAPS_PORT` antes de executar. A URL solicitada é a origem real do frontend no Netlify, como `https://nome-do-seu-site.netlify.app`, sem barra final nem caminho. Não é o endereço da API.

Execute primeiro somente este comando e informe a URL quando for solicitada:

```bash
read -r -p 'URL HTTPS do frontend Netlify, sem barra final: ' LEADCAPS_ORIGIN
```

Depois cole o bloco de instalação:

```bash
set -euo pipefail
test ! -e /opt/leadcaps || { echo 'A pasta /opt/leadcaps já existe. Confira a instalação antes de continuar.'; exit 1; }
LEADCAPS_PORT=8310
test -z "$(ss -ltnH "sport = :$LEADCAPS_PORT")" || { echo 'A porta escolhida está ocupada.'; exit 1; }
git clone https://github.com/car2019sjc/Leadcaps.git /opt/leadcaps
cd /opt/leadcaps
umask 077
[[ "$LEADCAPS_ORIGIN" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]] || { echo 'URL inválida. Informe somente a origem HTTPS.'; exit 1; }
LEADCAPS_DB_PASSWORD=$(openssl rand -hex 32)
printf 'POSTGRES_PASSWORD=%s\nALLOWED_ORIGINS=%s\nAPI_PORT=%s\n' "$LEADCAPS_DB_PASSWORD" "$LEADCAPS_ORIGIN" "$LEADCAPS_PORT" > .env
unset LEADCAPS_DB_PASSWORD
chmod 600 .env
docker compose --project-name leadcaps config --quiet
docker compose --project-name leadcaps up -d --build --wait --wait-timeout 120
docker compose --project-name leadcaps ps
curl --fail "http://127.0.0.1:$LEADCAPS_PORT/health"
```

O resultado esperado da consulta é `{"status":"ok"}`. A senha do banco é gerada diretamente na VPS, sem aparecer no comando nem na tela. O arquivo `.env` fica fora do Git.

Crie o primeiro usuário do aplicativo, ainda dentro da VPS:

```bash
cd /opt/leadcaps
docker compose --project-name leadcaps exec api node backend/create-user.mjs rodrigues "Rodrigues"
```

Digite a senha quando o terminal solicitar; são necessários 12–200 caracteres. A entrada é oculta. Esse usuário é do aplicativo, separado do acesso SSH e do usuário PostgreSQL. Execute a criação uma única vez por login. Para cadastrar outra pessoa, escolha outro login e nome; nesta versão os usuários da mesma instância acessam as mesmas bases.

```bash
exit
```

Você voltou ao PowerShell do Windows.

## 5. Disponibilizar a API por HTTPS — configuração específica do ambiente

Para a instalação confirmada em `synapseia.com.br`, siga agora [HTTPS na VPS existente](https-vps.md). Esse roteiro usa o Caddy identificado e cria um gateway exclusivo do Leadcaps, sem mudar as redes do proxy compartilhado. As orientações genéricas abaixo continuam como referência para outros ambientes.

O backend fica restrito a `127.0.0.1:8310` na VPS (ou à porta que você escolheu). Para o frontend do Netlify acessá-lo, é necessário:

1. Definir um subdomínio para a API e apontar seu DNS para a VPS.
2. Configurar esse subdomínio e certificado no proxy existente, encaminhando para a porta do Leadcaps.
3. Permitir JSON de 10 MB no proxy e tempo suficiente para as importações.
4. Manter `ALLOWED_ORIGINS` com a URL exata usada para abrir o frontend.

Os comandos exatos do proxy dependem de ele ser Nginx, Caddy, Traefik ou outro, e de rodar no host ou em container. Essa configuração continua pendente até identificar o proxy e o subdomínio; não substitua a configuração global dos outros aplicativos. Se o proxy estiver em container, seu `127.0.0.1` aponta para o próprio container, e o encaminhamento deve considerar essa arquitetura.

Depois que o HTTPS estiver configurado, confira no PowerShell:

```powershell
$ApiUrl = (Read-Host 'Origem HTTPS da API, sem barra final').Trim().TrimEnd('/')
if ($ApiUrl -notmatch '^https://[A-Za-z0-9.-]+(:[0-9]+)?$') { throw 'Informe somente a origem HTTPS da API.' }
Invoke-RestMethod -Uri "$ApiUrl/health"
```

Resultado esperado: `status` com valor `ok`.

## 6. Preparar o frontend no Windows e publicar manualmente

Estes comandos pressupõem que a etapa 5 já definiu `$ApiUrl`. Se abrir outra janela do PowerShell, execute novamente o bloco que solicita e valida essa variável. A URL não é uma senha: pode constar no HTML público.

```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Projetos\Leadcaps'
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw 'A atualização do código falhou.' }
npm.cmd ci --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'A instalação das dependências falhou.' }
npm.cmd run validate
if ($LASTEXITCODE -ne 0) { throw 'A validação falhou.' }
if ($ApiUrl -notmatch '^https://[A-Za-z0-9.-]+(:[0-9]+)?$') { throw 'Defina a URL HTTPS da API na etapa 5.' }
$env:LEADCAPS_API_URL = $ApiUrl
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'A compilação falhou.' }
Remove-Item Env:LEADCAPS_API_URL
explorer.exe (Join-Path (Get-Location).Path 'dist')
```

No Netlify, abra o site existente, entre na área de deploy manual e arraste a pasta **dist**. Essa pasta contém `index.html`. Não arraste o repositório inteiro, a pasta `backups` ou um HTML gerado com `build:local`.

As verificações locais indicam o teste PostgreSQL como ignorado quando não existe `TEST_DATABASE_URL`. No GitHub Actions, esse teste roda com um banco de testes. Não configure a base de produção como banco de testes.

Após publicar: abra o site, clique em **Conectar banco**, confira o endereço da API e entre. Importe uma planilha com descrição, confira a confirmação e clique em **Usar esta base**. Recarregue a página, entre novamente e confira se a pesquisa permanece em **Bases salvas**.

## 7. Atualizações seguintes do backend, com backup antes

Não repita o clone nem a criação de `.env`. Abra o PowerShell e conecte:

```powershell
$VpsDestino = Read-Host 'Destino SSH da VPS (usuario@IP)'
ssh $VpsDestino
```

Dentro da VPS, execute o bloco. O dump binário é criado no Linux para preservar seus bytes; ele não passa por redirecionamento do PowerShell.

```bash
set -euo pipefail
cd /opt/leadcaps
test -f .env || { echo 'Configuração .env não encontrada.'; exit 1; }
test "$(git branch --show-current)" = main || { echo 'A instalação não está na branch main.'; exit 1; }
test -z "$(git status --porcelain --untracked-files=no)" || { echo 'Há alterações locais no código. Revise antes de atualizar.'; exit 1; }
umask 077
mkdir -p backups
chmod 700 backups
LEADCAPS_PARTIAL=$(mktemp "$PWD/backups/leadcaps-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.partial")
trap 'rm -f -- "$LEADCAPS_PARTIAL"' EXIT
docker compose --project-name leadcaps exec -T db pg_dump -U leadcaps -d leadcaps -Fc > "$LEADCAPS_PARTIAL"
test -s "$LEADCAPS_PARTIAL"
docker compose --project-name leadcaps exec -T db pg_restore --list < "$LEADCAPS_PARTIAL" > /dev/null
LEADCAPS_BACKUP="${LEADCAPS_PARTIAL%.partial}.dump"
mv "$LEADCAPS_PARTIAL" "$LEADCAPS_BACKUP"
git rev-parse HEAD > "$LEADCAPS_BACKUP.commit.txt"
sha256sum "$LEADCAPS_BACKUP" > "$LEADCAPS_BACKUP.sha256"
printf 'Backup verificado: %s\n' "$LEADCAPS_BACKUP"
git pull --ff-only
docker compose --project-name leadcaps config --quiet
docker compose --project-name leadcaps build api
docker compose --project-name leadcaps up -d --no-deps --wait --wait-timeout 120 api
docker compose --project-name leadcaps ps
LEADCAPS_PORT=$(awk -F= '$1 == "API_PORT" {print $2}' .env)
curl --fail "http://127.0.0.1:${LEADCAPS_PORT:-8310}/health"
git log -1 --oneline
exit
```

A atualização acima reconstrói somente a API. O banco permanece em seu volume, com as cargas existentes. A verificação do dump lê seu catálogo; um ensaio completo de restauração em banco separado continua sendo uma atividade operacional necessária. Caso a saúde da API falhe, guarde a mensagem e o commit informado; não recrie o banco para tentar corrigir o código.

Para copiar os backups e os registros do commit para seu PC, já de volta ao PowerShell:

```powershell
$BackupPc = 'C:\Projetos\Leadcaps\backups'
New-Item -ItemType Directory -Path $BackupPc -Force | Out-Null
scp "${VpsDestino}:/opt/leadcaps/backups/leadcaps-*" $BackupPc
if ($LASTEXITCODE -ne 0) { throw 'A cópia dos backups falhou.' }
```

Essa pasta fica fora do Git. Seus arquivos contêm dados privados; não os inclua no upload ao Netlify. A cópia no PC deve ser mantida conforme sua rotina de proteção de backups.

Para atualizar também a interface, repita a etapa 6 e faça o drag and drop da nova pasta `dist`. Atualizar a interface não apaga as bases do PostgreSQL.

## 8. Consulta rápida de estado e erros

No PowerShell:

```powershell
$VpsDestino = Read-Host 'Destino SSH da VPS (usuario@IP)'
ssh $VpsDestino "cd /opt/leadcaps && docker compose --project-name leadcaps ps"
ssh $VpsDestino "cd /opt/leadcaps && docker compose --project-name leadcaps logs --tail=80 api"
```

Se `$ApiUrl` estiver definido:

```powershell
Invoke-RestMethod -Uri "$ApiUrl/health"
```

O processo não usa `docker system prune`, remoção de volumes nem comandos para parar outros projetos. Não use `docker compose down -v` na produção, pois removeria o volume do banco deste aplicativo.

## Referências

- [Variáveis de ambiente no PowerShell](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables)
- [Docker Compose up e preservação de volumes](https://docs.docker.com/reference/cli/docker/compose/up/)
- [Deploy manual no Netlify](https://docs.netlify.com/deploy/create-deploys/)
