// AskSkillitMenu.swift for a browser: a floating plus that fans out Voice, Type, File and Connect. Voice and Type open
// the Update sheet (on the mic, or ready to type), File sends a picked document through the same sheet, and Connect
// opens Connected apps. Escape or a click outside folds it back.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { FilePlus2, Keyboard, Link2, Mic, Plus } from 'lucide-react'
import { RESUME_ACCEPT } from '../../lib/client'
import { dictationSupported } from '../../lib/dictation'
import { handOffUpdate } from './handoff'
import './plus-menu.css'

// top to bottom; Voice sits nearest the button. Without a recognizer in this browser, Voice is left out.
const OPTIONS = [
  { id: 'connect', label: 'Connect', icon: Link2, hint: 'Bring work from GitHub, Notion and more' },
  { id: 'file', label: 'File', icon: FilePlus2, hint: 'Send a transcript, certificate or resume' },
  { id: 'type', label: 'Type', icon: Keyboard, hint: "Type what's new" },
  { id: 'voice', label: 'Voice', icon: Mic, hint: "Say what's new" },
].filter((o) => o.id !== 'voice' || dictationSupported)

export default function PlusMenu() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const picker = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onPointer = (e) => root.current && !root.current.contains(e.target) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  const openUpdate = (start) => {
    handOffUpdate(start)
    navigate('/roadmap/update')
  }

  const choose = (id) => {
    setOpen(false)
    if (id === 'voice') openUpdate({ listen: true })
    else if (id === 'type') openUpdate(null)
    else if (id === 'file') picker.current?.click()
    else navigate('/profile/connections')
  }

  const picked = (e) => {
    const file = e.target.files?.[0]
    // cleared so picking the same file again still fires a change
    e.target.value = ''
    if (file) openUpdate({ file })
  }

  return (
    <div ref={root} className={`plus-menu${open ? ' is-open' : ''}`}>
      <ul className="plus-menu__options" id="plus-menu-options" aria-hidden={!open}>
        {OPTIONS.map((option, i) => (
          // nearest the button moves first: Voice, then Type, File, Connect
          <li key={option.id} style={{ '--order': OPTIONS.length - 1 - i, '--distance': OPTIONS.length - i }}>
            <button type="button" className="plus-menu__option" onClick={() => choose(option.id)} tabIndex={open ? 0 : -1} title={option.hint}>
              <span className="plus-menu__label glass-strong">{option.label}</span>
              <span className="plus-menu__circle glass-strong">
                <option.icon size={20} strokeWidth={2.2} aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="plus-menu__toggle glass-strong"
        aria-label={open ? 'Close' : 'Add an update'}
        aria-expanded={open}
        aria-controls="plus-menu-options"
        onClick={() => setOpen((o) => !o)}
      >
        <Plus size={24} strokeWidth={2.4} aria-hidden />
      </button>
      <input ref={picker} type="file" accept={RESUME_ACCEPT} hidden onChange={picked} />
    </div>
  )
}
