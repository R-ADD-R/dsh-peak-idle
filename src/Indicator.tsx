import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { beijingTime, compactCountdown, dayDescription, formatCountdown, formatNextTime, formatPeriodTime, PERIOD_LABEL, PRICING_URL, shortCountdown, upcomingPeriods } from './period.ts'
import { priceReduction } from './pricing.ts'
import type { PricingSnapshot } from './pricing-store.ts'
import type { PeriodSnapshot } from './store.ts'
import { Icon } from './icons.tsx'

export interface IndicatorProps {
  usePeriod: <T>(selector: (snapshot: PeriodSnapshot) => T) => T
  usePricing: <T>(selector: (snapshot: PricingSnapshot) => T) => T
  refreshPrices: (force?: boolean) => Promise<void>
  setReminders: (enabled: boolean) => void
}

function usePosition(open: boolean, anchor: RefObject<HTMLElement>, panel: RefObject<HTMLElement>, side = false) {
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      if (!anchor.current || !panel.current) return
      const a = anchor.current.getBoundingClientRect(), p = panel.current.getBoundingClientRect()
      const viewport = window.visualViewport
      const leftEdge = (viewport?.offsetLeft ?? 0) + 12, topEdge = (viewport?.offsetTop ?? 0) + 12
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 24
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 24
      const outer = side ? anchor.current.closest('.dsh-fg__panel')?.getBoundingClientRect() ?? a : a
      let left = a.right - p.width, top = a.top - p.height - 10
      if (side && (outer.right + p.width + 10 <= rightEdge || outer.left - p.width - 10 >= leftEdge)) {
        left = outer.right + p.width + 10 <= rightEdge ? outer.right + 10 : outer.left - p.width - 10
        top = a.top
      } else if (top < topEdge) top = a.bottom + 10
      setPosition({ left: Math.max(leftEdge, Math.min(left, rightEdge - p.width)), top: Math.max(topEdge, Math.min(top, bottomEdge - p.height)), visibility: 'visible' })
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
  }, [open, anchor, panel, side])
  return position
}

/** Hover, keyboard focus and touch all reach the same secondary information. */
function HoverDetails({ name, active, onActive, className = '', label, title, children, content }: {
  name: string; active: string | null; onActive: (name: string | null) => void; className?: string
  label: string; title: string; children: ReactNode; content: ReactNode
}) {
  const anchor = useRef<HTMLButtonElement>(null), card = useRef<HTMLElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const activeName = useRef(active)
  activeName.current = active
  const id = useId(), open = active === name
  const position = usePosition(open, anchor, card, true)
  const cancel = () => clearTimeout(timer.current)
  const reveal = () => { cancel(); timer.current = setTimeout(() => onActive(name), 220) }
  const leave = () => { cancel(); timer.current = setTimeout(() => { if (activeName.current === name) onActive(null) }, 350) }
  useEffect(() => () => clearTimeout(timer.current), [])
  return <div className={`dsh-fg__detail-anchor ${className}`}
    onPointerEnter={event => { if (event.pointerType !== 'touch') reveal() }} onPointerLeave={event => { if (!event.currentTarget.contains(document.activeElement)) leave() }}
    onFocusCapture={() => { cancel(); onActive(name) }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { cancel(); onActive(null) } }}>
    <button ref={anchor} type="button" className="dsh-fg__detail-trigger" aria-label={label} aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => { cancel(); onActive(name) }}>
      {children}
    </button>
    {open && <aside ref={card} id={id} role="region" aria-label={title} className="dsh-fg__detail-card" style={position} onPointerEnter={cancel}>
      {content}
    </aside>}
  </div>
}

