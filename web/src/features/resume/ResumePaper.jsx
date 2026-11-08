// ResumePreview.swift: the resume on a light sheet of paper, six tappable sections; empty ones invite a first line.

function Header({ title }) {
  return (
    <div className="paper__header">
      <span>{title}</span>
    </div>
  )
}

function Empty({ children }) {
  return <p className="paper__empty">+ {children}</p>
}

function Entry({ title, note, bullets = [] }) {
  return (
    <div className="paper__entry">
      <div className="paper__entry-head">
        <strong>{title}</strong>
        {note && <span>{note}</span>}
      </div>
      {bullets.filter(Boolean).map((b, i) => (
        <p key={i} className="paper__bullet">
          {b}
        </p>
      ))}
    </div>
  )
}

function Section({ onEdit, label, children }) {
  return (
    <button type="button" className="paper__section" onClick={onEdit} aria-label={`Edit ${label}`}>
      {children}
    </button>
  )
}

export default function ResumePaper({ resume, onEdit }) {
  const { contact } = resume
  const contactLine = [contact.email, contact.phone, ...contact.links].filter(Boolean).join(' · ')
  return (
    <div className="paper">
      <Section label="contact" onEdit={() => onEdit('contact')}>
        <p className="paper__name">{contact.name || 'Your name'}</p>
        {contactLine ? <p className="paper__faint">{contactLine}</p> : <Empty>Add your email and links</Empty>}
      </Section>

      <Section label="summary" onEdit={() => onEdit('summary')}>
        <Header title="Summary" />
        {resume.summary ? <p className="paper__text">{resume.summary}</p> : <Empty>Add a one-line summary</Empty>}
      </Section>

      <Section label="experience" onEdit={() => onEdit('experience')}>
        <Header title="Experience" />
        {resume.experience.length ? (
          resume.experience.map((e, i) => (
            <Entry key={i} title={[e.role, e.org].filter(Boolean).join(', ')} note={[e.start, e.end].filter(Boolean).join(' – ')} bullets={e.bullets} />
          ))
        ) : (
          <Empty>Add a role</Empty>
        )}
      </Section>

      <Section label="education" onEdit={() => onEdit('education')}>
        <Header title="Education" />
        {resume.education.length ? (
          resume.education.map((e, i) => <Entry key={i} title={[e.school, e.program].filter(Boolean).join(', ')} note={e.year} />)
        ) : (
          <Empty>Add a school</Empty>
        )}
      </Section>

      <Section label="projects" onEdit={() => onEdit('projects')}>
        <Header title="Projects" />
        {resume.projects.length ? (
          resume.projects.map((p, i) => <Entry key={i} title={p.name} note={p.link} bullets={p.bullets} />)
        ) : (
          <Empty>Add a project</Empty>
        )}
      </Section>

      <Section label="skills" onEdit={() => onEdit('skills')}>
        <Header title="Skills" />
        {resume.skills.length ? <p className="paper__text">{resume.skills.join(' · ')}</p> : <Empty>Add your skills</Empty>}
      </Section>
    </div>
  )
}
