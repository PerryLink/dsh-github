/**
 * Deterministic multi-file PR analyzer: parses a unified diff and produces a
 * structured finding list plus a ready-to-post Markdown comment body.
 *
 * The analyzer is intentionally model-free — it runs inside the background
 * review job without spending tokens, is deterministic, and its output is the
 * only content the `/review post` approval offers for posting. For an LLM
 * review instead, configure `reviewMode: "model"` (src/jobs.ts delegates the
 * capped diff to a one-shot subagent through the host's subagents seam).
 * @module dsh-github/review
 */

export type FindingSeverity = 'info' | 'warning' | 'error'

/** One review finding anchored to a file (and a new-file line when known). */
export interface Finding {
  file: string
  line: number | null
  severity: FindingSeverity
  /** Short stable rule id, shown in the posted comment. */
  rule: string
  message: string
}

/** Complete review result: findings, summary text, and the postable body. */
export interface ReviewReport {
  findings: Finding[]
  summary: string
  postBody: string
  /** Whether the analyzed diff exceeded the cap and was truncated. */
  truncated: boolean
}

const MAX_FINDINGS = 50

interface RuleCheck {
  rule: string
  severity: FindingSeverity
  message: string
  pattern: RegExp
}

const LINE_RULES: readonly RuleCheck[] = [
  { rule: 'hardcoded-secret', severity: 'error', message: 'possible hardcoded secret (token/private key); inject via credentials instead', pattern: /(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/ },
  { rule: 'google-api-key', severity: 'error', message: 'possible hardcoded Google API key; restrict it and load it from the environment', pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { rule: 'hardcoded-credential', severity: 'warning', message: 'possible hardcoded credential assignment; read from the environment or the credentials seam instead', pattern: /\b(password|passwd|pwd|secret|api[_-]?key)\s*[:=]\s*['"][^'"]{6,}['"]/i },
  { rule: 'debug-artifact', severity: 'warning', message: 'debug statement; remove before merging', pattern: /\b(console\.(log|debug|warn)|debugger)\b/ },
  { rule: 'eval-usage', severity: 'warning', message: 'dynamic evaluation (eval/new Function); avoid unless necessary', pattern: /\beval\s*\(|new\s+Function\s*\(/ },
  { rule: 'todo-marker', severity: 'info', message: 'leftover marker (TODO/FIXME/XXX); confirm it is tracked', pattern: /\b(TODO|FIXME|XXX)\b/ },
]

const MAX_LINE_LENGTH = 300

interface ParsedHunk {
  file: string
  newStart: number
  newLine: number
}

/** Split a unified diff into per-file added lines with new-file line numbers. */
export function parseAddedLines(diff: string, maxChars: number): Array<{ file: string; line: number; text: string }> {
  const limited = diff.length > maxChars ? diff.slice(0, maxChars) : diff
  const lines = limited.split(/\r?\n/)
  const added: Array<{ file: string; line: number; text: string }> = []
  let hunk: ParsedHunk | null = null
  for (const line of lines) {
    if (line.startsWith('+++ ')) {
      const file = line.slice(4).trim().replace(/^b\//, '')
      if (file !== '/dev/null') hunk = { file, newStart: 0, newLine: 0 }
      continue
    }
    if (hunk === null) continue
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (match) {
      const start = Number(match[1])
      hunk.newStart = start
      hunk.newLine = start
      continue
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      added.push({ file: hunk.file, line: hunk.newLine, text: line.slice(1) })
      hunk.newLine += 1
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      // Removed line: new-file numbering does not advance.
    } else if (line.startsWith(' ')) {
      hunk.newLine += 1
    }
  }
  return added
}

/** Per-file change sizes parsed from a unified diff. */
export interface DiffFileStat {
  path: string
  added: number
  removed: number
}

/** Parse per-file added/removed counts out of a unified diff. */
export function parseDiffStats(diff: string, maxChars: number): DiffFileStat[] {
  const limited = diff.length > maxChars ? diff.slice(0, maxChars) : diff
  const lines = limited.split(/\r?\n/)
  const stats = new Map<string, DiffFileStat>()
  let current: DiffFileStat | null = null
  for (const line of lines) {
    if (line.startsWith('+++ ')) {
      const file = line.slice(4).trim().replace(/^b\//, '')
      if (file === '/dev/null') {
        current = null
        continue
      }
      current = stats.get(file) ?? { path: file, added: 0, removed: 0 }
      stats.set(file, current)
    } else if (current !== null && line.startsWith('+') && !line.startsWith('+++')) {
      current.added += 1
    } else if (current !== null && line.startsWith('-') && !line.startsWith('---')) {
      current.removed += 1
    }
  }
  return [...stats.values()]
}

/**
 * Analyze a unified diff into findings and a postable comment body.
 * @param diff - unified diff text (already capped by the caller or capped here).
 * @param maxChars - character cap applied before parsing.
 * @returns findings (capped), one-line summary, and Markdown post body.
 */
export function analyzeDiff(diff: string, maxChars: number): ReviewReport {
  const added = parseAddedLines(diff, maxChars)
  const findings: Finding[] = []

  const perFileAdded = new Map<string, number>()
  for (const item of added) {
    perFileAdded.set(item.file, (perFileAdded.get(item.file) ?? 0) + 1)
    if (findings.length >= MAX_FINDINGS) break
    for (const rule of LINE_RULES) {
      if (rule.pattern.test(item.text)) {
        findings.push({ file: item.file, line: item.line, severity: rule.severity, rule: rule.rule, message: rule.message })
        break
      }
    }
    if (findings.length >= MAX_FINDINGS) break
    if (item.text.length > MAX_LINE_LENGTH) {
      findings.push({ file: item.file, line: item.line, severity: 'info', rule: 'long-line', message: `line exceeds ${MAX_LINE_LENGTH} characters; consider splitting it` })
    }
  }

  for (const [file, count] of perFileAdded) {
    if (findings.length >= MAX_FINDINGS) break
    if (count > 400) findings.push({ file, line: null, severity: 'info', rule: 'large-change', message: `this PR adds ${count} lines to this file; consider splitting the commit` })
  }

  const truncated = diff.length > maxChars
  const summary = findings.length === 0
    ? `review complete: ${added.length} added line(s), no obvious issues found${truncated ? ' (diff truncated)' : ''}`
    : `review complete: ${findings.length} finding(s) (${countSeverity(findings, 'error')} error / ${countSeverity(findings, 'warning')} warning / ${countSeverity(findings, 'info')} info)${truncated ? ' (diff truncated)' : ''}`

  return { findings, summary, postBody: formatPostBody(findings, truncated), truncated }
}

function countSeverity(findings: readonly Finding[], severity: FindingSeverity): number {
  return findings.filter(finding => finding.severity === severity).length
}

/** Make a diff-derived file name safe to interpolate into Markdown. */
function sanitizeFileName(file: string): string {
  return file
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/[\r\n\t]/g, ch => ({ '\r': '\\r', '\n': '\\n', '\t': '\\t' })[ch] ?? '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Markdown comment body grouped by file, ready for a PR issue comment. */
export function formatPostBody(findings: readonly Finding[], truncated: boolean): string {
  if (findings.length === 0) {
    return `## dsh-github review\n\nNo obvious issues found.${truncated ? '\n\n> Note: the diff exceeded the cap and was truncated.' : ''}`
  }
  const byFile = new Map<string, Finding[]>()
  for (const finding of findings) {
    const list = byFile.get(finding.file) ?? []
    list.push(finding)
    byFile.set(finding.file, list)
  }
  const sections: string[] = ['## dsh-github review\n']
  for (const [file, fileFindings] of byFile) {
    sections.push(`### \`${sanitizeFileName(file)}\`\n`)
    for (const finding of fileFindings) {
      const line = finding.line === null ? '' : `:${finding.line}`
      sections.push(`- **${finding.severity}** \`${finding.rule}\`${line}: ${finding.message}`)
    }
    sections.push('')
  }
  if (truncated) sections.push('> Note: the diff exceeded the cap and was truncated; this report only covers the examined range.')
  sections.push('')
  sections.push('*Generated by [dsh-github](https://github.com/PerryLink/dsh-github); published after human approval.*')
  return sections.join('\n')
}
