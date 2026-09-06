import { type JournalData, type Trade, today } from './model.ts'
export function addDemo(data: JournalData): JournalData {
  const fields = [...data.fields]
  let mood = fields.find(f => f.name.toLowerCase() === 'mood' && f.type === 'text' && !f.archived)
  if (!mood) {
    mood = { id: 'demo-mood', name: fields.some(f => f.name.toLowerCase() === 'mood') ? 'Demo mood' : 'Mood', type: 'text', required: false, filter: true, analyze: true, options: ['Focused', 'Calm', 'Tired', 'Frustrated'] }
    fields.push(mood)
  }
  const trades: Trade[] = []
  for (let i = 0; i < 64; i++) {
    const d = new Date(`${today()}T12:00:00`); d.setDate(d.getDate() - 31 + Math.floor(i / 2))
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const contract = i % 3 === 0 ? 'NQ' : 'ES', strategy = ['Breakout', 'Pullback', 'Reversal'][i % 3]
    const pnl = i % 7 < 4 ? 95 + (i * 43 % 480) : -(70 + (i * 37 % 300))
    trades.push({ id: `demo-${i}`, demo: true, createdAt: `${date}T10:00:00`, updatedAt: `${date}T10:00:00`, values: {
      date, timeIn: i % 2 ? '10:15' : '09:35', timeOut: i % 2 ? '10:42' : '09:58', direction: i % 4 ? 'Long' : 'Short', contract: i % 5 === 0 ? 'NQ' : contract,
      size: i % 3 + 1, pnl, account: 'Sim', strategy, stopLoss: 5 + i % 8, takeProfit: 12 + i % 12, confidence: i % 5 + 1, execution: (i + 2) % 5 + 1,
      ddRatio: i * 7 % 100, mhpResilience: Number(((i * 17 % 300) - 150.5).toFixed(1)) + 1, hpResilience: i * 13 % 300 - 150, hgResilience: i * 11 % 300 - 150,
      setupGrade: ['A+', 'A', 'B+', 'B', 'A-'][i % 5], [mood.id]: ['Focused', 'Calm', 'Tired', 'Frustrated'][i % 4], notes: 'Sample trade — explore filters and characteristic breakdowns.',
    } })
  }
  return { ...data, fields, trades: [...data.trades.filter(t => !t.demo), ...trades] }
}
