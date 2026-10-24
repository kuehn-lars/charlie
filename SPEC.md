# Project: "Für Charlie" (date invitation website)

Build a small, polished single-page website where I (Lars) ask the girl I'm dating, Charlotte ("Charlie"), out on a date. Hosted from a PUBLIC GitHub repo via GitHub Pages. Her answers are sent to my email via Web3Forms. All visible text is German. I'm an experienced software engineer: write code and docs at that level.

## Process
1. Save this entire spec verbatim as SPEC.md in the repo root.
2. Study the attached images:
   - Image 1: visual style reference.
   - Image 2: Lewin, Charlie's horse (model the pixel horse on him).
   Also open https://www.fumadocs.dev/ in a real browser via Playwright and take screenshots (desktop and mobile). A plain fetch only returns text.
3. Give me a short plan (file structure, scene rendering approach, final palette, sprite approach) and STOP until I reply "OK".

## Git rules (strict)
- You may `git init` and commit locally with clear conventional commit messages.
- NEVER push, add a remote, create a GitHub repo, run `gh repo create`, or publish anything, until I explicitly say so in chat. This applies even when running autonomously.

## Tech stack
- Vite + TypeScript (strict mode), no UI framework. Minimal dependencies. npm, Node LTS.
- ESLint + Prettier. Vitest for unit tests. Playwright for e2e (projects: WebKit at 390x844 with touch, Chromium at 1440x900).
- Fonts: Geist and Geist Mono, self-hosted via Fontsource. No external runtime requests except the Web3Forms API.
- Vite `base` is '/charlie/' (must match the repo name; keep it in one place).
- GitHub Actions workflow (.github/workflows/deploy.yml): on push to main, typecheck, lint, test, build, then deploy with actions/configure-pages, actions/upload-pages-artifact, actions/deploy-pages. Pin action versions.
- Performance budget: initial JS under 60 KB gzipped, no layout shift, smooth 60fps on an iPhone.

## Platform requirements
- Flawless on current iPhone Safari and desktop Chrome, Safari, Firefox.
- Mobile first: 100dvh, safe-area insets, inputs at least 16px (no iOS zoom), tap targets at least 44px, nothing essential behind hover.
- Canvas: requestAnimationFrame, devicePixelRatio aware with integer scaling, pause when the tab is hidden.
- prefers-reduced-motion: calmer scene, Nein button simply hides.

## Visual style
- Match the pixelated, dithered aesthetic of fumadocs.dev and image 1 as closely as possible: crisp dithered pixel art (integer scaling, image-rendering: pixelated), subtle grid lines, thin 1px borders, generous whitespace, clean modern typography, neutral UI with one accent.
- Professional and clean first, cute second. A well-crafted product page by a skilled engineer. No kitsch: no emoji spam, no glitter, no hearts everywhere, no playful body fonts.
- Do not copy Fumadocs' logo, images or code. Original pixel art only.
- Typography: Geist for text, Geist Mono for labels, numbers and metadata. A pixel display font only if it matches the reference.
- Palette (refine if something works better, keep pink as the accent):
  - background #FBF6F3, ink #1F1A1C, muted #8A7F84, border #E9DFDC
  - accent rose #E8638C, blush #F7C6D3 (dither partner), meadow sage #8FB89A
- Light theme only, unless a dark theme looks equally good.

## Interactive pixel scene (hero)
Canvas scene in the dithered style, behind or above the question:
- Lewin (based on image 2): walks or trots across a meadow, idles, grazes, flicks his tail.
- A cat that chases the cursor (desktop) or last tap position (touch), then sits and blinks.
- A dog that trots around and occasionally wags.
- Pointer interaction: dithered pixels near the pointer scatter softly and drift back. Tapping Lewin makes him hop or rear with a few pixel hearts. Tapping cat or dog triggers a small reaction.
- Sprites defined in code (pixel arrays or generated spritesheets), multiple frames per animation. Clean sprite and animation abstraction so adding an animal or animation is straightforward.
- Subtle enough that text always stays readable.

## Flow (single page, smooth transitions, progress label "1 / 4")

### Step 1: Die Frage
- Headline: "Charlie, gehst du mit mir auf ein Date?"
- Buttons "Ja" (primary) and "Nein" (secondary).
- "Nein" must be impossible to press. Decide behavior per event via `pointerType`, not only media queries:
  - Mouse: when the cursor comes within about 100px, jump to a random spot away from the cursor, fully inside the viewport, never overlapping "Ja" or the headline. Also escape on keyboard focus.
  - Touch/pen: on pointerdown, dissolve into pixels and disappear. Prevent the click; no click may ever register.
  - "Ja" grows very slightly after each escape. Optional micro-copy under the buttons, e.g. "Netter Versuch."
