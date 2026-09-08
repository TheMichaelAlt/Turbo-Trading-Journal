import { validDate, type Trade } from './model.ts'

export const DEFAULT_TRADING_DAY_END = '15:00'
export const validTradingDayEnd = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

// Use recorded local dates and entry times; UTC arithmetic avoids DST shifts.
export function tradingDay(trade: Trade, end = DEFAULT_TRADING_DAY_END): string {
  const date = String(trade.values.date ?? '')
  const time = String(trade.values.timeIn ?? '')
  if (!validDate(date) || !validTradingDayEnd(end) || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)) return date
  if ((time.length === 5 ? `${time}:00` : time) <= `${end}:00`) return date
  const next = new Date(`${date}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.getUTCFullYear() > 9999 ? date : next.toISOString().slice(0, 10)
}
