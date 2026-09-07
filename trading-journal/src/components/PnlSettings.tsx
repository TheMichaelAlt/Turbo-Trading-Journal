import { useState } from 'react'
import { defaultMultipliers, type PnlDisplay } from '../lib/pnl'
import type { JournalData } from '../lib/model'
import './PnlSettings.css'

export default function PnlSettings({ data, update }: { data: JournalData; update: (change: (current: JournalData) => JournalData) => Promise<boolean> }) {
  const [symbol, setSymbol] = useState(''), [value, setValue] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const multipliers = { ...defaultMultipliers, ...data.contractMultipliers }
  return <section className="panel padded pnl-settings"><h2>PnL and risk / reward</h2>
    <p>Dollar PnL = total point PnL × contract multiplier. For partial exits, add points from every closed contract: two contracts at +10 and one at +5 means +25 points. Do not multiply that total by position size again.</p>
    <label className="pnl-setting-label">Dashboard PnL display<select value={data.pnlDisplay || 'dollars'} onChange={e => { const pnlDisplay = e.target.value as PnlDisplay; void update(current => ({ ...current, pnlDisplay })) }}><option value="dollars">Dollars</option><option value="points">Points</option><option value="both">Both</option></select></label>
    <p>Trade RR = target distance ÷ stop distance. Realized RR = point PnL ÷ (stop distance × initial position size). Use the original stop and initial size, even after scaling out. Existing dollar records remain dollars; ratios recalculate for old trades too, including retained stop/target values removed from Settings.</p>
    <details><summary>Contract multipliers ({data.currency} per full point per contract)</summary>
      <p>Defaults are CME USD multipliers. Unknown contracts need a mapping before conversion; no foreign-exchange conversion is performed. Symbols are case-insensitive. Futures symbols such as MNQU26 and continuous symbols such as @MNQ or MNQ1! use the root multiplier. An exact custom symbol overrides its root.</p>
      <div className="multiplier-list">{Object.entries(multipliers).sort(([a], [b]) => a.localeCompare(b)).map(([contract, amount]) => <div key={contract}><strong>{contract}</strong><span>{amount}</span><button className="secondary compact" onClick={() => { setSymbol(contract); setValue(String(amount)) }}>Edit {contract}</button>{Object.hasOwn(data.contractMultipliers || {}, contract) && <button className="secondary compact" disabled={busy} onClick={async () => { setBusy(true); try { await update(current => { const next = { ...current.contractMultipliers }; delete next[contract]; return { ...current, contractMultipliers: next } }) } finally { setBusy(false) } }}>{Object.hasOwn(defaultMultipliers, contract) ? 'Reset' : 'Remove'} {contract}</button>}</div>)}</div>
      <form className="multiplier-form" onSubmit={async e => {
        e.preventDefault(); const key = symbol.trim().toUpperCase().replace(/^[@/]/, ''), multiplier = Number(value)
        if (!key || !/^[A-Z0-9][A-Z0-9.!_/-]*$/.test(key) || ['CONSTRUCTOR', 'PROTOTYPE'].includes(key) || !Number.isFinite(multiplier) || multiplier <= 0) { setError('Enter a contract symbol and a positive, finite multiplier.'); return }
        setBusy(true); setError('')
        try { if (await update(current => ({ ...current, contractMultipliers: { ...current.contractMultipliers, [key]: multiplier } }))) { setSymbol(''); setValue('') } } finally { setBusy(false) }
      }}><label>Contract symbol<input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="e.g. CL" /></label><label>Value per point<input type="number" step="any" value={value} onChange={e => setValue(e.target.value)} /></label><button className="primary" disabled={busy}>Save multiplier</button></form>
      {error && <p role="alert" className="form-error">{error}</p>}
      <p>Changing a multiplier recalculates conversions and realized RR for matching historical trades. Original entered PnL is retained. <a href="https://www.cmegroup.com/articles/faqs/frequently-asked-questions-micro-e-mini-equity-index-futures.html" target="_blank" rel="noreferrer">CME specification reference</a></p>
    </details>
  </section>
}
