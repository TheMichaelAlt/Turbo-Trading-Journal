import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatedValues, contractMultiplier, convertedPnl, pnlTrades } from '../src/lib/pnl.ts'
import { initialData, isComplete, normalizeCharacteristics, parseBackup, type Trade } from '../src/lib/model.ts'
import { metrics } from '../src/lib/analytics.ts'
import { tradeFingerprint } from '../src/lib/csvImport.ts'
const trade = (values = {}): Trade => ({ id: 'old', createdAt: '2026-09-01', updatedAt: '2026-09-01', values: { date: '2026-09-01', timeIn: '09:30', timeOut: '10:00', direction: 'LONG', contract: 'MNQ', size: 3, pnl: 120, account: 'SIM', strategy: 'ORB', stopLoss: 10, takeProfit: 30, ...values } })
test('full-point multipliers resolve exact roots, dated and continuous contracts without prefix guessing', () => {
  for (const symbol of ['mnq', '@MNQ', '/MNQU26', 'MNQ1!']) assert.equal(contractMultiplier(symbol), 2)
  assert.equal(contractMultiplier('MES'), 5); assert.equal(contractMultiplier('ESZ2026'), 50)
  assert.equal(contractMultiplier('NQ'), 20); assert.equal(contractMultiplier('CL'), 1000)
  assert.equal(contractMultiplier('NOTMNQ'), undefined)
  assert.equal(contractMultiplier('BTC'), undefined)
  assert.equal(contractMultiplier('MNQU26', { MNQ: 3, MNQU26: 4 }), 4)
  assert.equal(contractMultiplier('ABC', { ABC: 0 }), undefined)
})
test('partial exits use total contract-points once, with correct planned and realized RR', () => {
  // Three contracts: +10, +10 and +5 = 25 points; risk = 3 * 10 = 30 points.
  const values = { ...trade().values, pnl: 25, pnlUnit: 'POINTS' }
  assert.equal(convertedPnl(values, 'dollars'), 50)
  assert.equal(calculatedValues(values).tradeRR, 3)
  assert.equal(calculatedValues(values).realizedRR, 25 / 30)
  assert.equal(calculatedValues({ ...values, pnl: 50, pnlUnit: 'DOLLARS' }).realizedRR, 25 / 30)
  assert.equal(calculatedValues({ ...values, pnl: -30 }).realizedRR, -1)
  assert.equal(calculatedValues({ ...values, pnl: 0 }).realizedRR, 0)
  assert.equal(calculatedValues({ ...values, stopLoss: 0 }).tradeRR, undefined)
  assert.equal(calculatedValues({ ...values, stopLoss: '' }).realizedRR, undefined)
  assert.equal(calculatedValues({ ...values, size: 0 }).realizedRR, undefined)
  assert.equal(calculatedValues({ ...values, contract: 'UNKNOWN', pnlUnit: 'DOLLARS' }).realizedRR, undefined)
  assert.equal(convertedPnl({ ...values, contract: 'UNKNOWN' }, 'dollars'), undefined)
})
test('legacy backups backfill RR without changing money, timestamps, notes or completion; toggles persist', () => {
  const old = initialData()
  old.fields = old.fields.filter(f => !['pnlUnit', 'tradeRR', 'realizedRR'].includes(f.id)).map(f => ['stopLoss', 'takeProfit'].includes(f.id) ? { ...f, archived: true } : f)
  old.trades = [trade({ notes: 'Keep My notes', orphan: 'History' })]
  const migrated = parseBackup(old), result = migrated.trades[0]
  assert.equal(result.values.tradeRR, 3); assert.equal(result.values.realizedRR, 2)
  assert.equal(result.values.pnl, 120); assert.equal(result.values.pnlUnit, undefined)
  assert.equal(result.updatedAt, old.trades[0].updatedAt)
  assert.equal(result.values.notes, 'Keep My notes'); assert.equal(result.values.orphan, 'History')
  assert.equal(isComplete(result, migrated.fields), true)
  migrated.fields = migrated.fields.map(f => ['tradeRR', 'realizedRR'].includes(f.id) ? { ...f, archived: true } : f)
  assert.deepEqual(parseBackup(migrated), migrated)
  assert.equal(tradeFingerprint(result.values), tradeFingerprint(old.trades[0].values))
  assert.equal(tradeFingerprint({ ...result.values, pnlUnit: 'DOLLARS' }), tradeFingerprint(result.values))
  const changed = normalizeCharacteristics({ ...migrated, contractMultipliers: { MNQ: 4 } })
  assert.equal(changed.trades[0].values.realizedRR, 1)
  assert.equal(changed.trades[0].values.pnl, 120)
  assert.throws(() => parseBackup({ ...migrated, contractMultipliers: { MNQ: -2 } }), /multipliers/)
})
test('mixed-unit projections aggregate consistently and exclude unknown conversions instead of treating them as zero', () => {
  const data = initialData()
  data.trades = [trade(), { ...trade({ contract: 'ES', pnl: 2, pnlUnit: 'POINTS' }), id: 'point' }, { ...trade({ contract: 'UNKNOWN', pnl: 7, pnlUnit: 'POINTS' }), id: 'unknown' }]
  const dollars = metrics(pnlTrades(data.trades, 'dollars', data)), points = metrics(pnlTrades(data.trades, 'points', data))
  assert.equal(dollars.net, 220); assert.equal(dollars.excluded, 1)
  assert.equal(points.net, 69); assert.equal(points.count, 3)
  assert.equal(data.trades[1].values.pnl, 2)
})
