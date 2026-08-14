<h1 align="center">dsh-github</h1>

<p align="center">
  <b>Trae GitHub a DeepSeek Harness.</b><br/>
  Crea pull requests · revisa PRs con comentarios en línea o de resumen · gestiona issues · busca — cada escritura requiere aprobación humana y el token nunca se registra.
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">中文</a> ·
  Español ·
  <a href="README.pt.md">Português</a> ·
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

**dsh-github** es un plugin bundle para [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) — el agente harness «todo es un plugin». Cubre el vacío de GitHub entre dsh y herramientas como [Claude Code](https://github.com/anthropics/claude-code) (`gh claude` / [claude-code-action](https://github.com/anthropics/claude-code-action)) y [Codex](https://github.com/openai/codex) (`@codex review` / Autofix CI): tu agente puede **leer una PR, revisar una PR, abrir una PR, comentar y cerrar issues, y buscar** — mientras un humano aprueba cada escritura y el token permanece en secreto.

- 🛠 **8 herramientas** — `pr_create` · `gh_review` · `review_post` · `gh_issue` · `issue_open` · `issue_comment` · `issue_close` · `gh_search`, todas con JSON canónico mediante `defineTool`
- ⌨️ **3 familias de comandos** — `/pr create` · `/review` (start/stop/post) · `/issue open`
- 📝 **Revisiones en línea** — `review_post` publica un único comentario de resumen o comentarios de revisión anclados por línea contra el commit head de la PR
- 🔒 **Escrituras con aprobación** — cada escritura en GitHub pasa por `ctx.approval` (`ask` por defecto, se cierra ante fallo); los motivos de aprobación previsualizan títulos, tamaños de cuerpo y anulaciones de comentarios
- 🗝 **Secreto del token** — capa de credenciales → entorno → CLI `gh`, resuelto por operación, nunca en registros, eventos, representaciones ni errores
- ⏱ **Trabajos de revisión en segundo plano** — `/review` se ejecuta en `ctx.jobs` con la superficie propia del host `job_list` / `job_output` / `job_kill`, e informa del estado de CI y el recuento de comentarios junto a los hallazgos
- 🤖 **Opción de revisión por modelo** — `reviewMode: "model"` delega el diff limitado a un subagente de un solo uso a través de la seam `subagents` del host; el modo `static` por defecto sigue siendo determinista y sin tokens
- 🚦 **Reintento 429 + visibilidad de cuota** — el modelo ve el límite de velocidad restante en cada resultado, incluidos los fallos; los errores de obtención por sección se muestran en lugar de ocultarse
- 🌐 **Documentación en 5 idiomas** — English · 中文 · Español · Português · हिन्दी

---

## 📚 Tabla de contenidos

- [Inicio rápido](#🚀-inicio-rápido)
- [Características](#✨-características)
- [Instalación](#📦-instalación)
- [Configuración](#⚙️-configuración)
- [Herramientas](#🛠-herramientas)
- [Comandos](#⌨️-comandos)
- [Arquitectura](#🏗-arquitectura)
- [Límites de seguridad](#🔒-límites-de-seguridad)
- [Limitaciones conocidas](#⚠️-limitaciones-conocidas)
- [Desarrollo](#🧪-desarrollo)
- [Estructura del repositorio](#🗂-estructura-del-repositorio)
- [Temas](#🏷-temas)
- [Licencia](#licencia)

## 🚀 Inicio rápido

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

Verificación: `dsh --profile <name> --dump-config` debe mostrar la sección `# == dsh-github` con **ninguna línea FAILED**.

## ✨ Características

| Área | Qué obtienes |
|---|---|
| **Crear PRs** | `/pr create [title]` lee el estado de git (rama, archivos modificados, commits por delante) y entrega un borrador al agente; `pr_create` abre la PR y devuelve su URL |
| **Revisar PRs** | `gh_review` resume metadatos, diff limitado (texto completo en el valor canónico, extracto acotado en la representación), comentarios, estado de CI y hallazgos estáticos — los fallos de obtención por sección se informan como `diff.error` / `comments.error` / `ci.error` |
| **Publicar revisiones** | `review_post` publica un comentario agregado a nivel de issue (`mode: "summary"`, por defecto) o comentarios de revisión anclados por línea en el commit head de la PR (`mode: "inline"`); una anulación de `body` permite que el modelo pula primero el comentario — tras la aprobación humana |
| **Revisiones en segundo plano** | `/review <pr>` obtiene metadatos, el diff limitado, las comprobaciones de CI y los comentarios existentes en un job de `ctx.jobs`; la salida de finalización incluye el resumen de hallazgos, el estado de CI y el recuento de comentarios; `reviewMode: "model"` delega el diff a un subagente de un solo uso en lugar del analizador estático |
| **Leer issues** | `gh_issue` lista / obtiene / comenta; los pull requests en los listados se marcan como `kind: "pr"` |
| **Gestionar issues** | `issue_open` crea, `issue_comment` comenta (también funciona en PRs), `issue_close` cierra con un motivo de estado opcional — todas con aprobación |
| **Buscar** | `gh_search` consulta issues y pull requests con la sintaxis de búsqueda de GitHub, mostrando la cuota de búsqueda independiente |
| **Aprobación** | `tools/pre-execute` pide `ctx.approval` para cada escritura; la lista blanca `allowedActions` deniega antes de preguntar |
| **Seguridad del secreto** | El token se lee por operación y se envía solo en el encabezado Authorization; una prueba dedicada verifica que nunca aparece en ninguna salida visible |
| **Resiliencia** | Reintento 429 con retroceso `Retry-After`/`x-ratelimit-reset`; las herramientas de lectura son seguras ante concurrencia; todas las llamadas respetan la cancelación |
| **Observabilidad** | Visible para el modelo ⇔ registrado: todo lo que el modelo ve fluye a través de los eventos de sesión propios del host (`tool/result`, `user/message`, `command/run`, `approval/asked`…) |

## 📦 Instalación

Tres canales documentados — elige uno.

| Canal | Comando | Notas |
|---|---|---|
| **Tarball npm** | `dsh plugin --profile <name> add ./dsh-github-0.4.0.tgz` | Se distribuye con `lib/` compilado — sin permiso de compilación |
| **Fuente git** | `dsh plugin --profile <name> add "github:PerryLink/dsh-github#<sha>"` | Requiere `prepare` + `allowBuilds` (ver abajo); fija el commit |
| **Enlace local** | `pnpm link --dir .` y luego `dsh plugin add dsh-github` | Desarrollo |

Instalaciones git: pnpm ≥10 rechaza el `prepare` de una dependencia git hasta que esté en la lista permitida — `dsh` imprime la clave exacta; cópiala en el `pnpm-workspace.yaml` del perfil:

```yaml
allowBuilds:
  dsh-github: true
```

El script `prepare` (`scripts/prepare.mjs`) es autocontenido: compila con TypeScript cuando hay un compilador disponible; de lo contrario, recurre a los **artefactos `lib/` confirmados** y falla de forma evidente si no hay ninguno.

**Desinstalación:** `dsh plugin --profile <name> remove dsh-github`.

## ⚙️ Configuración

Validado con Schemastery en el momento de carga (falla de forma evidente). Sobrescribe cualquier clave en el `cordis.patch.yml` del perfil (se reemplaza la configuración completa de la fila, nunca se fusiona en profundidad).

| Clave | Por defecto | Significado |
|---|---|---|
| `tokenSource` | `auto` | `auto` (credenciales → env → gh) o uno de `credentials` / `env` / `gh` |
| `tokenRef` | `GITHUB_TOKEN` | Referencia de la capa de credenciales / nombre de la variable de entorno |
| `defaultOwnerRepo` | — | `owner/repo` de respaldo cuando una llamada no indica ninguno y git no tiene origen |
| `autoCommit` | `false` | Si `/pr create` puede indicar al modelo que haga commit+push primero |
| `maxDiffChars` | `8000` | Límite de caracteres para los diffs de PR leídos en las revisiones |
| `renderExcerptChars` | `2000` | Límite de caracteres para el extracto de diff representado en la salida de la herramienta |
| `maxComments` | `20` | Límite para los comentarios de PR listados por `gh_review` |
| `reviewJobTimeoutMs` | `600000` | Plazo para un trabajo de revisión en segundo plano (falla con `timeout`) |
| `maxReviewRecords` | `50` | Límite para los registros en memoria de trabajos de revisión; los registros finalizados más antiguos se eliminan primero |
| `reviewMode` | `static` | Motor de revisión: `static` (analizador determinista) o `model` (subagente de un solo uso a través de la seam `subagents` del host; falla de forma evidente si la seam no está presente) |
| `modelReviewProvider` | — | Nombre del proveedor de subagente para `reviewMode: "model"`; por defecto, el primer proveedor registrado |
| `maxRetries` | `3` | Intentos de reintento 429 por solicitud |
| `retryBaseMs` | `500` | Base del retroceso de reintento (se duplica por intento) |
| `retryMaxWaitMs` | `60000` | Tope del retroceso de reintento |
| `apiBaseUrl` | `https://api.github.com` | URL base de la API REST de GitHub (GitHub Enterprise) |
| `allowedActions` | `['pr.create','review.post','issue.create','issue.comment','issue.close']` | Lista blanca de acciones de escritura; cualquier otra se deniega antes de la aprobación |
| `workspaceDir` | process cwd | Directorio de trabajo para la inspección de git de solo lectura |

## 🛠 Herramientas

| Herramienta | Tipo | Parámetros | Devuelve |
|---|---|---|---|
| `pr_create` | escritura | `title*`, `body?`, `base?`, `head?`, `draft?`, `ownerRepo?` | `{status:'created', url, number, title, state, draft, base, head, rateLimit}` o error estructurado |
| `gh_review` | lectura | `pr*` (número / `#n` / `o/r#n` / URL), `fields?`, `maxDiffChars?` | metadatos, diff limitado (texto completo `diff.text` + extracto acotado `diff.excerpt` + estadísticas por archivo), comentarios, CI, hallazgos estáticos, campos de `error` por sección, límite de velocidad |
| `gh_issue` | lectura | `action*` (`list`/`get`/`comments`), `ownerRepo?`, `issueNumber?`, `state?`, `limit?` | elementos normalizados (cada uno marcado `kind: issue/pr/comment`) + límite de velocidad |
| `review_post` | escritura | `jobId*`, `mode?` (`summary`/`inline`), `body?` | `{status:'posted', mode, url, commentId?, reviewId?, findings, rateLimit}` o error estructurado |
| `issue_open` | escritura | `title*`, `body?`, `labels?`, `ownerRepo?` | `{status:'created', url, number, title, rateLimit}` o error estructurado |
| `issue_comment` | escritura | `issueNumber*`, `body*`, `ownerRepo?` | `{status:'commented', url, commentId, issueNumber, rateLimit}` o error estructurado |
| `issue_close` | escritura | `issueNumber*`, `ownerRepo?`, `stateReason?` (`completed`/`not_planned`) | `{status:'closed', url, number, title, rateLimit}` o error estructurado |
| `gh_search` | lectura | `q*`, `sort?`, `order?`, `perPage?` | `{query, total, items[{number,title,state,kind,author,url,repo,comments,createdAt}], rateLimit}` o error estructurado |

`execute` devuelve solo el JSON canónico declarado por `output.schema`. Los fallos por token faltante y por la API de GitHub son variantes de error estructurado que llevan datos del límite de velocidad; los fallos de infraestructura se lanzan (→ `isError`). `exec.signal` se respeta en todas partes.

## ⌨️ Comandos

| Comando | Efecto |
|---|---|
| `/pr create [title]` | Lee el estado de git y encola una instrucción `pr_create` para el modelo (cuerpo del borrador, valores por defecto, sin commit/push salvo `autoCommit`). La creación de la PR solicita aprobación. |
| `/review <pr>` | Inicia un trabajo de revisión en segundo plano; imprime el id del trabajo. El host anuncia la finalización; léelo con `job_output`. |
| `/review <pr> --max-diff <n> --no-ci --no-comments` | Anulaciones por trabajo: límite de diff y qué secciones suplementarias obtiene el trabajo. |
| `/review stop <jobId>` | Cancela el trabajo (control local, sin escritura en GitHub). |
| `/review post <jobId>` | Encola una instrucción `review_post` para el modelo (resumen o en línea); publicar solicita aprobación. |
| `/issue open <title>` | Encola una instrucción `issue_open` para el modelo; crear solicita aprobación. |

## 🏗 Arquitectura

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

- **Capa de credenciales.** `tokenSource: auto` resuelve por operación en el orden: capa de credenciales (referencia `GITHUB_TOKEN`) → variable de entorno → token de la CLI `gh`. El valor es una variable local entregada al cliente REST; nunca entra en valores canónicos, representaciones, tarjetas, salidas de comandos, avisos inyectados, salidas de trabajos, motivos de aprobación ni mensajes de error.
- **Aprobación.** Todas las escrituras fluyen a través de las herramientas del modelo. Un listener waterfall `tools/pre-execute` devuelve `ask` para las cinco herramientas de escritura, de modo que el registro le pregunta al humano mediante `ctx.approval` (el host registra el par de auditoría `approval/asked` + `approval/decided`) y se cierra ante fallo si no hay quien responda. Los motivos de aprobación previsualizan lo que se va a publicar (títulos, tamaños de cuerpo y la primera línea de un cuerpo de revisión anulado). Los comandos nunca escriben directamente: los manejadores de comandos se ejecutan sin un turno abierto, por lo que la capa de aprobación está estructuralmente cerrada para ellos — un comando de escritura reúne contexto de solo lectura y luego despierta al agente (`followup` cuando está inactivo, `inject` cuando está ocupado) para que el modelo ejecute la herramienta controlada dentro de un turno.
- **Revisión en segundo plano.** `/review <pr>` inicia un trabajo `github-review` en `ctx.jobs` (etiqueta, propietario, tiempo límite, cancelable). El trabajo resuelve el token por operación, obtiene los metadatos de la PR (capturando el SHA del commit head para la publicación en línea), el diff limitado y —salvo que se desactive— las ejecuciones de comprobación de CI y los comentarios de revisión existentes, y luego ejecuta un analizador multiarchivo determinista (`src/review.ts`: secretos codificados, claves de API de Google, asignaciones de credenciales, artefactos de depuración, eval, marcadores TODO, líneas largas, cambios sobredimensionados) — cero tokens gastados, totalmente comprobable. Con `reviewMode: "model"`, el trabajo entrega el diff limitado a un subagente de un solo uso a través de la seam `subagents` del host (el agente propietario es el padre) y guarda la salida Markdown del hijo como el informe publicable; una seam o proveedor faltante falla de forma evidente. Los fallos de obtención de secciones suplementarias se anotan en la salida sin hacer fallar el trabajo. Los avisos de finalización llegan a la sesión iniciadora a través del consumidor `dsh-tool-jobs` del host; el modelo lee el informe mediante la herramienta existente `job_output` y lo publica con `review_post` — requiere aprobación.
- **Visible para el modelo ⇔ registrado.** El plugin no añade **ningún tipo de evento de sesión personalizado**. Los tipos de eventos fuera del repositorio no están en `KNOWN_SESSION_EVENT_TYPES` del host, por lo que un evento obligatorio desconocido haría ilegible el registro de sesión tras eliminar el plugin (el host difiere deliberadamente una superficie de registro para plugins externos). Por tanto, todo el contenido visible para el modelo fluye a través de superficies registradas por el host: valores canónicos `tool/result`, avisos `user/message` mediante `agent.inject`/`agent.followup`, el par de ciclo de vida `command/run` + `command/done` y el par de auditoría `approval/asked` + `approval/decided`.
- **Presentadores puros.** `presentCall`/`presentResult` son funciones puras de `args` (+ el `result.meta` persistido), idénticas en transmisión en vivo y en reproducción del registro. La creación de una PR muestra una tarjeta genérica con la URL de la PR.

## 🔒 Límites de seguridad

- El token se lee por operación desde la fuente configurada (capa de credenciales, entorno o CLI `gh`) y se envía solo en el encabezado Authorization del cliente REST. Nunca se registra, nunca se representa, nunca se inyecta, nunca se añade al registro de sesión y nunca aparece en los mensajes de error.
- Cada escritura en GitHub requiere `allowed-once` de `ctx.approval` (política `ask` por defecto); `rejected`, `cancelled` y `unavailable` fallan todas de forma cerrada.
- `/pr create` nunca hace commit ni push por sí mismo; con `autoCommit: true`, el modelo realiza esas escrituras a través de la propia puerta de aprobación de la herramienta bash. dsh-github **no** gestiona la identidad de git (tarea de dsh-git-identity) ni los worktrees (tarea de dsh-worktree).
- El trabajo de revisión no realiza escrituras: lee un diff y guarda un informe en la memoria del proceso; solo `review_post` publica, tras la aprobación.
- Los comentarios publicados interpolan nombres de archivo derivados del diff, que son contenido de repositorio no confiable: `formatPostBody` escapa las comillas invertidas y escapa en HTML los nombres de archivo para que una PR hostil no pueda inyectar Markdown en el comentario de revisión.
- Los cuerpos de issues/PRs, los comentarios y los resultados de búsqueda leídos de GitHub son contenido externo no confiable que entra en el contexto del modelo — la misma contrapartida inherente que la obtención web; el plugin los marca como contenido externo en sus representaciones.
- Límites de velocidad: los 429 se reintentan con retroceso y la cuota restante se muestra al modelo en cada resultado, incluidos los fallos.

## ⚠️ Limitaciones conocidas

- **Sin eventos de sesión personalizados** — deliberado (ver Arquitectura); las pistas de auditoría se apoyan en el vocabulario de eventos propio del host.
- **Analizador estático por defecto** — reglas deterministas (`src/review.ts`), cero tokens, reproducible. `reviewMode: "model"` delega el diff limitado a un subagente de un solo uso a través de la seam `subagents` del host para una revisión por LLM (consume tokens; requiere la seam y un proveedor registrado).
- **Trabajos y registros locales al proceso** — el informe de revisión vive en la memoria del plugin indexado por el id del trabajo, coincidiendo con el ciclo de vida del registro de trabajos del host; el mapa de registros está limitado por `maxReviewRecords` (los registros finalizados más antiguos se eliminan primero).
- **Las dist-tags `latest` de npm están obsoletas** — el plugin declara rangos de pares `^0.1.0-rc.5` para resolverse contra el cierre de perfil que proporciona `dsh-base`, y fija `0.1.0-rc.6` para desarrollo. Nunca instales con un simple `npm i @deepseek-ai/dsh-tools`.
- **CI / GitHub Action** (`dsh-github-action`, bucle headless de revisión→comentario en el espíritu de claude-code-action / codex-action) es un repositorio complementario v2 planificado.

## 🧪 Desarrollo

```sh
pnpm install
pnpm test          # vitest: config, credentials, 429/retry, tools, commands, jobs, approval gate, token non-leakage
pnpm typecheck
pnpm build         # tsc → lib/ (noEmitOnError)
pnpm pack          # installable tarball
pnpm run check:readmes   # cross-checks TOC anchors in all 5 READMEs
```

Las pruebas simulan la API de GitHub, la CLI `gh` y git mediante runners inyectados — sin red, sin credenciales reales. `test/security.test.ts` verifica que la cadena del token nunca aparece en ninguna salida visible para el modelo o para el humano. `test/e2e.test.ts` contiene pruebas de humo optativas de la API real que se omiten automáticamente salvo que `GITHUB_TOKEN` esté definido (solo endpoints de solo lectura).

## 🗂 Estructura del repositorio

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

## 🏷 Temas

Temas recomendados para el repositorio de GitHub (configúralos en los ajustes del repositorio — impulsan la [página de temas `dsh-plugin`](https://github.com/topics/dsh-plugin) y los mercados de plugins de DSH):

`dsh` · `dsh-plugin` · `deepseek-harness` · `github` · `pull-request` · `code-review` · `issue-tracker`

## Licencia

[Apache License 2.0](LICENSE)
