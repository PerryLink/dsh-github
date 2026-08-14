<h1 align="center">dsh-github</h1>

<p align="center">
  <b>Traga o GitHub para o DeepSeek Harness.</b><br/>
  Crie pull requests · revise PRs com comentários inline ou de resumo · gerencie issues · pesquise — toda gravação passa pela aprovação humana, e o token nunca é registrado.
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">中文</a> ·
  <a href="README.es.md">Español</a> ·
  Português ·
  <a href="README.hi.md">हिन्दी</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License: Apache 2.0">
  <img src="https://img.shields.io/badge/dsh-0.1.0--rc.6-4D6BFE" alt="dsh: 0.1.0-rc.6">
  <img src="https://img.shields.io/badge/dsh-dsh--plugin-4D6BFE" alt="dsh-plugin">
  <img src="https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen" alt="Node: ^22.19 || >=24">
  <img src="https://github.com/PerryLink/dsh-github/actions/workflows/ci.yml/badge.svg" alt="CI">
  <img src="https://img.shields.io/badge/documents-EN%2FZH%2FES%2FPT%2FHI-8257D0" alt="Documents: EN/ZH/ES/PT/HI">
</p>

---

**dsh-github** é um plugin de bundle para o [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) — o harness de agentes "tudo é um plugin". Ele preenche a lacuna do GitHub entre o dsh e ferramentas como o [Claude Code](https://github.com/anthropics/claude-code) (`gh claude` / [claude-code-action](https://github.com/anthropics/claude-code-action)) e o [Codex](https://github.com/openai/codex) (`@codex review` / Autofix CI): seu agente pode **ler um PR, revisar um PR, abrir um PR, comentar e fechar issues, e pesquisar** — enquanto um humano aprova toda gravação e o token permanece em segredo.

- 🛠 **8 ferramentas** — `pr_create` · `gh_review` · `review_post` · `gh_issue` · `issue_open` · `issue_comment` · `issue_close` · `gh_search`, todas com JSON canônico via `defineTool`
- ⌨️ **3 famílias de comandos** — `/pr create` · `/review` (start/stop/post) · `/issue open`
- 📝 **Revisões inline** — `review_post` publica um único comentário de resumo ou comentários de revisão ancorados por linha no commit head do PR
- 🔒 **Gravações com aprovação obrigatória** — toda gravação no GitHub passa por `ctx.approval` (padrão `ask`, falha fechada); os motivos de aprovação pré-visualizam títulos, tamanhos de corpo e substituições de comentários
- 🗝 **Sigilo do token** — camada de credenciais → ambiente → CLI `gh`, resolvido por operação, nunca em logs, eventos, renderizações ou erros
- ⏱ **Jobs de revisão em segundo plano** — `/review` roda em `ctx.jobs` com a própria superfície `job_list` / `job_output` / `job_kill` do host, e reporta o status de CI e a contagem de comentários junto com os achados
- 🤖 **Opção de revisão por modelo** — `reviewMode: "model"` delega o diff limitado a um subagente de uso único pela seam `subagents` do host; o modo `static` padrão permanece determinístico e sem gasto de tokens
- 🚦 **Backoff de 429 + exibição de cota** — o modelo vê o limite de taxa restante em todo resultado, incluindo falhas; os erros de busca por seção são exibidos em vez de engolidos
- 🌐 **Documentação em 5 idiomas** — English · 中文 · Español · Português · हिन्दी

---

## 📚 Índice

- [Início rápido](#🚀-início-rápido)
- [Funcionalidades](#✨-funcionalidades)
- [Instalação](#📦-instalação)
- [Configuração](#⚙️-configuração)
- [Ferramentas](#🛠-ferramentas)
- [Comandos](#⌨️-comandos)
- [Arquitetura](#🏗-arquitetura)
- [Limites de segurança](#🔒-limites-de-segurança)
- [Limitações conhecidas](#⚠️-limitações-conhecidas)
- [Desenvolvimento](#🧪-desenvolvimento)
- [Estrutura do repositório](#🗂-estrutura-do-repositório)
- [Tópicos](#🏷-tópicos)
- [Licença](#licença)

## 🚀 Início rápido

```sh
# 1. install (tarball channel — no build permission needed)
pnpm pack                              # inside this repo → dsh-github-0.4.0.tgz
dsh plugin --profile <name> add ./dsh-github-0.4.0.tgz

# 2. configure a GitHub token (recommended: the credentials seam)
#    $DSH_HOME/.credentials.yaml
#    GITHUB_TOKEN: <your token>

# 3. use it — in the dsh web UI or headless
#    /pr create "add dark mode"      → agent drafts & opens the PR (approval required)
#    /review 42                      → background review job, read it with job_output
#    /review post github-review-1    → publish the review comment (approval required)
#    /issue open "crash on startup"  → agent opens the issue (approval required)
```

Verifique: `dsh --profile <name> --dump-config` deve mostrar a seção `# == dsh-github` sem **nenhuma linha FAILED**.

## ✨ Funcionalidades

| Área | O que você obtém |
|---|---|
| **Criar PRs** | `/pr create [title]` lê o estado do git (branch, arquivos alterados, commits à frente) e entrega um rascunho ao agente; `pr_create` abre o PR e retorna sua URL |
| **Revisar PRs** | `gh_review` resume metadados, diff limitado (texto completo no valor canônico, trecho limitado na renderização), comentários, status de CI e achados estáticos — as falhas de busca por seção são reportadas como `diff.error` / `comments.error` / `ci.error` |
| **Publicar revisões** | `review_post` publica um comentário agregado no nível da issue (`mode: "summary"`, padrão) ou comentários de revisão ancorados por linha no commit head do PR (`mode: "inline"`); uma substituição de `body` permite que o modelo refine o comentário primeiro — após a aprovação humana |
| **Revisões em segundo plano** | `/review <pr>` busca metadados, o diff limitado, as verificações de CI e os comentários existentes em um job de `ctx.jobs`; a saída de conclusão traz o resumo dos achados, o status de CI e a contagem de comentários; `reviewMode: "model"` delega o diff a um subagente de uso único em vez do analisador estático |
| **Ler issues** | `gh_issue` lista / obtém / comenta; os pull requests nas listagens são marcados como `kind: "pr"` |
| **Gerenciar issues** | `issue_open` cria, `issue_comment` comenta (também funciona em PRs), `issue_close` fecha com um motivo de estado opcional — todos com aprovação obrigatória |
| **Pesquisar** | `gh_search` consulta issues e pull requests com a sintaxe de busca do GitHub, exibindo a cota de busca separada |
| **Aprovação** | `tools/pre-execute` consulta `ctx.approval` para toda gravação; a allowlist `allowedActions` nega antes de perguntar |
| **Segurança do segredo** | O token é lido por operação e enviado apenas no cabeçalho Authorization; um teste dedicado garante que ele nunca aparece em nenhuma saída visível |
| **Resiliência** | Nova tentativa em 429 com backoff `Retry-After`/`x-ratelimit-reset`; as ferramentas de leitura são seguras para concorrência; todas as chamadas respeitam o cancelamento |
| **Observabilidade** | Visível ao modelo ⇔ registrado: tudo o que o modelo vê flui pelos próprios eventos de sessão do host (`tool/result`, `user/message`, `command/run`, `approval/asked`…) |

## 📦 Instalação

Três canais documentados — escolha um.

| Canal | Comando | Observações |
|---|---|---|
| **tarball npm** | `dsh plugin --profile <name> add ./dsh-github-0.4.0.tgz` | Envia com `lib/` compilado — sem permissão de build |
| **fonte git** | `dsh plugin --profile <name> add "github:PerryLink/dsh-github#<sha>"` | Requer `prepare` + `allowBuilds` (veja abaixo); fixe o commit |
| **link local** | `pnpm link --dir .` e depois `dsh plugin add dsh-github` | Desenvolvimento |

Instalações via git: o pnpm ≥10 recusa o `prepare` de uma dependência git até que ela seja incluída na allowlist — o `dsh` imprime a chave exata; copie-a para o `pnpm-workspace.yaml` do perfil:

```yaml
allowBuilds:
  dsh-github: true
```

O script `prepare` (`scripts/prepare.mjs`) é autocontido: ele compila com TypeScript quando um compilador é resolvível, caso contrário recorre aos **artefatos `lib/` commitados** e falha em alto e bom som se não houver nenhum dos dois.

**Desinstalar:** `dsh plugin --profile <name> remove dsh-github`.

## ⚙️ Configuração

Validado pelo Schemastery no momento do carregamento (falha em alto e bom som). Sobrescreva qualquer chave no `cordis.patch.yml` do perfil (toda a configuração da linha é substituída, nunca mesclada profundamente).

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
| `reviewMode` | `static` | Motor de revisão: `static` (analisador determinístico) ou `model` (subagente de uso único pela seam `subagents` do host; falha em alto e bom som quando a seam está ausente) |
| `modelReviewProvider` | — | Nome do provedor de subagente para `reviewMode: "model"`; usa, por padrão, o primeiro provedor registrado |
| `maxRetries` | `3` | Tentativas de nova tentativa em 429 por requisição |
| `retryBaseMs` | `500` | Base do backoff de nova tentativa (dobra a cada tentativa) |
| `retryMaxWaitMs` | `60000` | Teto do backoff de nova tentativa |
| `apiBaseUrl` | `https://api.github.com` | URL base da API REST do GitHub (GitHub Enterprise) |
| `allowedActions` | `['pr.create','review.post','issue.create','issue.comment','issue.close']` | Allowlist de ações de gravação; qualquer outra coisa é negada antes da aprovação |
| `workspaceDir` | process cwd | Diretório de trabalho para inspeção somente leitura do git |

## 🛠 Ferramentas

| Ferramenta | Tipo | Parâmetros | Retorna |
|---|---|---|---|
| `pr_create` | gravação | `title*`, `body?`, `base?`, `head?`, `draft?`, `ownerRepo?` | `{status:'created', url, number, title, state, draft, base, head, rateLimit}` ou erro estruturado |
| `gh_review` | leitura | `pr*` (number / `#n` / `o/r#n` / URL), `fields?`, `maxDiffChars?` | metadados, diff limitado (texto completo `diff.text` + trecho limitado `diff.excerpt` + estatísticas por arquivo), comentários, CI, achados estáticos, campos de `error` por seção, limite de taxa |
| `gh_issue` | leitura | `action*` (`list`/`get`/`comments`), `ownerRepo?`, `issueNumber?`, `state?`, `limit?` | itens normalizados (cada um marcado `kind: issue/pr/comment`) + limite de taxa |
| `review_post` | gravação | `jobId*`, `mode?` (`summary`/`inline`), `body?` | `{status:'posted', mode, url, commentId?, reviewId?, findings, rateLimit}` ou erro estruturado |
| `issue_open` | gravação | `title*`, `body?`, `labels?`, `ownerRepo?` | `{status:'created', url, number, title, rateLimit}` ou erro estruturado |
| `issue_comment` | gravação | `issueNumber*`, `body*`, `ownerRepo?` | `{status:'commented', url, commentId, issueNumber, rateLimit}` ou erro estruturado |
| `issue_close` | gravação | `issueNumber*`, `ownerRepo?`, `stateReason?` (`completed`/`not_planned`) | `{status:'closed', url, number, title, rateLimit}` ou erro estruturado |
| `gh_search` | leitura | `q*`, `sort?`, `order?`, `perPage?` | `{query, total, items[{number,title,state,kind,author,url,repo,comments,createdAt}], rateLimit}` ou erro estruturado |

`execute` retorna apenas o JSON canônico declarado por `output.schema`. Falhas de token ausente e da API do GitHub são variantes de erro estruturado que carregam fatos do limite de taxa; falhas de infraestrutura lançam exceção (→ `isError`). `exec.signal` é respeitado em todos os lugares.

## ⌨️ Comandos

| Comando | Efeito |
|---|---|
| `/pr create [title]` | Lê o estado do git e enfileira uma instrução `pr_create` para o modelo (corpo rascunhado, padrões, sem commit/push a menos que `autoCommit`). Criar o PR solicita aprovação. |
| `/review <pr>` | Inicia um job de revisão em segundo plano; imprime o id do job. A conclusão é anunciada pelo host; leia-a com `job_output`. |
| `/review <pr> --max-diff <n> --no-ci --no-comments` | Substituições por job: limite de diff e quais seções suplementares o job busca. |
| `/review stop <jobId>` | Cancela o job (controle local, sem gravação no GitHub). |
| `/review post <jobId>` | Enfileira uma instrução `review_post` para o modelo (resumo ou inline); publicar solicita aprovação. |
| `/issue open <title>` | Enfileira uma instrução `issue_open` para o modelo; criar solicita aprovação. |

## 🏗 Arquitetura

```
                    ┌───────────────────────────────────────────────┐
                    │                   dsh-github                  │
                    │                                               │
 humanos ─── /pr ────┼──► git reader (read-only) ──► agent.followup  │
         /review ───┼──► ctx.jobs.start("github-review") ──► job    │
         /issue ────┼──► agent.followup                              │
                    │                                               │
 modelo ─── pr_create / gh_review / gh_issue / review_post /         │
           issue_open / issue_comment / issue_close / gh_search     │
           (defineTool, canonical JSON only)                        │
                    │                                               │
                    └───────┬───────────────┬───────────────┬───────┘
                            │               │               │
                  tools/pre-execute     credential        GitHub REST
                  approval gate        resolution        client (fetch,
                  (ask | deny)      (seam → env →       429 retry,
                                    gh CLI, per-op)     rate-limit)
```

- **Camada de credenciais.** `tokenSource: auto` resolve por operação na ordem camada de credenciais (referência `GITHUB_TOKEN`) → variável de ambiente → token da CLI `gh`. O valor é uma variável local entregue ao cliente REST; ele nunca entra em valores canônicos, renderizações, cards, saídas de comandos, avisos injetados, saídas de jobs, motivos de aprovação ou mensagens de erro.
- **Aprovação.** Todas as gravações passam pelas ferramentas do modelo. Um listener waterfall `tools/pre-execute` retorna `ask` para as cinco ferramentas de gravação, de modo que o registro pergunta ao humano por meio de `ctx.approval` (o host registra o par de auditoria `approval/asked` + `approval/decided`) e falha fechado sem um respondedor. Os motivos de aprovação pré-visualizam o que será publicado (títulos, tamanhos de corpo e a primeira linha de um corpo de revisão substituído). Comandos nunca gravam diretamente: os handlers de comando rodam sem um turno aberto, então a camada de aprovação é estruturalmente fechada para eles — um comando de gravação coleta contexto somente leitura e então acorda o agente (`followup` quando ocioso, `inject` quando ocupado) para que o modelo execute a ferramenta com aprovação dentro de um turno.
- **Revisão em segundo plano.** `/review <pr>` inicia um job `github-review` em `ctx.jobs` (label, owner, timeout, cancelável). O job resolve o token por operação, busca os metadados do PR (capturando o SHA do commit head para a publicação inline), o diff limitado e — a menos que desativado — as execuções de verificação de CI e os comentários de revisão existentes, e então executa um analisador determinístico de múltiplos arquivos (`src/review.ts`: segredos hardcoded, chaves de API do Google, atribuições de credenciais, artefatos de debug, eval, marcadores TODO, linhas longas, mudanças grandes demais) — zero tokens gastos, totalmente testável. Com `reviewMode: "model"`, o job entrega o diff limitado a um subagente de uso único pela seam `subagents` do host (o agente proprietário é o pai) e armazena a saída Markdown do filho como o relatório publicável; uma seam ou provedor ausente falha em alto e bom som. As falhas de busca de seções suplementares são anotadas na saída sem fazer o job falhar. Os avisos de conclusão chegam à sessão de origem por meio do consumidor `dsh-tool-jobs` do host; o modelo lê o relatório por meio da ferramenta existente `job_output` e o publica com `review_post` — aprovação necessária.
- **Visível ao modelo ⇔ registrado.** O plugin não acrescenta **nenhum tipo de evento de sessão personalizado**. Tipos de evento fora do repositório não estão em `KNOWN_SESSION_EVENT_TYPES` do host, então um evento obrigatório desconhecido tornaria o log da sessão ilegível após a remoção do plugin (o host deliberadamente adia uma superfície de registro para plugins externos). Todo conteúdo visível ao modelo, portanto, flui por superfícies registradas pelo host: valores canônicos de `tool/result`, avisos `user/message` via `agent.inject`/`agent.followup`, o par de ciclo de vida `command/run` + `command/done` e o par de auditoria `approval/asked` + `approval/decided`.
- **Presenters puros.** `presentCall`/`presentResult` são funções puras de `args` (+ o `result.meta` persistido), idênticas no streaming ao vivo e na reprodução do log. A criação de PR mostra um card genérico com a URL do PR.

## 🔒 Limites de segurança

- O token é lido por operação da fonte configurada (camada de credenciais, ambiente ou CLI `gh`) e enviado apenas no cabeçalho Authorization do cliente REST. Ele nunca é registrado, nunca é renderizado, nunca é injetado, nunca é anexado ao log da sessão e nunca aparece nas mensagens de erro.
- Toda gravação no GitHub exige `allowed-once` de `ctx.approval` (política padrão `ask`); `rejected`, `cancelled` e `unavailable` falham todos de forma fechada.
- `/pr create` nunca faz commit ou push por conta própria; com `autoCommit: true`, o modelo realiza essas gravações pela própria barreira de aprovação da ferramenta bash. O dsh-github **não** gerencia a identidade do git (trabalho do dsh-git-identity) nem worktrees (trabalho do dsh-worktree).
- O job de revisão não realiza gravações: ele lê um diff e armazena um relatório na memória do processo; apenas `review_post` publica, após aprovação.
- Os comentários publicados interpolam nomes de arquivo derivados do diff, que são conteúdo de repositório não confiável: `formatPostBody` escapa as crases e escapa em HTML os nomes de arquivo para que uma PR hostil não possa injetar Markdown no comentário de revisão.
- Os corpos de issues/PRs, os comentários e os resultados de busca lidos do GitHub são conteúdo externo não confiável que entra no contexto do modelo — a mesma contrapartida inerente à busca na web; o plugin os marca como conteúdo externo em suas renderizações.
- Limites de taxa: os 429 são repetidos com backoff e a cota restante é exibida ao modelo em todo resultado, incluindo falhas.

## ⚠️ Limitações conhecidas

- **Sem eventos de sessão personalizados** — deliberado (veja Arquitetura); as trilhas de auditoria dependem do próprio vocabulário de eventos do host.
- **Analisador estático por padrão** — regras determinísticas (`src/review.ts`), zero tokens, reproduzível. `reviewMode: "model"` delega o diff limitado a um subagente de uso único pela seam `subagents` do host para uma revisão por LLM (consome tokens; requer a seam e um provedor registrado).
- **Jobs e registros são locais ao processo** — o relatório de revisão vive na memória do plugin, indexado pelo id do job, acompanhando o tempo de vida do registro de jobs do host; o mapa de registros é limitado por `maxReviewRecords` (os registros concluídos mais antigos são removidos primeiro).
- **As dist-tags `latest` do npm estão desatualizadas** — o plugin declara faixas de peer `^0.1.0-rc.5` para resolver contra o fechamento de perfil que o `dsh-base` fornece, e fixa `0.1.0-rc.6` para desenvolvimento. Nunca instale por meio de um `npm i @deepseek-ai/dsh-tools` simples.
- **CI / GitHub Action** (`dsh-github-action`, loop headless revisão→comentário no espírito do claude-code-action / codex-action) é um repositório complementar v2 planejado.

## 🧪 Desenvolvimento

```sh
pnpm install
pnpm test          # vitest: config, credentials, 429/retry, tools, commands, jobs, approval gate, token non-leakage
pnpm typecheck
pnpm build         # tsc → lib/ (noEmitOnError)
pnpm pack          # installable tarball
pnpm run check:readmes   # cross-checks TOC anchors in all 5 READMEs
```

Os testes simulam a API do GitHub, a CLI `gh` e o git por meio de runners injetados — sem rede, sem credenciais reais. `test/security.test.ts` garante que a string do token nunca aparece em nenhuma saída visível ao modelo ou ao humano. `test/e2e.test.ts` contém testes de fumaça optativos da API real que se pulam automaticamente a menos que `GITHUB_TOKEN` esteja definido (apenas endpoints somente leitura).

## 🗂 Estrutura do repositório

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
src/tools.ts          the eight model-facing tools
src/commands.ts       /pr, /review, /issue
src/present.ts        pure UI-card presenters
test/                 vitest suite + mock host scaffolding + opt-in e2e smoke
cordis.patch.yml      bundle patch (one insert row)
scripts/prepare.mjs   self-contained git-install build
```

## 🏷 Tópicos

Tópicos recomendados do repositório GitHub (defina-os nas configurações do repositório — eles alimentam a [página de tópicos `dsh-plugin`](https://github.com/topics/dsh-plugin) e os marketplaces de plugins DSH):

`dsh` · `dsh-plugin` · `deepseek-harness` · `github` · `pull-request` · `code-review` · `issue-tracker`

## Licença

[Apache License 2.0](LICENSE)
