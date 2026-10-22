#!/usr/bin/env node
// Wrap the tsc-emitted ESM browser half in the host's __ModuleLoader__ factory.
// The host executes lib/client.js as a classic script; a bare `export` there is
// a syntax error, which is the root cause of "Failed to load plugins" (issue #12/#13).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const file = join(root, 'lib', 'client.js')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
  throw new Error('bundle-client: package.json has no name')
}
let text = readFileSync(file, 'utf8')
if (text.startsWith('window.__ModuleLoader__.load(')) process.exit(0)

const imports = []
text = text.replace(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?\s*$/gm, (_, names, spec) => {
  imports.push(`const { ${names.trim()} } = require(${JSON.stringify(spec)});`)
  return ''
})

const exports = []
text = text.replace(/^export\s+(async\s+)?(function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, asyncKw, kind, name) => {
  exports.push(name)
  return `${asyncKw ?? ''}${kind} ${name}`
})
text = text.replace(/^export\s+const\s+([A-Za-z_$][\w$]*)/gm, (_, name) => {
  exports.push(name)
  return `const ${name}`
})
text = text.replace(/^export\s+\{([^}]+)\};?\s*$/gm, (_, names) => {
  for (const part of names.split(',')) {
    const [local, exported] = part.trim().split(/\s+as\s+/)
    if (local) exports.push(exported ?? local)
  }
  return ''
})
text = text.replace(/\/\/# sourceMappingURL=.*$/gm, '')

const tail = exports.map(name => `\t\texports.${name} = ${name};`).join('\n')
const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(manifest.name)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${imports.map(line => '\t\t' + line).join('\n')}
${text.trim().split('\n').map(line => line ? '\t\t' + line : '').join('\n')}
${tail}
\t\treturn module.exports;
\t}
});
`
writeFileSync(file, wrapped)
console.log('bundle-client: wrapped lib/client.js')
