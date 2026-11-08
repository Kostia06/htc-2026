import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// The menu's Hints switch: off by default, remembered on this device. On, the
// candidate sees two or three talking points for the question on the table.
// They are only drawn beside the desk; nothing here reaches the interviewer.

export const ANSWER_HINTS_KEY = 'skillit.vr.answerHints'
const MIN_QUESTION_CHARS = 25 // "Are you still there?" is not a question worth a cue card

export function readHintsSetting(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(ANSWER_HINTS_KEY) === 'on'
  } catch {
    return false
  }
}

export function writeHintsSetting(on, storage = globalThis.localStorage) {
  try {
    storage?.setItem(ANSWER_HINTS_KEY, on ? 'on' : 'off')
  } catch {
    // storage blocked: the switch still works for this visit
  }
}

export function useAnswerHints() {
  const [on, setOn] = useState(() => readHintsSetting())
  const toggle = useCallback(() => {
    setOn((was) => {
      writeHintsSetting(!was)
      return !was
    })
  }, [])
  return { on, toggle }
}

/**
 * Asks once per question, keeps the answers, and only reports the latest
 * question's points: a slow reply for an earlier line never replaces the
 * current card.
 */
export function createHintLoader(fetchPoints, onPoints) {
  const cache = new Map()
  let current = null

  return {
    async show(question) {
      current = question
      if (!question || question.length < MIN_QUESTION_CHARS) return onPoints(null)
      if (cache.has(question)) return onPoints(cache.get(question))
      onPoints(null)
      let points = null
      try {
        points = await fetchPoints(question)
      } catch (error) {
        console.warn('answer hint failed', error)
      }
      if (points) cache.set(question, points)
      if (current === question) onPoints(points)
    },
    clear() {
      current = null
      onPoints(null)
    },
  }
}

/** The points to draw now, or null. `interview` is useInterview's result. */
export function useHintPoints(interview, on) {
  const [points, setPoints] = useState(null)
  const fetchRef = useRef(interview.hintFor)
  fetchRef.current = interview.hintFor
  const loader = useMemo(() => createHintLoader((q) => fetchRef.current(q), setPoints), [interview.sessionId])
  const live = on && !interview.isStub && interview.phase !== 'idle' && interview.phase !== 'done'
  const question = interview.question

  useEffect(() => {
    if (live) loader.show(question)
    else loader.clear()
  }, [live, question, loader])

  return live ? points : null
}
