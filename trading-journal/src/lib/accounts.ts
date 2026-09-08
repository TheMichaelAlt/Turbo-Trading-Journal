import type { JournalData } from './model.ts'
import { convertedPnl } from './pnl.ts'

export type AccountStage = 'eval' | 'funded' | 'closed'
export type AccountAction = 'purchase' | 'fee' | 'reset' | 'funded' | 'payout' | 'adjustment' | 'peak' | 'closed'
export interface AccountEvent {
  id: string; at: string; type: AccountAction; cost: number; notes: string
  balance?: number; peak?: number; withdrawal?: number; share?: number; received?: number; stage?: 'eval' | 'funded'
}
export interface PropAccount {
  id: string; name: string; firm: string; openedAt: string; startingBalance: number; initialStage: 'eval' | 'funded'
  maxDrawdown?: number; dailyLossLimit?: number; drawdownMode: 'static' | 'eod' | 'live'; payoutShare: number; notes: string; events: AccountEvent[]
}
export const accountKey = (value: unknown) => String(value ?? '').trim().toUpperCase()
export const localStamp = () => {
  const d = new Date(), pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const actionNames: Record<AccountAction, string> = { purchase: 'Account purchase', fee: 'Fee / subscription', reset: 'Account reset', funded: 'Move to funded / activation', payout: 'Payout', adjustment: 'Balance reconciliation', peak: 'Observed equity high', closed: 'Close account' }
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const positive = (v: unknown) => finite(v) && v >= 0
const stamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(v) && Number(v.slice(0, 4)) > 0 && !Number.isNaN(Date.parse(v.slice(0, 10))) && new Date(v.slice(0, 10)).toISOString().slice(0, 10) === v.slice(0, 10)
export function accountError(a: PropAccount): string | undefined {
  if (!a || typeof a.id !== 'string' || !a.id || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 100 || typeof a.firm !== 'string' || typeof a.notes !== 'string') return 'Enter an account name (up to 100 characters).'
  if (!stamp(a.openedAt) || !positive(a.startingBalance)) return 'Enter a valid opening date/time and nonnegative starting balance.'
  if (!['eval', 'funded'].includes(a.initialStage) || !['static', 'eod', 'live'].includes(a.drawdownMode)) return 'Choose the account stage and drawdown mode.'
  if ([a.maxDrawdown, a.dailyLossLimit].some(v => v !== undefined && (!finite(v) || v <= 0))) return 'Drawdown and daily loss limits must be positive, or left blank.'
  if (!positive(a.payoutShare) || a.payoutShare > 100) return 'Payout share must be between 0 and 100%.'
}
export function eventError(e: AccountEvent): string | undefined {
  if (!e || typeof e.id !== 'string' || !e.id || !Object.hasOwn(actionNames, e.type) || !stamp(e.at) || typeof e.notes !== 'string' || !positive(e.cost)) return 'Enter a valid action date/time and nonnegative cash cost.'
  if (e.balance !== undefined && !finite(e.balance)) return 'Balance must be a valid number.'
  if (['reset', 'adjustment'].includes(e.type) && !finite(e.balance)) return 'Enter the new trading balance.'
  if (e.type === 'peak' && !finite(e.peak) || e.peak !== undefined && !finite(e.peak)) return 'Enter a valid observed equity high.'
  if (e.type === 'reset' && !['eval', 'funded'].includes(e.stage || '')) return 'Choose the stage after reset.'
  if (e.type === 'payout' && (!finite(e.withdrawal) || e.withdrawal <= 0 || !finite(e.share) || e.share < 0 || e.share > 100 || !positive(e.received))) return 'Enter a positive balance deduction, a share from 0–100%, and nonnegative cash received.'
  if (e.withdrawal !== undefined && !positive(e.withdrawal) || e.share !== undefined && (!finite(e.share) || e.share < 0 || e.share > 100) || e.received !== undefined && !positive(e.received)) return 'Invalid payout amounts.'
}
export function validateAccounts(value: unknown): void {
  if (value === undefined) return
  if (!Array.isArray(value)) throw new Error('Backup contains invalid accounts.')
  const names = new Set<string>(), ids = new Set<string>()
  for (const a of value as PropAccount[]) {
    const error = accountError(a)
    if (error || names.has(accountKey(a.name)) || ids.has(a.id) || !Array.isArray(a.events)) throw new Error(error || 'Backup contains duplicate or invalid accounts.')
    names.add(accountKey(a.name)); ids.add(a.id)
    const events = new Set<string>()
    for (const event of a.events) {
      const message = eventError(event)
      if (message || events.has(event.id)) throw new Error(message || 'Backup contains duplicate account actions.')
      events.add(event.id)
    }
  }
}
export function accountNames(data: JournalData): string[] {
  return [...new Set([...(data.accounts || []).map(a => a.name), ...data.trades.map(t => t.values.account), ...(data.fields.find(f => f.id === 'account')?.options || [])].map(accountKey).filter(Boolean))].sort()
}
export interface AccountLedgerRow { id: string; at: string; label: string; notes: string; pnl?: number; cost: number; cash: number; withdrawal: number; balance: number; stage: AccountStage; event?: AccountEvent }
export function accountReport(account: PropAccount, data: JournalData, asOf = localStamp().slice(0, 10), completeIds?: Set<string>) {
  const cutoff = `${asOf}T23:59:59`, start = account.openedAt.padEnd(19, ':00')
  const actions = account.events.filter(e => e.at <= cutoff)
  let costs = 0, cash = 0, withdrawals = 0, pnl = 0, balance = account.startingBalance, base = balance, peak = balance, maxObservedDrawdown = 0, stage: AccountStage = account.initialStage
  let skipped = 0, beforeOpening = 0, unfinished = 0
  const transactions: { order: number; at: string; id: string; pnl?: number; event?: AccountEvent; label: string; notes: string }[] = actions.map((e, order) => ({ order, at: e.at.length === 16 ? e.at + ':00' : e.at, id: e.id, event: e, label: actionNames[e.type], notes: e.notes }))
  for (const t of data.trades.filter(t => accountKey(t.values.account) === accountKey(account.name))) {
    if (completeIds && !completeIds.has(t.id)) { unfinished++; continue }
    const day = String(t.values.date || ''), entry = String(t.values.timeIn || '00:00'), exit = String(t.values.timeOut || t.values.timeIn || '00:00')
    let at = `${day}T${exit.length === 5 ? exit + ':00' : exit}`
    if (!stamp(at)) { skipped++; continue }
    if (exit < entry) { const next = new Date(day); next.setUTCDate(next.getUTCDate() + 1); at = next.toISOString().slice(0, 10) + at.slice(10) }
    if (at > cutoff) continue
    if (at < start) { beforeOpening++; continue }
    const amount = convertedPnl(t.values, 'dollars', data.contractMultipliers)
    if (amount === undefined) { skipped++; continue }
    transactions.push({ order: transactions.length, at, id: t.id, pnl: amount, label: `Trade ${t.values.contract || ''}`, notes: String(t.values.notes || '') })
  }
  const daily = new Map<string, number>(), rows: AccountLedgerRow[] = []
  let previousDay = ''
  for (const item of transactions.sort((a, b) => a.at.localeCompare(b.at) || Number(!a.event) - Number(!b.event) || a.order - b.order)) {
    const day = item.at.slice(0, 10)
    if (account.drawdownMode === 'eod' && previousDay && previousDay !== day) peak = Math.max(peak, balance)
    previousDay = day
    const e = item.event
    let rowCost = 0, rowCash = 0, rowWithdrawal = 0
    if (e) {
      rowCost = e.cost; costs += rowCost
      if (e.type === 'payout') { rowCash = e.received || 0; rowWithdrawal = e.withdrawal || 0; cash += rowCash; withdrawals += rowWithdrawal; balance -= rowWithdrawal }
      if (e.type === 'reset' || e.type === 'funded') {
        if (e.balance !== undefined) balance = e.balance
        base = balance; peak = balance; stage = e.type === 'funded' ? 'funded' : e.stage || 'eval'
      }
      if (e.type === 'adjustment' && e.balance !== undefined) balance = e.balance
      if (e.type === 'peak' && e.peak !== undefined && account.drawdownMode === 'live') peak = Math.max(peak, e.peak)
      if (e.type === 'closed') stage = 'closed'
    } else if (item.pnl !== undefined) {
      balance += item.pnl; pnl += item.pnl
      const day = item.at.slice(0, 10); daily.set(day, (daily.get(day) || 0) + item.pnl)
    }
    if (account.drawdownMode !== 'eod') peak = Math.max(peak, balance)
    maxObservedDrawdown = Math.max(maxObservedDrawdown, peak - balance)
    rows.push({ ...item, cost: rowCost, cash: rowCash, withdrawal: rowWithdrawal, balance, stage, event: e })
  }
  if (account.drawdownMode === 'eod' && previousDay && previousDay < localStamp().slice(0, 10)) peak = Math.max(peak, balance)
  const threshold = account.maxDrawdown === undefined ? undefined : (account.drawdownMode !== 'static' ? peak : base) - account.maxDrawdown
  return { balance, startingBalance: account.startingBalance, costs, cash, withdrawals, netCash: cash - costs, pnl, stage, peak, maxObservedDrawdown, threshold, drawdownRoom: threshold === undefined ? undefined : balance - threshold, dayPnl: daily.get(asOf) || 0, dllRoom: account.dailyLossLimit === undefined ? undefined : account.dailyLossLimit + Math.min(0, daily.get(asOf) || 0), rows: rows.reverse(), skipped, beforeOpening, unfinished, notStarted: account.openedAt > cutoff }
}
