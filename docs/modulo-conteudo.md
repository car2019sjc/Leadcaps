# Inteligência de conteúdo — primeira versão 0.3

## Estado e escopo

Implementação própria no Leadcaps, com a mesma autenticação e PostgreSQL. O frontend continua sendo um HTML compilado e publicado manualmente no Netlify. O backend de bases já foi disponibilizado em HTTPS; esta versão editorial precisa ser instalada na VPS e publicada no Netlify pelos comandos abaixo.

Fluxo implementado: contexto e tema → expressões fornecidas com fonte e data → sugestões de oportunidades pela Anthropic → revisão da oportunidade e avaliação → briefing em rascunho → versões → aprovação → exportação Markdown. O briefing fica guardado no próprio Leadcaps. Exportar não confirma recebimento por outro aplicativo nem cria uma campanha.

Esta versão não consulta buscadores, não automatiza o AnswerThePublic, não mede volume/CPC, não produz artigos nem publica conteúdo. As expressões de pesquisa são coladas pelo usuário, uma por linha; podem vir de uma exportação legítima de pesquisa. Esta entrada é separada das planilhas de contatos. Ideação sem resultados exige escolha explícita de trabalhar como hipótese. Sugestões de IA nunca são apresentadas como frequência real de uso ou demanda comprovada.

## Configurar a Anthropic, na VPS

### Alternativa com janela do Windows, para dificuldade ao colar no terminal

Na instalação de Rodrigues (`/opt/leadcaps`, VPS `177.153.38.233`), o configurador Windows abre um campo de senha com botão **Colar chave**, usando a área de transferência do Windows. O modelo vem selecionado como **Claude Sonnet 5.5**, escolhido para este piloto; o servidor consulta os modelos elegíveis da conta antes de salvar. Workspace é opcional.

Se estiver dentro da VPS, encerre a pergunta interativa com Ctrl+C e use `exit` para voltar ao PowerShell do Windows. Confira se o prompt começa com `PS C:\`, depois execute um comando por vez:

```powershell
Set-Location 'C:\Projetos\Leadcaps'
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw 'Falha ao atualizar o configurador.' }
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\deploy\configure-anthropic-windows.ps1
```

O script atualiza o código em `/opt/leadcaps` por SSH antes de abrir a janela. Copie a chave na Anthropic, clique em **Colar chave** e depois em **Salvar e aplicar**. Se a conexão SSH pedir autenticação, conclua o acesso no terminal; é a credencial SSH da VPS, separada da chave Anthropic. Fechar/cancelar a janela não envia uma chave.

A chave viaja somente na entrada padrão da conexão SSH, com `-T` para impedir eco de terminal remoto. Não entra nos argumentos dos processos, no histórico de comandos ou em arquivo local de credenciais. O configurador da VPS recebe JSON limitado a 4 KB, valida os campos, consulta a lista de modelos e grava no `.env` privado com backup e permissão 600. Em seguida, o script recria somente o serviço `api`, com `--no-deps`, e espera seu estado saudável. Não há chamada de geração de conteúdo. Se essa última etapa falhar, a configuração pode já ter sido salva; leia a etapa indicada antes de tentar outra vez.

Ao aparecer `Configuracao aplicada`, feche e reabra **Inteligência de conteúdo** no aplicativo para carregar a configuração. Não é necessário publicar outro `dist` para configurar esta chave.

O `ExecutionPolicy Bypass` vale somente para esse processo do PowerShell; o comando não muda a política permanente do Windows.

### Alternativa pelo terminal SSH interativo

No PowerShell do Windows, entre na VPS:

```powershell
ssh root@177.153.38.233
```

No terminal Linux, execute um comando por vez:

```bash
cd /opt/leadcaps
git pull --ff-only
python3 deploy/configure_anthropic.py
```

O configurador pede a chave com entrada oculta, consulta a lista de modelos disponíveis para essa credencial e pede que você escolha um pelo número da lista, nome completo ou ID. Se a escolha não for reconhecida, ele repete somente essa pergunta, preservando a chave em memória; digite `cancelar` para sair sem gravar. Se sua chave exigir workspace, informe seu identificador; caso contrário, pressione Enter. Modelos que declaram suporte a saídas estruturadas e estão ativos são priorizados pela elegibilidade; quando essa capacidade não é informada pela API, a compatibilidade ainda precisa ser confirmada na primeira geração.

Uma lista de modelos retornada indica que a consulta autenticada funcionou, mesmo que nenhum caractere tenha aparecido durante a colagem da chave. A configuração só é gravada depois da escolha do modelo e da mensagem `Configuração salva na VPS`. Depois disso, a API precisa ser recriada para receber as variáveis novas.

Essa consulta não gera conteúdo. O configurador grava a chave somente no `.env` privado da VPS, preserva as demais variáveis e cria uma cópia privada do arquivo anterior em `backups/anthropic-.../`. Não envia a chave ao navegador, ao GitHub ou ao Netlify. Não cole a chave em comandos, capturas de tela ou no chat.

Agora atualize somente a API, sem importações em andamento:

```bash
bash deploy/update-content.sh
```

O script cria um dump PostgreSQL, verifica seu catálogo, registra a imagem anterior da API, preserva o `.env`, atualiza o código e reconstrói/recria somente `api`. A migração 002 adiciona tabelas editoriais dentro de uma transação e não modifica as cargas de contatos existentes. O banco, seu volume e os demais projetos permanecem em operação. O gateway existente continua sendo usado.

O catálogo verificado do dump não substitui um ensaio completo de restauração em banco separado. Se a atualização falhar, mantenha o caminho do backup e a mensagem. O script não remove tabelas, volumes ou outros serviços como tentativa de correção.

Confira:

```bash
curl --fail --show-error --max-time 20 https://api-leadcaps.synapseia.com.br/health
exit
```

O resultado esperado é `{"status":"ok"}`. O endpoint de saúde não testa credenciais da Anthropic nem consome sua API.

## Atualizar o frontend, no PowerShell do Windows

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
explorer.exe 'C:\Projetos\Leadcaps\dist'
```

