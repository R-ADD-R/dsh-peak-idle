import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { beijingTime, classify, dayWindows, formatCountdown, formatNextTime, getPeriodInfo } from '../src/period.ts'

const at = (time: string) => Date.parse(time.includes('+') || time.endsWith('Z') ? time : `${time}+08:00`)

describe('DeepSeek 官方峰谷时段（北京时间）', () => {
  for (const [time, expected] of [
    ['2026-10-28T08:59:59.999', 'idle'], ['2026-10-28T09:00:00', 'peak'],
    ['2026-10-28T11:59:59.999', 'peak'], ['2026-10-28T12:00:00', 'idle'],
    ['2026-10-28T13:59:59.999', 'idle'], ['2026-10-28T14:00:00', 'peak'],
    ['2026-10-28T17:59:59.999', 'peak'], ['2026-10-28T18:00:00', 'idle'],
    ['2026-10-28T23:59:59.999', 'idle'], ['2026-10-29T00:00:00', 'idle'],
    ['2026-10-31T10:00:00', 'idle'], ['2026-11-01T15:00:00', 'idle'],
    ['2026-02-14T10:00:00', 'idle'], // Saturday designated as a make-up workday.
    ['2026-10-10T15:00:00', 'idle'], // Saturday designated as a make-up workday.
    ['2026-10-01T10:00:00', 'idle'], ['2026-02-23T10:00:00', 'idle'],
    ['2026-04-06T10:00:00', 'idle'], ['2026-05-05T15:00:00', 'idle'],
    ['2026-06-19T10:00:00', 'idle'], ['2026-09-25T15:00:00', 'idle'],
  ] as const) {
    it(`${time} → ${expected}`, () => assert.equal(classify(at(time)).kind, expected))
  }

  it('does not depend on the device timezone', () => {
    assert.equal(classify(at('2026-10-28T01:00:00Z')).kind, 'peak')
    assert.equal(classify(at('2026-10-28T05:00:00Z')).kind, 'idle')
    assert.equal(beijingTime(at('2026-10-28T20:30:00Z')).dateKey, '2026-10-29')
  })

  it('skips the weekend in the next-switch countdown', () => {
    const info = getPeriodInfo(at('2026-10-30T18:00:00'))
    assert.equal(info.nextAt, at('2026-11-02T09:00:00'))
    assert.equal(info.nextKind, 'peak')
    assert.equal(formatNextTime(info), '11 月 2 日 09:00')
  })

  it('skips the complete National Day break', () => {
    const info = getPeriodInfo(at('2026-09-30T18:00:00'))
    assert.equal(info.nextAt, at('2026-10-08T09:00:00'))
  })

  it('skips both the spring festival and its adjacent weekend', () => {
    assert.equal(getPeriodInfo(at('2026-02-13T18:00:00')).nextAt, at('2026-02-24T09:00:00'))
  })

  it('finds exact same-day and next-day boundaries', () => {
    const noon = getPeriodInfo(at('2026-10-28T12:00:00'))
    assert.equal(noon.nextAt, at('2026-10-28T14:00:00'))
    assert.equal(formatNextTime(noon), '今天 14:00')
    assert.equal(formatNextTime(getPeriodInfo(at('2026-10-28T20:00:00'))), '明天 09:00')
  })

  it('marks unsupported holiday calendars rather than claiming a peak price', () => {
    assert.equal(classify(at('2027-01-04T10:00:00')).kind, 'unverified')
    assert.equal(classify(at('2027-01-04T20:00:00')).kind, 'idle')
    assert.equal(classify(at('2027-01-02T10:00:00')).kind, 'idle')
    assert.equal(getPeriodInfo(at('2026-12-31T18:00:00')).nextKind, 'unverified')
  })

  it('renders an all-idle timeline for holidays and weekends', () => {
    assert.deepEqual(dayWindows(at('2026-10-01T10:00:00')), [{ start: 0, end: 24, kind: 'idle' }])
    assert.equal(dayWindows(at('2026-10-28T10:00:00')).filter(item => item.kind === 'peak').length, 2)
  })

  it('formats long and subsecond countdowns without drifting or negative values', () => {
    assert.equal(formatCountdown(73 * 3600_000 + 2_000), '73:00:02')
    assert.equal(formatCountdown(1), '00:00:01')
    assert.equal(formatCountdown(-10), '00:00:00')
  })

  it('rejects invalid clock values explicitly', () => {
    assert.throws(() => getPeriodInfo(NaN), RangeError)
    assert.throws(() => beijingTime(Infinity), RangeError)
  })
})
