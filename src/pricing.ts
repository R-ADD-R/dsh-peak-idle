import { PRICING_URL } from './period.ts'

export const PRICING_ENDPOINT = 'dsh-fg/pricing'
export const PRICE_TTL = 6 * 60 * 60 * 1000
export const PRICE_CACHE_KEY = 'dsh-fg.pricing.v1'
export type PriceKind = 'inputHit' | 'inputMiss' | 'output'
export const PRICE_ROWS: readonly { key: PriceKind; label: string; explanation: string }[] = [
  { key: 'inputHit', label: '输入 · 缓存命中', explanation: '重复输入中命中 DeepSeek 上下文缓存的部分，按此单价计费。' },
  { key: 'inputMiss', label: '输入 · 缓存未命中', explanation: '未命中上下文缓存的输入 token，按此单价计费。' },
  { key: 'output', label: '输出', explanation: '模型生成的输出 token，按此单价计费。' },
]
export type TokenPrices = Record<PriceKind, number>
export interface ModelPricing {
  id: string
  name: string
  version: string
  idle: TokenPrices
  peak: TokenPrices
}
export interface PricingData {
  source: typeof PRICING_URL
  checkedAt: number
  currency: 'CNY'
  unit: 1000000
  models: ModelPricing[]
}

/** Verified against the official Chinese pricing page on 2026-10-31. */
export const BUNDLED_PRICING: PricingData = {
  source: PRICING_URL, checkedAt: Date.parse('2026-10-31T00:44:11+08:00'), currency: 'CNY', unit: 1000000,
  models: [
    { id: 'deepseek-flash', name: 'Flash', version: 'DeepSeek-V4.1-Flash-1017',
      idle: { inputHit: 0.02, inputMiss: 1, output: 4 }, peak: { inputHit: 0.04, inputMiss: 2, output: 8 } },
    { id: 'deepseek-v4-pro', name: 'Pro', version: 'DeepSeek-V4-Pro-0813',
      idle: { inputHit: 0.15, inputMiss: 4.5, output: 13.5 }, peak: { inputHit: 0.3, inputMiss: 9, output: 27 } },
  ],
}

export function isPricingData(value: unknown): value is PricingData {
  if (!value || typeof value !== 'object') return false
  const data = value as PricingData
  if (data.source !== PRICING_URL || data.currency !== 'CNY' || data.unit !== 1000000
    || !Number.isFinite(data.checkedAt) || data.checkedAt <= 0 || !Array.isArray(data.models)
    || !data.models.length || data.models.length > 16) return false
  const ids = new Set<string>()
  return data.models.every(model => {
    if (!model || typeof model.id !== 'string' || !/^deepseek-[a-z0-9.-]+$/.test(model.id)
      || ids.has(model.id) || typeof model.name !== 'string' || !model.name.length || model.name.length > 80
      || typeof model.version !== 'string' || model.version.length > 120) return false
    ids.add(model.id)
    return ['idle', 'peak'].every(period => {
      const prices = model[period as 'idle' | 'peak']
      return prices && PRICE_ROWS.every(({ key }) => typeof prices[key] === 'number' && Number.isFinite(prices[key]) && prices[key] >= 0 && prices[key] < 1000000)
    })
  })
}

export function formatPrice(price: number): string {
  return `¥${price.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
}

export function idleDiscount(model: ModelPricing): string | null {
  const ratios = PRICE_ROWS.map(({ key }) => model.peak[key] > 0 ? model.idle[key] / model.peak[key] : NaN)
  return ratios.every(ratio => Number.isFinite(ratio) && Math.abs(ratio - ratios[0]) < 0.00001)
    ? `${Number((ratios[0] * 100).toFixed(2))}%` : null
}

/** A universal badge is shown only when every published model has the same reduction. */
export function priceReduction(data: PricingData): number | null {
  const discounts = data.models.map(idleDiscount)
  if (!discounts[0] || !discounts.every(value => value === discounts[0])) return null
  const reduction = Number((100 - parseFloat(discounts[0])).toFixed(2))
  return reduction > 0 ? reduction : null
}
