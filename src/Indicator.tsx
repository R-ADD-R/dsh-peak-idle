import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { dayDescription, formatCountdown, formatNextTime, PERIOD_LABEL, PRICING_URL, shortCountdown, type PeriodInfo } from './period.ts'
import type { PeriodSnapshot } from './store.ts'
import { Icon } from './icons.tsx'

export interface IndicatorProps {
  usePeriod: <T>(selector: (snapshot: PeriodSnapshot) => T) => T
  setReminders: (enabled: boolean) => void
}

function usePosition(open: boolean, anchor: RefObject<HTMLElement>, panel: RefObject<HTMLElement>) {
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      if (!anchor.current || !panel.current) return
      const a = anchor.current.getBoundingClientRect()
      const p = panel.current.getBoundingClientRect()
      const viewport = window.visualViewport
      const leftEdge = (viewport?.offsetLeft ?? 0) + 12
      const topEdge = (viewport?.offsetTop ?? 0) + 12
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 24
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 24
      const left = Math.max(leftEdge, Math.min(a.right - p.width, rightEdge - p.width))
      const preferred = a.top - p.height - 10
      const top = preferred >= topEdge ? preferred : Math.min(a.bottom + 10, bottomEdge - p.height)
      setPosition({ left, top: Math.max(topEdge, top), visibility: 'visible' })
    }
    update()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
    if (anchor.current) observer?.observe(anchor.current)
    if (panel.current) observer?.observe(panel.current)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [open, anchor, panel])
  return position
}

function Timeline({ info }: { info: PeriodInfo }) {
  const hours = info.beijing.hour + info.beijing.minute / 60 + info.beijing.second / 3600
  return <div className="dsh-fg__timeline" aria-label={`今日计费时段，${dayDescription(info)}`}>
    <div className="dsh-fg__track" aria-hidden="true">
      {info.windows.map(window => <span key={window.start} className={`dsh-fg__segment dsh-fg__segment--${window.kind}`} style={{ flex: window.end - window.start }} />)}
      <span className="dsh-fg__now" style={{ left: `${hours / 24 * 100}%` }}><span /></span>
    </div>
    <div className="dsh-fg__ticks" aria-hidden="true">
      {[0, 9, 12, 14, 18, 24].map(hour => <span key={hour} style={{ left: `${hour / 24 * 100}%` }}>{String(hour).padStart(2, '0')}</span>)}
    </div>
  </div>
}

