# HTTPS do Leadcaps na VPS existente

Ambiente confirmado em 23/10/2026: frontend `https://leadcaps.synapseia.com.br`, API `https://api-leadcaps.synapseia.com.br`, VPS `177.153.38.233`, projeto `/opt/leadcaps`. O Caddy compartilhado é `synapse-caddy`, na rede `synapse-network`, com bind mount `/opt/synapse-drive-webapp/infra/Caddyfile` → `/etc/caddy/Caddyfile`. O DNS A da API precisa continuar apontando para a VPS. Não reutilizar `api.leads.synapseia.com.br`, que pertence a outro serviço.

## Funcionamento

O instalador cria `compose.override.yaml` somente em `/opt/leadcaps`. O Compose o lê automaticamente junto de `compose.yaml`. O arquivo adiciona um gateway HTTP exclusivo do Leadcaps, usando a imagem oficial `caddy:2-alpine`, sem porta publicada no host. Limites: 96 MiB de memória e 0,20 CPU; logs limitados a dois arquivos de 5 MiB.

| Serviço | Redes | Acesso |
|---|---|---|
| Caddy compartilhado | synapse-network, já existente | HTTPS público e gateway |
| leadcaps-gateway | synapse-network e leadcaps_edge | Encaminha somente para api:8080 |
| API Leadcaps | leadcaps_edge e leadcaps_database | Gateway e localhost:8310 |
| PostgreSQL Leadcaps | leadcaps_database, interna | Somente API, sem porta publicada |

A comunicação pelo gateway usa HTTP dentro das redes Docker da VPS. O gateway é o único componente novo conectado à rede compartilhada. A configuração de serviços, redes e volumes do Compose de `/opt/synapse-drive-webapp/infra` permanece sob a gestão daquele projeto. A alteração no Caddy compartilhado é um bloco delimitado para o domínio da API; sua ativação usa `validate` e `reload`, sem reiniciar o proxy.

O instalador também acrescenta a origem HTTPS do frontend a `ALLOWED_ORIGINS`, preservando as origens anteriores e a senha PostgreSQL. A recriação necessária da API encerra conexões em andamento; execute sem importações ativas. Não há migração nem build da API nesta etapa, e o PostgreSQL não é recriado.

## Ativar, no terminal Linux da VPS

Os comandos pressupõem acesso root já autenticado e a instalação existente saudável. Python 3 e Docker Compose são necessários; não há dependências Python adicionais.

```bash
cd /opt/leadcaps
git pull --ff-only
python3 deploy/enable_https.py --apply
```

Execute um comando por vez e interrompa se houver erro. O instalador não assume que o Caddyfile em disco corresponde à configuração ativa: compara ambos antes de alterar. Havendo divergência, override desconhecido, rota existente sem os marcadores do instalador ou conflito de alias, interrompe para revisão.

Antes de alterar, salva `.env`, Caddyfile e eventual override anterior em `backups/https-<data>-<identificador>/`, com acesso restrito e fora do Git. Ao escrever o Caddyfile mantém seu inode, necessário para o bind mount de arquivo único. Depois verifica o merge real do Compose, preservação dos serviços e volumes, saúde da API pelo gateway e CORS, valida o Caddyfile e recarrega o Caddy.

Se uma etapa de ativação falhar, tenta restaurar os arquivos e serviços envolvidos. A mensagem informa se a restauração terminou ou também falhou; guarde o caminho do backup. Não use `docker compose down`, remoção de volumes ou limpeza global como solução.

O sucesso do instalador confirma a configuração local. **DNS, emissão do certificado e acesso HTTPS externo precisam do teste seguinte**. O instalador não altera o DNS nem desativa validação de certificados.

```bash
curl --fail --show-error --max-time 20 https://api-leadcaps.synapseia.com.br/health

curl --fail --show-error --max-time 20 -i -X OPTIONS \
  -H 'Origin: https://leadcaps.synapseia.com.br' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type' \
  https://api-leadcaps.synapseia.com.br/v1/sessions
```

Esperados: `{"status":"ok"}`, preflight com status 204 e cabeçalho `Access-Control-Allow-Origin: https://leadcaps.synapseia.com.br`. Se o certificado ainda estiver sendo emitido, consulte `docker logs --tail 80 synapse-caddy`; não use `curl -k`.

## Atualizar o frontend, no PowerShell do Windows

Depois de confirmar o HTTPS:

```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Projetos\Leadcaps'
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw 'Falha ao atualizar o código.' }
$env:LEADCAPS_API_URL = 'https://api-leadcaps.synapseia.com.br'
try {
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Falha na compilação.' }
} finally {
    Remove-Item Env:LEADCAPS_API_URL -ErrorAction SilentlyContinue
}
explorer.exe 'C:\Projetos\Leadcaps\dist'
```

Arraste `dist` para a área de deploy manual do projeto Leadcaps já existente no Netlify. A compilação pública continua com três contatos fictícios. No aplicativo publicado, clique em **Conectar banco** e entre com o usuário do aplicativo. Confirme que as bases salvas aparecem, selecione uma, recarregue, entre novamente e selecione a mesma base. Nunca publicar o HTML com contatos reais embutidos.

## Operação posterior

Os comandos já documentados com `docker compose --project-name leadcaps` no diretório do projeto passam a reconhecer automaticamente o override. Não remova esse arquivo e não utilize apenas `-f compose.yaml` em produção depois da ativação: isso omitiria o gateway. O template versionado está em `deploy/compose.caddy.yaml`; o override gerado é local e ignorado pelo Git.

Após alterações no gateway, use o instalador novamente para validar e aplicar. O bloco de domínio é idempotente. Após recriar o Caddy compartilhado pelo processo normal daquele projeto, a rota continua no seu Caddyfile e o gateway permanece na rede externa existente; não é necessário executar `docker network connect` manualmente.

O instalador não testa login, importação real ou o módulo de conteúdo. Esses testes dependem da validação do usuário pelo aplicativo público. Não há geração de conteúdo implementada nesta entrega.
