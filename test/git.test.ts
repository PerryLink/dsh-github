import { describe, expect, it } from 'vitest'
import { repoFromRemoteUrl } from '../src/git.ts'

describe('repoFromRemoteUrl', () => {
  it('parses github.com origins in https, ssh, and git forms', () => {
    expect(repoFromRemoteUrl('https://github.com/o/r.git')).toBe('o/r')
    expect(repoFromRemoteUrl('git@github.com:o/r.git')).toBe('o/r')
    expect(repoFromRemoteUrl('ssh://git@github.com/o/r.git')).toBe('o/r')
    expect(repoFromRemoteUrl('git://github.com/o/r.git')).toBe('o/r')
    expect(repoFromRemoteUrl('https://github.com/o/r')).toBe('o/r')
  })

  it('defaults to github.com and rejects foreign hosts', () => {
    expect(repoFromRemoteUrl('https://github.com/o/r.git')).toBe('o/r')
    expect(repoFromRemoteUrl('https://gitlab.com/o/r.git')).toBeNull()
  })

  it('parses GitHub Enterprise origins when the API host matches', () => {
    expect(repoFromRemoteUrl('https://git.example.com/o/r.git', 'git.example.com')).toBe('o/r')
    expect(repoFromRemoteUrl('git@git.example.com:o/r.git', 'git.example.com')).toBe('o/r')
    expect(repoFromRemoteUrl('https://github.com/o/r.git', 'git.example.com')).toBeNull()
  })

  it('handles a port on the host', () => {
    expect(repoFromRemoteUrl('https://git.example.com:8443/o/r.git', 'git.example.com')).toBe('o/r')
  })

  it('rejects unparseable remotes', () => {
    expect(repoFromRemoteUrl('not a url')).toBeNull()
    expect(repoFromRemoteUrl('')).toBeNull()
    expect(repoFromRemoteUrl('https://example.com')).toBeNull()
  })
})
