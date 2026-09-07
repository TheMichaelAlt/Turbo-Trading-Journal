import { activeFields, isCalculated, canonicalText, fieldError, isBlank, isNumeric, tradeIssues, validDate, type Field, type JournalData, type Trade, type Values } from './model.ts'

export type DateOrder = 'ymd' | 'mdy' | 'dmy'
export interface ImportOptions { dateOrder: DateOrder; decimal: '.' | ','; fractionalPercent: boolean; skipDuplicates: boolean }
export interface CsvRow { line: number; cells: string[] }
export interface CsvData { headers: string[]; rows: CsvRow[]; delimiter: string }
export interface ImportRow { id: string; line: number; values: Values; errors: string[]; missing: string[]; duplicate: boolean; empty: boolean; included: boolean }
export const defaultImportOptions: ImportOptions = { dateOrder: 'ymd', decimal: '.', fractionalPercent: false, skipDuplicates: true }

export function parseCsv(input: string, delimiter?: string): CsvData {
  const text = input.replace(/^\uFEFF/, '')
  if (!delimiter) {
    const counts = new Map([[',', 0], [';', 0], ['\t', 0]])
    let quoted = false
    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      if (c === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted }
      else if (!quoted && (c === '\n' || c === '\r')) { if ([...counts.values()].some(Boolean)) break }
      else if (!quoted && counts.has(c)) counts.set(c, counts.get(c)! + 1)
    }
    delimiter = [...counts].sort((a, b) => b[1] - a[1])[0][0]
  }
  if (![',', ';', '\t'].includes(delimiter)) throw new Error('Choose comma, semicolon, or tab as the separator.')
  const records: CsvRow[] = []
  let cells: string[] = [], value = '', quoted = false, closed = false, line = 1, start = 1
  const cell = () => { cells.push(value); value = ''; closed = false; if (cells.length > 200) throw new Error('CSV files can contain up to 200 columns.') }
  const row = () => { cell(); if (cells.some(v => v.trim() !== '')) records.push({ line: start, cells }); cells = []; if (records.length > 10001) throw new Error('Import up to 10,000 trades at a time. Split this file into smaller files.') }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { value += '"'; i++ } else { quoted = false; closed = true } }
      else { value += c; if (c === '\n' || (c === '\r' && text[i + 1] !== '\n')) line++ }
    } else if (c === delimiter) cell()
    else if (c === '\r' || c === '\n') { row(); if (c === '\r' && text[i + 1] === '\n') i++; line++; start = line }
    else if (closed) { if (c !== ' ' && c !== '\t') throw new Error(`Unexpected text after a closing quote on line ${line}.`) }
    else if (c === '"') { if (value !== '') throw new Error(`Unexpected quote on line ${line}. Quote the entire cell and double any quotes inside it.`); quoted = true }
    else value += c
  }
  if (quoted) throw new Error(`Unclosed quoted cell starting in the record on line ${start}.`)
  if (value !== '' || cells.length || closed) row()
  if (records.length < 2) throw new Error('The file needs a header row and at least one non-empty trade row.')
  const headers = records.shift()!.cells.map((name, i) => name.trim() || `Column ${i + 1}`)
  for (const record of records) if (record.cells.length !== headers.length) throw new Error(`Line ${record.line} has ${record.cells.length} columns; the header has ${headers.length}. Check the separator and quoted cells.`)
  return { headers, rows: records, delimiter }
}

const headerKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const aliases: Record<string, string[]> = {
  date: ['trade date', 'entry date', 'open date'], timeIn: ['entry time', 'time in', 'open time'], timeOut: ['exit time', 'time out', 'close time'],
  direction: ['side', 'long short', 'buy sell'], contract: ['symbol', 'ticker', 'instrument'], size: ['qty', 'quantity', 'position size', 'contracts'],
  pnl: ['profit', 'profit loss', 'net pnl', 'net profit', 'realized pnl', 'p l'], account: ['account name'], strategy: ['trade type', 'setup'], notes: ['note', 'comments', 'comment'],
}
export function suggestMappings(headers: string[], fields: Field[]): string[] {
  const used = new Set<string>()
  return headers.map(header => {
    const key = headerKey(header)
    const candidates = activeFields(fields).filter(f => !isCalculated(f) && !used.has(f.id) && [f.name, f.id, ...(aliases[f.id] || [])].some(name => headerKey(name) === key))
    if (candidates.length !== 1) return ''
    used.add(candidates[0].id)
    return candidates[0].id
  })
}

