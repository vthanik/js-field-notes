// ---- shinychat coupling surface ----------------------------------------
// Every selector nova borrows from shinychat's private DOM, in ONE place.
// nova reaches into that DOM by necessity -- it reclassifies the message
// stream and re-parents the composer's buttons -- and shinychat renames
// have broken it silently twice. When bumping the shinychat version pin
// in DESCRIPTION, this table and the SHINYCHAT OVERRIDES section of
// nova.css are the two things to re-verify.
const NOVA_SEL = {
  container: "shiny-chat-container",
  input: ".shiny-chat-input",
  textarea: "shiny-chat-container textarea",
  send: ".shiny-chat-btn-send",
  cancel: "shiny-chat-container .shiny-chat-btn-cancel",
  // The send button wears this exactly while a turn is submitted and no
  // stream is open yet -- shinychat's own word for the dead window.
  pending: "shiny-chat-container .shiny-chat-btn-spinner",
  messages: ".shiny-chat-messages-content",
  message: ".shiny-chat-messages-content > .shiny-chat-message",
  messageContent: ".shiny-chat-message-content",
  darkToggle: "bslib-input-dark-mode",
  // Content that makes an otherwise-empty message worth showing.
  realContent: ".nova-card, pre, img, details"
};

// The composer textarea and shinychat's cancel button are looked up from
// several unrelated places; one accessor each keeps the selector single-
// sourced and the null-handling uniform.
function novaTextarea() {
  return document.querySelector(NOVA_SEL.textarea);
}

function novaCancelBtn() {
  return document.querySelector(NOVA_SEL.cancel);
}

function novaPendingBtn() {
  return document.querySelector(NOVA_SEL.pending);
}

// A message node with no text and none of the elements that carry
// meaning on their own renders as a stray avatar with a gap.
function novaIsBlankContent(content) {
  return (
    !!content &&
    content.textContent.trim() === "" &&
    !content.querySelector(NOVA_SEL.realContent)
  );
}

// localStorage throws outright in a partitioned or storage-blocked
// iframe. That exception, raised inside the MutationObserver callback,
// would abort every later init step -- the exact failure mode already
// seen once with an unguarded custom-message handler.
function novaStore(fn, fallback) {
  try {
    return fn(window.localStorage);
  } catch (e) {
    return fallback;
  }
}

// The theme and the composer prefs (model / effort / mode, below in
// initComposerMenus) are client-side choices with no server-side store,
// so every relaunch silently reset them to the defaults while the last
// conversation was restored around them. novaStore is the store. The
// theme is re-applied here, at script eval, because bslib's toggle
// adopts whatever documentElement already carries when it connects --
// applied any later, a dark session flashes light on every launch.
const NOVA_THEME_ATTR = "data-bs-theme";
{
  const savedTheme = novaStore((s) => s.getItem("nova-pref-theme"), null);
  if (savedTheme === "light" || savedTheme === "dark") {
    document.documentElement.setAttribute(NOVA_THEME_ATTR, savedTheme);
  }
  // bslib exposes no toggle event; the attribute it reflects onto
  // documentElement is the one surface every theme change crosses.
  new MutationObserver(() => {
    const mode = document.documentElement.getAttribute(NOVA_THEME_ATTR);
    if (mode === "light" || mode === "dark") {
      novaStore((s) => s.setItem("nova-pref-theme", mode));
    }
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: [NOVA_THEME_ATTR]
  });
}

// Handle gate approval buttons: read data attributes and dispatch Shiny event.
// Also disable all buttons in the card after one is clicked to prevent
// double-submit, and flip the card's own status pill to approved/denied in
// place -- the tool result lands in a SEPARATE card appended below, so
// nothing else ever updates this card's pill once its buttons are disabled.
document.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".nova-card-actions button");
  if (!btn) return;

  // "Other (write your answer)" swaps to an inline input (listener
  // below); it must not disable the sibling options -- the user can
  // still pick one until an answer is actually submitted.
  if (btn.classList.contains("nova-q-other")) return;

  // Disable all buttons in this card to prevent double-submit
  btn.closest(".nova-card-actions")
    .querySelectorAll("button")
    .forEach((b) => (b.disabled = true));

  // Dispatch Shiny event based on button type
  if (btn.classList.contains("nova-gate-btn")) {
    const approved = btn.dataset.approved === "true";

    // Update this card's status pill in place (see file header comment).
    const card = btn.closest(".nova-card");
    const pill = card ? card.querySelector(".nova-pill") : null;
    if (pill) {
      pill.textContent = approved ? "approved" : "denied";
      pill.classList.remove("text-bg-warning");
      pill.classList.add(approved ? "text-bg-success" : "text-bg-danger");
    }

    Shiny.setInputValue("nova_gate", {
      id: btn.dataset.id,
      tool: btn.dataset.tool,
      approved: approved,
      always: btn.dataset.always === "true"
    }, { priority: "event" });
  } else if (btn.classList.contains("nova-answer-btn")) {
    Shiny.setInputValue("nova_answer", {
      id: btn.dataset.id,
      choice: btn.dataset.choice
    }, { priority: "event" });
  }
});

// Reveal a pane's scrollbar only while it is being scrolled. An
// always-drawn grey bar down the side of every command and every file
// view is chrome competing with the content it sits beside.
//
// The capture phase is the whole mechanism: scroll does NOT bubble, so a
// document-level listener in the default bubble phase never fires for an
// inner pane. The timer is per-element, so two panes scrolled in quick
// succession do not cancel each other's fade.
const novaScrollTimers = new WeakMap();
document.addEventListener(
  "scroll",
  (ev) => {
    const el = ev.target;
    if (!el || !el.classList || !el.matches) return;
    if (!el.matches(".nova-card-body, .nova-card pre, .nova-diff, .nova-read")) {
      return;
    }
    el.classList.add("nova-scrolling");
    clearTimeout(novaScrollTimers.get(el));
    novaScrollTimers.set(
      el,
      setTimeout(() => el.classList.remove("nova-scrolling"), 700)
    );
  },
  true
);

// "Other (write your answer)" on a question card: swap the row for an
// inline text input; Enter submits the typed text as the answer
// (same nova_answer dispatch as a picked option), Escape restores the
// row. Built with createElement/textContent -- never markup strings.
document.addEventListener("click", (ev) => {
  const other = ev.target.closest(".nova-q-other");
  if (!other || other.disabled) return;
  const card = other.closest(".nova-card");
  if (!card || card.querySelector(".nova-q-input")) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "nova-q-input";
  input.placeholder = "Type your answer, Enter to send";
  other.style.display = "none";
  other.insertAdjacentElement("afterend", input);
  input.focus();
  input.addEventListener("keydown", (kev) => {
    // the input owns its keys: Enter must not send the composer,
    // Escape must not deny a gate card
    kev.stopPropagation();
    if (kev.key === "Escape") {
      input.remove();
      other.style.display = "";
      return;
    }
    if (kev.key !== "Enter") return;
    const answer = input.value.trim();
    if (answer === "") return;
    card
      .querySelectorAll(".nova-card-actions button")
      .forEach((b) => (b.disabled = true));
    input.disabled = true;
    Shiny.setInputValue("nova_answer", {
      id: other.dataset.id,
      choice: answer
    }, { priority: "event" });
  });
});

// Keyboard shortcuts on gated approval cards: Cmd/Ctrl+Enter approves,
// Esc denies. Scoped to the most recently appended gated card that still
// has enabled buttons, so a resolved (stale) card earlier in the thread
// can never fire from a keystroke aimed at the current one.
// Keystrokes aimed at a text-entry context (shinychat's composer, the
// model <select>) must not reach the transcript: without this, Cmd/Ctrl+
// Enter typed while composing -- RStudio's "Run current line" muscle
// memory -- would silently approve the newest gated card. The inline
// answer and rename inputs stopPropagation() before this runs, so they
// keep their own Enter/Escape.
function novaInTextEntry(ev) {
  return !!ev.target.closest('input, textarea, [contenteditable="true"]');
}

// The button an approve/deny shortcut should click, or null when the
// newest card has no enabled buttons left (a resolved card earlier in
// the thread must never fire from a keystroke aimed at the current one).
function novaGateTarget(kind) {
  const cards = document.querySelectorAll(".nova-card-actions");
  const current = cards.length ? cards[cards.length - 1] : null;
  if (!current || current.querySelectorAll("button:not(:disabled)").length === 0) {
    return null;
  }
  return current.querySelector(
    kind === "approve"
      ? 'button[data-approved="true"][data-always="false"]'
      : 'button[data-approved="false"]'
  );
}

// ONE owner for Escape, with an explicit priority chain, so a single
// keypress does exactly one thing. This was previously three separate
// document listeners cooperating through mutable globals, and the order
// they happened to register in was load-bearing: the composer-menu
// closer ran first and nulled novaOpenMenuEl, so the drawer handler's
// guard on that same flag saw nothing and closed the drawer too. With a
// menu open inside an overlay drawer, one Escape closed both.
//
// Overlays close from anywhere, including mid-compose. Everything below
// them belongs to the transcript, so it defers to text entry.
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") {
    if (novaOpenMenuEl) {
      ev.preventDefault();
      novaCloseMenu();
      return;
    }
    if (novaHistMenuEl) {
      ev.preventDefault();
      novaCloseHistMenu();
      return;
    }
    if (novaDrawerAutoHides()) {
      ev.preventDefault();
      novaSetDrawer(false);
      return;
    }
    const deny = novaGateTarget("deny");
    if (deny) {
      // Only the deny shortcut defers to text entry: Escape typed while
      // composing must not answer the card sitting behind the composer.
      if (novaInTextEntry(ev)) return;
      ev.preventDefault();
      deny.click();
      return;
    }
    // No actionable approval card: Escape stops a streaming response --
    // from the composer too. Focus sits in the textarea for most of a
    // turn (the user just typed there), so requiring focus elsewhere made
    // Esc look like it did nothing. The @ menu and the inline answer /
    // rename inputs stopPropagation() before this runs, so their own
    // Escape still wins.
    if (novaShell && novaShell.classList.contains("nova-streaming")) {
      ev.preventDefault();
      novaStopStreaming();
    }
    return;
  }
  if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
    if (novaInTextEntry(ev)) return;
    const approve = novaGateTarget("approve");
    if (approve) {
      ev.preventDefault();
      approve.click();
    }
  }
});

// Composer shell: nova.js wraps shinychat's <shiny-chat-input> in a
// rounded pill -- attachment chips (row 0), the textarea (row 1,
// shinychat's own element adopted into the pill), a control row
// with the + attach button (row 2) -- with the mode strip attached
// beneath. Attachments flow to the server as input$nova_attachments
// (array of {name, type, data}, base64 via FileReader); the server
// clears the chips with the "nova_attachments_clear" custom message
// once a turn consumes them. All DOM is built with
// createElement/textContent -- never markup strings.
const novaAttachments = [];
// Monotonic per-page counter naming nameless pasted images; see
// novaAddFiles.
let novaPasteCounter = 0;
let novaShell = null;
let novaRow = null;
let novaChipBar = null;
let novaFileInput = null;
let novaClearHandlerBound = false;

