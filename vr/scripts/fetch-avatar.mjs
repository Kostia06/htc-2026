#!/usr/bin/env node
// Puts a rigged humanoid GLB at public/avatars/interviewer.glb, then tells you
// what is actually inside it.
//
//   node scripts/fetch-avatar.mjs https://example.com/avatar.glb
//   node scripts/fetch-avatar.mjs ~/Downloads/avatar.glb
//   node scripts/fetch-avatar.mjs <url-or-file> --out public/avatars/other.glb
//
// Vendor-neutral on purpose: any rigged humanoid GLB works, because buildRig() in
// src/scene/avatarRig.js resolves bone names across vendors. What does differ
// between avatars is the facial morph targets, and that decides how the mouth
// moves:
//
//   viseme_*   Oculus visemes   src/scene/lipSync.js drives them directly
//   ARKit set  jawOpen etc.     Interviewer.jsx maps the visemes onto them
//   neither    the mouth does not move at all
//
// You cannot tell which you got by looking at the file, and the failure mode is
// silent — the avatar loads and renders perfectly, then sits there with a closed
// mouth. So this script parses the GLB and prints the answer.
//
// Ready Player Me shut down on 2026-01-31. Passing an RPM id or URL gets you a
// pointer to the alternatives, not a download.
//
// No dependencies: global fetch, Buffer and JSON.parse on plain Node 18+.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_OUT = resolve(HERE, '..', 'public', 'avatars', 'interviewer.glb')
const TIMEOUT_MS = 90_000

// Exactly the morph targets src/scene/Interviewer.jsx looks up by name. Anything
// else in the file is ignored by the scene, so the report only talks about these.
const ARKIT_SHAPES = [
  'jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker',
  'mouthStretchLeft', 'mouthStretchRight', 'mouthSmileLeft', 'mouthSmileRight',
]
const FACE_SHAPES = ['eyeBlinkLeft', 'eyeBlinkRight', 'browInnerUp', 'mouthSmile']

const USAGE = `usage: node scripts/fetch-avatar.mjs <url-or-file> [--out <path>]

  <url-or-file>  https://host/path/avatar.glb   download it
                 ./avatar.glb                   copy a local .glb/.gltf into place
  --out <path>   where to write (default: public/avatars/interviewer.glb)

Any rigged humanoid GLB works; facial morph targets (Oculus visemes or the ARKit
set) are what make the mouth move. Ready Player Me shut down on 2026-01-31 — see
README.md "The avatar" for where to get one now. Avaturn is the first thing to try.`

main().catch((err) => die(err?.message ?? String(err)))

async function main() {
  const { help, source, out } = parseArgs(process.argv.slice(2))
  if (help) {
    console.log(USAGE)
    return
  }
  if (!source) die(`no avatar given.\n\n${USAGE}`)

  refuseReadyPlayerMe(source)

  const { bytes, origin } = isUrl(source) ? await download(source) : await readLocal(source)

  // Validate before anything touches the disk. A 404 HTML page written to
  // interviewer.glb does not fail here — it fails much later and much more
  // confusingly, as an opaque GLTFLoader parse error inside the headset.
  const doc = parseAsset(bytes, origin, source)

  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, bytes)
  const mb = bytes.length / 1024 / 1024
  console.log(`wrote ${out} (${mb.toFixed(2)} MB)`)

  const notes = []
  if (mb < 0.1) {
    notes.push(
      `${bytes.length} bytes is very small for a rigged humanoid with textures.\n` +
        `         Check it renders in https://gltf-viewer.donmccurdy.com before trusting it.`,
    )
  }
  if (doc.kind === 'gltf') {
    notes.push(
      `that is a .gltf (JSON), not a self-contained .glb. GLTFLoader sniffs the\n` +
        `         content so the ${basename(out)} name is fine, but every external .bin and\n` +
        `         texture it references must sit next to it or the avatar loads untextured\n` +
        `         (or not at all). A single .glb is one file and cannot half-arrive.`,
    )
  }

  report(doc.json, notes)
}

function parseArgs(argv) {
  let source = null
  let out = DEFAULT_OUT

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') return { help: true }
    if (arg === '-o' || arg === '--out') {
      const value = argv[i + 1]
      if (!value || value.startsWith('-')) die('--out needs a path, e.g. --out public/avatars/interviewer.glb')
      out = resolve(process.cwd(), value)
      i += 1
      continue
    }
    if (arg.startsWith('--out=')) {
      const value = arg.slice('--out='.length)
      if (!value) die('--out needs a path, e.g. --out=public/avatars/interviewer.glb')
      out = resolve(process.cwd(), value)
      continue
    }
    if (arg.startsWith('-')) die(`unknown option ${arg}\n\n${USAGE}`)
    if (source) die(`expected one avatar, got two: "${source}" and "${arg}"`)
    source = arg
  }

  return { help: false, source, out }
}

