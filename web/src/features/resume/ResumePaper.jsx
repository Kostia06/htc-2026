// ResumePreview.swift: the resume drawn the way the server's PDF draws it, in the chosen layout. Every section is
// tappable to edit; empty ones invite a first line. "skillit" follows the default template (centred navy header,
// Education → Experience → Projects → Skills); "plain" is the bare page.
import './paper.css'

const dates = (start, end) => [start, end].filter(Boolean).join(' – ')

function Empty({ children }) {
  return <p className="paper__empty">+ {children}</p>
}

function Entry({ title, subtitle, date, bullets = [] }) {
  return (
    <div className="paper__entry">
      <div className="paper__entry-head">
        <div>
          <p className="paper__entry-title">{title}</p>
          {subtitle && <p className="paper__entry-subtitle">{subtitle}</p>}
        </div>
        {date && <p className="paper__entry-date">{date}</p>}
      </div>
      {bullets.some(Boolean) && (
        <ul>
          {bullets.filter(Boolean).map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// a div acting as a button: a real <button> may not hold the headings and lists a resume section needs
function Section({ onEdit, label, title, children }) {
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onEdit()
  }
  return (
    <div role="button" tabIndex={0} className="paper__section" onClick={onEdit} onKeyDown={onKeyDown} aria-label={`Edit ${label}`}>
      {title && <h2 className="paper__section-title">{title}</h2>}
      {children}
    </div>
  )
}

// "Languages: Python, SQL" reads as a bold label; loose skills share one line
function SkillRows({ skills }) {
  const rows = skills.map((s) => /^([^:]{1,32}):\s*(.+)$/.exec(s)).filter(Boolean)
  const loose = skills.filter((s) => !/^([^:]{1,32}):\s*(.+)$/.test(s))
  return (
    <>
      {rows.map(([, key, value]) => (
        <p key={key} className="paper__skills">
          <strong>{key}:</strong> {value}
        </p>
      ))}
      {loose.length > 0 && <p className="paper__skills">{loose.join(', ')}</p>}
    </>
  )
}

export default function ResumePaper({ resume, template = 'skillit', onEdit }) {
  const plain = template === 'plain'
  const { contact } = resume
  const contactLine = (plain ? [contact.location, contact.email, contact.phone, ...contact.links] : [contact.location, contact.phone, contact.email, ...contact.links])
    .filter(Boolean)
    .join(plain ? '  ·  ' : ' | ')

  const education = (
    <Section key="education" label="education" title="Education" onEdit={() => onEdit('education')}>
      {resume.education.length ? (
        resume.education.map((e, i) =>
          plain ? (
            <Entry key={i} title={e.school} subtitle={e.program} date={e.year} />
          ) : (
            <Entry key={i} title={e.program || e.school} subtitle={e.program ? e.school : ''} date={e.year} />
          ),
        )
      ) : (
        <Empty>Add a school</Empty>
      )}
    </Section>
  )
  const experience = (
    <Section key="experience" label="experience" title="Experience" onEdit={() => onEdit('experience')}>
      {resume.experience.length ? (
        resume.experience.map((e, i) =>
          plain ? (
            <Entry key={i} title={[e.role, e.org].filter(Boolean).join(', ')} date={dates(e.start, e.end)} bullets={e.bullets} />
          ) : (
            <Entry key={i} title={e.role || e.org} subtitle={e.role ? e.org : ''} date={dates(e.start, e.end)} bullets={e.bullets} />
          ),
        )
      ) : (
        <Empty>Add a role</Empty>
      )}
    </Section>
  )
  const projects = (
    <Section key="projects" label="projects" title="Projects" onEdit={() => onEdit('projects')}>
      {resume.projects.length ? (
        resume.projects.map((p, i) => <Entry key={i} title={p.name} subtitle={plain ? '' : p.link} date={plain ? p.link : ''} bullets={p.bullets} />)
      ) : (
        <Empty>Add a project</Empty>
      )}
    </Section>
  )
  const skills = (
    <Section key="skills" label="skills" title="Skills" onEdit={() => onEdit('skills')}>
      {resume.skills.length ? plain ? <p className="paper__skills">{resume.skills.join(', ')}</p> : <SkillRows skills={resume.skills} /> : <Empty>Add your skills</Empty>}
    </Section>
  )
  const summary = plain ? (
    <Section key="summary" label="summary" title="Summary" onEdit={() => onEdit('summary')}>
      {resume.summary ? <p className="paper__text">{resume.summary}</p> : <Empty>Add a one-line summary</Empty>}
    </Section>
  ) : null

  return (
    <article className={`paper paper--${plain ? 'plain' : 'skillit'}`}>
      <header className="paper__header">
        <Section label="contact" onEdit={() => onEdit('contact')}>
          <p className="paper__name">{contact.name || 'Your name'}</p>
          {contactLine ? <p className="paper__contact">{contactLine}</p> : <Empty>Add your email and links</Empty>}
        </Section>
        {!plain && (
          <Section label="headline" onEdit={() => onEdit('summary')}>
            {resume.summary ? <p className="paper__headline">{resume.summary}</p> : <Empty>Add a one-line headline</Empty>}
          </Section>
        )}
      </header>
      {plain ? [summary, experience, education, projects, skills] : [education, experience, projects, skills]}
    </article>
  )
}
