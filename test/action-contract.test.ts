/**
 * Composite-action contract smoke (pure static): reads `action.yml` and
 * asserts the structural contract a workflow author relies on — a composite
 * run, the documented inputs (every one carries a description), the published
 * outputs (each carries a `value` expression), and the four shell steps that
 * mirror the CI pipeline. No YAML parser dependency is required: the file is
 * checked as text against the stable 2-space-indent layout.
 * @module dsh-github/test/action-contract
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const actionYml = readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), 'action.yml'), 'utf8').replace(/\r\n/g, '\n')

const REQUIRED_INPUTS = [
  'task', 'pr', 'owner-repo', 'task-prompt', 'model', 'engine', 'deepseek-api-key',
  'github-token', 'check-name', 'blocking', 'fail-on', 'label-filters', 'path-filters',
  'max-diff-chars', 'post-comments', 'post-check', 'request-timeout-ms', 'node-version',
  'dsh-version', 'plugin-version', 'output-dir',
]

const REQUIRED_OUTPUTS = ['verdict', 'report-json', 'report-markdown', 'check-url']

describe('action.yml contract', () => {
  it('declares a composite run', () => {
    expect(actionYml).toMatch(/^name:\s*'dsh-github/m)
    expect(actionYml).toMatch(/^runs:\s*$/m)
    expect(actionYml).toMatch(/^\s+using:\s*composite\s*$/m)
    expect(actionYml).toMatch(/^\s+steps:\s*$/m)
  })

  it('declares every documented input with a description', () => {
    for (const input of REQUIRED_INPUTS) {
      expect(actionYml, `missing input "${input}"`).toMatch(new RegExp(`^  ${input}:$`, 'm'))
    }
    // Every input block is a `key:\n description:` pair (the deepseek-api-key
    // input is required=true but still carries a description).
    for (const input of REQUIRED_INPUTS) {
      expect(actionYml, `input "${input}" has no description`).toMatch(new RegExp(`^  ${input}:\n\\s+description:`, 'm'))
    }
    expect(actionYml).toMatch(/^  deepseek-api-key:\n\s+description:.*\n\s+required: true$/m)
  })

  it('declares every documented output with a value expression', () => {
    for (const output of REQUIRED_OUTPUTS) {
      expect(actionYml, `missing output "${output}"`).toMatch(new RegExp(`^  ${output}:$`, 'm'))
    }
    for (const output of REQUIRED_OUTPUTS) {
      expect(actionYml, `output "${output}" has no value`).toMatch(new RegExp(`^  ${output}:\n\\s+description:.*\n\\s+value: \\$\\{\\{`, 'm'))
    }
  })

  it('runs the four pipeline steps in order', () => {
    const steps = ['Set up Node', 'Install dsh and dsh-github', 'Generate the dsh profile overlay and task', 'Run dsh headless', 'Publish outputs and enforce the gate']
    let cursor = actionYml.indexOf('  steps:')
    for (const step of steps) {
      const next = actionYml.indexOf(`name: ${step}`, cursor)
      expect(next, `step "${step}" not found after the previous`).toBeGreaterThan(cursor)
      cursor = next
    }
  })
})
