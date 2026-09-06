import { useId, useState } from 'react'
import { money } from '../lib/format'
export function EquityChart({ data, currency }: { data: { date: string; value: number }[]; currency: string }) {
  const id = useId().replaceAll(':', '')
  const [hover, setHover] = useState<number | null>(null)
  const points = [{ date: 'Start', value: 0 }, ...data]
  const min = Math.min(0, ...points.map(p => p.value)), max = Math.max(1, ...points.map(p => p.value))
  const span = max - min || 1
  const y = (v: number) => 180 - (v - min) / span * 150
  const x = (i: number) => 72 + i / Math.max(1, points.length - 1) * 688
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')
  const active = hover !== null ? points[hover] : undefined
  return <div className="chart-wrap"><svg viewBox="0 0 790 220" role="img" aria-label={`Cumulative PnL across ${data.length} trades. Final PnL ${money(points[points.length - 1].value, currency)}.`} onMouseLeave={() => setHover(null)}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--teal)" stopOpacity=".23" /><stop offset="100%" stopColor="var(--teal)" stopOpacity="0" /></linearGradient></defs>
    {[0, 1, 2, 3].map(i => { const v = min + span * i / 3; return <g key={i}><line x1="72" x2="760" y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="3 5" /><text x="62" y={y(v) + 4} textAnchor="end">{money(v, currency, true)}</text></g> })}
    <path d={`${path} L760,${y(0)} L72,${y(0)} Z`} fill={`url(#${id})`} />
    <line x1="72" x2="760" y1={y(0)} y2={y(0)} stroke="var(--muted)" strokeOpacity=".35" />
    <path d={path} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round" />
    <text x="72" y="210">{data[0]?.date || 'Start'}</text><text x="760" y="210" textAnchor="end">{data[data.length - 1]?.date || 'Today'}</text>
    {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r="9" fill="transparent"><title>{p.date}: {money(p.value, currency)}</title></circle>)}
    <rect x="72" y="15" width="688" height="170" fill="transparent" onMouseMove={e => { const rect = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(points.length - 1, Math.round((e.clientX - rect.left) / rect.width * (points.length - 1))))) }} />
    {active && hover !== null && <g><line x1={x(hover)} x2={x(hover)} y1="20" y2="185" stroke="var(--muted)" strokeDasharray="3 3" /><circle cx={x(hover)} cy={y(active.value)} r="4" fill="var(--teal)" /></g>}
  </svg><div className="chart-caption">{active ? `${active.date} · ${money(active.value, currency)}` : 'Cumulative PnL · hover to inspect each trade'}</div></div>
}
export function DailyChart({ data, currency }: { data: { date: string; value: number }[]; currency: string }) {
  const max = Math.max(1, ...data.map(d => Math.abs(d.value)))
  return <div className="daily-chart" role="img" aria-label="Daily net PnL bar chart"><div className="daily-zero" />{data.map(d => <div key={d.date} className="daily-column" title={`${d.date}: ${money(d.value, currency)}`}><div className={`daily-bar ${d.value < 0 ? 'loss' : ''}`} style={{ height: `${Math.abs(d.value) / max * 44}%`, ...(d.value < 0 ? { top: '50%' } : { bottom: '50%' }) }} /><span>{d.date.slice(8)}</span></div>)}</div>
}
