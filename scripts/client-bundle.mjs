/**
 * The browser-half artifact contract for `@perrylink/dsh-github`.
 *
 * The DSH web shell does not import a client package through ESM: it installs
 * the package's `exports["./client"]` target as a **classic script** and
 * expects that file to hand its module factory to
 * `window.__ModuleLoader__.load({ id, factory })`. A file that still carries
 * top-level `import`/`export` statements is a `SyntaxError: Cannot use import
 * statement outside a module` in that position, and because the shell serves
 * several packages as one concatenated combo script per batch, the parse error
 * aborts the whole batch: every client entry in it fails to activate and the
 * UI reports "Failed to load plugins" for the entire profile.
 *
 * This module owns that artifact shape — the module-table externals, the
 * registration wrapper, and the checks that prove a produced file has it.
 * `scripts/build-client.mjs` writes the artifact; `scripts/prepare.mjs`,
 * `scripts/verify-artifacts.mjs`, and `test/client-bundle.test.ts` verify one.
 * @module scripts/client-bundle
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Specifiers the DSH web shell seeds into the frozen browser module table
 * (`PLATFORM_MODULES` in `@deepseek-ai/dsh-client-web/src/platform.ts`).
 *
 * A client bundle must leave these as bare `require(...)` calls: the loader
 * injects the table entry, so a bundled copy would fork a shared runtime
 * (React's hook dispatcher, the slots registry, the primitives) away from the
 * single instance the rest of the shell holds. The table is the shell's, not
 * this package's — keep it a literal so the artifact never depends on a
 * DeepSeek Harness checkout.
 */
export const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/**
 * Package families whose modules carry browser runtime identity, so inlining
 * one is never right: either it duplicates a singleton the shell already
 * holds, or it is a client plugin whose module only exists as a table row.
 * Anything else a client source imports (wire/type layers, plain libraries)
 * is inlined by the bundler.
 */
const SHARED_RUNTIME_MODULE = /^@deepseek-ai\/(?:cordis|dsh-client-[a-z0-9-]+)(?:\/|$)/

/**
 * Bare specifiers this package must leave to the loader's module table: the
 * platform baseline plus whatever `dsh.client.external` adds.
 * @param pkg - the parsed `package.json`.
 * @returns the external specifiers, deduplicated.
 * @throws {Error} when `dsh.client.external` is present but not a string array.
 */
export function clientExternals(pkg) {
  const declared = pkg?.dsh?.client?.external
  if (declared !== undefined && !Array.isArray(declared)) {
    throw new Error(`${pkg?.name ?? 'package'}: dsh.client.external must be an array of specifiers`)
  }
  for (const specifier of declared ?? []) {
    if (typeof specifier !== 'string' || specifier.length === 0) {
      throw new Error(`${pkg?.name ?? 'package'}: dsh.client.external entries must be non-empty strings`)
    }
  }
  return [...new Set([...PLATFORM_MODULES, ...(declared ?? [])])]
}

/**
 * The wrapper opening the loader's registration call.
 *
 * `"use strict"` is repeated on purpose: it has to be the factory body's first
 * statement to act as a directive, and the bundler's own copy lands after the
 * `module` shim below, where it is only a string literal. Strict mode must stay
 * inside the factory — the shell concatenates several packages into one combo
 * script, so a top-level directive here would leak into every neighbour.
 * @param id - package name, the key the loader's module table answers `require(id)` with.
 * @returns the banner text the bundler prepends.
 */
export function registrationBanner(id) {
  return [
    `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    '"use strict";',
    'var module = { exports: {} };',
    'var exports = module.exports;',
  ].join('\n')
}

/** The wrapper closing the registration call and handing the factory's exports back. */
export const REGISTRATION_FOOTER = 'return module.exports;\n} });'

/**
 * Resolve every bare import through the module table, and refuse to inline a
 * package that carries shared browser runtime identity.
 *
 * This is the build-time mirror of the loader's runtime resolution order: a
 * `require()` the table cannot answer is a guaranteed throw inside the
 * factory, and an inlined copy of a shared module is a silent fork. Both are
 * caught here instead of in the browser.
 * @param externals - specifiers to leave for the loader.
 * @param id - package name, used in diagnostics.
 * @returns the bundler plugin.
 */
function moduleTablePlugin(externals, id) {
  return {
    name: 'dsh-client-module-table',
    setup(build) {
      // Bare specifiers only: relative and absolute paths are the package's own
      // modules and stay internal.
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        if (externals.has(args.path)) return { path: args.path, external: true }
        if (SHARED_RUNTIME_MODULE.test(args.path)) {
          throw new Error(
            `client bundle: "${args.path}" carries shared browser runtime identity and cannot be inlined — `
            + `declare it in ${id}'s dsh.client.external so the loader answers require("${args.path}") from its module table`,
          )
        }
        return null
      })
    },
  }
}