Arraste `dist` para a área de deploy manual do projeto Leadcaps existente no Netlify. O HTML compilado contém somente três contatos fictícios e a URL pública da API. Não use `build:local` no deploy público.

## Primeiro uso

1. Abra `https://leadcaps.synapseia.com.br`, atualize com Ctrl+F5 e entre em **Conectar banco**.
2. Abra **Inteligência de conteúdo**, depois **Nova pesquisa**. Confirme empresa, serviço, público, objetivo, mercado, idioma e tema. Os campos não assumem capacidades comerciais de outros projetos.
3. Se desejar, inclua o perfil agregado do filtro atual. A tela mostra exatamente os cargos, setores, estados e contagens incluídos. A base fictícia continua identificada. A API não busca nem encaminha nomes, empresas, e-mails ou outros dados individuais dos contatos para gerar conteúdo.
4. Cole expressões de pesquisa com fonte e data. Sem expressões, marque a opção de hipótese. Salvar preserva o contexto e não chama a Anthropic.
5. Clique em **Sugerir oportunidades com IA**. A tela informa modelo e limites antes da geração. Escolha uma oportunidade; confira perguntas, pertinência, referências e notas. Ajustes criam uma revisão preservando as anteriores.
6. Uma oportunidade marcada para revisão ou fora de contexto precisa ser corrigida e classificada como pertinente antes do briefing. É possível escolher uma hipótese incompleta; ela continua identificada como tal.
7. Gere o briefing. Revise suas seções, faça ajustes e salve nova versão. Confirme a revisão editorial e aprove a versão exata. Baixe o Markdown aprovado para orientar a produção do conteúdo.
8. Ao editar uma versão aprovada, salvar cria outro rascunho. A versão aprovada anterior continua no histórico e pode ser exportada. O aplicativo não transforma o briefing em artigo nem em campanha.

## Regras e limites do piloto

