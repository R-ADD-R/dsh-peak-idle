import type { ConnectionFetchRoute } from '@deepseek-ai/dsh-client-connection'
import { PRICING_ENDPOINT, type PricingData } from './pricing.ts'

/** An exact route leaves the shared Remote gateway interceptor entirely to DSH. */
export function createPricingRoute(source: { load(force: boolean): Promise<PricingData> }): ConnectionFetchRoute {
  return {
    path: `/api/${PRICING_ENDPOINT}`, methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      // Connection admits only authenticated owner Peers to exact routes, on Web and desktop IPC.
      if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return new Response('Expected JSON', { status: 415 })
      if (Number(request.headers.get('content-length')) > 4096) return new Response('Request too large', { status: 413 })
      let body: unknown
      try { body = await request.json() } catch { return new Response('Invalid JSON', { status: 400 }) }
      if (!body || typeof body !== 'object' || !('type' in body) || body.type !== 'client-request'
        || !('rpcId' in body) || typeof body.rpcId !== 'string' || !body.rpcId.length || body.rpcId.length > 200
        || !('method' in body) || body.method !== PRICING_ENDPOINT) return new Response('Invalid request', { status: 400 })
      const payload = 'payload' in body ? body.payload : null
      const force = typeof payload === 'object' && payload !== null && 'force' in payload && payload.force === true
      try {
        const value = await source.load(force)
        return Response.json({ type: 'server-response', rpcId: body.rpcId, result: { ok: true, value } })
      } catch {
        return Response.json({ type: 'server-response', rpcId: body.rpcId, result: {
          ok: false, error: { code: 'dsh-fg/pricing-unavailable', message: '官网价格暂时无法同步', details: {} },
        } })
      }
    },
  }
}
