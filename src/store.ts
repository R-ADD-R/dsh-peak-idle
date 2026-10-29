import { getPeriodInfo, PERIOD_LABEL, type PeriodInfo } from './period.ts'

export const PREFERENCES_KEY = 'dsh-fg.preferences.v1'
export interface PeriodNotice { id: string; kind: 'peak' | 'idle'; message: string }
export interface PeriodSnapshot {
  info: PeriodInfo
  reminders: boolean
  notice: PeriodNotice | null
}

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface StoreOptions { now?: () => number; storage?: StorageLike; eventTarget?: EventTarget }

/** One clock and one notice source per plugin, shared by every conversation. */
export function createPeriodStore(options: StoreOptions = {}) {
  const now = options.now ?? Date.now
  const listeners = new Set<() => void>()
  let reminders = true
  try {
    const saved = JSON.parse(options.storage?.getItem(PREFERENCES_KEY) ?? 'null')
    if (typeof saved?.reminders === 'boolean') reminders = saved.reminders
  } catch { /* Private-mode or invalid storage must not disable the indicator. */ }
  let snapshot: PeriodSnapshot = { info: getPeriodInfo(now()), reminders, notice: null }
  let timer: ReturnType<typeof setTimeout> | undefined
  let noticeExpires = 0
  let warnedAt: number | null = null
  let started = false
  const publish = () => { for (const listener of listeners) listener() }

  const refresh = () => {
    const at = now()
    const info = getPeriodInfo(at)
    let notice = snapshot.notice
    if (at >= noticeExpires) notice = null
    if (snapshot.reminders) {
      if (info.kind !== snapshot.info.kind && info.kind !== 'unverified') {
        notice = {
          id: `switch-${info.kind}-${info.beijing.dateKey}-${info.beijing.hour}`,
          kind: info.kind,
          message: info.kind === 'idle' ? '已进入空闲期，token 单价为繁忙期的 50%。' : '已进入繁忙期，当前按繁忙期 token 单价计费。',
        }
        noticeExpires = at + 8_000
      } else if (info.nextKind !== 'unverified' && info.nextAt - at <= 300_000 && warnedAt !== info.nextAt) {
        warnedAt = info.nextAt
        notice = {
          id: `soon-${info.nextAt}`, kind: info.nextKind,
          message: `即将在 5 分钟内进入${PERIOD_LABEL[info.nextKind]}。${info.nextKind === 'idle' ? 'token 单价将降至繁忙期的 50%。' : 'token 单价将切换为繁忙期价格。'}`,
        }
        noticeExpires = at + 8_000
      }
    }
    snapshot = { ...snapshot, info, notice }
    publish()
  }

  const schedule = () => {
    // Align to wall-clock seconds; a sleeping tab always recomputes from Date.now().
    timer = setTimeout(() => { refresh(); if (started) schedule() }, 1000 - (now() % 1000))
  }
  const wake = () => { if (started) refresh() }
  const storageChanged = (event: Event) => {
    const change = event as StorageEvent
    if (change.key !== PREFERENCES_KEY) return
    try {
      const value = JSON.parse(change.newValue ?? 'null')
      if (typeof value?.reminders === 'boolean') {
        snapshot = { ...snapshot, reminders: value.reminders, notice: null }
        publish()
      }
    } catch { /* Ignore malformed values written by another tab. */ }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    refresh,
    setReminders: (enabled: boolean) => {
      snapshot = { ...snapshot, reminders: enabled, notice: enabled ? snapshot.notice : null }
      try { options.storage?.setItem(PREFERENCES_KEY, JSON.stringify({ reminders: enabled })) } catch { /* Session preference still works. */ }
      publish()
    },
    dismissNotice: () => { snapshot = { ...snapshot, notice: null }; publish() },
    start: () => {
      if (started) return
      started = true
      refresh()
      schedule()
      options.eventTarget?.addEventListener('focus', wake)
      options.eventTarget?.addEventListener('pageshow', wake)
      options.eventTarget?.addEventListener('visibilitychange', wake)
      options.eventTarget?.addEventListener('storage', storageChanged)
    },
    dispose: () => {
      started = false
      clearTimeout(timer)
      options.eventTarget?.removeEventListener('focus', wake)
      options.eventTarget?.removeEventListener('pageshow', wake)
      options.eventTarget?.removeEventListener('visibilitychange', wake)
      options.eventTarget?.removeEventListener('storage', storageChanged)
      listeners.clear()
    },
  }
}

export type PeriodStore = ReturnType<typeof createPeriodStore>
