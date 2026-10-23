# Bases persistidas — contrato v1

## Decisão de Rodrigues

Cada Excel/CSV representa uma pesquisa preservada. Sua descrição é obrigatória: por exemplo, “contatos de manufatura” ou “CIOs de São Paulo”. Importar outro arquivo não apaga, combina nem ativa a base anterior. O usuário escolhe qual base carregar no console.

O horário de importação não comprova quando os contatos foram pesquisados ou atualizados na origem. A versão v1 não usa a quantidade de campos preenchidos para decidir qual pesquisa é mais atual.

## Fluxo implementado

1. Abrir **Conectar banco**, informar o endereço HTTPS da API e entrar com o usuário provisionado.
2. Abrir **Importar nova base**; informar a descrição e selecionar CSV ou XLSX.
3. O navegador aplica a normalização existente, mantendo as linhas resultantes como snapshot próprio. As regras de classificação/score de contatos não foram recalibradas.
4. O servidor valida o contrato e grava uma única linha transacional em `lead_imports`, com o snapshot completo dos contatos em JSONB. Não armazena o arquivo Excel original.
5. A confirmação mostra os dados gravados. **Usar esta base** carrega os contatos no painel por escolha explícita.
6. Em **Bases salvas**, consultar outras pesquisas e alternar entre elas. A listagem carrega somente metadados; os contatos são consultados ao selecionar uma base.

O modo local continua disponível e exige descrição, mas seus dados só duram a sessão ou o HTML exportado. O texto da interface informa essa condição. A combinação por completude é uma função local herdada; não é aplicada às cargas persistidas.

## Dados e decisões

| Campo | Origem e regra |
|---|---|
| id | UUID gerado pelo servidor |
| description | Usuário, obrigatória, 5–500 caracteres |
| filename | Nome do arquivo selecionado |
| source_sha256 | Hash calculado sobre os bytes do arquivo; identifica o arquivo, sem atestar sua qualidade |
| imported_at | PostgreSQL, `timestamptz`, independente do relógio do navegador |
| imported_by | Conta autenticada; o cliente não pode escolher outro responsável |
| record_count | Contado pelo servidor após validar o snapshot |
| pack_version / pack | Contrato v1 e contatos normalizados, em JSONB |
| request_id | Chave de idempotência; um reenvio igual retorna a mesma carga |

Snapshots de arquivos diferentes podem conter o mesmo contato com valores diferentes. Isso é intencional: os atributos continuam ligados à pesquisa correspondente. Não há cadastro mestre, atualização automática por pessoa, deduplicação entre pesquisas, exclusão ou edição de bases na API v1.

Datas são transmitidas em ISO 8601. A biblioteca apresenta o horário de Brasília explicitamente; o carimbo geral do console usa o fuso do navegador. O conteúdo do snapshot não é registrado nos logs da API.

## Acesso

- Instância única da OnSet: todos os usuários provisionados acessam todas as bases desta instância. Não há separação por organização/cliente nesta versão.
- Não há cadastro público. O primeiro usuário e os demais são criados pelo administrador no terminal da VPS.
- Senha com hash scrypt e salt aleatório; login com limitação de tentativas. Sessões expiram em oito horas.
- Token aleatório apenas na memória da aba; o banco armazena seu hash. Recarregar a página requer novo login. Sair ou receber uma resposta de sessão expirada remove do painel a base carregada do banco.
- CORS aceita somente as origens configuradas; o acesso às bases exige autenticação também fora do navegador.
- A API recebe no máximo 10 MB de JSON e 100.000 contatos por carga. O limite do proxy deve permitir o mesmo tamanho.

## API

| Método e rota | Entrada | Saída / decisão |
|---|---|---|
| POST /v1/sessions | login, password | Token temporário, vencimento e usuário |
| DELETE /v1/sessions/current | Bearer | Revoga a sessão atual |
| GET /v1/imports?offset=0 | Bearer | Até 100 metadados; next_offset para a página seguinte |
| POST /v1/imports | Bearer, description, filename, source_sha256, request_id, pack | 201 para carga nova; 200 em reenvio idêntico; 409 se reutilizar a chave com outro conteúdo |
| GET /v1/imports/{id} | Bearer | Metadados e snapshot completo |
| GET /health | Nenhuma | Disponibilidade da API e conexão com o banco |

Erros de contrato retornam 400; sessão ausente/expirada, 401; origem não autorizada, 403; limite excedido, 413; excesso de tentativas de login, 429. Uma falha de consulta nunca é apresentada como base vazia ou importação concluída.