// Declared as functions, not arrow consts: main() is invoked at the top of this
// module and reaches these before a `const` further down has initialised.
function isUrl(source) {
  return /^https?:\/\//i.test(source.trim())
}

// Ready Player Me was the whole pipeline until it was switched off. Fail loudly
// with somewhere to go, rather than letting a dead host time out at 3am.
function refuseReadyPlayerMe(source) {
  const raw = source.trim()
  let looksRpm = false

  if (isUrl(raw)) {
    try {
      looksRpm = /(^|\.)readyplayer\.me$/i.test(new URL(raw).hostname)
    } catch {
      die(`not a valid URL: ${source}`)
    }
  } else {
    // A bare token with no path separator and no file extension is an RPM id —
    // nothing else was ever passed to this script in that shape.
    looksRpm = /^[A-Za-z0-9_-]{8,64}$/.test(raw.replace(/\.glb$/i, '')) && !raw.includes('/')
  }

  if (!looksRpm) return

  die(
    `Ready Player Me shut down permanently on 2026-01-31 (acquired by Netflix).\n` +
      `The avatar creator, the developer API, models.readyplayer.me and PlayerZero\n` +
      `are all offline, so this cannot be fetched — not by this script, and not by\n` +
      `hand in a browser either:\n` +
      `  ${source}\n` +
      `Do not spend time on it.\n` +
      `\n` +
      `Where to get a rigged humanoid GLB now:\n` +
      `  Avaturn     https://avaturn.me — closest replacement. Realistic, exports GLB\n` +
      `              with ARKit blendshapes. Try this first.\n` +
      `  Rocketbox   https://github.com/microsoft/Microsoft-Rocketbox — 100+ realistic\n` +
      `              business-attire avatars, MIT, archived. FBX, so convert to GLB;\n` +
      `              no facial blendshapes, so no lip sync beyond the jaw.\n` +
      `  Mixamo      https://mixamo.com — rigged characters, FBX, no blendshapes.\n` +
      `  VRoid / VRM has visemes, but the anime styling reads wrong for an interview.\n` +
      `\n` +
      `Then re-run: npm run avatar -- <url-or-downloaded-file>\n` +
      `\n` +
      `Nothing is blocked on this. With no avatar file at all the scene runs its\n` +
      `built-in procedural figure, which breathes, blinks, tracks your head and lip\n` +
      `syncs. Do not let the avatar hold up anyone else's work.`,
  )
}

async function readLocal(source) {
  const path = resolve(process.cwd(), source.replace(/^~(?=\/|$)/, process.env.HOME ?? '~'))
  try {
    return { bytes: await readFile(path), origin: path }
  } catch (err) {
    if (err?.code === 'ENOENT') {
      die(`no such file: ${path}\n\nPass an https URL to a .glb, or a path to one on disk.\n\n${USAGE}`)
    }
    if (err?.code === 'EISDIR') die(`${path} is a directory, not a .glb file.`)
    die(`could not read ${path}: ${err?.message ?? err}`)
  }
}

async function download(url) {
  const host = (() => {
    try {
      return new URL(url).hostname
    } catch {
      die(`not a valid URL: ${url}`)
    }
  })()

  console.log(`fetching ${url}`)

  let res
  try {
    res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'model/gltf-binary,model/gltf+json,*/*' },
    })
  } catch (err) {
    const reason =
      err?.name === 'TimeoutError'
        ? `no response in ${TIMEOUT_MS / 1000}s`
        : (err?.cause?.message ?? err?.message ?? 'unknown network error')
    die(
      `could not reach ${host} (${reason}).\n` +
        `Check the URL and your connection, or download the file in a browser and\n` +
        `pass the local path instead: npm run avatar -- ~/Downloads/avatar.glb`,
    )
  }

  if (!res.ok) {
    const hint =
      res.status === 404
        ? '\nNothing at that URL. Many avatar hosts hand out short-lived download links —\nif this one came from an export dialog, re-export and use the fresh URL, or just\ndownload the file and pass the local path.'
        : res.status === 403 || res.status === 401
          ? '\nThe host refused the request. The file is probably behind a login or a signed\nURL; download it in a browser and pass the local path instead.'
          : ''
    die(`${host} returned ${res.status} ${res.statusText}.${hint}\n${describe(res)}${await bodySnippet(res)}`)
  }

  return { bytes: Buffer.from(await res.arrayBuffer()), origin: url, res }
}