- "Ja": short, tasteful pixel celebration, then step 2.

### Step 2: Wann?
- Custom calendar (not native date input). German locale, week starts Monday, month navigation, past dates disabled, fully keyboard accessible.
- Controlled from config.ts:
  - blockedDates: single dates and ranges with optional reason (hover or tap), greyed or hatched, not selectable.
  - highlightedDates: dates with a label (e.g. "Lars hat frei"), accent styling.
  - blockedWeekdays, minDate, maxDate (default: today until 3 months ahead).
- Date semantics: represent days as local 'YYYY-MM-DD' strings, interpret everything in Europe/Berlin, never parse date-only strings with `new Date(...)` (UTC shift). Format with Intl.DateTimeFormat('de-DE'). Cover DST and month edges in unit tests.
- Multiple date and time combinations: after picking a day, choose preset time chips from config (e.g. 12:00, 15:00, 18:00, 19:30) or "Andere Uhrzeit" with a custom time input. Several times per day allowed, no duplicates.
- Selected slots listed sorted, format "Sa, 31. Okt · 19:30", each removable. Max count configurable.
- "Weiter" disabled until at least one slot exists.

### Step 3: Was machen wir?
- Option cards from config.ts with tiny pixel icons: "Charlie kocht", "Sushi essen", "Bowling". Adding options only requires editing config.ts.
- Highlighted extra card: "Ich kann mich nicht entscheiden, Lars entscheidet." Accent border plus small badge (e.g. "Empfohlen"). Playful but classy.
- Single choice by default, config flag allowMultiple.

### Step 4: Notiz
- Optional textarea "Möchtest du mir noch etwas sagen?" with character counter (max 1000).
- Clean summary of all choices, each section editable (jumps back to its step), then "Absenden".

### Step 5: Fertig
- Success screen, e.g. "Hervorragend.", animals doing a small happy animation.
- Error state with retry. Her inputs are never lost.

## State persistence
- Persist progress (current step, slots, activity, note, Nein counter) in localStorage, wrapped in try/catch, so a reload or closed tab on her phone resumes where she left off. Clear after successful submission.

## Web3Forms
- POST JSON via fetch to https://api.web3forms.com/submit with Content-Type and Accept set to application/json. Access key in config.ts (public by design), placeholder "YOUR_ACCESS_KEY".
- Treat the request as successful only if the response body has `success: true`. Timeout via AbortController (15s).
- Payload: subject "Charlie hat geantwortet", from_name "Date-Website", and a cleanly formatted German message: all slots with weekday ("Samstag, 31. Oktober 2026 um 19:30 Uhr"), chosen activity, note, number of Nein attempts, submission time (Europe/Berlin).
- Hidden honeypot field (botcheck). Loading state, no double submission.
- config.DRY_RUN: when true, log the payload instead of sending.

## config.ts
- Single, fully typed, well-commented file at the root with everything I might change: names, horse name and colors, all texts, palette, blocked and highlighted dates, time presets, activities, allowMultiple, max slots, Web3Forms key, SITE_URL, DRY_RUN. Nothing personal hard-coded elsewhere.
- Validate config at startup in dev (invalid dates, inverted ranges, dates both blocked and highlighted, missing key) with clear console warnings, covered by unit tests.
- Add a comment at the top: the repo is public, so everything in this file is publicly readable.

## Polish and SEO
- Title "Für Charlie", pixel heart favicon (SVG plus apple-touch-icon).
- Open Graph and Twitter tags with absolute URLs from SITE_URL, injected at build time. A 1200x630 og:image in the pixel style so iMessage and WhatsApp previews look good.
- <meta name="robots" content="noindex">.
- Semantic HTML, proper labels, visible focus states, aria-live for step changes.

## README.md (for an experienced developer, no beginner explanations)
Architecture overview and module responsibilities, scene engine design (sprite format, animation state machines, how to add an animal or animation), full config.ts reference, date semantics and timezone decisions, Web3Forms integration details and free-tier limits, npm scripts, testing strategy, deployment via GitHub Actions (Settings → Pages → Source: "GitHub Actions", base path must match the repo name), known limitations.

## Done when
- `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build` all pass with zero errors and warnings.
- Playwright e2e passes on both projects, covering: full happy path with DRY_RUN, Nein escapes on mouse and disappears on touch without ever registering a click, blocked dates not selectable, multiple slots incl. same day, persistence across reload, error state with retry (mocked API).
- Screenshots at 390x844 and 1440x900 for every step, reviewed critically against image 1 and the Fumadocs screenshots, with anything misaligned or cheap fixed.
- README.md is complete as specified.
- All work is committed locally. Nothing has been pushed and no remote exists.
