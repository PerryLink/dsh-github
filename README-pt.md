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

![Demonstração de terminal do dsh-github: dsh-github — install, verify the row, check the repo](https://raw.githubusercontent.com/PerryLink/dsh-github/main/docs/assets/dsh-github-hero.png)

![Animated terminal demo of dsh-github](https://raw.githubusercontent.com/PerryLink/dsh-github/main/docs/assets/dsh-github-demo.gif)

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
| Harness | DeepSeek Harness `dsh-v0.2.1-alpha.1` (compatibilidade declarada para `>=0.1.2-rc.1 <0.2.0 \|\| >=0.1.5-alpha.1 <0.2.0 \|\| >=0.1.6-0 <0.2.0 \|\| >=0.1.7-0 <0.2.0`; 0.1.2-rc.1 adaptado em 2026-09-09): o job de revisão passa a pertencer a um `SessionId` puro e a fonte dos avisos usa o kind próprio do plugin `dsh-github` (a união `Agent \| SessionId` do host e o `kind: 'plugin'` genérico deixaram de existir); o cartão de configurações se registra na **página Plugins** (grupo Official, slot `plugins.item`) e renderiza a partir do form entregue por `dsh-client-ui-plugin-manager`, em vez de vincular o removido `ctx.settingsScope`; o driver de CI autoaprova pela costura oficial `ctx.approval.setPolicy`; o bot de revisão pesquisa como job em segundo plano `ctx.jobs` com fallback por temporizador. Atualizado em 2026-09-24 para `0.1.7-rc.2` (typecheck + typecheck:ci + 185 testes unitários verdes). |
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

Este projeto é um dos **87 plugins ativamente mantidos** do DeepSeek Harness da [PerryLink](https://github.com/PerryLink). O registro da família tem **95** plugins — **5 congelados**, **3 retirados** — e fica recolhido abaixo para que cada README mantenha uma primeira tela curta. Expanda para ver cada linha, com o motivo na coluna Status.

<details>
<summary>Expandir os 95 plugins</summary>

| Plugin | Uma linha | Status |
|---|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** | 水产养殖投入品记录核对（按投入品用量、休药期与起捕间隔核对记录自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** | 档案归档完整性与保管期限核对（依据《档案法》及配套规定，仅提示差异，不作出定性结论） |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command |  |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** | 投标文件符合性预检（按招标文件逐条核对响应情况，仅提示差异，不作出定性结论） |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** | 投标人资格条件核对（按资格条件与证明材料核对逐条响应，仅提示差异，不作出定性结论） |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore |  |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** | 合同条款立场台账核对（按立场、风险等级与退让底线核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** | 报关单证一致性核对（按公开的报关单填制规范核对单证间字段一致性，仅提示差异，不作出定性结论） |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) |  |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** | 滞箱费台账核对（按免箱期与费率核对超期天数与金额的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review |  |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-drill-script-check](https://github.com/PerryLink/dsh-drill-script-check)** | 应急演练脚本核对（按阶段、响应分级、指挥与资源要素核对脚本齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-eia-guide-check](https://github.com/PerryLink/dsh-eia-guide-check)** | 环评导则适用性核对（按要素、导则名称与执行标准核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-emergency-plan](https://github.com/PerryLink/dsh-emergency-plan)** | 应急预案要素齐备性与条款级页码定位（依据 GB/T 29639-2020 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-essay-rubric-check](https://github.com/PerryLink/dsh-essay-rubric-check)** | 作文量表评分核对（按评分项、原文定位与分值算术核对评分自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-evidence-check](https://github.com/PerryLink/dsh-evidence-check)** | 证据清单齐备性核对（按待证事实与证据要素核对清单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-export-ctl-check](https://github.com/PerryLink/dsh-export-ctl-check)** | 出口管制物项核对（按管制清单、最终用途与许可证核对台账齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. |  |
| **[dsh-fmea-table-check](https://github.com/PerryLink/dsh-fmea-table-check)** | FMEA 分析表要素齐备性与风险顺序数一致性核对（按公开的 FMEA 方法标准核对表内自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-forecast-penalty](https://github.com/PerryLink/dsh-forecast-penalty)** | 预测准确率考核核对（按准确率、门槛与考核单价核对考核费用的算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds |  |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval |  |
| **[dsh-gongwen-flow-check](https://github.com/PerryLink/dsh-gongwen-flow-check)** | 公文流转与办理时限核对（按公开的公文处理规范核对环节完整性与时限，仅提示差异，不作出定性结论） |  |
| **[dsh-gongwen-word-check](https://github.com/PerryLink/dsh-gongwen-word-check)** | 公文格式要素核对（按公开的党政机关公文格式标准核对版头与主体要素，仅提示差异，不作出定性结论） |  |
| **[dsh-guard-plan-qc](https://github.com/PerryLink/dsh-guard-plan-qc)** | 劳动保护与安全防护用品配置表核对（按公开的配备标准核对品名规格与配置数量，仅提示差异，不作出定性结论） |  |
| **[dsh-hazchem-check](https://github.com/PerryLink/dsh-hazchem-check)** | 危险化学品临界量与重大危险源辨识核对（按储存量与临界量核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-hazplan-check](https://github.com/PerryLink/dsh-hazplan-check)** | HAZOP 分析表要素齐备性与偏差推导一致性核对（依据公开的危险与可操作性分析标准，仅提示差异，不作出定性结论） |  |
| **[dsh-hidden-risk-map](https://github.com/PerryLink/dsh-hidden-risk-map)** | 安全隐患台账→《工贸企业重大事故隐患判定标准》（应急管理部令第10号）条款映射提示（仅提示差异，不作出定性结论） |  |
| **[dsh-hs-classify](https://github.com/PerryLink/dsh-hs-classify)** | 商品归类层级一致性核对（按章、品目、子目与商品编号的层级关系核对自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-icd-rule-check](https://github.com/PerryLink/dsh-icd-rule-check)** | ICD 合并编码与星剑号配对提示（依据 GB/T 14396-2016 与公开的 ICD 使用说明，仅提示差异，不作出定性结论） |  |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` |  |
| **[dsh-lawcite-adapter](https://github.com/PerryLink/dsh-lawcite-adapter)** | 法条引用与文书要素核对（按名称、条号、原文与效力状态核对引用可核验性，仅提示差异，不作出定性结论） |  |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools |  |
| **[dsh-lc-doc-check](https://github.com/PerryLink/dsh-lc-doc-check)** | 信用证单据条款核对（按单据种类、份数、期限与不符点核对交单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-learning-gap-check](https://github.com/PerryLink/dsh-learning-gap-check)** | 能力差距与培养计划核对（按能力等级差、培养措施与完成期限核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. |  |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. |  |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers |  |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer |  |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors |  |
| **[dsh-medrec-qc](https://github.com/PerryLink/dsh-medrec-qc)** | 病案首页形式质控与逻辑矛盾提示（依据国卫办医发〔2016〕24号等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool |  |
| **[dsh-nsfc-form-check](https://github.com/PerryLink/dsh-nsfc-form-check)** | 国家自然科学基金申请书形式审查与匿名化提示（依据《国家自然科学基金条例》与申请人导入的当年指南，仅提示差异，不作出定性结论） |  |
| **[dsh-nurse-record-check](https://github.com/PerryLink/dsh-nurse-record-check)** | 护理记录时限、签名与评估表完整性校验（依据《病历书写基本规范》等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. |  |
| **[dsh-origin-rvc-check](https://github.com/PerryLink/dsh-origin-rvc-check)** | 原产地区域价值成分核对（按 RVC 定义式与门槛核对原产地判定自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-ota-review-check](https://github.com/PerryLink/dsh-ota-review-check)** | 在线点评回复台账核对（按回复时限、问题分类与整改状态核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching |  |
| **[dsh-paper-doc-adapter](https://github.com/PerryLink/dsh-paper-doc-adapter)** | 试卷解析结构核对（按题型、答案、分值与 yotta 标识核对试卷结构自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit |  |
| **[dsh-permit-report-check](https://github.com/PerryLink/dsh-permit-report-check)** | 行政许可办理核对（按申请材料、法定时限与决定记录核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-pipeline-check](https://github.com/PerryLink/dsh-pipeline-check)** | 项目全流程文件链条核对（按环节先后与金额口径核对链条自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-pleading-draft](https://github.com/PerryLink/dsh-pleading-draft)** | 起诉状要素齐备性核对（按诉请、事实、证据、法条四要素核对文书齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins |  |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill |  |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins |  |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card |  |
| **[dsh-policy-brief-draft](https://github.com/PerryLink/dsh-policy-brief-draft)** | 政策专报要素核对（按观点、依据、出处与建议核对专报齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-power-loss-split](https://github.com/PerryLink/dsh-power-loss-split)** | 线损电量拆分与考核表核对（依据公开的线损计算口径，仅提示差异，不作出定性结论） |  |
| **[dsh-power-ticket-check](https://github.com/PerryLink/dsh-power-ticket-check)** | 电力工作票要素齐备性与签发许可顺序核对（依据现行电力安全工作规程，仅提示差异，不作出定性结论） |  |
| **[dsh-ppap-check](https://github.com/PerryLink/dsh-ppap-check)** | PPAP 提交要素齐备性核对（按公开的 PPAP 手册与提交等级核对要素齐备与版本填写，仅提示差异，不作出定性结论） |  |
| **[dsh-protest-deadline](https://github.com/PerryLink/dsh-protest-deadline)** | 质疑与投诉期限核对（按公开的政府采购质疑投诉规定核对期限与台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-railway-window](https://github.com/PerryLink/dsh-railway-window)** | 铁路施工天窗台账核对（按时间窗、时长算术与命令号核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** | 维修工单结算核对（按项目金额、配件工时合计与结算总额核对算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** | 审稿意见逐条回应覆盖核对（按意见与回应一一对应核对覆盖完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** | 规则库文件自检核对（按条款引用纪律与效力上限核对规则库自身合规，仅提示差异，不作出定性结论） |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** | 安全技术交底记录要素齐备性与签字闭环核对（依据公开的安全生产法规与检查标准，仅提示差异，不作出定性结论） |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. |  |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** | 监理日志跨日连续性与旁站覆盖提示（依据 GB/T 50319-2013 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** | 三重一大决策台账核对（按前置研究、会议审议与决议记录核对程序留痕，仅提示差异，不作出定性结论） |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** | 土壤与地下水监测台账核对（按点位、监测项目、限值与超标判定核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** | 作业规程与 FMEA／控制计划一致性核对（按编号与版本核对三份文件是否同步，仅提示差异，不作出定性结论） |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** | 控制图常数与过程能力指数核对（按 GB/T 4091 的常规控制图常数表核对控制限与 Cp/Cpk 的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. |  |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** | 招标文件条款摘录核对（按出处与原文逐字核对摘录完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** | 评标因素评分矩阵核对（按分值上限与合计核对矩阵自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** | 质保期与索赔金额核对（按质保期月数与里程、索赔金额算式核对自洽，仅提示差异，不作出定性结论） |  |

</details>

</details>

</details>