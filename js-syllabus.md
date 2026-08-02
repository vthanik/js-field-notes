# JavaScript for a Statistical Programmer — Course

**End goal (in priority order):**
1. Maintain and extend real Shiny custom JS, like `nova.js` / `shinychat` coupling.
2. Build a Shiny app with complete custom JS of your own, from a blank file.
3. (Parked) Enough React/Next.js to keep building the explorer-app rebuild.

**Format, from here on:** short pages, one concept each — code first, then
a few sentences, then a "Check yourself." No long essays, no tangents
unless you ask. Modeled directly on web.dev/learn/javascript's structure.

**Core resources:**
- *JavaScript for Impatient Programmers* (free, exploringjs.com/impatient-js)
  — spine for Modules 1–2.
- *Eloquent JavaScript* (free, eloquentjavascript.net) — **only ch. 13–15**
  (browser, DOM, events).
- MDN (developer.mozilla.org) — reference for Modules 4–5. Look things up
  here, don't read it cover to cover.
- Shiny's own JS docs (shiny.posit.co/py/docs / the R pkgdown site's
  "JavaScript" articles) — Module 5 spine.
- React/Next.js docs — Module 7, parked.

---

## Module 1 — Core Language Foundations

**Lesson 1 — Variables & Values** ✅ *(file: `lesson-01-variables-and-values.md`)*
- [x] 1.1 Declaring variables: `const` / `let` / why `var` is dead
- [x] 1.2 Primitive vs. reference values ("same box, two labels")
- [x] 1.3 `const` doesn't freeze an object
- [x] 1.4 The 7 basic value types + `typeof`

**Lesson 2 — `undefined`/`null` & Truthy-Falsy** ✅ *(file: `lesson-02-undefined-null-truthy-falsy.md`)*
- [x] 2.1 `undefined` vs. `null`
- [x] 2.2 Optional chaining `?.`
- [x] 2.3 Truthy/falsy conversion (the 8 falsy values)

**Lesson 3 — Functions** ✅ *(file: `lesson-03-functions.md`)*
- [x] 3.1 Declarations vs. arrow functions
- [x] 3.2 Hoisting
- [x] 3.3 Closures
- [x] 3.4 `this` binding
- [x] 3.5 Bare block scope
- [x] 3.6 Higher-order functions
- [x] 3.7 Naming conventions
- [x] *(bonus, Module 3 preview)* `document` & `querySelector` basics

**Lesson 4 — Objects & Destructuring**
- [ ] 4.1 Object literals & shorthand properties
- [ ] 4.2 Destructuring (`const { a, b } = obj`)
- [ ] 4.3 Spread & rest (`{...obj, x: 1}`)

**Lesson 5 — Arrays & Array Methods**
- [ ] 5.1 `.map` / `.filter` / `.reduce`
- [ ] 5.2 Mutating vs. non-mutating methods
- [ ] 5.3 `.find` / `.some` / `.every` / `.indexOf` / `.splice`

**Lesson 6 — Strings & Template Literals**
- [ ] 6.1 Template literals & interpolation
- [ ] 6.2 Common string methods

**Lesson 7 — Classes & Prototypes (light pass)**
- [ ] 7.1 Class syntax
- [ ] 7.2 `this` inside a class

**Lesson 8 — Modules**
- [ ] 8.1 `import` / `export`
- [ ] 8.2 When you don't need them (plain `<script>`-loaded files like `nova.js`)

## Module 2 — Asynchronous JavaScript

**Lesson 9 — The Event Loop** 🟡 *(preview covered in Lesson 1)*
- [~] 9.1 Why JS doesn't block on slow operations

**Lesson 10 — Promises**
- [ ] 10.1 Creating and consuming a Promise
- [ ] 10.2 `.then` / `.catch` chains

**Lesson 11 — `async`/`await`** 🟡 *(preview covered in Lesson 1)*
- [~] 11.1 `async`/`await` syntax
- [ ] 11.2 `try/catch` around `await`

## Module 3 — Browser & DOM (Eloquent JS ch. 13–15)

**Lesson 12 — The DOM Tree**
- [~] 12.1 `document` & `querySelector` *(covered early, in Lesson 3's appendix)*
- [ ] 12.2 Tree navigation: parent / child / sibling

**Lesson 13 — Events**
- [ ] 13.1 `addEventListener`
- [ ] 13.2 Bubbling vs. capturing
- [ ] 13.3 Event delegation (why `nova.js` binds one listener to `document`)

**Lesson 14 — Building & Changing Elements**
- [ ] 14.1 `createElement` / `classList` / `dataset`
- [ ] 14.2 `textContent` vs. `innerHTML` (and why `nova.js` never uses the latter)

**Lesson 15 — Forms & `FormData`**
- [ ] 15.1 Reading form data (ties back to the Server Actions code from earlier)

## Module 4 — Advanced Browser APIs (MDN, not book material)

**Lesson 16 — `WeakMap` & Per-Element State**
- [ ] 16.1 Why `novaScrollTimers` uses a `WeakMap` instead of a plain object

**Lesson 17 — `MutationObserver`**
- [ ] 17.1 Watching the DOM for changes

**Lesson 18 — `requestAnimationFrame` & Debouncing**
- [ ] 18.1 Why `novaQueueResync` batches work instead of running on every mutation

**Lesson 19 — `localStorage` / `sessionStorage`**
- [ ] 19.1 Persisting preferences client-side
- [ ] 19.2 Defensive error handling (blocked/partitioned storage)

**Lesson 20 — Custom Elements / Web Components basics**
- [ ] 20.1 `customElements.define`, shadow DOM — enough to read shinychat's own Lit source

## Module 5 — Shiny Integration API (NEW)

*The piece no JS book covers, because it's Shiny's convention, not the
language's. This is what turns "I can read nova.js" into "I can build a
Shiny app with its own complete custom JS."*

**Lesson 21 — JS → R: `Shiny.setInputValue`**
- [ ] 21.1 Sending data from the browser to the R server
- [ ] 21.2 The `{priority: "event"}` option

**Lesson 22 — R → JS: `Shiny.addCustomMessageHandler`**
- [ ] 22.1 Receiving pushed data from the R server
- [ ] 22.2 Registering a handler safely (once, guarded)

**Lesson 23 — The R Side**
- [ ] 23.1 `session$sendCustomMessage()`
- [ ] 23.2 A proper `Shiny.InputBinding` (the formal way to register a
      custom input type, vs. nova's more ad-hoc DOM-poking approach)

**Lesson 24 — Attaching JS to a Shiny App**
- [ ] 24.1 `htmltools::tags$script`, `includeScript()`
- [ ] 24.2 Packaging JS as a proper HTML dependency

## Module 6 — Synthesis

**Lesson 25 — Read `nova.js` End to End**
- [ ] 25.1 Full annotated pass, every technique named

**Lesson 26 — Capstone: Build a Custom Shiny Input From Scratch**
- [ ] 26.1 A small, real custom input — blank file to working component

## Module 7 — React/Next.js (parked, separate track)

- [ ] TypeScript Handbook basics
- [ ] React fundamentals (react.dev/learn)
- [ ] Next.js Foundations course (nextjs.org/learn)
- [ ] Apply both to the explorer-app rebuild

---

**Key:** ✅/`[x]` done · 🟡/`[~]` partially covered · `[ ]` not started
