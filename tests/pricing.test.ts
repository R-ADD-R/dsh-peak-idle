import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { BUNDLED_PRICING, idleDiscount, isPricingData, priceReduction, PRICE_CACHE_KEY, PRICE_TTL } from '../src/pricing.ts'
import { parseOfficialPricing, createPricingSource } from '../src/pricing-source.ts'
import { createPricingStore } from '../src/pricing-store.ts'
import { createPricingRoute } from '../src/pricing-route.ts'
import { PRICING_ENDPOINT } from '../src/pricing.ts'

const html = await readFile(new URL('./fixtures/pricing.html', import.meta.url), 'utf8')
const now = Date.parse('2026-10-31T10:00:00+08:00')
const fresh = () => structuredClone({ ...BUNDLED_PRICING, checkedAt: now })
const storage = () => {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

describe('official pricing extraction', () => {
  it('reads all 12 prices with official rowspan and colspan labels', () => {
    const data = parseOfficialPricing(html, now)
    assert.deepEqual(data.models, BUNDLED_PRICING.models)
    assert.equal(data.checkedAt, now)
    assert.equal(idleDiscount(data.models[0]), '50%')
  })
  it('updates money values from the page instead of keeping a built-in discount', () => {
    const data = parseOfficialPricing(html.replace('0.02元', '0.03元').replace('13.5元', '12.75元'), now)
    assert.equal(data.models[0].idle.inputHit, 0.03)
    assert.equal(data.models[1].idle.output, 12.75)
    assert.equal(idleDiscount(data.models[0]), null)
  })
  it('rejects missing values, changed units and unrecognized markup', () => {
    for (const page of [html.replace('0.02元', '暂不可用'), html.replace('0.02元', '0.02美元'), html.replace('百万tokens输出', '千tokens输出'), '<html>Blocked</html>']) {
      assert.throws(() => parseOfficialPricing(page, now))
    }
  })
  it('validates all model prices before trusting host or cache data', () => {
    const data = fresh()
    assert.ok(isPricingData(data))
    data.models[0].idle.inputHit = NaN
    assert.ok(!isPricingData(data))
    assert.ok(!isPricingData({ ...fresh(), source: 'https://example.com' }))
    assert.ok(!isPricingData({ ...fresh(), models: [fresh().models[0], fresh().models[0]] }))
  })
  it('only displays one reduction badge when all token categories and models agree', () => {
    const data = fresh()
    assert.equal(priceReduction(data), 50)
    data.models[1].idle.output = 14
    assert.equal(priceReduction(data), null)
    for (const model of data.models) {
      for (const key of ['inputHit', 'inputMiss', 'output'] as const) model.idle[key] = model.peak[key] * 0.75
    }
    assert.equal(priceReduction(data), 25)
  })
})

describe('host price refresh', () => {
  it('deduplicates network requests and caches only complete successful parses', async () => {
    let calls = 0, time = now, body = html
    const source = createPricingSource({ now: () => time, fetch: async (url, init) => {
      calls++
      assert.equal(String(url), BUNDLED_PRICING.source)
      assert.equal(init?.credentials, 'omit')
      return new Response(body, { headers: { 'content-type': 'text/html' } })
    } })
    const [a, b] = await Promise.all([source.load(), source.load()])
    assert.equal(calls, 1); assert.equal(a, b)
    await source.load(true); assert.equal(calls, 1)
    time += PRICE_TTL + 1
    body = html.replace('>4元<', '>5元<')
    assert.equal((await source.load()).models[0].idle.output, 5)
    assert.equal(calls, 2)
    time += PRICE_TTL + 1; body = '<html>maintenance</html>'
    await assert.rejects(source.load())
    source.dispose()
    await assert.rejects(source.load())
  })
  it('bounds response sizes and rejects non-page responses', async () => {
    for (const response of [new Response('no', { status: 403 }), new Response('{}', { headers: { 'content-type': 'application/json' } }), new Response('x'.repeat(1_000_001), { headers: { 'content-type': 'text/html' } })]) {
      const source = createPricingSource({ now: () => now, fetch: async () => response })
      await assert.rejects(source.load())
      source.dispose()
    }
  })
})

describe('price cache and lifecycle', () => {
  it('persists a successful official update and survives a later offline refresh', async () => {
    const cache = storage()
    let online = true
    const store = createPricingStore({ now: () => now, storage: cache, load: async () => {
      if (!online) throw new Error('offline')
      const data = fresh(); data.models[0].idle.output = 3.5; return data
    } })
    assert.equal(store.getSnapshot().origin, 'bundled')
    await store.refresh()
    assert.equal(store.getSnapshot().origin, 'live')
    assert.ok(cache.values.has(PRICE_CACHE_KEY))
    const cached = store.getSnapshot().data
    online = false; await store.refresh(true)
    assert.equal(store.getSnapshot().data, cached)
    assert.ok(store.getSnapshot().error)
    const restored = createPricingStore({ now: () => now, storage: cache, load: async () => { throw new Error('offline') } })
    assert.equal(restored.getSnapshot().origin, 'cached')
    assert.equal(restored.getSnapshot().data.models[0].idle.output, 3.5)
  })
  it('deduplicates client refreshes and ignores late results after unload', async () => {
    let complete!: (data: unknown) => void, signal!: AbortSignal, calls = 0
    const store = createPricingStore({ now: () => now, load: async (_, currentSignal) => {
      calls++; signal = currentSignal
      return new Promise(resolve => { complete = resolve })
    } })
    const a = store.refresh(), b = store.refresh(true)
    assert.equal(a, b)
    await Promise.resolve(); assert.equal(calls, 1)
    let updates = 0; store.subscribe(() => updates++)
    store.dispose(); assert.ok(signal.aborted)
    complete(fresh()); await a
    assert.equal(updates, 0)
    assert.equal(store.getSnapshot().origin, 'bundled')
  })
  it('does not promote malformed or older data to live prices', async () => {
    for (const data of [{ ...fresh(), currency: 'USD' }, { ...fresh(), checkedAt: BUNDLED_PRICING.checkedAt - 1 }, { ...fresh(), checkedAt: now + 3600000 }]) {
      const store = createPricingStore({ now: () => now, load: async () => data })
      await store.refresh()
      assert.equal(store.getSnapshot().origin, 'bundled')
      assert.ok(store.getSnapshot().error)
    }
  })
  it('ignores invalid cache and retries synchronous errors without getting stuck', async () => {
    const cache = storage(); cache.setItem(PRICE_CACHE_KEY, '{broken')
    let calls = 0
    const store = createPricingStore({ now: () => now, storage: cache, load: () => { calls++; throw new Error('offline') } })
    await store.refresh(true); await store.refresh(true)
    assert.equal(calls, 2)
    assert.ok(!store.getSnapshot().loading)
  })
})

describe('DSH carrier route', () => {
  it('uses an exact feature route and returns the original RPC correlation id', async () => {
    let forced = false
    const route = createPricingRoute({ load: async force => { forced = force; return fresh() } })
    assert.equal(route.path, `/api/${PRICING_ENDPOINT}`)
    const response = await route.fetch(new Request(`http://localhost${route.path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', method: PRICING_ENDPOINT, rpcId: 'test-rpc', payload: { force: true } }),
    }))
    const result = await response.json()
    assert.equal(forced, true)
    assert.equal(result.type, 'server-response')
    assert.equal(result.rpcId, 'test-rpc')
    assert.equal(result.result.ok, true)
    assert.ok(isPricingData(result.result.value))
  })
  it('rejects malformed envelopes and preserves the error result contract', async () => {
    const route = createPricingRoute({ load: async () => { throw new Error('offline') } })
    const make = (body: unknown) => new Request(`http://localhost${route.path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    assert.equal((await route.fetch(make({}))).status, 400)
    const response = await route.fetch(make({ type: 'client-request', method: PRICING_ENDPOINT, rpcId: 'retry-rpc', payload: {} }))
    const result = await response.json()
    assert.equal(result.rpcId, 'retry-rpc')
    assert.equal(result.result.ok, false)
    assert.equal(result.result.error.code, 'dsh-fg/pricing-unavailable')
  })
})
