# Raven iOS — UI/UX audit

Read-only audit of `ios/Raven` (SwiftUI, iOS 26), 2026-11-07. Scope: the five tabs plus the
sheets and pushes they open. Every claim below comes from reading the view files; nothing was
run on device, so line-wrap estimates are arithmetic on a 390pt iPhone 16e width, not screenshots.

Mobbin references are linked inline. The anti-reference for the roadmap is
[Life Reset "Habit Academy"](https://mobbin.com/screens/0d8849b9-6253-472b-9067-2b5f40c648b8): it
is, almost node for node, what `RoadmapPath` renders today.

---

## 0. Cross-cutting problems (fix these first; they are why it reads as "messy")

### 0.1 One accent colour does six jobs
`Theme.action` is the CTA fill **and** the "done" state (`PathNode`, `StepDetailSheet`), the
"ready now" label (`LabelChip`), the positive-trend badge (`TrendCard`), the *low*-score colour
(`QuestionRow.scoreColor`), the error text (`ResumeView.footer`, `RecapView.composer`), the user
chat bubble (`RecapBubble`), and the streak flame. When it turns lavender, lavender will mean
"good", "bad", "error", "done", "you" and "tap me" at once, and it will sit next to
`Theme.agent` (also lavender, `0.49/0.36/0.98`) which is supposed to mean "AI".

Fix, in `DesignSystem/Theme.swift` and the call sites named above:
- `Theme.action` for primary buttons and selected states only.
- `Theme.agent` for AI only (why-lines, "Raven suggests", research state). Make sure the two
  lavenders are visibly different or merge them and differentiate AI with the sparkle glyph.
- Done / positive = `.green` or a `Theme.positive`; errors = `.red`/`Theme.negative`; low score =
  `.secondary` plus a glyph, never the accent.
- User bubble in `RecapBubbles.swift` = `Theme.raised` with a brighter stroke, not the accent.

### 0.2 Thirteen hand-rolled greys
`Color(white: 0.12 / 0.14 / 0.16 / 0.18 / 0.2 / 0.22 / 0.24 …)` appears 23 times across the
features (chips, inset fields, secondary buttons, node faces). Surfaces therefore differ by
2–4 % from card to card and nothing lines up. Add `Theme.inset` (fields, ~0.12),
`Theme.chip` (~0.16), `Theme.secondaryButton` (~0.22) and replace every literal.

### 0.3 Everything is a card
`ravenCard()` is applied 41 times: to single rows, to text paragraphs, to skeletons, to buttons,
and to cards inside cards (`StepDetailSheet.block`, `FactsSection`, `SessionSummaryView`). The
Wealthsimple screens ([home](https://mobbin.com/screens/3451c08b-cf3c-4a71-8064-14580f02ab59),
[account](https://mobbin.com/screens/4b25c7c2-8215-47f8-9ceb-e22ba07e5a9f)) use a card only to
group rows; headline numbers and body text sit directly on the ground. Rule for Raven: a card
groups ≥2 rows or is tappable as one unit; prose and single values never get a card.

### 0.4 Two button languages
`.raised` (3D ledge, `RaisedButtonStyle` + `NodeStyle`) is the Duolingo tell, and it coexists
with native iOS 26 `.glass` / `.glassProminent` in `VoiceSessionView`, `RecapView` and the
failure states. Pick glass everywhere, keep `RaisedButtonStyle` only if a flat variant
(`depth: 0`) is made the default. Delete the ledge from `PathNode.NodeStyle` regardless.

### 0.5 Two score scales
Debrief is `/100` (`ScoreRing`, `SessionSummaryView`, roadmap note "Scored 72/100"); history is
`/5` (`TrendCard`, `SessionRow`, `PracticeSessionDetailView`, `ScoreSparkline` range 1…5). Pick
one (100 reads better next to a ring) and convert in `PracticeHistoryModel`.

### 0.6 The detail-sheet template produces walls of text
`StepDetailSheet` and `FeedDetailSheet` share one shape: 60–64pt icon, uppercase kind label,
`.largeTitle`/`.title` headline, a chip row, then 2–3 full-width "block" cards each with a
headline label and a body paragraph. Sample content is 76–113 characters per detail string, so a
step sheet shows ~9 lines of prose before the button. Replace the block cards with:
one-line facts (key/value rows), the AI "why" as a single line under the title, and any
paragraph collapsed to 2–3 lines with a "More" disclosure.

### 0.7 Tab bar
`App/MainTabView.swift`: Practice uses `visionpro` though practice is voice-on-phone (VR is a
sub-option); Roadmap uses the obscure `point.topleft.down.to.point.bottomright.curvepath`.
Use `waveform` (or `mic`) and `map` / `list.bullet.rectangle`.

### 0.8 Accessibility
- Fixed point sizes ignore Dynamic Type: `PathNode` (`size: 28`), `KindIcon`/`KindBadge`
  (`size * 0.4`), `ScoreRing` (`size * 0.34`), `VoiceBar` bar widths. Use `@ScaledMetric`.
- `PathNode` upcoming glyph `Color(white: 0.55)` on `Color(white: 0.2)` ≈ 2.6:1, fails.
- Hit targets under 44pt: `CardActionButton` (30pt), `ChipView` remove (≈22pt),
  `FeedDetailSheet` bookmark is 72×52 (fine) but the card buttons are not.
- `VoiceSessionView.tipText` auto-dismisses after 5 s; VoiceOver users may not finish it. Keep
  it until the next question instead.
- `ProfileView` edits the headline through `.alert` with a `TextField`; works, but it is not a
  pattern iOS users expect for a profile field. Use a small sheet or inline editing.
- `HStack`s that will overflow at AX sizes: `ProgressCard` (number + "done" + streak chip),
  `CompanyHeader` (researched + website), `FeedCardView.details` title/actions row. Wrap in
  `ViewThatFits` or stack vertically at `.accessibility1+`.

---

## 1. Roadmap

Files: `Features/Roadmap/RoadmapView.swift`, `RoadmapPath.swift`, `PathNode.swift`,
`ProgressCard.swift`, `StepDetailSheet.swift`, `StepBadges.swift`, `MarkDoneSheet.swift`.

### Problems
1. **It is Duolingo.** `RoadmapPath.sway` offsets 76pt circles by `sin(index × 0.9) × 80`,
   `NodeStyle` gives them a 7pt 3D ledge, the current node has a pulsing halo, done nodes are
   accent checkmarks, and `ProgressCard` shows a flame streak chip. Compare
   [Life Reset](https://mobbin.com/screens/0d8849b9-6253-472b-9067-2b5f40c648b8).
2. **Nodes carry no text.** The path shows icons only; the user must tap every circle to learn
   what the step is. A roadmap whose steps are unreadable without a sheet is not a roadmap.
3. **No structure.** `path` flattens `completed` and `next` into one list; `CompletedDay.title`
   ("Today / Yesterday / Nov 3") exists but is never rendered, so there is no sense of time.
4. **Hero is buried.** `ProgressCard` puts the goal in `.subheadline .secondary` and the count
   in 40pt; the goal is the reason the user opened the app.
5. **Step sheet is text-heavy** (see 0.6): icon, kind, `.largeTitle`, chips, then up to three
   paragraph cards ("What you did", "Why this step", "How to do it").
6. **Primary action is two taps.** `StartPracticeButton` opens compact → expanded → then
   "Live on phone" / "In VR". For a demo, starting should be one tap.
7. `MoreStepsSkeleton` and the initial `RoadmapSkeleton` render card skeletons that do not
   resemble the path they stand in for.

### References
- [Structured — "Your structured plan"](https://mobbin.com/screens/2ccea049-12ce-490a-a0a0-3b9ad0ae5ed7):
  vertical rail, small round glyph, title + time on the right, strikethrough when done.
- [Mercury — application timeline + task list](https://mobbin.com/screens/ec7b66ef-59c2-495b-9872-7f17f40c5c52):
  "in review" rail with the current item bold, upcoming muted, a single numbered next step, and
  completed tasks collapsed below as checked rows.
- [Forest — day timeline](https://mobbin.com/screens/96ad2b46-d305-4f0d-a47a-185279d75825):
  date pill as a group header, thin rail, one card per item.

### Ranked fixes
1. **Replace the swaying node path with a vertical timeline list** (`RoadmapPath.swift`,
   `PathNode.swift`). Left: a 2pt rail with a 12pt dot (filled = done, ring = current,
   hollow grey = upcoming). Right: `step.title` in `.headline`, one meta line
   `kind · estimate · label`. Delete `sway`, `NodeStyle`, the pulsing halo. Borrow: Structured,
   Mercury.
2. **Expand the current step in place** instead of a sheet: show `why` on one line
   (`lineLimit(1)`, `Theme.agent`) and the primary button directly in the row. Tapping other
   rows opens the sheet. Borrow: Mercury's single highlighted "Fund your account" step.
3. **Group by time** using the already-existing `CompletedDay.title`: "Up next" (expanded),
   "Later" (dimmed), and "Done · Today / Yesterday / Nov 3" collapsed behind a disclosure with
   a count. Borrow: Forest date pills.
4. **Make the goal the hero** (`ProgressCard.swift`): goal in `.title2.bold()`, the "3 of 12"
   as a secondary line with the thin bar. Drop the flame chip or move streak to Profile.
   Borrow: Wealthsimple [home](https://mobbin.com/screens/3451c08b-cf3c-4a71-8064-14580f02ab59)
   (one number, one subtitle, chart).
5. **Flatten the step sheet** (`StepDetailSheet.swift`): title → one-line facts row → `why`
   as a single `Theme.agent` line → `detail` as plain body text, `lineLimit(3)` + "More".
   Remove `KindIcon` 64pt and the uppercase label; the kind is already in the facts row.
6. **One-tap start**: `StartPracticeButton` defaults to "Start on phone" as the primary glass
   button and exposes VR through a trailing `Menu`/ellipsis, or a second small button when a
   headset is connected.
7. Rebuild `RoadmapSkeleton` as 5 rail-rows so loading looks like the destination.

---

## 2. For you

Files: `Features/ForYou/ForYouView.swift`, `FeedCardView.swift`, `FeedDetailSheet.swift`,
`SectionChips.swift`, `FeedKind+Style.swift`.

### Problems
1. **Six accents on one screen**: four kind tints (blue, green, lavender, yellow) + action +
   agent. Each card carries the tint three times: left 4pt capsule, badge background, badge
   glyph.
2. **Card density**: badge + title (2 lines) + org + why line + two chips + attribution link +
   two round buttons = seven elements. On a 16e the title column is ≈200pt, so "Google Data
   Analytics Professional Certificate" truncates at 2 lines and "UCalgary Computer Science
   Undergraduate Society" truncates at 1.
3. **Duplicate actions**: inline save/dismiss buttons *and* leading/trailing swipe actions *and*
   a save button in the sheet.
4. **Attribution repeats** ("Jobs by Adzuna" under every job card).
5. **Detail sheet** repeats the card's why-line inside a titled card, puts facts in a vertical
   `Label` list, and shows `summary` as an untruncated paragraph (see 0.6).
6. `SectionChips` uses `Theme.action` for the selected chip; fine, but with the save bookmark
   also in `Theme.action` the header competes with content.

### References
- [Glassdoor — jobs list](https://mobbin.com/screens/6ba186ae-3e1a-4a1d-956c-b0908185f3ee):
  logo, title, location, salary, one "Easy Apply" chip, bookmark top-right, posted-age bottom-right.
  No colour per kind.
- [LinkedIn — jobs for you](https://mobbin.com/screens/de290d6a-3f38-42e4-ad72-ae5652245e77):
  one action (dismiss ×) on the row, bookmark lives in the detail.
- [Glassdoor — job detail sheet](https://mobbin.com/screens/63317191-c71d-40f0-8df9-a7aa47846f65)
  and [qualifications checklist](https://mobbin.com/screens/921438d0-7396-4229-b2c8-c77da85b000d):
  one sticky CTA + bookmark, structured "your qualifications" block above prose, prose behind
  "Show more".

### Ranked fixes
1. **Strip the card to four lines** (`FeedCardView.swift`): title (`.headline`, 2 lines),
   org · where (one `.subheadline` line), why (`Theme.agent`, 1 line), and a single trailing
   meta ("Posted Nov 5" / "Jan 26") in `.caption`. Remove the left capsule; make `KindBadge`
   neutral (`Theme.chip` background, `.secondary` glyph) and keep the tint only as the glyph
   colour. Borrow: Glassdoor jobs list.
2. **One inline action**: keep the bookmark (44pt target) and drop the inline ×; dismiss stays
   on trailing swipe. Borrow: LinkedIn.
3. **Attribution once**: move `AttributionLink` out of the card into a `Section` footer
   ("Jobs by Adzuna") in `ForYouView`.
4. **Detail sheet as a fact grid** (`FeedDetailSheet.swift`): title, org, then a 2-column
   key/value grid (Where / When / Salary / Posted), the why-line directly under the title in
   `Theme.agent`, `summary` with `lineLimit(3)` and a "More" toggle, topics as plain text chips
   in `Theme.chip`. Keep the sticky bookmark + CTA row. Borrow: Glassdoor job detail.
5. Replace the orange-selected chip in `SectionChips` with a white-on-raised selected state so
   the accent is reserved for save/CTA.

---

## 3. Practice (hub, live session, debrief, history)

Files: `Features/Practice/PracticeView.swift`, `VoiceSessionView.swift`, `VoiceBar.swift`,
`SessionSummaryView.swift`, `DebriefCards.swift`, `ScoreRing.swift`,
`Features/History/PracticeHistoryView.swift`, `PracticeSessionDetailView.swift`,
`Features/Headset/StartPracticeButton.swift`.

### Problems
1. **Hub has no data.** `PracticeView` is six stacked cards: an unlabeled text field
   ("Company or role (optional)" is the first thing on screen with no context), Interview,
   Networking, VR, Recap, Past sessions. No last score, no trend, no "next up". It reads like
   Settings.
2. **Live session** is good (VoiceBar, tip, scored badge). Issues: the question is `.title`
   (28pt) centred — a 100-character question is five lines on a 16e; `End` is `.glass` while
   the rest of the app is `.raised`; the tip auto-dismisses.
3. **Debrief is prose.** `SessionSummaryView` stacks ring + verdict + N `StrengthCard`
   (quote + why) + N `ImprovementCard` (moment + better + expandable said/try) + question list
   + numbered next steps. Sample strings are 100–137 characters each; with 3+3+4+3 items that is
   ~25 lines of body text in cards.
4. **Score colouring** (`QuestionRow.scoreColor`): green / primary / `Theme.action` — low score
   in the accent.
5. **History** scores are `/5` while the debrief is `/100` (0.5). `TrendCard` itself is the
   best Wealthsimple-like component in the app and should be reused on the hub.
6. `PracticeSessionDetailView.TurnCard` shows full answers untruncated.

### References
- [Acorns — quiz score](https://mobbin.com/screens/71327afe-ca18-43ba-97d0-aed20c15deb8):
  ring, one-word verdict, one comparison line, two stat tiles, one button.
- [Babbel — lesson results](https://mobbin.com/screens/00c43458-c5b4-4e0f-9223-f5a933ccc59e):
  headline fraction, then two grouped blocks (Incorrect / Correct) as chips, one Close.
- [Liven — session summary](https://mobbin.com/screens/d2121bed-a008-41d7-9bfa-dd3f1c299756):
  plain headings on the ground, bullets, no cards; prose is allowed because nothing else is.
- [Coursera — per-question results](https://mobbin.com/screens/3c98d923-55ce-45a4-b972-b1ef6d3104e1):
  question, score, status pill; one card per question, nothing else.
- [pillowtalk — AI voice session](https://mobbin.com/screens/1f4ee58d-0532-4f0e-b2be-cf29ff373e20):
  dark ground, segmented "transcript | analysis", mic + type in one composer.

### Ranked fixes
1. **Lead the hub with a number** (`PracticeView.swift`): reuse `TrendCard` (last score, delta,
   sparkline) at the top, then a segmented control `Interview | Networking`, the optional target
   field *under* it with a label ("At a company or for a role"), one primary "Start" button.
   Collapse VR / Tell Raven / Past sessions into one grouped list of three rows. Borrow:
   Wealthsimple [account](https://mobbin.com/screens/4b25c7c2-8215-47f8-9ceb-e22ba07e5a9f)
   (number, two pills, then rows).
2. **Debrief: score + three tiles + one change** (`SessionSummaryView.swift`): ring + verdict,
   then three stat tiles (answers scored · best question score · words/min), then the single
   top `ImprovementCard` expanded; everything else behind a segmented `Highlights | By question`
   where "By question" is the `QuestionRow` list. Cap strengths at 2 and show "Show all" for the
   rest. Borrow: Acorns, Coursera.
3. **Neutral score colour**: `QuestionRow` → `.primary` for ≥75, `.secondary` for the rest,
   plus an `arrow.down.right` glyph under 55. Never the accent.
4. **One scale**: convert history to `/100` (0.5).
5. `VoiceSessionView.questionText` → `.title2`, `lineLimit(4)`, `minimumScaleFactor(0.85)`;
   keep the tip until the next question.
6. `TurnCard` answers → `lineLimit(4)` with tap-to-expand; keep tip and delivery line.
7. `StartPracticeButton` → one-tap phone start, VR as secondary (same as Roadmap fix 6).

---

## 4. Companies

Files: `Features/Companies/CompaniesView.swift`, `CompanyView.swift`, `FactsSection.swift`,
`ReportedQuestionsSection.swift`, `Features/Recap/RecapView.swift`, `RecapBubbles.swift`,
`RecapSharedCard.swift`.

### Problems
1. **Company page is 5–7 cards of body text**: `.largeTitle` header, two stacked 52pt
   full-width buttons (Practice in accent, Refresh research in lavender), one card per fact
   group with each fact as a `.body` paragraph plus a source chip, a "Asked recently here" card,
   a two-sentence "waiting note" paragraph, and a "I interviewed here" card. The core social
   feature (share how it went) is the last thing on the page.
2. **Three empty messages** on an unresearched company: `noFactsYet`, "No questions yet.",
   and the waiting note.
3. **Source chips** in accent (`FactRow`) — 10+ accent pills on one screen.
4. **Recap chat**: user bubble is `Theme.action`, mic is `Theme.agent`; once action is lavender
   the user and the AI share a colour. `RecapSharedCard` ends with a two-sentence footer.
5. `CompaniesView.CompanyRow` is good density (name, "4 facts · 2 reports · Researched 3d ago").

### References
- [Glassdoor — company overview](https://mobbin.com/screens/93cab888-70fd-450e-84c9-252e2d769f17):
  compact header (logo, name, one Follow button), tabs (Overview / Reviews / Jobs / Salaries),
  an AI summary block with "read more", one big number.
- [Glassdoor — subratings](https://mobbin.com/screens/62fab613-a198-476e-91d0-8fd4db44e8b4):
  numbers first, label second, no cards; ratings distribution as thin bars.
- [Glassdoor — review detail](https://mobbin.com/screens/3db3e0a7-bc35-4964-ae0b-a442dcfec656):
  meta as small pills on one line, then Pros / Cons as short labelled paragraphs.

### Ranked fixes
1. **Compact header + one primary** (`CompanyView.swift`): name in `.title2`, one line
   "Researched 3d ago · atb.com", a single "Practice an interview" glass button, and Refresh
   research as a toolbar `arrow.clockwise` icon whose running/done state shows as a small
   inline status line under the header. Borrow: Glassdoor overview.
2. **Tabs instead of stacked sections**: a segmented control or `.scrollable` picker
   `Facts | Questions | Your notes` so only one group is on screen; within Facts, a horizontal
   chip row per `CompanyFact.Kind`. Borrow: Glassdoor tabs.
3. **Facts as rows, not paragraphs** (`FactsSection.swift`): `.subheadline` text with
   `lineLimit(2)`, source host as trailing `.caption .secondary` text (no pill), tap to expand.
4. **Reported questions count-first** (`ReportedQuestionsSection.swift`): leading "3×"
   in `.title3.monospacedDigit`, question text, month as caption. Replace the waiting-note
   paragraph with one line "2 of 3 reports to unlock" and a 4pt bar (reuse `ThinProgressBar`).
   Borrow: Glassdoor subratings.
5. **Merge the three empty states** into one `ContentUnavailableView` with the Refresh action.
6. **Promote "I interviewed here"** to a secondary button under the primary, not a bottom card.
7. `RecapBubble`: user bubble `Theme.raised` + brighter stroke; `RecapSharedCard` footer to one
   line.

---

## 5. Profile (+ resume, settings, memory)

Files: `Features/Profile/ProfileView.swift`, `ProfileHeader.swift`, `ProfileRows.swift`,
`ChipsSection.swift`, `Features/Resume/ResumeCard.swift`, `ResumeView.swift`,
`SuggestionCard.swift`, `ResumePreview.swift`, `Features/Settings/SettingsView.swift`,
`Features/Memory/MemoryView.swift`.

### Problems
1. **Two row systems on one screen**: header and `ResumeCard` are clear-background rows with
   `ravenCard()` (20pt radius, 16pt padding, 20pt insets), then `insetGrouped` sections with
   `Theme.raised` rows (system radius ≈10pt, system insets). The radii and gutters do not match.
2. **ResumeCard copy** is marketing: "Built from your profile. Raven can make it sharper for the
   roles you want." plus two full-width buttons. It also never says whether a resume exists or
   when it was updated.
3. **Headline editing through `.alert`** with a text field and a two-line explanatory message.
4. **ResumeView footer** is two sentences about the web builder "still being built".
5. `SuggestionDeck` sits above the paper preview and pushes it down; the preview jumps when
   suggestions are accepted.
6. `MemoryView.PrivacyExplainer` is a three-sentence paragraph in a card; plus a section footer
   sentence about swiping.
7. `SettingsView` is fine; the About footer is a two-sentence disclaimer (acceptable).

### References
- [LinkedIn — experience & education](https://mobbin.com/screens/a48e4a6d-164f-4917-8744-9825d458fac7):
  logo, role, org, dates on three short lines; section titles on the ground; no cards.
- [LinkedIn — profile header](https://mobbin.com/screens/1e654cf9-3db9-4e33-ada9-b391b325faed):
  name, headline, location, one primary + one secondary pill.
- [LinkedIn — add-education prompt](https://mobbin.com/screens/b82c413f-3433-4c83-a0a1-ca91bcdac898):
  dashed placeholder row with a one-line benefit and a single button — the right empty state.

### Ranked fixes
1. **One list system** (`ProfileView.swift`): drop `ravenCard()` here; render the header and the
   resume as `insetGrouped` sections too (or set `listRowInsets` and corner radius to match
   system). Borrow: LinkedIn experience list.
2. **Resume row, not card** (`ResumeCard.swift`): a single tappable row "Resume · Updated 2d ago
   · 1 page" with the page thumbnail leading and a chevron; "View PDF" as a swipe/secondary
   action. Cut the sentence.
3. **Headline inline**: tap the headline text → a `TextField` appears in place (or a
   `.presentationDetents([.height(180)])` sheet). Delete the alert message copy.
4. **Resume suggestions as a bottom sheet** (`ResumeView.swift`): keep the paper preview stable
   and present `SuggestionDeck` in a medium detent sheet triggered by "Improve with Raven".
   Remove the web-builder paragraph; keep one `Link`.
5. `MemoryView`: replace `PrivacyExplainer` with one line under the title ("Private, encrypted,
   delete any time") and drop the section footer; share is discoverable from the context menu.
6. `ExperienceRow` / `EducationRow`: format dates ("Sep 2024 – Present") and show the org on its
   own line like LinkedIn rather than `org · start to end`.

---

## 6. What is already good (keep)
- `TrendCard` + `ScoreSparkline` (History): the one Wealthsimple-grade component; reuse it.
- `VoiceBar` and the live session layout; `BuildingRow` and all `ContentUnavailableView` error
  states with retry; skeletons everywhere; `contentTransition(.numericText())` on counts;
  `reduceMotion` is respected in every animation.
- `CompanyRow` meta line and `SessionRow` density.
- Haptics are consistent and tied to state changes.

---

## 7. Suggested order for the remaining hackathon hours
1. Theme tokens + colour roles (0.1, 0.2) — small diff, touches every screen.
2. Roadmap timeline (1.1–1.4) — the demo centrepiece and the Duolingo risk.
3. Feed card diet + sheet grid (2.1–2.4).
4. Practice hub number + debrief tiles (3.1–3.3).
5. Company header/tabs (4.1–4.4).
6. Profile list unification (5.1–5.3).
