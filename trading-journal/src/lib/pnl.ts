import type { JournalData, Trade, Values } from './model.ts'

export type PnlDisplay = 'dollars' | 'points' | 'both'
// CME dollars per full index point, per contract (not per tick).
export const defaultMultipliers: Record<string, number> = { MNQ: 2, NQ: 20, MES: 5, ES: 50, M2K: 5, RTY: 50, MYM: 0.5, YM: 5, CL: 1000, MCL: 100, GC: 100, MGC: 10 }
export const pnlUnit = (values: Values) => String(values.pnlUnit || 'DOLLARS').trim().toUpperCase() === 'POINTS' ? 'points' : 'dollars'
const numeric = (value: unknown) => value === undefined || value === null || String(value).trim() === '' || !Number.isFinite(Number(value)) ? undefined : Number(value)
export function contractMultiplier(contract: unknown, overrides: Record<string, number> = {}): number | undefined {
  const key = String(contract ?? '').trim().toUpperCase().replace(/^[@/]/, '')
  const multipliers = { ...defaultMultipliers, ...overrides }
  // Exact custom symbols take priority. Only recognize explicit futures month codes
  // or continuous suffixes; never guess by prefix (MES must not match ES).
  const root = key.replace(/(?:[FGHJKMNQUVXZ]\d{1,4}|[12]!|\.C)$/i, '')
  const value = Object.hasOwn(multipliers, key) ? multipliers[key] : Object.hasOwn(multipliers, root) ? multipliers[root] : undefined
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined
}
export function convertedPnl(values: Values, unit: 'dollars' | 'points', overrides: Record<string, number> = {}): number | undefined {
  const value = numeric(values.pnl)
  if (value === undefined) return undefined
  if (pnlUnit(values) === unit) return value
  const multiplier = contractMultiplier(values.contract, overrides)
  if (multiplier === undefined) return undefined
  const result = unit === 'dollars' ? value * multiplier : value / multiplier
  return Number.isFinite(result) ? result : undefined
}
export function calculatedValues(values: Values, overrides: Record<string, number> = {}): Values {
  const next = { ...values }
  delete next.tradeRR; delete next.realizedRR
  const stop = numeric(values.stopLoss), target = numeric(values.takeProfit), size = numeric(values.size)
  if (stop !== undefined && stop > 0) {
    if (target !== undefined && target >= 0 && Number.isFinite(target / stop)) next.tradeRR = target / stop
    const points = convertedPnl(values, 'points', overrides)
    if (points !== undefined && size !== undefined && size > 0 && Number.isFinite(stop * size) && Number.isFinite(points / (stop * size))) next.realizedRR = points / (stop * size)
  }
  return next
}
// A display projection only: the original recorded amount and unit remain intact.
export function pnlTrades(trades: Trade[], unit: 'dollars' | 'points', data: Pick<JournalData, 'contractMultipliers'>): Trade[] {
  return trades.map(trade => {
    const values = { ...trade.values }, pnl = convertedPnl(values, unit, data.contractMultipliers)
    if (pnl === undefined) delete values.pnl; else values.pnl = pnl
    return { ...trade, values }
  })
}
