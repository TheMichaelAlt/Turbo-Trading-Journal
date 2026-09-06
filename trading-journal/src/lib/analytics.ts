import { type Field, type Trade, isBlank, isNumeric } from './model.ts'
export interface Filter { field: string; value?: string; min?: string; max?: string; missing?: boolean }
export interface Filters { from: string; to: string; rules: Filter[] }
export const emptyFilters = (): Filters => ({ from: '', to: '', rules: [] })
export const chronological = (trades: Trade[]) => [...trades].sort((a, b) => `${a.values.date ?? ''} ${a.values.timeIn ?? ''} ${a.createdAt} ${a.id}`.localeCompare(`${b.values.date ?? ''} ${b.values.timeIn ?? ''} ${b.createdAt} ${b.id}`))
export function filterTrades(trades: Trade[], filters: Filters): Trade[] {
  return trades.filter(t => {
    const date = String(t.values.date ?? '')
    if ((filters.from && (!date || date < filters.from)) || (filters.to && (!date || date > filters.to))) return false
    return filters.rules.every(f => {
      const value = t.values[f.field]
      if (f.missing) return isBlank(value)
      if (f.value !== undefined && f.value !== '' && String(value ?? '') !== f.value) return false
      if (f.min !== undefined && f.min !== '' && (isBlank(value) || !Number.isFinite(Number(value)) || Number(value) < Number(f.min))) return false
      if (f.max !== undefined && f.max !== '' && (isBlank(value) || !Number.isFinite(Number(value)) || Number(value) > Number(f.max))) return false
      return true
    })
  })
}
export const hasPnl = (t: Trade) => !isBlank(t.values.pnl) && Number.isFinite(Number(t.values.pnl))
export function metrics(input: Trade[]) {
  const trades = chronological(input.filter(hasPnl))
  const pnls = trades.map(t => Number(t.values.pnl))
  const wins = pnls.filter(p => p > 0), losses = pnls.filter(p => p < 0)
  const grossProfit = wins.reduce((a, b) => a + b, 0), grossLoss = -losses.reduce((a, b) => a + b, 0)
  let equity = 0, peak = 0, maxDrawdown = 0, winStreak = 0, lossStreak = 0, longestWin = 0, longestLoss = 0
  const curve = trades.map(t => {
    const pnl = Number(t.values.pnl)
    equity += pnl; peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, peak - equity)
    winStreak = pnl > 0 ? winStreak + 1 : 0; lossStreak = pnl < 0 ? lossStreak + 1 : 0
    longestWin = Math.max(longestWin, winStreak); longestLoss = Math.max(longestLoss, lossStreak)
    return { date: String(t.values.date || 'Undated'), value: equity, pnl, drawdown: peak - equity }
  })
  const durations = trades.flatMap(t => {
    if (!t.values.timeIn || !t.values.timeOut) return []
    const minutes = (v: string) => { const [h, m, s = 0] = v.split(':').map(Number); return h * 60 + m + s / 60 }
    let duration = minutes(String(t.values.timeOut)) - minutes(String(t.values.timeIn))
    if (!Number.isFinite(duration)) return []
    if (duration < 0) duration += 1440
    return [duration]
  })
  const avgWin = wins.length ? grossProfit / wins.length : 0, avgLoss = losses.length ? grossLoss / losses.length : 0
  return { count: trades.length, excluded: input.length - trades.length, net: grossProfit - grossLoss, wins: wins.length, losses: losses.length, breakeven: pnls.length - wins.length - losses.length,
    winRate: trades.length ? wins.length / trades.length * 100 : 0, profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit ? Infinity : null,
    expectancy: trades.length ? (grossProfit - grossLoss) / trades.length : 0, grossProfit, grossLoss, avgWin, avgLoss,
    payoff: avgLoss ? avgWin / avgLoss : null, best: pnls.length ? Math.max(...pnls) : 0, worst: pnls.length ? Math.min(...pnls) : 0,
    maxDrawdown, longestWin, longestLoss, curve, avgDuration: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
  }
}
export function groupTrades(trades: Trade[], fields: Field[]) {
  const numericGroups = new Map<string, { min: number; max: number; width: number }>()
  fields.filter(isNumeric).forEach(f => {
    const values = trades.filter(t => !isBlank(t.values[f.id])).map(t => Number(t.values[f.id])).filter(Number.isFinite)
    if (new Set(values).size > 8) {
      const min = Math.min(...values), max = Math.max(...values)
      numericGroups.set(f.id, { min, max, width: (max - min) / 5 })
    }
  })
  const groups = new Map<string, { labels: string[]; trades: Trade[]; sort: (string | number)[] }>()
  for (const trade of trades) {
    const sort: (string | number)[] = []
    const labels = fields.map(f => {
      const v = trade.values[f.id]
      if (isBlank(v)) { sort.push(Infinity); return 'Not recorded' }
      const bucket = numericGroups.get(f.id)
      if (bucket) {
        const index = Math.min(4, Math.floor((Number(v) - bucket.min) / bucket.width))
        const lo = bucket.min + index * bucket.width, hi = index === 4 ? bucket.max : lo + bucket.width
        const fmt = (n: number) => Number(n.toPrecision(6)).toLocaleString(undefined, { maximumSignificantDigits: 6 })
        sort.push(index)
        return `${fmt(lo)} to ${index < 4 ? '< ' : ''}${fmt(hi)}${f.type === 'percent' ? '%' : ''}`
      }
      sort.push(isNumeric(f) ? Number(v) : String(v))
      return `${v}${f.type === 'percent' ? '%' : ''}`
    })
    const key = JSON.stringify(labels)
    const group = groups.get(key) || { labels, trades: [], sort }
    group.trades.push(trade); groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => {
    for (let i = 0; i < a.sort.length; i++) {
      const left = a.sort[i], right = b.sort[i]
      const diff = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true })
      if (diff) return diff
    }
    return 0
  }).map(g => ({ ...g, stats: metrics(g.trades) }))
}
export function dailyResults(trades: Trade[]) {
  const days = new Map<string, number>()
  chronological(trades.filter(hasPnl)).forEach(t => { const date = String(t.values.date || 'Undated'); days.set(date, (days.get(date) || 0) + Number(t.values.pnl)) })
  return [...days].map(([date, value]) => ({ date, value }))
}
