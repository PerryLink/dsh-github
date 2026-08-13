import { describe, expect, it } from 'vitest'
import { analyzeDiff, formatPostBody, parseDiffStats, parseAddedLines } from '../src/review.ts'

const SAMPLE_DIFF = [
  'diff --git a/src/app.ts b/src/app.ts',
  'index 0000000..1111111 100644',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1,3 +1,8 @@',
  ' export function main() {',
  '+  const token = "ghp_ABCDEFGHIJKLMNOPQRST123456"',
  '+  console.log("debug", token)',
  '+  // TODO: remove this later',
  '+  eval("userInput()")',
  '+  return 42',
  ' }',
  'diff --git a/src/other.ts b/src/other.ts',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/src/other.ts',
  '@@ -0,0 +1,2 @@',
  '+export const clean = 1',
  '+export const clean2 = 2',
].join('\n')

describe('analyzeDiff', () => {
  it('parses added lines with new-file line numbers', () => {
    const added = parseAddedLines(SAMPLE_DIFF, 100_000)
    expect(added.map(item => item.file)).toContain('src/app.ts')
    expect(added.filter(item => item.file === 'src/app.ts').length).toBe(5)
    const first = added.find(item => item.file === 'src/app.ts')
    expect(first?.line).toBe(2)
  })

  it('skips /dev/null files as current-file targets but keeps stats', () => {
    const stats = parseDiffStats(SAMPLE_DIFF, 100_000)
    const other = stats.find(stat => stat.path === 'src/other.ts')
    expect(other).toEqual({ path: 'src/other.ts', added: 2, removed: 0 })
  })

  it('flags hardcoded secrets, debug statements, TODO markers, and eval', () => {
    const report = analyzeDiff(SAMPLE_DIFF, 100_000)
    const rules = report.findings.map(finding => finding.rule)
    expect(rules).toContain('hardcoded-secret')
    expect(rules).toContain('debug-artifact')
    expect(rules).toContain('todo-marker')
    expect(rules).toContain('eval-usage')
    const secret = report.findings.find(finding => finding.rule === 'hardcoded-secret')
    expect(secret?.severity).toBe('error')
    expect(secret?.file).toBe('src/app.ts')
  })

  it('caps the diff and reports truncation', () => {
    const report = analyzeDiff(SAMPLE_DIFF, 40)
    expect(report.summary).toContain('截断')
    expect(report.findings.length).toBeLessThanOrEqual(50)
  })

  it('summarizes counts by severity', () => {
    const report = analyzeDiff(SAMPLE_DIFF, 100_000)
    expect(report.summary).toMatch(/\d+ error/)
    expect(report.summary).toMatch(/\d+ warning/)
  })

  it('formats a postable Markdown body grouped by file', () => {
    const report = analyzeDiff(SAMPLE_DIFF, 100_000)
    const body = formatPostBody(report.findings, false)
    expect(body).toContain('## dsh-github 审查')
    expect(body).toContain('### src/app.ts')
    expect(body).toContain('hardcoded-secret')
    expect(body).toContain('*由 [dsh-github]')
  })

  it('reports clean diffs without findings', () => {
    const clean = 'diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1,2 @@\n x\n+fine line\n'
    const report = analyzeDiff(clean, 100_000)
    expect(report.findings).toEqual([])
    expect(report.summary).toContain('未发现明显问题')
  })
})
