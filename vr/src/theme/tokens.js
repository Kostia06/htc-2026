// The one place the VR room's look is defined. Every panel, button and badge in
// the headset reads from here, so it stays the same app as the phone.
//
// Colours are copied from ios/Skillit/DesignSystem/Theme.swift and
// web/src/styles/tokens.css. Meaning matters more than hue: sage only ever means
// "press this", sand is anything the interviewer (the AI) is doing, teal is good,
// coral needs work.

export const color = {
  ground: '#0f1311',
  raised: '#1c211d',
  inset: '#242925',
  chip: '#2b322d',
  secondaryButton: '#3b423c',

  action: '#a8c7a3',
  onAction: '#140d29',
  agent: '#e3d1ad',
  positive: '#94dbe6',
  negative: '#ff9e94',

  // The phone draws secondary text as white at 60% / 30%. Panels here are
  // opaque, so those are pre-mixed onto `raised` and nothing has to sort.
  text: '#f4f6f4',
  text2: '#989d99',
  text3: '#5a5f5b',
  hairline: '#2f3530',
}

// The darker (or, for dark faces, lighter) side under a raised face. Same rule
// as RaisedSurfaceStyle's `ledge`: light faces mix 35% black, dark ones 8% white.
export const ledgeColor = {
  [color.action]: '#6d816a',
  [color.agent]: '#948871',
  [color.positive]: '#608e96',
  [color.negative]: '#a66760',
  [color.raised]: '#2e332f',
  [color.chip]: '#3c423e',
  [color.secondaryButton]: '#4b524c',
}

export const ledgeOf = (face) => ledgeColor[face] ?? '#000000'

// Under the ray, a face lightens a touch instead of glowing.
const hoverColor = {
  [color.action]: '#b4cfaf',
  [color.secondaryButton]: '#4a504b',
  [color.chip]: '#3b413c',
  [color.negative]: '#ffa89f',
}
export const hoverOf = (face) => hoverColor[face] ?? face

// The phone is designed in points; one point here is 1.8 mm. At the ~1.3 m the
// panels float, that keeps the phone's type ramp readable through Quest 3 lenses
// (17 pt body is ~1.35 degrees tall, comfortably above the ~1 degree floor).
export const PT = 0.0018
const pt = (n) => n * PT

export const type = {
  score: pt(64),
  largeTitle: pt(34),
  title: pt(28),
  title2: pt(22),
  title3: pt(20),
  headline: pt(17),
  body: pt(17),
  callout: pt(16),
  subhead: pt(15),
  footnote: pt(13),
  caption: pt(12),
}

// Inter stands in for SF Pro (which cannot be redistributed); Nunito stands in
// for SF Rounded, which the phone uses for every big number.
export const font = {
  regular: '/fonts/Inter-Regular.woff',
  semibold: '/fonts/Inter-SemiBold.woff',
  bold: '/fonts/Inter-Bold.woff',
  rounded: '/fonts/Nunito-ExtraBold.woff',
}

export const radius = {
  card: pt(20),
  button: pt(16),
  key: pt(14),
}

// Real thickness, in metres, so the UI belongs in the office instead of
// looking pasted on: panels are slabs with softened edges, keys stand proud
// of them (their sides in the phone's ledge colour), chips are low pills.
export const depth = {
  panel: 0.018,
  panelBevel: 0.004,
  key: 0.007,
  keyBevel: 0.002,
  chip: 0.003,
}

// Pointer feedback in metres: the key comes toward the ray on hover and
// travels most of the way into the panel on press. Movement only, never a
// scale wobble or a glow.
export const travel = {
  hover: 0.0025,
  press: -0.005,
}

export const space = {
  xs: pt(4),
  s: pt(8),
  m: pt(16),
  l: pt(24),
  xl: pt(36),
}

export const size = {
  // 52 pt is ~9 cm here: well over the ~5 cm a ray needs to hit without aiming
  buttonHeight: pt(52),
}

export const motion = {
  fadeOut: 0.22,
  fadeIn: 0.35,
  press: { stiffness: 520, damping: 46 }, // damping = 2√stiffness: critically damped
}

// Score bands. Teal is good, coral needs work; between, plain text so the
// accent and outcome colours keep their meaning.
export function scoreTone(value) {
  if (value >= 70) return color.positive
  if (value < 50) return color.negative
  return color.text
}
