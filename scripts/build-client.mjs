// Wrap the tsc-compiled ESM client bundle into the DeepSeek Harness browser
// module-loader contract.
//
// The host's client module system (`@deepseek-ai/dsh-client-modules`) is a lazy
// CJS table: executing a client bundle must REGISTER a factory through
// `window.__ModuleLoader__.load({ id, factory })`; every module body side effect
// lives inside that factory and runs at materialization, not at script
// execution. A bundle that ends in top-level `export` bindings registers
// nothing, and the host reports
//
//   client-modules: could not load "<pkg>": <url>:
//     loaded without registering "<pkg>" via __ModuleLoader__.load
//
// `tsc` emits ESM, so this step rewrites the compiled file in place:
//
//   import { a, b } from 'm'   ->  const { a, b } = require('m')
//   export function f() {}     ->  function f() {}    (+ exports.f = f)
//   export const x = 1         ->  const x = 1        (+ exports.x = x)
//   export class C {}          ->  class C {}         (+ exports.C = C)
//   export { a, b as c }       ->  (removed)          (+ exports.a = a; exports.c = b)
//
// Original line order is preserved: only a fixed prefix is added before the
// module body and a fixed suffix after it, so `lib/client.js.map` stays valid
// after the same line offset is applied to it (an empty leading run of `;`
// segments means "these generated lines carry no mapping"). That keeps the map
// shipped with the wrapped bundle usable while debugging in the browser.
//
// It fails loud on any shape it does not recognize, rather than ship a bundle
// that cannot register. Re-running it on an already-wrapped bundle is a no-op,
// so both `build` and `prepare` can call it.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const libDir = join(root, 'lib')
const clientPath = join(libDir, 'client.js')
const mapPath = join(libDir, 'client.js.map')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const pkgName = manifest.name

const MARKER = 'window.__ModuleLoader__.load('
const source = readFileSync(clientPath, 'utf8')

if (source.includes(MARKER)) {
  console.log('build-client: lib/client.js is already wrapped; nothing to do')
  process.exit(0)
}

const SOURCE_MAP_COMMENT = /^\/\/# sourceMappingURL=(\S+)\s*$/

// Top-level statements only: tsc emits them at column 0 and nested code is
// always indented, so a column-0 anchor cannot reach into a function body.
const isTopLevel = (line) => !/^[ \t]/.test(line)

const exported = [] // [ exportName, localName ]
const body = []
let sourceMapTarget

const fail = (line, why) => {
  throw new Error(
    `build-client: unsupported top-level statement (${why}); ` +
      `teach scripts/build-client.mjs this shape before shipping:\n  ${line}`,
  )
}

for (const line of source.split('\n')) {
  if (isTopLevel(line) && line.startsWith('import ')) {
    const named = line.match(/^import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2\s*;?$/)
    const bare = line.match(/^import\s+(['"])([^'"]+)\1\s*;?$/)
    const star = line.match(/^import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s*from\s*(['"])([^'"]+)\2\s*;?$/)
    const def = line.match(/^import\s+([A-Za-z_$][\w$]*)\s*from\s*(['"])([^'"]+)\2\s*;?$/)

    if (bare) {
      body.push(`require(${JSON.stringify(bare[2])});`)
    } else if (named) {
      const spec = named[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      for (const binding of spec) {
        if (!/^[A-Za-z_$][\w$]*$/.test(binding)) fail(line, 'aliased or namespaced named import')
      }
      body.push(`const { ${spec.join(', ')} } = require(${JSON.stringify(named[3])});`)
    } else if (star) {
      body.push(`const ${star[1]} = require(${JSON.stringify(star[3])});`)
    } else if (def) {
      body.push(`const ${def[1]} = require(${JSON.stringify(def[3])}).default;`)
    } else {
      fail(line, 'unrecognized import form')
    }
    continue
  }

  if (isTopLevel(line) && line.startsWith('export ')) {
    if (/^export\s+default\b/.test(line)) fail(line, 'default export')
    if (/^export\s*\*/.test(line)) fail(line, 'star re-export')

    const list = line.match(/^export\s*\{([^}]*)\}\s*(?:from\s*(['"])([^'"]+)\2)?\s*;?$/)
    if (list) {
      if (list[2] !== undefined) fail(line, 're-export from another module')
      for (const entry of list[1].split(',').map((s) => s.trim()).filter(Boolean)) {
        const parts = entry.split(/\s+as\s+/).map((s) => s.trim())
        const exportedName = parts.length === 2 ? parts[1] : parts[0]
        if (!/^[A-Za-z_$][\w$]*$/.test(exportedName)) fail(line, 'unrecognized export alias')
        exported.push([exportedName, parts[0]])
      }
      continue // the declaration itself stays in the body untouched
    }

    const decl = line.match(
      /^export\s+(?:async\s+)?(function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/,
    )
    if (!decl) fail(line, 'unrecognized export form')
    if (decl[1] === 'const' || decl[1] === 'let' || decl[1] === 'var') {
      // Only a simple `name = …` binding is supported; destructuring would need
      // per-binding names this script cannot infer from a single line.
      if (!/^export\s+(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/.test(line)) {
        fail(line, 'destructuring or uninitialized export binding')
      }
    }
    exported.push([decl[2], decl[2]])
    body.push(line.slice('export '.length))
    continue
  }

  // The trailing source map comment is re-emitted after the wrapper so the map
  // reference stays the last line of the shipped file.
  const mapComment = line.match(SOURCE_MAP_COMMENT)
  if (mapComment && isTopLevel(line)) {
    sourceMapTarget = mapComment[1]
    continue
  }

  body.push(line)
}

const indent = (line) => (line.length === 0 ? '' : `\t${line}`)

const prefix = [
  'window.__ModuleLoader__.load({',
  `\tid: ${JSON.stringify(pkgName)},`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
  '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
]
const suffix = [
  ...exported.map(([name, local]) => `\t\texports.${name} = ${local};`),
  '\t\treturn module.exports;',
  '\t}',
  '});',
]

const wrapped = [
  ...prefix,
  ...body.map(indent),
  ...suffix,
  ...(sourceMapTarget === undefined ? [] : [`//# sourceMappingURL=${sourceMapTarget}`]),
  '',
].join('\n')

// Guard the contract itself: the host accepts a bundle only when it registers
// under the package name, so a regression here must fail the build, not the
// browser.
const leftover = wrapped
  .split('\n')
  .filter((line) => isTopLevel(line) && /^(?:import|export)\s/.test(line))
if (leftover.length > 0) {
  throw new Error(`build-client: ESM syntax survived the wrap:\n${leftover.join('\n')}`)
}
if (!wrapped.includes(MARKER) || !wrapped.includes(`id: ${JSON.stringify(pkgName)}`)) {
  throw new Error('build-client: wrapped bundle does not register under the package name')
}

writeFileSync(clientPath, wrapped)

// Shift the source map by the wrapper prefix so mappings stay aligned. A run of
// empty generated segments is exactly "these lines have no mapping", which is
// true for the wrapper lines themselves.
let mapShifted = false
try {
  const map = JSON.parse(readFileSync(mapPath, 'utf8'))
  if (typeof map.mappings === 'string') {
    map.mappings = `${';'.repeat(prefix.length)}${map.mappings}`
    writeFileSync(mapPath, `${JSON.stringify(map)}\n`)
    mapShifted = true
  }
} catch {
  // A missing source map is not fatal: the bundle contract does not need it.
}

console.log(
  `build-client: wrapped lib/client.js for __ModuleLoader__ ` +
    `(${exported.length} exports, id ${pkgName}${mapShifted ? ', source map shifted' : ''})`,
)
