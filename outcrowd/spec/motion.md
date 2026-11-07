# Outcrowd homepage – motion inventory

Source of truth: snapshot `/Users/kartikmiital/Downloads/assets` (published Wed Jul 08 2026).
Every animation is numbered **M1…M62** so the lead can check them off. Raw data:

- `spec/ix2-homepage.json` – the 68 Webflow IX2 events + 45 action lists that apply to this page
  (extracted from `webflow.schunk.905be2c09f8db3a4.js`, `Webflow.require("ix2").init({...})`).
- `spec/ix2-homepage.txt` – the same, human readable (one line per action item).
- Inline scripts are quoted from the snapshot HTML (numbers `S#n` = order of the inline `<script>` in `<body>`).

## 0. Conventions (read first)

**Breakpoint keys** used by IX2 (`site.mediaQueries`): `main` ≥ 992 px, `medium` 768–991, `small` 480–767,
`tiny` ≤ 479. Custom scripts test `window.innerWidth` themselves (`> 767`, `>= 767`, `<= 766`, `<= 767`, `>= 1921`).
Note the off-by-one mix (767 vs 768) – keep it exactly as listed per item.

**Units:** `rem` is fluid: `html{font-size:1vw}` for 768–1919 px, `.8vw` ≥ 1920 px, `16px` ≤ 767 px
(so 1 rem = 14.4 px @1440, 9.91 px @991, 16 px @390).

**IX2 timed animations ("groups")**: an action list is a sequence of groups. Groups run one after another;
all items inside a group start together; an item's `delay` is relative to its group start; a group lasts
`max(delay + duration)`. If `useFirstGroupAsInitialState` = true, group 0 is applied **instantly on page load**
(as the initial state) and also replayed as the first step when the animation (re)starts.
`loop: true` on the event = when the last group finishes, restart from group 0 → infinite loop while
the trigger is active.

**IX2 easings:** empty = linear; `ease` = cubic-bezier(.25,.1,.25,1); `easeInOut` = cubic-bezier(.42,0,.58,1);
`outExpo` = `t => t === 1 ? 1 : 1 - 2^(-10t)` (GSAP `expo.out`).

**IX2 scroll-driven ("while scrolling in view", SCROLLING_IN_VIEW, continuous)**: progress
`p = (vh - rect.top) / (vh + rect.height)` clamped 0…1 (0 = element top touches viewport bottom, 1 = element
bottom leaves viewport top). Keyframes are per property; values are linearly interpolated between the keyframes
where that property is defined; before its first keyframe a property holds the first value, after the last it
holds the last value. `smoothing: 50` = every animation frame the rendered value moves 50 % of the remaining
distance to the target (`v += (target - v) * 0.5`) – a short lag, not a time-based tween. In GSAP terms:
`ScrollTrigger({trigger, start:'top bottom', end:'bottom top', scrub: ~0.1})` with a linear timeline whose
positions are the keyframe percentages.
Scroll positions quoted as "≈ y px" are for the 1440×900 reference layout (`.compare/reference/1440`).

**IX2 "scroll into view"** (SCROLL_INTO_VIEW) with offset X %: fires when the element is X % into the viewport
(top above `vh·(1 − X/100)`). `loop:true` here = the action list repeats forever after the trigger.

**Transforms** in IX2 compose as `translate3d(x,y,0) scale3d(sx,sy,1) rotateX() rotateY() rotateZ()`; an axis
not given in an action keeps 0 (move) / 1 (scale). Only the properties listed in an action are animated.

**CHILDREN `.x`** = descendants of the trigger element that match `.x`; **SELF** = the trigger element itself.

### data-w-id → element map (all ids on the page)

