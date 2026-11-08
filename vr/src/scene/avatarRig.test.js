import { describe, expect, it } from 'vitest'
import { getMorph, hasMorph, setMorph } from './avatarRig.js'

// Avatar exporters disagree on morph target spelling. Getting this wrong gives
// an avatar that never blinks and never opens its mouth, with no error anywhere,
// so each naming convention we have actually seen in the wild is pinned here.
const meshWith = (names) => ({
  morphTargetDictionary: Object.fromEntries(names.map((n, i) => [n, i])),
  morphTargetInfluences: names.map(() => 0),
  userData: {},
})

describe('morph target name resolution', () => {
  it.each([
    ['ARKit camelCase', ['eyeBlinkLeft', 'eyeBlinkRight', 'jawOpen']],
    ['ARKit underscore', ['eyeBlink_L', 'eyeBlink_R', 'jawOpen']],
    ['lowercase underscore', ['eyeblink_l', 'eyeblink_r', 'jawopen']],
    ['dotted', ['eyeBlink.L', 'eyeBlink.R', 'jaw.Open']],
  ])('drives eyeBlinkLeft on a %s rig', (_label, names) => {
    const mesh = meshWith(names)
    setMorph([mesh], 'eyeBlinkLeft', 1)
    expect(mesh.morphTargetInfluences[0]).toBe(1)
    expect(getMorph([mesh], 'eyeBlinkLeft')).toBe(1)
  })

  it('matches Left/Right against _L/_R in both directions', () => {
    const underscored = meshWith(['mouthSmile_R'])
    setMorph([underscored], 'mouthSmileRight', 0.5)
    expect(underscored.morphTargetInfluences[0]).toBe(0.5)

    const camel = meshWith(['mouthStretchLeft'])
    setMorph([camel], 'mouthStretch_L', 0.25)
    expect(camel.morphTargetInfluences[0]).toBe(0.25)
  })

  it('reports viseme support regardless of spelling', () => {
    expect(hasMorph([meshWith(['viseme_aa'])], 'viseme_aa')).toBe(true)
    expect(hasMorph([meshWith(['visemeAA'])], 'viseme_aa')).toBe(true)
    expect(hasMorph([meshWith(['jawOpen'])], 'viseme_aa')).toBe(false)
  })

  it('ignores unknown morphs instead of throwing', () => {
    const mesh = meshWith(['jawOpen'])
    expect(() => setMorph([mesh], 'viseme_kk', 1)).not.toThrow()
    expect(mesh.morphTargetInfluences[0]).toBe(0)
  })

  it('does not confuse distinct shapes that share a prefix', () => {
    const mesh = meshWith(['mouthSmileLeft', 'mouthSmileRight'])
    setMorph([mesh], 'mouthSmileLeft', 1)
    expect(mesh.morphTargetInfluences[0]).toBe(1)
    expect(mesh.morphTargetInfluences[1]).toBe(0)
  })
})
