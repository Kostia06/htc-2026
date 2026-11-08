// ResumePDFViewer.swift at /resume/pdf: the page the server renders in the chosen layout, shown in the browser's own
// viewer, with PDF and Word downloads.
import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router'
import { FileWarning } from 'lucide-react'
import { resumeApi } from '../../lib/client'
import { Spinner } from '../../ui/Button'
import { Segmented } from '../../ui/Controls'
import { ContentUnavailable } from '../../ui/Feedback'
import { Sheet } from '../../ui/Sheet'
import ExportButtons from './ExportButtons'
import { TEMPLATES } from './template'

export function PdfSheet({ back }) {
  const navigate = useNavigate()
  const { template, setTemplate } = useOutletContext()
  // the result is tagged with its layout, so switching layout reads as loading until the new page arrives
  const [result, setResult] = useState({ template: null })
  const state = result.template === template ? result : { phase: 'loading' }
  const [error, setError] = useState(null)

  useEffect(() => {
    let url = null
    let alive = true
    resumeApi.file({ format: 'pdf', template }).then(
      (blob) => {
        url = URL.createObjectURL(blob)
        if (alive) setResult({ template, phase: 'ready', url })
      },
      (e) => alive && setResult({ template, phase: 'failed', message: e.message }),
    )
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [template])

  return (
    <Sheet
      onClose={() => navigate(back)}
      size="large"
      className="pdf-sheet"
      header={{ title: 'Download resume' }}
      footer={
        <div className="stack pdf-sheet__footer">
          {error && <p className="t-footnote c-negative">{error}</p>}
          <ExportButtons fetchFile={resumeApi.file} name="Resume" template={template} onError={setError} />
        </div>
      }
    >
      <div className="pdf-sheet__layout">
        <Segmented label="Resume layout" options={TEMPLATES} value={template} onChange={setTemplate} />
      </div>
      {state.phase === 'loading' && (
        <div className="pdf-sheet__status c-agent" role="status">
          <Spinner size={22} />
          <p className="t-subhead">Making your PDF…</p>
        </div>
      )}
      {state.phase === 'failed' && <ContentUnavailable icon={FileWarning} title="Couldn't make the PDF" description={state.message} />}
      {state.url && <iframe className="pdf-sheet__frame" src={state.url} title="Resume PDF" />}
    </Sheet>
  )
}
