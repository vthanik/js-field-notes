# Lesson 2 — `undefined`/`null` and Truthy/Falsy

*Module 1, Syllabus Lesson 2. Covers: the basic value types, two flavors of
"nothing," optional chaining (`?.`), truthy/falsy conversion, and reading a
real auth guard clause.*

---

## The basic value types

JS has exactly 7 **primitive** types, plus one catch-all non-primitive
type. `typeof` tells you which one you're holding:

```js
typeof "hello"        // "string"
typeof 42              // "number"
typeof true             // "boolean"
typeof undefined        // "undefined"
typeof null             // "object" — a 25-year-old bug in the language; null is NOT actually an object
typeof 10n                // "bigint"
typeof Symbol()            // "symbol"
typeof {}                   // "object"
typeof []                    // "object" — arrays are objects too
typeof function(){}           // "function" — technically a callable object
```

R comparison: R's `typeof()`/`class()` gives you `"double"`, `"character"`,
`"logical"`, etc. JS's system is smaller — no separate int/double like R,
and no built-in vector type (arrays fill that role, but they're objects,
not primitives).

The 7 primitives:

- **string** — text: `"hello"`, `'hello'`, or `` `hello` `` (template
  literal, Lesson 6)
- **number** — every ordinary number: `42`, `3.14`, `-7` — one type, no
  separate int/float/double
- **boolean** — `true`/`false`
- **undefined** — absence (below)
- **null** — deliberate emptiness (below)
- **bigint** — arbitrary-precision integers, for values past
  `Number.MAX_SAFE_INTEGER` (2^53 − 1, ≈ 9 quadrillion). The `n` suffix
  marks a literal as this type instead of an ordinary `number`:

  ```js
  const big = 9007199254740993n;  // the n makes this a BigInt
  typeof big;                      // "bigint"
  typeof 9007199254740993;         // "number" — same digits, no n, and this one loses precision
  ```

  You'll rarely write one by hand — it exists for things like
  cryptography or IDs past the safe integer limit. It surfaces here only
  because `0n` is its own falsy value, distinct from plain `0`.
- **symbol** — a rarely-used unique-identifier type, mostly for advanced
  object-property tricks. Skip it for now — the book marks it "advanced"
  too.

Everything that isn't one of those 7 is an **object** — plain objects
`{}`, arrays `[]`, functions, dates, and so on. That's the reference-type
category from Lesson 1 — copied by pointer, not by value.

---

## Two different flavors of "nothing"

`undefined` is JS's default absence — what you get when a variable is
declared but never assigned, when a function has no `return`, or when you
access an object property that doesn't exist:

```js
let x;
console.log(x); // undefined — declared, never assigned

const obj = { name: "Alice" };
console.log(obj.age); // undefined — no such property; JS doesn't throw, just says "not there"
```

`null` is different: a value someone deliberately assigned to mean "empty
on purpose." JS never hands you `null` unprompted — a human or a library
wrote `= null` somewhere.

```js
let session = null; // "I checked. There is no session." — intentional, not accidental
```

R comparison: `null` is roughly R's `NULL`. `undefined` has no clean R
equivalent — closest is an unassigned name that doesn't exist yet. Don't
reach for R's `NA` here — `NA` is about missing *data* in a vector; this is
about missing *variables and properties*, a different problem.

---

## `?.` — optional chaining

Without it, reaching into a possibly-missing object throws and kills the
program:

```js
const session = null;
console.log(session.user); // TypeError: Cannot read properties of null
```

`?.` checks first: if the thing on the left is `null` or `undefined`, stop
and return `undefined` instead of crashing.

```js
console.log(session?.user); // undefined — no crash, just "nothing here"
```

---

## Truthy/falsy — where JS differs from Python, and it will bite you

JS lets you use *any* value in an `if` condition, not just booleans, and
converts it internally. Exactly eight values count as `false`: `false`,
`0`, `-0`, `0n`, `""` (empty string), `null`, `undefined`, `NaN`.
Everything else is truthy — **including `[]` and `{}`**. An empty array
and an empty object are both truthy in JS. In Python, `if []:` is `False`.
In JS, `if ([]) { ... }` runs. Trips people constantly.

```js
if ([]) console.log("runs");   // yes, this logs
if ({}) console.log("runs");   // yes, this logs too
if (0) console.log("nope");    // never logs
if ("") console.log("nope");   // never logs
```

---

## Reading a real guard clause

```ts
if (!session?.user) {
  throw new Error('Unauthorized')
}
```

Read right to left. `session?.user` — safely get `user`, or `undefined` if
`session` itself is `null`. `!` flips it: `!undefined` is `true`,
`!someRealObject` is `false` (a non-empty object is truthy). So the whole
condition reads: "if there's no session, OR the session has no user,
throw." One line covers both failure cases — session missing entirely, or
present but empty — because of how `?.` and `!` chain together.

---

**Check yourself:**

```js
const post = { title: "", views: 0 };
if (!post.title) {
  console.log("no title");
}
if (!post.views) {
  console.log("no views");
}
```

Which `console.log` lines run?

<details>
<summary>Answer</summary>

**Both run.** `""` is falsy and `0` is falsy, so a post with a real
(empty) title and a post with a real (zero) view count both get treated
identically to a post that doesn't exist at all. That's the exact
hazard — `!post.title` can't tell "deliberately blank" from "missing," and
neither can `!post.views` tell "zero views" from "no data at all."

</details>

---

**Status:** complete. Next: Lesson 4 (Objects & Destructuring) — see
`js-syllabus.md`. (Lesson 3, Functions, was also completed in chat; ask
if you want that one written up too.)
