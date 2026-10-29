import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const manifest = JSON.parse(await read('package.json'))
assert.equal(manifest.name, 'dsh-fg')
assert.equal(manifest.private, undefined)
assert.equal(manifest.publishConfig.access, 'public')
assert.equal(manifest.publishConfig.registry, 'https://registry.npmjs.org/')
assert.ok(manifest.repository.url.endsWith('/R-ADD-R/dsh-peak-idle.git'))
assert.equal(manifest.dsh.client.platform, 'web')
assert.ok(manifest.engines.dsh)
assert.match(await read(manifest.dsh.bundle.patch), /name: dsh-fg/)
assert.match(await read('lib/client.js'), /window\.__ModuleLoader__\.load/)
assert.match(await read('lib/client.js'), /dsh-fg__trigger/)
assert.ok(manifest.files.includes('lib'))
for (const language of ['en', 'zh']) {
  const locale = JSON.parse(await read(`locale/${language}.json`))
  assert.ok(locale.meta.title && locale.meta.description)
}
const readme = await read('README.md')
assert.ok(!/D:\\ADD|C:\\Users|\.reference\/|\.reference\\/.test(readme), 'Public README contains a local workspace path')
assert.match(readme, /--profile desktop add github:R-ADD-R\/dsh-peak-idle/)
await read(manifest.icon)
await read('LICENSE')
console.log(`Public package verified: ${manifest.name}@${manifest.version}`)