export function convertImportValue(raw: string, field: Field, options: ImportOptions): string | number {
  if (field.id === 'notes') return raw
  const text = raw.trim()
  if (!text) return ''
  if (field.type === 'date') {
    // ISO dates are always unambiguous. No timezone or locale guessing.
    if (validDate(text)) return text
    const match = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/.exec(text)
    if (match) {
      const [a, b, c] = match.slice(1)
      const [year, month, day] = options.dateOrder === 'ymd' ? [a, b, c] : options.dateOrder === 'mdy' ? [c, a, b] : [c, b, a]
      const formatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      if (year.length === 4 && validDate(formatted)) return formatted
    }
    return text
  }
  if (field.type === 'time') {
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(text)
    if (match) {
      let hour = Number(match[1])
      if (match[4]) { if (hour < 1 || hour > 12) return text; hour = hour % 12 + (match[4].toUpperCase() === 'PM' ? 12 : 0) }
      const time = `${String(hour).padStart(2, '0')}:${match[2]}${match[3] ? ':' + match[3] : ''}`
      if (!fieldError(field, time)) return time
    }
    return text
  }
  if (isNumeric(field)) {
    const explicitPercent = /%$/.test(text)
    let cleaned = text.replace(/[$€£¥]/g, '').trim()
    if (field.type === 'percent') cleaned = cleaned.replace(/%$/, '').trim()
    const negative = /^\(.*\)$/.test(cleaned)
    if (negative) cleaned = cleaned.slice(1, -1).trim()
    const pattern = options.decimal === '.' ? /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$|^[+-]?\.\d+$/ : /^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$|^[+-]?,\d+$/
    if (!pattern.test(cleaned) || (negative && /^[+-]/.test(cleaned))) return text
    cleaned = options.decimal === '.' ? cleaned.replaceAll(',', '') : cleaned.replaceAll('.', '').replace(',', '.')
    let number = Number(cleaned) * (negative ? -1 : 1)
    if (field.type === 'percent' && options.fractionalPercent && !explicitPercent) number = Number((number * 100).toPrecision(15))
    return Number.isFinite(number) ? number : text
  }
  if (field.id === 'pnlUnit') return ['USD', '$', 'DOLLAR', 'DOLLARS'].includes(canonicalText(text)) ? 'DOLLARS' : ['PT', 'PTS', 'POINT', 'POINTS'].includes(canonicalText(text)) ? 'POINTS' : canonicalText(text)
  if (field.id === 'direction') {
    const value = canonicalText(text)
    return ['BUY', 'B', 'L', 'LONG'].includes(value) ? 'LONG' : ['SELL', 'S', 'SHORT'].includes(value) ? 'SHORT' : value
  }
  return canonicalText(text)
}

export function tradeFingerprint(values: Values): string {
  return JSON.stringify(Object.entries(values).filter(([id, value]) => !['tradeRR', 'realizedRR'].includes(id) && !(id === 'pnlUnit' && String(value).toUpperCase() === 'DOLLARS') && !isBlank(value)).sort(([a], [b]) => a.localeCompare(b)))
}
export function previewImport(csv: CsvData, mappings: string[], fields: Field[], existing: Trade[], options: ImportOptions, ids: string[], excluded: Set<number>, defaults: Record<string, string>, corrections: Record<number, Record<string, string>>): ImportRow[] {
  const mapped = mappings.filter(Boolean)
  if (!mapped.length) return []
  if (new Set(mapped).size !== mapped.length) throw new Error('Each characteristic can be mapped to only one CSV column.')
  const active = activeFields(fields).filter(f => !isCalculated(f)), known = new Set(active.map(f => f.id))
  if (mapped.some(id => !known.has(id))) throw new Error('A mapped characteristic is no longer active. Review the column mappings.')
  const seen = new Set(existing.map(t => tradeFingerprint(t.values)))
  return csv.rows.map((row, index) => {
    const raw: Values = {}
    mappings.forEach((id, col) => { if (id) raw[id] = row.cells[col] })
    active.forEach(f => { if (!mapped.includes(f.id) && defaults[f.id] !== undefined) raw[f.id] = defaults[f.id] })
    const converted: Values = {}
    active.forEach(f => { if (raw[f.id] !== undefined) converted[f.id] = convertImportValue(String(raw[f.id]), f, options) })
    // Preview cells display normalized journal units, so edits use those same units.
    active.forEach(f => { if (corrections[index]?.[f.id] !== undefined) converted[f.id] = convertImportValue(corrections[index][f.id], f, defaultImportOptions) })
    const values: Values = Object.fromEntries(Object.entries(converted).filter(([, value]) => !isBlank(value)))
    const issues = tradeIssues(values, fields)
    const errors = issues.filter(i => !isBlank(values[i.field.id])).map(i => `${i.field.name}: ${i.error}`)
    active.filter(f => isNumeric(f) && !isBlank(values[f.id]) && typeof values[f.id] !== 'number').forEach(f => errors.push(`${f.name}: Check the number format.`))
    const missing = issues.filter(i => isBlank(values[i.field.id])).map(i => i.field.name)
    const empty = Object.keys(values).length === 0, fingerprint = tradeFingerprint(values)
    const duplicate = seen.has(fingerprint)
    const included = !excluded.has(index) && !empty && !(options.skipDuplicates && duplicate)
    if (included) seen.add(fingerprint)
    return { id: ids[index], line: row.line, values, errors, missing, empty, duplicate, included }
  })
}

// Stable IDs make retries safe after an optimistic save failure. Existing trades are never overwritten.
export function applyImport(current: JournalData, fields: Field[], trades: Trade[]): JournalData {
  const knownFields = new Set(current.fields.map(f => f.id)), knownTrades = new Set(current.trades.map(t => t.id))
  const added = trades.filter(t => !knownTrades.has(t.id))
  const nextFields = [...current.fields, ...fields.filter(f => !knownFields.has(f.id))].map(field => {
    if (field.type !== 'text' || field.id === 'notes') return field
    const options = new Set(field.options)
    added.forEach(t => { if (!isBlank(t.values[field.id])) options.add(canonicalText(String(t.values[field.id]))) })
    return { ...field, options: [...options] }
  })
  return { ...current, fields: nextFields, trades: [...current.trades, ...added] }
}