function novaSendAttachments() {
  Shiny.setInputValue(
    "nova_attachments",
    novaAttachments.map((a) => ({ name: a.name, type: a.type, data: a.data })),
    { priority: "event" }
  );
}

// Short badge label for a chip, by extension then MIME type. Kept in
// sync with .attachment_kind() in R/attachments.R -- the composer chip
// and the transcript's replayed chip must wear the same badge.
function novaFileKind(name, type) {
  const ext = String(name || "")
    .toLowerCase()
    .split(".")
    .pop();
  if (
    String(type || "").indexOf("image/") === 0 ||
    ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)
  ) {
    return "IMG";
  }
  const known = {
    pdf: "PDF",
    docx: "DOC",
    doc: "DOC",
    xlsx: "XLS",
    xls: "XLS",
    csv: "CSV",
    tsv: "CSV",
    md: "MD",
    qmd: "MD",
    rmd: "MD",
    r: "R",
    py: "PY",
    js: "JS",
    ts: "TS",
    sql: "SQL",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    txt: "TXT",
    log: "TXT",
    sh: "SH"
  };
  if (known[ext]) return known[ext];
  if (String(type || "").indexOf("text/") === 0) return "TXT";
  if (ext && ext !== String(name || "").toLowerCase()) {
    return ext.slice(0, 4).toUpperCase();
  }
  return "FILE";
}

function novaRenderChips() {
  if (!novaChipBar) return;
  novaChipBar.querySelectorAll(".nova-chip").forEach((c) => c.remove());
  novaAttachments.forEach((att) => {
    const chip = document.createElement("span");
    chip.className = "nova-chip";
    // Images wear their own pixels; everything else wears a colored
    // kind badge (the Antigravity/Claude chip treatment).
    const kind = novaFileKind(att.name, att.type);
    if (kind === "IMG" && att.data) {
      const thumb = document.createElement("img");
      thumb.className = "nova-chip-thumb";
      thumb.alt = "";
      thumb.src =
        "data:" + (att.type || "image/png") + ";base64," + att.data;
      chip.appendChild(thumb);
    } else {
      const badge = document.createElement("span");
      badge.className = "nova-chip-badge nova-chip-badge-" + kind.toLowerCase();
      badge.textContent = kind;
      chip.appendChild(badge);
    }
    const label = document.createElement("span");
    label.className = "nova-chip-name";
    label.textContent = att.name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "nova-chip-remove";
    remove.setAttribute("aria-label", "Remove Attachment " + att.name);
    remove.textContent = "×";
    // Closure over `att`, not an index attribute: indices shift as chips
    // are removed, and reading attributes back off the DOM is exactly
    // the drift the data-*/dataset contract test polices for cards.
    remove.addEventListener("click", () => {
      const i = novaAttachments.indexOf(att);
      if (i >= 0) novaAttachments.splice(i, 1);
      novaRenderChips();
      novaSendAttachments();
    });
    chip.appendChild(label);
    chip.appendChild(remove);
    novaChipBar.appendChild(chip);
  });
}

function novaAddFiles(files) {
  Array.from(files || []).forEach((file) => {
    // Everything ships as {name, type, data}; the SERVER dispatches
    // (image route / text inline / docx / pdf conversion) and answers
    // unreadable files with an honest note -- so the only client-side
    // refusal is the size cap (a 20 MB PDF ceiling).
    if (file.size > 20 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      // data:<mime>;base64,<payload> -> keep only the payload
      const data = String(reader.result).split(",")[1] || "";
      novaAttachments.push({
        // A pasted screenshot arrives nameless; every one used to get
        // the same default name -- so the second paste
        // OVERWROTE the first in the server's attachment store. A
        // counter plus the MIME extension keeps each one distinct.
        name:
          file.name ||
          "pasted-image-" +
            ++novaPasteCounter +
            "." +
            ((file.type || "image/png").split("/")[1] || "png"),
        type: file.type,
        data: data
      });
      novaRenderChips();
      novaSendAttachments();
    });
    reader.readAsDataURL(file);
  });
}

// ---- Queued messages ---------------------------------------------------
// Typed while a turn streams, a message queues instead of sending: it
// waits in a panel above the composer pill and the server delivers the
// whole queue as ONE user turn when the stream settles. The client owns
// the queue until then -- every change ships the full array to
// input$nova_queue; the server only reads it at settle and answers with
// "nova_queue_clear". All DOM via createElement/textContent.
const novaQueue = [];
let novaQueueCounter = 0;
let novaQueuePanel = null;
let novaQueueCollapsed = false;

function novaSyncQueue() {
  novaRenderQueue();
  if (!window.Shiny || !Shiny.setInputValue) return;
  Shiny.setInputValue("nova_queue", novaQueue.map((q) => ({
    id: q.id,
    text: q.text
  })), { priority: "event" });
}

function novaQueueMessage(text) {
  novaQueue.push({ id: "q" + ++novaQueueCounter, text: text });
  novaSyncQueue();
}

function novaRenderQueue() {
  if (!novaQueuePanel) return;
  novaQueuePanel.textContent = "";
  novaQueuePanel.classList.toggle("nova-queue-empty", novaQueue.length === 0);
  if (novaQueue.length === 0) return;
  const head = document.createElement("div");
  head.className = "nova-queue-head";
  const title = document.createElement("span");
  title.className = "nova-queue-title";
  title.textContent = "Queued Messages";
  const count = document.createElement("span");
  count.className = "nova-queue-count";
  count.textContent = String(novaQueue.length);
  const hint = document.createElement("span");
  hint.className = "nova-queue-hint";
  hint.textContent = "Sends after the agent finishes";
  head.appendChild(title);
  head.appendChild(count);
  head.appendChild(hint);
  // Collapse to just the header; the choice survives re-renders (each
  // queue change rebuilds the panel).
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "nova-queue-toggle";
  toggle.setAttribute(
    "aria-label",
    novaQueueCollapsed ? "Expand Queued Messages" : "Collapse Queued Messages"
  );
  const chev = document.createElement("span");
  chev.className = "nova-queue-toggle-icon";
  toggle.appendChild(chev);
  toggle.addEventListener("click", () => {
    novaQueueCollapsed = !novaQueueCollapsed;
    novaRenderQueue();
  });
  head.appendChild(toggle);
  novaQueuePanel.appendChild(head);
  novaQueuePanel.classList.toggle("nova-queue-collapsed", novaQueueCollapsed);
  if (novaQueueCollapsed) return;
  novaQueue.forEach((q) => {
    const row = document.createElement("div");
    row.className = "nova-queue-row";
    const text = document.createElement("span");
    text.className = "nova-queue-text";
    text.textContent = q.text;
    row.appendChild(text);
    const act = (cls, label, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nova-queue-act " + cls;
      b.setAttribute("aria-label", label);
      novaSetTip(b, label);
      const icon = document.createElement("span");
      icon.className = cls + "-icon";
      b.appendChild(icon);
      b.addEventListener("click", fn);
      row.appendChild(b);
    };
    // Send now = stop the running turn; the settle path then delivers
    // the queue. No separate delivery mechanism exists to drift.
    act("nova-queue-send", "Send Now", () =>
      novaStopStreaming()
    );
    act("nova-queue-edit", "Edit", () => {
      const i = novaQueue.indexOf(q);
      if (i >= 0) novaQueue.splice(i, 1);
      novaSyncQueue();
      const ta = novaTextarea();
      if (ta) {
        ta.value = ta.value ? ta.value + "\n" + q.text : q.text;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.focus();
      }
    });
    act("nova-queue-delete", "Remove", () => {
      const i = novaQueue.indexOf(q);
      if (i >= 0) novaQueue.splice(i, 1);
      novaSyncQueue();
    });
    novaQueuePanel.appendChild(row);
  });
}

