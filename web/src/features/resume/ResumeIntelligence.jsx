import { useMemo, useState } from 'react'
import { ArrowUpRight, BarChart3, Check, Code2, FileCheck2, Lightbulb, Sparkles, Target } from 'lucide-react'
import { resumeApi, safeUrl } from '../../lib/client'
import { RaisedButton } from '../../ui/Button'
import { applyGeneratedResume, resumeToAnalysisText } from './resumeDoc'
import './resume-intelligence.css'

const LANGUAGES = ['Java', 'Python', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Go', 'Rust', 'Kotlin', 'SQL']
const TIME_OPTIONS = [
    { value: 10, label: '10 hours · Small project' },
    { value: 25, label: '25 hours · Short project' },
    { value: 50, label: '50 hours · Substantial project' },
    { value: 100, label: '100 hours · Advanced project' },
]

const asArray = (value) => (Array.isArray(value) ? value : [])
const displayDate = (value) => {
    if (!value) return 'Date unavailable'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
const bulletText = (value) => (typeof value === 'string' ? value : value?.text ?? '')

function Field({ label, children }) {
    return (
        <label className="career__field">
            <span>{label}</span>
            {children}
        </label>
    )
}

function Stat({ value, label }) {
    return (
        <div className="career__stat">
            <strong>{value}</strong>
            <span>{label}</span>
        </div>
    )
}

function JobMarketResults({ analysis }) {
    const skills = asArray(analysis?.skills).slice(0, 10)
    const sources = asArray(analysis?.sources)

    return (
        <section className="career__section">
            <div className="career__section-title">
                <BarChart3 size={17} aria-hidden />
                <div>
                    <h3>What employers are asking for</h3>
                    <p>{analysis?.postingsAnalyzed ?? 0} job postings analyzed</p>
                </div>
            </div>
            {skills.length ? (
                <div className="career__skills">
                    {skills.map((skill) => {
                        const percent = Math.max(0, Math.min(100, Number(skill.demandPercent) || 0))
                        return (
                            <div className="career__skill" key={skill.name}>
                                <div className="career__skill-head">
                                    <strong>{skill.name}</strong>
                                    <span>{percent}%</span>
                                </div>
                                <div className="career__track"><span style={{ width: `${percent}%` }} /></div>
                                <small>{skill.requiredCount ?? 0} required · {skill.preferredCount ?? 0} preferred</small>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <p className="career__empty">No skill requirements were extracted from the retrieved postings.</p>
            )}
            {sources.length > 0 && (
                <details className="career__details">
                    <summary>View job-posting sources ({sources.length})</summary>
                    <div className="career__source-list">
                        {sources.map((source, index) => {
                            const url = safeUrl(source.url)
                            return (
                                <div className="career__source" key={source.id ?? `${source.title}-${index}`}>
                                    <div><strong>{source.title || 'Job posting'}</strong><small>{source.company || 'Employer not listed'}</small></div>
                                    {url ? <a href={url} target="_blank" rel="noreferrer">View posting <ArrowUpRight size={13} /></a> : null}
                                </div>
                            )
                        })}
                    </div>
                </details>
            )}
            <p className="career__footnote">These frequencies describe the retrieved sample, not the entire labour market. Adzuna descriptions may be abbreviated. Job listings provided by <a href="https://www.adzuna.ca" target="_blank" rel="noreferrer">Jobs by Adzuna</a>.</p>
        </section>
    )
}

function ResumeAnalysisResults({ analysis }) {
    const skills = asArray(analysis?.skills)
    const experience = asArray(analysis?.experience)
    const projects = asArray(analysis?.projects)
    const education = asArray(analysis?.education)
    return (
        <section className="career__section">
            <div className="career__section-title">
                <FileCheck2 size={17} aria-hidden />
                <div>
                    <h3>What your resume currently shows</h3>
                    <p>The experience and skills extracted from the resume you provided</p>
                </div>
            </div>
            {analysis?.professionalHeadline && <p className="career__headline">{analysis.professionalHeadline}</p>}
            {skills.length > 0 && <div className="career__tags">{skills.map((skill) => <span key={typeof skill === 'string' ? skill : skill.name}>{typeof skill === 'string' ? skill : skill.name}</span>)}</div>}
            <div className="career__profile-grid">
                {experience.length > 0 && <div><strong>Experience</strong><ul>{experience.slice(0, 5).map((item, index) => <li key={index}>{[item.role, item.organization ?? item.org].filter(Boolean).join(' · ')}</li>)}</ul></div>}
                {projects.length > 0 && <div><strong>Projects</strong><ul>{projects.slice(0, 5).map((item, index) => <li key={index}>{item.name ?? item.title}</li>)}</ul></div>}
                {education.length > 0 && <div><strong>Education</strong><ul>{education.slice(0, 4).map((item, index) => <li key={index}>{[item.credential ?? item.program, item.institution ?? item.school].filter(Boolean).join(' · ')}</li>)}</ul></div>}
            </div>
            {!skills.length && !experience.length && !projects.length && !education.length && !analysis?.professionalHeadline && (
                <p className="career__empty">The analyzer did not return structured resume details.</p>
            )}
        </section>
    )
}

function EvidenceResults({ evidence }) {
    const assessments = asArray(evidence?.skillAssessments)
    const statusText = {
        demonstrated: 'Demonstrated',
        partially_demonstrated: 'Partial evidence',
        not_evidenced: 'Not evidenced',
    }
    return (
        <section className="career__section">
            <div className="career__section-title">
                <FileCheck2 size={17} aria-hidden />
                <div>
                    <h3>How your resume matches</h3>
                    <p>{assessments.length} employer requirements reviewed</p>
                </div>
            </div>
            {assessments.length ? (
                <div className="career__evidence-list">
                    {assessments.map((item, index) => (
                        <article className="career__evidence" key={`${item.skill}-${index}`}>
                            <div className="career__evidence-head">
                                <strong>{item.skill}</strong>
                                <span className={`career__status career__status--${item.status || 'unknown'}`}>
                  {statusText[item.status] || 'Needs review'}
                </span>
                            </div>
                            {item.explanation && <p>{item.explanation}</p>}
                            {asArray(item.resumeEvidence).length > 0 && (
                                <ul className="career__quotes">{item.resumeEvidence.map((quote, i) => <li key={i}>{quote}</li>)}</ul>
                            )}
                            {item.recommendedAction && <p className="career__action"><strong>Suggested next step:</strong> {item.recommendedAction}</p>}
                        </article>
                    ))}
                </div>
            ) : (
                <p className="career__empty">No evidence assessments were returned.</p>
            )}
            {asArray(evidence?.overallStrengths).length > 0 && (
                <div className="career__callout"><strong>Strengths to emphasize</strong><ul>{evidence.overallStrengths.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
            )}
            {asArray(evidence?.resumeContentIssues).length > 0 && (
                <div className="career__callout"><strong>Resume improvements</strong><ul>{evidence.resumeContentIssues.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
            )}
            <p className="career__footnote">“Not evidenced” means the resume does not currently show proof of a skill. It does not mean you do not have that skill.</p>
        </section>
    )
}

function ProjectResults({ recommendations, error }) {
    const ideas = asArray(recommendations?.ideas)
    const repositories = asArray(recommendations?.inspirationRepositories)
    return (
        <section className="career__section">
            <div className="career__section-title">
                <Lightbulb size={17} aria-hidden />
                <div>
                    <h3>Projects to close your skill gaps</h3>
                    <p>{ideas.length} personalized project ideas</p>
                </div>
            </div>
            {error && <p className="career__error-inline">Project recommendations could not be completed: {error}</p>}
            {ideas.length ? (
                <div className="career__project-list">
                    {ideas.map((idea, index) => (
                        <article className="career__project" key={`${idea.title}-${index}`}>
                            <div className="career__project-kicker">PROJECT {String(index + 1).padStart(2, '0')}</div>
                            <h4>{idea.title}</h4>
                            {idea.problem && <p>{idea.problem}</p>}
                            {idea.whyRelevant && <p className="career__action"><strong>Why this helps:</strong> {idea.whyRelevant}</p>}
                            {asArray(idea.technologies).length > 0 && <div className="career__tags">{idea.technologies.map((item) => <span key={item}>{item}</span>)}</div>}
                            {asArray(idea.features).length > 0 && <ListBlock title="Features to build" items={idea.features} />}
                            {asArray(idea.milestones).length > 0 && <ListBlock title="Suggested milestones" items={idea.milestones} ordered />}
                            {asArray(idea.deliverables).length > 0 && <ListBlock title="Portfolio deliverables" items={idea.deliverables} />}
                            {asArray(idea.resumeEvidence).length > 0 && <ListBlock title="Evidence you could add after completing it" items={idea.resumeEvidence} />}
                        </article>
                    ))}
                </div>
            ) : (
                <p className="career__empty">No project ideas were generated for this run.</p>
            )}
            {repositories.length > 0 && (
                <div className="career__repositories">
                    <h4>GitHub repositories for inspiration</h4>
                    <p>Use these to study approaches and ideas. Stars indicate community engagement, not verified project quality. Do not claim someone else's repository as your own work.</p>
                    {repositories.map((repo, index) => {
                        const url = safeUrl(repo.url ?? repo.htmlUrl ?? repo.html_url)
                        const name = repo.fullName ?? repo.full_name ?? repo.name ?? `Repository ${index + 1}`
                        const language = repo.primaryLanguage ?? repo.language
                        const stars = repo.stars ?? repo.stargazers_count ?? 0
                        const updated = repo.updatedAt ?? repo.updated_at
                        return (
                            <div className="career__repo" key={name}>
                                <div>
                                    <strong>{name}</strong>
                                    <small>{repo.description || 'No description provided'}</small>
                                    <small>{language || 'Language not specified'} · ★ {Number(stars).toLocaleString()} · Updated {displayDate(updated)}</small>
                                </div>
                                {url ? <a href={url} target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={13} /></a> : null}
                            </div>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

function ListBlock({ title, items, ordered = false }) {
    const List = ordered ? 'ol' : 'ul'
    return <div className="career__list-block"><strong>{title}</strong><List>{items.map((item, index) => <li key={index}>{item}</li>)}</List></div>
}

function ResumeDraft({ resume, onApply, applied, stale }) {
    const experience = asArray(resume?.experience)
    const projects = asArray(resume?.projects)
    const education = asArray(resume?.education)
    const certifications = asArray(resume?.certifications)
    return (
        <section className="career__section">
            <div className="career__section-title">
                <Sparkles size={17} aria-hidden />
                <div>
                    <h3>Your tailored resume draft</h3>
                    <p>Review the wording and evidence before applying it to your saved resume.</p>
                </div>
            </div>
            <div className="career__draft">
                {resume?.professionalSummary && <div><h4>Professional summary</h4><p>{resume.professionalSummary}</p></div>}
                {asArray(resume?.technicalSkills).length > 0 && <div><h4>Technical skills</h4><p>{resume.technicalSkills.join(' · ')}</p></div>}
                {experience.length > 0 && <div><h4>Experience</h4>{experience.map((item, index) => <article key={index}><strong>{[item.role, item.organization ?? item.org].filter(Boolean).join(' · ')}</strong>{item.dates && <small>{item.dates}</small>}<ul>{asArray(item.bullets).map((bullet, i) => <li key={i}>{bulletText(bullet)}{bullet?.supportingEvidence && <small className="career__proof">Evidence: {bullet.supportingEvidence}</small>}</li>)}</ul></article>)}</div>}
                {projects.length > 0 && <div><h4>Projects</h4>{projects.map((item, index) => <article key={index}><strong>{item.name}</strong>{asArray(item.technologies).length > 0 && <small>{item.technologies.join(' · ')}</small>}<ul>{asArray(item.bullets).map((bullet, i) => <li key={i}>{bulletText(bullet)}{bullet?.supportingEvidence && <small className="career__proof">Evidence: {bullet.supportingEvidence}</small>}</li>)}</ul></article>)}</div>}
                {education.length > 0 && <div><h4>Education</h4>{education.map((item, index) => <p key={index}><strong>{item.credential ?? item.program}</strong>{item.institution || item.school ? ` · ${item.institution ?? item.school}` : ''}{item.dates || item.year ? ` · ${item.dates ?? item.year}` : ''}</p>)}</div>}
                {certifications.length > 0 && <div><h4>Certifications</h4><ul>{certifications.map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.name ?? JSON.stringify(item)}</li>)}</ul></div>}
            </div>
            {asArray(resume?.improvementNotes).length > 0 && <div className="career__callout"><strong>What changed</strong><ul>{resume.improvementNotes.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
            {asArray(resume?.questionsForUser).length > 0 && <div className="career__callout"><strong>Questions that could strengthen your resume</strong><ul>{resume.questionsForUser.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
            {asArray(resume?.claimsToVerify).length > 0 && <div className="career__warning"><strong>Verify before submitting</strong><ul>{resume.claimsToVerify.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
            {certifications.length > 0 && <p className="career__footnote">Your current resume editor does not have a dedicated certifications field. Those items remain visible in this draft but are not copied into the saved resume.</p>}
            <div className="career__apply-row">
                <RaisedButton variant="agent" onClick={onApply} disabled={applied || stale}>
                    {applied ? <><Check size={16} /> Applied to resume</> : stale ? 'Re-analyze before applying' : 'Apply supported sections to my resume'}
                </RaisedButton>
                <span>Applying does not submit your resume to an employer.</span>
            </div>
        </section>
    )
}

export default function ResumeIntelligence({ resume, onApply }) {
    const resumeText = useMemo(() => resumeToAnalysisText(resume), [resume])
    const [targetRole, setTargetRole] = useState('Backend Developer Intern')
    const [location, setLocation] = useState('Calgary, AB')
    const [preferredLanguages, setPreferredLanguages] = useState(['Java', 'Python'])
    const [timeBudgetHours, setTimeBudgetHours] = useState(25)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [result, setResult] = useState(null)
    const [analyzedResumeText, setAnalyzedResumeText] = useState('')
    const [applied, setApplied] = useState(false)

    const canAnalyze = targetRole.trim().length > 1 && location.trim().length > 0 && resumeText.trim().length > 0 && !busy
    const isStale = Boolean(result && analyzedResumeText !== resumeText)

    function toggleLanguage(language) {
        setPreferredLanguages((current) => current.includes(language)
            ? current.filter((item) => item !== language)
            : [...current, language])
    }

    async function analyze(event) {
        event.preventDefault()
        if (!canAnalyze) return
        setBusy(true)
        setError('')
        setApplied(false)
        try {
            const response = await resumeApi.analyze({
                targetRole: targetRole.trim(),
                location: location.trim(),
                resumeText,
                preferredLanguages,
                timeBudgetHours: Number(timeBudgetHours),
            })
            if (response?.success === false) throw new Error(response.error || 'Resume analysis failed.')
            const data = response?.data ?? response
            if (!data?.jobAnalysis || !data?.resumeAnalysis || !data?.evidenceMatch || !data?.tailoredResume) {
                throw new Error('The analysis endpoint returned an incomplete result. Check that the backend returns jobAnalysis, resumeAnalysis, evidenceMatch and tailoredResume.')
            }
            setResult(data)
            setAnalyzedResumeText(resumeText)
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'An unexpected error occurred.')
        } finally {
            setBusy(false)
        }
    }

    function applyDraft() {
        if (!result?.tailoredResume || !onApply) return
        onApply(applyGeneratedResume(result.tailoredResume, resume))
        setApplied(true)
    }

    return (
        <section className="card stack career" aria-label="Career and resume intelligence">
            <header className="career__intro">
                <h2 className="t-headline row"><Target size={17} aria-hidden /> Career suggestor</h2>
                <p className="t-footnote c-2">Compare your resume with real job postings, identify evidence gaps, discover project ideas and create a role-specific resume draft.</p>
            </header>

            <form className="career__form" onSubmit={analyze}>
                <div className="career__fields">
                    <Field label="Target job role">
                        <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} maxLength={120} placeholder="e.g. Backend Developer Intern" />
                    </Field>
                    <Field label="Job location">
                        <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={100} placeholder="Calgary, AB" />
                    </Field>
                </div>
                <Field label="Preferred programming languages">
                    <div className="career__language-grid">
                        {LANGUAGES.map((language) => (
                            <label className={`career__language ${preferredLanguages.includes(language) ? 'is-selected' : ''}`} key={language}>
                                <input type="checkbox" checked={preferredLanguages.includes(language)} onChange={() => toggleLanguage(language)} />
                                <span>{language}</span>
                            </label>
                        ))}
                    </div>
                </Field>
                <Field label="Time available for a project">
                    <select value={timeBudgetHours} onChange={(event) => setTimeBudgetHours(Number(event.target.value))}>
                        {TIME_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                    </select>
                </Field>
                <div className="career__submit-row">
                    <div className="career__resume-status">
                        <Code2 size={15} aria-hidden />
                        <span>{resumeText.length.toLocaleString()} characters from your current resume</span>
                    </div>
                    <RaisedButton variant="agent" type="submit" disabled={!canAnalyze} busy={busy}>
                        <Sparkles size={16} aria-hidden /> {busy ? 'Analyzing…' : result ? 'Run analysis again' : 'Analyze my career fit'}
                    </RaisedButton>
                </div>
            </form>

            {!resumeText.trim() && <p className="career__empty">Add some experience, projects, skills or a summary to your resume before running the analysis.</p>}
            {error && <p className="career__error" role="alert">{error}</p>}
            {busy && <p className="career__loading" role="status">Researching job postings, reviewing your resume, matching evidence and generating project ideas. This can take a little while.</p>}

            {result && (
                <div className="career__results">
                    {isStale && <p className="career__warning">Your resume has changed since this analysis. Run it again for results based on your latest edits.</p>}
                    <div className="career__stats">
                        <Stat value={result.jobAnalysis.postingsAnalyzed ?? 0} label="Job postings" />
                        <Stat value={asArray(result.jobAnalysis.skills).length} label="Skills detected" />
                        <Stat value={asArray(result.evidenceMatch.skillAssessments).filter((item) => item.status !== 'demonstrated').length} label="Evidence gaps" />
                        <Stat value={asArray(result.projectRecommendations?.ideas).length} label="Project ideas" />
                    </div>
                    <JobMarketResults analysis={result.jobAnalysis} />
                    <ResumeAnalysisResults analysis={result.resumeAnalysis} />
                    <EvidenceResults evidence={result.evidenceMatch} />
                    <ProjectResults recommendations={result.projectRecommendations} error={result.projectRecommendationError} />
                    <ResumeDraft resume={result.tailoredResume} onApply={applyDraft} applied={applied} stale={isStale} />
                    <p className="career__footnote">AI guidance is a starting point, not a guarantee of employment. Verify all skills, dates, metrics and claims. Complete recommended projects before adding them to your experience.</p>
                </div>
            )}
        </section>
    )
}
