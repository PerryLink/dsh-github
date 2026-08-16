/**
 * PR-level review rules for the CI pipeline: change scope, test existence,
 * and sensitive files. Line-level findings stay in src/review.ts; these rules
 * reason about the pull request as a whole (file list, totals) and produce
 * findings anchored to a file (`line: null`) or to the PR itself (`file: ''`).
 *
 * The rules are deterministic and model-free — the same review runs in the
 * polling bot, the headless action, and the one-shot `ci_run` tool with
 * identical output.
 * @module dsh-github/ci/review-rules
 */
import type { Finding } from '../review.ts'
import type { CiConfig } from '../config.ts'

/** One changed file's stats, as reported by the PR files endpoint. */
export interface ChangedFileStat {
  path: string
  added: number
  removed: number
}

/** Facts the PR-level rules reason over. */
export interface PrReviewInput {
  /** Changed files with per-file added/removed counts. */
  files: ChangedFileStat[]
  /** PR-wide added/removed line totals. */
  additions: number
  deletions: number
  /** Tunable rule options from the CI config. */
  options: Pick<CiConfig,
    | 'sensitivePathPatterns' | 'sensitiveSeverity'
    | 'codeExtensions' | 'testPathPatterns'
    | 'maxChangedFiles' | 'maxAddedLines' | 'maxRemovedLines'
  >
}

/**
 * Translate one glob into an anchored RegExp supporting `*`, `**`, and `?`.
 * A pattern without a `/` is a basename glob and matches at any depth
 * (`.env` matches `config/.env`, `*.pem` matches `certs/server.pem`);
 * patterns containing `/` match against the whole repository path.
 */
export function globToRegExp(pattern: string): RegExp {
  let source = ''
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index] ?? ''
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        // `**/` matches any directory depth (including none).
        if (pattern[index + 2] === '/') {
          source += '(?:.*/)?'
          index += 2
          continue
        }
        source += '.*'
        index += 1
        continue
      }
      source += '[^/]*'
      continue
    }
    if (char === '?') {
      source += '[^/]'
      continue
    }
    if ('\\^$.*+?()[]{}|'.includes(char)) source += `\\${char}`
    else source += char
  }
  const prefix = pattern.includes('/') ? '' : '(?:.*/)?'
  return new RegExp(`^${prefix}${source}$`)
}

/** Whether a repository path matches any of the configured globs. */
export function matchesAnyGlob(path: string, patterns: readonly string[]): boolean {
  const regexes = patterns.map(pattern => globToRegExp(pattern))
  return regexes.some(regex => regex.test(path))
}

/** PR-level findings for one pull request; deterministic and ordered. */
export function analyzePr(input: PrReviewInput): Finding[] {
  const findings: Finding[] = []
  const { files, options } = input

  // Sensitive files: credentials, keys, secrets, and CI workflow edits need
  // human eyes regardless of what the diff text itself looks like.
  if (options.sensitivePathPatterns.length > 0) {
    for (const file of files) {
      if (matchesAnyGlob(file.path, options.sensitivePathPatterns)) {
        findings.push({
          file: file.path,
          line: null,
          severity: options.sensitiveSeverity,
          rule: 'sensitive-file',
          message: 'sensitive path changed (credentials, keys, secrets, or CI workflows); review carefully and never embed secrets',
        })
      }
    }
  }

  // Change scope: total file count and line totals beyond the caps.
  if (files.length > options.maxChangedFiles) {
    findings.push({
      file: '',
      line: null,
      severity: 'info',
      rule: 'large-change',
      message: `PR touches ${files.length} files (cap ${options.maxChangedFiles}); consider splitting it into smaller changes`,
    })
  }
  if (input.additions > options.maxAddedLines) {
    findings.push({
      file: '',
      line: null,
      severity: 'info',
      rule: 'large-change',
      message: `PR adds ${input.additions} lines (cap ${options.maxAddedLines}); consider splitting it into smaller changes`,
    })
  }
  if (input.deletions > options.maxRemovedLines) {
    findings.push({
      file: '',
      line: null,
      severity: 'info',
      rule: 'large-change',
      message: `PR removes ${input.deletions} lines (cap ${options.maxRemovedLines}); double-check the removed behavior`,
    })
  }

  // Test existence: code changed without any test change.
  if (options.codeExtensions.length > 0 && options.testPathPatterns.length > 0) {
    const isCode = (path: string): boolean => options.codeExtensions.some(ext => path.toLowerCase().endsWith(ext.toLowerCase()))
    const isTest = (path: string): boolean => matchesAnyGlob(path, options.testPathPatterns)
    const codeFiles = files.filter(file => isCode(file.path))
    const testFiles = files.filter(file => isTest(file.path))
    if (codeFiles.length > 0 && testFiles.length === 0) {
      findings.push({
        file: '',
        line: null,
        severity: 'warning',
        rule: 'missing-tests',
        message: `${codeFiles.length} code file(s) changed with no test changes; consider adding coverage for the new behavior`,
      })
    }
  }

  return findings
}