// True while a send should queue rather than go to the model.
function novaQueueIntercept(ta) {
  if (!novaShell || !novaShell.classList.contains("nova-streaming")) {
    return false;
  }
  const text = ta.value.trim();
  if (text === "") return false;
  novaQueueMessage(text);
  ta.value = "";
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function novaBindClearHandler() {
  if (novaClearHandlerBound || !window.Shiny || !Shiny.addCustomMessageHandler) {
    return;
  }
  novaClearHandlerBound = true;
  // The handler MUST take one argument: Shiny validates handler.length
  // and throws otherwise -- and that exception, raised inside the
  // MutationObserver callback, aborted every later init step (found
  // live; the structural tests cannot see arity).
  Shiny.addCustomMessageHandler("nova_attachments_clear", (msg) => {
    novaAttachments.length = 0;
    novaRenderChips();
    novaSendAttachments();
  });
  // Sent when a stop leaves approval cards open. Their buttons are
  // disabled and the pill says what actually happened: the gate entry is
  // gone server-side, so those buttons cannot resolve anything, but the
  // pill is flipped optimistically on click and nothing corrects it
  // afterwards -- clicking Allow on a dead card painted a green APPROVED
  // badge over a tool call that never ran.
  Shiny.addCustomMessageHandler("nova_gate_stopped", (msg) => {
    const ids = (msg && msg.ids) || [];
    if (!ids.length) return;
    // Compared against dataset values, never interpolated into a
    // selector -- an id nova hands the DOM is data, not markup.
    document.querySelectorAll(".nova-gate-btn").forEach((btn) => {
      if (ids.indexOf(btn.dataset.id) === -1) return;
      const actions = btn.closest(".nova-card-actions");
      if (actions) {
        actions.querySelectorAll("button").forEach((b) => (b.disabled = true));
      }
      const card = btn.closest(".nova-card");
      const pill = card ? card.querySelector(".nova-pill") : null;
      if (pill) {
        pill.textContent = "stopped";
        pill.classList.remove("text-bg-warning");
        pill.classList.add("text-bg-secondary");
      }
    });
  });
  // Sent when the server delivers the queue (or resets/restores the
  // conversation): the panel empties and the input syncs so a stale
  // value cannot deliver twice.
  Shiny.addCustomMessageHandler("nova_queue_clear", (msg) => {
    // A delivery names the ids it took. This is a round trip, so a
    // message queued while it was in flight is still waiting when it
    // lands -- emptying the whole array ate that message silently, with
    // the panel going blank and nothing ever sent. A clear with no ids
    // (new conversation, restore) still empties everything.
    const ids = msg && msg.ids;
    if (ids && ids.length) {
      for (let i = novaQueue.length - 1; i >= 0; i--) {
        if (ids.indexOf(novaQueue[i].id) !== -1) novaQueue.splice(i, 1);
      }
    } else {
      novaQueue.length = 0;
    }
    novaSyncQueue();
  });
  // Restoring a conversation restores the composer settings it was
  // saved under. Server-pushed (the payload carries them) because
  // browser-local storage is partitioned or blocked in some
  // RStudio/Domino embeddings and cannot be the only store. Each
  // select change is
  // dispatched for real, so the server's model/effort/mode observers
  // fire exactly as if the user had picked the value.
  // Boot handshake: the server sends this once the launch-resume
  // replay (if any) has been fully written to the websocket, so the
  // loading state ends exactly when the conversation is ready --
  // never before (hero flash) and never on a timer's guess.
  Shiny.addCustomMessageHandler("nova_boot_done", (msg) => {
    const main = document.querySelector(".nova-main");
    if (main) main.classList.remove("nova-booting");
    novaSyncEmptyState();
  });
  Shiny.addCustomMessageHandler("nova_prefs", (msg) => {
    [
      ["nova_model", msg && msg.model],
      ["nova_effort", msg && msg.effort],
      ["nova_mode", msg && msg.mode]
    ].forEach(([id, val]) => {
      const sel = document.getElementById(id);
      if (!sel || !val || sel.value === val) return;
      if (!Array.from(sel.options).some((o) => o.value === val)) return;
      sel.value = val;
      sel.dispatchEvent(new Event("change"));
    });
  });
  // Context-usage ring: the server reports {pct, tokens} after every
  // settled turn (and 0 on /clear or a new conversation).
  Shiny.addCustomMessageHandler("nova_context", (msg) => {
    const ring = document.querySelector(".nova-context-ring");
    if (!ring) return;
    const pct = Math.max(0, Math.min(100, Number(msg.pct) || 0));
    ring.style.setProperty("--nova-ctx", pct + "%");
    ring.classList.toggle("nova-context-warn", pct >= 80);
    novaSetTip(ring, pct + "% of Context Window Used");
  });
  // File index for the composer's @ typeahead (requested on menu open).
  Shiny.addCustomMessageHandler("nova_file_index", (msg) => {
    novaFileIndex = (msg.files || []).map(String);
    novaAtRender();
  });
  // Live bash output: whole-line chunks stream into a pre inside the
  // running request card while the command executes; the result card
  // replaces it on arrival (novaSyncRunningPills removes the pre).
  // All DOM via createElement/textContent -- chunk text is untrusted.
  Shiny.addCustomMessageHandler("nova_bash_stream", (msg) => {
    if (!msg || !msg.id) return;
    const card = document.querySelector(
      '.nova-card[data-request="' +
        CSS.escape(String(msg.id)) +
        '"]:not(.nova-card-result)'
    );
    if (!card) return;
    const body = card.querySelector(".nova-card-body");
    if (!body) return;
    let live = body.querySelector(".nova-bash-live");
    if (!live) {
      live = document.createElement("pre");
      live.className = "nova-bash-live";
      body.appendChild(live);
    }
    live.appendChild(document.createTextNode(String(msg.text || "")));
    // pin to the newest line; the pane itself scrolls
    live.scrollTop = live.scrollHeight;
  });
  // A conversation's model-made title lands moments after its first
  // answer. Retitle the ONE row in place: re-rendering the whole list
  // re-reads every conversation off disk and shiny dims the output
  // while it recalculates, so the drawer flashed after every answer.
  // A row not in the DOM yet is fine to skip -- the rename is on disk,
  // and the next structural render shows it.
  // The open conversation's row carries a standing highlight. Moved in
  // place for the same reason titles are: switching conversations must
  // not re-render the list. An id with no row (a fresh unsaved chat)
  // clears the highlight everywhere, which is the correct state.
  Shiny.addCustomMessageHandler("nova_hist_active", (msg) => {
    document.querySelectorAll(".nova-history-active").forEach((el) => {
      el.classList.remove("nova-history-active");
    });
    const row = document.querySelector(
      '.nova-history-row[data-id="' + CSS.escape(String(msg.id)) + '"]'
    );
    if (row) row.classList.add("nova-history-active");
  });
  Shiny.addCustomMessageHandler("nova_hist_title", (msg) => {
    const row = document.querySelector(
      '.nova-history-row[data-id="' + CSS.escape(String(msg.id)) + '"]'
    );
    if (!row) return;
    // setAttribute, not dataset: the dataset scanner is the card-button
    // dispatch contract, and history rows stay out of it.
    row.setAttribute("data-title", String(msg.title));
    const link = row.querySelector(".nova-history-open");
    if (link) link.textContent = String(msg.title);
  });
}

// ---- Composer typeahead (@ files) + command styling --------------------
// `@` at the start of a word lists project files and inserts a mention:
// substring/prefix ranking over a server-supplied index, 15 rows,
// arrows + Enter/Tab select, Esc closes. A recognized /command as the
// whole message styles the input blue.
let novaFileIndex = [];
let novaAtMenuEl = null;
let novaAtActive = 0;
let novaAtToken = null;

const NOVA_TRIGGERS = {
  "@": {
    pattern: /(^|\s)@([A-Za-z0-9_\-./]*)$/,
    // ids stay LITERAL here: test-nova-js.R cross-checks every
    // Shiny.setInputValue id in this file against the server's observers,
    // and a computed id would drop out of that contract check.
    // The prefix scopes the server index to the directory being typed
    // into: the capped global index can drop every file under a deep
    // dir while the dir itself still lists, so the picker showed
    // folders with nothing inside them.
    request: (prefix) =>
      Shiny.setInputValue("nova_file_index_req", {
        t: Date.now(),
        prefix: prefix
      }, {
        priority: "event"
      }),
    index: () => novaFileIndex,
    // bare @: top-level entries only, so the list is not a flat dump.
    // The server index sorts every directory before the first file, so
    // a plain slice showed ONLY folders whenever a project had 15+
    // top-level dirs -- files get guaranteed slots instead.
    empty: (all) => {
      const top = all.filter((p) => !p.replace(/\/$/, "").includes("/"));
      const dirs = top.filter((p) => p.endsWith("/"));
      const files = top.filter((p) => !p.endsWith("/"));
      return dirs
        .slice(0, Math.max(15 - files.length, 7))
        .concat(files)
        .slice(0, 15);
    }
  }
};

function novaAtFindToken(ta) {
  const upto = ta.value.slice(0, ta.selectionStart);
  for (const sigil of Object.keys(NOVA_TRIGGERS)) {
    const m = upto.match(NOVA_TRIGGERS[sigil].pattern);
    if (m) {
      const q = m[m.length - 1];
      return { sigil: sigil, start: upto.length - q.length - 1, query: q };
    }
  }
  return null;
}

function novaAtMatches(query, sigil) {
  const q = query.toLowerCase();
  const trigger = NOVA_TRIGGERS[sigil] || NOVA_TRIGGERS["@"];
  const all = trigger.index();
  if (q === "") {
    return trigger.empty(all);
  }
  const starts = [];
  const contains = [];
  for (const p of all) {
    const lp = p.toLowerCase();
    if (lp.startsWith(q)) starts.push(p);
    else if (lp.includes(q)) contains.push(p);
    if (starts.length >= 15) break;
  }
  return starts.concat(contains).slice(0, 15);
}

function novaAtClose() {
  if (novaAtMenuEl) {
    novaAtMenuEl.remove();
    novaAtMenuEl = null;
  }
  novaAtToken = null;
}

function novaAtPick(value) {
  const ta = novaTextarea();
  if (!ta || !novaAtToken) return;
  const insert = /\s/.test(value) ? '@"' + value + '"' : "@" + value;
  const isDir = value.endsWith("/");
  ta.setRangeText(
    insert + (isDir ? "" : " "),
    novaAtToken.start,
    ta.selectionStart,
    "end"
  );
  ta.focus();
  // input event refreshes autosize, Shiny value, and (for a directory)
  // re-filters the still-open menu to the deeper level
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}

// The index request must fire when a token is DETECTED, not when the
// menu is created: the index starts empty, so an empty index meant no
// matches, no menu, and therefore no request -- the picker could never
// bootstrap. Throttled so typing doesn't spam.
const novaAtLastReq = {};
function novaAtRequestIndex(sigil, prefix) {
  const trigger = NOVA_TRIGGERS[sigil];
  if (!trigger) return;
  // Throttle per prefix: drilling into a deeper directory is a new
  // (scoped) index, so it must refetch immediately, not wait out the
  // previous level's window.
  const key = sigil + "\0" + prefix;
  if (Date.now() - (novaAtLastReq[key] || 0) < 2000) return;
  if (!window.Shiny || !Shiny.setInputValue) return;
  novaAtLastReq[key] = Date.now();
  trigger.request(prefix);
}

function novaAtRender() {
  const ta = novaTextarea();
  if (!ta || !novaShell) return;
  novaAtToken = novaAtFindToken(ta);
  if (!novaAtToken) {
    novaAtClose();
    return;
  }
  const q = novaAtToken.query;
  novaAtRequestIndex(novaAtToken.sigil, q.slice(0, q.lastIndexOf("/") + 1));
  const matches = novaAtMatches(novaAtToken.query, novaAtToken.sigil);
  if (matches.length === 0) {
    novaAtClose();
    return;
  }
  if (!novaAtMenuEl) {
    novaAtMenuEl = document.createElement("div");
    novaAtMenuEl.className = "nova-menu nova-menu-open nova-at-menu";
    // Anchor to the PILL, not the shell: the shell also contains the
    // greeting and Working line, so bottom:100% of the shell floated
    // the list far above the composer in the empty state. On the pill
    // it sits directly above the input.
    const pill = novaShell.querySelector(".nova-composer-pill");
    (pill || novaShell).appendChild(novaAtMenuEl);
  }
  novaAtActive = Math.min(novaAtActive, matches.length - 1);
  novaAtMenuEl.textContent = "";
  matches.forEach((path, i) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "nova-menu-item nova-at-item";
    if (i === novaAtActive) item.classList.add("nova-at-active");
    item.textContent = path;
    // mousedown, not click: click fires after the textarea loses focus
    // and the menu has already closed
    item.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      novaAtActive = i;
      novaAtPick(path);
    });
    novaAtMenuEl.appendChild(item);
  });
}

function novaAtKeydown(ev) {
  if (!novaAtMenuEl) return;
  const items = novaAtMenuEl.querySelectorAll(".nova-at-item");
  if (items.length === 0) return;
  if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
    novaAtActive =
      (novaAtActive + (ev.key === "ArrowDown" ? 1 : items.length - 1)) %
      items.length;
    items.forEach((el, i) =>
      el.classList.toggle("nova-at-active", i === novaAtActive)
    );
  } else if (ev.key === "Enter" || ev.key === "Tab") {
    novaAtPick(items[novaAtActive].textContent);
  } else if (ev.key === "Escape") {
    novaAtClose();
  } else {
    return;
  }
  // the menu owns the key: Enter must not send, Escape must not deny
  ev.preventDefault();
  ev.stopPropagation();
}

