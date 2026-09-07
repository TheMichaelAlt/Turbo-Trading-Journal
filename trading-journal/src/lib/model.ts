import { calculatedValues, type PnlDisplay } from './pnl.ts'
export type FieldType = 'text' | 'decimal' | 'integer' | 'percent' | 'score' | 'date' | 'time'
export type Value = string | number
export type Values = Record<string, Value>
export interface Field {
  id: string; name: string; type: FieldType; required: boolean; filter: boolean; analyze: boolean
  options: string[]; min?: number; max?: number; builtin?: boolean; archived?: boolean
}
export interface Trade { id: string; values: Values; createdAt: string; updatedAt: string; demo?: boolean }
export interface JournalEntry { text: string; updatedAt: string }
export interface JournalData {
  version: 1; fields: Field[]; trades: Trade[]; journals: Record<string, JournalEntry>
  theme: 'dark' | 'light'; currency: string; minimalist?: boolean; pnlDisplay?: PnlDisplay; contractMultipliers?: Record<string, number>
}
export const numericTypes: FieldType[] = ['decimal', 'integer', 'percent', 'score']
export const isNumeric = (field: Field) => numericTypes.includes(field.type)
export const isBlank = (value: unknown) => value === undefined || value === null || String(value).trim() === ''
export const canonicalText = (value: unknown) => String(value ?? '').trim().toUpperCase()
export const isTextCharacteristic = (field: Field) => field.type === 'text' && field.id !== 'notes'
export const characteristicValue = (field: Field, value: Value): Value => isTextCharacteristic(field) ? canonicalText(value) : value
export function normalizeField(field: Field): Field {
  if (!isTextCharacteristic(field)) return field
  const options = [...new Set(field.options.map(canonicalText).filter(Boolean))]
  return options.length === field.options.length && options.every((v, i) => v === field.options[i]) ? field : { ...field, options }
}
const field = (id: string, name: string, type: FieldType, required: boolean, extra: Partial<Field> = {}): Field => ({
  id, name, type, required, filter: true, analyze: true, options: [], builtin: true, ...extra,
})
export function defaultFields(): Field[] {
  return [
    field('date', 'Date', 'date', true, { analyze: false }),
    field('timeIn', 'Time entered', 'time', true, { analyze: false }),
    field('timeOut', 'Time exited', 'time', true, { analyze: false }),
    field('direction', 'Long / short', 'text', true, { options: ['Long', 'Short'] }),
    field('contract', 'Contract', 'text', true, { options: ['ES', 'NQ', 'MES', 'MNQ', 'RTY', 'YM', 'CL', 'GC', 'BTC', 'ETH'] }),
    field('size', 'Position size', 'decimal', true, { min: 0.00000001 }),
    field('pnl', 'PnL', 'decimal', true, { analyze: false }),
    field('pnlUnit', 'PnL unit', 'text', false, { options: ['DOLLARS', 'POINTS'], analyze: false }),
    field('tradeRR', 'Trade RR', 'decimal', false),
    field('realizedRR', 'Realized RR', 'decimal', false),
    field('account', 'Account', 'text', true, { options: ['Sim', 'Live', 'Funded'] }),
    field('strategy', 'Strategy', 'text', true, { options: ['Breakout', 'Pullback', 'Reversal', 'Trend continuation'] }),
    field('stopLoss', 'Stop loss (points)', 'decimal', false, { min: 0 }),
    field('takeProfit', 'Take profit (points)', 'decimal', false, { min: 0 }),
    field('confidence', 'Confidence score', 'score', false, { min: 1, max: 5 }),
    field('execution', 'Execution score', 'score', false, { min: 1, max: 5 }),
    field('notes', 'Notes', 'text', false, { filter: false, analyze: false }),
    field('ddRatio', 'DD ratio (%)', 'percent', false),
    field('mhpResilience', 'MHP resilience', 'decimal', false, { min: -150, max: 150 }),
    field('hpResilience', 'HP resilience', 'decimal', false, { min: -150, max: 150 }),
    field('hgResilience', 'HG resilience', 'decimal', false, { min: -150, max: 150 }),
    field('setupGrade', 'Setup grade', 'text', false, { options: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'] }),
  ].map(normalizeField)
}
export const initialData = (): JournalData => ({ version: 1, fields: defaultFields(), trades: [], journals: {}, theme: 'dark', currency: 'USD' })
export const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export const isCalculated = (field: Field) => field.builtin === true && ['tradeRR', 'realizedRR'].includes(field.id)
export const activeFields = (fields: Field[]) => fields.filter(f => !f.archived)
// Keep every recorded column discoverable, even in older imports whose field
// definitions are missing. Removed definitions normally remain as archived fields.
export function historicalFields(data: JournalData): Field[] {
  const fields = [...data.fields], known = new Set(fields.map(f => f.id))
  for (const trade of data.trades) for (const id of Object.keys(trade.values)) {
    if (known.has(id)) continue
    known.add(id)
    fields.push({ id, name: id, type: 'text', options: [], required: false, filter: false, analyze: false, archived: true })
  }
  return fields
}
export function mergeTradeValues(raw: Values, fields: Field[], previous: Values = {}): Values {
  const active = new Set(activeFields(fields).map(f => f.id))
  return {
    ...Object.fromEntries(Object.entries(previous).filter(([id]) => !active.has(id))),
    ...normalizeValues(Object.fromEntries(Object.entries(raw).filter(([id]) => active.has(id))), fields),
  }
}
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) > 0 && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function fieldError(field: Field, value: unknown): string | undefined {
  if (isBlank(value)) return field.required ? 'Required to complete this trade' : undefined
  if (typeof value !== 'string' && typeof value !== 'number') return 'Enter a valid value'
  if (isNumeric(field)) {
    const n = Number(value)
    if (!Number.isFinite(n)) return 'Enter a valid number'
    if ((field.type === 'integer' || field.type === 'score') && !Number.isInteger(n)) return 'Use a whole number'
    if (field.min !== undefined && n < field.min) return `Minimum is ${field.min}`
    if (field.max !== undefined && n > field.max) return `Maximum is ${field.max}`
  }
  if (field.type === 'date' && !validDate(String(value))) return 'Enter a valid date'
  if (field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(value))) return 'Enter a valid time'
  if (field.id === 'pnlUnit' && !['DOLLARS', 'POINTS'].includes(canonicalText(value))) return 'Select DOLLARS or POINTS'
  if (field.id === 'direction' && !['LONG', 'SHORT'].includes(canonicalText(value))) return 'Select LONG or SHORT'
}
export const tradeIssues = (values: Values, fields: Field[]) => activeFields(fields).filter(f => !isCalculated(f)).flatMap(f => {
  const error = fieldError(f, values[f.id])
  return error ? [{ field: f, error }] : []
})
export const isComplete = (trade: Trade, fields: Field[]) => tradeIssues(trade.values, fields).length === 0
export function normalizeValues(values: Values, fields: Field[]): Values {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => !isBlank(value)).map(([id, value]) => {
    const f = fields.find(item => item.id === id)
    return [id, f?.id === 'notes' ? String(value) : f && isNumeric(f) && Number.isFinite(Number(value)) ? Number(value) : f && isTextCharacteristic(f) ? canonicalText(value) : String(value).trim()]
  }))
}
export function learnOptions(fields: Field[], values: Values): Field[] {
  return fields.map(normalizeField).map(f => isTextCharacteristic(f) && !isBlank(values[f.id]) && !f.options.includes(canonicalText(values[f.id]))
    ? { ...f, options: [...f.options, canonicalText(values[f.id])] } : f)
}
// Apply the same rules to saved trades, old backups, archived characteristics, and fresh entries.
// IDs, numbers, timestamps, notes, and daily journal writing are left intact.
export function normalizeCharacteristics(data: JournalData): JournalData {
  const added = defaultFields().filter(f => ['pnlUnit', 'tradeRR', 'realizedRR'].includes(f.id) && !data.fields.some(old => old.id === f.id)).map(f => ({ ...f, name: data.fields.some(old => old.name.toLowerCase() === f.name.toLowerCase()) ? f.name + ' (automatic)' : f.name }))
  const fields = [...data.fields, ...added].map(normalizeField)
  const textFields = fields.filter(isTextCharacteristic)
  const trades = data.trades.map(trade => {
    const changes = textFields.flatMap(f => {
      const value = trade.values[f.id]
      if (value === undefined) return []
      const normalized = canonicalText(value)
      return normalized === value ? [] : [[f.id, normalized] as const]
    })
    const values = calculatedValues({ ...trade.values, ...Object.fromEntries(changes) }, data.contractMultipliers)
    return changes.length || values.tradeRR !== trade.values.tradeRR || values.realizedRR !== trade.values.realizedRR ? { ...trade, values } : trade
  })
  return fields.length === data.fields.length && fields.every((f, i) => f === data.fields[i]) && trades.every((t, i) => t === data.trades[i]) ? data : { ...data, fields, trades }
}
export function validateField(field: Field, fields: Field[]): string | undefined {
  if (!field.name.trim()) return 'Give this characteristic a name.'
  if (fields.some(f => f.id !== field.id && f.name.trim().toLowerCase() === field.name.trim().toLowerCase())) return 'A characteristic with this name already exists.'
  if ([field.min, field.max].some(v => v !== undefined && !Number.isFinite(v))) return 'Bounds must be valid numbers.'
  if (field.min !== undefined && field.max !== undefined && field.min > field.max) return 'Minimum cannot exceed maximum.'
  if (field.type === 'score' && (field.min === undefined || field.max === undefined)) return 'Scores need a minimum and maximum.'
  if (['score', 'integer'].includes(field.type) && [field.min, field.max].some(v => v !== undefined && !Number.isInteger(v))) return 'Use whole numbers for these bounds.'
}
export function parseBackup(input: unknown): JournalData {
  if (!input || typeof input !== 'object') throw new Error('This is not a Turbo Journal backup.')
  const d = input as JournalData
  if (d.version !== 1 || !Array.isArray(d.fields) || !Array.isArray(d.trades) || !d.journals || typeof d.journals !== 'object' || Array.isArray(d.journals)) throw new Error('Unsupported or incomplete backup.')
  const types = ['text', 'decimal', 'integer', 'percent', 'score', 'date', 'time']
  const unique = new Set<string>()
  for (const f of d.fields) {
    if (!f || typeof f.id !== 'string' || !f.id || ['__proto__', 'constructor', 'prototype'].includes(f.id) || unique.has(f.id) || typeof f.name !== 'string' || !types.includes(f.type) || !Array.isArray(f.options) || f.options.some(o => typeof o !== 'string') || [f.required, f.filter, f.analyze].some(b => typeof b !== 'boolean') || (f.archived !== undefined && typeof f.archived !== 'boolean') || (f.builtin !== undefined && typeof f.builtin !== 'boolean') || validateField(f, d.fields)) throw new Error('Backup contains invalid characteristics.')
    unique.add(f.id)
  }
  for (const f of defaultFields()) {
    const actual = d.fields.find(item => item.id === f.id)
    if (!actual && ['pnlUnit', 'tradeRR', 'realizedRR'].includes(f.id)) continue
    if (!actual || actual.type !== f.type || actual.builtin !== true) throw new Error('Backup is missing a default characteristic or has changed its type.')
  }
  unique.clear()
  for (const t of d.trades) {
    if (!t || typeof t.id !== 'string' || unique.has(t.id) || !t.values || typeof t.values !== 'object' || Array.isArray(t.values) || Object.values(t.values).some(v => typeof v !== 'string' && (typeof v !== 'number' || !Number.isFinite(v))) || typeof t.createdAt !== 'string' || typeof t.updatedAt !== 'string' || (t.demo !== undefined && typeof t.demo !== 'boolean')) throw new Error('Backup contains invalid trades.')
    unique.add(t.id)
  }
  for (const [date, entry] of Object.entries(d.journals)) {
    if (!validDate(date) || !entry || typeof entry.text !== 'string' || typeof entry.updatedAt !== 'string') throw new Error('Backup contains an invalid journal entry.')
  }
  if (!['dark', 'light'].includes(d.theme) || !['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].includes(d.currency)) throw new Error('Backup contains invalid display settings.')
  if (d.minimalist !== undefined && typeof d.minimalist !== 'boolean') throw new Error('Backup contains an invalid layout setting.')
  if (d.pnlDisplay !== undefined && !['dollars', 'points', 'both'].includes(d.pnlDisplay)) throw new Error('Invalid PnL display setting.')
  if (d.contractMultipliers !== undefined && (!d.contractMultipliers || typeof d.contractMultipliers !== 'object' || Array.isArray(d.contractMultipliers) || Object.entries(d.contractMultipliers).some(([key, value]) => !key.trim() || key !== key.trim().toUpperCase() || ['__PROTO__', 'CONSTRUCTOR', 'PROTOTYPE'].includes(key) || typeof value !== 'number' || !Number.isFinite(value) || value <= 0))) throw new Error('Invalid contract multipliers.')
  return normalizeCharacteristics(d)
}

export function migrateLegacy(rows: Record<string, unknown>[], attributes: unknown): JournalData {
  const data = initialData()
  const names = new Set(Array.isArray(attributes) ? attributes.filter((x): x is string => typeof x === 'string') : [])
  const tags = rows.map(row => {
    try { const value = JSON.parse(String(row.custom_tags || '{}')); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} } catch { return {} }
  })
  tags.forEach(tag => Object.keys(tag).forEach(name => names.add(name)))
  const custom = [...names].map((name, i) => ({ id: `legacy-field-${i}`, name: data.fields.some(f => f.name.toLowerCase() === name.toLowerCase()) ? `${name} (legacy)` : name, type: 'text' as const, options: [], required: false, filter: true, analyze: true }))
  data.fields.push(...custom)
  const mapping: Record<string, string> = { date: 'date', time_in: 'timeIn', time_out: 'timeOut', direction: 'direction', contract: 'contract', size: 'size', pnl: 'pnl', account: 'account', trade_type: 'strategy', confidence: 'confidence', execution: 'execution', notes: 'notes' }
  data.trades = rows.map((row, i) => {
    const values: Values = {}
    Object.entries(mapping).forEach(([old, id]) => { if (!isBlank(row[old])) values[id] = row[old] as Value })
    if (values.direction) values.direction = String(values.direction).toLowerCase() === 'short' ? 'Short' : 'Long'
    custom.forEach((f, index) => { const value = tags[i][[...names][index]]; if (!isBlank(value)) values[f.id] = String(value) })
    return { id: `legacy-${row.id ?? i}`, values, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  })
  return normalizeCharacteristics(data)
}
