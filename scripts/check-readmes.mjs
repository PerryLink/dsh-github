// Cross-checks the documentation against the source:
// 1. Every README's table-of-contents anchor links resolve against its own
//    headings using GitHub-style slugs (emoji/CJK/Devanagari kept, punctuation
//    stripped, spaces → hyphens, ASCII lowercased). The 📚-marked
//    table-of-contents heading itself is exempt from the must-be-referenced
//    rule: it is the navigation index, not a target.
// 2. Every tool name in src/tools.ts and every config key in src/config.ts is
//    mentioned in every README (drift guard for the 5-language docs).
// 3. No README pins a versioned tarball name (dsh-github-x.y.z.tgz) — the
//    tarball channel must stay version-agnostic so it cannot go stale.
// 4. CHANGELOG.md carries a `## [<version>]` section for package.json's
//    current version.
// Usage: node scripts/check-readmes.mjs
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const FILES = ['README.md', 'README.zh-CN.md', 'README.es.md', 'README.pt.md', 'README.hi.md']

/** GitHub-slugger-compatible slug for one heading line (without the `## `). */
function slug(heading) {
  return heading
    .replace(/\r/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[.,:;!?()'"·—•*]/g, '')
}

/** The 📚 heading is the table of contents itself, never a link target. */
function isTocHeading(heading) {
  return heading.includes('📚')
}

/** Extract tool names from `name: '…'` literals in src/tools.ts. */
function toolNames() {
  const text = readFileSync(join(root, 'src', 'tools.ts'), 'utf8')
  const names = new Set()
  for (const match of text.matchAll(/\bname:\s*'([a-z][a-z0-9_]*)'/g)) names.add(match[1])
  return [...names].sort()
}

/** Extract config keys from the `Config` interface in src/config.ts. */
function configKeys() {
  const text = readFileSync(join(root, 'src', 'config.ts'), 'utf8')
  const block = text.split('export interface Config {')[1]?.split('\n}')[0] ?? ''
  const keys = new Set()
  for (const line of block.split('\n')) {
    const match = /^\s{2}([a-zA-Z][a-zA-Z0-9]*)\??:/.exec(line)
    if (match) keys.add(match[1])
  }
  return [...keys].sort()
}

function version() {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  return pkg.version
}

let failed = false
const tools = toolNames()
const keys = configKeys()
const pkgVersion = version()

for (const file of FILES) {
  if (!existsSync(file)) {
    console.log(`${file}: MISSING`)
    failed = true
    continue
  }
  const text = readFileSync(file, 'utf8')
  const headings = text.split('\n').filter(line => /^## /.test(line)).map(line => line.slice(3))
  const anchors = [...text.matchAll(/\]\(#([^)]+)\)/g)].map(match => decodeURIComponent(match[1]))
  const broken = anchors.filter(anchor => !headings.some(heading => slug(heading) === anchor))
  const unreferenced = headings.filter(heading => !isTocHeading(heading) && !anchors.includes(slug(heading)))
  if (broken.length > 0 || unreferenced.length > 0) {
    console.log(`${file}: ${broken.length} broken, ${unreferenced.length} unreferenced`)
    for (const anchor of broken) console.log(`  broken: #${anchor}`)
    for (const heading of unreferenced) console.log(`  unreferenced: ## ${heading}`)
    failed = true
  } else {
    console.log(`${file}: OK (${headings.length} headings, ${anchors.length} links)`)
  }

  const missingTools = tools.filter(name => !text.includes(name))
  const missingKeys = keys.filter(key => !text.includes(`\`${key}\``))
  if (missingTools.length > 0 || missingKeys.length > 0) {
    for (const name of missingTools) console.log(`  missing tool: ${name}`)
    for (const key of missingKeys) console.log(`  missing config key: ${key}`)
    failed = true
  }

  const pinnedTarball = /dsh-github-\d+\.\d+\.\d+\.tgz/.exec(text)
  if (pinnedTarball !== null) {
    console.log(`  pinned tarball name: ${pinnedTarball[0]} (use dsh-github-<version>.tgz)`)
    failed = true
  }
}

if (existsSync(join(root, 'CHANGELOG.md'))) {
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
  if (!changelog.includes(`## [${pkgVersion}]`)) {
    console.log(`CHANGELOG.md: missing "## [${pkgVersion}]" section for the current version`)
    failed = true
  } else {
    console.log(`CHANGELOG.md: OK (## [${pkgVersion}])`)
  }
} else {
  console.log('CHANGELOG.md: MISSING')
  failed = true
}

console.log(`inventory: ${tools.length} tools, ${keys.length} config keys, version ${pkgVersion}`)
process.exitCode = failed ? 1 : 0
