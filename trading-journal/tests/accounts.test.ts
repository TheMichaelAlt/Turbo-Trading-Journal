import test from 'node:test'
import assert from 'node:assert/strict'
import { accountReport, eventError, type PropAccount, type AccountEvent } from '../src/lib/accounts.ts'
import { initialData, normalizeCharacteristics, parseBackup, type Trade } from '../src/lib/model.ts'
const account = (): PropAccount => ({ id: 'a', name: 'PROP1', firm: 'Firm', openedAt: '2026-08-01T00:00', startingBalance: 50000, initialStage: 'eval', drawdownMode: 'static', payoutShare: 80, maxDrawdown: 2000, dailyLossLimit: 500, notes: '', events: [{ id: 'buy', at: '2026-08-01T00:00', type: 'purchase', cost: 150, notes: '' }] })
const trade = (id: string, day: string, pnl: number, time = '10:00'): Trade => ({ id, createdAt: day, updatedAt: day, values: { account: 'prop1', contract: 'MNQ', date: day, timeIn: '09:00', timeOut: time, pnl } })
test('costs, payout split, resets and funding are separate from PnL; chronological edits recompute balances', () => {
  const data = initialData(), a = account()
  data.trades = [trade('t1', '2026-08-01', 1000), trade('t2', '2026-08-03', -100)]
  a.events.push({ id: 'payout', at: '2026-08-01T12:00', type: 'payout', cost: 0, withdrawal: 500, share: 80, received: 400, notes: '' }, { id: 'reset', at: '2026-08-02T08:00', type: 'reset', cost: 80, balance: 50000, stage: 'eval', notes: '' }, { id: 'fund', at: '2026-08-02T09:00', type: 'funded', cost: 125, balance: 50000, notes: '' })
  const r = accountReport(a, data, '2026-08-03')
  assert.equal(r.balance, 49900); assert.equal(r.pnl, 900)
  assert.equal(r.costs, 355); assert.equal(r.cash, 400); assert.equal(r.netCash, 45)
  assert.equal(r.withdrawals, 500); assert.equal(r.stage, 'funded')
  assert.equal(r.dllRoom, 400); assert.equal(r.drawdownRoom, 1900)
  assert.equal(accountReport(a, data, '2026-08-01').balance, 50500)
  assert.equal(accountReport(a, data, '2026-08-01').stage, 'eval')
  a.events = a.events.filter(e => e.id !== 'reset' && e.id !== 'fund')
  assert.equal(accountReport(a, data, '2026-08-03').balance, 50400)
})
test('static, EOD and live trailing floors differ; manual equity highs only affect live trailing', () => {
  const data = initialData(), a = account()
  data.trades = [trade('1', '2026-08-01', 1000, '10:00'), trade('2', '2026-08-01', -800, '11:00'), trade('3', '2026-08-02', -100)]
  assert.equal(accountReport(a, data, '2026-08-02').threshold, 48000)
  a.drawdownMode = 'eod'; assert.equal(accountReport(a, data, '2026-08-02').threshold, 48200)
  a.drawdownMode = 'live'; assert.equal(accountReport(a, data, '2026-08-02').threshold, 49000)
  a.events.push({ id: 'peak', at: '2026-08-01T09:59', type: 'peak', cost: 0, peak: 51500, notes: '' })
  const result = accountReport(a, data, '2026-08-02')
  assert.equal(result.threshold, 49500); assert.equal(result.balance, 50100)
})
test('case-insensitive links, point conversion, cutoff dates and incomplete coverage are explicit', () => {
  const data = initialData(), a = account()
  data.trades = [trade('point', '2026-08-01', 50), trade('old', '2026-07-01', 100), trade('draft', '2026-08-01', 30), trade('unknown', '2026-08-01', 40)]
  data.trades[0].values.pnlUnit = 'POINTS'; data.trades[3].values.contract = 'UNKNOWN'; data.trades[3].values.pnlUnit = 'POINTS'
  const r = accountReport(a, data, '2026-08-03', new Set(['point', 'old', 'unknown']))
  assert.equal(r.balance, 50100); assert.equal(r.beforeOpening, 1); assert.equal(r.unfinished, 1); assert.equal(r.skipped, 1)
  data.accounts = [a]
  const normalized = normalizeCharacteristics(data)
  assert.ok(normalized.fields.find(f => f.id === 'account')!.options.includes('PROP1'))
  assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(normalized))), normalized)
  assert.equal(parseBackup(initialData()).accounts, undefined)
  assert.throws(() => parseBackup({ ...normalized, accounts: [a, { ...a, id: 'b', name: 'prop1' }] }), /duplicate/)
  assert.ok(eventError({ id: 'bad', at: '2026-08-01T00:00', type: 'payout', cost: 0, withdrawal: 1000, share: 110, received: 1100, notes: '' } as AccountEvent))
})
