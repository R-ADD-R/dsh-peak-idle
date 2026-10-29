import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createPeriodStore, PREFERENCES_KEY } from '../src/store.ts'

const at = (time: string) => Date.parse(`2026-10-28T${time}+08:00`)

describe('shared indicator clock and reminders', () => {
  it('warns once within five minutes, then announces the actual transition', () => {
    let time = at('17:54:59')
    const store = createPeriodStore({ now: () => time })
    assert.equal(store.getSnapshot().notice, null)
    time = at('17:55:00'); store.refresh()
    assert.match(store.getSnapshot().notice?.message ?? '', /5 分钟内进入空闲期/)
    const id = store.getSnapshot().notice?.id
    time = at('17:55:09'); store.refresh()
    assert.equal(store.getSnapshot().notice, null)
    time = at('17:59:59'); store.refresh()
    assert.equal(store.getSnapshot().notice, null)
    time = at('18:00:00'); store.refresh()
    assert.equal(store.getSnapshot().info.kind, 'idle')
    assert.notEqual(store.getSnapshot().notice?.id, id)
    assert.match(store.getSnapshot().notice?.message ?? '', /已进入空闲期/)
  })

  it('recomputes from wall-clock time after the device wakes', () => {
    let time = at('10:00:00')
    const store = createPeriodStore({ now: () => time })
    time = Date.parse('2026-11-02T20:00:00+08:00'); store.refresh()
    assert.equal(store.getSnapshot().info.kind, 'idle')
    assert.equal(store.getSnapshot().info.nextAt, Date.parse('2026-11-03T09:00:00+08:00'))
  })

  it('updates the icon with reminders disabled and persists the preference', () => {
    let time = at('17:54:00')
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    const store = createPeriodStore({ now: () => time, storage })
    store.setReminders(false)
    time = at('18:00:00'); store.refresh()
    assert.equal(store.getSnapshot().info.kind, 'idle')
    assert.equal(store.getSnapshot().notice, null)
    assert.equal(createPeriodStore({ now: () => time, storage }).getSnapshot().reminders, false)
    assert.match(values.get(PREFERENCES_KEY)!, /false/)
  })

  it('survives unavailable or malformed preference storage', () => {
    const blocked = createPeriodStore({ storage: { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } } })
    assert.equal(blocked.getSnapshot().reminders, true)
    assert.doesNotThrow(() => blocked.setReminders(false))
    assert.equal(createPeriodStore({ storage: { getItem: () => '{broken', setItem: () => {} } }).getSnapshot().reminders, true)
  })

  it('has stable snapshots between changes and supports subscription disposal', () => {
    const store = createPeriodStore()
    assert.equal(store.getSnapshot(), store.getSnapshot())
    let calls = 0
    const stop = store.subscribe(() => calls++)
    store.refresh(); assert.equal(calls, 1)
    stop(); store.refresh(); assert.equal(calls, 1)
  })

  it('cleans up its timer and event listeners on unload', () => {
    const events = new EventTarget()
    const store = createPeriodStore({ eventTarget: events })
    let calls = 0
    store.subscribe(() => calls++)
    store.start(); store.start()
    assert.equal(calls, 1)
    events.dispatchEvent(new Event('focus')); assert.equal(calls, 2)
    store.dispose()
    events.dispatchEvent(new Event('focus')); assert.equal(calls, 2)
  })
})
