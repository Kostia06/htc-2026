# AI Mentor: design

Hack the Change 2026, Prompt 2. Working name: TBD.

## Why
Getting a first job, or switching into a growing field, means guessing which skills matter, which courses count, and what an interview at a given company actually looks like. The information exists but it's scattered, stale, or locked inside other people's heads. This app turns it into a path you can follow and a mock interview you can practise.

One-line pitch: an AI mentor that maps your path into a Calgary job, then interviews you with the questions people were actually just asked there.

## Goals
1. **Roadmap map.** User gives their background (resume or plain-language description, school, program). The app shows a visual map: target roles, the skills gap, and ordered steps: courses (including their own university's courses), certificates, projects. Built from real labour-market data, not invented.
2. **Global interview memory.** People add interview experiences (company, role, questions asked, format, outcome). Stored anonymously, opt-in, aggregated per company and role. Nobody sees another person's identity or raw post.
3. **Research agent.** An AI agent continuously gathers fresh public info about companies (hiring news, tech stack, values, interview format, open roles) and adds it to the same memory, so it stays current even before users contribute.
4. **AI interviewer.** Real-time voice mock interview. The interviewer is a persona for the chosen company and role and draws its questions from the global memory. It asks follow-ups and gives a feedback report afterwards (structure, clarity, filler words, what to improve).
5. **Clients.** React web app and native Swift iOS app on the same backend.
6. **VR interview (the headline).** The interviewer is an avatar across the table in a realistic interview room, via WebXR. The point is pressure: eye contact, silence, follow-ups, so practice feels like the real thing. During and after, it scores you (structure, clarity, confidence, pace, filler words), shows what a strong answer would have said, and gives a prep list for next time.

## Non-goals
- Not a job board, and no applying through the app.
- No guaranteed-outcome claims ("you'll get the job").
- No social feed or direct messaging between users.

## Anti-goals (failure even if it works)
- Leaking who said what about which employer. Privacy failure = project failure.
- Made-up data shown as real (fake job stats, invented interview questions presented as reported).
- A reskin of ChatGPT with a career prompt. Judges disqualify reskins; the memory + real data is the substance.
- Code we can't explain in Q&A.

## Constraints (from the rules)
- Built during the event only. AI use logged in `docs/ai-usage.md` for Devpost.
- Submit by 11:30 AM ABT Nov 8: 2-5 min video, public GitHub, title `TEAM ID - TEAM NAME - PROJECT NAME`.
- Demo is 3 minutes live. It must survive bad wifi: keep a seeded demo account and cached company data.
- The research agent must respect each site's terms and robots.txt. No login-walled sites (Glassdoor, LinkedIn) and no bot-check evasion. Sources: company career and about pages, engineering blogs, news, public job postings (Job Bank), web search results via an API.

## Decided
- **VR is the winning feature and leads the pitch.** Demo shows the app plus the VR interview.
- **Memory is prefilled before demo**: agent-gathered company facts (with source links) plus team-written example experiences. Seeded entries are marked as seeded in the database and never presented as real user reports.
- **Research agent uses public sources only** (no login walls, no bot-check evasion) and shows the source link on every fact.
- Adzuna key: the team is getting one.
- Prompt 2. Calgary-first framing (Benevity local-impact pot), accessible and privacy-first (Clio pot).
- Full scope: web + iOS + VR + agent (team's call).
- Data sources confirmed working: Job Bank postings and 3-year outlooks (NOC 2021, Calgary region), StatCan WDS (vacancies and wages by occupation, Alberta), Alberta occupational outlook. Adzuna adds live Calgary postings once someone gets the free key.

## My calls (change any of these)
- **AI:** Gemini (MLH category). Gemini Live API for the voice interview; Gemini with search grounding plus a fetch tool for the research agent; Gemini embeddings for memory search.
- **Stack (team decision):** Cloudflare serverless. TypeScript Worker (Hono) for the API, serving the React + TypeScript web app as static assets. D1, Vectorize, Workers AI embeddings, Cron Triggers. iOS in Swift. Anonymous HMAC-signed session tokens instead of accounts (my call).
- **Headset:** Meta Quest 3 via the Meta Quest Browser (WebXR).
- **Memory model:** `experiences` (user-submitted, anonymized), `company_facts` (agent-gathered, each with source URL and fetched date), both embedded. The interviewer and the roadmap query by company + role.
- **Anonymization:** strip names and emails before storing, show only aggregates ("4 people reported a system-design round"), require 3+ reports before showing a company's question list, so one person can't be identified.
- **Agent schedule:** a cron (Supabase scheduled function) re-researches tracked companies every few hours, plus on demand when a user opens a company.
- **University courses:** start with University of Calgary's public course calendar. Verify it's fetchable before relying on it.
- **VR:** three.js/WebXR scene reusing the same voice session. Also runs in a desktop browser as a fallback in case the headset or venue wifi fails on stage.
- **Live coaching:** score shown after each answer, not mid-sentence, so it doesn't break immersion. Full report with "what to say" rewrites at the end.

## Open (needs the team)
1. Team size and who owns what (web, iOS, backend/agent, VR, pitch).
2. Team ID for the Devpost title.
3. Does anyone have a Quest or other headset for testing VR?
4. Supabase vs Auth0 for login.
5. Name.

## Demo story (3 min)
1. Open with VR: a teammate in the headset, interviewer asks a question from the company's memory, presses with a follow-up. Room sees it mirrored on screen. (60s)
2. Score and coaching: what they said vs a stronger answer, prep list. (30s)
3. Step back to the app: the map to that role with real Calgary outlook and wage data, and the company page with sourced facts and reported questions. (60s)
4. Close: privacy promise and why it scales. (30s)
