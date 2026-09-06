import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultFields, fieldError, initialData, isComplete, learnOptions, migrateLegacy, normalizeValues, parseBackup, validateField, type Field, type Trade } from '../src/lib/model.ts'
const complete = (patch = {}): Trade => ({ id: 'test', createdAt: '2026-09-01T09:30:00Z', updatedAt: '2026-09-01T10:00:00Z', values: { date: '2026-09-01', timeIn: '09:30', timeOut: '10:00', direction: 'Long', contract: 'ES', size: 1, pnl: 0, account: 'Sim', strategy: 'Breakout', ...patch } })
test('all nine required default fields govern completion; zero PnL is valid', () => {
  const fields = defaultFields()
  assert.equal(fields.filter(f => f.required).length, 9)
  assert.equal(isComplete(complete(), fields), true)
  for (const field of fields.filter(f => f.required)) assert.equal(isComplete(complete({ [field.id]: '' }), fields), false, field.name)
})
test('new required custom characteristics reclassify historical trades and zero custom values count', () => {
  const custom: Field = { id: 'mood', name: 'Mood', type: 'text', required: true, filter: true, analyze: true, options: ['Happy'] }
  const fields = [...defaultFields(), custom]
  assert.equal(isComplete(complete(), fields), false)
  assert.equal(isComplete(complete({ mood: 'Happy' }), fields), true)
  assert.equal(isComplete(complete(), fields.map(f => ({ ...f, required: f.id === 'mood' ? false : f.required }))), true)
  assert.equal(isComplete(complete({ mood: 0 }), fields.map(f => f.id === 'mood' ? { ...f, type: 'decimal' } : f)), true)
})
test('field validation handles score bounds, fractional positions, resilience bounds and invalid dates', () => {
  const fields = defaultFields(), find = (id: string) => fields.find(f => f.id === id)!
  assert.equal(fieldError(find('confidence'), 0), 'Minimum is 1')
  assert.equal(fieldError(find('confidence'), 2.5), 'Use a whole number')
  assert.equal(fieldError(find('mhpResilience'), -150), undefined)
  assert.equal(fieldError(find('hpResilience'), 150.01), 'Maximum is 150')
  assert.equal(fieldError(find('hgResilience'), -45.25), undefined)
  assert.equal(fieldError(find('size'), 0), 'Minimum is 1e-8')
  assert.equal(fieldError(find('size'), .25), undefined)
  assert.equal(fieldError(find('date'), '2026-02-30'), 'Enter a valid date')
  assert.equal(fieldError(find('timeIn'), '25:00'), 'Enter a valid time')
  assert.equal(fieldError(find('pnl'), 'nope'), 'Enter a valid number')
  assert.equal(fieldError(find('pnl'), Infinity), 'Enter a valid number')
})
test('normalization preserves zero and negatives without inventing values', () => {
  assert.deepEqual(normalizeValues({ pnl: '0', size: '1.5', confidence: '', hpResilience: '-10.25', notes: '  a lesson  ' }, defaultFields()), { pnl: 0, size: 1.5, hpResilience: -10.25, notes: 'a lesson' })
  const fields = learnOptions(defaultFields(), { strategy: 'My new setup' })
  assert.ok(fields.find(f => f.id === 'strategy')!.options.includes('My new setup'))
})
test('schema editor rejects duplicate names and invalid score ranges', () => {
  const f: Field = { id: 'custom', name: 'Confidence score', type: 'score', min: 1, max: 5, required: false, analyze: true, filter: true, options: [] }
  assert.match(validateField(f, defaultFields())!, /already exists/)
  assert.match(validateField({ ...f, name: 'Custom', min: 5, max: 1 }, [])!, /Minimum/)
  assert.match(validateField({ ...f, name: 'Custom', min: 1.5 }, [])!, /whole numbers/)
})
test('backup validation refuses malformed data and retains custom data and long journal pages', () => {
  const data = initialData(); data.trades = [complete()]; data.journals['2026-09-01'] = { text: 'Reflect. '.repeat(10000), updatedAt: new Date().toISOString() }
  assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(data))), data)
  assert.throws(() => parseBackup({ ...data, fields: [] }))
  assert.throws(() => parseBackup({ ...data, trades: [...data.trades, ...data.trades] }))
  assert.throws(() => parseBackup({ ...data, journals: { 'not-a-date': { text: 'bad', updatedAt: '' } } }))
  assert.throws(() => parseBackup({ ...data, fields: [...data.fields, { ...data.fields[0], id: '__proto__' }] }))
})
test('legacy SQLite rows retain IDs, zero PnL, notes and unconfigured custom tags', () => {
  const result = migrateLegacy([{ id: 7, date: '2026-09-01', time_in: '09:30', time_out: '10:00', direction: 'SHORT', size: 1, pnl: 0, contract: 'ES', account: 'Sim', trade_type: 'Breakout', notes: 'Keep me', custom_tags: '{"Mood":"Calm","Unlisted":0}' }], ['Mood'])
  assert.equal(result.trades[0].id, 'legacy-7')
  assert.equal(result.trades[0].values.pnl, 0)
  assert.equal(result.trades[0].values.direction, 'Short')
  assert.equal(result.trades[0].values.notes, 'Keep me')
  assert.equal(result.trades[0].values['legacy-field-1'], '0')
  assert.equal(isComplete(result.trades[0], result.fields), true)
  assert.doesNotThrow(() => parseBackup(result))
})
