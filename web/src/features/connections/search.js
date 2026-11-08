// WorkConnection.matches in SkillitKit: a service is found by its name, or by the kind of work ("design", "video").
const TERMS = {
  code: ['code', 'coding', 'programming', 'developer', 'software', 'repos'],
  design: ['design', 'portfolio', 'art', 'ui', 'visual'],
  writing: ['writing', 'notes', 'blog', 'articles', 'docs'],
  documents: ['documents', 'docs', 'files', 'slides', 'sheets'],
  video: ['video', 'videos', 'film', 'channel'],
}

export function matches(connection, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return connection.name.toLowerCase().includes(needle) || (TERMS[connection.category] ?? []).some((term) => term.startsWith(needle))
}
