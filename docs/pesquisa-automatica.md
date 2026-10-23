# Pesquisa automática — versão 0.4.1

Primeiro recorte de descoberta do Leadcaps: contexto → plano editável → Google Autocomplete via Serper → mapa de expressões → revisão e seleção → oportunidades e briefing. Implementação própria; não utiliza API, código ou algoritmo do AnswerThePublic. A Anthropic interpreta os sinais selecionados; a Serper fornece as sugestões observadas. A base de contatos é independente e só fornece um perfil agregado se o usuário escolher.

## 1. Configurar a chave no Windows

Use a nova chave no configurador. Não a coloque no GitHub, no HTML, em comandos ou no chat. Se estiver no SSH, use `exit` para voltar ao prompt `PS C:\`.

```powershell
Set-Location 'C:\Projetos\Leadcaps'
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw 'Falha ao atualizar o código.' }
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\deploy\configure-anthropic-windows.ps1 -Service Serper
```

O mesmo configurador atende Anthropic, Serper e a alternativa SerpAPI. Para esta etapa, a janela deve dizer **Serper**. Copie a nova chave de https://serper.dev/api-keys, clique em **Colar chave** e em **Salvar e aplicar**. O campo é mascarado; não há pergunta de workspace ou modelo. Se o SSH solicitar autenticação, conclua o acesso no terminal.

O script atualiza `/opt/leadcaps`, transmite a chave somente pela entrada padrão de SSH sem terminal remoto (`-T`), valida a chave com **uma consulta de autocomplete** (`service desk`, Brasil, português), que pode consumir créditos, e grava `SERPER_API_KEY` e `SEARCH_PROVIDER=serper` no `.env` privado. Preserva as variáveis PostgreSQL e Anthropic, cria backup privado e executa `deploy/update-content.sh`: dump do banco, verificação do catálogo, compilação e atualização somente de `api`. A migração 003 adiciona quatro tabelas; não altera importações existentes. O banco e os outros projetos da VPS continuam em operação. Não é necessário instalar um novo serviço. O configurador não repete o teste automaticamente; em caso de timeout, o consumo pode ser incerto. Os resultados desse teste não viram uma pesquisa salva no aplicativo.

Essa etapa não publica o frontend. Se falhar, interrompa e confira a mensagem antes de continuar. Não imprima `.env` ou a resposta completa da API de conta: ela pode conter credenciais. O endereço `/health` testa o serviço, não a chave de pesquisa.

## 2. Compilar e publicar o frontend

No PowerShell do Windows:

```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Projetos\Leadcaps'
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

Arraste a pasta `dist` para a área de deploy manual do projeto Leadcaps existente no Netlify. Use a compilação pública com três contatos fictícios; suas bases continuam no PostgreSQL. Nunca publique `build:local`.

## 3. Primeiro percurso no aplicativo

1. Abra https://leadcaps.synapseia.com.br, atualize com Ctrl+F5 e entre no banco. Abra **Inteligência de conteúdo → Nova pesquisa**.
2. Preencha serviço, público, objetivo e tema; revise empresa, mercado e idioma. Evidências comerciais e biblioteca existente ajudam a avaliar as oportunidades, mas não são inventadas se estiverem ausentes.
3. Informe um termo curto, como `service desk`, e clique em **Preparar consultas**. Revise as seis consultas propostas e mantenha de uma a oito. São consultas planejadas, não perguntas já observadas. Para o primeiro teste, duas ou três consultas bastam.
4. Escolha país e idioma da coleta. Informe exclusões opcionais, como `vagas`, se carreira estiver fora do contexto. Clique em **Pesquisar no Google via Serper**. Cada linha pode consumir uma consulta da fonte; a coleta não chama a Anthropic.
5. Explore o mapa por grupo, expressão e estado de revisão. Veja as consultas, datas, posições e originais em **Origem e consultas**. Expressões excluídas continuam visíveis no histórico.
6. Use **Revisar grupo / pertinência** para manter, excluir ou deixar pendente uma expressão e justificar. Edite o nome do grupo para unir ou separar temas. As revisões anteriores e o resultado original são preservados.
7. Selecione de uma a 80 expressões e clique em **Levar selecionadas para oportunidades**. A coleta completa permanece salva; essa seleção cria um snapshot editorial com a revisão utilizada e as referências de origem, sem chamada de IA.
8. Clique em **Sugerir oportunidades com IA** e siga a revisão, geração e aprovação de briefing descritas em [Módulo de conteúdo](modulo-conteudo.md). As interpretações de aderência e intenção continuam separadas dos sinais observados.

