import { CALENDAR_YEARS, holidayAt } from './holidays.ts'

export const PRICING_URL = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/'
export const BEIJING_OFFSET = 8 * 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

export type PeriodKind = 'peak' | 'idle' | 'unverified'
export type DayReason = 'weekday' | 'weekend' | 'holiday' | 'calendar-unknown'
export type TimeWindow = { start: number; end: number; kind: PeriodKind }
export type PeriodSpan = { startAt: number; endAt: number; kind: PeriodKind }

export interface BeijingTime {
  year: number
  month: number
  day: number
  weekday: number
  hour: number
  minute: number
  second: number
  dateKey: string
  midnight: number
}

export interface PeriodInfo {
  now: number
  kind: PeriodKind
  reason: DayReason
  holiday?: string
  beijing: BeijingTime
  calendarKnown: boolean
  startedAt: number
  nextAt: number
  nextKind: PeriodKind
  windows: readonly TimeWindow[]
}

export const PERIOD_LABEL: Record<PeriodKind, string> = {
  peak: '繁忙期', idle: '空闲期', unverified: '时段待核验',
}

export function beijingTime(at: number): BeijingTime {
  if (!Number.isFinite(at)) throw new RangeError('时间必须是有效的 Unix 毫秒时间戳')
  const date = new Date(at + BEIJING_OFFSET)
  if (!Number.isFinite(date.getTime())) throw new RangeError('时间超出支持范围')
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return {
    year, month, day, dateKey,
    weekday: date.getUTCDay(),
    hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
    midnight: Date.UTC(year, month - 1, day) - BEIJING_OFFSET,
  }
}

export function classify(at: number): {
  kind: PeriodKind; reason: DayReason; holiday?: string; beijing: BeijingTime; calendarKnown: boolean
} {
  const beijing = beijingTime(at)
  const holiday = holidayAt(beijing.dateKey)
  const calendarKnown = CALENDAR_YEARS.has(beijing.year)
  if (holiday) return { kind: 'idle', reason: 'holiday', holiday, beijing, calendarKnown }
  if (beijing.weekday === 0 || beijing.weekday === 6) {
    return { kind: 'idle', reason: 'weekend', beijing, calendarKnown }
  }
  const minutes = beijing.hour * 60 + beijing.minute
  const peakWindow = (minutes >= 540 && minutes < 720) || (minutes >= 840 && minutes < 1080)
  return {
    kind: peakWindow ? (calendarKnown ? 'peak' : 'unverified') : 'idle',
    reason: calendarKnown ? 'weekday' : 'calendar-unknown', beijing, calendarKnown,
  }
}

export function dayWindows(at: number): readonly TimeWindow[] {
  const info = classify(at)
  if (info.reason === 'weekend' || info.reason === 'holiday') return [{ start: 0, end: 24, kind: 'idle' }]
  const daytime: PeriodKind = info.calendarKnown ? 'peak' : 'unverified'
  return [
    { start: 0, end: 9, kind: 'idle' },
    { start: 9, end: 12, kind: daytime },
    { start: 12, end: 14, kind: 'idle' },
    { start: 14, end: 18, kind: daytime },
    { start: 18, end: 24, kind: 'idle' },
  ]
}

/** Find a real classification change, skipping weekends and entire holiday breaks. */
export function getPeriodInfo(now = Date.now()): PeriodInfo {
  const current = classify(now)
  let startedAt = current.beijing.midnight
  findStart: for (let day = 0; day <= 370; day += 1) {
    const midnight = current.beijing.midnight - day * DAY
    for (const hour of [18, 14, 12, 9, 0]) {
      const candidate = midnight + hour * HOUR
      if (candidate <= now && classify(candidate - 1).kind !== current.kind) {
        startedAt = candidate
        break findStart
      }
    }
  }
  for (let day = 0; day <= 370; day += 1) {
    const midnight = current.beijing.midnight + day * DAY
    for (const hour of [0, 9, 12, 14, 18]) {
      const candidate = midnight + hour * HOUR
      if (candidate <= now) continue
      const nextKind = classify(candidate).kind
      if (nextKind !== current.kind) {
        return { ...current, now, startedAt, nextAt: candidate, nextKind, windows: dayWindows(now) }
      }
    }
  }
  throw new RangeError('未找到下一个计费时段')
}

/** A rolling 24-hour horizon, clipped at both ends and merged across idle midnights. */
export function upcomingPeriods(now: number): readonly PeriodSpan[] {
  const endAt = now + DAY
  beijingTime(now)
  beijingTime(endAt)
  const result: PeriodSpan[] = []
  let cursor = now
  while (cursor < endAt) {
    const info = getPeriodInfo(cursor)
    const end = Math.min(info.nextAt, endAt)
    result.push({ startAt: cursor, endAt: end, kind: info.kind })
    cursor = end
  }
  return result
}

export function formatCountdown(milliseconds: number): string {
  const total = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function shortCountdown(milliseconds: number): string {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60_000))
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  return minutes % 60 === 0 ? `${hours} 小时` : `${hours} 小时 ${minutes % 60} 分钟`
}

/** Compact toolbar duration, always a duration rather than an ambiguous clock time. */
export function compactCountdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.ceil(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`
}

export function formatPeriodTime(at: number): string {
  const value = beijingTime(at)
  return `${value.month} 月 ${value.day} 日 ${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`
}

export function formatNextTime(info: PeriodInfo): string {
  const next = beijingTime(info.nextAt)
  const dayDiff = Math.round((next.midnight - info.beijing.midnight) / DAY)
  const day = dayDiff === 0 ? '今天' : dayDiff === 1 ? '明天' : `${next.month} 月 ${next.day} 日`
  return `${day} ${String(next.hour).padStart(2, '0')}:${String(next.minute).padStart(2, '0')}`
}

export function dayDescription(info: PeriodInfo): string {
  if (info.reason === 'holiday') return `${info.holiday}假期 · 全天空闲`
  if (info.reason === 'weekend') return '周末 · 全天空闲'
  return `周${'日一二三四五六'[info.beijing.weekday]} · ${info.beijing.month} 月 ${info.beijing.day} 日`
}
