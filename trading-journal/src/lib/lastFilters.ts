import type { Filters } from './analytics.ts'

export type LastFilters = Partial<Record<'dashboard' | 'master', { filters: Filters; search?: string }>>
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const date = (v: unknown) => typeof v === 'string' && (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) > 0 && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v)
export function validateLastFilters(value: unknown): void {
  if (value === undefined) return
  const invalid = () => { throw new Error('Backup contains invalid remembered filters.') }
  if (!object(value) || Object.keys(value).some(k => !['dashboard', 'master'].includes(k))) return invalid()
  for (const state of Object.values(value)) {
    if (!object(state) || state.search !== undefined && typeof state.search !== 'string') return invalid()
    const f = state.filters
    if (!object(f) || !date(f.from) || !date(f.to) || !Array.isArray(f.rules)) return invalid()
    const fields = new Set<string>()
    for (const r of f.rules) {
      if (!object(r) || typeof r.field !== 'string' || !r.field || fields.has(r.field) || ['value', 'min', 'max'].some(k => r[k] !== undefined && typeof r[k] !== 'string') || r.missing !== undefined && typeof r.missing !== 'boolean') return invalid()
      fields.add(r.field)
    }
  }
}
