# Outcrowd homepage — copy checklist

Source of truth: the saved snapshot (see `spec/copy.json` → `_about.source`). Every item is verbatim. Machine-readable version: `spec/copy.json`. Automated check: `npm run text-diff -- [reference] [candidate-url]` (see header of `tools/text-diff.mjs`).

**Legend:** `[nbsp]` = U+00A0 no-break space · `[zwj]` = U+200D zero-width joiner · `⏎` = forced `<br>` · strings shown in code spans, exactly as in the source.

**Conventions for the rebuild**
- All strings are verbatim from the snapshot DOM (entities decoded). Typos, straight vs curly quotes and trailing spaces are kept on purpose.
- Special characters appear as real characters; U+00A0 (no-break space) and U+200D (zero-width joiner) are written as \u00a0 / \u200d escapes so they are visible.
- A value of {text, html} means the element contains markup (&lt;br&gt;, &lt;span&gt;, &lt;a&gt;): "html" is the exact innerHTML to reproduce, "text" its text with each forced &lt;br&gt; written as "\n".
- Asset URLs are given as live URLs (the snapshot mirrors them under /Users/kartikmiital/Downloads/assets/&lt;host&gt;/&lt;path&gt;). Video URLs are as mirrored by the saver (query string folded into the file name).
- All &lt;img&gt; elements on the page have alt="" (decorative). No element in &lt;body&gt; has aria-label or title; the only ARIA attribute is aria-current="page" on the logo link, plus role="list"/"listitem" on the blog CMS lists.
- "strings" is the flat per-section list compared by tools/text-diff.mjs (DOM order, whitespace collapsed, &lt;br&gt; = space). "hiddenAt" lists strings that are in the DOM but not rendered at that viewport (desktop 1440x900, tablet 991x900, mobile 390x844).
- Mark rebuilt sections with data-section="&lt;key&gt;" (keys below) so text-diff can map them even if class names change.

**Typos / oddities that must be kept verbatim**
- "View detais" (cases buttons)
- "in it's core" (cards heading, straight apostrophe)
- "Finance|able" (Financeable description)
- "How long it will take to get an estimate from you?" (FAQ)
- "the more accurate will our estimates be" (FAQ)
- trailing space: "Crypto product design in the AI era: How to build trust before users connect a wallet "

**String counts** (flat text units per section, as compared by text-diff): preloader 1 · header 16 · hero 2 · cards 9 · cases-heading 2 · cases-new 23 · services 16 · clients 26 · testimonial 30 · awards 33 · blog 6 · faq 23 · cta 4 · book-call 1 · footer 35 · cookies 3 · total 230

**Section keys** (put `data-section="<key>"` on the rebuilt element):

| key | reference selector |
|---|---|
| `preloader` | `#preloader` |
| `header` | `header.header-new` |
| `hero` | `section.hero.home` |
| `cards` | `section.bg-dark.cards` |
| `cases-heading` | `.case--new-heading-wrap:not(._2)` |
| `cases-new` | `section.is-cases-new` |
| `services` | `section.is-cases` |
| `clients` | `section.is-clients` |
| `testimonial` | `section.is-testimonial` |
| `awards` | `section.is-awwards` |
| `blog` | `section.is-blog` |
| `faq` | `section.is-faq` |
| `cta` | `section.is-cta` |
| `book-call` | `.contact-book-a-call` |
| `footer` | `footer.footer` |
| `cookies` | `.cookies` |

## Head / meta

- [ ] **&lt;html lang&gt;:** `en`
- [ ] **&lt;title&gt;:** `Creative branding agency for startups ✪ Outcrowd ✪ Creative branding, web design & development agency`
- [ ] **meta description:** `Outcrowd is a ➠ digital creative agency for startups that designs and develops great digital products ☑ We are creating branding, websites and mobile applications to deliver a great experience ✓`
- [ ] **og:title:** `Creative branding agency for startups ✪ Outcrowd ✪ Creative branding, web design & development agency`
- [ ] **og:description:** `Outcrowd is a ➠ digital creative agency for startups that designs and develops great digital products ☑ We are creating branding, websites and mobile applications to deliver a great experience ✓`
- [ ] **og:image:** `https://cdn.prod.website-files.com/667a7576e7e7ef3ba89b3f2a/66c5fa54f279c1be13cb813e_Opengraph.png`
- [ ] **og:type:** `website`
- [ ] **twitter:title:** `Creative branding agency for startups ✪ Outcrowd ✪ Creative branding, web design & development agency`
- [ ] **twitter:description:** `Outcrowd is a ➠ digital creative agency for startups that designs and develops great digital products ☑ We are creating branding, websites and mobile applications to deliver a great experience ✓`
- [ ] **twitter:image:** `https://cdn.prod.website-files.com/667a7576e7e7ef3ba89b3f2a/66c5fa54f279c1be13cb813e_Opengraph.png`
- [ ] **twitter:card:** `summary_large_image`
- [ ] **viewport:** `width=device-width, initial-scale=1`
- [ ] **canonical:** `https://www.outcrowd.io`
- [ ] **favicon (rel="shortcut icon", type image/x-icon):** `https://cdn.prod.website-files.com/667a7576e7e7ef3ba89b3f2a/66c8868efa543e643672fbac_favicon-logo.webp`
- [ ] **apple-touch-icon:** `https://cdn.prod.website-files.com/667a7576e7e7ef3ba89b3f2a/66c88694a996450fa3340232_webclip-logo.webp`
- [ ] **Google font (WebFont.load):** `Lora:300,400,500,600,700`
  > ITC Avant Garde Std (Md, MdCn, Bk, BkCn, XLtObl) via the Webflow CSS

