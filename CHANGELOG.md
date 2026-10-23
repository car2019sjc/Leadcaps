# Alterações

## Ajuste do configurador Anthropic — 23/10/2026

- Seleção de modelo aceita número, nome completo ou ID, com nova tentativa sem repetir a entrada da chave.
- Instruções esclarecem que a entrada oculta é normal e que a configuração só é salva após a escolha do modelo.

## 0.3.0 — Inteligência de conteúdo — 23/10/2026

- Contexto e pesquisa preservados com origem, data, expressões originais e perfil agregado opcional.
- Anthropic no servidor, saídas estruturadas, validação de referências e fila persistida com limites de consumo.
- Oportunidades explicadas, revisão humana, notas pendentes e prioridade separada da evidência.
- Briefings com versões, aprovação explícita e exportação Markdown da versão aprovada.
- Configuração oculta da chave na VPS e atualização da API com backup prévio.
- Testes de contrato, integração PostgreSQL, falhas de geração e uso completo da interface com Anthropic simulada.

## HTTPS — 23/10/2026

- Gateway exclusivo do Leadcaps entre a rede do proxy existente e a rede da API, mantendo o PostgreSQL privado.
- Instalador com backup privado, validação do merge, CORS, comparação com a configuração ativa do Caddy e tentativa de restauração em falha.
- Roteiro específico de HTTPS e atualização manual do frontend pelo PowerShell.

## 0.2.0 — 23/10/2026

- Persistência de pesquisas como snapshots independentes em PostgreSQL.
- Descrição obrigatória, autoria autenticada, data/hora do servidor, arquivo e hash por carga.
- Login, biblioteca de bases e escolha explícita do que carregar no console.
- API com idempotência, validação, consultas parametrizadas e revogação/expiração de sessões.
- Docker Compose com recursos exclusivos, limites de uso e banco sem porta pública.
- Instruções para VPS compartilhada, backup e atualização manual do frontend no Netlify.
- Integração PostgreSQL e compilação Docker adicionadas ao workflow de validação.

## 0.1.0 — 23/10/2026

- Organização do HTML original em um projeto próprio e reproduzível.
- Separação de interface, estilos, importação, exportação, mapa e dados.
- Preservação do HTML original e dos metadados da base.
- Compilação para HTML único, testes locais e preparação de verificações no GitHub.
- Especificação e roteiro de integração do módulo de conteúdo.
- Escape de dados ao regenerar o HTML, sem alterar os scores ou filtros.
- Extração local da base a partir do HTML original, sem executar scripts nem publicar contatos.
