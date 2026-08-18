// scripts/check-endpoints.mjs — M3 外部端点存活探测（Claude Code check-mcp-urls
// 模式）：401/403/405/5xx = 存活（未带凭据的预期响应），仅 404/410/DNS/TLS/超时
// = 失败。GitHub API 为插件声明的固定公共端点。
import { request } from 'node:https'

const ENDPOINTS = [
  { name: 'GitHub API', url: 'https://api.github.com' },
  { name: 'GitHub web', url: 'https://github.com' },
]

const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 15000)

function probe(url) {
  return new Promise((resolve) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const req = request(url, { method: 'GET', headers: { 'user-agent': 'dsh-endpoint-liveness/1.0' }, signal: controller.signal }, (res) => {
      res.resume()
      clearTimeout(timer)
      resolve({ status: res.statusCode })
    })
    req.on('error', (error) => {
      clearTimeout(timer)
      const message = String(error?.message ?? error)
      if (controller.signal.aborted) return resolve({ status: null, error: 'timeout' })
      if (message.includes('ENOTFOUND')) return resolve({ status: null, error: 'DNS' })
      if (/certificate|TLS|SSL|EPROTO/u.test(message)) return resolve({ status: null, error: 'TLS' })
      resolve({ status: null, error: message })
    })
    req.end()
  })
}

const failures = []
for (const endpoint of ENDPOINTS) {
  const result = await probe(endpoint.url)
  const status = result.status
  const alive = status === 200 || (status !== null && status >= 400 && status !== 404 && status !== 410)
  const verdict = alive ? 'ALIVE' : 'FAIL'
  console.log(`${verdict} ${String(status ?? result.error)} ${endpoint.name} ${endpoint.url}`)
  if (!alive) failures.push(`${endpoint.name}: ${String(status ?? result.error)}`)
}

if (failures.length > 0) {
  console.error(`\nendpoint liveness failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`\nendpoint liveness passed: ${ENDPOINTS.length} endpoint(s) alive`)