## Preloader (`#preloader`) — 1 text-diff string

- [ ] **#startPreloader button label:** `Button Text`
  > Webflow placeholder label; element is not meant to be seen (preloader-button).
- [ ] **Lottie:** `https://cdn.prod.website-files.com/667a7576e7e7ef3ba89b3f2a/66bdf91fdd174c6bcc01dcce_logo%20dark.json`

## Header / nav (`header.header-new`) — 16 text-diff strings

- [ ] **Logo link:** `/` (aria-current=`page`, Lottie white + dark)
  - lottie `66bdefa0a9bf14b3cb560686_logo white.json` (.logo-white)
  - lottie `66bdf91fdd174c6bcc01dcce_logo dark.json` (.logo-black)

### Desktop nav links

  > Each nav link renders the label twice (".nav" + ".hover") for the vertical flip-on-hover animation.
- [ ] **Nav link:** `Cases` / hover `Cases` → `/cases`
- [ ] **Nav link:** `Service` / hover `Service` → `/services`
- [ ] **Nav link:** `Blog` / hover `Blog` → `/blog`
- [ ] **Nav link:** `About us` / hover `About us` → `/about-us`

### Header buttons

- [ ] **Book a call (div + Calendly):** `Book a call` → Calendly `https://calendly.com/vlad-outcrowd/introductory-call-outcrowd-team?hide_gdpr_banner=1` (anchor #callButton, href="")
- [ ] **Contact:** `Contact` → `/contact-us`

### Mobile menu (`.mob-menu`, burger)

- [ ] **Mobile link:** `Cases` → `/cases`
- [ ] **Mobile link:** `Service` → `/services`
- [ ] **Mobile link:** `Blog` → `/blog`
- [ ] **Mobile link:** `About us` → `/about-us`
- [ ] **Email:** `hello@outcrowd.io` → `mailto:hello@outcrowd.io`
- [ ] **Social icon:** `66a6043f15171cfef875605c_dribbble-icon 1.svg` → `#` (alt="")
- [ ] **Social icon:** `66a60440bb21735987e1a061_Vector.svg` → `#` (alt="")
- [ ] **Social icon:** `66a6043fe2f6b52ee7d1d12a_ph_instagram-logo-fill.svg` → `#` (alt="")
- [ ] **Social icon:** `66a6043f6f3bdb0490b33e85_Social Icons.svg` → `#` (alt="")
- [ ] **Social icon:** `66a6043f8b939a6f0fde8e05_Vector-1.svg` → `#` (alt="")
  > In the mobile menu all 5 social icons link to "#" (footer has the real URLs).
- [ ] **Mobile Contact button:** `Contact` → `/contact-us`
- [ ] **Page background image (.page-wrapper &gt; img.light):** `66c5abcb1c03eb30625c251c_Group.webp` (alt="")

## Hero (`section.hero.home`) — 2 text-diff strings

- [ ] **Tag:** `Digital brand design agency`
- [ ] **H1:** `Design & Brand Acceleration for[nbsp]SaaS Startups`
  - markup: `Design &amp; Brand Acceleration for&nbsp;SaaS Startups`
  > Non-breaking space between "for" and "SaaS" (&nbsp;).
- [ ] **Showreel video (#video, playsinline loop muted autoplay):** `https://dl.dropboxusercontent.com/scl/fi/ok2coppn7h6oszgfy30y4/showreel-home_rlkey%3Dk7sd1apdwi6fyy3wxhk6dz87v%26st%3Dam36ikxc%26dl%3D0.mp4`
- [ ] parallax img `66b9b7b8ea25bbf68fbc72ee_hero-home-parallax.svg` (.hero-paralax set-2, alt="")
- [ ] parallax img `66a8e0a6898bcd8285ba40cc_hero-paralax-3.1.svg` (.hero-paralax set-3, alt="")
- [ ] parallax img `66a8e0c1603ea7019475e9ae_hero-paralax-5.svg` (.hero-paralax set-5, alt="")
- [ ] parallax img `66a8ec38aff5a2579c7cb771_hero-paralax-set-6.svg` (.hero-paralax set-6 hide-laptop, alt="")
- [ ] parallax img `66a8e0b2aadf7c2841ba04a2_hero-paralax-4.svg` (.hero-paralax set-4 hide-laptop, alt="")
- [ ] parallax img `66a8e0da2e8d3fa142f7b939_Frame 427320036.svg` (.hero-paralax set-7 hide-laptop, alt="")
- [ ] parallax img `66a8dff469352b6206d9477a_hero-paralax-1.svg` (.hero-paralax set-1 hide-laptop, alt="")
- [ ] parallax Lottie `66b4c977900d76e30fe8ecc3_vidget 10.json` (.hero-paralax set-6 hide-mob)
- [ ] parallax Lottie `66b4c978a3d27cd1602dbf7e_vidget 12.json` (.hero-paralax set-4 hide-mob)
- [ ] parallax Lottie `66b4c9781b2505e59242128c_vidget 11.json` (.hero-paralax set-7 hide-mob)
- [ ] parallax Lottie `66b4c978fc17bce93c65a9b6_vidget 9.json` (.hero-paralax set-1 hide-mob)

## Stats cards (`section.bg-dark.cards`) — 9 text-diff strings

- [ ] **H2 [animate]:** `We prove, design, implement, and market your idea with absolute transparency and efficiency in it's core`
  > Split by SplitType (lines, words, chars; tagName span) at &gt;=767px and chars fade in on scroll (scrub). Keep the original string; note "it's" (straight apostrophe, sic).
- [ ] **Stat:** `$300m` — `In funding clients raised owing to our design work`
  - img `66c83397d4e9225b89268b44_chat popup.webp` (alt="")
- [ ] **Stat:** `60+` — `World’s biggest international design awards won`
  - Lottie `66b4c978a3d27cd1602dbf83_vidget 13.json`
- [ ] **Stat:** `100M` — `Active users experiencing our design every day via products we made`
  - Lottie `66b4c97780a7b9ca43accca2_vidget 14.json`
- [ ] **Stat:** `24%` — `Of total marketing budgets converted into sales with our branding & materials`
  - Lottie `66b4c977eb0e529c9b631be6_vidget 15.json`

## Cases heading (`.case--new-heading-wrap`, between cards and is-cases-new) — 2 text-diff strings

- [ ] **H2 #movingText1:** `Stages of startup development`
- [ ] **Text #movingText3:** `Examples of our most common engagement models into early-stage start-ups on different stages of the lifecycle.`
  > This block appears twice: once before section.is-cases-new and again inside .cases-sticky-wrap (identical text, duplicate ids movingText1/movingText3). Scroll-driven horizontal movement (inline script).

## Startup stages (`section.is-cases-new`) — 23 text-diff strings

- [ ] **Sticky H2 (duplicate):** `Stages of startup development`
- [ ] **Sticky text (duplicate):** `Examples of our most common engagement models into early-stage start-ups on different stages of the lifecycle.`

### Desktop cards (`.cases-cards-left-item`)

- [ ] **H3:** `Pre-seed Bootstrapped`
- [ ] **Paragraph 1:** `This is POC stage. You have a hypothetical product idea, you want it done & tested properly to know whether it’s worth the time and resources.`
- [ ] **Paragraph 2:** `More than 40% of our clients on this stage get initial investment for MVPs`
  - markup: `<span class="text-color-white">More than 40%</span> of our clients on this stage get initial investment for MVPs`
- [ ] **Button (hidden, class "hide"):** `View detais` → `#`
- [ ] **H3:** `Seed`
- [ ] **Paragraph 1:** `This is an MVP stage. You approved a product-market fit and want to start working with real users, and start initial marketing efforts.`
- [ ] **Paragraph 2:** `More than 25% of our clients get Series A investments to build full-scale product and start marketing`
  - markup: `<span class="text-color-white">More than 25%</span> of our clients get Series A investments to build full-scale product and start marketing`
- [ ] **Button (hidden, class "hide"):** `View detais` → `#`
- [ ] **H3:** `Series A`
- [ ] **Paragraph 1:** `This is a product optimisation stage. You raised the investment and faced burn-rates while expanding further.`
- [ ] **Paragraph 2:** `We’ve helped every start-up we worked with at this stage to cut costs and improve user experience`
  - markup: `We’ve helped <span class="text-color-white">every start-up</span> we worked with at this stage to cut costs and improve user experience`
- [ ] **Button (hidden, class "hide"):** `View detais` → `#`
- [ ] rotating card img `66c46332f4c126638f4aab2e_startup-1.webp` (alt="")
- [ ] rotating card img `66c46332e77197f7d0a36ead_startup-2.webp` (alt="")
- [ ] rotating card img `66c46332a94d7b4ba339bb39_startup-3.webp` (alt="")

### Mobile cards (`.case-mob-home`) — copy differs from desktop!

  > Mobile cards (.case-mob-wrap) are NOT identical to the desktop cards: card 1 says "You got hypothetical product idea … worth time and resources." (desktop: "You have a hypothetical product idea … worth the time and resources."), card 2 says "Series A investment" (desktop: "investments"), card 3 says "We’ve helped each and every start-up" (desktop: "We’ve helped every start-up"). Mobile text joins the two paragraphs with &lt;br&gt;&lt;br&gt;. Keep both variants verbatim.
- [ ] **Heading:** `Pre-seed Bootstrapped`
- [ ] **Text:** `This is POC stage. You got hypothetical product idea, you want it done & tested properly to know whether it’s worth time and resources. ⏎  ⏎ More than 40% of our clients on this stage get initial investment for MVPs`
  - markup: `This is POC stage. You got hypothetical product idea, you want it done &amp; tested properly to know whether it’s worth time and resources.<br><br><span class="text-color-white">More than 40%</span> of our clients on this stage get initial investment for MVPs`
- [ ] **Button:** `View detais` → `#`
  - img `66c46332f4c126638f4aab2e_startup-1.webp` (alt="")
- [ ] **Heading:** `Seed`
- [ ] **Text:** `This is an MVP stage. You approved a product-market fit and want to start working with real users, and start initial marketing efforts. ⏎  ⏎ More than 25% of our clients get Series A investment to build full-scale product and start marketing`
  - markup: `This is an MVP stage. You approved a product-market fit and want to start working with real users, and start initial marketing efforts.<br><br><span class="text-color-white">More than 25%</span> of our clients get Series A investment to build full-scale product and start marketing`
- [ ] **Button:** `View detais` → `#`
  - img `66c46332e77197f7d0a36ead_startup-2.webp` (alt="")
- [ ] **Heading:** `Series A`
- [ ] **Text:** `This is a product optimisation stage. You raised the investment and faced burn-rates while expanding further. ⏎  ⏎ We’ve helped each and every start-up we worked with at this stage to cut costs and improve user experience`
  - markup: `This is a product optimisation stage. You raised the investment and faced burn-rates while expanding further.<br><br>We’ve helped each and <span class="text-color-white">every start-up</span> we worked with at this stage to cut costs and improve user experience`
- [ ] **Button:** `View detais` → `#`
  - img `66c46332a94d7b4ba339bb39_startup-3.webp` (alt="")

## Services (`section.is-cases`) — 16 text-diff strings

- [ ] **H2:** `Services`
- [ ] **Sub (p):** `Whether you need a full-scale IT partner to define the roadmap or a vendor for particular tasks, we got you`
- [ ] **Tag:** `Complex solution`
- [ ] **Text:** `Instead of a request which sounds like “I need a website”, we embrace - “I want to market my product to get first organic users”, where we can suggest what to do, and execute the approved plan from A to Z.`
  > #cards container: mouse-follow glow on .card-glow (inline script). Order in DOM: Brand Strategy, Brand Visual, Platforms, Website, Mobile Apps, Development.
- [ ] **Card H4:** `Brand Strategy` — `We establish comprehensive product-market fit hypotheses, validate them, and visualise in the most creative ways.`
  - Lottie `66c5f3ef1571f03e6a8ea9bd_BrandStrategy ver2 6.json`
- [ ] **Card H4:** `Brand Visual` — `We create brand materials that speak of your values non-verbally and complement your offering to the market.`
  - img `66b07d4f2bec93cba5a3d384_brand-line-2-1.svg` (alt="")
  - img `66b07e4f4bec20016bbe1124_brand-line-1-color.svg` (alt="")
  - img `66c366f7d9ef5f478c9202b1_Group 427320477.webp` (alt="")
  - img `66b07d4f0961f661081c4f87_brand-line-2-3.svg` (alt="")
  - img `66c366f712b8e5005065e2f7_Group 427320478.webp` (alt="")
  - img `66b07dc410edead2c1e14b9f_Group 427320476.webp` (alt="")
  - img `66b07d1c441fc462e761d231_brand-line-1-3.svg` (alt="")
  - img `66b07d1c8064490bd29b4efa_brand-line-1-2.svg` (alt="")
  - img `66b07e4f2ced01bc0bfbd3f8_brand-line-1-color3.svg` (alt="")
  - img `66b07d1c423eba907f44c5c8_brand-line-1-1.svg` (alt="")
  - img `66b07d1c8d9dac749b2813a9_brand-line-1-4.svg` (alt="")
  - img `66b07e4fbba83b5f8b2c5ac2_brand-line-1-color4.svg` (alt="")
- [ ] **Card H4:** `Platforms` — `We think about the big picture and focus primarily on your app's business success. We research deeply, validate thoroughly, and launch confidently.`
  - Lottie `667a7576e7e7ef3ba89b3f87_Platform.json`
- [ ] **Card H4:** `Website` — `We don’t just design websites. We build reliable sales & marketing tools that drive predictably good metrics.`
  - Lottie `667a7576e7e7ef3ba89b3f85_Webst.json`
- [ ] **Card H4:** `Mobile Apps` — `We're masters of UX gamification and user engagement. In a world where any app competes with Instagram we make usable products that attract and retain.`
  - video #video-2 `https://dl.dropboxusercontent.com/scl/fi/jy5cqifucxea6mo5tx2id/taxi-app-main-v2_XdXjXRKv_rlkey%3D7ibn8inbyq804uxjjmhhml5q4%26st%3Dtlh7klec%26dl%3D0.mp4`
- [ ] **Card H4:** `Development` — `We can take care of your product’s implementation, assuring the most efficient usage of time & resources in every decision & each line of code while maintaining seamless operation.`
  - Lottie `66ab8b10eaf1ec4297b4c7e2_Developmnt22.json`

## Clients (`section.is-clients`, id="clients") — 26 text-diff strings

- [ ] **H3:** `Our design thinking is recognised by enterprises we cooperated with`
- [ ] brand logo `66f4fafa6da01e9c086c507e_brand-5.svg` (alt="")
- [ ] brand logo `66f4fafae2de07e06d1f1bb1_brand-4.svg` (alt="")
- [ ] brand logo `66f4fafa8f80679c4ae3e71c_brand-1.svg` (alt="")
- [ ] brand logo `66f4fafa294921d7ae181afc_brand-2.svg` (alt="")
- [ ] brand logo `66f4fb01c905e0766236e231_brand-3.svg` (alt="")
- [ ] **H3 [animate-2]:** `We think about the big picture and focus primarily on your product’s funding & business success. ⏎ [zwj] ⏎ We research deeply, validate thoroughly, and launch confidently.`
  - markup: `We think about the big picture and focus primarily on your product’s funding &amp; business success.<br>‍<br><span class="text-color-dark m">We research deeply, validate thoroughly, and launch confidently.</span>`
  > Contains &lt;br&gt;, a U+200D zero-width joiner, &lt;br&gt;, then &lt;span class="text-color-dark m"&gt;. SplitType (lines, words, chars) at &gt;=767px, scrubbed char fade.
- [ ] **Startup:** `Brainforest` — `Outcrowd partnered with Brainforest, an AI-powered productivity platform for students. Our comprehensive brand identity work and intuitive UX/UI design transformed the platform, significantly improving user retention and attracting new investments.`
  - [ ] button `Case study` / hover `Case study` → `https://www.brainforest.io/` (target=`_blank`)
- [ ] **Startup:** `Fitonist` — `Our team assisted Fitonist, a gym workout mobile app, with a cohesive brand identity and an intuitive design across their website and mobile application. Our strategic approach enhanced user engagement and significant growth in new sign-ups.`
  - [ ] button `Case study` / hover `Case study` → `https://fitonist-app.webflow.io/` (target=`_blank`)
- [ ] **Startup:** `Cybervergent` — `Cybervergent's strategic website redesign simplified offerings, showcased their full range of products, and positioned them as a leading cybersecurity solutions provider, resulting in increased digital trust and market expansion.`
  - [ ] button `Case study` / hover `Case study` → `https://www.cybervergent.com/` (target=`_blank`)
- [ ] **Startup:** `Nopan` — `We created a full branding package for Nopan, including a logo, brand guide, and an investor-focused pitch deck, along with a dynamic landing page to highlight their innovative account-to-account payment offer.`
  - [ ] button `Case study` / hover `Case study` → `https://nopan.webflow.io/` (target=`_blank`)
- [ ] **Startup:** `Financeable` — `Outcrowd transformed Finance|able into a user-centric learning platform, driving significant growth in student enrollment through intuitive design and engaging content.`
  - [ ] button `Case study` / hover `Case study` → `https://finance-able.com/` (target=`_blank`)
- [ ] **Startup:** `Stable0x` — `Outcrowd has partnered with Stable0x, a cross-chain stablecoin startup. Our branding and website design helped them quickly establish credibility in competitive DeFi, attracting early adopters and setting the stage for rapid growth.`
  - [ ] button `Case study` / hover `Case study` → `https://stable0x.com/` (target=`_blank`)
  > Section heading/client names: "Financeable" is the list name, while the description writes "Finance|able" (pipe, sic).

## Testimonials (`section.is-testimonial`, id="clutch") — 30 text-diff strings

- [ ] **Kicker (h5):** `70+ reviews`
- [ ] **H2 part 1:** `Clients speak out`
- [ ] **H2 part 2:** `about us`
- [ ] **H2 part 3:** `on`
  > Heading reads "Clients speak out / about us on [Clutch logo]" — three separate h2 elements followed by the Clutch icon (small + full SVG); a separate .clutch-mob image is used on mobile.
- [ ] **Slide:** `“We are really happy that our paths crossed with Outcrowd.”` — `Artem Khardin`, `CEO`, rating `5.0` + stars.svg
- [ ] **Slide:** `“They became a valuable team member.”` — `Jonathan Hughes`, `CEO`, rating `5.0` + stars.svg
- [ ] **Slide:** `"We were pleased with their attention to detail."` — `Angel Marinov`, `CEO`, rating `5.0` + stars.svg
- [ ] **Slide:** `"The company was very professional."` — `Magnus Sigurbjornsson`, `COO`, rating `5.0` + stars.svg
- [ ] **Slide:** `"We enjoyed working with the team, liked their approach and designs."` — `Perry Skoutelas`, `CEO & Co-Founder`, rating `5.0` + stars.svg
- [ ] **Slide:** `"I was really impressed with their speed and how quickly things moved."` — `Andrew Gross`, `CEO & Co-Founder`, rating `5.0` + stars.svg
  > Quote marks are inconsistent on purpose: slides 1–2 use curly “…”, slides 3–6 use straight "…". Keep verbatim.
- [ ] **Button:** `View more on Clutch` / hover `View more on Clutch` → `https://clutch.co/profile/outcrowd#highlights` (target=`_blank`)

## Awards (`section.is-awwards`) — 33 text-diff strings

- [ ] **H2:** `Awards for digital innovation`
- [ ] **Award:** `Awwwards` · `Fitonist` · `Site of the Day` · `Aug 25, 2024` · img `66d6faa2963f467f6f335e32_2544e904898d400486be5930400d3149.webp`
- [ ] **Award (hidden: class "hide"):** `TheFWA` · `Fitonist` · `FWA of the Day` · `Jul 23, 2024` · img `66bf1bd4cd6a3ee4e33d1d59_Fitonist FOTD.webp`
- [ ] **Award:** `Awwwards` · `FinanceAble` · `Honorable Mention` · `Mar 06, 2024` · img `66bf1bd56c4164cbdc412b3c_certificate-finance-able-hm.webp`
- [ ] **Award:** `TheFWA` · `Deed Delivery` · `FWA of the Day` · `Dec 30, 2023` · img `66bf1bd56f46a2e8ccd27fe3_FOTD Deed.webp`
- [ ] **Award:** `CssDA` · `EventBeds` · `Website of the Day` · `Dec 29, 2023` · img `66bf1bd5bc25c2a233ae8e23_Eventbeds cssda-wotd.webp`
- [ ] **Award:** `Awwwards` · `Mota` · `Honorable Mention` · `Nov 30, 2023` · img `66bf1bd55ee55250318c8ddb_certificate-mota-remote-platform-hm.webp`
- [ ] **Award:** `CssDA` · `Dstafin` · `Website of the Day` · `Aug 18, 2023` · img `66bf1bd5ca25cc45810b2e1b_DSTAFIN-cssda-wotd.webp`
- [ ] **Award:** `CssDA` · `KMBCH` · `Website of the Day` · `Feb 25, 2023` · img `66bf1bd5fda0ce5d67566799_KMBCH-cssda-wotd.webp`
  > The TheFWA / Fitonist / FWA of the Day (Jul 23, 2024) item has class "hide" (display:none) but is in the DOM.

## Blog (`section.is-blog`) — 6 text-diff strings

- [ ] **H2:** `Our News`
- [ ] **Featured post:** `From Confusing UX to Market Traction: Redesigning a Complex B2B SaaS` → `/blog/from-confusing-ux-to-market-traction-redesigning-a-complex-b2b-saas` · img `6abb90753969c5085e0ce8ab_356.jpg`
- [ ] **Post:** `How to Make Your B2B SaaS Brand Visually Recognizable` → `/blog/how-to-make-your-b2b-saas-brand-visually-recognizable` · img `6ab77404af1c61b16dc35c9f_1_46hKGhht6pljgKrlQfhLHQ.webp`
- [ ] **Post:** `Crypto product design in the AI era: How to build trust before users connect a wallet ` → `/blog/crypto-product-design-in-the-ai-era-how-to-build-trust-before-users-connect-a-wallet` · img `6a6864514d34e986c096facf_7344.png`
  > No dates, tags or excerpts are rendered on the homepage (".desc-blog" is empty: w-dyn-bind-empty). The third title ends with a trailing space in the source ("…connect a wallet ").
- [ ] **Button:** `View more` / hover `View more` → `/blog`

## FAQ (`section.is-faq`) — the 11 dropdowns — 23 text-diff strings

- [ ] **H3:** `Questions and Answers`
  > These 11 Webflow w-dropdown accordions are the "11 dropdown menus" — the nav itself has no dropdowns. Container ids: #faq-row-1.
- [ ] **Q1:** `How long does it take to get started?`
  - [ ] **A1:** `Our turnaround is lightning-fast. Just one week from signing off and we’re there with the kick-off meeting to get it rolling.`
- [ ] **Q2:** `What is your typical working process?`
  - [ ] **A2:** `It all starts with grabbing a cup of coffee, chilling with mates, and some quality time at the PlayStation (just kidding!). We always start a project with analysis, learning the requirements, and making estimates that will be shared in the price proposal. Then it’s off to signing off, kicking off, and getting your business to the next level with a pinch of our design magic.`
- [ ] **Q3:** `Do you work on a fixed-price basis or time and material?`
  - [ ] **A3:** `Flexibility is the key of success in this crazy world, so we try to suggest an appropriate solution for each specific case we deal with. The more clear and detailed the requirements are, the more accurate will our estimates be. This is the closest we get to the fixed-price model.`
- [ ] **Q4:** `How do you usually start new collaborations?`
  - [ ] **A4:** `Each new engagement starts with an introduction call and filling out the design/branding brief. If you have a cool project in mind, feel free to get in touch at hello@outcrowd.io`
    - markup: `Each new engagement starts with an introduction call and filling out the design/branding brief. If you have a cool project in mind, feel free to get in touch at <a href="mailto:hello@outcrowd.io" class="faq-link">hello@outcrowd.io</a>`
- [ ] **Q5:** `Do you guys work with big companies only? We’re an early-stage startup.`
  - [ ] **A5:** `We’re all for building a borderless world, so we are open to working with any project we come across. By the way, we do believe in startups, and one of those we helped develop from scratch has been sold to businesswire.com`
    - markup: `We’re all for building a borderless world, so we are open to working with any project we come across. By the way, we do believe in startups, and one of those we helped develop from scratch has been sold to <a target="_blank" href="https://www.businesswire.com/news/home/20210310005166/en/%C2%A0Entercom-Acquires-Podcast-Influencers-Marketplace-Podcorn" class="faq-link">businesswire.com</a>`
- [ ] **Q6:** `How long it will take to get an estimate from you?`
  - [ ] **A6:** `We hate to keep you waiting. Setting up a team, making preliminary research and analysis, and getting back to you with the contract will take up to 24 hours from the moment we learn what’s needed. Efficiency is one of Outcrowd’s key values.`
- [ ] **Q7:** `Do you have a minimum engagement?`
  - [ ] **A7:** `We set no entry thresholds for people who want to work with us. But we still believe that a product that needs to be designed can’t be made within a couple of days. After all, we need some time to research, analyze and come up with a strategy. So we’ve set a minimum project duration as 30 hours and we’re waiting for you!`
- [ ] **Q8:** `What’s the average project duration?`
  - [ ] **A8:** `Our team works full-time on every project, so the overall duration will highly depend on the initial estimate. On average, our projects last from 2 weeks to 5 months.`
- [ ] **Q9:** `Can we start the design without wireframes?`
  - [ ] **A9:** `Wireframes help to build UX without distractions. The wireframe is an essential part of the design process and we would not recommend eliminating it. Having everything polished at the wireframing stage, we can avoid many amendments and revisions at the design stage, which saves both time and money.`
- [ ] **Q10:** `What templates does Outcrowd use to create design?`
  - [ ] **A10:** `We don’t use pre-built templates or kits because there’s just no soul in them. We’re committed to building fully customized and product-based solutions that will meet the expectations of the target users. Each pixel and line is designed with love and passion by our creative minds.`
- [ ] **Q11:** `Where should I start with my business if I have an idea?`
  - [ ] **A11:** `Hey, you’ve come to the right place! Please get in touch and we’ll help you with the ideation, design, and development. Full cycle on us, no hassle for you. Easy, right?`

## CTA (`section.is-cta`) — 4 text-diff strings

- [ ] **H2:** `Innovate with us`
- [ ] **Text:** `Our creative solutions have helped clients raise $100+ mln and expand their reach.`
- [ ] **Button:** `Write us` → `/contact-us`
- [ ] **Button (div + Calendly):** `Book a call` → Calendly `https://calendly.com/outcrowd-digital-agency/introduction?hide_gdpr_banner=1`
- [ ] image `66bf047f8e12e9868e4c8f45_dashboard-cta.svg` (alt="")

## Floating "Book a call" (`.contact-book-a-call.home`) — 1 text-diff string

- [ ] **Label:** `Book a call` → Calendly `https://calendly.com/vlad-outcrowd/introductory-call-outcrowd-team?hide_gdpr_banner=1`
  > Floating "Book a call" pill (.contact-book-a-call.home) after section.is-cta, inside &lt;main&gt;.

## Footer (`footer.footer`) — 35 text-diff strings


### Column 1: Cases

- [ ] **Column heading link:** `Cases` → `/cases`
- [ ] **Link:** `Fitonist` → `https://fitonist-app.webflow.io/` (target=`_blank`)
- [ ] **Link:** `Brainforest` → `https://www.brainforest.io/` (target=`_blank`)
- [ ] **Link:** `Cybervergent` → `https://www.cybervergent.com/` (target=`_blank`)
- [ ] **Link:** `Nopan` → `https://nopan.webflow.io/` (target=`_blank`)
- [ ] **Link:** `Ramos` → `https://ramos-app.webflow.io/` (target=`_blank`)

### Column 2: Services

- [ ] **Column heading link:** `Services` → `/services`
- [ ] **Link:** `Complex solution` → `#`
- [ ] **Link:** `Branding` → `/branding-page`
- [ ] **Link:** `Design` → `/design-page`
- [ ] **Link:** `Development` → `/development-page`

### Column 3: About us

- [ ] **Column heading link:** `About us` → `/about-us`
- [ ] **Link:** `Numbers` → `/about-us#numbers`
- [ ] **Link:** `Mission` → `/about-us#mission`
- [ ] **Link:** `Values` → `/about-us#values`
- [ ] **Link:** `Clients` → `/about-us#clients`

### Contact & socials

- [ ] **Email:** `hello@outcrowd.io` → `mailto:hello@outcrowd.io`
- [ ] **Social:** `66a6043f15171cfef875605c_dribbble-icon 1.svg` → `https://dribbble.com/outcrowd` (target=`_blank`)
- [ ] **Social:** `66a60440bb21735987e1a061_Vector.svg` → `https://www.behance.net/outcrowd` (target=`_blank`)
- [ ] **Social:** `66a6043fe2f6b52ee7d1d12a_ph_instagram-logo-fill.svg` → `https://www.instagram.com/outcrowdstudio/` (target=`_blank`)
- [ ] **Social:** `66a6043f6f3bdb0490b33e85_Social Icons.svg` → `https://x.com/outcrowdstudio` (target=`_blank`)
- [ ] **Social:** `66a6043f8b939a6f0fde8e05_Vector-1.svg` → `https://www.linkedin.com/company/outcrowd-network/?originalSubdomain=ua` (target=`_blank`)
  > Dribbble, Behance, Instagram, X, LinkedIn (icons have empty alt and no aria-label).
- [ ] **Copyright:** `Copyright © 2025 Outcrowd Inc. All rights reserved.`
- [ ] **Location:** `Lewes - USA`
  > Every footer link renders its label twice (flip hover). Footer case links are external (target=_blank) even though they carry the internal-link attribute. "Complex solution" links to "#".

## Cookie banner (`.cookies`) — 3 text-diff strings

- [ ] **Text:** `By clicking “Accept All Cookies”, you agree to the storing of cookies on your device to enhance site navigation, analyze site usage, and assist in our marketing efforts.`
- [ ] **Button (fs-cc="deny"):** `Deny all` → `#`
- [ ] **Button (fs-cc="allow"):** `Accept` → `#`
  > Finsweet cookie consent banner (fs-cc, opt-in mode).

## Viewport visibility (strings in the DOM but not rendered)

- **preloader @ desktop:** `Button Text`
- **preloader @ tablet:** `Button Text`
- **preloader @ mobile:** `Button Text`
- **header @ desktop:** `Cases`, `Service`, `Blog`, `About us`, `hello@outcrowd.io`, `Contact`
- **header @ tablet:** `Cases`, `Service`, `Blog`, `About us`, `hello@outcrowd.io`, `Contact`
- **header @ mobile:** `Cases`, `Service`, `Blog`, `About us`, `Book a call`, `Contact`, `Cases`, `Service`, `Blog`, `About us`
- **cases-new @ desktop:** `Stages of startup development`, `Examples of our most common engagement models into early-stage start-ups on different stages of the lifecycle.`, `View detais`, `View detais`, `View detais`
- **cases-new @ tablet:** `Stages of startup development`, `Examples of our most common engagement models into early-stage start-ups on different stages of the lifecycle.`, `View detais`, `View detais`, `View detais`
- **cases-new @ mobile:** `Stages of startup development`, `Examples of our most common engagement models into early-stage start-ups on different stages of the lifecycle.`, `This is POC stage. You have a hypothetical product idea, you want it done & tested properly to know whether it’s worth the time and resources.`, `More than 40% of our clients on this stage get initial investment for MVPs`, `View detais`, `Seed`, `This is an MVP stage. You approved a product-market fit and want to start working with real users, and start initial marketing efforts.`, `More than 25% of our clients get Series A investments to build full-scale product and start marketing`, `View detais`, `Series A`, `This is a product optimisation stage. You raised the investment and faced burn-rates while expanding further.`, `We’ve helped every start-up we worked with at this stage to cut costs and improve user experience`, `View detais`, `Pre-seed Bootstrapped`
- **awards @ desktop:** `TheFWA`, `Fitonist`, `FWA of the Day`, `Jul 23, 2024`
- **awards @ tablet:** `TheFWA`, `Fitonist`, `FWA of the Day`, `Jul 23, 2024`
- **awards @ mobile:** `TheFWA`, `Fitonist`, `FWA of the Day`, `Jul 23, 2024`

## All hrefs (text-diff checks every one on the candidate)

| href | count | target=_blank | sections |
|---|---|---|---|
| `/` | 1 |  | header |
| `/cases` | 3 |  | header, footer |
| `/services` | 3 |  | header, footer |
| `/blog` | 3 |  | header, blog |
| `/about-us` | 3 |  | header, footer |
| `(empty)` | 3 |  | header, cta, book-call |
| `/contact-us` | 3 |  | header, cta |
| `mailto:hello@outcrowd.io` | 3 |  | header, faq, footer |
| `#` | 14 |  | header, cases-new, footer, cookies |
| `https://www.brainforest.io/` | 2 | 2 | clients, footer |
| `https://fitonist-app.webflow.io/` | 2 | 2 | clients, footer |
| `https://www.cybervergent.com/` | 2 | 2 | clients, footer |
| `https://nopan.webflow.io/` | 2 | 2 | clients, footer |
| `https://finance-able.com/` | 1 | 1 | clients |
| `https://stable0x.com/` | 1 | 1 | clients |
| `https://clutch.co/profile/outcrowd#highlights` | 1 | 1 | testimonial |
| `/blog/from-confusing-ux-to-market-traction-redesigning-a-complex-b2b-saas` | 1 |  | blog |
| `/blog/how-to-make-your-b2b-saas-brand-visually-recognizable` | 1 |  | blog |
| `/blog/crypto-product-design-in-the-ai-era-how-to-build-trust-before-users-connect-a-wallet` | 1 |  | blog |
| `https://www.businesswire.com/news/home/20210310005166/en/%C2%A0Entercom-Acquires-Podcast-Influencers-Marketplace-Podcorn` | 1 | 1 | faq |
| `https://ramos-app.webflow.io/` | 1 | 1 | footer |
| `/branding-page` | 1 |  | footer |
| `/design-page` | 1 |  | footer |
| `/development-page` | 1 |  | footer |
| `/about-us#numbers` | 1 |  | footer |
| `/about-us#mission` | 1 |  | footer |
| `/about-us#values` | 1 |  | footer |
| `/about-us#clients` | 1 |  | footer |
| `https://dribbble.com/outcrowd` | 1 | 1 | footer |
| `https://www.behance.net/outcrowd` | 1 | 1 | footer |
| `https://www.instagram.com/outcrowdstudio/` | 1 | 1 | footer |
| `https://x.com/outcrowdstudio` | 1 | 1 | footer |
| `https://www.linkedin.com/company/outcrowd-network/?originalSubdomain=ua` | 1 | 1 | footer |

Other URLs that must exist in the page or its JS: `https://calendly.com/vlad-outcrowd/introductory-call-outcrowd-team?hide_gdpr_banner=1`, `https://calendly.com/outcrowd-digital-agency/introduction?hide_gdpr_banner=1`

Images: 91 `<img>`, all with `alt=""`. Lottie players: 14. Videos: 2. aria-label: none. title attributes: none.
