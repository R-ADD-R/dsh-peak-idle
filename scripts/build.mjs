import { build } from 'esbuild'
import { readFile, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
await mkdir(new URL('../lib/', import.meta.url), { recursive: true })
// Styles are embedded in the factory and removed with the plugin effect.
await rm(new URL('../lib/client.css', import.meta.url), { force: true })
await build({
  entryPoints: ['src/index.ts'], outfile: 'lib/index.js', platform: 'node', format: 'esm',
  bundle: true, target: 'node22', legalComments: 'none',
})
await build({
  entryPoints: ['src/client.ts'], outfile: 'lib/client.js', platform: 'browser', format: 'cjs',
  bundle: true, target: 'es2022', jsx: 'automatic', minify: true, legalComments: 'none',
  external: ['react', 'react/*', 'react-dom', 'react-dom/*'],
  banner: { js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(manifest.name)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;` },
  footer: { js: 'return module.exports; } });' },
  plugins: [{
    name: 'inline-css',
    setup(builder) {
      builder.onLoad({ filter: /\.css\?inline$/ }, async args => ({
        contents: await readFile(args.path.replace(/\?inline$/, ''), 'utf8'), loader: 'text',
      }))
      builder.onResolve({ filter: /\.css\?inline$/ }, args => ({
        path: resolve(args.resolveDir, args.path),
      }))
    },
  }],
})
console.log(`Built ${manifest.name}@${manifest.version}: lib/index.js + DSH lazy client bundle`)
