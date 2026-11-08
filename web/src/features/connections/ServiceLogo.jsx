// ServiceLogo.swift: the service's own logo on a tile in its brand colour. Unknown services fall back to their kind of work.
import { Code, FileText, Folder, Link, Palette, SquarePlay } from 'lucide-react'
import { DRIVE_LOGO, MONO_LOGOS } from './logos'

const ICONS = { code: Code, design: Palette, writing: FileText, documents: Folder, video: SquarePlay }

export default function ServiceLogo({ connection: c }) {
  if (c.id === 'googledrive') {
    return (
      <span className="logo logo--googledrive" aria-hidden>
        <svg viewBox="0 0 87.3 78">
          {DRIVE_LOGO.map(([fill, d]) => (
            <path key={d} fill={fill} d={d} />
          ))}
        </svg>
      </span>
    )
  }
  const path = MONO_LOGOS[c.id]
  if (!path) {
    const Icon = ICONS[c.category] ?? Link
    return (
      <span className="logo logo--other c-2" aria-hidden>
        <Icon size={20} strokeWidth={2.2} />
      </span>
    )
  }
  return (
    <span className={`logo logo--${c.id}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d={path} />
      </svg>
    </span>
  )
}
