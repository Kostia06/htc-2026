// The resume builder at /resume: the resume as a sheet of paper (tap a section to edit it), where it stands against
// the saved copy, importing from a file, the coach's rewrites and the PDF. On wide screens the paper and the tools
// sit side by side.
import { useRef } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { CircleCheck, FileText, FileUp, TriangleAlert, UserRound } from 'lucide-react'
import { relative } from '../../lib/format'
import { RESUME_ACCEPT } from '../../lib/client'
import { RaisedButton, Spinner, TextButton } from '../../ui/Button'
import { ContentUnavailable, SkeletonLines } from '../../ui/Feedback'
import { BarButton, Page, PageHeader } from '../../ui/Layout'
import Coach from './Coach'
import TailoredList from './tailored/TailoredList'
import { useTailoredList } from './tailored/useTailoredList'
import ResumePaper from './ResumePaper'
import { useResume } from './useResume'
import './resume.css'
import './tailored/tailored.css'

export default function Resume() {
  const navigate = useNavigate()
  const doc = useResume()
  const tailored = useTailoredList()
  const picker = useRef(null)
  const { resume } = doc
  const canExport = doc.source === 'saved' && doc.saving !== 'failed'

  return (
    <Page wide className="builder">
      <PageHeader
        title="Resume"
        large
        actions={
          resume && (
            <>
              <BarButton icon={FileUp} label="Import" showLabel onClick={() => picker.current?.click()} disabled={doc.importing} />
              <BarButton icon={FileText} label="PDF" showLabel onClick={() => navigate('/resume/pdf')} disabled={!canExport} />
            </>
          )
        }
      />
      <input
        ref={picker}
        type="file"
        accept={RESUME_ACCEPT}
        hidden
        onChange={(e) => {
          doc.importFile(e.target.files?.[0])
          e.target.value = '' // so picking the same file again still counts as a change
        }}
      />

      {doc.phase === 'loading' && (
        <div className="paper paper--skeleton">
          <SkeletonLines widths={[0.5, 0.3]} highlighted={-1} />
          <SkeletonLines widths={[0.9, 0.8, 0.6]} highlighted={-1} />
          <SkeletonLines widths={[0.7, 0.9, 0.85, 0.4]} highlighted={2} />
        </div>
      )}

      {doc.phase === 'failed' && (
        <ContentUnavailable icon={FileText} title="Couldn't load your resume" description={doc.message}>
          <RaisedButton onClick={doc.load}>Try again</RaisedButton>
        </ContentUnavailable>
      )}

      {resume && (
        <div className="builder__grid">
          <aside className="stack builder__tools">
            <Status doc={doc} onImport={() => picker.current?.click()} />
            {/* a new resume (another file, or a discard) starts the coach over; saving a draft doesn't */}
            <Coach key={doc.generation} resume={resume} onApply={doc.update} />
            <TailoredList list={tailored} />
          </aside>
          <div className="builder__paper">
            <ResumePaper resume={resume} onEdit={(section) => navigate(`/resume/edit/${section}`)} />
          </div>
        </div>
      )}

      <Outlet context={{ resume, update: doc.update, tailored }} />
    </Page>
  )
}

/** Where the resume on screen came from and whether it's kept: a file to check, the profile, or the saved copy. */
function Status({ doc, onImport }) {
  if (doc.importing)
    return (
      <section className="card row builder__status" role="status">
        <Spinner />
        <p className="t-subhead">Skillit is reading your file…</p>
      </section>
    )

  const importProblem = doc.importError && (
    <p className="t-footnote c-negative row builder__warn">
      <TriangleAlert size={15} strokeWidth={2.4} aria-hidden /> {doc.importError}
    </p>
  )

  if (doc.source === 'upload')
    return (
      <section className="card stack builder__status builder__status--draft">
        <p className="t-subhead">
          Read from <strong>{doc.file.name}</strong>. Check it, then save. Nothing is kept until you do.
          {doc.file.droppedClaims > 0 &&
            ` Skillit left out ${doc.file.droppedClaims} skill${doc.file.droppedClaims === 1 ? '' : 's'} it couldn't find in the file.`}
        </p>
        <div className="row builder__actions">
          <RaisedButton onClick={doc.save} busy={doc.saving === 'saving'}>
            Save as my resume
          </RaisedButton>
          <TextButton onClick={doc.discard}>Discard</TextButton>
        </div>
        {doc.saving === 'failed' && <p className="t-footnote c-negative">That didn&rsquo;t save. Try again.</p>}
      </section>
    )

  if (doc.source === 'profile')
    return (
      <section className="card stack builder__status">
        <p className="t-subhead row builder__from">
          <UserRound size={16} strokeWidth={2.4} aria-hidden /> Laid out from your profile. Save it, or edit any section, to keep it as your resume.
        </p>
        <div className="row builder__actions">
          <RaisedButton onClick={doc.save} busy={doc.saving === 'saving'}>
            Save
          </RaisedButton>
          <TextButton icon={FileUp} onClick={onImport}>
            Start from a file
          </TextButton>
        </div>
        {importProblem}
      </section>
    )

  return (
    <div className="stack builder__saved">
      {doc.saving === 'failed' ? (
        <p className="t-footnote c-action row builder__warn">
          <TriangleAlert size={15} strokeWidth={2.4} aria-hidden /> Your last change didn&rsquo;t save.
          <button type="button" className="t-footnote semibold c-action" onClick={doc.save}>
            Try again
          </button>
        </p>
      ) : (
        <p className="t-footnote c-2 row builder__saved-line">
          {doc.saving === 'saving' ? (
            'Saving…'
          ) : (
            <>
              <CircleCheck size={14} strokeWidth={2.4} aria-hidden /> Saved{doc.resume.updatedAt ? ` ${relative(doc.resume.updatedAt)}` : ''}. Changes show up in the app too.
            </>
          )}
        </p>
      )}
      {importProblem}
    </div>
  )
}
