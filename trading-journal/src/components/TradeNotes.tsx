import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageSquareText } from 'lucide-react'
import { Modal } from './ui'
import './TradeNotes.css'

export default function TradeNotes({ text }: { text: string }) {
  const id = useId(), button = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const cancelClose = () => clearTimeout(timer.current)
  const closeSoon = () => { cancelClose(); timer.current = setTimeout(() => setPosition(null), 150) }
  const show = () => {
    cancelClose()
    if (expanded || !button.current) return
    const rect = button.current.getBoundingClientRect()
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 368)), top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 320)) })
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!position) return
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') setPosition(null) }
    const resize = () => setPosition(null)
    window.addEventListener('keydown', dismiss)
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('keydown', dismiss); window.removeEventListener('resize', resize) }
  }, [position])
  if (!text.trim()) return <span className="muted" aria-label="No notes">—</span>
  return <>
    <button ref={button} className="icon-button trade-notes-button" aria-label="Read trade notes" aria-describedby={position ? id : undefined} onMouseEnter={show} onMouseLeave={closeSoon} onFocus={show} onBlur={closeSoon} onClick={() => { cancelClose(); setPosition(null); setExpanded(true) }}><MessageSquareText size={17} /></button>
    {position && !expanded && createPortal(<div id={id} role="tooltip" className="trade-notes-preview" style={position} onMouseEnter={cancelClose} onMouseLeave={closeSoon}><strong>Trade notes</strong><div>{text}</div><small>Click the notes icon to open the full note.</small></div>, document.body)}
    {expanded && <Modal title="Trade notes" onClose={() => setExpanded(false)}><div className="trade-notes-full">{text}</div></Modal>}
  </>
}
