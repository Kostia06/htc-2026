// The two resume layouts the server renders. "skillit" is the default; "plain" is for postings that want a bare,
// ATS-friendly page. The choice is a per-browser convenience, remembered per resume (base, or one tailored copy).
import { useState } from 'react'

export const TEMPLATES = [
  { id: 'skillit', title: 'Skillit' },
  { id: 'plain', title: 'Plain (ATS)' },
]

const key = (scope) => `skillit.resume-template.${scope}`

function read(scope) {
  try {
    const saved = localStorage.getItem(key(scope))
    return TEMPLATES.some((t) => t.id === saved) ? saved : 'skillit'
  } catch {
    return 'skillit'
  }
}

export function useTemplate(scope = 'base') {
  const [template, setTemplate] = useState(() => read(scope))
  const choose = (next) => {
    setTemplate(next)
    try {
      localStorage.setItem(key(scope), next)
    } catch {
      // private mode: the choice just isn't remembered
    }
  }
  return [template, choose]
}

/** fetches the file and hands it to the browser as a download */
export async function downloadFile(blobPromise, name) {
  const url = URL.createObjectURL(await blobPromise)
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