function novaSyncCommandStyle(ta) {
  const pill = novaShell && novaShell.querySelector(".nova-composer-pill");
  if (!pill) return;
  // Blue only for a RECOGNIZED command as the whole message.
  const isCmd = /^\/(clear|new|compact)\s*$/.test(ta.value.trim());
  pill.classList.toggle("nova-cmd-active", isCmd);
}

function initComposerShell() {
  if (novaShell) return;
  // shinychat 0.4.0 renders the composer as div.shiny-chat-input INSIDE
  // <shiny-chat-container> -- there is no <shiny-chat-input> element
  // (the tag selector matched nothing and the whole shell silently
  // never built). The shell must ALSO stay inside the
  // container: its keyboard/send handlers are delegated from the
  // container element, so adopting the input out of that subtree leaves
  // typing dead (verified both ways in the browser).
  const container = document.querySelector("shiny-chat-container");
  const input = container && container.querySelector(".shiny-chat-input");
  if (!container || !input) return;

  novaShell = document.createElement("div");
  novaShell.className = "nova-composer";
  // Empty-state greeting (visible only under .nova-empty): the bare
  // "Enter a message..." box read as unfriendly.
  const greeting = document.createElement("div");
  greeting.className = "nova-greeting";
  const greetTitle = document.createElement("div");
  greetTitle.className = "nova-greeting-title";
  greetTitle.textContent = "How can I help you today?";
  const greetSub = document.createElement("div");
  greetSub.className = "nova-greeting-sub";
  greetSub.textContent =
    "Ask about your project, run R or any code, edit files, explore data.";
  greeting.appendChild(greetTitle);
  greeting.appendChild(greetSub);
  novaShell.appendChild(greeting);
  // Queue panel: above the pill, hidden while empty.
  novaQueuePanel = document.createElement("div");
  novaQueuePanel.className = "nova-queue nova-queue-empty";
  novaShell.appendChild(novaQueuePanel);
  const pill = document.createElement("div");
  pill.className = "nova-composer-pill";
  novaShell.appendChild(pill);
  container.insertBefore(novaShell, input);

  // Row 0: attachment chips.
  novaChipBar = document.createElement("div");
  novaChipBar.className = "nova-chip-bar";
  pill.appendChild(novaChipBar);

  // Row 1: shinychat's own input, adopted into the pill (still a
  // descendant of the container, so its delegated handlers keep firing).
  pill.appendChild(input);

  // Row 2: + attach on the left; menu triggers join in
  // initComposerMenus().
  novaRow = document.createElement("div");
  novaRow.className = "nova-composer-row";
  pill.appendChild(novaRow);

  novaFileInput = document.createElement("input");
  novaFileInput.type = "file";
  // No accept filter: the OS dialog must show EVERY file. The server
  // owns the type dispatch (images, .pdf, .docx, text) and refuses what
  // it cannot read with an honest note; an accept list here only hid
  // attachable files from the picker.
  novaFileInput.multiple = true;
  novaFileInput.className = "nova-attach-input";
  novaFileInput.addEventListener("change", () => {
    novaAddFiles(novaFileInput.files);
    novaFileInput.value = "";
  });
  const attach = document.createElement("button");
  attach.type = "button";
  attach.className = "nova-ctl-btn nova-attach-btn";
  attach.setAttribute("aria-label", "Add Context");
  novaSetTip(attach, "Add Context");
  // CSS-drawn plus (nova.css), not a text "+": a font glyph's baseline
  // never sits at the optical center of the hover circle.
  const plus = document.createElement("span");
  plus.className = "nova-plus";
  attach.appendChild(plus);
  attach.addEventListener("click", () => novaFileInput.click());
  novaRow.appendChild(attach);
  novaRow.appendChild(novaFileInput);
  const spacer = document.createElement("span");
  spacer.className = "nova-composer-spacer";
  novaRow.appendChild(spacer);

  // Context-usage ring (fed by the "nova_context" custom message).
  const ring = document.createElement("span");
  ring.className = "nova-context-ring";
  ring.style.setProperty("--nova-ctx", "0%");
  novaSetTip(ring, "0% of Context Window Used");
  novaRow.appendChild(ring);

  // ONE pill, no second bar: the dark toggle and shinychat's own send
  // button join the control row's right side (both stay inside the
  // container subtree, so their bindings/delegation keep working).
  const dark = document.querySelector("bslib-input-dark-mode");
  if (dark) {
    novaSetTip(dark, "Toggle Theme");
    novaRow.appendChild(dark);
  }
  // Adopted, never listened to: while streaming shinychat MORPHS this
  // same node into its cancel button (.shiny-chat-btn-cancel added), and
  // nova's stop proxies a click through it -- any handler of nova's here
  // would swallow that cancel. Mid-stream clicks go to nova's own queue
  // button below instead.
  const send = container.querySelector(".shiny-chat-btn-send");
  if (send) {
    novaSetTip(send, "Send Message", "↵");
    novaRow.appendChild(send);
  }

  // nova's OWN queue-send button, shown only while streaming (next to
  // the stop square): the native send is unusable then -- shinychat
  // morphs that same element into its cancel -- so mid-stream sends
  // need their own control. Click = queue, exactly like Enter.
  const qsend = document.createElement("button");
  qsend.type = "button";
  qsend.className = "nova-queue-btn";
  qsend.setAttribute("aria-label", "Queue Message");
  novaSetTip(qsend, "Queue Message", "↵");
  const qarrow = document.createElement("span");
  qarrow.className = "nova-queue-btn-icon";
  qsend.appendChild(qarrow);
  qsend.addEventListener("click", () => {
    const taNow = novaTextarea();
    if (taNow) novaQueueIntercept(taNow);
  });
  novaRow.appendChild(qsend);

  // nova's OWN stop button, shown only while streaming. The previous
  // design restyled the send button into a stop square -- a lookalike
  // that cancelled nothing when clicked, and shinychat's real cancel
  // was not reliably visible after adoption.
  const stop = document.createElement("button");
  stop.type = "button";
  stop.className = "nova-stop-btn";
  stop.setAttribute("aria-label", "Stop Response");
  novaSetTip(stop, "Stop Response", "Esc");
  const square = document.createElement("span");
  square.className = "nova-stop-square";
  stop.appendChild(square);
  stop.addEventListener("click", novaStopStreaming);
  novaRow.appendChild(stop);

  // Optimistic streaming state: flips the send slot to the stop look
  // the instant a message is sent, before shinychat's cancel exists.
  const ta = input.querySelector("textarea");
  if (ta) {
    ta.addEventListener("keydown", (ev) => {
      // With the @ picker open, Enter SELECTS a file (novaAtKeydown)
      // and nothing is sent. stopPropagation cannot help: both listeners
      // sit on the same element and this one registered first.
      if (
        ev.key === "Enter" &&
        !ev.shiftKey &&
        ta.value.trim() !== "" &&
        !novaAtMenuEl
      ) {
        // Mid-stream, Enter queues instead of sending. shinychat's send
        // handler is delegated from the container, so stopping the
        // event here (target phase) keeps it from ever submitting.
        if (novaQueueIntercept(ta)) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      }
    });
  }

  // Pasting an image while composing attaches it as a chip.
  input.addEventListener("paste", (ev) => {
    const files = (ev.clipboardData && ev.clipboardData.files) || [];
    if (files.length === 0) return;
    ev.preventDefault();
    novaAddFiles(files);
  });

  // Markdown list continuation: Shift+Enter on a line
  // starting with "- ", "* ", or "1. " carries the marker onto the new
  // line (numbers increment); Shift+Enter on an EMPTY list item clears
  // the marker instead (exits the list). Plain Enter still sends via
  // shinychat's own handling.
  const textarea = input.querySelector("textarea");
  if (textarea) {
    textarea.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" || !ev.shiftKey) return;
      const pos = textarea.selectionStart;
      const lineStart = textarea.value.lastIndexOf("\n", pos - 1) + 1;
      const line = textarea.value.slice(lineStart, pos);
      const m = line.match(/^(\s*)([-*] |(\d+)([.)]) )/);
      if (!m) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (line === m[0]) {
        // empty item: exit the list
        textarea.setRangeText("", lineStart, pos, "end");
      } else {
        const marker = m[3]
          ? m[1] + (parseInt(m[3], 10) + 1) + m[4] + " "
          : m[0];
        textarea.setRangeText("\n" + marker, pos, pos, "end");
      }
      // keep shinychat's autosize + Shiny's value tracking in step
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // @ typeahead + recognized-command styling track every edit; the
    // keydown hook runs at the target so the menu's Enter never
    // reaches shinychat's delegated send handler.
    textarea.addEventListener("input", () => {
      novaAtRender();
      novaSyncCommandStyle(textarea);
    });
    textarea.addEventListener("keydown", novaAtKeydown);
    textarea.addEventListener("blur", () => setTimeout(novaAtClose, 150));
  }
}

// ---- Streaming state ---------------------------------------------------
// The dead window: shinychat only creates its cancel button once the
// stream starts, so for the first seconds of a turn nothing marks the
// shell as busy. Both halves are read off the DOM, and BOTH are
// shinychat's own word rather than nova's guess:
//
//   pending  -- the send button wears the spinner class exactly while a
//               turn is submitted with no stream open.
//   cancel   -- the cancel button exists exactly while one is open.
//
// This used to be the spinner's half only by inference: a flag set on
// Enter/click and expired after 10.5s, on the theory that a turn which
// errors before streaming would otherwise leave the stop button up
// forever. A compaction runs for the better part of a minute and opens
// no stream at all, so the flag went out mid-turn and took the stop
// control with it -- reachable for ten seconds, gone for the next fifty.
// A timer cannot expire mid-turn if there is no timer, and the expiry it
// was insuring against cannot happen either: every settle now sends a
// chat action, which clears the spinner.

// Click the real shinychat cancel button wherever it lives; nova's
// visible stop button and the Escape shortcut both route through here.
function novaStopStreaming() {
  // Acknowledge the press IMMEDIATELY. Cancelling cannot take effect
  // until the in-flight chunk arrives from the provider, which can be
  // several seconds; with no feedback that gap reads as a hang and the
  // user presses stop again (or assumes it did nothing).
  if (novaShell) novaShell.classList.add("nova-stopping");
  // Paint it NOW, in this same tick. Adding the class is not enough: the
  // "Stopping" row is drawn by novaSetStreamingState(), which otherwise
  // only runs on the next DOM mutation -- so the feedback appeared late,
  // or not until something unrelated happened to change the DOM (a
  // scroll bringing new nodes in). That is the exact gap this indicator
  // exists to fill, so it cannot itself wait on an event.
  novaSetStreamingState();
  // Preferred path: proxy the click to shinychat's own cancel button, so
  // its internal state stays in step with ours.
  const cancel = novaCancelBtn();
  if (cancel) {
    cancel.click();
    return;
  }
  // But nova shows its stop button OPTIMISTICALLY the moment a message
  // is sent, which is before shinychat has rendered that button. In that
  // window there was nothing to click and pressing stop did nothing at
  // all. Fall back to the input nova's own server observes -- it is the
  // consumer either way, so this cancels the turn regardless of what
  // shinychat has rendered yet.
  if (window.Shiny && Shiny.setInputValue) {
    Shiny.setInputValue("chat_cancel", Date.now(), { priority: "event" });
  }
}

