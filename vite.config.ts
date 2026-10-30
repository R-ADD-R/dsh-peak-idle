import { defineConfig } from 'vite'
import { createPricingSource } from './src/pricing-source.ts'
export default defineConfig({
  plugins: [{ name: 'official-pricing-preview', configureServer(server) {
    const pricing = createPricingSource()
    server.httpServer?.once('close', () => pricing.dispose())
    server.middlewares.use(async (request, response, next) => {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (url.pathname !== '/__dsh-fg/pricing') { next(); return }
      response.setHeader('content-type', 'application/json; charset=utf-8')
      response.setHeader('cache-control', 'no-store')
      try { response.end(JSON.stringify(await pricing.load(url.searchParams.get('force') === '1'))) }
      catch { response.statusCode = 502; response.end(JSON.stringify({ error: '官网价格暂时无法同步' })) }
    })
  } }],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: 'preview-dist' },
})
