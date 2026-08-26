import { describe, expect, it } from 'vitest'
import { loadPlugin, makeServices, stubFetch, jsonResponse, TOKEN } from './helpers.ts'

/** A graphql stub returning the given `data`, dispatching on POST /graphql. */
function graphqlStub(data: unknown): ReturnType<typeof stubFetch> {
  return stubFetch([{
    match: (m, url) => m === 'POST' && url.pathname === '/graphql',
    respond: () => jsonResponse(200, { data }),
  }])
}

async function loaded(fetchImpl: ReturnType<typeof stubFetch>) {
  const services = makeServices()
  services.credentials.values.set('GITHUB_TOKEN', TOKEN)
  await loadPlugin(services, { config: { defaultOwnerRepo: 'o/r' }, fetchImpl })
  return services
}

describe('gh_repo_search (GraphQL)', () => {
  it('returns repository search results from the GraphQL API', async () => {
    const services = await loaded(graphqlStub({
      search: {
        repositoryCount: 2,
        edges: [
          { node: { nameWithOwner: 'a/b', description: 'desc', stargazerCount: 10, url: 'https://github.com/a/b', primaryLanguage: { name: 'TypeScript' } } },
          { node: { nameWithOwner: 'c/d', description: null, stargazerCount: 0, url: 'https://github.com/c/d', primaryLanguage: null } },
        ],
      },
    }))
    const result = await services.tools.run('gh_repo_search', { q: 'dsh-plugin', perPage: 10 })
    expect(result).toMatchObject({
      query: 'dsh-plugin',
      total: 2,
      items: [
        { repo: 'a/b', description: 'desc', stars: 10, language: 'TypeScript', url: 'https://github.com/a/b' },
        { repo: 'c/d', description: '', stars: 0, language: '', url: 'https://github.com/c/d' },
      ],
    })
  })

  it('rejects an empty query', async () => {
    const services = await loaded(graphqlStub({ search: { repositoryCount: 0, edges: [] } }))
    const result = await services.tools.run('gh_repo_search', { q: '   ' })
    expect(result).toMatchObject({ status: 'error', code: 'invalid-args' })
  })
})

describe('gh_checks (GraphQL)', () => {
  it('returns the PR status-check rollup with normalized contexts', async () => {
    const services = await loaded(graphqlStub({
      repository: {
        pullRequest: {
          number: 7,
          title: 'feat: shiny',
          state: 'OPEN',
          commits: {
            nodes: [{
              commit: {
                statusCheckRollup: {
                  state: 'SUCCESS',
                  contexts: {
                    nodes: [
                      { __typename: 'CheckRun', name: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS', detailsUrl: 'https://ci.example/run' },
                      { __typename: 'StatusContext', context: 'lint', state: 'SUCCESS', description: 'ok', targetUrl: 'https://ci.example/status' },
                    ],
                  },
                },
              },
            }],
          },
        },
      },
    }))
    const result = await services.tools.run('gh_checks', { pr: 'o/r#7' })
    expect(result).toMatchObject({
      repo: 'o/r',
      number: 7,
      title: 'feat: shiny',
      state: 'OPEN',
      rollup: 'SUCCESS',
      items: [
        { name: 'CI', state: 'COMPLETED', conclusion: 'SUCCESS', url: 'https://ci.example/run' },
        { name: 'lint', state: 'SUCCESS', url: 'https://ci.example/status' },
      ],
    })
  })

  it('reports not-found when the pull request is absent', async () => {
    const services = await loaded(graphqlStub({ repository: { pullRequest: null } }))
    const result = await services.tools.run('gh_checks', { pr: 'o/r#999' })
    expect(result).toMatchObject({ status: 'error', code: 'not-found' })
  })
})