function novaSetStreamingState() {
  if (!novaShell) return;
  const cancel = novaCancelBtn();
  const on = !!cancel || !!novaPendingBtn();
  novaShell.classList.toggle("nova-streaming", on);
  // The stopping state belongs to one turn: once the stream is actually
  // over it must clear, or the next turn starts with a dimmed stop
  // button and a stale "Stopping" row.
  if (!on) novaShell.classList.remove("nova-stopping");
  const stopping = novaShell.classList.contains("nova-stopping");
  // Working... covers ONLY the dead window before the first reply
  // content renders -- once tool cards / text appear they carry the
  // activity signal themselves. Waiting means: streaming, and the
  // LAST message is not yet an assistant message with real content.
  // The old "last message is the user's" rule went dark whenever
  // shinychat's empty assistant placeholder (or a fresh conversation
  // with no messages at send time) sat at the end.
  const msgs = document.querySelectorAll(
    ".shiny-chat-messages-content > .shiny-chat-message"
  );
  const last = msgs[msgs.length - 1];
  let waiting = on;
  if (last && !last.classList.contains("shiny-chat-user-message")) {
    const content = last.querySelector(NOVA_SEL.messageContent);
    waiting = on && novaIsBlankContent(content);
  }
  // One indicator only: the in-transcript typing dots. The composer
  // shimmer duplicated them and was removed.
  //
  // While stopping, force the row on even if the reply had already
  // started rendering: the wait between the press and the stream
  // actually ending is exactly the window that needs a signal, and by
  // then `waiting` is false because real content exists.
  novaSyncTyping(waiting || stopping, stopping);
}

// In-transcript typing indicator for the dead window: a pulsing-dots
// row at the spot the reply will appear ("animation until the robot
// icon appears"). Removed the moment real assistant content lands.
function novaSyncTyping(waiting, stopping) {
  let t = document.querySelector(".nova-typing");
  if (!waiting) {
    if (t) t.remove();
    return;
  }
  const msgs = document.querySelector(NOVA_SEL.messages);
  if (!msgs) return;
  if (!t) {
    t = document.createElement("div");
    t.className = "nova-typing";
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      dot.className = "nova-typing-dot";
      t.appendChild(dot);
    }
  }
  // The dots mark the spot the REPLY will appear, so they must always be
  // the LAST child -- re-appended, not just created once. On the first
  // turn of a conversation the streaming state goes optimistic the
  // instant the message is sent, which is BEFORE shinychat appends the
  // user's own message; the dots were created into an empty transcript,
  // the user message then landed after them, and they stayed stranded
  // above it for the rest of the turn. appendChild on a node already in
  // the list moves it, so this is idempotent and settles in one pass.
  if (msgs.lastElementChild !== t) {
    msgs.appendChild(t);
  }
  // The stopping label rides on the dots, NOT on the composer: the
  // composer's .nova-stopping class cannot reach this element, which
  // lives in shinychat's message list, a different subtree entirely.
  t.classList.toggle("nova-typing-stopping", !!stopping);
}

// shinychat creates its cancel (stop) button dynamically while a turn
// streams, inside its own input area -- adopt it into the control row
// next to send, where it inherits the reference styling.
function novaAdoptCancel() {
  if (!novaRow) return;
  const cancel = novaCancelBtn();
  if (cancel && cancel.parentElement !== novaRow) {
    novaSetTip(cancel, "Stop Response");
    novaRow.appendChild(cancel);
  }
}

// Popover menus that drive the hidden native selects in
// .nova-hidden-controls: picking an item writes select.value and
// dispatches a change event, so the Shiny binding -- and every server
// observer on input$nova_model / input$nova_effort / input$nova_mode --
// fires exactly as if the raw select had been used. The selects are
// rendered selectize-free for this reason (see nova_ui()).
let novaOpenMenuEl = null;
let novaOpenTrigger = null;

function novaCloseMenu() {
  if (!novaOpenMenuEl) return;
  novaOpenMenuEl.classList.remove("nova-menu-open");
  novaOpenMenuEl = null;
  if (novaOpenTrigger) {
    novaOpenTrigger.setAttribute("aria-expanded", "false");
    novaOpenTrigger = null;
  }
}
document.addEventListener("click", (ev) => {
  if (novaOpenMenuEl && !ev.target.closest(".nova-menu, .nova-ctl-btn")) {
    novaCloseMenu();
  }
});
// Escape is owned by the single handler near the top of this file, not
// here: three cooperating listeners used to close this menu, the history
// menu and the drawer through shared mutable flags, and because this one
// ran first and nulled novaOpenMenuEl, the drawer's guard on that flag
// saw nothing and one keypress closed two things.

// sections: [{title, select, format}] -- select is a hidden native
// <select>, format(option) -> the label shown. Rebuilt on every open so
// aria-checked always reflects the select's current value.
function novaMenu(trigger, sections, refresh) {
  // Wrap the trigger in a positioned anchor so the popover opens UPWARD
  // from it (the composer is bottom-docked in conversation; a downward
  // menu would fall off-screen). Right-side triggers get a right-aligned
  // menu so it cannot overflow the narrow Viewer pane.
  const anchor = document.createElement("span");
  anchor.className = "nova-menu-anchor";
  if (trigger.classList.contains("nova-model-btn")) {
    anchor.classList.add("nova-menu-right");
  }
  trigger.parentNode.insertBefore(anchor, trigger);
  anchor.appendChild(trigger);
  const menu = document.createElement("div");
  menu.className = "nova-menu";
  anchor.appendChild(menu);
  function rebuild() {
    while (menu.firstChild) menu.removeChild(menu.firstChild);
    sections.forEach((sec) => {
      const title = document.createElement("div");
      title.className = "nova-menu-title";
      title.textContent = sec.title;
      menu.appendChild(title);
      Array.from(sec.select.options).forEach((opt) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "nova-menu-item";
        item.setAttribute("role", "menuitemradio");
        item.setAttribute("aria-checked", String(opt.selected));
        item.textContent = sec.format ? sec.format(opt) : opt.textContent;
        item.addEventListener("click", () => {
          sec.select.value = opt.value;
          sec.select.dispatchEvent(new Event("change"));
          novaCloseMenu();
          refresh();
        });
        menu.appendChild(item);
      });
    });
  }
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (menu.classList.contains("nova-menu-open")) return novaCloseMenu();
    novaCloseMenu();
    rebuild();
    menu.classList.add("nova-menu-open");
    novaOpenMenuEl = menu;
    novaOpenTrigger = trigger;
    trigger.setAttribute("aria-expanded", "true");
  });
}

// Every effort level is a real thinking budget, so each one is worth
// showing on the composer chip.
function novaEffortLabel(v) {
  return " (" + v.charAt(0).toUpperCase() + v.slice(1) + ")";
}

function initComposerMenus() {
  if (!novaRow || novaRow.querySelector(".nova-model-btn")) return;
  const modelSel = document.getElementById("nova_model");
  const effortSel = document.getElementById("nova_effort");
  const modeSel = document.getElementById("nova_mode");
  if (!modelSel || !effortSel || !modeSel) return;

  // Trigger = label span + a CSS-drawn caret (a text "⌄" glyph renders
  // misaligned and cheap; the rotated-border chevron matches the
  // reference).
  function makeTrigger(cls, tip) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "nova-ctl-btn " + cls;
    novaSetTip(b, tip);
    const label = document.createElement("span");
    label.className = "nova-ctl-label";
    const caret = document.createElement("span");
    caret.className = "nova-caret";
    b.appendChild(label);
    b.appendChild(caret);
    return b;
  }
  const modelBtn = makeTrigger("nova-model-btn", "Select Model");
  const modeBtn = makeTrigger("nova-mode-btn", "Approval Mode");

  // Persist every pick; restore the saved ones as a REAL change event
  // only after the Shiny session exists. Applied before binding, a
  // saved value becomes the input's INIT value and the server's
  // ignoreInit = TRUE model/effort observers skip it -- the composer
  // would show the saved model while the live client still ran the
  // default. A saved value no longer in the option list (model roster
  // changed) is ignored, not forced.
  const prefs = [
    ["nova-pref-model", modelSel],
    ["nova-pref-effort", effortSel],
    ["nova-pref-mode", modeSel]
  ];
  prefs.forEach(([key, sel]) => {
    sel.addEventListener("change", () =>
      novaStore((s) => s.setItem(key, sel.value))
    );
  });
  function applySavedPrefs() {
    prefs.forEach(([key, sel]) => {
      const saved = novaStore((s) => s.getItem(key), null);
      if (
        saved !== null &&
        saved !== sel.value &&
        Array.from(sel.options).some((o) => o.value === saved)
      ) {
        sel.value = saved;
        sel.dispatchEvent(new Event("change"));
      }
    });
    refresh();
  }
  if (window.Shiny && Shiny.shinyapp && Shiny.shinyapp.isConnected()) {
    applySavedPrefs();
  } else if (window.jQuery) {
    window.jQuery(document).one("shiny:sessioninitialized", applySavedPrefs);
  }

  function refresh() {
    // The option's LABEL, not its value: the value is the Kong
    // deployment id (claude-opus-4-6) and the label is the product name
    // R builds for it (Opus 4.6). The popover renders labels already,
    // so reading the value here named the same model two ways.
    const modelOpt = modelSel.options[modelSel.selectedIndex];
    modelBtn.querySelector(".nova-ctl-label").textContent =
      (modelOpt ? modelOpt.textContent : modelSel.value) +
      novaEffortLabel(effortSel.value);
    const opt = modeSel.options[modeSel.selectedIndex];
    modeBtn.querySelector(".nova-ctl-label").textContent = opt
      ? opt.textContent
      : "Manual";
  }
  // The labels track the selects THEMSELVES, not just the popover
  // picks: a restored conversation's prefs land as dispatched change
  // events (nova_prefs handler), and without this the trigger kept
  // showing the default while the live client already ran the saved
  // model.
  [modelSel, effortSel, modeSel].forEach((sel) =>
    sel.addEventListener("change", refresh)
  );
  refresh();

  // Attach the triggers BEFORE wiring their menus: novaMenu inserts the
  // popover as the trigger's next sibling, and insertAdjacentElement on
  // a detached node is a silent no-op -- the menus simply never
  // existed. Row order: + | mode | spacer | model | dark | send.
  const spacer = novaRow.querySelector(".nova-composer-spacer");
  novaRow.insertBefore(modeBtn, spacer);
  novaRow.insertBefore(modelBtn, spacer.nextSibling);

  novaMenu(
    modelBtn,
    [
      { title: "Model", select: modelSel },
      { title: "Effort", select: effortSel }
    ],
    refresh
  );
  novaMenu(modeBtn, [{ title: "Mode", select: modeSel }], refresh);
}

