import test from 'node:test'
import assert from 'node:assert/strict'
import { applyImport, convertImportValue, defaultImportOptions as options, parseCsv, previewImport, suggestMappings } from '../src/lib/csvImport.ts'
import { defaultFields, initialData, type Field } from '../src/lib/model.ts'
const field = (id: string) => defaultFields().find(f => f.id === id)!
test('CSV preserves quoted multiline notes, handles BOM, duplicate headers, separators and source lines', () => {
  const csv = parseCsv('\uFEFFSymbol,Notes,Symbol\r\nES,"Keep My, ""Notes""\nHere",NQ\r\n\r\nMNQ,ok,MES')
  assert.deepEqual(csv.headers, ['Symbol', 'Notes', 'Symbol'])
  assert.equal(csv.rows[0].cells[1], 'Keep My, "Notes"\nHere')
  assert.equal(csv.rows[1].line, 5)
  assert.equal(parseCsv('Symbol;PnL\nES;12,50').delimiter, ';')
  assert.equal(parseCsv('Symbol\tPnL\nES\t12').delimiter, '\t')
  assert.throws(() => parseCsv('a,b\n1'), /columns/)
  assert.throws(() => parseCsv('a,b\n1,"oops'), /Unclosed/)
  assert.throws(() => parseCsv('a,b\n1,"x"oops'), /Unexpected/)
})
test('explicit formats normalize financial values and text while preserving notes', () => {
  assert.equal(convertImportValue('($1,234.50)', field('pnl'), options), -1234.5)
  assert.equal(convertImportValue('1.234,50', field('pnl'), { ...options, decimal: ',' }), 1234.5)
  assert.equal(convertImportValue('0.25', field('ddRatio'), { ...options, fractionalPercent: true }), 25)
  assert.equal(convertImportValue('25%', field('ddRatio'), { ...options, fractionalPercent: true }), 25)
  assert.equal(convertImportValue('09/06/2026', field('date'), { ...options, dateOrder: 'mdy' }), '2026-09-06')
  assert.equal(convertImportValue('09/06/2026', field('date'), { ...options, dateOrder: 'dmy' }), '2026-06-09')
  assert.equal(convertImportValue('2026-02-30', field('date'), options), '2026-02-30')
  assert.equal(convertImportValue('12:30 PM', field('timeIn'), options), '12:30')
  assert.equal(convertImportValue('12:30 AM', field('timeIn'), options), '00:30')
  assert.equal(convertImportValue('sell', field('direction'), options), 'SHORT')
  assert.equal(convertImportValue(' mnq ', field('contract'), options), 'MNQ')
  assert.equal(convertImportValue(' Keep My notes\n ', field('notes'), options), ' Keep My notes\n ')
})
test('mapping, validation, duplicates, exclusions and stable atomic retry preserve existing history', () => {
  const data = initialData(), mood: Field = { id: 'mood', name: 'Mood', type: 'text', required: true, filter: true, analyze: true, options: [] }
  const fields = [...data.fields, mood]
  const csv = parseCsv('Symbol,PnL,Mood\nmnq,0,calm\nMNQ,0,CALM\nES,0x10,\nNQ,12.5,happy')
  const mappings = suggestMappings(csv.headers, fields)
  assert.deepEqual(mappings, ['contract', 'pnl', 'mood'])
  const rows = previewImport(csv, mappings, fields, [], options, ['1','2','3','4'], new Set(), {}, {})
  assert.equal(rows[0].values.pnl, 0)
  assert.equal(rows[1].included, false)
  assert.ok(rows[2].errors.some(e => e.includes('number format')))
  assert.ok(rows[2].missing.includes('Mood'))
  const fixed = previewImport(csv, mappings, fields, [], options, ['1','2','3','4'], new Set([0]), {}, { 2: { pnl: '10', mood: 'calm' } })
  assert.equal(fixed[1].included, true)
  assert.equal(fixed[2].errors.length, 0)
  assert.throws(() => previewImport(csv, ['pnl','pnl','mood'], fields, [], options, [], new Set(), {}, {}), /only one/)
  const trades = fixed.filter(r => r.included).map(r => ({ id: r.id, values: r.values, createdAt: '2026-09-06', updatedAt: '2026-09-06' }))
  const saved = applyImport(data, [mood], trades)
  assert.equal(saved.fields.find(f => f.id === 'mood')!.options.length, 2)
  assert.deepEqual(applyImport(saved, [mood], trades), saved)
  assert.equal(previewImport(csv, mappings, fields, saved.trades, options, [], new Set(), {}, {})[0].duplicate, true)
})
test('preview corrections use displayed journal units instead of converting fractions twice', () => {
  const csv = parseCsv('DD ratio (%);PnL\n0,25;12,50')
  const rows = previewImport(csv, ['ddRatio', 'pnl'], defaultFields(), [], { ...options, decimal: ',', fractionalPercent: true }, ['1'], new Set(), {}, { 0: { ddRatio: '26', pnl: '13.5' } })
  assert.equal(rows[0].values.ddRatio, 26)
  assert.equal(rows[0].values.pnl, 13.5)
  assert.equal(rows[0].errors.length, 0)
})
