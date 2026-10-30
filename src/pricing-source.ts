import { PRICING_URL } from './period.ts'
import { isPricingData, PRICE_ROWS, PRICE_TTL, type PricingData } from './pricing.ts'

function text(html: string): string {
  return html.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '').replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)))
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g, entity => ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" })[entity]!)
    .replace(/\s+/g, ' ').trim()
}

/** Expand HTML rowspan / colspan before reading any money values by their labels. */
function tableGrid(table: string): string[][] {
  const grid: string[][] = []
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  if (rows.length > 150) throw new Error('官网价格表过大')
  rows.forEach((row, r) => {
    grid[r] ??= []
    let c = 0
    for (const cell of row[1].matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)) {
      while (grid[r][c] !== undefined) c++
      const span = (key: string) => {
        const match = new RegExp(`${key}\\s*=\\s*["']?(\\d+)`, 'i').exec(cell[1])
        const count = match ? Number(match[1]) : 1
        if (count < 1 || count > 32) throw new Error('官网价格表跨度无法识别')
        return count
      }
      const height = span('rowspan'), width = span('colspan')
      const value = text(cell[2])
      for (let y = r; y < r + height; y++) {
        grid[y] ??= []
        for (let x = c; x < c + width; x++) grid[y][x] = value
      }
      c += width
    }
  })
  return grid
}

export function parseOfficialPricing(html: string, checkedAt = Date.now()): PricingData {
  if (html.length > 1_000_000) throw new Error('官网页面过大')
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)]
  const grid = tables.map(table => tableGrid(table[0])).find(rows => rows.some(row => row[0] === '模型'))
  if (!grid) throw new Error('官网价格表结构已变化')
  const header = grid.find(row => row[0] === '模型')!
  const version = grid.find(row => row[0] === '模型版本')
  const modelColumns = header.flatMap((id, column) => /^deepseek-[a-z0-9.-]+$/.test(id) ? [{ id, column }] : [])
  if (!modelColumns.length) throw new Error('无法识别官网模型列表')
  const compact = (value: string) => value.replace(/\s/g, '')
  const data: PricingData = {
    source: PRICING_URL, checkedAt, currency: 'CNY', unit: 1000000,
    models: modelColumns.map(({ id, column }) => {
      const readPrices = (period: '空闲' | '高峰') => Object.fromEntries(PRICE_ROWS.map(({ key }) => {
        const row = grid.find(row => {
          const labels = row.slice(0, column).map(compact)
          return labels.some(label => label.startsWith(period) && label.includes('时段')) && labels.some(label =>
            key === 'output' ? label.includes('百万tokens输出')
              : label.includes('百万tokens输入') && label.includes(key === 'inputHit' ? '缓存命中' : '缓存未命中'))
        })
        const match = row && /^(\d+(?:\.\d+)?)\s*元$/.exec(row[column] ?? '')
        if (!match) throw new Error('官网单价或计价单位已变化')
        return [key, Number(match[1])]
      })) as PricingData['models'][number]['idle']
      return {
        id, name: /flash/i.test(id) ? 'Flash' : /pro/i.test(id) ? 'Pro' : id.replace(/^deepseek-/, ''),
        version: version?.[column] ?? id, idle: readPrices('空闲'), peak: readPrices('高峰'),
      }
    }),
  }
  if (!isPricingData(data)) throw new Error('官网定价数据不完整')
  return data
}

/** One bounded, credential-free public-page fetch shared by all host callers. */
export function createPricingSource(options: { fetch?: typeof fetch; now?: () => number } = {}) {
  const request = options.fetch ?? fetch
  const now = options.now ?? Date.now
  let cached: PricingData | undefined
  let pending: Promise<PricingData> | undefined
  let lastAttempt = -Infinity
  let controller: AbortController | undefined
  let disposed = false
  return {
    load(force = false): Promise<PricingData> {
      if (disposed) return Promise.reject(new Error('插件已关闭'))
      if (pending) return pending
      if (cached && now() - cached.checkedAt < (force ? 30_000 : PRICE_TTL)) return Promise.resolve(cached)
      if (now() - lastAttempt < 30_000) return Promise.reject(new Error('请稍后重试官网同步'))
      lastAttempt = now()
      controller = new AbortController()
      const timeout = setTimeout(() => controller?.abort(), 12_000)
      const signal = controller.signal
      pending = (async () => {
        const response = await request(PRICING_URL, { signal, headers: { accept: 'text/html' }, credentials: 'omit', redirect: 'error' })
        if (!response.ok) throw new Error(`官网暂时无法访问（${response.status}）`)
        if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('官网未返回定价页面')
        if (Number(response.headers.get('content-length')) > 1_000_000) throw new Error('官网页面过大')
        const reader = response.body?.getReader()
        if (!reader) throw new Error('官网页面为空')
        const decoder = new TextDecoder()
        let html = '', length = 0
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            length += value.length
            if (length > 1_000_000) throw new Error('官网页面过大')
            html += decoder.decode(value, { stream: true })
          }
          html += decoder.decode()
        } finally { await reader.cancel() }
        if (signal.aborted || disposed) throw new Error('官网同步已取消')
        cached = parseOfficialPricing(html, now())
        return cached
      })().finally(() => { clearTimeout(timeout); pending = undefined })
      return pending
    },
    dispose() { disposed = true; controller?.abort() },
  }
}