/**
 * Bundle the browser half into the registration artifact.
 * @param options - build inputs.
 * @param options.root - package root.
 * @param options.pkg - the parsed `package.json`.
 * @returns the script, its sourcemap, and the externals left to the loader.
 */
export async function bundleClient({ root, pkg }) {
  // Loaded lazily so `prepare.mjs` can import this module on a git install that
  // has no devDependencies at all.
  const { build } = await import('esbuild')
  const externals = new Set(clientExternals(pkg))
  const result = await build({
    absWorkingDir: root,
    entryPoints: ['src/client.ts'],
    outfile: 'lib/client.js',
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: ['es2022'],
    charset: 'utf8',
    legalComments: 'none',
    sourcemap: true,
    sourcesContent: true,
    logLevel: 'silent',
    // The shell fetches this file outside Vite's graph, so nothing rewrites a
    // node-idiom dependency's environment probe for it.
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [moduleTablePlugin(externals, pkg.name)],
    banner: { js: registrationBanner(pkg.name) },
    footer: { js: REGISTRATION_FOOTER },
  })
  const files = result.outputFiles ?? []
  const script = files.find(file => file.path.endsWith('.js'))
  const map = files.find(file => file.path.endsWith('.map'))
  if (script === undefined || map === undefined) {
    throw new Error('client bundle: the bundler produced no script/sourcemap pair')
  }
  return { code: script.text, map: map.text, externals: [...externals] }
}

/** The React surface the card touches, enough for a shape check to execute the factory. */
const REACT_STUB = {
  createElement: () => null,
  Fragment: null,
  useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useRef: value => ({ current: value }),
  useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
}

/**
 * Stand-in `require` for a shape check: real enough for React, permissive for
 * everything else. It proves the artifact's shape, never its behaviour — the
 * browser is what proves behaviour.
 * @param specifier - the requested module-table row.
 * @returns a stub module namespace.
 */
export function stubRequire(specifier) {
  if (specifier === 'react') return REACT_STUB
  if (specifier === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: null }
  return new Proxy({}, { get: (_target, key) => (key === '__esModule' ? false : () => null) })
}

/**
 * Execute a produced bundle the way the shell does and return its exports.
 *
 * The bundle is compiled with `new Function`, which — like the
 * `document.createElement('script')` the shell installs — always parses its
 * body as a classic script. A leftover top-level `import`/`export` therefore
 * fails here with the very same `SyntaxError` the browser reports, which is
 * what makes this the regression check rather than a text scan.
 * @param code - the bundle text.
 * @param id - the package name the registration must carry.
 * @param requireImpl - module-table stand-in.
 * @returns the factory's exports object.
 * @throws {Error} when the text is not a classic-script registration bundle.
 */
export function loadClientBundle(code, id, requireImpl = stubRequire) {
  let factory
  try {
    factory = new Function('window', 'require', 'module', 'exports', code)
  } catch (error) {
    throw new Error(
      `client bundle: ${id} is not a classic script the DSH loader can install — ${error.message}. `
      + 'The shell installs this file with document.createElement(\'script\') and concatenates one combo script per batch, '
      + 'so a top-level import/export takes every package in that batch down with it.',
      { cause: error },
    )
  }
  let registration
  const window = { __ModuleLoader__: { load: (value) => { registration = value } } }
  const module = { exports: {} }
  factory(window, requireImpl, module, module.exports)
  if (registration === undefined) {
    throw new Error(`client bundle: ${id} never called window.__ModuleLoader__.load`)
  }
  if (registration.id !== id) {
    throw new Error(`client bundle: registered as ${JSON.stringify(registration.id)}, expected ${JSON.stringify(id)}`)
  }
  if (typeof registration.factory !== 'function') {
    throw new Error(`client bundle: ${id} registered no factory`)
  }
  const exports = registration.factory(requireImpl)
  if (typeof exports !== 'object' || exports === null) {
    throw new Error(`client bundle: ${id} factory returned ${typeof exports}, expected the module exports object`)
  }
  return exports
}

/**
 * Prove one produced bundle satisfies the loader contract, including the
 * cordis plugin face the loader materializes the entry into.
 * @param code - the bundle text.
 * @param id - the package name the registration must carry.
 * @param requireImpl - module-table stand-in.
 * @returns the factory's exports object.
 * @throws {Error} when the artifact does not satisfy the contract.
 */
export function assertClientBundle(code, id, requireImpl = stubRequire) {
  const exports = loadClientBundle(code, id, requireImpl)
  if (typeof exports.apply !== 'function') {
    throw new Error(`client bundle: ${id} exports no apply() — the loader materializes a cordis plugin from this factory`)
  }
  if (!Array.isArray(exports.inject)) {
    throw new Error(`client bundle: ${id} exports no inject array — the loader waits on those services before apply()`)
  }
  return exports
}

/**
 * Read the shipped browser half.
 * @param root - package root.
 * @returns the bundle text.
 */
export function readClientBundle(root) {
  return readFileSync(join(root, 'lib', 'client.js'), 'utf8')
}
