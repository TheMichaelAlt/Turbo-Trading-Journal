import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarCells, dailyStats, shiftMonth } from '../src/lib/calendar.ts'
import type { Trade } from '../src/lib/model.ts'

test('calendar aligns weekdays and handles leap years, six-week months and year boundaries', () => {
  const february = calendarCells('2024-02')
  assert.equal(february.filter(d => d.inMonth).length, 29)
  assert.equal(february[0].date, '2024-01-28')
  assert.equal(february[4].date, '2024-02-01')
  assert.equal(february.at(-1)!.date, '2024-03-02')
  assert.equal(calendarCells('2026-08').length, 42)
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.equal(shiftMonth('9999-12', 1), '9999-12')
  assert.equal(shiftMonth('0001-01', -1), '0001-01')
  assert.throws(() => calendarCells('2026-13'))
})
test('daily calendar reports PnL, all trade counts, consistent win rates and deduplicated strategies', () => {
  const trade = (id: string, pnl: number | string, strategy: string, date = '2026-09-01'): Trade => ({ id, values: { date, pnl, strategy }, createdAt: '', updatedAt: '' })
  const trades = [trade('a', 100, 'orb'), trade('b', -40, 'ORB'), trade('c', 0, 'Pullback'), trade('d', '', 'PULLBACK'), trade('e', 20, '', '2026-09-02'), trade('f', 999, 'Trend', '')]
  const days = dailyStats(trades)
  const first = days.get('2026-09-01')!
  assert.equal(days.size, 2)
  assert.equal(first.tradeCount, 4)
  assert.equal(first.stats.count, 3)
  assert.equal(first.stats.excluded, 1)
  assert.equal(first.stats.net, 60)
  assert.ok(Math.abs(first.stats.winRate - 100 / 3) < 1e-10)
  assert.deepEqual(first.strategies, ['ORB', 'PULLBACK'])
  assert.equal(days.get('2026-09-02')!.withoutStrategy, 1)
  assert.deepEqual(dailyStats([]), new Map())
})
