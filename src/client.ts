import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { PeriodIndicator, PeriodNotice } from './Indicator.tsx'
import { createPeriodStore } from './store.ts'
import { createPricingStore } from './pricing-store.ts'
import { PRICING_ENDPOINT } from './pricing.ts'
import stylesheet from './styles.css?inline'

export const name = 'dsh-fg'
export const inject = ['slots', 'connection']

export function apply(ctx: Context): void {
  let storage: Storage | undefined
  try { storage = window.localStorage } catch { /* The indicator also works without persistent storage. */ }
  const store = createPeriodStore({ storage, eventTarget: window })
  const connection = ctx.get('connection') as unknown as ConnectionHandle
  const pricing = createPricingStore({ storage, eventTarget: window, load: async (force, signal) => {
    const result = await connection.rpc.call('/api', PRICING_ENDPOINT, { force }, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  } })
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.dshFg = 'styles'
    style.textContent = stylesheet
    document.head.append(style)
    store.start()
    pricing.start()
    return () => { store.dispose(); pricing.dispose(); style.remove() }
  })

  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right', id: 'dsh-fg', order: 10,
    inject: () => ({ hooks: { period: store, pricing }, setReminders: store.setReminders, refreshPrices: pricing.refresh }),
  }, PeriodIndicator))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'dsh-fg-notice', order: 100,
    inject: () => ({ hooks: { period: store }, dismissNotice: store.dismissNotice }),
  }, PeriodNotice))
}
