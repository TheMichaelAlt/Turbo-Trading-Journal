import { canonicalText, isBlank, validDate, type Trade } from './model.ts'
import { tradingDay } from './tradingDay.ts'
import { metrics } from './analytics.ts'

export const validMonth = (month: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) > 0

export function shiftMonth(month: string, offset: number): string {
  if (!validMonth(month)) throw new Error('Invalid calendar month')
  const date = new Date(`${month}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  return date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999 ? month : date.toISOString().slice(0, 7)
}

export function calendarCells(month: string) {
  if (!validMonth(month)) throw new Error('Invalid calendar month')
  const first = new Date(`${month}-01T12:00:00Z`)
  const last = new Date(first)
  last.setUTCMonth(last.getUTCMonth() + 1, 0)
  const leading = first.getUTCDay()
  const count = Math.ceil((leading + last.getUTCDate()) / 7) * 7
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first)
    date.setUTCDate(index - leading + 1)
    const key = date.toISOString().slice(0, 10)
    return { date: key, day: date.getUTCDate(), inMonth: key.startsWith(month) }
  })
}

export function dailyStats(trades: Trade[], tradingDayEnd?: string) {
  const groups = new Map<string, Trade[]>()
  for (const trade of trades) {
    const date = tradingDay(trade, tradingDayEnd)
    if (!validDate(date)) continue
    groups.set(date, [...(groups.get(date) || []), trade])
  }
  return new Map([...groups].map(([date, dayTrades]) => [date, {
    trades: dayTrades,
    tradeCount: dayTrades.length,
    stats: metrics(dayTrades),
    strategies: [...new Set(dayTrades.filter(t => !isBlank(t.values.strategy)).map(t => canonicalText(t.values.strategy)))].sort(),
    withoutStrategy: dayTrades.filter(t => isBlank(t.values.strategy)).length,
  }]))
}