| data-w-id | element |
|---|---|
| 3c46ffd5-4000-c744-b844-96cae5abe570 | `#preloader.preloader-wrapper` |
| 3487650e-4c26-54c5-2aef-2841b8075482 | `.preloader-home` |
| 6f33be46-cdb6-53ec-7477-70b76324366d | `.preloader-frame` (white curtain) |
| aab38b23-d130-2b6d-414f-e584fdd953ad | `#startPreloader.preloader-button` (hidden trigger) |
| e03bb02e-34c0-a26d-6036-7530a5b4d258 | preloader logo lottie (`logo dark.json`) |
| c7ebdd10-96e6-6f07-0a53-6faa50d08234 | `img.light` (top light beam, `Group.webp`) |
| 0a812902-6ae6-6151-13ca-f85ba6a258ca | `.nav-wrap` |
| 8b251f90-ecf6-2712-000f-63a6e0b37b66 | `header.header-new` |
| 1f1db639-7034-cf0f-006c-9f8dedd8dfa7 | `.logo-white` lottie (`logo white.json`) |
| 335a1b7a-c392-2315-8be8-c943ebafd459 | `.logo-black` lottie (`logo dark.json`) |
| d854c265-bf21-cd91-d958-4207ee115060 | `.burger-wrap` |
| 1218a009-69e9-a08b-f66c-3ae591f8231a | `.hero-height-new` |
| 8579ced5-bb5c-a59c-9a98-4b378ead2465 | `section.hero.home` |
| b4f76b9d-153b-b1cf-8480-9fa8af99da1a | `.container.is-big.full` (hero sticky container) |
| 6d1332f8-3212-0ba2-8e33-ec01b8e03f28 | hero `.hero-tag-wrap` |
| 3cdee8b7-… / 32206138-… / c941331a-… / 5082f9f6-… | hero lotties `.hero-paralax.set-6/.set-4/.set-7/.set-1.hide-mob` (vidget 10/12/11/9) |
| bb32a1b6-2396-a007-5780-aa517848547a | `section.bg-dark.cards` |
| 1e8de970-d96f-4fe6-0a77-9ba70590e112 | `.stats-card-wrapper.img-list-set-1` ($300m card) |
| fce5fc87-… / aa7bceda-… / 95e530e4-… | stats lotties `.card-hero-img.set-2/.set-3/.set-4` (vidget 13/14/15) |
| 2a8753b8-3b85-8b9c-c07b-1f7ef622e640 | first `.case--new-heading-wrap` ("Stages of startup development") |
| be24b132-7907-2a09-561b-a870a5aa1003 | `.height-cases` (400vh sticky scroller) |
| f4d214d0-6c36-9360-e2b5-d9bf4dbbc7ac | `section.is-cases` (Services) |
| e44d9f8a-7fe6-5877-f621-38bedc1bcf41 | `.shadow.vertical.small` (services heading mask) |
| 9327c432-… / 7d4c0e09-… | service card Brand Strategy / its `.brand-lottie` |
| 37e11e59-ebd5-d47b-ea9d-28ff32111258 | service card Brand Visual (`.service-card.set-4`) |
| 84e57622-…-afac8d8200e3 / …-afac8d8200ec | service card Platforms / `.platform-lottie` |
| 336f199c-…-45693c0d9886 / …-45693c0d988f | service card Website / `.web-lottie` |
| 90c825d6-8459-ea93-9b52-82b0890cdb45 | service card Mobile Apps |
| eff56ce8-… / 89a7e349-… | service card Development / `.brand-lottie._2` |
| 11ad2a2c-fbdb-aaaa-ff30-de545f64c698 | `section.is-clients` |
| 11ad2a2c-fbdb-aaaa-ff30-de545f64c6a5 | `.startups` |
| a30d1d8d-… 4b4410d1-… / 42daf8dd-… 0611c4c4-… c3d05df1-… | `.big-brand-card` top row (brand-5 McDonald's, brand-4 Toyota) / bottom row (brand-1 Red Bull, brand-2 Dolby, brand-3 IBM) |
| 21e6ff8c-2434-0b5b-a445-356906aeb701 | `section.is-awwards` |
| e8b85403-f394-d269-3ea7-1668de36b09d | `section.is-blog` |
| 0ed997cc-…-1d06f9a53974 | `section.is-faq` |
| 0ed997cc-…-1d06f9a53979 | `.shadow.vertical._2` in FAQ heading |
| 0ed997cc-…-1d06f9a53a05 | `.shadow.hide-mob` (FAQ side mask) |
| 0ed997cc-…988/…994/…9a0/…9ae/…9bc/…9c8/…9d4/…9e0/…9ec/…9f8, 1f714ca5-… | the 11 `.faq-dropdown` items (1f714ca5 is the 2nd) |
| 505a594f-6be9-46a4-c000-a940fb77655c | `section.is-cta` |
| 87fb7b75-2f9f-4817-13e4-566ea0f8bfae | `.cta-wrap` |
| f515b4c4-2fcd-4d20-0746-26efdc8bb300 | `.cta-card-wrapper` |

---

## 1. Load, preloader, global

### M1 – Preloader curtain (load, all breakpoints)
- **Trigger:** `DOMContentLoaded` (S#1). If `sessionStorage.preloaderClicked` is missing or `'false'`, it calls
  `#startPreloader.click()` and sets it to `'true'`; otherwise `#preloader` gets `display:none` (no curtain).
  On `beforeunload` the flag is reset to `'false'` unless the active element has the `internal-link` attribute
  (nav/footer links carry `internal-link`) → the curtain plays on every fresh load / reload, not on internal navigation.
  Clicking any `[internal-link]` also hides `#preloader` immediately.
- **IX a-178 "preloader"** (MOUSE_CLICK on `#startPreloader`), `useFirstGroupAsInitialState`:
  - g0 (initial): `.preloader-frame` width 100 % / height 100 %; `.preloader-home` display flex; hero container `b4f76b9d` translateY 0vh.
  - g1: hero container translateY **−20vh**, duration 0, delay 200 ms (outExpo) → jump.
  - g2 (starts ≈200 ms):
    - preloader lottie `logo dark.json` progress 0 → **79 %** over 1580 ms (linear) – lottie is 60 frames @30 fps.
    - hero container translateY −20vh → **0vh**, 1000 ms, delay 1600 ms, outExpo.
    - `.preloader-frame` height 100 % → **0 %**, 1000 ms, delay 1650 ms, outExpo (frame is bottom-anchored:
      `.preloader-home{align-items:flex-end}` → the white panel shrinks downwards).
    - `.preloader-home` display **none** at delay 2000 ms.
- **Visual:** white full-screen (`.reloader-container{background:#fff}`) with the dark logo (12 rem × 8.2 rem box,
  bottom-aligned mask) drawing itself, then the white curtain collapses downwards revealing the hero, which
  rises 20vh into place.

### M2 – Page fade-in (IX a-255 "Load", PAGE_START, all)
- g0 (initial): opacity 0 on `img.light`, `#preloader`, `.hero-height-new`, `.nav-wrap` (also baked in the HTML as inline `style="opacity:0"`).
- g1: all four → opacity 1, duration 0, delay 100 ms (instant switch at 100 ms after IX init).

### M3 – Lenis smooth scrolling (S#29, all widths)
`new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.7, gestureOrientation: 'vertical', normalizeWheel: false, smoothTouch: false })`
driven by its own rAF loop. On `window.load`, if `innerWidth > 767`: `lenis.scrollTo(0, {immediate:true})` (page always starts at top).
`[data-lenis-start|stop|toggle]` hooks exist but no such element is on the page. Lenis CSS (`html.lenis{height:auto}` …) is inline in `<head>`.
Snapshot uses Lenis **1.0.23** (npm `lenis@1.3.x` renames `smoothTouch`→`syncTouch`; keep behaviour: no smoothing on touch).
Scrollbar hidden: `::-webkit-scrollbar{width:0}`.

### M4 – Nav colour follows the section under it (S#5, scroll + resize + load)
Every scroll/resize: find the `[section-color]` element that fully contains the nav's rect vertically
(`navRect.top >= s.top && navRect.bottom <= s.bottom`; default `'white'`).
- `> 767`: `.nav-new` background `#191919` if black else `#FAFAFA` (CSS transition `background-color .3s ease`).
- Logos (all widths): black → `.logo-white` opacity 100 (=1) z-index 3, `.logo-black` opacity 0 z-index 2; white → the reverse.
  (transition `opacity .3s ease, z-index .3s ease`).
- "Book a call" grey nav button `.nav_link-c.contact.grey`: background `#404040` + text `#fff` on black, `#E5E5E5` + text `#080808` on white.
- `.nav-new .footer-nav-link.hover` (hover face of nav links) colour `#fff` on black, `#080808` on white.
- Section colours: black = `.hero-height-new`, hero, cards, first `.case--new-heading-wrap`, `.is-cases-new`, `.height-cases`, `.is-cases`, `.is-awwards`, `.is-blog`, `.is-faq`, `.is-cta`, `footer`; white = `.is-clients`, `.is-testimonial`.

### M5 – Nav collapse / expand by scroll direction (S#7, `innerWidth > 767`)
On every `scroll` (compares with the last scrollTop):
- **Down:** `.header-btn-wrap` width → `16rem`; `.nav-link-wrap` → `scale(0.6)`, width `0rem`, opacity 0;
  `.nav-new` width → `24rem`; `.nav_link-c.contact.grey` ("Book a call") → `scale(1)`, opacity 1.
- **Up:** `.header-btn-wrap` width `7rem`; `.nav-link-wrap` `scale(1)`, width `20rem`, opacity 1; `.nav-new` width `41rem`;
  "Book a call" `scale(0.6)`, opacity 0.
- All via inline transitions `0.7s ease` (width / transform / opacity). CSS initial state = "up" look but
  `.nav-new` 41.25 rem and `.nav-link-wrap` natural width until the first scroll.

### M6 – Logo lottie hover
- `.logo-black` (`logo dark.json`, IX target): MOUSE_OVER (e-535, delay 141 ms, loop) → a-163: progress → 100 % over 2000 ms (linear); MOUSE_OUT (e-536) → a-164: progress → 0 instantly.
- `.logo-white` (`logo white.json`): MOUSE_OVER (e-527) → Webflow lottie preset: progress 0 → 100 % at native speed (2 s), no out-action.
- Rest frame of both = frame 0 (static logo mark). Both 312×158 comp, 60 frames @30 fps.

### M7 – Flip-text link hover (IX a-169/a-170 on CLASS `.footer-link`, `main` only ≥ 992)
Applies to the 4 nav links and all footer links (every `a.footer-link`).
- Structure: `.footer-flip-hover` holds two copies: the normal text and `.footer-nav-link.hover` which is
  `position:absolute; transform-origin:50% 0; transform-style:preserve-3d; transform: rotateX(-90deg)`.
- MOUSE_OVER (a-169): `.footer-flip-hover` rotateX 0 → **90deg**, 500 ms, `ease` (initial state rotateX 0).
- MOUSE_OUT (a-170): rotateX → 0, 500 ms, `ease`.
- Result: a 3D flip revealing the white (or #080808, see M4) copy.

### M8 – "Explode" fill on pill buttons `.nav_link-c` (S#2 and S#32 – registered twice, identical)
Buttons: nav "Book a call" (grey), nav "Contact", mobile-menu "Contact", the hidden "View detais" case buttons.
- `mousemove`: the child `.explode` (0.5vw circle, `#774DFF` for `.violet`, otherwise `#FE4A23`) is moved to the
  cursor (`left/top` = cursor offset in px) and set to `transform: scale(50)`; `.btn-text` colour → `white`.
- `mouseleave`: `.explode` → `scale(.1)`, text colour reset.
- CSS: `.explode{transition: opacity 10ms, transform .6s cubic-bezier(.455,.03,.515,.955)}`; `.btn-text{transition: color .6s}`.

### M9 – Explode on big CTA buttons `.nav_link-cta` (S#19)
Same as M8 with `scale(70)` and text `#fff`. ("Write us" orange, "Book a call" grey in the CTA card.)

### M10 – Explode on social icons `.social-footer` (S#3 and S#21 – twice)
Same mechanism, `scale(20)`, explode colour orange `#FE4A23` (`.explode._400`, transition .6 s), no text colour.

### M11 – Explode visibility watchdog (S#30)
`setInterval(100ms)` + on `load`: for every `.explode`, if computed scaleX ≤ 0.1 → `opacity:0`, else `opacity:1`
(hides the 0.1-scaled dot at rest). (S#31 `.button-main`, S#33 `[button-main-text-white]`, S#34
`[button-main-text-white-big]` target elements that are **not on this page** → no-ops.)

### M12 – Magnetic social buttons (S#23, `.social-footer-wrap`)
`mousemove`: `transform: translate(dx, dy)` with `dx = (mouseX − centerX) / width × 10`, same for y (max ±5 px);
`mouseleave`: `translate(0,0)`. CSS `transition: transform .4s ease-out; will-change: transform`.

### M13 – Footer e-mail underline (CSS)
`.email-link::after`: 1 px (0.0625 rem) line, `scaleX(0)`, origin right → on hover `scaleX(1)`, origin left;
`transition: transform .5s cubic-bezier(.215,.61,.355,1)`.

### M14 – Mobile burger menu (IX e-502/e-503, `small` + `tiny` ≤ 767)
- MOUSE_CLICK → a-138 (initial state from g0: lines rotate 0, `.burger-wrap` x 0, `.header-wrapper` height 4 rem, bg transparent):
  - `.burger-line.second` rotateZ −45°, translate(−.5rem, −.3rem); `.burger-line.first` rotateZ 45°, translate(−.5rem, .3rem); `.burger-wrap` translateX .5rem – all 500 ms `ease`.
  - `.header-wrapper` background → `#080808` 300 ms `ease`; height → **100vh** 900 ms `ease` (the `.mob-menu` inside becomes visible because the wrapper is `overflow:hidden`).
- MOUSE_SECOND_CLICK → a-139: lines/translate back to 0 (500 ms ease), height → 4 rem 900 ms ease, background → transparent 900 ms ease after 900 ms delay.
- S#6 on the same click toggles the logos: 1st click forces `.logo-white` visible (opacity 100, z 3) / `.logo-black` hidden; 2nd click clears the inline styles.

### M15 – Click sound on award rows (S#40)
`new Audio("https://dl.dropboxusercontent.com/s/03lxlbaek2ye22m/click_min.mp3")` cloned per `.awards-list-item`;
`mouseenter` → `play()` (local copy: `/audio/click_min.mp3`). Browsers block it until the first user gesture.

### M16 – Headline/testimonial CSS transitions (head `<style>`)
`.heading-2, .icon-clutch-full-icon, .icon-clutch-small, .icon-clutch-full { transition: all .7s ease }`.
This also applies to **every `.heading-2`** (testimonial, awards "Awards for digital innovation", blog "Our News"),
so the IX-driven opacity changes on those headings (M47, M50) are additionally smoothed by a 0.7 s CSS transition.
(`.first-line-testimonial` / `.heading-wrap-testimonial` in that rule are misspelled vs. the DOM `…testimoniall` → no effect.)

---

## 2. Hero (`section.hero.home`, 280vh tall, sticky container `top: 11.25rem`)

### M17 – Hero tag border glow loop (IX e-544 → a-168 "tag-border", scroll into view, loop, all)
Target: `.stats-card-gradient.services.hero-home` inside the hero `.hero-tag-wrap` (a radial white→#080808 blob behind
a 1 px inset → it reads as a light travelling around the pill border). Infinite loop, initial state g0:
`translate(-18%, 2%)` (also inline in HTML).

| step | translate (x %, y %) | duration |
|---|---|---|
| g0 | −18, 2 | 500 ms (initial) |
| g1 | 109, 2 | 1500 ms |
| g2 | 160, 73 | 500 ms |
| g3 | −3, 73 | 2000 ms |
| g4 | −18, 2 | 1000 ms |
All linear. Cycle ≈ 5.5 s.

### M18 – Hero scroll choreography (IX e-386 → a-122, continuous on hero section, `main` + `medium` ≥ 768)
Section top = 0, height 280vh → p = (900 + scrollY) / 3420 at 1440×900 (p ≈ 26 % at rest).

| p | ≈ scrollY | target | value |
|---|---|---|---|
| 29 % | 92 | `.hero-paralax.set-1…set-7` | translateY 0vw |
| 29 % | 92 | `.hero-heading` | translateY 0vw |
| 29 % | 92 | `.show-wrap` | translateY 0rem |
| 43 % | 571 | `.show-real-video` | width/height 97.5 % |
| 43 % | 571 | `.lap-top-bg` | opacity 1 |
| 45.5 % | 656 | `.show-real-video` | width/height **100 %** |
| 45.5 % | 656 | `.lap-top-bg` | opacity **0** |
| 50 % | 810 | `.hero-heading` | translateY **−30vw** |
| 50 % | 810 | `.show-wrap` | translateY **−34.5rem** |
| 53 % | 913 | `.hero-paralax.set-1 / set-2 / set-3` | translateY **−51vw / −63vw / −62vw** |
| 54 % | 947 | `.hero-paralax.set-7 / set-4 / set-6 / set-5` | translateY **−70vw / −57vw / −60vw / −59vw** |

(applies to both the lottie `.hide-mob` and the svg `.hide-laptop` variants since they share the classes.)

### M19 – Showreel grows to full width (S#41, `scroll`, `innerWidth > 767`)
`f = scrollY / heroSection.offsetHeight`; `start = 60 %` if `innerWidth >= 1921` else **48 %**; end 100 %.
- f ≤ 0.20: `.showreal-home` width = start %, border-radius 1.7vw; `.show-real-video` radius 1.2vw; `.lap-top-bg` radius 1.7vw.
- 0.20 < f ≤ 0.33: linear: width = start + (100 − start)·(f − .2)/.13; radii 1.7vw→0 / 1.2vw→0 on the same ramp.
- f > 0.33: width 100 %, all radii 0.
At 1440×900 (hero 2520 px): ramp from scrollY 504 → 832.

### M20 – Hero parallax on mobile (IX e-876 → a-259, continuous on hero, `small` + `tiny`)
| p | target | translateY |
|---|---|---|
| 53 % | `.hero-paralax.set-1…7` | 0vw |
| 85 % | set-1 −20vw, set-2 −25vw, set-3 −15vw, set-7 −25vw, set-4 −25vw, set-6 −26vw, set-5 −19vw |

### M21 – Hero widget lotties (autoplay, loop, all; ≤ 767 replaced by static SVGs)
| element | JSON | duration |
|---|---|---|
| `.hero-paralax.set-6.hide-mob` | `vidget 10.json` | 8.77 s |
| `.hero-paralax.set-4.hide-mob` | `vidget 12.json` | 5.60 s |
| `.hero-paralax.set-7.hide-mob` | `vidget 11.json` | 2.43 s |
| `.hero-paralax.set-1.hide-mob` | `vidget 9.json` | 5.40 s |
`data-loop=1 data-autoplay=1 data-renderer=svg`, `preserveAspectRatio xMidYMid meet`. At ≤ 767 the `.hide-mob` lotties
are `display:none` and the `.hide-laptop` SVG images (`hero-paralax-set-6.svg`, `hero-paralax-4.svg`,
`Frame 427320036.svg`, `hero-paralax-1.svg`) are shown instead. set-2 (`hero-home-parallax.svg`), set-3
(`hero-paralax-3.1.svg`), set-5 (`hero-paralax-5.svg`) are static SVGs at all widths.

### M22 – Showreel video
`<video id="video" autoplay loop muted data-object-fit="cover">` source
`showreel-home.mp4` (local `/video/showreel-home.mp4`), inside `.show-real-video` whose CSS background is the poster
`videoframe_5896.png`; `object-fit: cover`. No `playsinline` attribute in the original (add it – iOS needs it to autoplay inline; visually identical).

---

## 3. "We prove…" + stats cards (`section.bg-dark.cards`)

### M23 – `[animate]` char reveal, desktop (S#35, evaluated once at parse time if `innerWidth >= 767`)
`new SplitType('[animate]', {types:'lines, words, chars', tagName:'span'})` (only `h2.anim-heading-home`), then
`gsap.from('[animate] .char', {opacity:0, duration:2, ease:'power2.out', stagger:0.05, scrollTrigger:{trigger:'[animate]', start:'top 90%', end:'bottom 20%', scrub:true}})`.
Scrubbed → chars fade in left-to-right in proportion to scroll between "heading top at 90 % of viewport" and "heading bottom at 20 %".

### M24 – `[animate]` char reveal, mobile (S#36, `DOMContentLoaded`, `innerWidth <= 766`)
SplitType as above; `IntersectionObserver(threshold 0.1)`: **every time** the heading intersects →
`gsap.from(chars, {opacity:0, duration:0.25, ease:'power2.inOut', stagger:0.03})` (re-plays on each re-entry).

### M25 – Cards fan-in (IX e-456 → a-117, continuous on the section, `main` + `medium`)
Section ≈ top 2190, h 1171 at 1440×900. `.left-/.right-stat-gradient` are black→transparent side masks.

| p | ≈ y | target | value |
|---|---|---|---|
| 20 % | 1704 | `.stats-card-wrapper.img-list-set-1` | translateX **−30rem**, rotateZ **−15°** |
| 20 % | | `.left-stat-gradient.top` | width 60rem |
| 29 % | 1891 | `.stats-card-wrapper.set-3` | translate(28rem, 5.69rem) rotateZ 15° |
| 29 % | | `.right-stat-gradient.top` | width 60rem |
| 33 % | 1973 | `.stats-card-wrapper.set-2` | translate(−23rem, 5rem) rotateZ −15° |
| 33 % | | `.left-stat-gradient.bot` | width 60rem; `.left-stat-gradient.top` opacity 1 |
| 38 % | 2077 | `img-list-set-1` | translateX 0, rotate 0 |
| 38 % | | `.left-stat-gradient.top` | width 23rem, opacity 0 |
| 42 % | 2160 | `.stats-card-wrapper.set-4` | translate(28rem, 10.69rem) rotateZ 15° |
| 42 % | | `.right-stat-gradient.bot` | width 60rem; `.right-stat-gradient.top` opacity 1 |
| 46 % | 2243 | `set-3` | translate(0, 5.69rem) rotate 0 |
| 46 % | | `.right-stat-gradient.top` | width 23rem, opacity 1 |
| 47 % | 2263 | `.left-stat-gradient.bot` | opacity 1 |
| 52 % | 2367 | `set-2` | translate(0,0) rotate 0; `.left-stat-gradient.bot` width 23rem, opacity 0 |
| 56 % | 2450 | `.right-stat-gradient.bot` | opacity 1 |
| 62 % | 2574 | `set-4` | translate(0, 5.69rem) rotate 0; `.right-stat-gradient.bot` width 23rem, opacity 0 |

Note set-3 / set-4 rest at translateY 5.69rem (stagger of the 2×2 grid). Before 20 % every card holds its first keyframe (off-screen, rotated).

### M26 – Cards section on mobile (IX e-550 → a-173, continuous, `small` + `tiny`)
`.anim-heading-home` opacity 0 @4 % → 1 @25 %; `.shadow.vertical.small-2` translateY −50 % @10 % → 0 @25 %
(that shadow is `display:none` in CSS → only the heading fade is visible).

### M27 – Stats card border glow loop (IX e-471 → a-129 "loopgradient", CLASS `.stats-card-wrapper`, scroll into view, loop, all)
Each card wrapper's `.stats-card-gradient` (radial `rgba(255,255,255,.4)` → `#080808` 58 %, 110 % size) moves, linear:
g0 (initial) translate(−20vw, 17vw) 2000 ms → g1 (29vw, 10vw) 2000 ms → g2 (17vw, 26vw) 2000 ms → g3 (−2vw, 26vw) 1000 ms → repeat.
The card itself (`.stats-card`, `#080808`) sits 0.1 rem inside the wrapper, so only a 1-2 px moving light border shows.

### M28 – Stats card lotties (autoplay, loop)
`.card-hero-img.set-2` `vidget 13.json` (4.97 s), `.set-3` `vidget 14.json` (4.17 s), `.set-4` `vidget 15.json` (3.67 s). The $300m card uses a static `chat popup.webp`.

---

## 4. "Stages of startup development" (`.case--new-heading-wrap` + `section.is-cases-new`)

### M29 – Heading fade (IX e-548 → a-171, continuous on the first `.case--new-heading-wrap`, `main` + `medium`)
`.case--new-heading` opacity 0 @20 % → 1 @52 % → 1 @61 % → 0 @84 % (≈ y 2731 / 3164 / 3286 / 3597).

### M30 – Heading fade, mobile (IX e-869 → a-257, `small` + `tiny`)
`.case--new-heading` opacity 0 @20 % → 1 @52 % → 0 @76 %; **all** `.height-cases` (global selector) opacity 0 @55 % → 1 @70 %.
(At ≤ 767 the first heading wrap is `display:none` and the `._2` copy inside the sticky area is shown; at ≤ 479 the reverse.)

### M31 – Sticky "stages" scroller (IX e-318 → a-165, continuous on `.height-cases` 400vh, `main` + `medium`)
`.cases-sticky-wrap` is `position:sticky; top:0; height:100vh`; left column = text items, right = rotating card wheel.

| p | ≈ y | target | value |
|---|---|---|---|
| 8 % | 2553 | `.rotate-ellipse-2` | rotateZ −31° |
| 8 % | | `.top-gradient` | opacity 1 |
| 14 % | 2823 | `.case--new-heading` (inside, `._2` copy) | opacity 0 |
| 19 % | 3048 | `.cards-cases-left-wrap` | translateY **25 %** |
| 19 % | | `.rotate-ellipse-2` | rotateZ −31° |
| 20 % | 3093 | `.case--new-heading` | opacity 1 |
| 22 % | 3183 | `.case--new-heading-wrap` | translateY 0 % |
| 30 % | 3543 | `.case-rotate-img.set-1`, `.set-2` | opacity 0 |
| 35 % | 3768 | `.case-rotate-img.set-1` | opacity 1 |
| 38 % | 3903 | `.rotate-ellipse-2` | rotateZ **−14°**, translateY 8 % |
| 39 % | 3948 | `.case--new-heading-wrap` | translateY **−112 %** |
| 46 % | 4263 | `set-1` | opacity 1 |
| 50 % | 4443 | `set-2`, `set-3` | opacity 0 |
| 54 % | 4623 | `set-1` | opacity 0 |
| 58 % | 4803 | `set-2` | opacity 1 |
| 60 % | 4893 | `.rotate-ellipse-2` | rotateZ **0°**, translateY 3 % |
| 63 % | 5028 | `set-2` | opacity 1 |
| 67 % | 5208 | `set-3` | opacity 0 |
| 71 % | 5388 | `set-2` | opacity 0 |
| 77 % | 5658 | `set-3` | opacity 1 |
| 80 % | 5793 | `.cards-cases-left-wrap` | translateY **−79 %** |
| 80 % | | `.rotate-ellipse-2` | rotateZ **14°**, translateY −2 % |
| 89 % | 6198 | `.cards-cases-right` | background `rgb(23,23,23)` |
| 89 % | | `.cards-cases-left`, `.top-gradient` | opacity 1 |
| 94 % | 6423 | `.cards-cases-right` | background `rgb(8,8,8)` |
| 94 % | | `.cards-cases-left`, `.top-gradient` | opacity 0 |

Images: set-1 `startup-1.webp` (card-2), set-2 `startup-2.webp` (card-3), set-3 `startup-3.webp` (card-4); card-1/card-5 empty, opacity 0.
Net effect: the wheel rotates −31° → 14° while the left text column scrolls up from +25 % to −79 % and each screenshot fades in
when its text block is centred; at the end the whole sticky panel fades to black.

### M32 – "Moving text" background sweep (S#42, scroll) – **no visible effect**
Sets `style.backgroundPosition` (1240 % → 30 % → −1240 %) on `#movingText1` between 15–24 % / 28–35 % of `.height-cases`.
The gradient-text CSS it was meant for is commented out in `<head>`, and `#movingText2` does not exist (throws inside
the range). Do not port, or port as a no-op.

### M33 – Short-viewport tweak (S#10, `load` + `resize`)
If `800 ≤ innerHeight ≤ 840` add `.height` to `.cards-cases-left-wrap` → CSS `.cards-cases-left-wrap.height{position:relative; top:-2.5rem}`.

### M34 – Mobile stages list (≤ 767): no animation besides M30; `.case-mob-wrap` shows 3 static cards.

---

## 5. Services (`section.is-cases`)

### M35 – Services heading reveal (IX e-415 → a-100, continuous on the section, `main` + `medium`)
| p | ≈ y | target | value |
|---|---|---|---|
| 12 % | 6207 | `.shadow` (= `.shadow.vertical.small`, black gradient mask over the heading) | translateY **−49 %** |
| 12 % | | `.b1.serv-sub.second`, `.section-name`, `.b1.serv-sub.max-w-40`, `.hero-tag-wrap.serv` | opacity 0 |
| 18 % | 6451 | `.stats-card-gradient.services.line` (light in the vertical line) | translate(−50 %, −100 %) |
| 20 % | 6532 | `.section-name`, `.b1.serv-sub.max-w-40`, `.hero-tag-wrap.serv` | opacity 1 |
| 23 % | 6653 | `.b1.serv-sub.second` | opacity 0 |
| 23 % | | `.shadow` | translateY **38 %** |
| 24 % | 6694 | `.stats-card-gradient.services.line` | translate(−50 %, 0 %) |
| 35 % | 7140 | `.b1.serv-sub.second` | opacity 1 |

### M36 – Services heading mask, mobile (IX e-508 → a-147, scroll into view 20 %, once, `small` + `tiny`)
`.shadow.vertical.small`: initial translateY −50 % (also emitted as an `html.w-mod-js:not(.w-mod-ix)` style in `<head>` for 480–767 and ≤ 479), then → 100 % over 2000 ms linear.

### M37 – Service card border glow loop (IX e-478 → a-134 "cta-border-rotate", CLASS `.card-glow`, scroll into view, loop, all)
Each `.card-glow`'s `.stats-card-gradient.services.set-n` (radial `rgba(255,255,255,.35)` → `#080808` 62 %) moves linear:
g0 (initial) translate(0 %, 0 %) 500 ms → g1 translateX 45 % 1500 ms → g2 translateY 29 % 1500 ms → g3 (0 %, 48 %) 1500 ms → g4 translateY 0 % 1500 ms → repeat.

### M38 – Card spotlight following the mouse (S#13 + head CSS)
`#cards.onmousemove`: for every `.service-card` set `--mouse-x/--mouse-y` = cursor position relative to that card.
`.service-card::before` = `radial-gradient(800px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,.06), transparent 20%)`, z 3, shown on card `:hover`;
`.service-card::after` = `radial-gradient(600px circle at …, rgba(255,255,255,.08), transparent 20%)`, z 1, shown when hovering anywhere in `#cards`
(`#cards:hover > .service-card::after` – note the cards are not direct children of `#cards`, so in practice only `::before` shows). Both `opacity` transition 500 ms.

### M39 – Service card lotties, IX-driven loops (scroll into view, loop, all breakpoints)
| card | event / list | lottie | sequence (progress %) |
|---|---|---|---|
| Brand Strategy `9327c432` | e-405 / a-95 | `.brand-lottie` `BrandStrategy ver2 6.json` (6.23 s) | 0→100 in 6230 ms; →0 (300 ms delay); 0→100 6230 ms; →0 (300 ms delay); repeat |
| Platforms `84e57622…e3` | e-407 / a-96 | `.platform-lottie` `Platform.json` (2.57 s) | 0→100 2570 ms; →0 after 300 ms; 0→100 2570 ms; →0; repeat |
| Website `336f199c…86` | e-411 / a-98 | `.web-lottie` `Webst.json` (4.47 s) | 0→100 4470 ms; →0; repeat |
| Development `eff56ce8` | e-413 / a-99 | `.brand-lottie._2` `Developmnt22.json` (3.47 s) | 0→93 % 3470 ms; →0; 0→97 % 3470 ms; →0; repeat |
| Mobile Apps `90c825d6` | e-409 / a-97 | – | list has no target → no-op (card shows the video, M41) |
All linear. The Development lottie also has `data-autoplay=1 data-loop=0` but IX drives it.

### M40 – Brand Visual logo cross-fade loop (IX e-403 → a-42, scroll into view, loop, all)
`.brand-item-img.abs.set-1` (coloured versions over grey logos) and `.abs.set-2`:
g0: set-1 opacity → 1 (1200 ms, delay 700, `ease`), set-2 → 0 (1000 ms, delay 700, `ease`);
g1: set-2 → 1 (1200 ms, delay 700), set-1 → 0 (1000 ms, delay 700); repeat (≈ 3.8 s cycle).

### M41 – Taxi app video (Mobile Apps card)
`<video id="video-2" autoplay loop muted data-object-fit="contain">` `taxi-app-main-v2_XdXjXRKv.mp4` inside
`.app-serv` (`.w-background-video-atom2`, wrapper inline `width:100%; height:70%`), `object-fit: contain`.

---

## 6. Clients (`section.is-clients`, white)

### M42 – Big brand cards scale-in (IX e-967 → a-276, continuous on the section, `main`, `medium`, `small`)
All `easeInOut` between keys: top row (McDonald's, Toyota) scale 0.5 @5 %; bottom row scale 0.5 @10 %;
McDonald's → 1 @20 %, Toyota → 1 @25 %, Red Bull → 1 @30 %, Dolby → 1 @35 %, IBM → 1 @40 %
(≈ y 9049 / 9225 / 9576 / 9751 / 9926 / 10102 / 10277).

### M43 – Big brand cards, tiny (IX e-968 → a-277, CLASS `.big-brand-card`, scroll into view, once, `tiny`)
Each card: initial scale 0.2 → 1 over 2000 ms `outExpo`.

### M44 – Clients heading mask, mobile (IX e-510 → a-148, scroll into view 30 %, `small` + `tiny`)
`.shadow.white.vert`: initial translateY −60 % → 100 % over 2000 ms linear.

### M45 – Startups paragraph (`h3[animate-2]`, the big grey/black statement)
- Desktop (S#38, `innerWidth >= 767`, on DOMContentLoaded): SplitType chars + `gsap.from({opacity:0, duration:2, ease:'power2.out', stagger:0.05, scrollTrigger:{trigger:'[animate-2]', start:'top 90%', end:'bottom 20%', scrub:true}})`.
- Mobile (S#37, `<= 766`): IntersectionObserver 0.1 → `gsap.from(chars,{opacity:0,duration:.25,ease:'power2.inOut',stagger:.03})` every entry.
- Mobile also (IX e-872 → a-258, `.startups` scroll into view 20 %, `small` + `tiny`): `.heading-3.max-w-82.color-black` opacity 0 → 1 over 1300 ms `ease`.

### M46 – Startup list item hover (CSS, ≥ 767 effective)
`.startup-list-item{transition: all .5s}` → `:hover{background:#F5F5F5}` (≤ 767: transparent). `.client-logo-hover` scale .85→1 / opacity 0→1 on hover (≥ 767) but the element is `display:none` → invisible.

### M47 – Secondary button hover (IX e-468/e-469 → a-125/a-126, CLASS `.btn-secondary`, all)
Used by "Case study", "View more on Clutch", "View more" (blog).
- Initial (a-125 g0): `.first-txt` y 0, `.second-txt` y 0, `.second-icon` translate(−1.5rem, 1.5rem), `.first-icon` (0,0).
- MOUSE_OVER (g1, 500 ms `ease`): `.second-icon` → (0,0), `.second-txt` → y −1.17rem, `.first-txt` → y −1.3rem, `.first-icon` → (1.5rem, −1.5rem)
  (text rolls up inside the 1.2 rem `overflow:hidden` mask; the arrow exits to the top-right while the copy enters from bottom-left).
- MOUSE_OUT (a-126, 500 ms `ease`): back to the initial values.

---

## 7. Testimonials (`section.is-testimonial`, white)

### M48 – "Clients speak out about us on Clutch" morph (S#43, `DOMContentLoaded`, `innerWidth > 767`)
Initial (inline): `.heading-2.size` ("about us") width 19.5rem, opacity 1; `.icon-clutch-full-icon` opacity 0;
`.first-line-testimoniall` height 4vw, scale 1, opacity 1; `.icon-clutch-small` opacity 1; `.heading-wrap-testimoniall` width 33rem;
`.icon-clutch-full` width 3.875vw, opacity 1.
On `scroll`, while the first `.header-block` straddles 20 % of the viewport height (`rect.top <= vh/5 <= rect.bottom`):
- scrolling **down** → "about us" width 0rem / opacity 0 (`width .5s ease, opacity .4s ease`); full Clutch logo opacity 1 (`.7s ease`);
  first line height 0vw, scale(.4), opacity 0 (`height .7s, transform .7s, opacity .3s`); small Clutch icon opacity 0 (`.5s`);
  heading wrap width 4rem (`.7s`); `.icon-clutch-full` width 16.6vw (`.7s`).
- scrolling **up** → initial styles again.
Result: "Clients speak out / about us on [C]" collapses into "on [Clutch]".

### M49 – Testimonial slider (S#39, Swiper 8)
Before init every `.swiper-slide` gets inline `width:600px`. Config:
`{ speed: 2100, slidesPerView: 1, spaceBetween: 14, allowTouchMove: true, loop: true, autoplay: false, mousewheel: {forceToAxis: true, sensitivity: 1}, keyboard: true, simulateTouch: true, touchRatio: 1, touchAngle: 45, breakpoints: { 767: { slidesPerView: 2.25, spaceBetween: 10 } } }`
No Swiper CSS file is loaded – only Webflow's `.swiper-wrapper{display:flex}` / `.swiper-slide{flex:0 0 auto}`; `.swiper` has no `overflow:hidden`
(slides overflow to the right edge). `loop:true` clones slides: 12 `.swiper-slide` (6 real + 6 `.swiper-slide-duplicate`), active index 3, wrapper `translate3d(-1837.33px,0,0)` @1440;
resolved slide width @1440 = 602.4 px ((1368 − 2×10)/2.25 ≈ 599 + rounding by Swiper 8) → the first real slide starts at the container's left edge.
Slide hover (S#39): `mouseenter` → background `#080808`, colour `#FFFFFF`; `mouseleave` → `#F5F5F5` / `#080808`; transition `background-color .7s ease, color .3s ease`.
(≤ 767 CSS makes slides `#080808` with white text by default.)

---

## 8. Awards (`section.is-awwards`)

### M50 – Awards heading + list fade (IX e-473 → a-133, continuous, `main` + `medium`)
`.heading-2.text-align-center.max-w-55` opacity 0 @20 % → 1 @32 %; `.awards-list` opacity 0 @20 % → 1 @30 % (≈ y 12956 → 13222).
`.blur-wrap` (blurred SVG glow) stays opacity 0 (not animated).

### M51 – Awards mask, mobile (IX e-512 → a-152, scroll into view, `small` + `tiny`)
`.shadow.vertical` (the `._2` heading mask): initial translateY −40 % → 30 % over 1000 ms linear.

### M52 – Award row hover (CSS, `min-width: 767px`)
`.awards-bg` (#171717, radius .875rem, centred, height 0 %) → height 100 % (`.5s`); `.awards-img` (8.125rem thumbnail, absolute right 15.69rem, top −2.1rem)
opacity 0 → 1 and scale .7 → 1 (`.6s`); `.heading-5` + `.awards-desc-2` colour → #fff (`.5s`); `.awards-desc-1`/`.awards-date` → #737373.
Plus the click sound M15 on `mouseenter`. ≤ 767: thumbnails always visible (opacity 1, right-aligned, translateY −50 %).

---

## 9. Blog (`section.is-blog`)

### M53 – Blog heading + list fade (IX e-474 → a-132, continuous, `main` + `medium`)
`.heading-2…text-color-white` ("Our News") opacity 0 @16 % → 1 @34 % → 1 @44 % → **0 @52 %**; `.collection-news-wrap` opacity 0 @16 % → 1 @34 % (stays 1).
(≈ y 14117 / 14526 / 14753 / 14934.)

### M54 – Blog mask, mobile (IX e-514 → a-150, scroll into view 20 %, `small` + `tiny`)
`.shadow.vertical` translateY −30 % → 30 % over 1000 ms linear (`.shadow.vertical.hide` is display:none → no visible effect).

### M55 – Custom cursor 2 (purple) – **inactive**: `.custom-cursor-2` is `display:none` and no script shows it.

---

## 10. FAQ (`section.is-faq`)

### M56 – FAQ heading mask + side shadow (IX e-475 → a-131, continuous, `main` + `medium`)
| p | ≈ y | target | value |
|---|---|---|---|
| 15 % | 15445 | `.shadow.vertical._2` (0ed997cc…979) | translateY −40 % |
| 15 % | | `.heading-3.text-align-center.text-color-white` | opacity 0 |
| 17 % | 15497 | `.shadow.hide-mob` (0ed997cc…a05) | translateX −54 % |
| 24 % | 15680 | heading | opacity 1 |
| 25 % | 15706 | `.shadow.vertical._2` | translateY 63 % |
| 30 % | 15837 | `.shadow.hide-mob` | translateX 30 % |

### M57 – FAQ heading mask, mobile (IX e-516 → a-151, scroll into view 20 %, `small` + `tiny`)
`.shadow.vertical` translateY −30 % → 30 % over 1000 ms linear.

### M58 – FAQ accordion (IX DROPDOWN_OPEN/CLOSE on each of the 11 `.faq-dropdown.w-dropdown`, all)
Webflow dropdown behaviour: click on `.dropdown-toggle` toggles `w--open` on toggle + list (`data-hover=false`, `data-delay=0`);
opening an item **closes any other open item** (verified in the reference: open #1, then click #2 → only #2 open); a real click outside also closes (Webflow default).
- Initial (a-76 g0, applied on load): `.drop-list` height 0 px (it is `display:block; overflow:hidden`), `.line-1` rotateZ −90° (with `.line-2` at 0° → "+"), `.faq-answer-p` opacity 0, `.plus-faq` rotate 0.
- Open (a-76 g1): `.drop-list` height → auto 600 ms `ease`; `.line-1` → 0° 400 ms `ease` (→ "−"); `.plus-faq` → 45° 300 ms; `.faq-answer-p` opacity → 1 600 ms (linear).
- Close (a-77): answer opacity → 0 600 ms; `.line-1` → −90° 350 ms; `.plus-faq` → 0° 500 ms; `.drop-list` height → 0 500 ms `ease`.
(`.plus-faq` is an empty 16 px box, its rotation is invisible.)

---

## 11. CTA (`section.is-cta`)

Three IX animations drive the same element, the border glow `.stats-card-gradient._2` inside `.cta-card-wrapper`:
### M59 – CTA reveal sweep (IX e-442 → a-113, scroll into view 10 % on `.cta-card-wrapper`, once, all)
Initial: wrapper scale 1 opacity 1; gradient translateX −90 %. Then gradient → translateX 0 over 2000 ms linear (wrapper scale/opacity 1 → 1 = no-op, `outExpo`).
### M60 – CTA border loop (IX e-476 → a-134 on `.cta-wrap`, scroll into view, loop, all) – same keyframes as M37.
### M61 – CTA scroll (IX e-470 → a-127, continuous on the section, **all** breakpoints)
gradient translate(0 %, 100 %) @0 % → (0 %, 0 %) @45 % (≈ y 16697 → 17525).
The engine applies whichever action last wrote the transform each frame; visually: a light moving along the card border.

---

## 12. Fixed "Book a call" button, cookie banner

### M62 – Floating "Book a call" pill (`.contact-book-a-call.home`, fixed bottom-right 1.1 rem, `#774DFF`, radius 6.94 rem)
No animation; contains an absolutely-positioned `a#callButton.book_a_call` (href "" – S#18/S#20 call `#menuButton.click()`, which does not exist → JS error; Calendly widget.js is loaded but never initialised). Treat as a static link target.

### Cookie banner (Finsweet Cookie Consent, `fs-cc-mode="opt-in"`) – not an animation of the page itself
`.fs-cc-banner_component` fixed bottom-right (1 rem) card, shown by the Finsweet script on first visit;
IX a-283 (click `.fs-cc-banner_trigger`, hidden): display flex + translateY 100 % → 0 (300 ms ease); a-284: → 100 % then display none.
Captures hide it (`tools/lib/capture.mjs` HIDE list). Rebuild may omit it or include it behind the same selector.

---

## 13. Non-animated but time-dependent things the capture tooling pins
See `tools/lib/capture.mjs`: videos paused at frame 0, lotties frozen (autoplay → middle frame, IX-driven → frame 0),
M17/M27/M37/M60 loops pinned to their g0 transform, M40 pinned to set-1 = 1 / set-2 = 0, cookie banner hidden,
time-based GSAP tweens jumped to the end before each screenshot. The rebuild must expose `window.gsap` and `window.lottie`
and keep the class names used in `PINS` (or the comparison must pass equivalent selectors).
