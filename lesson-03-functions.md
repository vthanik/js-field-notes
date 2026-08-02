# Lesson 3 — Functions

*Module 1, Syllabus Lesson 3. Covers: declarations vs. arrow functions,
hoisting, closures, `this` binding, bare block scope, and higher-order
functions — all pulled from a real Shiny custom-JS file (`nova.js`).*

---

## A. Declarations vs. arrow functions — different jobs, not just style

`function name() {}` for anything called by name elsewhere in the file:

```js
function novaTextarea() {
  return document.querySelector(NOVA_SEL.textarea);
}
```

Arrow functions for throwaway callbacks handed straight to something else:

```js
document.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".nova-card-actions button");
  ...
});
```

Pattern: named `function` for reusable utilities referenced by name
elsewhere (self-documenting — `novaTextarea()` reads as "get the
textarea," no comment needed). Arrow functions for one-off logic that only
ever runs in that one spot.

---

## B. Hoisting

Before JS runs a single line of code, it does a pass through the current
scope and registers every declared name first — function declarations,
`var`, `let`, `const`, class declarations — *before* execution starts top
to bottom. That pre-registration is called **hoisting**: as if the
declarations got lifted to the top of the scope, even though they're
written lower down. R has nothing like this — R evaluates and executes as
it goes, no separate registration pass.

Different declarations get hoisted *differently*, and that difference is
what matters day to day.

**Function declarations — fully hoisted, name AND body:**

```js
sayHi(); // works fine, even though this runs BEFORE the definition below

function sayHi() {
  console.log("hi");
}
```

The entire function is available anywhere in its scope, even above its
own definition. This is why a utility like `novaTextarea()` can be called
from code written earlier in the file than the function itself.

**`var` — hoisted, but only the name, not the value:**

```js
console.log(x); // undefined — not a crash, but not 5 either
var x = 5;
```

JS knows `x` exists from the top of the scope, but the assignment only
happens when that line executes. One reason `var` causes bugs and nobody
uses it anymore.

**`let`/`const` — hoisted, but locked behind a "temporal dead zone":**

```js
console.log(y); // ReferenceError: Cannot access 'y' before initialization
let y = 5;
```

JS knows `y` will exist, but touching it before its declaration line
throws instead of silently returning `undefined`. That gap — between
"the scope starts" and "the declaration line runs" — is the **temporal
dead zone (TDZ)**, deliberately stricter than `var` to catch this exact
bug at the moment it happens.

**Arrow functions assigned to `const`/`let` — NOT usable early, because
of the rule above:**

```js
greet(); // TypeError: Cannot access 'greet' before initialization

const greet = () => {
  console.log("hi");
};
```

`novaTextarea` (a named `function` declaration) can be called from
anywhere in the file. An arrow function stored in a `const` follows
`const`'s TDZ rule instead — it doesn't exist as a usable value until its
own line runs, regardless of the fact that it happens to hold a function.

**Rule of thumb:** define-before-use is always safe and is what to write
regardless of what hoisting technically permits. Hoisting is a "why does
this weird error say what it says" tool, not a style to lean on. Seeing
`ReferenceError: Cannot access 'x' before initialization` means: a
`let`/`const` (or an arrow function stored in one) got used before its
own declaration line ran.

---

## C. Closures — the concept most of this file leans on

```js
novaAttachments.forEach((att) => {
  ...
  remove.addEventListener("click", () => {
    const i = novaAttachments.indexOf(att);
    if (i >= 0) novaAttachments.splice(i, 1);
    ...
  });
});
```

`att` is a parameter of the outer `forEach` callback. The inner function —
the one passed to `addEventListener` — uses `att` too, but doesn't run
until the user actually clicks the remove button, possibly minutes later,
long after `novaRenderChips` has finished executing and returned. `att` is
still there, correct, for that specific chip.

**Closure:** an inner function keeps a live reference to the variables
from the scope it was born in, even after that outer scope is done.

Using an *index* instead of closing over `att` directly would break the
moment a chip earlier in the list gets removed and every index after it
shifts by one. Closures sidestep that entirely by never using an index at
all.

---

## D. Arrow functions don't have their own `this`

A regular `function` gets a fresh `this`, decided by how it's *called*,
not where it's written — a classic source of bugs. An arrow function has
no `this` of its own; it uses whatever `this` was in the surrounding code
when it was written.

```js
const btn = { label: "Send", handleClick: function() { console.log(this.label); } };
document.querySelector("button").addEventListener("click", btn.handleClick);
// logs undefined — `this` inside a regular function is decided by the CALLER
// (the button element), not by where the function was defined
```

Swap that for an arrow function and `this` stays whatever it was
outside — exactly why nearly every listener in `nova.js` is an arrow
function. Nobody had to think about `this` binding once, anywhere in that
codebase.

---

## E. Bare `{ }` blocks aren't functions

```js
{
  const savedTheme = novaStore((s) => s.getItem("nova-pref-theme"), null);
  ...
}
```

Just a scope wall. `const`/`let` are block-scoped, so wrapping code in
`{ }` keeps `savedTheme` from leaking out as a de facto global once this
line's done. Before `let`/`const` existed (pre-2015), people got the same
effect with an IIFE — `(function(){ ... })()`, a function defined and
called in the same breath. You'll see that pattern in older tutorials and
older code; this file uses the modern, lighter version.

---

## F. Higher-order functions

Functions that take or return functions — the array methods used
everywhere in this file:

```js
kids.every((k) => k.classList.contains("nova-tool-line"))
```

`.every()` takes a function, runs it against each element, returns `true`
only if every call returns `true`. Same shape as R's `purrr::every()` or
`all(sapply(kids, f))` — different syntax, identical idea. `.forEach`,
`.map`, `.filter`, `.some` all take a function as an argument the same
way, and this file uses all four constantly.

---

## G. Naming conventions

JS doesn't enforce any of this — the language runs fine with any casing.
These are community conventions, consistently followed enough that
breaking them reads as wrong to anyone who knows the language.

- **camelCase** — variables, functions, methods: `querySelector`,
  `addEventListener`, `novaTextarea`, `savedTheme`. First word lowercase,
  every following word capitalized, no underscores. JS's default for
  almost everything.
- **PascalCase** — classes and constructor functions: `Array`, `Promise`,
  `Date`, `MutationObserver`. Capital first letter signals "this is a
  type/constructor, call it with `new`."
- **UPPER_SNAKE_CASE** — constants meant to be read as fixed
  configuration:

  ```js
  const NOVA_SEL = {
    container: "shiny-chat-container",
    input: ".shiny-chat-input",
    ...
  };
  ```

  A convention signal, not enforcement — `const` alone doesn't require
  uppercase, and uppercase alone doesn't stop the object's *contents*
  from being mutated (Lesson 1: `const` locks the binding, not the
  contents). All-caps is purely a human signal: "don't edit this
  casually."

R comparison: R's ecosystem is inconsistent — base R leans
`snake_case`/`dot.case` (`read.csv`, `is.na`), tidyverse leans
`snake_case` (`read_csv`, `group_by`). JS has one dominant convention
(camelCase) applied far more uniformly across the whole language and its
libraries.

---

**Check yourself** — the classic closure test, predict before running:

```js
function makeCounter() {
  let count = 0;
  return function() {
    count += 1;
    return count;
  };
}
const counterA = makeCounter();
const counterB = makeCounter();
console.log(counterA());
console.log(counterA());
console.log(counterB());
```

What do those three lines print — and do `counterA` and `counterB` share
one `count`, or does each have its own?

<details>
<summary>Answer (try it yourself first)</summary>

`1`, `2`, `1`. Each call to `makeCounter()` creates a brand-new `count`
variable and a brand-new inner function closing over *that* variable.
`counterA` and `counterB` are two separate closures, each with its own
private `count` — calling `counterA()` twice has zero effect on
`counterB`'s count. This is the same mechanism as the `att` example
above, just with a number instead of a chip object, and it's the standard
way JS gets "private state" without classes.

</details>

---

## Appendix — `document` & the DOM API (Module 3 material, covered early)

**What `document` is.** A global variable the browser creates
automatically — not written, imported, or installed. The instant a
webpage loads, the browser parses the HTML into a tree of objects in
memory, and `document` is the entry point to that tree, representing the
whole page. Technically `window.document` — everything the browser
exposes hangs off a master `window` object, and `document.` is allowed to
drop the prefix as the default scope.

```js
console.log(document);          // the whole page, as a tree of objects
console.log(document.title);    // the page's <title> text
console.log(typeof document);   // "object"
```

Browser-only: plain Node.js has no `document` at all — no webpage to
represent.

**What `querySelector` is.** A **method** on `document` (and on any
individual element) that takes one argument — a string in **CSS selector
syntax**, the same syntax used in stylesheets — and returns the first
matching element, or `null` if nothing matches.

```js
document.querySelector("button");
document.querySelector(".shiny-chat-input");
document.querySelector("#nova_model");
document.querySelector("shiny-chat-container textarea");
```

Its sibling `querySelectorAll` returns every match instead of just the
first, as a list-like `NodeList` you can loop over.

Origin: standardized around 2008, universal by ~2012, replacing a
scattered set of older single-purpose methods (`getElementById`,
`getElementsByClassName`, `getElementsByTagName`) with one method that
accepts any CSS selector, including combinations
(`"div.card > button.primary"`). You'll still see the old methods in
older code.

**Method vs. standalone function.** `document.querySelector(...)` is a
*method call* — a function belonging to a specific object, invoked
`object.method(args)`. Compare to a standalone function like this
lesson's `novaTextarea()`, called with no owning object. A method is just
a regular function value stored as a property on an object; the dot
reaches that property. R's closest parallel: calling a method on an
R6/S4 object with `obj$method()`.

**Not a module — a browser-native API.** No `import` anywhere. Contrast
with Python, where `os`, `json`, `re` need `import` first — in the
browser, the browser itself is the runtime and hands you a
fully-populated `window`/`document` on page load, no import statement.
Node sits in between: it has importable built-ins (`import fs from
'fs'`), because it isn't a browser and has no page to represent.

**"Show me everything available" — the `dir()` equivalent:**

1. **DevTools autocomplete** — open any page, DevTools (F12) → Console,
   type `document.` and a dropdown lists every property/method. What
   working JS developers actually use day to day.
2. **`Object.getOwnPropertyNames(Document.prototype)`** — programmatic
   listing, closer to Python's `dir()`.
3. **Your editor, via TypeScript.** TypeScript ships `lib.dom.d.ts`,
   describing every DOM method with full type signatures. VS
   Code/Positron reads it automatically in `.ts`/`.tsx` files — type
   `document.` in the Next.js project and get the same autocomplete,
   plus hover-for-description, no browser tab needed. Already live in
   the project you scaffolded.

**Where to look things up.** MDN — developer.mozilla.org — is the
canonical reference:

- `developer.mozilla.org/en-US/docs/Web/API/Document` — the entire
  `Document` interface, every method/property, one page.
- `developer.mozilla.org/en-US/docs/Web/API/Document/querySelector` —
  the specific method page.

Every Web API (DOM, `fetch`, `localStorage`, `MutationObserver` — Module
4 material) has an equivalent MDN page under "Web/API/". A method-name
search on MDN beats guessing most of the time.

One more distinction: `querySelector`'s *argument* — the selector
string — follows a separate, older standard, **CSS Selector syntax**,
which is why the same string works identically in a stylesheet or handed
to this method.

---

**Status:** complete, including a Module 3 (DOM) preview. Next: Lesson 4
(Objects & Destructuring) — see `js-syllabus.md`.
