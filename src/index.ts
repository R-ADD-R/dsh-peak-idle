import type { Context } from '@deepseek-ai/cordis'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import { createPricingRoute } from './pricing-route.ts'
import { createPricingSource } from './pricing-source.ts'

export const name = 'dsh-fg'
export const inject = ['connection']

/** Use DSH's authenticated carrier so desktop IPC and Web share the same path. */
export function apply(ctx: Context): void {
  const source = createPricingSource()
  const connection = ctx.get('connection') as HostConnectionHandle
  ctx.effect(() => () => source.dispose())
  ctx.effect(() => connection.fetch.register(createPricingRoute(source)))
}
