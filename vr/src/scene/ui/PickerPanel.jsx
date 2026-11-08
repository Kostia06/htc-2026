import { Card, Label, RaisedButton, space, type } from '../../theme/index.js'
import { canAddCompany } from '../../interview/picker.js'

const WIDTH = 0.6
const INNER = WIDTH - space.xl * 2
const CHIP_H = 0.05
const GAP = 0.012
const ROW = CHIP_H + GAP
const MAX_CHARS = 26

const short = (text) => (text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text)
// Troika lays text out off-thread, so chip widths are estimated from the label
const chipWidth = (text) => Math.min(INNER, short(text).length * type.subhead * 0.56 + 0.05)

// Chips left to right, wrapping at the card's inner width.
function flow(labels) {
  const spots = []
  let x = 0
  let row = 0
  for (const label of labels) {
    const w = chipWidth(label)
    if (x > 0 && x + w > INNER) {
      x = 0
      row += 1
    }
    spots.push({ x: x + w / 2, row, w })
    x += w + GAP
  }
  return { spots, rows: labels.length ? row + 1 : 0 }
}

/**
 * The phone's "Interview for", beside the menu: postings, target roles, a
 * local company for a role, then length and difficulty. `picker` is usePicker.
 */
export function PickerPanel({ picker, reducedMotion, ...props }) {
  const sections = []
  const postings = picker.targets.filter((t) => t.kind === 'posting')
  const jobs = picker.targets.filter((t) => t.kind === 'job')
  const target = picker.target
  if (postings.length) sections.push({ title: 'Your postings', items: postings.map((t) => ({ key: t.key, label: t.company ? `${t.title} · ${t.company}` : t.title, on: target?.key === t.key, press: () => picker.pickTarget(t.key) })) })
  // real postings near the person; picking one saves it, and the interview is built from its description
  if (jobs.length) sections.push({ title: 'Real jobs near you', items: jobs.map((t) => ({ key: t.key, label: t.company ? `${t.title} · ${t.company}` : t.title, on: picker.savingJob === t.key, press: () => picker.pickTarget(t.key) })) })
  if (canAddCompany(target) && picker.companies.length) {
    sections.push({ title: 'A company near you', items: picker.companies.map((c) => ({ key: c.slug, label: c.name, on: picker.companySlug === c.slug, press: () => picker.pickCompany(c.slug) })) })
  }
  sections.push({ title: 'Length', items: [['quick', 'Quick'], ['full', 'Full']].map(([id, label]) => ({ key: id, label, on: picker.length === id, press: () => picker.setLength(id) })) })
  sections.push({ title: 'Difficulty', items: [['easy', 'Easy'], ['standard', 'Standard'], ['hard', 'Hard']].map(([id, label]) => ({ key: id, label, on: picker.difficulty === id, press: () => picker.setDifficulty(id) })) })

  // lay out top-down from below the title and summary
  let y = 0.1
  const placed = sections.map((section) => {
    const { spots, rows } = flow(section.items.map((i) => i.label))
    const at = { ...section, titleY: y, chipsY: y + 0.032, spots }
    y += 0.032 + rows * ROW + 0.014
    return at
  })
  const height = space.xl * 2 + y
  const left = -WIDTH / 2 + space.xl
  const top = height / 2 - space.xl

  return (
    <group {...props}>
      <Card width={WIDTH} height={height}>
        <Label variant="headline" anchorX="left" anchorY="top" position={[left, top, 0]}>
          Interview for
        </Label>
        <Label variant="subhead" tone="text2" anchorX="left" anchorY="top" maxWidth={INNER} position={[left, top - 0.04, 0]}>
          {picker.summary}
        </Label>
        {placed.map((section) => (
          <group key={section.title}>
            <Label variant="footnote" tone="text2" anchorX="left" anchorY="top" position={[left, top - section.titleY, 0]}>
              {section.title}
            </Label>
            {section.items.map((item, i) => {
              const spot = section.spots[i]
              return (
                <RaisedButton
                  key={item.key}
                  label={short(item.label)}
                  tone={item.on ? 'action' : 'chip'}
                  variant="subhead"
                  width={spot.w}
                  height={CHIP_H}
                  radius={CHIP_H / 2}
                  onPress={item.press}
                  reducedMotion={reducedMotion}
                  position={[left + spot.x, top - section.chipsY - spot.row * ROW - CHIP_H / 2, 0.003]}
                />
              )
            })}
          </group>
        ))}
      </Card>
    </group>
  )
}
