<h1 align="center">dsh-github</h1>

<p align="center">
  <b>Trae GitHub a DeepSeek Harness.</b><br/>
  Crea pull requests · revisa PRs en trabajos en segundo plano · lee issues — cada escritura requiere aprobación humana y el token nunca sale de la capa de credenciales.
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
  <img src="https://img.shields.io/badge/tests-77%20passed-brightgreen" alt="Tests: 77 passed">
  <img src="https://img.shields.io/badge/documents-EN%2FZH%2FES%2FPT%2FHI-8257D0" alt="Documents: EN/ZH/ES/PT/HI">
</p>

---

**dsh-github** es un plugin bundle para [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) — el agente harness «todo es un plugin». Cubre el vacío de GitHub entre dsh y herramientas como [Claude Code](https://github.com/anthropics/claude-code) (`gh claude` / [claude-code-action](https://github.com/anthropics/claude-code-action)) y [Codex](https://github.com/openai/codex) (`@codex review` / Autofix CI): tu agente puede **leer una PR, revisar una PR y abrir una PR** — mientras un humano aprueba cada escritura y el token permanece en secreto.

- 🛠 **5 herramientas** — `pr_create` · `gh_review` · `gh_issue` · `review_post` · `issue_open`, todas con JSON canónico mediante `defineTool`
- ⌨️ **3 familias de comandos** — `/pr create` · `/review` (start/stop/post) · `/issue open`
- 🔒 **Escrituras con aprobación** — cada escritura en GitHub pasa por `ctx.approval` (`ask` por defecto, se cierra ante fallo)
- 🗝 **Secreto del token** — capa de credenciales → entorno → CLI `gh`, resuelto por operación, nunca en registros, eventos, representaciones ni errores
- ⏱ **Trabajos de revisión en segundo plano** — `/review` se ejecuta en `ctx.jobs` con la superficie propia del host `job_list` / `job_output` / `job_kill`
- 🚦 **Reintento 429 + visibilidad de cuota** — el modelo ve el límite de velocidad restante en cada lectura
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
pnpm pack                              # inside this repo → dsh-github-0.1.0.tgz
dsh plugin --profile <name> add ./dsh-github-0.1.0.tgz

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
| **Revisar PRs** | `gh_review` resume metadatos, diff limitado, comentarios, estado de CI y hallazgos estáticos; `/review` ejecuta un trabajo completo en segundo plano |
| **Publicar revisiones** | `/review post <jobId>` publica el comentario redactado del trabajo — tras la aprobación humana |
| **Leer issues** | `gh_issue` lista / obtiene / comenta; `issue_open` crea (con aprobación) |
| **Aprobación** | `tools/pre-execute` solicita `ctx.approval` para cada escritura; la lista blanca `allowedActions` deniega antes de preguntar |
| **Seguridad del secreto** | El token vive solo en la capa de credenciales + el encabezado Authorization; una prueba dedicada verifica que nunca aparece en ninguna salida visible |
| **Resiliencia** | Reintento 429 con retroceso `Retry-After`/`x-ratelimit-reset`; las herramientas de lectura son seguras ante concurrencia; todas las llamadas respetan la cancelación |
| **Observabilidad** | Visible para el modelo ⇔ registrado: todo lo que el modelo ve fluye a través de los eventos de sesión propios del host (`tool/result`, `user/message`, `command/run`, `approval/asked`…) |

## 📦 Instalación

Tres canales documentados — elige uno.

| Canal | Comando | Notas |
|---|---|---|
| **Tarball npm** | `dsh plugin --profile <name> add ./dsh-github-0.1.0.tgz` | Se distribuye con `lib/` compilado — sin permiso de compilación |
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
| `maxDiffChars` | `8000` | Límite para los diffs de PR leídos en las revisiones |
| `maxComments` | `20` | Límite para los comentarios de PR listados por `gh_review` |
| `reviewJobTimeoutMs` | `600000` | Plazo para un trabajo de revisión en segundo plano (falla con `timeout`) |
| `maxRetries` | `3` | Intentos de reintento 429 por solicitud |
| `retryBaseMs` | `500` | Base del retroceso de reintento (se duplica por intento) |
| `retryMaxWaitMs` | `60000` | Tope del retroceso de reintento |
| `apiBaseUrl` | `https://api.github.com` | URL base de la API REST de GitHub (GitHub Enterprise) |
| `allowedActions` | `['pr.create','review.post','issue.create']` | Lista blanca de acciones de escritura; cualquier otra se deniega antes de la aprobación |
| `workspaceDir` | process cwd | Directorio de trabajo para la inspección de git de solo lectura |

## 🛠 Herramientas

| Herramienta | Tipo | Parámetros | Devuelve |
|---|---|---|---|
| `pr_create` | escritura | `title*`, `body?`, `base?`, `head?`, `draft?`, `ownerRepo?` | `{status:'created', url, number, title, state, draft, base, head}` o error estructurado |
| `gh_review` | lectura | `pr*` (número / `#n` / `o/r#n` / URL), `fields?`, `maxDiffChars?` | metadatos, diff limitado + extracto + estadísticas por archivo, comentarios, CI, hallazgos estáticos, límite de velocidad |
| `gh_issue` | lectura | `action*` (`list`/`get`/`comments`), `ownerRepo?`, `issueNumber?`, `state?`, `limit?` | elementos de issue normalizados + límite de velocidad |
| `review_post` | escritura | `jobId*` | `{status:'posted', url, commentId, findings}` o error estructurado |
| `issue_open` | escritura | `title*`, `body?`, `labels?`, `ownerRepo?` | `{status:'created', url, number, title}` o error estructurado |

`execute` devuelve solo el JSON canónico declarado por `output.schema`. Los fallos por token faltante y por la API de GitHub son variantes de error estructurado; los fallos de infraestructura se lanzan (→ `isError`). `exec.signal` se respeta en todas partes.

## ⌨️ Comandos

| Comando | Efecto |
|---|---|
| `/pr create [title]` | Lee el estado de git y encola una instrucción `pr_create` para el modelo (cuerpo del borrador, valores por defecto, sin commit/push salvo `autoCommit`). La creación de la PR solicita aprobación. |
| `/review <pr>` | Inicia un trabajo de revisión en segundo plano; imprime el id del trabajo. El host anuncia la finalización; léelo con `job_output`. |
| `/review stop <jobId>` | Cancela el trabajo (control local, sin escritura en GitHub). |
| `/review post <jobId>` | Encola una instrucción `review_post` para el modelo; la publicación solicita aprobación. |
| `/issue open <title>` | Encola una instrucción `issue_open` para el modelo; la creación solicita aprobación. |

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
           issue_open (defineTool, canonical JSON only)             │
                    │                                               │
                    └───────┬───────────────┬───────────────┬───────┘
                            │               │               │
                  tools/pre-execute     credential        GitHub REST
                  approval gate        resolution        client (fetch,
                  (ask | deny)      (seam → env →       429 retry,
                                    gh CLI, per-op)     rate-limit)
```

- **Capa de credenciales.** `tokenSource: auto` resuelve por operación en el orden: capa de credenciales (referencia `GITHUB_TOKEN`) → variable de entorno → token de la CLI `gh`. El valor es una variable local entregada al cliente REST; nunca entra en valores canónicos, representaciones, tarjetas, salidas de comandos, avisos inyectados, salidas de trabajos, motivos de aprobación ni mensajes de error.
- **Aprobación.** Todas las escrituras fluyen a través de las herramientas del modelo. Un listener waterfall `tools/pre-execute` devuelve `ask` para `pr_create` / `review_post` / `issue_open`, de modo que el registro le pregunta al humano mediante `ctx.approval` (el host registra el par de auditoría `approval/asked` + `approval/decided`) y se cierra ante fallo si no hay quien responda. Los comandos nunca escriben directamente: los manejadores de comandos se ejecutan sin un turno abierto, por lo que la capa de aprobación está estructuralmente cerrada para ellos — un comando de escritura reúne contexto de solo lectura y luego despierta al agente (`followup` cuando está inactivo, `inject` cuando está ocupado) para que el modelo ejecute la herramienta controlada dentro de un turno.
- **Revisión en segundo plano.** `/review <pr>` inicia un trabajo `github-review` en `ctx.jobs` (etiqueta, propietario, tiempo límite, cancelable). El trabajo resuelve el token por operación, obtiene el diff limitado y ejecuta un analizador multiarchivo determinista (`src/review.ts`: secretos codificados, artefactos de depuración, eval, marcadores TODO, líneas largas, cambios sobredimensionados) — cero tokens gastados, totalmente comprobable. Los avisos de finalización llegan a la sesión iniciadora a través del consumidor `dsh-tool-jobs` del host; el modelo lee el informe mediante la herramienta existente `job_output` y lo publica con `review_post` — requiere aprobación.
- **Visible para el modelo ⇔ registrado.** El plugin no añade **ningún tipo de evento de sesión personalizado**. Los tipos de eventos fuera del repositorio no están en `KNOWN_SESSION_EVENT_TYPES` del host, por lo que un evento obligatorio desconocido haría ilegible el registro de sesión tras eliminar el plugin (el host difiere deliberadamente una superficie de registro para plugins externos). Por tanto, todo el contenido visible para el modelo fluye a través de superficies registradas por el host: valores canónicos `tool/result`, avisos `user/message` mediante `agent.inject`/`agent.followup`, el par de ciclo de vida `command/run` + `command/done` y el par de auditoría `approval/asked` + `approval/decided`.
- **Presentadores puros.** `presentCall`/`presentResult` son funciones puras de `args` (+ el `result.meta` persistido), idénticas en transmisión en vivo y en reproducción del registro. La creación de una PR muestra una tarjeta genérica con la URL de la PR.

## 🔒 Límites de seguridad

- El token existe solo dentro del resultado de la resolución de credenciales y del encabezado Authorization del cliente REST. Nunca se registra, nunca se representa, nunca se inyecta, nunca se añade al registro de sesión.
- Cada escritura en GitHub requiere `allowed-once` de `ctx.approval` (política `ask` por defecto); `rejected`, `cancelled` y `unavailable` fallan todas de forma cerrada.
- `/pr create` nunca hace commit ni push por sí mismo; con `autoCommit: true`, el modelo realiza esas escrituras a través de la propia puerta de aprobación de la herramienta bash. dsh-github **no** gestiona la identidad de git (tarea de dsh-git-identity) ni los worktrees (tarea de dsh-worktree).
- El trabajo de revisión no realiza escrituras: lee un diff y guarda un informe en la memoria del proceso; solo `review_post` publica, tras la aprobación.
- Límites de velocidad: los 429 se reintentan con retroceso y la cuota restante se muestra al modelo.

## ⚠️ Limitaciones conocidas

- **Sin eventos de sesión personalizados** — deliberado (ver Arquitectura); las pistas de auditoría se apoyan en el vocabulario de eventos propio del host.
- **Analizador estático, no un revisor basado en modelo** — reglas deterministas (`src/review.ts`), cero tokens, reproducible; un pase de revisión basado en modelo a través de la capa de subagentes es un punto de extensión v2 documentado.
- **Un único comentario agregado** — `review_post` publica un único comentario a nivel de issue de la PR en lugar de comentarios de revisión en línea por línea (v2).
- **Trabajos y registros locales al proceso** — el informe de revisión vive en la memoria del plugin indexado por el id del trabajo, coincidiendo con el ciclo de vida del registro de trabajos del host.
- **Las dist-tags `latest` de npm están obsoletas** — el plugin declara rangos de pares `^0.1.0-rc.5` para resolverse contra el cierre de perfil que proporciona `dsh-base`, y fija `0.1.0-rc.6` para desarrollo. Nunca instales con un simple `npm i @deepseek-ai/dsh-tools`.
- **CI / GitHub Action** (`dsh-github-action`, bucle headless de revisión→comentario en el espíritu de claude-code-action / codex-action) es un repositorio complementario v2 planificado.

## 🧪 Desarrollo

```sh
pnpm install
pnpm test          # vitest: config, credentials, 429/retry, tools, commands, jobs, approval gate, token non-leakage
pnpm typecheck
pnpm build         # tsc → lib/ (noEmitOnError)
pnpm pack          # installable tarball
```

Las pruebas simulan la API de GitHub, la CLI `gh` y git mediante runners inyectados — sin red, sin credenciales reales. `test/security.test.ts` verifica que la cadena del token nunca aparece en ninguna salida visible para el modelo o para el humano.

## 🗂 Estructura del repositorio

```
src/index.ts          plugin entry (name/inject/apply, applyWithDeps for tests)
src/config.ts         Schemastery Config
src/types.ts          local structural views of host services + Context merging
src/credential.ts     token resolution (seam → env → gh), per operation
src/github.ts         REST client: 429 retry, rate limits, diff media type
src/git.ts            read-only git inspection
src/review.ts         deterministic diff analyzer + comment drafting
src/jobs.ts           github-review background job producer
src/approval-gate.ts  tools/pre-execute ask/deny gate
src/tools.ts          the five model-facing tools
src/commands.ts       /pr, /review, /issue
src/present.ts        pure UI-card presenters
test/                 vitest suite + mock host scaffolding
cordis.patch.yml      bundle patch (one insert row)
scripts/prepare.mjs   self-contained git-install build
```

## 🏷 Temas

Temas recomendados para el repositorio de GitHub (configúralos en los ajustes del repositorio — impulsan la [página de temas `dsh-plugin`](https://github.com/topics/dsh-plugin) y los mercados de plugins de DSH):

`dsh` · `dsh-plugin` · `deepseek-harness` · `github` · `pull-request` · `code-review` · `issue-tracker`

## Licencia

[Apache License 2.0](LICENSE)
