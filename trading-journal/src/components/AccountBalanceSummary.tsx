import { isComplete, type JournalData } from '../lib/model'
import { accountReport } from '../lib/accounts'
import { money } from '../lib/format'
export default function AccountBalanceSummary({ data }: { data: JournalData }) {
  if (!data.accounts?.length) return null
  const complete = new Set(data.trades.filter(t => isComplete(t, data.fields)).map(t => t.id))
  const reports = data.accounts.map(a => accountReport(a, data, undefined, complete))
  const balance = reports.filter(r => !r.notStarted && r.stage !== 'closed').reduce((sum, r) => sum + r.balance, 0)
  const costs = reports.reduce((sum, r) => sum + r.costs, 0), received = reports.reduce((sum, r) => sum + r.cash, 0)
  return <section className="panel padded" style={{ marginBottom: 24 }} aria-label="Managed account overview"><h2>Managed account overview</h2><p>All managed accounts through today, independent of the trade filters below. See Account manager for individual balances and actions.</p><div className="account-detail-grid"><div><span>Active trading balances</span><strong>{money(balance, data.currency)}</strong></div><div><span>Real costs</span><strong>{money(costs, data.currency)}</strong></div><div><span>Actual payouts</span><strong>{money(received, data.currency)}</strong></div><div><span>Net real cash</span><strong>{money(received - costs, data.currency)}</strong></div></div>{reports.some(r => r.skipped || r.unfinished) && <p className="help-text">Balances exclude unfinished trades and records without a usable date or PnL conversion.</p>}</section>
}
