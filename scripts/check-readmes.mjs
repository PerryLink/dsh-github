// Cross-checks every README's table-of-contents anchor links against its
// headings using GitHub-style slugs (emoji/CJK/Devanagari kept, punctuation
// stripped, spaces → hyphens, ASCII lowercased).
// Usage: node scripts/check-readmes.mjs
import { readFileSync, existsSync } from 'node:fs'

const FILES = ['README.md', 'README.zh-CN.md', 'README.es.md', 'README.pt.md', 'README.hi.md']

/** GitHub-slugger-compatible slug for one heading line (without the `## `). */
function slug(heading) {
  return heading
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[.,:;!?()'"·—•*]/g, '')
}

let failed = false
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
  const unreferenced = headings.filter(heading => !anchors.includes(slug(heading)))
  if (broken.length > 0 || unreferenced.length > 0) {
    console.log(`${file}: ${broken.length} broken, ${unreferenced.length} unreferenced`)
    for (const anchor of broken) console.log(`  broken: #${anchor}`)
    for (const heading of unreferenced) console.log(`  unreferenced: ## ${heading}`)
    failed = true
  } else {
    console.log(`${file}: OK (${headings.length} headings, ${anchors.length} links)`)
  }
}
process.exitCode = failed ? 1 : 0