function PeriodTimeline({ now, active, onActive }: { now: number; active: string | null; onActive: (name: string | null) => void }) {
  const spans = upcomingPeriods(now)
  const startDay = beijingTime(now).midnight
  const ticks = [0, 6, 12, 18, 24].map(hour => {
    const at = now + hour * 3600_000
    const time = beijingTime(at)
    return { at, hour, label: `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`, day: hour === 0 ? '现在' : time.midnight > startDay ? '明日' : '' }
  })
  return <div className="dsh-fg__future" role="group" aria-label="未来 24 小时时段分布">
    <div className="dsh-fg__future-heading"><span>未来 24h</span><span className="dsh-fg__legend"><span><i data-period="idle" />空闲</span><span><i data-period="peak" />繁忙</span>{spans.some(span => span.kind === 'unverified') && <span><i data-period="unverified" />待核验</span>}</span></div>
    <div className="dsh-fg__timeline-track">
      {spans.map((span, index) => <div key={index} className="dsh-fg__timeline-span" style={{ flex: span.endAt - span.startAt }}>
        <HoverDetails name={`timeline-${index}`} active={active} onActive={onActive} className="dsh-fg__timeline-segment" label={`${PERIOD_LABEL[span.kind]}：${formatPeriodTime(span.startAt)}至${formatPeriodTime(span.endAt)}`} title="时间轴时段详情"
          content={<><h3>{PERIOD_LABEL[span.kind]}</h3><dl className="dsh-fg__facts"><div><dt>开始</dt><dd>{formatPeriodTime(span.startAt)}</dd></div><div><dt>结束</dt><dd>{formatPeriodTime(span.endAt)}</dd></div></dl><p>北京时间 UTC+8 · 此段持续{shortCountdown(span.endAt - span.startAt)}。</p></>}>
          <span data-period={span.kind} aria-hidden="true" />
        </HoverDetails>
      </div>)}
    </div>
    <div className="dsh-fg__timeline-ticks" aria-hidden="true">{ticks.map(tick => <span key={tick.hour} style={{ left: `${tick.hour / 24 * 100}%` }}><time dateTime={new Date(tick.at).toISOString()}>{tick.label}</time><small>{tick.day}</small></span>)}</div>
  </div>
}