Fechar a janela não cancela a coleta. Reabra uma entrada em **Coletas Google** para retomar. **Seleções editoriais** guarda os recortes levados ao fluxo de conteúdo. O botão de origem retorna da seleção para a coleta correspondente.

## Entradas, decisões e saídas

| Etapa | Entrada | Decisão e intervenção | Saída persistida |
|---|---|---|---|
| Contexto | Empresa, serviço, público, objetivo, tema; evidências e perfil opcionais | Usuário declara contexto e confirma o plano | Snapshot do contexto, país, idioma e consultas |
| Coleta | Uma a oito consultas | Servidor verifica configuração, fila e orçamento reservado; usuário inicia | Sugestões originais, parâmetros, datas e estados por consulta |
| Organização | Sugestões coletadas | Normalização conservadora; agrupamento por regras; usuário corrige grupo e pertinência | Expressões distintas, ocorrências e revisões com autoria |
| Seleção | Expressões não excluídas | Usuário escolhe até 80; nada é truncado silenciosamente | Snapshot editorial vinculado à coleta e revisão |
| Interpretação | Seleção e contexto | Anthropic propõe oportunidades; usuário avalia pertinência, notas e pendências | Oportunidades, justificativas, evidências e revisões |
| Briefing | Oportunidade pertinente | Usuário solicita, revisa e aprova versão exata | Briefing versionado e Markdown aprovado |

## Evidência e limites

- O sinal é uma sugestão observada em Google Autocomplete, não uma contagem de buscas ou uma conversa privada. A posição pertence à resposta da consulta, não é ranking orgânico.
- A normalização agrupa somente texto equivalente após caixa, espaços e Unicode NFKC. Negações, sinônimos e intenções diferentes não são fundidos por IA. Todas as ocorrências conservam seu texto original e consulta.
- Os grupos iniciais usam padrões linguísticos, principalmente em português: como fazer, definição, motivos, preço, comparações, problemas, local/momento e relacionados. Não são clusters semânticos validados. A pertinência fica **Revisar**, salvo exclusões explícitas do usuário. A seleção é uma escolha editorial, não uma afirmação de demanda.
- Volume e CPC têm valor `null` e estado `unavailable`, nunca zero. Falha de fonte, retorno vazio, consulta não executada e consumo incerto têm estados diferentes. Métricas de Google Ads, outros canais e análise de concorrência ainda não foram integrados.
- A data da coleta vem do servidor. O adaptador Serper não inventa ID ou data de criação da fonte: esses campos permanecem nulos, porque não aparecem no exemplo de autocomplete consultado. Coletas antigas SerpAPI conservam os metadados que receberam; a data da fonte é separada da data do servidor.
- Comparar coletas usa o termo normalizado, país e idioma, mostra a amostra anterior e avisa quando o plano ou o provedor é diferente. Expressões presentes ou ausentes não comprovam tendência de procura.
- Perfil opcional contém `base_id`, cargos, setores, estados e contagens agregadas. Não contém contatos individuais nem o snapshot completo dos critérios do filtro. Interesse e qualificação de uma pessoa não são inferidos de sugestões agregadas.
- O piloto não produz artigos, não publica no CMS e não cria campanhas automaticamente. A descoberta precisa ser validada com temas reais antes dessa expansão.

## Orçamento e recuperação

Padrões do Leadcaps: `SEARCH_MONTHLY_LIMIT=200` por mês UTC e `SEARCH_HOURLY_LIMIT=40` na última hora, compartilhados por toda a instância. Até quatro coletas pendentes, uma consulta ativa por vez e 35 segundos por chamada. Cada plano reserva todas as suas linhas ao ser aceito; falhas e linhas não executadas permanecem reservadas. Isso é um teto conservador do aplicativo, separado da cota efetiva e da cobrança da Serper. O saldo efetivo deve ser conferido no painel Serper; o aplicativo não consulta esse saldo. A consulta de teste do configurador fica fora do histórico editorial e dos limites reservados por coletas.

