import test from 'node:test'
import assert from 'node:assert/strict'
import { dailyResults, emptyFilters, filterTrades, groupTrades, metrics } from '../src/lib/analytics.ts'
import { defaultFields, type Trade } from '../src/lib/model.ts'
const trade = (pnl: number | string, i: number, extra = {}): Trade => ({ id: String(i), createdAt: `2026-09-01T10:00:0${i}`, updatedAt: '', values: { date: '2026-09-01', timeIn: `09:3${i}`, timeOut: '10:00', pnl, strategy: 'Breakout', contract: 'ES', ...extra } })
test('known PnL series produces correct metrics including drawdown from an initial loss', () => {
  const result = metrics([-100, 250, -50, 0, 100].map((p, i) => trade(p, i)))
  assert.equal(result.net, 200); assert.equal(result.winRate, 40); assert.equal(result.grossProfit, 350); assert.equal(result.grossLoss, 150)
  assert.equal(result.profitFactor, 350 / 150); assert.equal(result.expectancy, 40); assert.equal(result.avgWin, 175); assert.equal(result.avgLoss, 75)
  assert.equal(result.maxDrawdown, 100); assert.equal(result.breakeven, 1); assert.equal(result.best, 250); assert.equal(result.worst, -100)
  assert.deepEqual(result.curve.map(p => p.value), [-100, 150, 100, 100, 200])
})
test('empty, no loss, all loss and missing PnL produce explicit edge cases', () => {
  assert.equal(metrics([]).profitFactor, null)
  assert.equal(metrics([trade(10, 0)]).profitFactor, Infinity)
  assert.equal(metrics([trade(-10, 0)]).profitFactor, 0)
  assert.equal(metrics([trade('', 0), trade(0, 1)]).count, 1)
  assert.equal(metrics([trade('', 0), trade(0, 1)]).excluded, 1)
})
test('filter rules intersect contract, strategy, dates and custom numeric ranges', () => {
  const trades = [trade(100, 0, { mood: 'Calm', custom: 0 }), trade(-30, 1, { contract: 'NQ', mood: 'Calm', custom: 10 }), trade(90, 2, { mood: 'Tired', custom: -10 })]
  assert.equal(filterTrades(trades, { from: '2026-09-01', to: '2026-09-01', rules: [{ field: 'contract', value: 'ES' }, { field: 'mood', value: 'Calm' }, { field: 'custom', min: '0', max: '0' }] }).length, 1)
  assert.equal(filterTrades(trades, { ...emptyFilters(), rules: [{ field: 'missing', missing: true }] }).length, 3)
  assert.equal(filterTrades(trades, { ...emptyFilters(), from: '2026-09-02' }).length, 0)
  assert.equal(filterTrades([trade(1, 0, { date: '' })], { ...emptyFilters(), to: '2026-09-30' }).length, 0)
})
test('strategy and contract grouping never combines separate markets', () => {
  const trades = [trade(100, 0), trade(-50, 1, { contract: 'NQ' }), trade(70, 2)]
  const groups = groupTrades(trades, ['strategy', 'contract'].map(id => defaultFields().find(f => f.id === id)!))
  assert.equal(groups.length, 2)
  assert.equal(groups.find(g => g.labels[1] === 'ES')!.stats.net, 170)
  assert.equal(groups.find(g => g.labels[1] === 'NQ')!.stats.net, -50)
})
test('numeric bins include both endpoints exactly once and retain missing values', () => {
  const f = defaultFields().find(f => f.id === 'hpResilience')!
  const trades = Array.from({ length: 11 }, (_, i) => trade(10, i, { hpResilience: -150 + i * 30 }))
  trades.push(trade(10, 20))
  const groups = groupTrades(trades, [f])
  assert.equal(groups.length, 6)
  assert.equal(groups.reduce((n, g) => n + g.trades.length, 0), trades.length)
  assert.equal(groups.find(g => g.labels[0] === 'Not recorded')!.stats.count, 1)
})
test('chronological drawdown, overnight holding time and daily totals are accurate', () => {
  const trades = [trade(-60, 2), trade(100, 0, { timeIn: '23:50', timeOut: '00:10', date: '2026-08-31' }), trade(-70, 1)]
  assert.equal(metrics(trades).maxDrawdown, 130)
  assert.equal(metrics([trades[1]]).avgDuration, 20)
  assert.deepEqual(dailyResults(trades), [{ date: '2026-09-01', value: -30 }])
})
test('case variants share one analytics row and match the same filters even before storage normalization', () => {
  const trades = [trade(140, 0, { contract: 'mnq', strategy: 'orb' }), trade(289, 1, { contract: 'MNQ', strategy: 'ORB' }), trade(289, 2, { contract: ' Mnq ', strategy: 'Orb' })]
  const groups = groupTrades(trades, ['contract', 'strategy'].map(id => defaultFields().find(f => f.id === id)!))
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].labels, ['MNQ', 'ORB'])
  assert.equal(groups[0].stats.net, 718)
  assert.equal(groups[0].stats.count, 3)
  assert.equal(groups[0].stats.winRate, 100)
  assert.equal(filterTrades(trades, { ...emptyFilters(), rules: [{ field: 'contract', value: 'MnQ' }, { field: 'strategy', value: 'ORB' }] }).length, 3)
})