export function PeriodIndicator({ usePeriod, usePricing, refreshPrices, setReminders }: IndicatorProps) {
  const { info, reminders } = usePeriod(snapshot => snapshot)
  const pricing = usePricing(snapshot => snapshot)
  const [open, setOpen] = useState(false), [hover, setHover] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null), tooltip = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>()
  const activeDetail = useRef(detail)
  activeDetail.current = detail
  const id = useId()
  const position = usePosition(open, trigger, panel), tooltipPosition = usePosition(hover && !open, trigger, tooltip)
  const { kind } = info, remaining = info.nextAt - info.now, label = PERIOD_LABEL[kind], nextLabel = PERIOD_LABEL[info.nextKind]
  const reduction = priceReduction(pricing.data)
  const priceLabel = kind === 'idle' ? reduction !== null ? `价格下降 ${reduction}%` : '空闲期价格' : kind === 'peak' ? '繁忙期价格' : '价格待核验'
  const showTooltip = () => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setHover(true), 450) }
  const hideTooltip = () => { clearTimeout(hoverTimer.current); setHover(false) }
  const close = () => { setOpen(false); setDetail(null) }

  useEffect(() => () => clearTimeout(hoverTimer.current), [])
  useEffect(() => { if (open) void refreshPrices() }, [open, refreshPrices])
  useEffect(() => {
    if (!hover || open) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hideTooltip() }
    }
    document.addEventListener('keydown', dismiss, true)
    return () => document.removeEventListener('keydown', dismiss, true)
  }, [hover, open])
  useEffect(() => {
    if (!open) return
    const focusFrame = requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }))
    const outside = (event: Event) => {
      const target = event.target as Node
      if (!trigger.current?.contains(target) && !panel.current?.contains(target)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation(); event.preventDefault()
      if (activeDetail.current) {
        const secondary = panel.current?.querySelector('.dsh-fg__detail-card')
        if (secondary?.contains(document.activeElement)) panel.current?.focus({ preventScroll: true })
        setDetail(null)
      } else { close(); trigger.current?.focus({ preventScroll: true }) }
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
    <button ref={trigger} type="button" className="dsh-fg__trigger" aria-label={`DeepSeek ${label}，剩余${shortCountdown(remaining)}，查看时段`} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? id : undefined} aria-describedby={hover && !open ? `${id}-tip` : undefined}
      onClick={() => { hideTooltip(); if (open) close(); else setOpen(true) }}
      onPointerEnter={event => { if (event.pointerType !== 'touch') showTooltip() }} onPointerLeave={hideTooltip}
      onFocus={event => { if (event.currentTarget.matches(':focus-visible')) showTooltip() }} onBlur={hideTooltip}>
      <Icon name={kind === 'unverified' ? 'help' : kind} />
      <span className="dsh-fg__duration">{compactCountdown(remaining)}</span>
    </button>
    {hover && !open && createPortal(<div ref={tooltip} id={`${id}-tip`} role="tooltip" className="dsh-fg dsh-fg__tooltip" style={tooltipPosition}>
      <strong>{label} · 还剩{shortCountdown(remaining)}</strong><span>{formatNextTime(info)}进入{nextLabel}</span>
    </div>, document.body)}
    {open && createPortal(<section ref={panel} id={id} role="dialog" aria-modal="false" aria-label="DeepSeek 价格与时段" tabIndex={-1} className="dsh-fg dsh-fg__panel" data-period={kind} style={position}>
      <div className="dsh-fg__time-heading">
        <span><Icon name={kind === 'unverified' ? 'help' : kind} />{label}</span>
        <HoverDetails name="pricing" active={detail} onActive={setDetail} className="dsh-fg__badge" label={`${priceLabel}，查看计费说明`} title="计费说明"
          content={<>
            <h3>计费说明</h3>
            <p>{reduction !== null ? `空闲期 token 价格较繁忙期下降 ${reduction}%。` : '各模型的计费比例请查看官方定价页。'}</p>
            <dl className="dsh-fg__facts"><div><dt>价格来源</dt><dd>{pricing.origin === 'live' ? '已同步官网' : pricing.origin === 'cached' ? '上次同步的缓存' : '内置核验价格'}</dd></div><div><dt>核验时间</dt><dd>{formatPeriodTime(pricing.data.checkedAt)}</dd></div></dl>
            {pricing.error && <p className="dsh-fg__warning" role="status">{pricing.error}</p>}
            <p>打开 DSH 时及每 6 小时检查官网。同步失败时保留最近核验价格。</p>
            <div className="dsh-fg__source-actions"><button type="button" aria-disabled={pricing.loading} onClick={() => { if (!pricing.loading) void refreshPrices(true) }}><Icon name="refresh" width="13" height="13" />{pricing.loading ? '同步中…' : '立即同步'}</button></div>
          </>}>
          <span>{kind === 'idle' && reduction !== null ? `↓ ${reduction}%` : priceLabel}</span>
        </HoverDetails>
      </div>
      <HoverDetails name="time" active={detail} onActive={setDetail} className="dsh-fg__time" label="查看时段详情" title="时段详情"
        content={<>
          <h3>时段详情</h3>
          <dl className="dsh-fg__facts"><div><dt>开始</dt><dd>{formatPeriodTime(info.startedAt)}</dd></div><div><dt>结束</dt><dd>{formatPeriodTime(info.nextAt)}</dd></div><div><dt>下一时段</dt><dd>{nextLabel}</dd></div></dl>
          <p>{dayDescription(info)}。全部时间按北京时间 UTC+8。</p>
          <p>周一至周五 09:00–12:00、14:00–18:00 为繁忙期；其余时段、周末和中国法定节假日为空闲期。</p>
          {!info.calendarKnown && <p className="dsh-fg__warning">尚未收录 {info.beijing.year} 年节假日，工作日繁忙窗口的时段与价格请以官网为准。</p>}
          <label className="dsh-fg__reminder"><span><Icon name="bell" />切换提醒</span><input type="checkbox" role="switch" aria-label="时段切换提醒" checked={reminders} onChange={event => setReminders(event.target.checked)} /><i aria-hidden="true" /></label>
          <p>提前 5 分钟及切换时，在 DSH 内提示。</p>
        </>}>
        <span className="dsh-fg__remaining"><span className="dsh-fg__countdown">{formatCountdown(remaining)}</span><span>剩余时间<Icon name="info" width="12" height="12" /></span></span>
      </HoverDetails>
      <PeriodTimeline now={info.now} active={detail} onActive={setDetail} />
      <div className="dsh-fg__pricing-summary">
        <a className="dsh-fg__pricing-link" href={PRICING_URL} target="_blank" rel="noopener noreferrer">Token 定价<Icon name="external" width="11" height="11" /></a>
      </div>
    </section>, document.body)}
  </span>
}

export function PeriodNotice({ usePeriod, dismissNotice }: Pick<IndicatorProps, 'usePeriod'> & { dismissNotice: () => void }) {
  const notice = usePeriod(snapshot => snapshot.notice)
  if (!notice) return null
  return <div className="dsh-fg dsh-fg__notice" data-period={notice.kind} role="status" aria-live="polite"><Icon name={notice.kind} width="20" height="20" /><div><strong>DeepSeek 时段提醒</strong><p>{notice.message}</p></div><button type="button" className="dsh-fg__icon-button" aria-label="关闭时段提醒" onClick={dismissNotice}><Icon name="close" /></button></div>
}
