import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { PeriodIndicator, PeriodNotice } from './Indicator.tsx'
import { createPeriodStore } from './store.ts'
import stylesheet from './styles.css?inline'

export const name = 'dsh-fg'
export const inject = ['slots']

export function apply(ctx: Context): void {
  let storage: Storage | undefined
  try { storage = window.localStorage } catch { /* The indicator also works without persistent storage. */ }
  const store = createPeriodStore({ storage, eventTarget: window })
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.dshFg = 'styles'
    style.textContent = stylesheet
    document.head.append(style)
    store.start()
    return () => { store.dispose(); style.remove() }
  })

  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right', id: 'dsh-fg', order: 10,
    inject: () => ({ hooks: { period: store }, setReminders: store.setReminders }),
  }, PeriodIndicator))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'dsh-fg-notice', order: 100,
    inject: () => ({ hooks: { period: store }, dismissNotice: store.dismissNotice }),
  }, PeriodNotice))
}
