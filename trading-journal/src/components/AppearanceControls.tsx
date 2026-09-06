import { Maximize2, Moon, PanelBottom, Sun } from 'lucide-react'

export default function AppearanceControls({ theme, minimalist, onTheme, onMinimalist }: {
  theme: 'dark' | 'light'; minimalist: boolean; onTheme: () => void; onMinimalist: () => void
}) {
  return <div className="appearance-controls" aria-label="Appearance">
    <button type="button" className="appearance-toggle" onClick={onTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
    <button type="button" className="appearance-toggle layout-toggle" onClick={onMinimalist} aria-pressed={minimalist} aria-label={minimalist ? 'Exit minimalist mode' : 'Enable minimalist mode'} title={minimalist ? 'Return to full mode' : 'Compact trade entry along the bottom of your screen'}>
      {minimalist ? <Maximize2 size={16} /> : <PanelBottom size={16} />}<span>{minimalist ? 'Full mode' : 'Minimalist'}</span>
    </button>
  </div>
}