Não há repetição automática após falha ou timeout. Uma falha interrompe o restante do plano, preservando resultados anteriores como coleta parcial. Reinício durante uma chamada marca consumo incerto e não repete essa chamada. A idempotência evita outra coleta no reenvio da mesma solicitação. Solicitar uma nova coleta deliberadamente é uma nova reserva e pode consumir a fonte novamente. Limites máximos configuráveis: 10.000/mês e 1.000/hora; isso não contrata plano nem garante capacidade do provedor.

## Contrato técnico

Migração `003_search.sql`: `search_runs`, `search_queries`, `search_run_revisions`, `search_exports`. Usa o mesmo PostgreSQL, login e sessão do Leadcaps. Visibilidade compartilhada entre usuários da instância; não há isolamento por cliente neste piloto. Fila, limites e revisões usam locks PostgreSQL, sem Redis. Resultados brutos permitidos são armazenados por lista de campos; chave, URLs autenticadas e erros completos do provedor não são retornados à interface nem gravados no histórico.

| Operação autenticada | Uso |
|---|---|
| `GET /v1/search/config` | Configuração pública, limites reservados e disponibilidade |
| `POST /v1/search/runs` | Enfileirar plano com `request_id` UUID e idempotência |
| `GET /v1/search/runs?offset=0` | Histórico paginado de coletas |
| `GET /v1/search/runs/{id}` | Estado, consultas, mapa, ocorrências e seleções editoriais |
| `POST /v1/search/runs/{id}/reviews` | Revisar uma expressão com `expected_revision` |
| `POST /v1/search/runs/{id}/editorial` | Criar seleção imutável com IDs e revisão, sem IA |
| `GET /v1/search/runs/{id}/comparison` | Comparar com a coleta anterior do mesmo recorte |

`SEARCH_PROVIDER=serper` seleciona exclusivamente a chave `SERPER_API_KEY`. A alternativa `SEARCH_PROVIDER=serpapi` usa exclusivamente `SERPAPI_API_KEY`. Se a variável de seleção estiver ausente, a API escolhe Serper quando houver chave Serper; mantém compatibilidade com instalações que tenham somente chave SerpAPI. Uma fonte não é substituída após falha. Uma coleta pendente de outro provedor é interrompida com justificativa, sem executar consultas na nova fonte. A migração permanece 003, sem nova alteração de tabelas nesta correção.

O snapshot editorial `content.research.v2` preserva `search_origin`, IDs estáveis das expressões, classificação e vínculo às consultas. O trabalho de IA congela esse snapshot; novas revisões na coleta não alteram o briefing já gerado. Referências e versão da coleta também aparecem no Markdown. Pesquisas manuais v1 e briefings anteriores continuam válidos. O limite editorial é 80 expressões; snapshots enriquecidos com origem têm limite de 100 KB, após a validação do conteúdo básico de 50 KB.

Os testes automatizados usam dados fictícios e fontes simuladas. Integrações PostgreSQL verificam preservação da versão anterior, fila, idempotência, falhas parciais, revisão e limites. O teste de navegador cobre coleta → mapa → revisão → seleção → oportunidade → briefing aprovado, em desktop e celular. O teste Windows verifica colagem, máscara e envio por stdin. A aceitação com a chave real e a pertinência dos resultados dependem do piloto de Rodrigues.

## Referências oficiais consultadas em 23/10/2026

- https://serper.dev/ — autocomplete, exemplo de sugestões, países/idiomas e condições de uso de créditos.
- https://serper.dev/playground — construtor oficial de exemplos: `POST https://google.serper.dev/autocomplete`, JSON `q/gl/hl`, header `X-API-KEY`. O contrato foi conferido no construtor público; a aceitação com a chave real será testada na VPS.
- https://serper.dev/api-keys — local de obtenção da chave pelo usuário.
- https://serpapi.com/google-autocomplete-api — contrato da alternativa SerpAPI, preservada para instalações anteriores.

Serper (`serper.dev`) e SerpAPI (`serpapi.com`) são serviços independentes. Uma chave Serper enviada à SerpAPI é recusada; a correção 0.4.1 seleciona o serviço correto, sem exigir outra conta.
