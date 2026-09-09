import { useState } from 'react'
import { Keyboard } from 'lucide-react'
export default function RestoreTyping() {
  const [message, setMessage] = useState('')
  if (!window.journalAPI?.restoreTyping) return null
  return <span><button type="button" className="text-button" title="Restore keyboard focus without clearing your entry; save a local focus diagnostic" onClick={async () => {
    try {
      const result = await window.journalAPI!.restoreTyping!()
      setMessage(result.logged ? 'Focus restored. Click a field to type. Diagnostic saved locally.' : 'Focus restored. Click a field to type. Diagnostic could not be saved.')
    } catch { setMessage('Could not restore focus. Try switching to another window and back.') }
  }}><Keyboard size={14} />Restore typing</button>{message && <span role="status" className="help-text">{message}</span>}</span>
}