// Empty state: while the transcript has no messages, .nova-empty on
// .nova-main centers the composer and shows the project label
// (nova.css). The MutationObserver below fires on every subtree change,
// including the first appended message, so the class self-clears.
function novaSyncEmptyState() {
  // .nova-main is nova's own shell div (bslib's div.main left with the
  // sidebar layout). shinychat 0.4.0 renders div.shiny-chat-
  // messages (same trap as .shiny-chat-input); messages nest under
  // .shiny-chat-messages-content, which exists (and stays empty) before
  // the first turn -- that inner div is the real emptiness signal.
  const main = document.querySelector(".nova-main");
  const msgs = document.querySelector(".shiny-chat-messages-content");
  if (!main || !msgs) return;
  const hasMsgs = msgs.childElementCount > 0;
  // Launch resume: the server stamps .nova-booting on the shell when
  // it will restore a conversation; nova.css shows the loading
  // indicator and hides the chat, so neither the hero nor a
  // half-replayed transcript flashes. The nova_boot_done handshake
  // ends it (the safety-net timer below covers a restore that never
  // arrives) -- clearing on first content instead revealed the replay
  // partway through.
  main.classList.toggle(
    "nova-empty",
    !hasMsgs && !main.classList.contains("nova-booting")
  );
}
// Safety net only: the nova_boot_done handshake is what normally ends
// the loading state. The old 8s version was the primary mechanism and
// gave up before a slow replay arrived, flashing the empty-state hero
// between the loading canvas and the restored conversation.
setTimeout(() => {
  const main = document.querySelector(".nova-main");
  if (main) main.classList.remove("nova-booting");
  novaSyncEmptyState();
}, 30000);

// A tool result always lands in a SEPARATE card below its request card,
// so an auto-run request card's "running" pill would otherwise stay
// RUNNING forever. Both cards carry the same data-request id; when a
// result card exists, flip its request card's running pill to mirror the
// result's done/error state. Gate cards are untouched -- their pill is
// resolved by the button click handler above.
function novaSyncRunningPills() {
  document
    .querySelectorAll(".nova-card-result[data-request]")
    .forEach((res) => {
      // getAttribute, not dataset: the dataset contract test scopes the
      // dataset namespace to card BUTTON wiring; this id lives on the card.
      const id = res.getAttribute("data-request");
      const cards = document.querySelectorAll(
        '.nova-card[data-request="' + CSS.escape(id) + '"]'
      );
      cards.forEach((card) => {
        if (card.classList.contains("nova-card-result")) return;
        // The result card carries the full output; the live feed is
        // scaffolding and leaving it would show everything twice.
        card.querySelectorAll(".nova-bash-live").forEach((el) => el.remove());
        const pill = card.querySelector(".nova-pill");
        if (!pill || pill.textContent !== "running") return;
        const ok = !!res.querySelector(".nova-pill.text-bg-success");
        pill.textContent = ok ? "done" : "error";
        pill.classList.remove("text-bg-secondary");
        pill.classList.add(ok ? "text-bg-success" : "text-bg-danger");
        // Freeze the elapsed readout at its final value: dropping the
        // stamp takes the card out of the ticker's query.
        card.removeAttribute("data-started");
      });
    });
}

// ---- Elapsed time on running cards -------------------------------------
// A long bash call sat behind a bare "running" pill with no sense of
// time passing. Each running card is stamped once (data-started, plain
// attribute -- the dataset namespace is contract-scoped to button
// wiring), and one ticker updates a muted readout beside the pill.
// "waiting approval" is NOT stamped: that wait is the user's time, not
// the tool's, so the clock starts when the pill turns running.
function novaFormatElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m + "m " + (rest < 10 ? "0" : "") + rest + "s";
}

function novaSyncElapsed() {
  document
    .querySelectorAll(".nova-card[data-request]:not(.nova-card-result)")
    .forEach((card) => {
      const pill = card.querySelector(".nova-card-head > .nova-pill");
      if (!pill) return;
      if (pill.textContent !== "running") {
        // Resolved before the first tick (or still gated): no stamp, and
        // a stale stamp from a re-rendered transcript is dropped.
        if (pill.textContent !== "done" && pill.textContent !== "error") {
          card.removeAttribute("data-started");
        }
        return;
      }
      if (!card.getAttribute("data-started")) {
        card.setAttribute("data-started", String(Date.now()));
      }
      let el = card.querySelector(".nova-card-elapsed");
      if (!el) {
        el = document.createElement("span");
        el.className = "nova-card-elapsed";
        pill.parentElement.insertBefore(el, pill);
      }
      el.textContent = novaFormatElapsed(
        Date.now() - Number(card.getAttribute("data-started"))
      );
    });
}

setInterval(novaSyncElapsed, 1000);

// ---- Hover tooltips ----------------------------------------------------
// One shared pill, repositioned on hover over any [data-tip] element;
// data-tip-kbd renders the muted shortcut hint. novaSetTip() replaces a
// control's native title so the browser's own delayed tooltip never
// doubles up. Fixed-position with viewport clamping (a centered tip on
// the right-edge send button would otherwise overflow the pane), and it
// flips below the target when there is no room above (the drawer
// toggle hugs the top edge).
let novaTipEl = null;
let novaTipLabel = null;
let novaTipKbd = null;

function novaSetTip(el, tip, kbd) {
  el.removeAttribute("title");
  el.setAttribute("data-tip", tip);
  if (kbd) el.setAttribute("data-tip-kbd", kbd);
}

document.addEventListener("mouseover", (ev) => {
  const target = ev.target.closest ? ev.target.closest("[data-tip]") : null;
  if (!target) {
    if (novaTipEl) novaTipEl.classList.remove("nova-tooltip-show");
    return;
  }
  if (!novaTipEl) {
    novaTipEl = document.createElement("div");
    novaTipEl.className = "nova-tooltip";
    novaTipLabel = document.createElement("span");
    novaTipKbd = document.createElement("span");
    novaTipKbd.className = "nova-tooltip-kbd";
    novaTipEl.appendChild(novaTipLabel);
    novaTipEl.appendChild(novaTipKbd);
    document.body.appendChild(novaTipEl);
  }
  novaTipLabel.textContent = target.getAttribute("data-tip");
  novaTipKbd.textContent = target.getAttribute("data-tip-kbd") || "";
  novaTipEl.classList.add("nova-tooltip-show");
  const r = target.getBoundingClientRect();
  const w = novaTipEl.offsetWidth;
  const h = novaTipEl.offsetHeight;
  const x = Math.max(
    8,
    Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8)
  );
  const below = r.top - h - 8 < 4;
  novaTipEl.classList.toggle("nova-tooltip-below", below);
  novaTipEl.style.left = x + "px";
  novaTipEl.style.top = (below ? r.bottom + 8 : r.top - h - 8) + "px";
  // caret follows the TARGET's center, not the pill's: edge-clamping
  // the pill otherwise leaves the caret pointing at nothing (the
  // drawer toggle hugs the top-left corner)
  const caret = Math.max(10, Math.min(r.left + r.width / 2 - x, w - 10));
  novaTipEl.style.setProperty("--nova-tip-caret", caret + "px");
});

// ---- History row menu (Pin / Rename / Delete) ------------------------
// One menu at a time, rebuilt per row from the row's data-id /
// data-title / data-pinned attributes (getAttribute, not dataset: the
// dataset contract test scopes the dataset namespace to card-button
// wiring). Delete is two-step -- the item re-arms to "Confirm Delete"
// and only the second click dispatches.
let novaHistMenuEl = null;

function novaCloseHistMenu() {
  if (novaHistMenuEl) {
    novaHistMenuEl.remove();
    novaHistMenuEl = null;
  }
}

function novaStartRename(row) {
  // Shiny can re-render #nova_history_list between the click and this
  // call (an autosave bumps history_version), leaving a detached row.
  // Throwing here would abort inside a document listener.
  const link = row && row.querySelector(".nova-history-open");
  if (!link) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "nova-history-rename";
  input.value = row.getAttribute("data-title") || "";
  link.style.display = "none";
  row.insertBefore(input, link);
  input.focus();
  input.select();
  let finished = false;
  const done = (commit) => {
    if (finished) return;
    finished = true;
    const title = input.value.trim();
    input.remove();
    link.style.display = "";
    if (commit && title && title !== row.getAttribute("data-title")) {
      Shiny.setInputValue("nova_hist_rename", {
        id: row.getAttribute("data-id"),
        title: title
      }, { priority: "event" });
    }
  };
  input.addEventListener("keydown", (ev) => {
    // Enter/Escape belong to the rename, never to the gate shortcuts
    // or the drawer's own Escape handling.
    ev.stopPropagation();
    if (ev.key === "Enter") done(true);
    if (ev.key === "Escape") done(false);
  });
  input.addEventListener("blur", () => done(false));
}

function novaOpenHistMenu(kebab) {
  const row = kebab.closest(".nova-history-row");
  const reopen = novaHistMenuEl && novaHistMenuEl.novaRow === row;
  novaCloseHistMenu();
  if (reopen) return; // second click on the same kebab toggles closed
  if (!row) return; // row re-rendered out from under the click
  const id = row.getAttribute("data-id");
  const pinned = row.getAttribute("data-pinned") === "true";

  const menu = document.createElement("div");
  menu.className = "nova-menu nova-menu-open nova-history-menu";
  menu.novaRow = row;

  function item(label, cls, action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "nova-menu-item" + (cls ? " " + cls : "");
    b.textContent = label;
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      action(b);
    });
    menu.appendChild(b);
    return b;
  }

  item(pinned ? "Unpin" : "Pin", "", () => {
    Shiny.setInputValue("nova_hist_pin", { id: id, pinned: !pinned }, {
      priority: "event"
    });
    novaCloseHistMenu();
  });
  item("Rename", "", () => {
    novaCloseHistMenu();
    novaStartRename(row);
  });
  item("Delete", "nova-menu-danger", (b) => {
    if (b.getAttribute("data-arming") === "true") {
      Shiny.setInputValue("nova_hist_delete", { id: id }, { priority: "event" });
      novaCloseHistMenu();
    } else {
      b.setAttribute("data-arming", "true");
      b.textContent = "Confirm Delete";
    }
  });

  // Fixed-position beside the kebab (the drawer scrolls under it, but
  // every action closes the menu long before that matters). Attach
  // first so offsetHeight is measurable, then flip ABOVE the kebab
  // when there is no room below (rows near the viewport bottom).
  const r = kebab.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.bottom = "auto";
  menu.style.left = Math.min(r.left, window.innerWidth - 200) + "px";
  document.body.appendChild(menu);
  const below = r.bottom + 6;
  menu.style.top =
    below + menu.offsetHeight > window.innerHeight - 8
      ? Math.max(8, r.top - menu.offsetHeight - 6) + "px"
      : below + "px";
  novaHistMenuEl = menu;
}

