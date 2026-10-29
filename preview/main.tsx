import { useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { PeriodIndicator, PeriodNotice, type IndicatorProps } from '../src/Indicator.tsx'
import { createPeriodStore } from '../src/store.ts'
import { Icon } from '../src/icons.tsx'
import '../src/styles.css'
import './theme.css'
import './preview.css'

type Scene = 'live' | 'peak' | 'idle' | 'weekend' | 'holiday' | 'boundary' | 'unknown'
const SCENES: Record<Scene, { title: string; date?: string }> = {
  live: { title: '实时' },
  peak: { title: '繁忙期', date: '2026-10-28T15:26:18+08:00' },
  idle: { title: '空闲期', date: '2026-10-28T20:26:18+08:00' },
  weekend: { title: '周末', date: '2026-10-31T10:26:18+08:00' },
  holiday: { title: '节假日', date: '2026-10-01T10:26:18+08:00' },
  boundary: { title: '切换提醒', date: '2026-10-28T17:59:55+08:00' },
  unknown: { title: '日历待更新', date: '2027-01-04T10:26:18+08:00' },
}
const params = new URLSearchParams(location.search)
let scene: Scene = Object.hasOwn(SCENES, params.get('scene') ?? '') ? params.get('scene') as Scene : 'live'
let sceneStarted = Date.now()
function simulatedNow() {
  const date = SCENES[scene].date
  return date ? Date.parse(date) + Date.now() - sceneStarted : Date.now()
}
const store = createPeriodStore({ now: simulatedNow, storage: localStorage, eventTarget: window })
store.start()
const usePeriod: IndicatorProps['usePeriod'] = selector => selector(useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot))

function ShellIcon({ path }: { path: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}

function App() {
  const [currentScene, setScene] = useState(scene)
  const [dark, setDark] = useState(params.get('theme') === 'dark' || (params.get('theme') !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches))
  const [draft, setDraft] = useState('')
  useEffect(() => { document.body.toggleAttribute('data-ds-dark-theme', dark); document.documentElement.style.colorScheme = dark ? 'dark' : 'light' }, [dark])
  useEffect(() => () => store.dispose(), [])

  return <div className="preview-app">
    <header className="preview-top"><span className="preview-mark"><img src="/icon.svg" alt="" /><span>峰谷时段提醒</span><i>插件预览</i></span><div className="preview-scenes" role="group" aria-label="预览场景">{Object.entries(SCENES).map(([key, item]) => <button key={key} type="button" aria-pressed={currentScene === key} onClick={() => { scene = key as Scene; sceneStarted = Date.now(); store.dismissNotice(); store.refresh(); setScene(scene) }}>{item.title}</button>)}</div><button className="preview-theme" aria-label={dark ? '切换为浅色主题' : '切换为深色主题'} onClick={() => setDark(!dark)}><Icon name={dark ? 'peak' : 'idle'} /></button></header>
    <div className="preview-frame">
      <aside className="preview-sidebar">
        <div className="preview-brand"><span>deepseek <em>harness</em></span><ShellIcon path="M3 4h18v16H3zM9 4v16" /></div>
        <button className="preview-new" onClick={() => setDraft('')}><ShellIcon path="M12 5v14M5 12h14" />新建会话<span>Ctrl N</span></button>
        <div className="preview-search"><ShellIcon path="m21 21-4.5-4.5M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15" />搜索会话<span>Ctrl K</span></div>
        <div className="preview-workspace"><ShellIcon path="M3 7V5h6l2 2h10v13H3z" /><span>DSH-FG</span><span>⌄</span></div>
        <div className="preview-session"><span>新会话</span><span>···</span></div>
        <div className="preview-history-label">最近的会话</div>
        <div className="preview-history"><span>整理项目思路</span><span>设计一个更顺手的工作流</span></div>
        <div className="preview-sidebar-bottom"><div><ShellIcon path="M8 3h8v5h5v8h-5v5H8v-5H3V8h5z" />插件</div><div><ShellIcon path="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z" />设置<span>⌘ ,</span></div><div className="preview-profile"><span className="preview-avatar">D</span><span>本地工作空间<small>DeepSeek Harness</small></span></div></div>
      </aside>
      <main className="preview-main">
        <div className="preview-main-top"><span>新会话</span><span>DSH-FG <span className="preview-dot">/</span> <span>会话</span></span><ShellIcon path="M4 5h16v14H4zM15 5v14" /></div>
        <div className="preview-hero"><div className="preview-hero-symbol">d<span>·</span></div><h1>有什么可以帮你？</h1><p>让想法向前一步。</p></div>
        <div className="preview-composer-area">
          <div className="preview-composer">
            <textarea aria-label="向 DeepSeek 发送消息" placeholder="发送消息，或输入 / 查看指令" value={draft} onChange={event => setDraft(event.target.value)} />
            <div className="preview-toolbar"><div className="preview-toolbar-left"><button title="添加附件"><ShellIcon path="M12 5v14M5 12h14" /></button><button><ShellIcon path="M12 3 4 7v6c0 5 8 8 8 8s8-3 8-8V7z" /><span>默认权限</span><span>⌄</span></button></div><div className="preview-toolbar-right"><PeriodIndicator usePeriod={usePeriod} setReminders={store.setReminders} /><button className="preview-model">DeepSeek-V4.1-Flash<span>⌄</span></button><button className="preview-send" aria-label="发送消息（界面预览）" disabled={!draft.trim()} onClick={() => setDraft('')}><ShellIcon path="M12 19V5m-6 6 6-6 6 6" /></button></div></div>
          </div>
          <div className="preview-under-composer"><span><span className="preview-connection" />已连接</span><span>请在真实 DSH 中安装插件后使用</span></div>
        </div>
        <div className="preview-placement"><span>输入框工具栏</span><span className="preview-placement-line" /><span>发送前，知道当前时段。</span></div>
        <div className="preview-caption">{currentScene === 'live' ? '当前显示真实北京时间。' : `模拟北京时间 ${SCENES[currentScene].date?.slice(0, 19).replace('T', ' ')}。`}点击模型选择器左侧的时段图标查看详情。</div>
      </main>
    </div>
    <PeriodNotice usePeriod={usePeriod} dismissNotice={store.dismissNotice} />
  </div>
}

createRoot(document.getElementById('root')!).render(<App />)
