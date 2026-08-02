# Lesson 1 — Variables & Values

*Module 1, Syllabus Lesson 1. Covers: `const`/`let`, block scope, primitive
vs. reference values, `const` with objects, and a preview of `async`/`await`
that came up early from real code.*

---

## `const`, `let`, and why `var` is dead

Three ways to declare a variable in JS. `var` is the 1995 original —
function-scoped, causes bugs, you will never write it. `let` and `const`
are block-scoped: they only exist inside the `{ }` they were declared in,
same mental model as R's `{ }` blocks in `if`/`for`, except JS enforces it
strictly rather than leaking.

```js
const title = "Draft post";   // cannot be reassigned
let count = 0;                 // can be reassigned
count = count + 1;             // fine
title = "New title";           // TypeError: Assignment to constant variable
```

Default to `const`. Only reach for `let` when the variable will genuinely
change — a loop counter, an accumulator.

Real example, from a Next.js Server Action:

```ts
const session = await auth()
const title = formData.get('title')
```

Both are `const` because neither is ever reassigned after that line — each
is read once and used. That's convention, not coincidence.

---

## Primitive vs. reference values — the part that causes real bugs

This is the concept most likely to trip you coming from R, because R
copies almost everything by value. JS does not.

**Primitives** (`string`, `number`, `boolean`, `undefined`, `null`) are
copied by value:

```js
let a = 5;
let b = a;   // b gets a COPY of 5
b = 10;
console.log(a); // still 5 — a and b are independent
```

**Objects and arrays** are copied by reference — the variable holds a
pointer to shared data, not the data itself:

```js
let obj1 = { name: "draft" };
let obj2 = obj1;         // obj2 points to the SAME object as obj1
obj2.name = "published";
console.log(obj1.name);  // "published" — obj1 changed too, same object
```

This is exactly why React's rule is "never mutate state directly, always
create a new object." If you did `state.name = "x"` instead of
`setState({...state, name: "x"})`, React can't tell anything changed — same
reference, same memory address — so it won't re-render. Not an arbitrary
rule: a direct consequence of how JS stores objects.

---

## `const` does not freeze the object

`const` locks the *variable binding*, not the *contents*:

```js
const user = { name: "Alice" };
user.name = "Bob";        // fine — not reassigning `user`, just mutating what it points to
user = { name: "Carol" }; // TypeError — this reassigns the binding, which const forbids
```

---

## Array mutation — "same box, two labels"

```js
const arr1 = [1, 2, 3];
const arr2 = arr1;      // arr2 is NOT a new array — same array, two labels
arr2.push(4);            // .push() mutates in place — doesn't create a new array
console.log(arr1);       // [1, 2, 3, 4]  ← same box, so both labels see the change
```

`const arr1 = [1,2,3]` doesn't create a variable that *contains* `[1,2,3]`.
It creates a variable that *points to* a memory location holding `[1,2,3]`.
`arr2 = arr1` copies the pointer, not the array — there's only ever one
array. `.push()`, `.pop()`, `.sort()`, `.splice()` are **mutating
methods** — they change the shared box. This is why React's convention is
always "make a new array, don't push the old one" — usually
`[...arr1, 4]` instead of `arr1.push(4)`.

**Check yourself:** predict `arr1` after this runs, *before* running it.

```js
const arr1 = [1, 2, 3];
const arr2 = arr1;
arr2.push(4);
console.log(arr1);
```

<details>
<summary>Answer</summary>

`[1, 2, 3, 4]` — not `[1, 2, 3]`. `arr2` is the same array as `arr1`, not a
copy, so mutating one mutates both. (The R instinct — that assignment
copies — is exactly the trap this exercise is built to catch.)

</details>

---

## Appendix — `async`/`await` preview (full lesson later, Module 2)

This came up from real code before its scheduled slot, so a working
version now:

`auth()` has to check whether you're logged in — usually a cookie or
database read, neither instant. JS doesn't freeze the program while
waiting; instead it hands back a **Promise**: "I don't have your answer
yet, but I will."

```js
function getSession() {
  return fetch("/api/session"); // returns a Promise immediately, before the call finishes
}

const result = getSession();
console.log(result); // Promise { <pending> } — NOT the data, just a placeholder
```

`await` means "pause this function right here until the Promise settles,
then hand me the real value":

```js
const session = await auth();
console.log(session); // the actual session object — { user: {...} } or null
```

`await` only works inside a function marked `async` — that's what legalizes
the pause. That's why `createPost` is `async function createPost(...)`, not
just `function createPost(...)`. Not every line in an async function needs
`await`, though — `formData.get('title')` right below it is synchronous,
already in memory, nothing to wait for. Knowing which lines need it and
which don't is the real content of the full Promises lesson.

---

**Status:** complete. Next: Lesson 2 (`undefined`/`null`, truthy/falsy) or
Lesson 4 (Objects & Destructuring) — see `js-syllabus.md`.