// Sniffs the container from the bytes rather than trusting the extension, then
// validates it properly: a GLB must start with the "glTF" magic, a .gltf must
// parse as JSON and carry the required "asset" key.
function parseAsset(bytes, origin, source) {
  const magic = bytes.length >= 4 ? bytes.subarray(0, 4).toString('latin1') : ''
  const head = bytes.subarray(0, 400).toString('utf8')
  const looksJson = /^﻿?\s*\{/.test(head)
  const ext = extname(isUrl(origin) ? safePathname(origin) : origin).toLowerCase()

  if (magic === 'glTF') {
    if (ext === '.gltf') warn('that URL ends in .gltf but the bytes are a binary GLB. Harmless, carrying on.')
    return { kind: 'glb', json: parseGlb(bytes, origin) }
  }

  if (looksJson) {
    if (ext === '.glb') warn('that URL ends in .glb but the bytes are glTF JSON. Harmless, carrying on.')
    return { kind: 'gltf', json: parseGltfJson(bytes, origin) }
  }

  const snippet = head.replace(/\s+/g, ' ').trim().slice(0, 200)
  die(
    `that is not a GLB or a glTF.\n` +
      `  expected the first 4 bytes to be "glTF", got ${JSON.stringify(magic)}\n` +
      `  source: ${source}\n` +
      `  size: ${bytes.length} bytes\n` +
      (snippet ? `  starts with: ${snippet}\n` : '') +
      (/^<!doctype|^<html/i.test(snippet)
        ? `\nThat is an HTML page, not a model — a landing page, a login wall or a 404\nthat answered 200. Open the URL in a browser and find the real file link.\n`
        : '') +
      `Nothing was written.`,
  )
}

function safePathname(url) {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

// GLB is a 12-byte header (magic, version, total length) followed by
// length-prefixed chunks. The first chunk must be the JSON scene description,
// which is all this script needs — the binary buffers can stay opaque.
function parseGlb(bytes, origin) {
  if (bytes.length < 20) die(`${origin} is ${bytes.length} bytes — far too short to be a GLB. Nothing was written.`)

  const version = bytes.readUInt32LE(4)
  const declared = bytes.readUInt32LE(8)

  if (version !== 2) {
    warn(`GLB container version is ${version}, expected 2. three.js only reads glTF 2.0, so this probably will not load.`)
  }
  if (declared > bytes.length) {
    die(
      `truncated GLB: the header declares ${declared} bytes but only ${bytes.length} arrived.\n` +
        `The transfer was cut short. Re-run it — a partial GLB loads as a parse error\n` +
        `later, which is a much worse way to find out. Nothing was written.`,
    )
  }
  if (declared < bytes.length) {
    warn(`GLB header declares ${declared} bytes but the file is ${bytes.length}. Trailing junk; usually harmless.`)
  }

  const chunkLength = bytes.readUInt32LE(12)
  const chunkType = bytes.subarray(16, 20).toString('latin1')
  if (chunkType !== 'JSON') {
    die(`first GLB chunk is ${JSON.stringify(chunkType)}, expected "JSON". The file is malformed. Nothing was written.`)
  }
  if (20 + chunkLength > bytes.length) {
    die(`the GLB JSON chunk claims ${chunkLength} bytes but the file ends first — truncated download. Nothing was written.`)
  }

  const text = bytes.subarray(20, 20 + chunkLength).toString('utf8')
  let json
  try {
    json = JSON.parse(text)
  } catch (err) {
    die(`the GLB JSON chunk does not parse: ${err.message}. The file is corrupt. Nothing was written.`)
  }
  requireAsset(json, origin)
  return json
}

function parseGltfJson(bytes, origin) {
  let json
  try {
    json = JSON.parse(bytes.toString('utf8'))
  } catch (err) {
    die(`${origin} starts like JSON but does not parse: ${err.message}\nNothing was written.`)
  }
  requireAsset(json, origin)
  return json
}

function requireAsset(json, origin) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    die(`${origin} parsed as JSON but is not a glTF object. Nothing was written.`)
  }
  if (!json.asset) {
    die(
      `${origin} parsed as JSON but has no "asset" key, which glTF requires.\n` +
        `This is some other JSON file. Nothing was written.`,
    )
  }
  if (json.asset.version && !String(json.asset.version).startsWith('2')) {
    warn(`asset.version is ${json.asset.version}; three.js only reads glTF 2.0.`)
  }
}