- Mesmos usuários e visibilidade compartilhada da instância OnSet já adotada para as bases. Não há isolamento por cliente ou permissões distintas de aprovação nesta primeira versão.
- Contexto e expressões de uma pesquisa são snapshots imutáveis; para outro tema/contexto, crie nova pesquisa. Expressões repetidas são vinculadas por normalização conservadora, sem apagar o original, a negação ou diferenças de intenção.
- Até 80 expressões, 300 caracteres por expressão e 50 KB de dados por pesquisa. Perfil opcional contém somente as cinco categorias mais frequentes de cada dimensão e suas contagens.
- Cinco critérios, notas inteiras de 0 a 5, pesos 30/25/20/15/10. Nota pendente permanece `null` e a prioridade numérica fica incompleta. IA não atribui lacuna editorial quando não existe biblioteca examinada. O usuário pode avaliar esse critério, registrando a justificativa do exame realizado.
- Qualidade da evidência permanece separada da prioridade. Fontes são declaradas e não verificadas automaticamente. Volume e CPC permanecem indisponíveis, não zero.
- Limite de 4.096 tokens de saída por geração. Limite padrão de 20 solicitações por dia UTC para toda a instância, configurável por `CONTENT_DAILY_LIMIT` entre 1 e 100. Solicitações enfileiradas, falhas e consumos incertos também reservam esse limite; não é uma previsão de cobrança em reais.
- Máximo de oito gerações pendentes e uma chamada ativa por vez. Uma solicitação idempotente não cria outra chamada ao ser reenviada com a mesma chave; nenhum erro dispara repetição automática.
- Reinício durante uma geração marca seu resultado como incerto. Confirme o consumo antes de pedir outra geração. A fila e os resultados são preservados no PostgreSQL, sem Redis ou serviço adicional.
- Tempo máximo de uma chamada à Anthropic: 90 segundos. A interface acompanha a fila; fechar a janela não cancela o processamento no servidor. Reabra a pesquisa salva para retomar.
- Respostas passam por validação de estrutura, limites e existência de referências. Isso não atesta correção factual: revisão editorial e técnica continuam necessárias.
- A Anthropic recebe o contexto, as expressões, as referências declaradas e os agregados selecionados. Não há busca externa, ferramentas de execução ou envio automático de contatos.

## Implementação e auditoria

Novas tabelas: `content_researches`, `content_jobs`, `content_opportunities`, `content_opportunity_revisions`, `content_briefs`, `content_brief_versions`. Datas e autoria vêm do servidor; os trabalhos guardam modelo, versão de prompt, consumo informado e identificador retornado pelo provedor. Credenciais e conteúdo não são registrados nos logs da API.

Operações autenticadas em `/v1/content`: `config`, `researches`, `jobs`, revisões de oportunidades e versões/aprovações/exportações de briefings. Aprovar exige a versão atual e confirmação de revisão. Exportar exige uma versão aprovada. Conflitos de versão retornam 409; falhas não viram listas vazias nem resultados concluídos.

A Messages API é chamada diretamente no servidor com `fetch`, em endpoint fixo da Anthropic, autenticação Bearer, versão `2026-10-21` e `output_config.format` com JSON Schema. O servidor valida os resultados novamente. Nenhum endpoint nem algoritmo proprietário do AnswerThePublic é usado.

## Verificação

Testes locais cobrem contrato, métricas ausentes, prioridade incompleta, referências inválidas e adaptação da API Anthropic com respostas simuladas. Os testes com PostgreSQL e a interface completa usam banco isolado e Anthropic simulada no GitHub Actions. Nenhuma chamada paga faz parte da validação automática. O comportamento com a credencial real e a qualidade editorial devem ser validados por Rodrigues no primeiro piloto publicado.

## Referências técnicas oficiais, consultadas em 23/10/2026

- https://platform.claude.com/docs/en/api/messages/create
- https://platform.claude.com/docs/en/api/models/list
- https://platform.claude.com/docs/en/api/overview
- https://platform.claude.com/docs/en/api/versioning
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
