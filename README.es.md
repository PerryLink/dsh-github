<div align="center">

# dsh-github

**PRs, revisiones, issues y CI de GitHub para DeepSeek Harness — cada escritura aprobada por un humano y el token nunca registrado.**

*Crea, revisa, fusiona y busca en GitHub desde el agente, con una acción compuesta de CI, un bot de revisión por sondeo y una puerta de status-check.*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-github/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-github/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-github?label=version)](https://github.com/PerryLink/dsh-github/releases)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)
- **Canal 1024 store**: `npm i -g dsh1024` una vez, luego `dsh1024 plugin --profile web add @perrylink/dsh-github` (cuenta para el ranking de instalaciones de [deepseek1024.com](https://deepseek1024.com)).
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-github)](https://www.npmjs.com/package/@perrylink/dsh-github)

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

</div>

---

## 📚 Tabla de contenidos

- [Compatibilidad](#compatibilidad)
- [Qué obtienes](#qué-obtienes)
- [Inicio rápido](#inicio-rápido)
- [Instalación y desinstalación](#instalación-y-desinstalación)
- [Configuración](#configuración)
- [Herramientas y superficies](#herramientas-y-superficies)
- [Arquitectura](#arquitectura)
- [Permisos y datos](#permisos-y-datos)
- [Límites de seguridad](#límites-de-seguridad)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Desarrollo](#desarrollo)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Temas](#temas)
- [Contribuidores](#contribuidores)
- [Familia de plugins DSH de PerryLink](#familia-de-plugins-dsh-de-perrylink)
- [Licencia](#licencia)

## Compatibilidad

| Superficie | Estado |
|---|---|
| Harness | DeepSeek Harness `0.1.2-alpha.5` (compatibilidad declarada para `0.1.2-alpha.5`) 0.1.2-alpha.5 (adaptado el 2026-09-02): el sobre de sesión conserva su campo ignorable solo para compatibilidad de lectura de logs almacenados - Session.append aún no puede estamparlo, por lo que el comportamiento de la puerta no cambia. |
| Node | `^22.19.0 \|\| >=24.0.0` |
| Plataformas | Todas (plugin host; red saliente a GitHub) |
| Modelo | Cualquiera (la revisión estática es determinista; `reviewMode: "model"` es opcional) |

## Qué obtienes

`dsh-github` cubre el vacío de GitHub entre `dsh` y herramientas como Claude Code y Codex: tu agente puede leer, revisar, abrir, actualizar y fusionar pull requests, leer metadatos de repositorios y archivos, comentar y cerrar issues, y buscar — mientras un humano aprueba cada escritura y el token permanece en secreto.

- **14 herramientas** — `pr_create`, `pr_merge`, `pr_update`, `gh_review`, `review_post`, `gh_issue`, `issue_open`, `issue_comment`, `issue_close`, `gh_search`, `gh_repo`, `gh_file`, `gh_repo_search`, `gh_checks`, todas con JSON canónico mediante `defineTool`.
- **3 familias de comandos** — `/pr create`, `/review` (start/stop/post), `/issue open`.
- **Ciclo de vida completo de PRs** — crear → revisar → actualizar (título/cuerpo/estado/rama base) → fusionar (merge/squash/rebase, borrado opcional de la rama head).
- **Revisiones en línea** — `review_post` publica un único comentario de resumen o comentarios de revisión anclados por línea contra el commit head de la PR.
- **Escrituras con aprobación** — cada escritura en GitHub pasa por `ctx.approval` (`ask` por defecto, se cierra ante fallo); los motivos de aprobación previsualizan títulos, tamaños de cuerpo y anulaciones de comentarios.
- **Secreto del token** — capa de credenciales → entorno → CLI `gh`, resuelto por operación, nunca en registros, eventos, representaciones ni errores.
- **Trabajos de revisión en segundo plano** — `/review` se ejecuta en `ctx.jobs` con la superficie propia del host `job_list` / `job_output` / `job_kill`.
- **Resiliencia** — reintento 429 con retroceso `Retry-After`/`x-ratelimit-reset`; las herramientas de lectura son seguras ante concurrencia; todas las llamadas respetan la cancelación.
- **Superficie CI** — la herramienta de un solo uso `ci_run`, un bot de revisión por sondeo y una puerta de status-check (acción compuesta `action.yml`).

## Inicio rápido

```sh
# 1. instala el bundle en tu perfil
dsh plugin --profile web add "github:PerryLink/dsh-github#main"

# o desde npm (versiones publicadas)
dsh plugin --profile web add @perrylink/dsh-github

# 2. reinicia y verifica la fila
dsh --profile web --dump-config | grep -A3 'id: dsh-github'
```

## Instalación y desinstalación

- **canal git** (último `main`): `dsh plugin --profile web add "github:PerryLink/dsh-github#main"` — el script `prepare` compila solo con dependencias de producción.
- **canal npm** (versiones publicadas): `dsh plugin --profile web add @perrylink/dsh-github`.
- **canal tarball**: `pnpm pack` en este repositorio y luego `dsh plugin --profile web add ./dsh-github-<version>.tgz`.
- **desinstalar**: `dsh plugin --profile web remove dsh-github` (o elimina la fila del parche de perfil).

## Configuración

Todos los ajustes son campos `Config` de Schemastery (modificables desde cordis.yml). Una anulación dirigida por id reemplaza toda la fila — vuelve a indicar cada clave que necesites. `cordis.patch.yml` documenta cada clave en línea.

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
| `maxFileChars` | `12000` | Límite de caracteres para el contenido de archivos leído por `gh_file` |
| `maxFindings` | `50` | Límite de hallazgos del analizador por revisión |
| `maxLineLength` | `300` | Longitud de línea a partir de la cual el analizador marca un hallazgo de línea larga |
| `reviewMode` | `static` | Motor de revisión: `static` (analizador determinista) o `model` (subagente de un solo uso a través de la seam `subagents` del host; falla de forma evidente si la seam no está presente) |
| `modelReviewProvider` | — | Nombre del proveedor de subagente para `reviewMode: "model"`; por defecto, el primer proveedor registrado |
| `maxRetries` | `3` | Intentos de reintento 429 por solicitud |
| `retryBaseMs` | `500` | Base del retroceso de reintento (se duplica por intento) |
| `retryMaxWaitMs` | `60000` | Tope del retroceso de reintento |
| `requestTimeoutMs` | `30000` | Tiempo máximo por solicitud; aborta el fetch al superarse |
| `apiBaseUrl` | `https://api.github.com` | URL base de la API REST de GitHub (GitHub Enterprise) |
| `allowedActions` | `['pr.create','pr.merge','pr.update','review.post','issue.create','issue.comment','issue.close','ci.run']` | Lista blanca de acciones de escritura; cualquier otra se deniega antes de la aprobación |
| `workspaceDir` | process cwd | Directorio de trabajo para la inspección de git de solo lectura |
| `ci` | `{ enabled: false, … }` | Sección de integración CI: bot de revisión por sondeo, puerta de status-check y la herramienta de un solo uso `ci_run` (contiene todas las claves `ci.*`) |

## Herramientas y superficies

| Superficie | Tipo | Notas |
|---|---|---|
| `pr_create` | herramienta | Crea una pull request (escritura; con aprobación) |
| `pr_merge` | herramienta | Fusiona una PR (merge/squash/rebase, borrado opcional de la rama head) |
| `pr_update` | herramienta | Actualiza una PR (título/cuerpo/estado/rama base) |
| `gh_review` | herramienta | Lee una PR: metadatos, diff limitado, comentarios, CI, hallazgos estáticos |
| `review_post` | herramienta | Publica un comentario de revisión (resumen o en línea anclado por línea) |
| `gh_issue` | herramienta | Lista / obtiene / comenta issues (las PRs se marcan `kind: "pr"`) |
| `issue_open` | herramienta | Crea un issue |
| `issue_comment` | herramienta | Comenta un issue o una PR |
| `issue_close` | herramienta | Cierra un issue (motivo de estado opcional) |
| `gh_search` | herramienta | Busca issues y PRs (cuota de búsqueda independiente) |
| `gh_repo` | herramienta | Lee los metadatos del repositorio |
| `gh_file` | herramienta | Lee un archivo en una rama/tag/commit |
| `gh_repo_search` | herramienta | Búsqueda GraphQL de repositorios (cuota de búsqueda separada) |
| `gh_checks` | herramienta | Checks de estado GraphQL de un PR (check runs + commit statuses) |
| `/pr create` | comando | Lee el estado de git y encola una instrucción `pr_create` |
| `/review` | comando | Inicia / detiene / publica un trabajo de revisión en segundo plano |
| `/issue open` | comando | Encola una instrucción `issue_open` |
| `ci_run` | herramienta | Revisión CI de un solo uso ejecutada por la acción compuesta / el driver CI |
| bot de revisión | superficie | Bot de revisión por sondeo con comentarios inline idempotentes (`ci.*`) |
| puerta de status-check | superficie | Publica el veredicto `success` / `needs-changes` por commit head de PR (`action.yml`) |

## Arquitectura

- **Capa de credenciales.** `tokenSource: auto` resuelve por operación en el orden capa de credenciales (referencia `GITHUB_TOKEN`) → variable de entorno → token de la CLI `gh`. El valor es una variable local entregada al cliente REST; nunca entra en valores canónicos, representaciones, tarjetas, salidas de comandos, avisos inyectados, salidas de trabajos, motivos de aprobación ni mensajes de error.
- **Puerta de aprobación.** Todas las escrituras fluyen a través de las herramientas del modelo. Un listener waterfall `tools/pre-execute` devuelve `ask` para las herramientas de escritura, de modo que el registro pregunta al humano mediante `ctx.approval` (el host registra el par de auditoría `approval/asked` + `approval/decided`) y se cierra ante fallo sin un respondedor. Los comandos nunca escriben directamente: un comando de escritura reúne contexto de solo lectura y luego despierta al agente para que el modelo ejecute la herramienta controlada dentro de un turno.
- **Trabajo de revisión en segundo plano.** `/review <pr>` inicia un trabajo `github-review` en `ctx.jobs`; el trabajo obtiene metadatos (capturando el SHA del commit head para la publicación en línea), el diff limitado, las comprobaciones de CI y los comentarios existentes, y luego ejecuta el analizador determinista multiarchivo (`src/review.ts`). Con `reviewMode: "model"`, el trabajo entrega el diff limitado a un subagente de un solo uso a través de la seam `subagents` del host. La finalización llega a la sesión mediante el consumidor `dsh-tool-jobs` del host; el modelo lo lee con `job_output` y lo publica con `review_post`.
- **Acción compuesta de CI / bot de revisión / puerta de status-check.** El repositorio incluye una acción compuesta (`action.yml`) que revisa PRs, arregla CI y escribe el informe; un bot de revisión por sondeo publica comentarios inline idempotentes; y una puerta de status-check publica el veredicto por commit head de PR. La herramienta de un solo uso `ci_run` impulsa la ejecución headless. Toda escritura permanece sujeta a aprobación.

## Permisos y datos

- **Permisos**: las escrituras cabalgan sobre la capa de aprobación oficial; nada se reimplementa ni se elude. El plugin declara `network:outbound` y `filesystem:write` en su manifiesto de workshop.
- **Datos**: el informe de revisión vive en la memoria del proceso, indexado por el id del trabajo; no se escribe nada duradero en disco.
- **Registro de sesión**: el plugin no añade tipos de evento de sesión personalizados; todo el contenido visible para el modelo fluye por superficies registradas por el host (`tool/result`, `user/message`, `command/run`, `approval/asked`…).

## Límites de seguridad

- **Aprobación, no aplicación.** Las escrituras solo producen decisiones `ask`/deny en la capa oficial; el sandbox y los sistemas de aprobación siguen siendo la autoridad de aplicación.
- **Se cierra ante fallo.** La ausencia de respondedor de aprobación degrada a la decisión más estricta — nunca a un paso silencioso.
- **El token nunca sale del proceso.** Se lee por operación y se envía solo en el encabezado Authorization; nunca se registra, representa, inyecta ni aparece en errores.
- **Sin escrituras fuera de la aprobación.** `/pr create` nunca hace commit ni push por sí mismo; con `autoCommit: true`, el modelo realiza esas escrituras mediante la propia puerta de aprobación de la herramienta bash. El trabajo de revisión no realiza escrituras; solo `review_post` publica, tras la aprobación.
- **El contenido no confiable se escapa y se marca.** `formatPostBody` escapa en HTML y con comillas invertidas los nombres de archivo derivados del diff, y el contenido externo de GitHub (archivos, cuerpos, comentarios, resultados de búsqueda) se marca como externo en las representaciones.
- **Trabajo acotado y límites de velocidad.** Los 429 se reintentan con retroceso; la cuota restante se muestra en cada resultado, incluidos los fallos.

## Limitaciones conocidas

- **Sin eventos de sesión personalizados** — deliberado (ver Arquitectura); las pistas de auditoría dependen del vocabulario de eventos propio del host.
- **Analizador estático por defecto** — reglas deterministas (`src/review.ts`), cero tokens, reproducible. `reviewMode: "model"` consume tokens y requiere la seam `subagents` y un proveedor registrado.
- **Trabajos y registros locales al proceso** — el informe de revisión vive en la memoria del plugin, indexado por el id del trabajo; el mapa de registros está limitado por `maxReviewRecords` (los registros finalizados más antiguos se eliminan primero).
- **Las dist-tags `latest` de npm están obsoletas** — instala mediante el cierre de perfil que proporciona `dsh-base`; nunca con un simple `npm i @deepseek-ai/dsh-tools`.

## Desarrollo

```sh
pnpm install             # node ^22.19 || >=24
pnpm run build           # tsc --noEmitOnError → lib/
pnpm run prepare         # compilación autocontenida para instalación git (scripts/prepare.mjs)
pnpm run prepublishOnly  # compilar + probar antes de publicar
pnpm test                # vitest run
pnpm run typecheck       # tsc --noEmit
pnpm run check:readmes   # cruza anclas de TOC, herramientas y claves de configuración en los 5 README
```

## Estructura del repositorio

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

## Temas

`dsh` · `dsh-plugin` · `deepseek-harness` · `github` · `pull-request` · `code-review` · `issue-tracker`

## Contribuidores

- [@PerryLink](https://github.com/PerryLink) — creador y mantenedor: la superficie de herramientas de GitHub, la puerta de aprobación, los trabajos de revisión en segundo plano, la acción compuesta de CI, el bot de revisión, la puerta de status-check y la documentación en cinco idiomas.
- [@AraragiEro](https://github.com/AraragiEro) — la tarjeta de configuración del token de GitHub en la página de ajustes de Plugins (#6).
- [@alexchenzl](https://github.com/alexchenzl) — invitó al plugin a incluirse en el DSH Directory (#5).

## Familia de plugins DSH de PerryLink

Este proyecto es uno de los [33 complementos de DeepSeek Harness](https://github.com/PerryLink) mantenidos por [PerryLink](https://github.com/PerryLink). Si este te ayuda, probablemente los demás también:

| Plugin | One-liner |
|---|---|
| **[dsh-dsh-auto-review](https://github.com/PerryLink/dsh-dsh-auto-review)** | Auto-revisión de segundo modelo en la cadena de aprobación, con cierre en fallo por defecto | |
| **[dsh-dsh-background-agents](https://github.com/PerryLink/dsh-dsh-background-agents)** | Agentes hijos en segundo plano durables con barra lateral de UI web, mensajería e interrupción | |
| **[dsh-dsh-budget](https://github.com/PerryLink/dsh-dsh-budget)** | Gobernanza de costes para DeepSeek Harness: presupuestos, carbono y latencia en un panel. | |
| **[dsh-dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-dsh-checkpoint-rewind)** | Equivalente a /rewind de Claude Code: instantáneas, bifurcaciones de sesión, restauración de un solo uso | |
| **[dsh-dsh-claude-move](https://github.com/PerryLink/dsh-dsh-claude-move)** | Migra sesiones, memoria, habilidades y CLAUDE.md de Claude Code a DSH | |
| **[dsh-dsh-click](https://github.com/PerryLink/dsh-dsh-click)** | Control de escritorio nativo multiplataforma para DeepSeek Harness — Windows primero. | |
| **[dsh-dsh-composer-history](https://github.com/PerryLink/dsh-dsh-composer-history)** | Historial de entrada estilo terminal para el compositor web: flechas, búsqueda Ctrl+R | |
| **[dsh-dsh-data-quality](https://github.com/PerryLink/dsh-dsh-data-quality)** | Comprobaciones de calidad de datasets y verificación de citas (el puente numérico opcional consumido aquí) | |
| **[dsh-dsh-defend](https://github.com/PerryLink/dsh-dsh-defend)** | Defensa contra inyección de prompts, jailbreak y fuga de secretos para DeepSeek Harness. | |
| **[dsh-dsh-doublecheck](https://github.com/PerryLink/dsh-dsh-doublecheck)** | Guardián de disciplina de ingeniería: interrogatorio de requisitos, puertas de pruebas, revisión adversaria | |
| **[dsh-dsh-draw](https://github.com/PerryLink/dsh-dsh-draw)** | Enrutamiento unificado de generación de imágenes estáticas para DeepSeek Harness. | |
| **[dsh-dsh-fast](https://github.com/PerryLink/dsh-dsh-fast)** | Diagnóstico de rendimiento de solo lectura para DeepSeek Harness. | |
| **[dsh-dsh-fund-research](https://github.com/PerryLink/dsh-dsh-fund-research)** | Informes de investigación deterministas para fondos mutuos públicos chinos | |
| **[dsh-dsh-industry-research](https://github.com/PerryLink/dsh-dsh-industry-research)** | Orquestación de investigación sectorial que sella sus entregables mediante el `ctx.researchReport.assemble` de este plugin | |
| **[dsh-dsh-library](https://github.com/PerryLink/dsh-dsh-library)** | Base de conocimiento documental local para DeepSeek Harness. | |
| **[dsh-dsh-local-ai](https://github.com/PerryLink/dsh-dsh-local-ai)** | Integración de modelos locales (Ollama) para DeepSeek Harness. | |
| **[dsh-dsh-lsp-actions](https://github.com/PerryLink/dsh-dsh-lsp-actions)** | Diagnósticos, formato, autocompletado, acciones de código y renombrado LSP sobre servidores de lenguaje | |
| **[dsh-dsh-mask](https://github.com/PerryLink/dsh-dsh-mask)** | Middleware de enmascaramiento de PII: anonimiza en el límite del modelo, restaura en la capa de visualización | |
| **[dsh-dsh-mcp-panel](https://github.com/PerryLink/dsh-dsh-mcp-panel)** | Panel de tiempo de ejecución MCP de solo lectura: comando /mcp + pestaña Settings con estado, herramientas y errores | |
| **[dsh-dsh-memento](https://github.com/PerryLink/dsh-dsh-memento)** | Memoria entre sesiones controlada por aprobación: costura ctx.memory + SQLite + herramienta de memoria | |
| **[dsh-dsh-observe](https://github.com/PerryLink/dsh-dsh-observe)** | Exportador de observabilidad OpenTelemetry y Langfuse para DeepSeek Harness. | |
| **[dsh-dsh-output-styles](https://github.com/PerryLink/dsh-dsh-output-styles)** | Cambio de estilo en tiempo de ejecución equivalente a outputStyles de Claude Code | |
| **[dsh-dsh-permission-rules](https://github.com/PerryLink/dsh-dsh-permission-rules)** | Reglas de permisos declarativas allow/deny/ask estilo Claude Code con auditoría | |
| **[dsh-dsh-plugin-guide](https://github.com/PerryLink/dsh-dsh-plugin-guide)** | Base de conocimiento de desarrollo de plugins como habilidad de agente bajo demanda | |
| **[dsh-dsh-research-report](https://github.com/PerryLink/dsh-dsh-research-report)** | Motor de informes de investigación verificables con evidencia direccionada por contenido | |
| **[dsh-dsh-score](https://github.com/PerryLink/dsh-dsh-score)** | Puntuación de calidad multidimensional para plugins de DeepSeek Harness. | |
| **[dsh-dsh-session-pin](https://github.com/PerryLink/dsh-dsh-session-pin)** | Fija sesiones en la barra lateral web con orden durable | |
| **[dsh-dsh-session-sync](https://github.com/PerryLink/dsh-dsh-session-sync)** | Sincronización de sesiones entre dispositivos para DeepSeek Harness — un espejo git dedicado de tu almacén de sesiones. | |
| **[dsh-dsh-skill-pack-security](https://github.com/PerryLink/dsh-dsh-skill-pack-security)** | Paquete de habilidades de auditoría de seguridad: escaneo de secretos, revisión de dependencias y cadena de suministro | |
| **[dsh-dsh-talk](https://github.com/PerryLink/dsh-dsh-talk)** | Bucle de sesión con voz para DeepSeek Harness: háblale y escucha su respuesta. | |
| **[dsh-dsh-test-drive](https://github.com/PerryLink/dsh-dsh-test-drive)** | Pruebas de instalación y humo aisladas para plugins de DeepSeek Harness. | |
| **[dsh-dsh-translate](https://github.com/PerryLink/dsh-dsh-translate)** | Traducción de parámetros entre proveedores y reparación determinista de JSON para DeepSeek Harness. | |

### Instalar desde el mercado de DSH Desktop

Todos los plugins de PerryLink pueden explorarse en el mercado integrado de DSH Desktop: **Market → Sources → add source → pegar** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ seleccionarlo**. La instalación sigue pasando por la verificación de identidad npm del mercado y tu confirmación.

## Licencia

[Apache License 2.0](LICENSE) © 2026 dsh-github contributors
