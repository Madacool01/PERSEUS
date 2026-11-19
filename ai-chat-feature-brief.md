# AI Chatbot in PERSEUS — Design Brief

**Status:** Design discussion only. No code written, nothing committed.
**Date:** 2026-11-17
**Scope:** An in-app AI chat that already knows the user's exercises, programs/cycles, sessions and history, runs on Groq Cloud, and uses an explicit "attach" affordance to hand context to the model.

---

## 1. The idea

Today the AI in PERSEUS is a **reasoning engine behind a fixed workflow**: a session finishes, `buildAIPayload()` assembles plan + performed sets + check-ins + rule candidates, the model replies with JSON changes, and the app renders them for accept/reject.

The goal now is a **conversational surface** on top of the same data: the user asks a free-form question ("why has my pull-up stalled for three weeks?", "what should I change if I only have 40 minutes on Thursday?") and the model answers with the user's own training in view — without the user copy-pasting anything.

The open questions were:

1. Is real chat even possible over Groq, given the app sends **one request per message** and the model retains nothing between messages?
2. Groq's per-prompt token limits are small on many models — how do we avoid blowing them?
3. How does "attach" work as a UI and as data?

---

## 2. Decisions made in this session

| # | Question | Decision |
|---|---|---|
| 1 | Chat as its own tab, or an "ask about this" entry point inside Coach / History / Library? | **A button** (contextual entry point), not a new nav tab. |
| 2 | May the AI ever change the plan, or only advise? | **Advice only.** Chat never mutates plan, sessions or suggestions. Existing workflows keep that power. |
| 3 | If the Groq call fails (rate limit, key, network), may chat fall back to rules-only text? | **No fallback.** Show a clear error message and stop. |

Model rate limits, confirmed by the user from GroqCloud for `openai/gpt-oss-120b`:

| Limit | Value |
|---|---|
| Requests per minute (RPM) | 30 |
| Requests per day (RPD) | 1,000 |
| Tokens per minute (TPM) | 8,000 |
| Tokens per day (TPD) | 200,000 |

---

## 3. What already exists (the ground we build on)

All in `index.html`:

