# Sources & References

Every external resource consulted while building this course. All lesson
text and code examples in `js-course.html` / `index.html` are original —
written fresh for this course, not copied from any source below. This file
exists for attribution and as a "go deeper" reading list.

## Core language

- **JavaScript for Impatient Programmers** (Dr. Axel Rauschmayer) —
  exploringjs.com/impatient-js — spine for Module 1–2 topic ordering.
- **Eloquent JavaScript** (Marijn Haverbeke), chapters 13–15 only —
  eloquentjavascript.net — browser/DOM/events reference for Module 3.
- **MDN Web Docs** (Mozilla) — developer.mozilla.org — canonical reference
  for `document`, `querySelector`, and all Web APIs throughout.
- **Airbnb JavaScript Style Guide** — github.com/airbnb/javascript —
  source for the arrow-function parameter/style conventions in Lesson 3.8
  and 0.9.

## Shiny / R integration (Module 5)

- **Outstanding User Interfaces with Shiny** (David Granjon) —
  unleash-shiny.rinterface.com — Chapter 10 ("JavaScript for Shiny")
  shaped Lesson 0's jQuery Part 2; Chapter 11 ("Communicate between R and
  JS") and Chapter 15 ("Optimize your apps with custom handlers") shaped
  Lessons 21–22 on `Shiny.setInputValue` / `addCustomMessageHandler`.
- **shinychat** — github.com/posit-dev/shinychat — checked directly for
  its Lit/TypeScript-based web component architecture (Module 4/6 context).
- **querychat** — checked for its dependency on shinychat (Module 5
  "compose vs. build" framing).

## Design / site build

- **web.dev** (Google) — web.dev/learn/javascript — structural model for
  the course site's page-per-concept format; DevTools-inspected color
  tokens (`#202124`, `#5F6368`, `#1A73E8`, `#F1F3F4`, `#DADCE0`) applied
  directly to `js-course.html`'s CSS.
- **Google Sans Flex** — fonts.google.com/specimen/Google+Sans+Flex —
  released under the SIL Open Font License; used for headings/body text.
  (Plain "Google Sans," served from web.dev's internal `gstatic.com` CDN
  URL, was deliberately NOT used — unclear public redistribution rights.)
- **Roboto / Roboto Mono** (Google Fonts) — used for UI labels and code.

## Applied example source

- **`nova.js`** — a user-provided Shiny custom-JS file — source of most
  Lesson 3 code examples (closures, `this`, naming conventions, DOM
  patterns), used with permission as the applied-learning material
  throughout the course.