export function PeriodIndicator({ usePeriod, setReminders }: IndicatorProps) {
  const { info, reminders } = usePeriod(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const tooltip = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>()
  const id = useId()
  const position = usePosition(open, trigger, panel)
  const tooltipPosition = usePosition(hover && !open, trigger, tooltip)
  const { kind } = info
  const remaining = info.nextAt - info.now
  const label = PERIOD_LABEL[kind]
  const nextLabel = PERIOD_LABEL[info.nextKind]
  const showTooltip = () => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setHover(true), 450) }
  const hideTooltip = () => { clearTimeout(hoverTimer.current); setHover(false) }

  useEffect(() => () => clearTimeout(hoverTimer.current), [])
  useEffect(() => {
    if (!hover || open) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      hideTooltip()
    }
    document.addEventListener('keydown', dismiss, true)
    return () => document.removeEventListener('keydown', dismiss, true)
  }, [hover, open])
  useEffect(() => {
    if (!open) return
    // Positioning first removes visibility:hidden; focus on the following frame.
    const focusFrame = requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }))
    const outside = (event: Event) => {
      const target = event.target as Node
      if (!trigger.current?.contains(target) && !panel.current?.contains(target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape, true)
    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape, true)
    }
  }, [open])

  return <span className="dsh-fg" data-period={kind}>
    <button ref={trigger} type="button" className="dsh-fg__trigger" aria-label={`DeepSeek ${label}，${shortCountdown(remaining)}后${nextLabel}，查看计费时段`} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? id : undefined} aria-describedby={hover && !open ? `${id}-tip` : undefined}
      onClick={() => { hideTooltip(); setOpen(value => !value) }}
      onPointerEnter={event => { if (event.pointerType !== 'touch') showTooltip() }} onPointerLeave={hideTooltip}
      onFocus={event => { if (event.currentTarget.matches(':focus-visible')) showTooltip() }} onBlur={hideTooltip}>
      <Icon name={kind === 'unverified' ? 'help' : kind} />
      <span className="dsh-fg__label">{label}</span>
      {remaining <= 300_000 && <span className="dsh-fg__soon" aria-label="即将切换" />}
    </button>
    {hover && !open && createPortal(<div ref={tooltip} id={`${id}-tip`} role="tooltip" className="dsh-fg dsh-fg__tooltip" data-period={kind} style={tooltipPosition}>
      <strong>{label}</strong><span>{shortCountdown(remaining)}后进入{nextLabel}</span>
    </div>, document.body)}
    {open && createPortal(<section ref={panel} id={id} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`} tabIndex={-1} className="dsh-fg dsh-fg__panel" data-period={kind} style={position}>
      <header className="dsh-fg__heading">
        <span className="dsh-fg__eyebrow" id={`${id}-title`}>DEEPSEEK <span>计费时段</span></span>
        <button type="button" className="dsh-fg__icon-button" aria-label="关闭计费时段" onClick={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }) }}><Icon name="close" /></button>
      </header>
      <div className="dsh-fg__current">
        <span className="dsh-fg__status-icon"><Icon name={kind === 'unverified' ? 'help' : kind} width="21" height="21" /></span>
        <div><h2>{label}<span className="dsh-fg__live-dot" aria-hidden="true" /></h2><p>{kind === 'idle' ? '适合长任务，享受更低的 token 单价' : kind === 'peak' ? '当前按繁忙期 token 单价计费' : '请核对当年的节假日与官方计费规则'}</p></div>
      </div>
      <div className="dsh-fg__price"><span>Token 单价</span><strong>{kind === 'idle' ? '繁忙期的 50%' : kind === 'peak' ? '繁忙期标准价' : '以官方为准'}</strong></div>
      <div className="dsh-fg__next">
        <div className="dsh-fg__next-title"><Icon name="clock" /><span>距离{nextLabel}</span><span className="dsh-fg__next-time">{formatNextTime(info)}</span></div>
        <div className="dsh-fg__countdown" aria-label={`${shortCountdown(remaining)}后进入${nextLabel}`}>{formatCountdown(remaining)}</div>
      </div>
      <div className="dsh-fg__day-title"><span>今日时段</span><span>{dayDescription(info)}</span></div>
      <Timeline info={info} />
      <div className="dsh-fg__legend"><span><i className="dsh-fg__legend-idle" />空闲期</span><span><i className="dsh-fg__legend-peak" />{info.calendarKnown ? '繁忙期' : '待核验'}</span><span className="dsh-fg__timezone">北京时间 UTC+8</span></div>
      <div className="dsh-fg__rules"><span>周一至周五</span><strong>09:00–12:00 · 14:00–18:00</strong><p>其余时段、周末及中国法定节假日全天为空闲期。</p></div>
      {!info.calendarKnown && <p className="dsh-fg__calendar-note">尚未收录 {info.beijing.year} 年节假日。工作日的繁忙窗口标记为待核验，请更新插件。</p>}
      <label className="dsh-fg__reminder"><span><Icon name="bell" /><span>时段切换提醒<small>提前 5 分钟及切换时，在 DSH 内提示</small></span></span><input type="checkbox" role="switch" aria-label="时段切换提醒" checked={reminders} onChange={event => setReminders(event.target.checked)} /><i aria-hidden="true" /></label>
      <footer className="dsh-fg__footer"><span>按本机时间判断 · 计费以官方为准</span><a href={PRICING_URL} target="_blank" rel="noopener noreferrer">官方定价<Icon name="external" width="11" height="11" /></a></footer>
    </section>, document.body)}
  </span>
}

export function PeriodNotice({ usePeriod, dismissNotice }: Pick<IndicatorProps, 'usePeriod'> & { dismissNotice: () => void }) {
  const notice = usePeriod(snapshot => snapshot.notice)
  if (!notice) return null
  return <div className="dsh-fg dsh-fg__notice" data-period={notice.kind} role="status" aria-live="polite"><Icon name={notice.kind} width="20" height="20" /><div><strong>DeepSeek 时段提醒</strong><p>{notice.message}</p></div><button type="button" className="dsh-fg__icon-button" aria-label="关闭时段提醒" onClick={dismissNotice}><Icon name="close" /></button></div>
}
