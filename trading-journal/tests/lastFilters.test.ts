import test from 'node:test'
import assert from 'node:assert/strict'
import { initialData, parseBackup } from '../src/lib/model.ts'
test('last filters round-trip separately, including missing values, ranges, search and old field IDs', () => {
  const data = { ...initialData(), lastFilters: { dashboard: { filters: { from: '2026-09-01', to: '', rules: [{ field: 'contract', value: 'MNQ' }, { field: 'old-field', missing: true }] } }, master: { filters: { from: '', to: '', rules: [{ field: 'pnl', min: '-25', max: '0' }] }, search: 'My notes' } } }
  assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(data))), data)
  assert.equal(parseBackup(initialData()).lastFilters, undefined)
  for (const lastFilters of [null, [], { dashboard: { filters: {} } }, { master: { filters: { from: '2026-02-30', to: '', rules: [] } } }, { master: { filters: { from: '', to: '', rules: [{ field: 'pnl', min: 3 }] } } }]) assert.throws(() => parseBackup({ ...initialData(), lastFilters }), /remembered filters/)
})