// ---------------------------------------------------------------------------
// The report. Which morph target set an avatar ships is the single fact that
// decides whether the mouth works, and it is invisible until you look.
// ---------------------------------------------------------------------------

function report(json, notes = []) {
  const note = (message) => notes.push(message)
  const skins = json.skins ?? []
  const nodes = json.nodes ?? []
  const joints = new Set()
  for (const skin of skins) for (const j of skin.joints ?? []) joints.add(j)

  const { names, targetCount, unnamed, issues } = collectMorphTargets(json)
  const set = new Set(names)

  console.log('')
  console.log('what is in it:')

  if (joints.size) {
    const boneNames = [...joints].map((i) => nodes[i]?.name ?? '').filter(Boolean)
    console.log(`  rig          skinned mesh, ${joints.size} bones${sampleBones(boneNames)}`)
    const missing = ['hips', 'head'].filter((want) => !boneNames.some((n) => canonicalBone(n) === want))
    if (missing.length) {
      note(
        `no bone resolved as ${missing.join(' or ')}. buildRig() matches on name, so the\n` +
          `         seated pose${missing.includes('head') ? ' and the head/eye gaze' : ''} will not apply. Check the bone names in\n` +
          `         a glTF viewer against BONE_ALIASES in src/scene/avatarRig.js.`,
      )
    }
  } else {
    console.log('  rig          no skinned mesh, no bones')
    note(
      `this GLB has no skeleton. The seated pose and the procedural idle are bone\n` +
        `         rotations, so the avatar will render in whatever pose it was exported in\n` +
        `         and never move. You want a rigged humanoid.`,
    )
  }

  const visemes = names.filter((n) => n.startsWith('viseme_'))
  const arkit = ARKIT_SHAPES.filter((n) => set.has(n))
  const face = FACE_SHAPES.filter((n) => set.has(n))

  console.log(`  morphs       ${targetCount} morph target${targetCount === 1 ? '' : 's'}${unnamed ? `, ${unnamed} unnamed` : ''}`)

  if (visemes.length) {
    const direct = set.has('viseme_aa')
    console.log(`  lip sync     Oculus visemes (${visemes.length}), driven directly by lipSync.js`)
    for (const line of wrapList(visemes)) console.log(`               ${line}`)
    if (!direct) {
      note(
        `viseme_* shapes are present but viseme_aa is not, and that exact name is\n` +
          `         what Interviewer.jsx probes to choose the direct path. It will take the\n` +
          `         ARKit fallback instead. Rename the "aa" shape to viseme_aa.`,
      )
    }
  } else if (arkit.length) {
    console.log(`  lip sync     ARKit set (${arkit.length}/${ARKIT_SHAPES.length}) — no visemes, so Interviewer.jsx`)
    console.log(`               maps the visemes onto these`)
    for (const line of wrapList(arkit)) console.log(`               ${line}`)
    const absent = ARKIT_SHAPES.filter((n) => !set.has(n))
    for (const line of wrapList(absent, 'missing: ')) console.log(`               ${line}`)
  } else {
    console.log('  lip sync     none')
  }

  if (face.length) {
    const [first, ...rest] = wrapList(face)
    console.log(`  blink/brow   ${first}`)
    for (const line of rest) console.log(`               ${line}`)
  } else {
    console.log('  blink/brow   none (no eyeBlinkLeft/Right, browInnerUp or mouthSmile)')
  }

  // The near-miss case: the right shapes under the wrong spelling. setMorph()
  // looks names up exactly, so eyeBlink_L is as good as absent.
  const renames = nearMisses([...ARKIT_SHAPES, ...FACE_SHAPES], names, set)
  if (renames.length) {
    note(
      `these shapes exist under names the scene does not look up:\n` +
        renames.map(([want, got]) => `           ${got}  ->  rename to ${want}`).join('\n') +
        `\n         setMorph() matches exactly, so as exported they do nothing. Rename them\n` +
        `         in Blender (or whatever exported this) and re-run.`,
    )
  }

  if (!visemes.length && !arkit.length) {
    note(
      `no Oculus visemes and no ARKit shapes. The avatar will load and render, but\n` +
        `         its mouth will never move${face.length ? ' (blink and brow still work)' : ' and it will not blink either'}.\n` +
        `         Lip sync needs one of the two sets: re-export with blendshapes if the\n` +
        `         source has them, or use the built-in procedural figure, which does lip\n` +
        `         sync properly — delete the file and the scene falls back to it.`,
    )
  }

  for (const issue of issues) note(issue)

  for (const message of notes) warn(message)
}

