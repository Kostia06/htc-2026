# How Skillit's practice conversations should sound

Used by the voice planner (`server/src/voice/`), the iOS voice engine and the VR scenes. Goal: feel like a real
person across the table, not a quiz read aloud.

## Interview room

Real interviews follow a predictable arc. Skillit copies it, kept short (about 8–10 minutes):

| Stage | What the interviewer does | Example line |
|---|---|---|
| Warm-up (1 turn) | Easy question to settle nerves | "Thanks for coming in. How's your week going?" |
| About you (1 turn) | Open prompt | "Walk me through what you're working on right now." |
| Resume dig (1–2 turns) | Picks one real thing from the resume | "I saw you did research for Starfish. Tell me about that." |
| Behavioural (1–2 turns) | "Tell me about a time…", tied to the target role | "Tell me about a time a project didn't go to plan." |
| Role / technical (1–2 turns) | Matched to the person's field | CS: "How would you find a slow query?" · Business: "How would you size the market for X?" · Design: "Walk me through one design decision you'd change." |
| Their questions (1 turn) | "What questions do you have for me?" | — |
| Close | Next steps, thanks | "Great talking with you. We'll be in touch this week." |

**Follow-ups are where it feels real.** Interviewers usually need 2–3 probes to get a full answer
(Situation, Task, Action, Result). Skillit asks at most one or two per question, and only when something is missing:

- missing the *action* → "What did you do, specifically?"
- missing the *result* → "How did it turn out?"
- vague or "we" everywhere → "What was your part in that?"
- interesting detail → "Why did you pick that approach?"

Rules: every line ≤ 20 words, one question at a time, open-ended, never leading, refer to something the person
actually said. Never read a list. Never lecture mid-interview — feedback comes after each answer on screen, and
in full at the end.

## Turn-taking (what makes it feel human)

- **Short pauses are thinking, not the end.** Candidates pause mid-answer. End the turn after ~0.7 s of silence
  only once they've said something substantial; allow longer pauses early in an answer.
- **Barge-in:** if the person starts talking, the AI stops immediately and listens.
- **Backchannels aren't interruptions:** a quick "mm-hm" or "yeah" from the person shouldn't stop the AI.
- **Fast replies:** aim for ~1 s from end of answer to the AI's first word. Keep the planned next question ready
  so a slow model never leaves silence (fallback after ~2.5 s).

## Sources

- Interview structure and STAR probing: [Indeed – interview structures](https://ca.indeed.com/career-advice/interviewing/interview-structures-and-types), [CodeSignal – probing with STAR](https://codesignal.com/learn/courses/preparing-and-conducting-effective-interviews/lessons/probing-with-star), [Univ. of Kentucky – behavioural interview guide](https://hr.uky.edu/sites/default/files/bbi_quick_guide.pdf), [SCU career center](https://scu.edu/careercenter/toolkit/practice-for-interviews)
- Voice turn-taking: [LiveKit – turn tuning](https://docs.livekit.io/agents/logic/turns/tuning/), [Lorikeet – waiting vs listening](https://www.lorikeetcx.ai/blog/if-your-voice-ai-cant-wait-it-cant-listen), [CodeSignal – conversation practice](https://codesignal.com/blog/introducing-conversation-practice/)
