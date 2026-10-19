<div align="center">

# dsh-github

> Release stamp: `0.7.16` (2026-10-04).

> **Nome do pacote.** Este projeto é publicado no npm como **`@perrylink/dsh-github`**. O nome simples `dsh-github` pertence a outro projeto não relacionado — instalá-lo não instala este plugin.

**PRs, revisões, issues e CI do GitHub para o DeepSeek Harness — toda gravação aprovada por um humano e o token nunca registrado em log.**

*Crie, revise, mescle e pesquise no GitHub a partir do agente, com uma ação composta de CI, um bot de revisão por polling e uma barreira de status-check.*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-github)
[![DSH plugin](https://img.shields.io/badge/dsh--plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-github.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-en.svg)](https://dsh.market/)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-github/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-github/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-github?label=version)](https://github.com/PerryLink/dsh-github/releases)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)
- **Canal 1024 store**: `npm i -g dsh1024` uma vez, depois `dsh1024 plugin --profile web add @perrylink/dsh-github` (conta para o ranking de instalações do [deepseek1024.com](https://deepseek1024.com)).
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-github?metric=downloads&lang=pt)](https://dshfind.com/pt/plugins/PerryLink/dsh-github?ref=badge)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

```sh
dsh plugin --profile <name> add @perrylink/dsh-github
```


</div>

---

## Instalação e desinstalação

- **canal git** (último `main`): `dsh plugin --profile web add github:PerryLink/dsh-github` — o script `prepare` compila apenas com dependências de produção.
- **canal npm** (versões publicadas): `dsh plugin --profile web add @perrylink/dsh-github`.
- **canal tarball**: `pnpm pack` neste repositório e depois `dsh plugin --profile web add ./perrylink-dsh-github-<version>.tgz`.
- **desinstalar**: `dsh plugin --profile web remove @perrylink/dsh-github` (ou remova a linha do patch de perfil).

## What is dsh-github?

PRs, revisões, issues e CI do GitHub para o DeepSeek Harness — toda gravação aprovada por um humano e o token nunca registrado em log.

Crie, revise, mescle e pesquise no GitHub a partir do agente, com uma ação composta de CI, um bot de revisão por polling e uma barreira de status-check.

![Diagrama de fluxo de dsh-github: solicitação → política/revisão → veredito.](docs/assets/dsh-github-flow.svg)

*Visão geral do fluxo: solicitação → política/revisão → veredito. Os exemplos abaixo usam a superfície real de comandos.*


*A mesma execução, animada.*

## 📚 Índice

- [What is dsh-github?](#what-is-dsh-github)
- [Compatibilidade](#compatibilidade)
- [O que você obtém](#o-que-você-obtém)
- [Início rápido](#início-rápido)
- [Instalação e desinstalação](#instalação-e-desinstalação)
- [Configuração](#configuração)
- [Ferramentas e superfícies](#ferramentas-e-superfícies)
- [Arquitetura](#arquitetura)
- [Permissões e dados](#permissões-e-dados)
- [Limites de segurança](#limites-de-segurança)
- [Limitações conhecidas](#limitações-conhecidas)
- [Desenvolvimento](#desenvolvimento)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Tópicos](#tópicos)
- [Contribuidores](#contribuidores)
- [Família de plugins DSH da PerryLink](#perrylink-dsh-plugin-family)
- [Licença](#licença)

- [Interoperabilidade com outros plugins do DSH](#interoperabilidade-com-outros-plugins-do-dsh)
## Compatibilidade

| Superfície | Status |
|---|---|
| Harness | DeepSeek Harness `dsh-v0.2.1-rc.2` (verificado 2026-10-18): `engines.dsh >=0.2.1-0 <0.3.0`; os caminhos de compatibilidade P0 têm testes de regressão. |
| Node | `^22.19.0 \|\| >=24.0.0` |
| Plataformas | Todas (plugin host; rede de saída para o GitHub) |
| Modelo | Qualquer (a revisão estática é determinística; `reviewMode: "model"` é opcional) |

## O que você obtém

O `dsh-github` preenche a lacuna do GitHub entre o `dsh` e ferramentas como o Claude Code e o Codex: seu agente pode ler, revisar, abrir, atualizar e mesclar pull requests, ler metadados de repositórios e arquivos, comentar e fechar issues, e pesquisar — enquanto um humano aprova toda gravação e o token permanece em segredo.

- **14 ferramentas** — `pr_create`, `pr_merge`, `pr_update`, `gh_review`, `review_post`, `gh_issue`, `issue_open`, `issue_comment`, `issue_close`, `gh_search`, `gh_repo`, `gh_file`, `gh_repo_search`, `gh_checks`, todas com JSON canônico via `defineTool`.
- **3 famílias de comandos** — `/pr create`, `/review` (start/stop/post), `/issue open`.
- **Ciclo de vida completo do PR** — criar → revisar → atualizar (título/corpo/estado/rama base) → mesclar (merge/squash/rebase, exclusão opcional da rama head).
- **Revisões inline** — `review_post` publica um único comentário de resumo ou comentários de revisão ancorados por linha no commit head do PR.
- **Gravações com aprovação** — toda gravação no GitHub passa por `ctx.approval` (padrão `ask`, falha fechada); os motivos de aprovação pré-visualizam títulos, tamanhos de corpo e substituições de comentários.
- **Sigilo do token** — camada de credenciais → ambiente → CLI `gh`, resolvido por operação, nunca em logs, eventos, renderizações ou erros.
- **Jobs de revisão em segundo plano** — `/review` roda em `ctx.jobs` com a própria superfície `job_list` / `job_output` / `job_kill` do host.
- **Resiliência** — nova tentativa em 429 com backoff `Retry-After`/`x-ratelimit-reset`; as ferramentas de leitura são seguras para concorrência; todas as chamadas respeitam o cancelamento.
- **Superfície de CI** — a ferramenta de execução única `ci_run`, um bot de revisão por polling e uma barreira de status-check (ação composta `action.yml`).

## Início rápido

```sh
dsh plugin --profile web add github:PerryLink/dsh-github
```

```sh
# 1. instale o bundle no seu perfil
dsh plugin --profile web add github:PerryLink/dsh-github

# ou do npm (versões publicadas)
dsh plugin --profile web add @perrylink/dsh-github

# 2. reinicie e verifique a linha
dsh --profile web --dump-config | grep -A3 'id: dsh-github'
```

### Exemplos

São os pontos de entrada reais; instale e chame um.

#### Exemplo detalhado

**Comando**

~~~sh
pr_create
~~~

**Entrada**

~~~json
{
  "title": "feat: shiny",
  "body": "desc"
}
~~~

**Saída**

~~~text
created pull request #7: https://github.com/o/r/pull/7 (main ← feat/shiny)
~~~

*Observado em `plugins/dsh-github/test/tools.test.ts:69-74 (fixture + assertions); renderer at plugins/dsh-github/src/tools.ts:189`*

#### Exemplos breves

- `pr_merge`
- `gh_review`

## Configuração

Todos os ajustes são campos `Config` do Schemastery (modificáveis a partir do cordis.yml). Uma substituição direcionada por id troca toda a linha — redeclare cada chave de que você precisa. O `cordis.patch.yml` documenta cada chave em linha. Na GUI, o **cartão de configurações da página Plugins** (grupo Official) lê `tokenRef` do próprio formulário de configuração da entrada — o host `0.1.7-alpha.1` removeu a vinculação `ctx.settingsScope` e a costura de registro de namespace por trás dela, então o cartão não possui mais um namespace de configuração. O token do GitHub não é um campo de configuração: o cartão informa se a credencial referenciada está definida e a grava pelo arquivo de credenciais, que é de onde a metade host a resolve.

| Chave | Padrão | Significado |
|---|---|---|
| `tokenSource` | `auto` | `auto` (credenciais → ambiente → gh) ou um de `credentials` / `env` / `gh` |
| `tokenRef` | `GITHUB_TOKEN` | Referência da camada de credenciais / nome da variável de ambiente |
| `defaultOwnerRepo` | — | Fallback `owner/repo` quando uma chamada não nomeia nenhum e o git não tem origin |
| `autoCommit` | `false` | Se `/pr create` pode instruir o modelo a fazer commit+push primeiro |
| `maxDiffChars` | `8000` | Limite de caracteres para diffs de PR lidos nas revisões |
| `renderExcerptChars` | `2000` | Limite de caracteres para o trecho de diff renderizado na saída da ferramenta |
| `maxComments` | `20` | Limite para comentários de PR listados por `gh_review` |
| `reviewJobTimeoutMs` | `600000` | Prazo para um job de revisão em segundo plano (falha com `timeout`) |
| `maxReviewRecords` | `50` | Limite para registros em memória de jobs de revisão; os registros concluídos mais antigos são removidos primeiro |
| `maxFileChars` | `12000` | Limite de caracteres para o conteúdo de arquivos lido por `gh_file` |
| `maxFindings` | `50` | Limite de achados do analisador por revisão |
| `maxLineLength` | `300` | Comprimento de linha a partir do qual o analisador marca um achado de linha longa |
| `reviewMode` | `static` | Motor de revisão: `static` (analisador determinístico) ou `model` (subagente de uso único pela seam `subagents` do host; falha em alto e bom som quando a seam está ausente) |
| `modelReviewProvider` | — | Nome do provedor de subagente para `reviewMode: "model"`; usa, por padrão, o primeiro provedor registrado |
| `maxRetries` | `3` | Tentativas de nova tentativa em 429 por requisição |
| `retryBaseMs` | `500` | Base do backoff de nova tentativa (dobra a cada tentativa) |
| `retryMaxWaitMs` | `60000` | Teto do backoff de nova tentativa |
| `requestTimeoutMs` | `30000` | Timeout rígido por requisição; aborta o fetch ao exceder |
| `apiBaseUrl` | `https://api.github.com` | URL base da API REST do GitHub (GitHub Enterprise) |
| `allowedActions` | `['pr.create','pr.merge','pr.update','review.post','issue.create','issue.comment','issue.close','ci.run']` | Allowlist de ações de gravação; qualquer outra coisa é negada antes da aprovação |
| `workspaceDir` | process cwd | Diretório de trabalho para inspeção somente leitura do git |
| `ci` | `{ enabled: false, … }` | Seção de integração CI: bot de revisão por polling, barreira de status-check e a ferramenta de execução única `ci_run` (contém todas as chaves `ci.*`) |

## Ferramentas e superfícies

| Superfície | Tipo | Observações |
|---|---|---|
| `pr_create` | ferramenta | Cria uma pull request (gravação; com aprovação) |
| `pr_merge` | ferramenta | Mescla uma PR (merge/squash/rebase, exclusão opcional da rama head) |
| `pr_update` | ferramenta | Atualiza uma PR (título/corpo/estado/rama base) |
| `gh_review` | ferramenta | Lê uma PR: metadados, diff limitado, comentários, CI, achados estáticos |
| `review_post` | ferramenta | Publica um comentário de revisão (resumo ou inline ancorado por linha) |
| `gh_issue` | ferramenta | Lista / obtém / comenta issues (PRs marcados `kind: "pr"`) |
| `issue_open` | ferramenta | Cria um issue |
| `issue_comment` | ferramenta | Comenta um issue ou PR |
| `issue_close` | ferramenta | Fecha um issue (motivo de estado opcional) |
| `gh_search` | ferramenta | Pesquisa issues e PRs (cota de busca separada) |
| `gh_repo` | ferramenta | Lê os metadados do repositório |
| `gh_file` | ferramenta | Lê um arquivo em uma rama/tag/commit |
| `gh_repo_search` | ferramenta | Busca GraphQL de repositórios (cota de busca separada) |
| `gh_checks` | ferramenta | Checks de status GraphQL de um PR (check runs + commit statuses) |
| `/pr create` | comando | Lê o estado do git e enfileira uma instrução `pr_create` |
| `/review` | comando | Inicia / para / publica um job de revisão em segundo plano |
| `/issue open` | comando | Enfileira uma instrução `issue_open` |
| `ci_run` | ferramenta | Revisão CI de execução única conduzida pela ação composta / driver CI |
| bot de revisão | superfície | Bot de revisão por polling com comentários inline idempotentes (`ci.*`) |
| barreira de status-check | superfície | Publica o veredito `success` / `needs-changes` por commit head de PR (`action.yml`) |

## Arquitetura

- **Camada de credenciais.** `tokenSource: auto` resolve por operação na ordem camada de credenciais (referência `GITHUB_TOKEN`) → variável de ambiente → token da CLI `gh`. O valor é uma variável local entregue ao cliente REST; ele nunca entra em valores canônicos, renderizações, cards, saídas de comandos, avisos injetados, saídas de jobs, motivos de aprovação ou mensagens de erro.
- **Barreira de aprovação.** Todas as gravações passam pelas ferramentas do modelo. Um listener waterfall `tools/pre-execute` retorna `ask` para as ferramentas de gravação, de modo que o registro pergunta ao humano por meio de `ctx.approval` (o host registra o par de auditoria `approval/asked` + `approval/decided`) e falha fechado sem um respondedor. Comandos nunca gravam diretamente: um comando de gravação coleta contexto somente leitura e então acorda o agente para que o modelo execute a ferramenta com aprovação dentro de um turno.
- **Job de revisão em segundo plano.** `/review <pr>` inicia um job `github-review` em `ctx.jobs`; o job busca metadados (capturando o SHA do commit head para a publicação inline), o diff limitado, as verificações de CI e os comentários existentes, e então executa o analisador determinístico de múltiplos arquivos (`src/review.ts`). O job pertence ao `SessionId` puro do agente que chama — o `0.1.7-alpha.1` fecha o registro sobre `SessionId`, sem união com `Agent` —, então `dsh-tool-jobs` precisa estar composto ou `start` recusa. Com `reviewMode: "model"`, o job entrega o diff limitado a um subagente de uso único pela seam `subagents` do host. A conclusão chega à sessão por meio do consumidor `dsh-tool-jobs` do host; o modelo a lê com `job_output` e a publica com `review_post`.
- **Ação composta de CI / bot de revisão / barreira de status-check.** O repositório inclui uma ação composta (`action.yml`) que revisa PRs, corrige CI e escreve o relatório; um bot de revisão por polling publica comentários inline idempotentes; e uma barreira de status-check publica o veredito por commit head de PR. A ferramenta de execução única `ci_run` conduz a execução headless. Toda gravação permanece sujeita a aprovação.

## Permissões e dados

- **Permissões**: as gravações usam a camada de aprovação oficial; nada é reimplementado nem contornado. O plugin declara `network:outbound` e `filesystem:write` em seu manifesto de workshop.
- **Dados**: o relatório de revisão vive na memória do processo, indexado pelo id do job; nada durável é gravado em disco.
- **Log de sessão**: o plugin não adiciona tipos de evento de sessão personalizados; todo conteúdo visível ao modelo flui por superfícies registradas pelo host (`tool/result`, `user/message`, `command/run`, `approval/asked`…). Os avisos que os comandos enfileiram carregam o kind de origem próprio do plugin, `{ kind: 'dsh-github', form: 'notice', summary }` — o host não tem um kind `plugin` genérico e sua rota de admissão do formato de sessão o recusa de imediato.

## Limites de segurança

- **Aprovação, não aplicação.** As gravações apenas produzem decisões `ask`/deny na camada oficial; o sandbox e os sistemas de aprovação continuam sendo a autoridade de aplicação.
- **Falha fechada.** A ausência de respondedor de aprovação degrada para a decisão mais estrita — nunca para uma passagem silenciosa.
- **O token nunca sai do processo.** É lido por operação e enviado apenas no cabeçalho Authorization; nunca é registrado, renderizado, injetado nem aparece em erros.
- **Sem gravações fora da aprovação.** `/pr create` nunca faz commit ou push por conta própria; com `autoCommit: true`, o modelo realiza essas gravações pela própria barreira de aprovação da ferramenta bash. O job de revisão não realiza gravações; apenas `review_post` publica, após aprovação.
- **Conteúdo não confiável é escapado e marcado.** `formatPostBody` escapa as crases e em HTML os nomes de arquivo derivados do diff, e o conteúdo externo do GitHub (arquivos, corpos, comentários, resultados de busca) é marcado como externo nas renderizações.
- **Trabalho limitado e limites de taxa.** Os 429 são repetidos com backoff; a cota restante é exibida em todo resultado, incluindo falhas.

## Limitações conhecidas

- **Sem eventos de sessão personalizados** — deliberado (veja Arquitetura); as trilhas de auditoria dependem do próprio vocabulário de eventos do host.
- **Analisador estático por padrão** — regras determinísticas (`src/review.ts`), zero tokens, reproduzível. `reviewMode: "model"` consome tokens e requer a seam `subagents` e um provedor registrado.
- **Jobs e registros são locais ao processo** — o relatório de revisão vive na memória do plugin, indexado pelo id do job; o mapa de registros é limitado por `maxReviewRecords` (os registros concluídos mais antigos são removidos primeiro).
- **As dist-tags `latest` do npm estão desatualizadas** — instale por meio do fechamento de perfil que o `dsh-base` fornece; nunca com um simples `npm i @deepseek-ai/dsh-tools`.

## Desenvolvimento

```sh
pnpm install             # node ^22.19 || >=24
pnpm run build           # tsc --noEmitOnError → lib/
pnpm run prepare         # build autocontido para instalação via git (scripts/prepare.mjs)
pnpm run prepublishOnly  # compilar + testar antes de publicar
pnpm test                # vitest run
pnpm run typecheck       # tsc --noEmit
pnpm run check:readmes   # cruza âncoras de TOC, ferramentas e chaves de configuração nos 5 READMEs
```

## Estrutura do repositório

```
src/index.ts          plugin entry (name/inject/apply, applyWithDeps for tests)
src/config.ts         Schemastery Config
src/types.ts          local structural views of host services + Context merging
src/credential.ts     token resolution (seam → env → gh), per operation
src/github.ts         REST client: 429 retry, rate limits, diff media type
src/git.ts            read-only git inspection + origin parsing for any API host
src/review.ts         deterministic diff analyzer + sanitized comment drafting
src/jobs.ts           github-review background job producer (metadata + diff + CI + comments)
src/approval-gate.ts  tools/pre-execute ask/deny gate with write previews
src/tools.ts          the twelve model-facing tools
src/commands.ts       /pr, /review, /issue
src/present.ts        pure UI-card presenters
test/                 vitest suite + mock host scaffolding + opt-in e2e smoke
cordis.patch.yml      bundle patch (one insert row)
scripts/prepare.mjs   self-contained git-install build
```

## Tópicos

`dsh` · `dsh-plugin` · `deepseek-harness` · `github` · `pull-request` · `code-review` · `issue-tracker`

## Contribuidores

- [@PerryLink](https://github.com/PerryLink) — criador e mantenedor: a superfície de ferramentas do GitHub, a barreira de aprovação, os jobs de revisão em segundo plano, a ação composta de CI, o bot de revisão, a barreira de status-check e a documentação em cinco idiomas.
- [@AraragiEro](https://github.com/AraragiEro) — o cartão de configuração do token do GitHub na página de ajustes de Plugins (#6).
- [@alexchenzl](https://github.com/alexchenzl) — convidou o plugin a ser listado no DSH Directory (#5).

### Instalar a partir do mercado do DSH Desktop

Todos os plugins PerryLink podem ser explorados no mercado integrado do DSH Desktop: **Market → Sources → add source → colar** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ selecionar**. A instalação continua passando pela verificação de identidade npm do mercado e pela sua confirmação.

## Licença

[Apache License 2.0](LICENSE) © 2026 dsh-github contributors


## Interoperabilidade com outros plugins do DSH

Verificado contra **DSH `0.2.0-rc.2`** (o runtime para o qual este README é publicado) e o conjunto de plugins com mais estrelas pesquisado em 2026-10-05.

Este plugin **não interfere** em outros plugins, incluindo os de mais estrelas:

- **Sem colisão de nome de ferramenta.** Todas as ferramentas têm namespace; nenhuma ocupa um nome puro já pertencente a uma ferramenta embutida ou a outro plugin.
- **Sem colisão de chave de serviço.** Não fornece nenhuma chave de serviço, portanto não pode colidir em uma.
- **Sem colisão de slot.** Não registra nenhuma chave de slot de cliente, então não disputa um assento `shadows-shipped-ui`.
- **Sem colisão de rota HTTP.** Não registra nenhum prefixo `webServer`.
- **Sem colisão na camada de patch.** O patch do bundle apenas faz `insert` da própria linha; nunca sobrescreve o `config` de uma linha embutida.
- **Sem mutação global.** Não altera protótipos, não reescreve `process.env` nem substitui o dispatcher global de fetch.

**Listeners de eventos compartilhados não interferem por construção.** Observa os eventos sensíveis à ordem `tools/pre-execute` com `ctx.on()` — o registro de difusão do Cordis, onde cada listener executa e nenhum pode privar outro do turno. **Todos os listeners aqui delegam via `next()`**, então a cadeia nunca é curto-circuitada:
  - `tools/pre-execute` — also used by `cc-safety-net` (1576★).

Evidência estática: `dsh-plugin-doctor` K10–K13 retornam `pass` em todas as verificações deste repositório.

## PerryLink DSH Plugin Family

Este projeto faz parte da família de plugins do DeepSeek Harness da [PerryLink](https://github.com/PerryLink). O registro fica recolhido abaixo para que cada README mantenha uma primeira tela curta; expanda para ver cada linha e seu status.

<details>
<summary>Expandir todos os plugins</summary>

| Plugin | Status |
|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** |  |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** |  |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** |  |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** |  |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** |  |
| **[dsh-drill-script-check](https://github.com/PerryLink/dsh-drill-script-check)** |  |
| **[dsh-eia-guide-check](https://github.com/PerryLink/dsh-eia-guide-check)** |  |
| **[dsh-emergency-plan](https://github.com/PerryLink/dsh-emergency-plan)** |  |
| **[dsh-essay-rubric-check](https://github.com/PerryLink/dsh-essay-rubric-check)** |  |
| **[dsh-evidence-check](https://github.com/PerryLink/dsh-evidence-check)** |  |
| **[dsh-export-ctl-check](https://github.com/PerryLink/dsh-export-ctl-check)** |  |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** |  |
| **[dsh-fmea-table-check](https://github.com/PerryLink/dsh-fmea-table-check)** |  |
| **[dsh-forecast-penalty](https://github.com/PerryLink/dsh-forecast-penalty)** |  |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** |  |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** |  |
| **[dsh-gongwen-flow-check](https://github.com/PerryLink/dsh-gongwen-flow-check)** |  |
| **[dsh-gongwen-word-check](https://github.com/PerryLink/dsh-gongwen-word-check)** |  |
| **[dsh-guard-plan-qc](https://github.com/PerryLink/dsh-guard-plan-qc)** |  |
| **[dsh-hazchem-check](https://github.com/PerryLink/dsh-hazchem-check)** |  |
| **[dsh-hazplan-check](https://github.com/PerryLink/dsh-hazplan-check)** |  |
| **[dsh-hidden-risk-map](https://github.com/PerryLink/dsh-hidden-risk-map)** |  |
| **[dsh-hs-classify](https://github.com/PerryLink/dsh-hs-classify)** |  |
| **[dsh-icd-rule-check](https://github.com/PerryLink/dsh-icd-rule-check)** |  |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** |  |
| **[dsh-lawcite-adapter](https://github.com/PerryLink/dsh-lawcite-adapter)** |  |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** |  |
| **[dsh-lc-doc-check](https://github.com/PerryLink/dsh-lc-doc-check)** |  |
| **[dsh-learning-gap-check](https://github.com/PerryLink/dsh-learning-gap-check)** |  |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** |  |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** |  |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** |  |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** |  |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** |  |
| **[dsh-medrec-qc](https://github.com/PerryLink/dsh-medrec-qc)** |  |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** |  |
| **[dsh-nsfc-form-check](https://github.com/PerryLink/dsh-nsfc-form-check)** |  |
| **[dsh-nurse-record-check](https://github.com/PerryLink/dsh-nurse-record-check)** |  |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** |  |
| **[dsh-origin-rvc-check](https://github.com/PerryLink/dsh-origin-rvc-check)** |  |
| **[dsh-ota-review-check](https://github.com/PerryLink/dsh-ota-review-check)** |  |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** |  |
| **[dsh-paper-doc-adapter](https://github.com/PerryLink/dsh-paper-doc-adapter)** |  |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** |  |
| **[dsh-permit-report-check](https://github.com/PerryLink/dsh-permit-report-check)** |  |
| **[dsh-pipeline-check](https://github.com/PerryLink/dsh-pipeline-check)** |  |
| **[dsh-pleading-draft](https://github.com/PerryLink/dsh-pleading-draft)** |  |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** |  |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** |  |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** |  |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** |  |
| **[dsh-policy-brief-draft](https://github.com/PerryLink/dsh-policy-brief-draft)** |  |
| **[dsh-power-loss-split](https://github.com/PerryLink/dsh-power-loss-split)** |  |
| **[dsh-power-ticket-check](https://github.com/PerryLink/dsh-power-ticket-check)** |  |
| **[dsh-ppap-check](https://github.com/PerryLink/dsh-ppap-check)** |  |
| **[dsh-protest-deadline](https://github.com/PerryLink/dsh-protest-deadline)** |  |
| **[dsh-railway-window](https://github.com/PerryLink/dsh-railway-window)** |  |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** |  |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** |  |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | 🚫 RETIRADO — ver o README do repositório |

</details>
