import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as jsx from 'react/jsx-runtime'

describe('DSH distributable', () => {
  it('registers a lazy factory using the real DSH module wire format', async () => {
    let registration: { id: string; factory: (require: (id: string) => unknown) => Record<string, unknown> } | undefined
    const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
    vm.runInNewContext(source, { window: { __ModuleLoader__: { load: (entry: typeof registration) => { registration = entry } } } })
    assert.equal(registration?.id, 'dsh-fg')
    const requested: string[] = []
    const modules: Record<string, unknown> = { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsx }
    const plugin = registration!.factory(id => { requested.push(id); assert.ok(id in modules, `unexpected external: ${id}`); return modules[id] })
    assert.equal(typeof plugin.apply, 'function')
    assert.deepEqual(Array.from(plugin.inject as string[]), ['slots', 'connection'])
    assert.ok(requested.includes('react'))
    assert.ok(!source.includes('fetch('), 'client must use the DSH carrier rather than browser cross-origin requests')
  })

  it('ships a resolvable host entry and activates its bundle patch', async () => {
    const root = new URL('../', import.meta.url)
    const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
    const host = await import(new URL(manifest.exports['.'], root).href)
    assert.equal(host.name, manifest.name)
    assert.equal(typeof host.apply, 'function')
    const patch = await readFile(new URL(manifest.dsh.bundle.patch, root), 'utf8')
    assert.match(patch, /name: dsh-fg/)
    await readFile(new URL(manifest.exports['./client'], root))
    for (const language of ['en', 'zh']) {
      const locale = JSON.parse(await readFile(new URL(`locale/${language}.json`, root), 'utf8'))
      assert.ok(locale.meta.title && locale.meta.description, 'DSH display metadata must use meta.title')
    }
  })
})
