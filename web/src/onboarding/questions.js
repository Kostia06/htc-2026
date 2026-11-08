// The onboarding questions. Each one is a single screen; most answers are a tap.
//   type: 'resume' (optional upload that pre-fills the rest), 'single' (pick one), 'multi' (pick up to `max`),
//         'text' (optional short answer)
//   other: lets people type their own option
//   when: only asked if it returns true for the answers so far

export const QUESTIONS = [
  {
    id: 'resume',
    title: 'Do you have a resume?',
    hint: "Upload it and we'll fill in the next questions for you. You can change anything before you finish.",
    type: 'resume',
  },
  {
    id: 'stage',
    title: 'Where are you right now?',
    hint: 'So your first actions fit where you are.',
    type: 'single',
    options: ['High school', 'University or college', 'Recently graduated', 'Working, want to switch', 'Something else'],
    other: true,
  },
  {
    id: 'school',
    title: 'What are you studying?',
    hint: 'Optional. School and program help us match events and companies.',
    type: 'text',
    fields: [
      { id: 'school', label: 'School', placeholder: 'e.g. University of Calgary', autoComplete: 'organization' },
      { id: 'program', label: 'Program', placeholder: 'e.g. Computer Science' },
      { id: 'graduation', label: 'Expected to finish', placeholder: 'e.g. 2027' },
    ],
    when: (a) => ['High school', 'University or college'].includes(a.stage),
  },
  {
    id: 'roles',
    title: 'What role do you want to get into?',
    hint: 'Pick up to 3.',
    type: 'multi',
    max: 3,
    options: [
      'Software developer',
      'Web developer',
      'Data analyst',
      'Data scientist / AI',
      'UX / UI designer',
      'Product manager',
      'IT support',
      'Cybersecurity',
      'Not sure yet',
    ],
    other: true,
  },
  {
    id: 'situation',
    title: 'How is the search going so far?',
    hint: 'Skillit starts from where you actually are.',
    type: 'single',
    options: ['Just starting, no idea where to begin', 'Applying, but no callbacks', 'Getting interviews', 'Have a job, looking for the next one'],
  },
  {
    id: 'skills',
    title: 'What can you already do?',
    hint: 'Tap anything that fits, or add your own.',
    type: 'multi',
    max: 20,
    options: ['JavaScript', 'Python', 'Java', 'SQL', 'React', 'HTML / CSS', 'Git', 'Excel', 'Figma', 'Communication', 'Teamwork', 'Public speaking'],
    other: true,
  },
  {
    id: 'where',
    title: 'Where are you looking?',
    hint: 'Skillit picks local events and companies.',
    type: 'single',
    options: ['Calgary', 'Remote', 'Anywhere in Canada'],
    other: true,
  },
  {
    id: 'time',
    title: 'How much time can you give it each week?',
    hint: 'We size your weekly plan to this.',
    type: 'single',
    options: ['1–2 hours', '3–5 hours', '6+ hours'],
  },
]

export const visibleQuestions = (answers) => QUESTIONS.filter((q) => !q.when || q.when(answers))
