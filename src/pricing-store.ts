import { BUNDLED_PRICING, isPricingData, PRICE_CACHE_KEY, PRICE_TTL, type PricingData } from './pricing.ts'

export interface PricingSnapshot {
  data: PricingData
  origin: 'bundled' | 'cached' | 'live'
  loading: boolean
  error: string | null
}
export interface PricingStoreOptions {
  load: (force: boolean, signal: AbortSignal) => Promise<unknown>
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void }
  now?: () => number
  eventTarget?: EventTarget
}

export function createPricingStore(options: PricingStoreOptions) {
  const now = options.now ?? Date.now
  let snapshot: PricingSnapshot = { data: BUNDLED_PRICING, origin: 'bundled', loading: false, error: null }
  try {
    const cached: unknown = JSON.parse(options.storage?.getItem(PRICE_CACHE_KEY) ?? 'null')
    if (isPricingData(cached) && cached.checkedAt <= now() + 60_000 && cached.checkedAt >= BUNDLED_PRICING.checkedAt) {
      snapshot = { ...snapshot, data: cached, origin: 'cached' }
    }
  } catch { /* An unavailable browser cache must not hide the verified bundled prices. */ }
  const listeners = new Set<() => void>()
  const publish = () => { for (const listener of listeners) listener() }
  let pending: Promise<void> | undefined
  let lastAttempt = -Infinity
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let started = false, disposed = false
  const refresh = (force = false): Promise<void> => {
    if (disposed) return Promise.resolve()
    if (pending) return pending
    if (!force && (now() - lastAttempt < 300_000 || (snapshot.origin !== 'bundled' && now() - snapshot.data.checkedAt < PRICE_TTL))) return Promise.resolve()
    lastAttempt = now()
    snapshot = { ...snapshot, loading: true, error: null }
    publish()
    controller = new AbortController()
    const signal = controller.signal
    pending = (async () => {
      try {
        const data = await Promise.resolve().then(() => options.load(force, signal))
        if (disposed || signal.aborted) return
        if (!isPricingData(data) || data.checkedAt > now() + 60_000 || data.checkedAt < snapshot.data.checkedAt) throw new Error('官网定价数据无法验证')
        snapshot = { data, origin: 'live', loading: false, error: null }
        try { options.storage?.setItem(PRICE_CACHE_KEY, JSON.stringify(data)) } catch { /* Session data remains available. */ }
      } catch {
        if (disposed || signal.aborted) return
        snapshot = { ...snapshot, loading: false, error: '暂未同步成功，以下为最近核验的价格。' }
      } finally {
        pending = undefined
        if (!disposed) publish()
      }
    })()
    return pending
  }
  const wake = () => { void refresh() }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    refresh,
    start() {
      if (started || disposed) return
      started = true
      wake()
      // A minute heartbeat checks freshness; network reads still occur only after six hours.
      timer = setInterval(wake, 60_000)
      for (const event of ['focus', 'pageshow', 'online']) options.eventTarget?.addEventListener(event, wake)
    },
    dispose() {
      disposed = true
      clearInterval(timer)
      controller?.abort()
      for (const event of ['focus', 'pageshow', 'online']) options.eventTarget?.removeEventListener(event, wake)
      listeners.clear()
    },
  }
}