document.addEventListener("click", (ev) => {
  if (
    novaHistMenuEl &&
    !ev.target.closest(".nova-history-menu, .nova-history-kebab")
  ) {
    novaCloseHistMenu();
  }
});

// ---- Conversation drawer ---------------------------------------------
// Overlay panel replacing the bslib sidebar: slides from the left OVER
// the content (never pushes it -- what keeps the narrow Viewer pane
// workable). nova.js ADOPTS the server-rendered #nova_new_chat link and
// #nova_history_list output out of .nova-hidden-controls; adoption
// happens before Shiny binds (the observer fires during parse), so the
// output is never bound while display:none and never suspends.
let novaDrawerEl = null;
let novaDrawerToggleEl = null;
let novaScrimEl = null;

function novaDrawerIsOpen() {
  return !!(novaDrawerEl && novaDrawerEl.classList.contains("nova-drawer-open"));
}

// Wide = docked (the reference's pinned sidebar: pushes the canvas,
// stays open, only the toggle closes it). Narrow (the Viewer pane) =
// overlay with scrim + auto-hide. Same breakpoint as the scrim media
// query in nova.css.
function novaDrawerDocked() {
  return window.matchMedia("(min-width: 700px)").matches;
}

// Overlay mode owns dismissal keys/clicks; docked mode ignores them.
function novaDrawerAutoHides() {
  return novaDrawerIsOpen() && !novaDrawerDocked();
}

function novaSetDrawerWidth(w) {
  novaDrawerEl.style.width = w ? w + "px" : "";
  // The docked canvas offset (body padding, nova.css) tracks the drag.
  document.documentElement.style.setProperty(
    "--nova-drawer-w",
    (w || 280) + "px"
  );
}

function novaSetDrawer(open) {
  if (!novaDrawerEl) return;
  // The row menu (Pin/Rename/Delete) belongs to a drawer row; closing
  // or collapsing the drawer must never leave it floating over the
  // canvas.
  if (!open) novaCloseHistMenu();
  novaDrawerEl.classList.toggle("nova-drawer-open", open);
  novaScrimEl.classList.toggle("nova-scrim-visible", open);
  document.body.classList.toggle("nova-drawer-docked-open", open);
  novaDrawerToggleEl.setAttribute("aria-expanded", String(open));
}

function initDrawer() {
  if (novaDrawerEl) return;
  const newChat = document.getElementById("nova_new_chat");
  const history = document.getElementById("nova_history_list");
  const quit = document.getElementById("nova_quit");
  if (!newChat || !history || !document.body) return;

  // Always-visible floating toggle, top-left (panel icon drawn in
  // CSS -- no glyph, no markup strings).
  novaDrawerToggleEl = document.createElement("button");
  novaDrawerToggleEl.type = "button";
  novaDrawerToggleEl.className = "nova-drawer-toggle";
  novaDrawerToggleEl.setAttribute("aria-label", "Conversation History");
  novaSetTip(novaDrawerToggleEl, "Conversation History");
  novaDrawerToggleEl.setAttribute("aria-expanded", "false");
  const icon = document.createElement("span");
  icon.className = "nova-drawer-icon";
  novaDrawerToggleEl.appendChild(icon);
  novaDrawerToggleEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    novaSetDrawer(!novaDrawerIsOpen());
  });

  novaScrimEl = document.createElement("div");
  novaScrimEl.className = "nova-scrim";

  novaDrawerEl = document.createElement("div");
  novaDrawerEl.className = "nova-drawer";
  const saved = parseInt(
    novaStore((s) => s.getItem("nova-drawer-width"), null),
    10
  );
  novaSetDrawerWidth(saved >= 200 && saved <= 400 ? saved : null);

  // No standing "Conversations" title: the server-rendered list carries
  // its own Pinned / Recents section headers.
  novaDrawerEl.appendChild(newChat);
  novaDrawerEl.appendChild(history);
  // Last, and pinned to the bottom by CSS: quitting is the one action
  // here that ends the session, so it does not sit among the
  // conversations it would close.
  if (quit) novaDrawerEl.appendChild(quit);

  // Overlay mode only: picking a conversation (or starting a new one)
  // closes the drawer -- both render as <a> actionLinks. Docked mode
  // keeps the sidebar open across selections, like the reference.
  novaDrawerEl.addEventListener("click", (ev) => {
    const kebab = ev.target.closest(".nova-history-kebab");
    if (kebab) {
      ev.stopPropagation();
      novaOpenHistMenu(kebab);
      return;
    }
    if (ev.target.closest("a") && !novaDrawerDocked()) novaSetDrawer(false);
  });

  // Drag-resize on the right edge, 200-400px, width persisted;
  // double-click resets to the CSS default.
  const handle = document.createElement("div");
  handle.className = "nova-drawer-handle";
  handle.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    handle.setPointerCapture(ev.pointerId);
    const move = (e) => {
      // The drawer is pinned to x=0, so clientX IS the width.
      novaSetDrawerWidth(Math.min(400, Math.max(200, e.clientX)));
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      // A cancelled gesture (pointer capture lost, touch interrupted)
      // fires pointercancel and never pointerup, which would leave the
      // move listener bound and the drawer resizing on every hover.
      handle.removeEventListener("pointercancel", up);
      const w = parseInt(novaDrawerEl.style.width, 10);
      if (w) novaStore((s) => s.setItem("nova-drawer-width", String(w)));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  });
  handle.addEventListener("dblclick", () => {
    novaSetDrawerWidth(null);
    novaStore((s) => s.removeItem("nova-drawer-width"));
  });
  novaDrawerEl.appendChild(handle);

  document.body.appendChild(novaScrimEl);
  document.body.appendChild(novaDrawerEl);
  document.body.appendChild(novaDrawerToggleEl);
}

// Auto-hide, overlay mode only: outside click (the scrim at narrow
// widths is outside too) and Escape both close the drawer. Escape
// defers to an open composer menu, and the gate-shortcut handler above
// defers to the auto-hiding drawer, so one keypress never does two
// things. A docked (wide) drawer ignores all of this -- only the
// toggle closes it, like the reference's pinned sidebar.
document.addEventListener("click", (ev) => {
  if (
    novaDrawerAutoHides() &&
    !ev.target.closest(".nova-drawer, .nova-drawer-toggle")
  ) {
    novaSetDrawer(false);
  }
});
// Escape for the drawer is handled by the single owner near the top of
// this file, in priority order with the menus and the gate shortcuts.

// ---- Folded tool activity in the transcript ----------------------------
// A RESOLVED tool card collapses to a quiet one-line header with a
// chevron; clicking toggles the detail (arguments + the result card,
// which is adopted INTO its request card by the shared data-request
// id). A gated card with a still-enabled button never folds -- the
// approval surface stays full-size until the user acts on it.
//
// A mutating card (edit_file / write_file) never folds at all: the
// transcript is the record of every file nova changed, and a record you
// have to click to see is not one. That is why the adoption pass below
// keys on data-request alone -- these cards never get .nova-tool-line,
// so scoping adoption to that class stranded their result underneath
// them as a separate panel.
function novaFoldTools() {
  document
    .querySelectorAll(
      ".nova-card[data-request]:not(.nova-card-result):not(.nova-tool-line):not(.nova-card-mutating)"
    )
    .forEach((card) => {
      if (card.querySelector(".nova-card-actions button:not(:disabled)")) {
        return; // pending approval: leave expanded
      }
      card.classList.add("nova-tool-line");
      const head = card.querySelector(".nova-card-head");
      if (!head) return;
      const caret = document.createElement("span");
      caret.className = "nova-caret nova-tool-caret";
      caret.setAttribute("aria-hidden", "true");
      head.insertBefore(caret, head.firstChild);
      // The head is a disclosure control, so it has to BE one to the
      // keyboard and to assistive tech -- a bare click target is
      // unreachable by Tab and announces as nothing.
      head.setAttribute("role", "button");
      head.setAttribute("tabindex", "0");
      head.setAttribute("aria-expanded", "false");
      const toggle = () => {
        const open = card.classList.toggle("nova-tool-open");
        head.setAttribute("aria-expanded", String(open));
      };
      head.addEventListener("click", (ev) => {
        // the fold toggle must not fight the gate buttons
        if (ev.target.closest("button")) return;
        toggle();
      });
      head.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          // Space must not scroll the page
          ev.preventDefault();
          toggle();
        }
      });
    });
  document.querySelectorAll(".nova-card-result[data-request]").forEach(
    (res) => {
      const id = res.getAttribute("data-request");
      const req = document.querySelector(
        '.nova-card[data-request="' +
          CSS.escape(id) +
          '"]:not(.nova-card-result)'
      );
      if (req && res.parentElement !== req) {
        req.appendChild(res);
      }
    }
  );
}

// ---- Grouped tool activity ("Worked ..." section) ----------------------
// A run of >= 2 consecutive activity messages (folded tool cards or
// blank interstitials) collapses under ONE persistent summary row --
// "Worked · N steps" -- with a chevron; clicking reveals the run
// inline. Messages are NEVER re-parented (shinychat streams into the
// last message node, so moving it would break streaming); grouping is
// entirely class-driven, and summary rows persist across observer
// passes so their open state survives. A message holding a pending
// gate card is not activity -- it breaks the run and stays visible.
//
// Nor is a message holding a mutating card. Those never fold, so they
// would fail the every() test below anyway, but the grouping is the
// second thing that has to let them through: keeping a diff unfolded
// only to have "Worked · N steps" swallow the message whole hides it
// just as thoroughly as the fold did.
function novaMsgIsActivity(msg) {
  if (msg.classList.contains("nova-msg-blank")) return true;
  if (msg.classList.contains("shiny-chat-user-message")) return false;
  const content = msg.querySelector(".shiny-chat-message-content");
  if (!content) return false;
  if (content.querySelector(".nova-card-mutating")) return false;
  const kids = novaMsgBlocks(content);
  return (
    kids.length > 0 &&
    kids.every((k) => k.classList.contains("nova-tool-line"))
  );
}

// shinychat renders each appended block inside a container of its own,
// so a tool card is a GRANDCHILD of the message content, never a child.
// Reading content.children directly made novaMsgIsActivity() return
// false for every tool message ever rendered -- "Worked" grouping was
// dead in the running app while every source-text assertion stayed
// green. Descend through single-child wrappers until the cards are in
// hand.
//
// A message carrying two blocks stops the descent and reads as not
// activity. That is the safe direction (it stays visible rather than
// being folded away), and nothing appends two cards to one message:
// .chat_append_interstitial() gives each its own.
function novaMsgBlocks(content) {
  let el = content;
  while (
    el.children.length === 1 &&
    !el.children[0].classList.contains("nova-card")
  ) {
    el = el.children[0];
  }
  return Array.from(el.children);
}