- **Transport:** `GROQ_ENDPOINT` = `https://api.groq.com/openai/v1/chat/completions`, called straight from the browser with the user's key from `state.profile.apiKey`. No backend, no CORS problem.
- **Model choice:** `GROQ_MODEL = "openai/gpt-oss-20b"`, overridden by the model picked in Settings (`state.profile.aiModel`) and validated against the `AI_MODELS` catalogue (`openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `qwen/qwen3.6-27b`, `groq/compound`, `groq/compound-mini`).
- **Shared JSON call:** `groqJson(system, user, temperature)` — one system message, one user message, `response_format: {type:"json_object"}`, `JSON.parse` of the reply. Used by `callGroq()` (session coaching), the load-factor estimator, and `callGroqWorkout()` (workout maker).
- **Prompt that encodes the domain rules:** `systemPrompt()` / `SYSTEM_PROMPT` + `CHECKIN_PROMPT` — rep zones from Settings, readiness vs feedback semantics, set types, supersets, per-set notes, pain handling.
- **Payload precedent:** `buildAIPayload({session, day, entries, base})` is exactly a "compile the state for this workflow" function.
- **Compact-payload precedent (most important):** the "Coaching a friend" feature. `coachBuildAthletePayload()` serialises the whole athlete into short keys (`n/m/wa/ps/s/rp/sr/ti/st/w/sw/ty`) with caps (`COACH_MAX_ROUTINES = 20`, `COACH_MAX_HISTORY = 24`, `SHARE_MAX_EXERCISES`). It is already doing token-budgeted compaction in this codebase — the chat should copy that shape, not invent one.
- **Overlay pattern:** `#builder-host`, `#coaching-host`, `#api-guide-host` — full-screen hosts rendered outside the view system. A chat panel can mount the same way, which is exactly why "a button" (decision 1) is cheap: no new `VIEW_IDS` entry, no routing, no nav changes.
- **Notes outside `state`:** programs/cycles live in their own `PROG_KEY` store (`progSavedList()`, `progSlotLive()`, 7-slot week). Attaching a program therefore means reading a different store than `buildAIPayload` reads today.

---

## 4. Question 1: is real chat possible?

**Yes.** Groq is stateless per request, but that is not a limitation — it is how every chat API works. The client owns the transcript: each turn sends the full `messages: [{role:"system"}, …, {role:"user"}, {role:"assistant"}, …]` array again. The user's message is retained because the app resends it, not because the model remembers it.

Practical consequences:

- **The transcript is app state**, not model state: it must be held in memory/localStorage alongside the panel, keyed per conversation. Since `state` can contain base64 exercise images, store **ids and text only** in the transcript, never the resolved attach payload.
- **Chat must not reuse `groqJson`.** That helper forces `response_format: {type:"json_object"}` and returns parsed JSON. Chat needs prose, so it needs a sibling function that streams plain text (`stream: true`, SSE over `fetch` + `ReadableStream` — `EventSource` cannot POST a body).
- **Cost grows quadratically with turn count** if you naively resend everything: turn *n* re-sends turns 1…*n*. That is the real reason trimming/digest matters, more than any single prompt being too big.

---

## 5. Question 2: the token limits, and what 8K TPM actually means

Three different limits get conflated. They fail differently and need different handling:

1. **Context window** — one request's system + messages + completion must fit. Exceeding it is a hard 400, not a throttle.
2. **TPM / TPD (token throughput)** — a moving budget over the last minute / the last day. Exceeding it is a 429 with a short retry for TPM, or a day-long stall for TPD.
3. **Quadratic resend** — not a limit at all; a design tax that consumes limits 1 and 2 faster than they need to be.

### Budget arithmetic for `openai/gpt-oss-120b`

| Question | Answer |
|---|---|
| Tokens per request if you used the whole request allowance | 200,000 TPD ÷ 1,000 RPD = **200 tokens** |
| Tokens per request if you used the whole per-minute allowance | 8,000 TPM ÷ 30 RPM = **~267 tokens** |
| So which limit binds? | **Tokens, not requests.** The daily budget is ~40 turns at 5K tokens each, or ~66 turns at 3K each. |
| One big paste | 8K TPM caps a single turn's prompt+completion at roughly **8K tokens**, i.e. a hard per-turn ceiling well below the model's context window. |
| Fast back-and-forth | Two 4.5K-token turns within one minute already exceed TPM → 429s that clear in ~60s, not a real block. |

So the design target should be a **per-turn budget of roughly 2,000–3,000 tokens** (prompt + completion), which leaves room in both budgets and keeps a session comfortably under the daily cap.

**Also note the shared budget:** session coaching, the load-factor estimator and the workout maker spend from the same 200K TPD. Chat is not free capacity; it is a competing consumer, and a chat that turns an exhausted daily budget into "coach is broken" is a real product risk.

**Numbers deliberately not hardcoded:** token/context numbers belong in a `contextWindow` / `tokensPerMinute` field on each `AI_MODELS` entry so chat can adapt per model instead of assuming the 120b figures. The limits above are confirmed only for `openai/gpt-oss-120b`; the others were not looked up (no web access this session) and should be filled in before shipping the model-aware budget.

---

## 6. The design

### 6.1 Entry point: a button

An **"Ask about this"** button, placed where the context already exists:

- Coach view → the current suggestion/session
- History → an open session
- Library → an exercise
- optionally Home → a general question with no attachment

Clicking opens an overlay chat panel (same host pattern as `#builder-host`) pre-seeded with that context as an attachment chip. No new tab, no new route, nothing to explain to a user who never opens it, and the existing workflows stay untouched (which pairs naturally with decision 2: advice only).

### 6.2 Attach = a deterministic compile step, not a screenshot of state

The core architectural idea: **attaching is a function call, not a serialisation.**

- One small compiler per attachable entity: `attach.session(id)`, `attach.exercise(id)`, `attach.day(id)`, `attach.program(id)`, `attach.history(range)`, `attach.profile()`.
- Each returns a compact, capped object in the style `coachBuildAthletePayload()` already uses: short keys, no base64, no derived values the model can compute itself.
- **Attachments are stored as ids + a label**, resolved at send time. Attach a session on Monday, look at it Wednesday, and the payload is Wednesday's data — and a deleted entity degrades to a visible "no longer available" chip instead of a stale blob.
- Each compiler reports its own estimated size, so the panel can show a live budget bar and refuse/warn before the request is made.

### 6.3 UI affordances that come with that model

- **Chips** above the composer showing what is attached (and their token estimate).
- **A context preview drawer** — the exact JSON that will be sent. This is the honesty feature: the user can see the model knows what it claims to know, and it doubles as the debugging tool.
- **A budget line** — `≈ 2,400 / 8,000 tokens this minute`, plus a session total. Client-side estimate is enough: `Math.round(JSON.stringify(payload).length / 4)`.

### 6.4 Pre-digging in JS (cut tokens, improve grounding)

"Signals" the app can compute exactly should be computed in JavaScript and handed to the model as facts, not left for the model to infer from raw sets:

- plateau / stall detection per exercise (last N sessions, no rep or load progress)
- volume per muscle group per week vs the user's rep-zone settings
- PRs and deltas (weight, reps, hold time)
- adherence (sessions completed vs planned, days since last session)
- readiness/fatigue trend direction

This is the same rules-first/ AI-narrates split the project brief already commits to (§14 of `adaptive-strength-coach-project-brief.md`). It is cheaper *and* more trustworthy: a model that is told "pull-ups: 3 sessions at 8/8/7 reps, no load change, 11 days" argues about the plateau instead of miscounting it.

### 6.5 Not sending `SYSTEM_PROMPT`

The existing system prompt is a JSON contract ("return only JSON in this exact shape") with rep-zone rules. Chat needs a **separate, much shorter chat system prompt**: who the coach is, that it is advice-only, that it must say when the attached data does not answer the question, the pain/safety rule, and the rep zones from Settings. Keeping it short is both a budget decision and a quality decision — the JSON contract would actively hurt prose answers.

### 6.6 Streaming and rendering

- `fetch` with `stream: true`, read the body via `ReadableStream`, split SSE `data:` frames, append deltas.
- Render as **text with `esc()`**, not `innerHTML`. There is no markdown renderer in the app, and adding one is a separate decision; plain text with paragraph breaks is the honest v2.
- Streaming also fixes the perceived-latency problem on slower models, which matters because the alternative (a spinner for 8 seconds) is what makes users retry — and retries are what burns TPM.

### 6.7 Multi-turn strategy (the actual answer to "no memory")

Three layers, in order of how much they save:

1. **Last-N transcript** — keep the last ~6–8 turns verbatim, drop the rest. Most chat is locally coherent.
2. **Rolling digest** — when turns are dropped, fold them into a 2–3 sentence "what we've established" line prepended to the system message. Without this the model contradicts itself after turn 9.
3. **Attachments compacted harder than the transcript** — the transcript is the user's words (cheap, and quality-critical); the attached data is the expensive part, so it gets the caps and the pre-dig.

Plus a **hard cap** per conversation (e.g. 20 turns) with a "start a new chat, keep the summary" action. This matches the app's existing style of explicit caps (`COACH_MAX_ROUTINES`, `COACH_MAX_HISTORY`) rather than open-ended growth.

### 6.8 Error policy (decision 3: no fallback)

Every failure path ends in a visible, specific message and no invented answer:

| Failure | Message intent |
|---|---|
| No API key | "Add your Groq API key in Settings to use chat." + button to Settings |
| 401/403 | key rejected/revoked — not a rate problem, say so |
| 429 TPM | "Rate limit: this model allows 8K tokens/minute. Try again in ~30s." |
| 429 RPD/TPD | "Daily token budget used up. Resets at …; session coaching may also be limited." |
| 413 / context too large | "Too much attached — remove an attachment." |
| Network / offline | plain "could not reach Groq" |

Two details worth keeping: parse Groq's error body for which limit tripped (so TPM and TPD are not both reported as "slow down"), and use `Retry-After` when present. Since there is no fallback, the message *is* the feature — a vague one turns a 30-second wait into a bug report.

---

## 7. Phased roadmap

**v1 — one-shot ask.** "Ask about this" button on a session/exercise. One attachment, no visible history, one request, no streaming, plain response + explicit retry. Reuses `groqJson`'s transport shape (minus JSON mode) and an `attach.*` compiler. Smallest thing that proves the value.

**v2 — real chat.** Transcript held client-side, last-N + digest, streaming, chips + context preview + token estimate, per-conversation turn cap, the error table above, and the model-aware budget fields.

**v3 — model-proposed actions (only if it ever earns it).** The model suggests a change in structured form, rendered as a normal card that goes through the *existing* accept/reject path. Decision 2 says chat itself stays advice-only; v3 would be a hand-off, not chat with write access.

---

## 8. Risks and non-goals

Risks:

- **Shared daily token budget.** A chat session can starve the coach's own calls. Needs a visible budget and an explicit "chat is the heavier feature" trade-off.
- **Statelessness illusions.** Without the digest, the model will confidently contradict itself. The digest is not polish.
- **Hallucinated history.** Attach chips + context preview are the mitigation: the user can see what the model was given.
- **Free-tier variance.** Limits differ per model; only the 120b numbers are confirmed.
- **Health-adjacent answers.** Chat has no accept/reject gate, so the safety rules must live in the chat system prompt (pain → conservative, no diagnosis) rather than in post-hoc review.

Non-goals for now: chat as a nav tab; chat writing to the plan; markdown rendering; server-side proxy; storing attachments (rather than ids) in the transcript; a general-purpose assistant that answers off-topic questions.

---

## 9. Open questions for tomorrow

1. **Chat model default** — keep following `state.profile.aiModel` (one setting for everything), or give chat its own default (e.g. the 20b model, whose limits were not confirmed but which is described in-app as cheapest)? A cheaper/faster default for chat protects the coach's budget.
2. **When is an attachment auto-added vs user-added?** The button implies "the thing you were looking at" is attached automatically. Is an *automatic second* attachment (e.g. the exercise's last 5 sessions) acceptable by default, or must every chip be deliberate?
3. **Where do transcripts live and do they persist?** In-memory only (privacy-simple, lost on refresh) vs `localStorage` (useful, but now training discussion is stored next to training data — and `state` is already near a size ceiling in some browsers).
4. **Does chat get a History access cap?** A "history" attachment is the one that can blow the budget by itself; decide the default range (last 8 sessions? 28 days?).
5. **Digest generation cost** — a digest turn is itself a request. Generate it lazily (once, when the first turn is dropped) or fold it into the next request's system message by asking the model to summarise cheaply at the end of each reply?
6. **v1 scope confirmation** — is one-shot "ask about this" worth shipping alone, or does the feature only feel real as chat (v2), making v1 a stepping stone rather than a release?

---

## 10. Pre-implementation answer sheet

Written 2026-11-19. Every item is an **answer proposed from the code**, not a new idea. Items marked **your call** need a yes/no from you before they can be treated as settled. Section 9's Q1-Q6 map onto D1-D6.

Two facts set the frame. First, the app's own default model is `openai/gpt-oss-20b` (`DEFAULT_PROFILE`, index.html L3573), while every confirmed limit in section 5 is for `openai/gpt-oss-120b`. Second, chat has no transport today: there is no `ReadableStream`, `stream: true` or SSE code anywhere in the 16,746-line `index.html`, and `groqJson` (L9214) is hard-wired to one system message, one user message and `response_format: {type:"json_object"}`.

### 10.1 Decisions only you can make

**D1. Which model does chat use?** (Q1) **your call**
Answer proposed: chat gets its own `state.profile.chatModel`, defaulting to `openai/gpt-oss-20b` and falling back to `GROQ_MODEL` the same way the coach does (L9189). The coach's calls are the ones that must never degrade, and a second picker is a copy of the existing one that saves at L12334. The open problem inside this answer is that the 20b limits are unverified, so the default would ship with unknown numbers.

**D2. Do transcripts persist?** (Q3) **your call**
Answer proposed: `localStorage` under a separate key `perseus-chat-v1`, the newest 5 conversations, 20 turns each, text plus ids only. Never inside `state`: `saveState()` stringifies the whole state and silently drops to memory when quota fails (L4250), so a growing chat must not be able to stop training data from saving. Two consequences to accept: chat is absent from the folder auto-backup (which writes `state`), and absent from share codes.

**D3. Automatic vs deliberate attachments?** (Q2) **your call**
Answer proposed: exactly one automatic attachment, the entity whose button was clicked. Everything else comes from an explicit "Add context" list. Home opens with none.

**D4. Default history range?** (Q4) **your call**
Answer proposed: last 8 sessions or 28 days, whichever is smaller, hard-capped at roughly 800 estimated tokens, with the range editable on the chip before sending.

**D5. How is the digest produced?** (Q5) **your call**
Answer proposed: lazily and once, at the moment the first turn is dropped, as a separate cheap call capped near 120 output tokens, stored on the conversation. Not per reply (doubles every turn) and not folded into the next ask (it makes the model summarise and answer at once, which is exactly where quality drops).

**D6. Is v1 shippable on its own?** (Q6) **your call**
Answer proposed: yes, but built on the `messages[]` transport rather than the two-message `groqJson` shape, so v2 adds streaming and history instead of replacing the call path.

### 10.2 Engineering problems, with proposed answers

**P1. There is no tokenizer and no per-model limits.** `AI_MODELS` (L9019) holds a label and prose only. Answer: add `ctx`, `tpm`, `tpd` to each entry; unknown values fall back to a conservative 8K TPM / 200K TPD; the budget bar always reads "about" and is calibrated from Groq's returned `usage` when the response provides it.

**P2. The per-turn ceiling is not the context window.** Answer: estimate prompt + system + attachments + transcript before sending and refuse past roughly 2.6K tokens, reserving about 700 for completion via `max_tokens`. That produces the intended "Too much attached - remove an attachment" message locally instead of a 413 from Groq. Estimation stays `Math.round(JSON.stringify(body).length / 4)`, which is close enough to be safe at these sizes.

**P3. Streaming is new code and must be test-stubbable.** Answer: one `groqStream(messages, opts)` beside `groqJson`, using `stream: true`, no `response_format`, and SSE frames parsed incrementally, since a frame can split across chunks. It must handle `[DONE]`, `data: {error}` mid-stream, and `AbortController` for a Stop button. Because the existing harnesses stub `fetch` and inspect the request body (for example `tests/_builder.js` checks `body.model`), the reader takes the response body as an argument so a test can feed three fragments and a terminator without a network.

**P4. Errors have to be classified, not generic.** Answer: read Groq's `error.code` / `error.type` to tell TPM from TPD, honour `Retry-After`, and render the message in the panel. `toast()` clears after 2.4s (L4603), which is far too short for "try again in 60s".

**P5. Attachment compilers do not exist.** `buildAIPayload` (L9153) is session-and-suggestion shaped, so each of `attach.session/exercise/program/history/profile` is new code. Rules: resolve at send time, store ids and labels only, strip base64 photos (exercise images live in `state.exercises`), degrade a deleted entity to a "no longer available" chip. `attach.program` must reconcile the `PROG_KEY` slot store with live days through `progSlotLive()` (L15043), so a slot that was saved and then edited attaches what the user sees now.

**P6. Chip label and payload can drift.** Answer: an attachment is `{kind, id, labelAtAttach}`; the label refreshes when the panel opens, the payload is always rebuilt at send time.

**P7. Chat cannot reuse `SYSTEM_PROMPT`.** Answer: a separate `CHAT_SYSTEM_PROMPT` of roughly 200 tokens covering coach identity, advice-only scope, "say so when the attached data does not answer this", the pain rule (conservative, no diagnosis), and the rep zones from `getRepZones()` (L3671). The JSON contract would actively damage prose answers and would spend the budget it is meant to protect.

**P8. Rendering.** `esc()` already exists (L4453). Answer: model output goes through it, paragraph breaks only, no markdown, never `innerHTML` with raw text.

**P9. Panel lifecycle should copy the builder, not the load estimator.** The builder uses a static host in markup with `:empty { display: none }`, a body overflow lock and an Escape handler (L9697-L9715); the load estimator appends a div to `body` instead. Answer: add `#chat-host` beside the other three hosts (L3515-L3519). Static hosts are also the only ones the test harness can query reliably.

**P10. The token budget is shared with three other features.** Answer: chat shows its own estimate, and on a TPD 429 it says the daily budget is gone and that session coaching may also be limited. No app-wide ledger in v1: it would add state, and a client-side ledger is still a guess.

**P11. Missing key and offline.** Answer: check `state.profile.apiKey` when the button is clicked, exactly as the load banner does (L5452), then render the existing `data-goto="settings"` jump. Offline is a plain "could not reach Groq" and nothing is queued.

**P12. Phone keyboard.** Answer: fixed-height panel driven by `visualViewport` resize so the composer is never under the keyboard, added to the phone-only CSS layer that already exists for the builder (L3229).

**P13. Focus and dismissal.** Answer: `aria-modal`, focus the composer on open, return focus to the button that opened it, Escape aborts an in-flight stream before it closes.

**P14. Off-topic questions.** Answer: one short decline and a redirect in the chat prompt. The non-goal in section 8 stands.

**P15. Two tabs.** Answer: chat storage is last-writer-wins, but every send re-reads the key before writing so a second tab cannot erase the first tab's conversation list.

### 10.3 Test requirements for `tests/_chat.js`

Same harness style as the other 40 files: stub `fetch`, inspect the body, assert on rendered text. Minimum set:

- the button opens the panel with exactly one chip, and that chip's compiled payload respects its cap;
- a deleted id renders "no longer available" rather than a stale payload;
- no key, 401, 429 TPM, 429 TPD and network failure each produce their own message, and none produces an answer;
- an oversized attachment is refused before `fetch` is called;
- the transcript trims at the cap and the digest appears exactly once;
- streamed fragments render in arrival order, and Stop aborts;
- `state.days`, `state.sessions` and `state.pending` are byte-identical before and after a conversation (advice-only proven by test, not by convention).

### 10.4 Blocking unknowns to resolve before the first line of code

1. **The 20b limits.** If D1 says chat defaults to the 20b model, its RPM/TPM/TPD must be read off GroqCloud first. Shipping 120b numbers against a 20b model produces wrong ceilings in both directions.
2. **Whether Groq's stream returns a `usage` block** when asked for it. If yes, the budget bar self-calibrates; if no, the estimator stays approximate and must say so.
3. **The mount points.** A pass over Coach, History and Library is needed to name the exact anchors for the four buttons. That is the only part of the design that is still a sketch rather than an answer.

Nothing else in v1 depends on information we do not already have. There is no second person involved, no deadline, and no dependency outside the Groq key already stored in Settings.

### 10.5 The list: every question and problem, one line each

The scan view of everything above. Answer the nine questions and the fifteen problems are mechanical; the order matters, because Q1 decides P1 and P2, and Q7 decides whether P1's numbers exist at all.

**Questions**

| ID | Question | Why it blocks |
|---|---|---|
| Q1 | Does chat follow `state.profile.aiModel`, or get its own `chatModel`? | Yes, decides the default and every ceiling |
| Q2 | Is one attachment automatic (the thing clicked), or must every chip be deliberate? | Yes, decides the button contract |
| Q3 | Do transcripts persist in `localStorage`, or live only in memory? | Yes, decides the storage layer |
| Q4 | What is the default history range for a history attachment? | Yes, decides the largest attachment |
| Q5 | Is the digest generated lazily, per reply, or folded into the next ask? | Yes, decides the turn cost model |
| Q6 | Is v1 (one-shot ask) worth shipping alone, or does it need v2 (real chat)? | Yes, decides the build order |
| Q7 | What are the real RPM / TPM / TPD numbers for the chosen chat model? | Numbers, not design: the budget bar cannot be truthful without them |
| Q8 | Does Groq return a `usage` block on a streamed reply? | Affects whether the estimate self-calibrates |
| Q9 | Where exactly do the buttons mount in Coach, History and Library? | The only part of the design still a sketch |

**Problems**

| ID | Problem | Answer already proposed |
|---|---|---|
| P1 | There is no tokenizer and `AI_MODELS` carries no context or rate limits | P1 in 10.2: add `ctx`/`tpm`/`tpd`, conservative fallback, estimate from `usage` |
| P2 | A context window and a per-minute token cap are different failures | P2: refuse locally past ~2.6K estimated, reserve ~700 with `max_tokens` |
| P3 | Streaming is entirely new code, and tests must still be able to stub it | P3: `groqStream` beside `groqJson`, incremental SSE, abort, body injected for tests |
| P4 | A generic "Groq 429" message cannot tell a 60s wait from an exhausted day | P4: classify `error.code`, honour `Retry-After`, render in-panel |
| P5 | No `attach.*` compiler exists, and a program reads a different store than a session | P5: new compilers, ids resolved at send, `PROG_KEY` reconciled with `progSlotLive()` |
| P6 | A chip's label can disagree with the payload sent | P6: label refreshes on open, payload always rebuilt at send |
| P7 | `SYSTEM_PROMPT` is a JSON contract and would damage prose and the budget | P7: separate ~200-token `CHAT_SYSTEM_PROMPT` |
| P8 | Model output must never reach `innerHTML` | P8: `esc()` plus paragraph breaks, no markdown |
| P9 | Host lifecycle has two precedents and they disagree | P9: static `#chat-host`, fully emptied on close, like the builder |
| P10 | Chat spends from the same 200K TPD as the coach, estimator and workout maker | P10: own estimate, explicit TPD message, no ledger in v1 |
| P11 | Missing key and offline must not be a toast that vanishes in 2.4s | P11: key checked at click, Settings jump, plain offline message |
| P12 | The phone keyboard covers a fixed composer | P12: `visualViewport` resize in the existing phone layer |
| P13 | Overlay focus and Escape behaviour while a reply is streaming | P13: focus composer, restore focus, Escape aborts before closing |
| P14 | Nothing stops off-topic questions | P14: one-line decline and redirect in the chat prompt |
| P15 | Two tabs writing the transcript key | P15: re-read before write on every send |

## 11. One-line pitch

> An "ask about this" button that opens a chat which already knows the session, exercise or program you were looking at — advice only, explicit attachments, a visible token budget, and a straight "no" when Groq says no.

---

Commit summary: added `ai-chat-feature-brief.md` documenting today's AI-chat design discussion — the button entry point, advice-only scope, no-fallback error policy, and the 8K TPM / 200K TPD budget math from GroqCloud — with no code changes.
