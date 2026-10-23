# Implantação independente — VPS e Netlify

## Estado

Código preparado para Docker + PostgreSQL na VPS e frontend estático com atualização manual no Netlify. Este documento não significa que os serviços já estejam em produção. Confirmar URL do frontend, subdomínio HTTPS da API, proxy existente, porta disponível e recursos livres antes da implantação.

## Isolamento

O Compose usa o projeto `leadcaps`, redes próprias e volume `leadcaps_postgres_data`. O PostgreSQL não publica portas. A API publica somente `127.0.0.1:8310` por padrão; o proxy do host deve encaminhar o subdomínio para essa porta. Não são montados diretórios de outras aplicações, não há acesso ao socket Docker e não são alterados serviços globais.

Os limites iniciais são 512 MB/0,5 CPU para banco e 256 MB/0,5 CPU para API, além do overhead do Docker. São limites de contenção propostos, a ajustar depois de medir o ambiente. O compartilhamento do host continua existindo; isolamento de projeto não garante recursos livres na VPS.

Não usar comandos globais de limpeza, remover volumes ou reaproveitar a base de outra aplicação. Se a porta 8310 estiver ocupada, escolher outra via `API_PORT`. Se o proxy existente também rodar em container, `127.0.0.1` se refere ao container dele: configurar um encaminhamento próprio para o host ou uma rede de proxy dedicada após identificar a arquitetura. Não trocar a publicação para `0.0.0.0` sem projetar o acesso.

## Preparação na VPS

Em diretório exclusivo, por exemplo `/opt/leadcaps`, clonar o repositório. Revisar as portas e containers existentes somente para identificar conflitos. Docker com Compose é pré-requisito; não reinstalar Docker para este projeto.

```bash
git clone https://github.com/car2019sjc/Leadcaps.git /opt/leadcaps
cd /opt/leadcaps
umask 077
cp .env.example .env
openssl rand -hex 32
```

Gravar o valor hexadecimal gerado em `POSTGRES_PASSWORD` dentro de `.env`. Preencher `ALLOWED_ORIGINS` com a origem exata do frontend (ex.: `https://nome.netlify.app`, sem barra final); se houver mais de uma origem, separá-las por vírgula. Nunca publicar `.env`, senha ou dump no repositório. O valor hexadecimal evita caracteres especiais na URL de conexão.

```bash
docker compose --project-name leadcaps config --quiet
docker compose --project-name leadcaps up -d --build
docker compose --project-name leadcaps exec api node backend/create-user.mjs rodrigues "Rodrigues"
curl --fail http://127.0.0.1:8310/health
```

A criação do usuário solicita a senha de modo oculto no terminal. Não colocá-la no comando, em um arquivo versionado ou no chat. A API aplica a migração versionada na primeira inicialização. O PostgreSQL e o usuário desta instância pertencem somente ao Leadcaps.

Configurar DNS e certificado no proxy já adotado pela VPS, com limite de corpo de pelo menos 10 MB e tempo de leitura suficiente para importação. A configuração de proxy/TLS é dependente da instalação existente e não foi aplicada pelo projeto. Do frontend HTTPS do Netlify, a API também precisa estar disponível em HTTPS.

## Frontend manual no Netlify

Em sua máquina de trabalho:

```bash
npm ci --ignore-scripts
npm run validate
LEADCAPS_API_URL=https://api.seudominio.com.br npm run build
```

Arrastar a pasta `dist` para a área de deploy manual do site existente no Netlify. A pasta contém `index.html` com código e dados fictícios. A URL da API é pública, não é uma credencial. Também pode ser preenchida no diálogo de conexão.

O workflow do GitHub gera o artefato `leadcaps-netlify-demo` depois das verificações; ele contém a compilação com contatos fictícios e permite o download manual. Nunca usar `build:local` para publicar uma página pública: essa opção incorpora a base privada no HTML.

Atualizar o frontend não altera os dados no PostgreSQL. As bases são consultadas depois do login. O aplicativo não faz implantação automática no Netlify.

## Atualização e backup

Antes de atualizar o backend, obter backup e registrar o commit implantado. Em diretório protegido, fora da área pública:

```bash
umask 077
mkdir -p backups
docker compose --project-name leadcaps exec -T db pg_dump -U leadcaps -d leadcaps -Fc > backups/leadcaps.dump
git pull --ff-only
docker compose --project-name leadcaps up -d --build api
```

O nome acima deve ser único por backup na rotina operacional; não sobrescrever a única cópia. Armazenar backups fora do host e testar restauração em ambiente separado. Persistência em volume protege de recriar o container, mas não substitui backup. Nunca executar `docker compose down -v` em produção.

## Validação

`npm run validate` executa verificações de sintaxe, testes e compilação. Quando `TEST_DATABASE_URL` está definido, executa também a integração com PostgreSQL em um schema aleatório de teste, criado e removido somente pelo teste. Usar um banco exclusivo de testes.

O CI inclui PostgreSQL 17, valida o Compose e constrói a imagem Docker. A validação cobre cargas independentes, autoria, data do servidor, idempotência, retenção depois de novo login, descrição obrigatória, CORS e expiração/revogação da sessão. Disponibilidade, TLS e convivência com os demais serviços dependem da validação na VPS real.

O CI também abre o HTML em Chromium para verificar descrição, conexão, salvar sem ativar, escolha da base, listagem e saída, com API simulada e dados fictícios. Este teste de interface complementa o teste de integração com PostgreSQL. Para reproduzir: `npx playwright install chromium --only-shell` e `npm run test:ui` depois de compilar; usa a porta local 8013.

## Referências técnicas oficiais

- [Docker Compose: nomes de projeto e isolamento](https://docs.docker.com/compose/how-tos/project-name/)
- [node-postgres: consultas parametrizadas](https://node-postgres.com/features/queries)
- [PostgreSQL: política de versões suportadas](https://www.postgresql.org/support/versioning/)
- [Netlify: criação de deploys, incluindo drag and drop](https://docs.netlify.com/deploy/create-deploys/)