function collectMorphTargets(json) {
  const names = []
  const issues = []
  let targetCount = 0
  let unnamed = 0

  for (const mesh of json.meshes ?? []) {
    const perPrimitive = (mesh.primitives ?? []).map((p) => (p.targets ?? []).length)
    const count = Math.max(0, ...perPrimitive)
    if (!count) continue
    targetCount += count

    const label = mesh.name ? `mesh "${mesh.name}"` : 'an unnamed mesh'

    // GLTFLoader only reads mesh-level extras.targetNames, and only when the
    // count matches exactly. Both failure modes leave the shapes unaddressable.
    const meshNames = Array.isArray(mesh.extras?.targetNames) ? mesh.extras.targetNames : null
    if (meshNames) {
      if (meshNames.length === count) {
        names.push(...meshNames)
      } else {
        unnamed += count
        issues.push(
          `${label} has ${meshNames.length} extras.targetNames for ${count} morph targets.\n` +
            `         GLTFLoader rejects a mismatched list and drops every name, so none of\n` +
            `         them can be driven. Fix the export.`,
        )
      }
      continue
    }

    unnamed += count
    const primitiveNames = (mesh.primitives ?? [])
      .map((p) => (Array.isArray(p.extras?.targetNames) ? p.extras.targetNames : null))
      .find(Boolean)
    if (primitiveNames) {
      issues.push(
        `${label} keeps its morph target names on the primitive, not the mesh\n` +
          `         (${primitiveNames.slice(0, 4).join(', ')}${primitiveNames.length > 4 ? ', ...' : ''}).\n` +
          `         GLTFLoader only reads mesh-level extras.targetNames, so three.js sees\n` +
          `         ${count} nameless morph targets and lip sync cannot address any of them.`,
      )
    } else {
      issues.push(
        `${label} has ${count} morph targets with no names at all. three.js needs\n` +
          `         extras.targetNames to build morphTargetDictionary; without it nothing can\n` +
          `         drive them.`,
      )
    }
  }

  return { names, targetCount, unnamed, issues }
}

// "eyeBlink_L" and "eyeBlinkLeft" are the same shape with different spellings.
function canonicalShape(name) {
  return name
    .replace(/[_.\s-]([LR])$/i, (_, side) => (side.toUpperCase() === 'L' ? 'Left' : 'Right'))
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase()
}

// Mirrors normalise() in src/scene/avatarRig.js: drop "mixamorig:" / "Armature|"
// style prefixes, then strip separators.
function canonicalBone(name) {
  return name
    .replace(/^.*[:|]/, '')
    .replace(/[\s_.-]/g, '')
    .toLowerCase()
}

function nearMisses(wanted, names, set) {
  const byCanonical = new Map()
  for (const name of names) {
    const key = canonicalShape(name)
    if (!byCanonical.has(key)) byCanonical.set(key, name)
  }
  const out = []
  for (const want of wanted) {
    if (set.has(want)) continue
    const got = byCanonical.get(canonicalShape(want))
    if (got && got !== want) out.push([want, got])
  }
  return out
}

// Keeps a long list of morph target names inside a terminal width.
function wrapList(items, prefix = '') {
  if (!items.length) return []
  const lines = []
  let line = prefix
  for (const item of items) {
    const next = line === prefix || line === '' ? `${line}${item}` : `${line}, ${item}`
    if (next.length > 62 && line !== prefix && line !== '') {
      lines.push(`${line},`)
      line = item
    } else {
      line = next
    }
  }
  lines.push(line)
  return lines
}

function sampleBones(boneNames) {
  const sample = boneNames.slice(0, 2).join(', ')
  return sample ? ` (${sample}${boneNames.length > 2 ? ', ...' : ''})` : ''
}

async function bodySnippet(res) {
  try {
    const text = (await res.text()).replace(/\s+/g, ' ').trim().slice(0, 200)
    return text ? `\n  body: ${text}` : ''
  } catch {
    return ''
  }
}

function describe(res) {
  return `  content-type: ${res.headers.get('content-type') ?? 'unknown'}`
}

function warn(message) {
  console.warn(`\nfetch-avatar: warning: ${message}`)
}

function die(message) {
  console.error(`fetch-avatar: ${message}`)
  process.exit(1)
}