function novaGroupActivity() {
  const content = document.querySelector(".shiny-chat-messages-content");
  if (!content) return;
  const kids = Array.from(content.children);
  let run = [];
  const flush = (next) => {
    const steps = run.filter((m) => !m.classList.contains("nova-msg-blank"));
    if (steps.length >= 2) {
      let summary = run[0].previousElementSibling;
      if (!summary || !summary.classList.contains("nova-activity-summary")) {
        summary = document.createElement("div");
        summary.className = "nova-activity-summary";
        const caret = document.createElement("span");
        caret.className = "nova-caret nova-tool-caret";
        const label = document.createElement("span");
        label.className = "nova-activity-label";
        summary.appendChild(caret);
        summary.appendChild(label);
        summary.addEventListener("click", () => {
          summary.classList.toggle("nova-activity-open");
          novaGroupActivity();
        });
        content.insertBefore(summary, run[0]);
      }
      summary.querySelector(".nova-activity-label").textContent =
        "Worked · " + steps.length + " step" + (steps.length > 1 ? "s" : "");
      const open = summary.classList.contains("nova-activity-open");
      run.forEach((m) => m.classList.toggle("nova-activity-hidden", !open));
    } else {
      run.forEach((m) => m.classList.remove("nova-activity-hidden"));
    }
    run = [];
  };
  kids.forEach((el) => {
    if (el.classList.contains("nova-activity-summary")) return;
    if (el.classList.contains("shiny-chat-message") && novaMsgIsActivity(el)) {
      run.push(el);
    } else {
      flush(el);
    }
  });
  flush(null);
  // a summary whose run dissolved (e.g. text arrived) must not linger
  content.querySelectorAll(".nova-activity-summary").forEach((s) => {
    const nxt = s.nextElementSibling;
    if (!nxt || !novaMsgIsActivity(nxt)) s.remove();
  });
}

// Code-block language headers: shinychat's markdown renders fences as
// pre > code.language-<lang>.hljs; stamping the language onto the
// <pre> lets CSS draw the header row (attr() can only read the
// element's OWN attributes, never a child's class).
// Tool-card pres have no <code> child, so they are naturally excluded.
function novaStampCodeLang() {
  document
    .querySelectorAll("shiny-chat-container pre > code")
    .forEach((code) => {
      const pre = code.parentElement;
      if (pre.hasAttribute("data-lang")) return;
      const m = (code.className || "").match(/language-([A-Za-z0-9_+#-]+)/);
      if (m && m[1] !== "override") {
        pre.setAttribute("data-lang", m[1].toUpperCase());
      }
    });
}

// Blank assistant messages: the interstitial end/content/start dance
// around every card append leaves messages whose content is WHITESPACE
// -- the CSS :empty rule cannot match a whitespace text node, so lone
// robot avatars and large vertical gaps rendered.
// Classify by content: trimmed text empty AND nothing element-ish
// (cards, pre, img) inside. Re-checked on every mutation, so a message
// that later receives streamed text un-hides itself.
function novaSyncBlankMessages() {
  document
    .querySelectorAll(".shiny-chat-messages-content > .shiny-chat-message")
    .forEach((msg) => {
      const content = msg.querySelector(NOVA_SEL.messageContent);
      if (!content) return;
      msg.classList.toggle("nova-msg-blank", novaIsBlankContent(content));
    });
}

// Observes document.documentElement, not document.body: this script tag
// can load and run while <head> is still being parsed (bslib/htmltools
// dependency placement is not something nova controls), at which point
// document.body is still null and .observe(null, ...) would throw.
// <html> itself always exists once any parsing has started.
// Every pass below is idempotent, which is what makes a single "the DOM
// changed, re-sync everything" reaction safe. It is also why they must be
// COALESCED: five of them scan the whole transcript, shinychat mutates
// the last message once per streamed token, and these passes themselves
// mutate the DOM (folding cards, appending typing dots) which re-triggers
// the observer. Uncoalesced that is O(transcript) work per token plus a
// guaranteed second pass per change. One rAF-batched run per frame keeps
// the same behaviour at a fraction of the cost.
// The attachment chip row arrives as its own user message -- shinychat
// echoes the typed text client-side before the server ever sees the
// turn, so the chips can only follow as a second append -- and two
// right-aligned boxes for one send read as two messages. Fold each row
// into the user bubble directly above it; the marker keeps a repeat
// pass from hopping a merged row into an even earlier bubble.
function novaMergeAttachRows() {
  document
    .querySelectorAll(".shiny-chat-user-message .nova-attach-row")
    .forEach((row) => {
      // A class, not a data-* marker: the dataset contract test pins
      // every dataset name to a card-rendered attribute, and this one
      // is purely JS-internal.
      if (row.classList.contains("nova-merged")) return;
      const msg = row.closest(".shiny-chat-user-message");
      // Walk back past anything that is not a message. The typing dots
      // are appended as the LAST child of the message list, so on the
      // pass where the chip row lands they sit BETWEEN the two user
      // bubbles -- and reading previousElementSibling alone found the
      // dots, bailed, and left the chips as their own grey bubble.
      // Both message classes must be named here: shinychat assigns them
      // from a ternary, so a user message never carries
      // .shiny-chat-message and a walk that tests only that class skips
      // every user bubble and merges nothing, ever.
      let prev = msg && msg.previousElementSibling;
      while (prev && !novaIsMessage(prev)) {
        prev = prev.previousElementSibling;
      }
      if (!prev || !prev.classList.contains("shiny-chat-user-message")) {
        return;
      }
      row.classList.add("nova-merged");
      const content =
        prev.querySelector(NOVA_SEL.messageContent) || prev;
      content.appendChild(row);
      // The emptied message stays IN shinychat's tree, hidden. Removing
      // it desynced the renderer's child bookkeeping: the next
      // chat_clear (+ New Conversation, /clear) threw NotFoundError on
      // every tracked-but-gone node and destroyed the whole component
      // -- blank pane, no composer, dead app (hit live on a restored
      // conversation with attachment rows). The blank-message pass
      // keeps the class on since the content is now empty.
      msg.classList.add("nova-msg-blank");
    });
}

// Shiny's reconnect notification offers "Try now", which calls
// Shiny.shinyapp.reconnect() -- that can only succeed while the R
// process is still alive. When the container itself goes, the session is
// gone and no number of retries will ever land, so the user is left
// watching a countdown with no way out. A reload is the escape hatch for
// exactly that case, and it rides ALONGSIDE the reconnect attempt rather
// than replacing it: a proxy blip should still self-heal without anyone
// losing their transcript.
function novaAddReloadLink() {
  const msg = document.querySelector("#shiny-reconnect-text");
  if (!msg) return;
  // Into the row that already holds "Try now", found through that link
  // rather than by naming Shiny's action-row class: the two controls
  // belong on one line, and appending to the notification box instead
  // put Reload on a block row of its own below it.
  const now = document.querySelector("#shiny-reconnect-now");
  const box = now ? now.parentElement : msg.closest(".shiny-notification");
  if (!box || box.querySelector(".nova-reload-link")) return;
  const link = document.createElement("a");
  link.className = "nova-reload-link";
  link.href = "#";
  link.textContent = "Reload";
  link.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.reload();
  });
  box.appendChild(link);
}

function novaResync() {
  initComposerShell();
  initComposerMenus();
  initDrawer();
  novaAdoptCancel();
  novaBindClearHandler();
  novaMergeAttachRows();
  novaSyncRunningPills();
  novaSyncElapsed();
  novaFoldTools();
  novaStampCodeLang();
  novaSyncBlankMessages();
  novaGroupActivity();
  novaSetStreamingState();
  novaSyncEmptyState();
  novaAddReloadLink();
}

let novaResyncQueued = false;
function novaQueueResync() {
  if (novaResyncQueued) return;
  novaResyncQueued = true;
  const run = () => {
    novaResyncQueued = false;
    novaResync();
  };
  // requestAnimationFrame does NOT fire while the document is hidden --
  // a background browser tab, or the RStudio Viewer switched to another
  // pane. Coalescing on rAF alone stalled the WHOLE pipeline there:
  // nothing folded, the streaming state froze, and a nova that loaded
  // while hidden came up with no composer at all, because
  // initComposerShell() runs inside this same pass. setTimeout still
  // coalesces (the queued flag does that), it just also runs.
  if (document.hidden) {
    setTimeout(run, 0);
  } else {
    requestAnimationFrame(run);
  }
}

// Catch up the moment the pane comes back: while hidden, rAF-paced work
// elsewhere may have left the transcript mid-sync.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) novaQueueResync();
});

new MutationObserver((mutations) => {
  for (const m of mutations) {
    // Removals matter too: shinychat REMOVING its cancel button is the
    // end-of-stream signal novaSetStreamingState() keys off.
    if (m.addedNodes.length > 0 || m.removedNodes.length > 0) {
      novaQueueResync();
      return;
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true });

// First pass runs synchronously: the composer shell must exist before
// the user can interact, without waiting on a frame.
novaResync();

// Contract self-check, deliberately NOT a version check.
//
// nova borrows selectors from shinychat's private DOM, so an upstream
// rename can break the composer while every R test stays green. Gating
// on a version NUMBER would be the wrong instrument: it fires on
// upgrades that are perfectly fine and discourages taking them, and it
// stays silent if the same version is served a different way. What
// actually matters is whether the elements resolved -- so check that.
//
// Fires once, only when the composer genuinely failed to build, and
// names the selector to look at.
//
// It reports in the PAGE as well as the console. nova runs in RStudio's
// Viewer, which shows no console at all, so a console-only report meant
// an outdated shinychat presented as "the UI is just wrong, with no hero
// and no composer pill" -- a diagnosable version mismatch that instead
// cost a debugging session. The note says which selector failed and what
// to do about it, on screen, where the person looking at the broken app
// is already looking.
setTimeout(() => {
  if (novaShell) return;
  const container = document.querySelector(NOVA_SEL.container);
  const failed = !container
    ? NOVA_SEL.container
    : !container.querySelector(NOVA_SEL.input)
      ? NOVA_SEL.input
      : null;
  if (!failed) return;
  console.error(
    "[nova] composer not built: no element matched '" +
      failed +
      "'. shinychat's DOM has probably changed. Update NOVA_SEL at the top " +
      "of nova.js and the shiny-chat-* rules in nova.css."
  );
  const main = document.querySelector(".nova-main");
  if (!main || main.querySelector(".nova-selfcheck-note")) return;
  const note = document.createElement("div");
  // The same top-edge note the model fallback uses -- one style for
  // "something about this launch is not what you asked for".
  note.className = "nova-fallback-note nova-selfcheck-note";
  // textContent, never an HTML string: the failed selector is
  // interpolated in, and nova never builds markup by string.
  note.textContent =
    "nova's composer could not be built: no element matched '" +
    failed +
    "'. The installed shinychat is probably too old for this version of " +
    "nova — update shinychat, restart R, and relaunch.";
  main.insertBefore(note, main.firstChild);
}, 4000);
