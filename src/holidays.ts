/**
 * 2026 official holiday breaks, including the adjacent adjusted days off.
 * Weekends remain idle even when designated as a make-up working day.
 * Source: https://www.gov.cn/zhengce/content/202511/content_7047090.htm
 * Check new annual calendars before adding a supported year.
 */
export const CALENDAR_YEARS: ReadonlySet<number> = new Set([2026])

export const HOLIDAY_BREAKS = [
  { start: '2026-01-01', end: '2026-01-03', name: '元旦' },
  { start: '2026-02-15', end: '2026-02-23', name: '春节' },
  { start: '2026-04-04', end: '2026-04-06', name: '清明节' },
  { start: '2026-05-01', end: '2026-05-05', name: '劳动节' },
  { start: '2026-06-19', end: '2026-06-21', name: '端午节' },
  { start: '2026-09-25', end: '2026-09-27', name: '中秋节' },
  { start: '2026-10-01', end: '2026-10-07', name: '国庆节' },
] as const

export function holidayAt(dateKey: string): string | undefined {
  return HOLIDAY_BREAKS.find(item => dateKey >= item.start && dateKey <= item.end)?.name
}
