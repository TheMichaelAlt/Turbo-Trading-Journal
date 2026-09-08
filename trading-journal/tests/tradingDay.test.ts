import test from 'node:test'
import assert from 'node:assert/strict'
import { tradingDay } from '../src/lib/tradingDay.ts'
import { dailyStats } from '../src/lib/calendar.ts'
import { compareChronology, dailyResults, filterTrades } from '../src/lib/analytics.ts'
import { initialData, parseBackup, type Trade } from '../src/lib/model.ts'
const trade = (date: string, timeIn: string, pnl = 100): Trade => ({ id: date + timeIn, createdAt: '', updatedAt: '', values: { date, timeIn, pnl, strategy: 'ORB' } })
test('trading days use strict cutoff and safe month, leap and year rollover without changing records', () => {
  for (const time of ['14:59', '15:00', '15:00:00', '', 'invalid']) assert.equal(tradingDay(trade('2026-09-08', time)), '2026-09-08')
  for (const time of ['15:00:01', '15:01', '23:59']) assert.equal(tradingDay(trade('2026-09-08', time)), '2026-09-09')
  for (const [date, next] of [['2026-12-31', '2027-01-01'], ['2024-02-28', '2024-02-29'], ['2024-02-29', '2024-03-01'], ['2026-03-08', '2026-03-09']]) assert.equal(tradingDay(trade(date, '18:00')), next)
  const t = trade('2026-09-08', '16:00'); const before = structuredClone(t)
  assert.equal(tradingDay(t, '17:00'), '2026-09-08'); assert.equal(tradingDay(t), '2026-09-09'); assert.deepEqual(t, before)
})
test('calendar, daily chart and dashboard ranges agree while master ranges retain calendar dates', () => {
  const trades = [trade('2026-09-08', '18:00'), trade('2026-09-09', '09:00', -40), trade('2026-09-09', '16:00', 500)]
  const day = dailyStats(trades).get('2026-09-09')!
  assert.equal(day.tradeCount, 2); assert.equal(day.stats.net, 60); assert.equal(day.stats.winRate, 50)
  assert.deepEqual(dailyResults(trades), [{ date: '2026-09-09', value: 60 }, { date: '2026-09-10', value: 500 }])
  const filters = { from: '2026-09-09', to: '2026-09-09', rules: [] }
  assert.deepEqual(filterTrades(trades, filters, '15:00'), trades.slice(0, 2))
  assert.deepEqual(filterTrades(trades, filters), trades.slice(1))
  assert.deepEqual([...trades].sort((a, b) => -compareChronology(a, b)), [...trades].reverse())
})
test('cutoff is backed up, validated and optional for legacy data', () => {
  const data = initialData()
  assert.equal(parseBackup(data).tradingDayEnd, undefined)
  assert.equal(parseBackup({ ...data, tradingDayEnd: '17:30' }).tradingDayEnd, '17:30')
  for (const tradingDayEnd of ['', '24:00', '15:60', 1500]) assert.throws(() => parseBackup({ ...data, tradingDayEnd }))
})
