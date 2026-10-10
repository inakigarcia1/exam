# Golden slice D — `timed_sync` / reserved-value negative control

> **This is the most important anti-false-support fixture.** It exists to make bad
> support inference fail, not to document a capability.
>
> **Base revision:** `cbe33db1a7f241ba85aadbf21c4f6dea01133f03`.

```text
REQUIRED
  representable / parseable            = TRUE
  storable / read-compatible           = TRUE
  activation writer                    = ABSENT (rejected at canonical seams)
  product activation                   = refused
  BUT
  Atlas activation_support             ≠ SUPPORTED

FORBIDDEN
  enum exists            ⇒ SUPPORTED
  schema accepts value   ⇒ SUPPORTED
  DB column exists       ⇒ SUPPORTED
  Issue CLOSED           ⇒ SUPPORTED
  a test of the kernel   ⇒ the capability is supported
```

---

## 1. The four independent dimensions for `timed_sync`

| Dimension | Value | Evidence (bound to `cbe33db1`) |
| --- | --- | --- |
| **Declared / representable** | `TRUE` | `packages/domain/src/enums.ts:199-205` — `TimingMode.TimedSync = "timed_sync"`; wire enum `packages/contracts/src/exam.ts:19-24` |
| **Storable** | `TRUE` | `packages/db/src/schema/pg.ts:286` — `timingMode: text("timing_mode").notNull()`; the companion durable T0 column `syncStartedAt` exists at `:304-307` (migration `packages/db/migrations/postgres/0041_phase_b_sync_started_at.sql`); no CHECK constrains per-mode legality (the authority owns it) |
| **Read / parse compatible** | `TRUE` | `packages/exam-engine/src/examPolicy.ts:54-66` copies `exam.timingMode` into the resolved policy without a mode filter; the response mapper emits it (`apps/api/src/routes/exam.ts:98`); the wire contract accepts it at shape level — and that acceptance is **asserted as intentional**: `packages/contracts/src/__tests__/contracts.test.ts:261-266` "CreateExamRequestSchema accepts timed_sync at shape level (canonical validator rejects)" |
| **Activation writer / operator trigger** | **`ABSENT`** | The only designated writer of `exam.syncStartedAt` ("written exactly once by the canonical sync-start command (B2 slice)") **does not exist**: a closed symbol search over `packages/` + `apps/` (`*.ts`, `*.sql`, excluding `dist/` and `node_modules`) for `syncStartedAt` / `sync_started_at` / `sync_start` / `startSync` returns only the schema column, the migration, the domain type, two pure readers (`packages/exam-engine/src/timer.ts:99`, `packages/exam-engine/src/attemptCommands.ts:261`, `:379`), one scanner branch, and tests. No command writes it |
| **Activation refusal — seam 1** | rejects at authoring | `packages/exam-engine/src/examPolicy.ts:305-307`: "timed_sync activation is decision-gated: reject it canonically …" → `invalid(["timingMode"], "timed_sync is not supported yet")`; conflict code `EXAM_TIMING_MODE_INVALID` (`packages/domain/src/examPolicy.ts:124`); used by create and draft-update (`apps/api/src/routes/exam.ts:795-819`, `:1120-1183`) |
| **Activation refusal — seam 2** | rejects at publish | `packages/exam-engine/src/examCommands.ts:169-171`: `if (exam.timingMode === "timed_sync") throw new ValidationError("timed_sync exams are not supported")` |
| **No autonomous open** | `TRUE` | `packages/exam-engine/src/examCommands.ts:488-495` — the status scanner does not auto-open a `timed_sync` exam; the operator trigger owns open. Asserted by `packages/exam-engine/src/examCommands.test.ts:981-998` |
| **Runtime kernel exists but is unreachable in production** | `PARTIAL` | `packages/exam-engine/src/timer.ts:94-110` `computeSyncDeadline`; attempt-start guards `packages/exam-engine/src/attemptCommands.ts:259-268`; the T0-anchored offset `:373-388`; both are unit-proven (`packages/exam-engine/src/deadlineKernel.sync.test.ts`; `attemptCommands.timingModes.test.ts:196-241`) — but no production path can produce a persisted/open `timed_sync` exam, so the kernel is not reachable through the product |

**Independent seams, one verdict.** Two canonical refusal seams plus a missing
writer are three separate facts; the model must not merge them into "not
supported" while also needing them separately for the lift condition.

---

## 2. Claims

| # | Claim | `claim_kind` | boundary | Axes | Authority owner | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| D-01a | `timed_sync` is **representable** in the domain enum and the wire contract, and **read-compatible**: the resolution and response paths carry the value without a mode filter | `IMPLEMENTATION_STATUS` | `B1` | implementation `PRESENT`, verification `PASS` | enums + contracts + policy resolver + response mapper | **TRUE at `B1`** |
| D-01b | `timed_sync` is **storable** in the schema-capacity sense (`ATLAS-IR-093`: a column exists that can hold it and no CHECK rejects it) | `IMPLEMENTATION_STATUS` | `B0` | implementation `PRESENT`, verification `PASS` | `exams.timing_mode` + the absence of a per-mode CHECK (per-mode legality is owned by the validator) | **TRUE at `B0` capacity only** |
| D-01c | A production path can **durably write** a `timed_sync` exam (a full `B2` write) | `DURABLE_EFFECT` | `B2` | implementation `ABSENT` (no writer for the T0 column; authoring and publish refuse), **verification `INSUFFICIENT`** | — | **FALSE / INSUFFICIENT at `B2`** |
| D-02 | Production activation of `timed_sync` is **refused** at two canonical seams, and no production writer ever establishes the operator T0 | `DURABLE_EFFECT` (negative) | `B2` | implementation `ABSENT` (writer), verification `PASS` | `EXSEM-019` + `RESERVED_VOCABULARY_POLICY` | **TRUE** |
| D-03 | The `timed_sync` clock semantics are **frozen design**, dated and adopted in-tree, and the contract is a *dormant design authority*, explicitly not a current implementation authorization | `AUTHORITY_STATEMENT` | `B5` | design `ACCEPTED`; **`authority_status = AMENDED`**, not `CURRENT`: the document's own header (`:11-16`) records that §1 was corrected on 2026-09-25 and that `exam-policy-authority.md` §4 is now the current admission/timing **support** authority, while this record remains the current authority for **semantics** (`ATLAS-SEM-120` amended relation) | `docs/contracts/timed-sync-semantics.md:3`, `:11-16`, `:23-27`; `docs/SPEC.md:287`, `:292` | asserted by authority |
| D-04 | The activation state is **`GATED`**: an activation decision is required, and the gate's lift condition is named | `CAPABILITY_SUPPORT` | `B4` | design `ACCEPTED`, implementation `PARTIAL`, verification `INSUFFICIENT`, activation_support **`GATED`**, freshness `CURRENT`, resolution `RESOLVED` | `docs/contracts/exam-policy-authority.md:135` ("**NOT ACTIVATED** (B2 product decision…)"), `:137` (LATENT definition) | **GATED — not SUPPORTED** |
| D-05 | The gate is owned by **no currently-open work item**: the phase issue that carried the freeze is CLOSED, and no OPEN issue claims the activation slice | `WORK_STATUS` + `open_governance_item` | — | `open_governance_item = { kind: DECISION_GATED, work_item: NONE_OPEN, lift_condition: "the explicit activation decision named by docs/SPEC.md:292" }` | `work:jnhu76/exam#291` (CLOSED 2026-09-04; `external_revision` below) + a **stated closed search**: `gh issue list --state open --limit 100` read in full on 2026-10-11 (33 open issues) — none mentions `timed_sync` activation; the only timing-related open item is the Controlled/Strict readiness umbrella, which does not claim it | **DECISION_GATED; not "planned"** |
| D-06 | What is missing for activation is **nameable**: the contract's own B1 slice is implemented (durable T0 column, `computeSyncDeadline`, the `timed_sync` start branch, the auto-open exemption) while the **B2 slice (synchronized lifecycle activation — canonical operator start command, admin trigger surface, authoring/publish activation, candidate waiting UX)** is not | `IMPLEMENTATION_STATUS` | `B2` | `implementation = PARTIAL`, missing constituent named from the contract's own slice plan | derived from D-02/D-03; `docs/contracts/timed-sync-semantics.md:260-277` | **PARTIAL with a named missing constituent** |
| D-07 | `Issue CLOSED ⇒ SUPPORTED` is false here: #291 is CLOSED and the capability is not supported | `CAPABILITY_SUPPORT` (rejection) | — | `verification = INSUFFICIENT` for the proposition | — | **REJECTED** (F-01) |
| D-08 | `enum exists ⇒ SUPPORTED` / `schema accepts ⇒ SUPPORTED` / `DB column exists ⇒ SUPPORTED` are false here | `CAPABILITY_SUPPORT` (rejection) | — | all three are `B0`/`B1` facts | — | **REJECTED** (F-02, F-03, F-04) |
| D-09 | `GATED` here does **not** mean "will work when opened": the implementation is `PARTIAL` and continues to be reported as such after any lift of the rejections | `IMPLEMENTATION_STATUS` | — | — | `ATLAS-SEM-071` | **recorded** |
| D-10 | Activating `timed_sync` requires an **explicit superseding decision**, and agents must not treat the missing pieces as an implementation defect to "complete" | `AUTHORITY_STATEMENT` | `B5` | design `ACCEPTED` | `docs/SPEC.md:292`; `docs/architecture/exam-semantic-boundaries.md` §6 | asserted by authority |

**The negative control passes:** `representable = TRUE` and
`storable/read-compatible = TRUE` while `activation_support = GATED`. No
schema-specific hack is involved — the verdict is produced by `PolicyValue`'s
separate `representable` / `storable` / `read_compatible` / `activation_status`
fields plus the four-conjunct support rule (`ATLAS-IR-040`, `ATLAS-SEM-080`).

---

## 3. Second example — reserved control flags (a genuinely different class)

Added because it exposes a **different** semantic class from `timed_sync`, not
for volume.

| Aspect | `timed_sync` | Enforcement-less control flags |
| --- | --- | --- |
| Values | `policy:exam.timingMode/timed_sync` | `policy:exam.controlFlags/detectTabSwitch`, `…/disableCopyPaste`, `…/restrictIp`, `…/requireLockdown` |
| Representable | `TRUE` | `TRUE` (`packages/contracts/src/exam.ts:60-71`) |
| Storable | `TRUE` (`exams.timing_mode`, `exams.sync_started_at`) | `TRUE` (`exams.control_flags` jsonb) |
| Read-compatible | `TRUE` | `TRUE` — historical rows carrying `true` remain readable |
| Activation refused | canonical validator + publish guard | canonical validator: `UNSUPPORTED_CONTROL_FLAGS` (`packages/exam-engine/src/examPolicy.ts:36-41`) rejected in `validateExamPolicy` (`:197-205`) with code `UNSUPPORTED_EXAM_CONTROL` |
| **Additional class difference** | the **runtime kernel exists** (deadline math + start guards), only activation and the T0 writer are missing → `implementation = PARTIAL` | **no enforcement implementation exists at all** ("**none**") → `implementation = ABSENT` for the enforced behaviour |
| Authority | `exam-policy-authority.md:135` NOT ACTIVATED | `exam-policy-authority.md:300-305` "**UNSUPPORTED FOR ACTIVATION** — canonical validator rejects `true`"; profiles echo it (`docs/contracts/exam-profile-templates.md:147-151`) |
| `activation_support` | `GATED` | `NOT_SUPPORTED` |

Why this is a different class and not a duplicate: for `timed_sync` the honest
answer is *"design frozen, kernel partly built, activation decision-gated"*; for
the flags it is *"vocabulary retained, zero enforcement, unsupported for
activation"*. A model that produced the same axis assignment for both would be
losing information — exactly what `ATLAS-SEM-072` forbids.

**Contrast within the same authority** (not a third fixture, recorded only):
`requireQueue`/`batchSize`/`batchInterval` and `shuffleQuestions`/`shuffleOptions`
are `SUPPORTED` in the same matrix rows, so the matrix is not uniformly negative —
the negative control is not an artifact of a pessimistic table.

---

## 4. Reserved values registered but deliberately not expanded into fixtures

The following reserved vocabulary is **registered** and deliberately **not**
built out as fixtures here, to avoid volume padding (`ATLAS-IR-050`,
"golden slices are falsification cases, not coverage"):

```text
policy:attempt.status/{not_started,queued,voided}     no writer (closed structural search)
policy:enrollment.status/blocked                       no writer; legal stored value by design
policy:answerVisibility/visible                        representable; only producer is a constant
policy:retakePolicy/*, policy:interruptionTimePolicy/* (as applicable)  governed by the same matrix
```

They share the third class — *representable, read-tolerant, producer absent or
constant* — and the model represents them with the **same fields**; expanding
each into a full fixture would add no falsification power. Two of them are used
as witnesses in [`../semantic-contract.md`](../semantic-contract.md) §14.2.

---

## 5. Authority owners

| Fact type | Owner | Source ref |
| --- | --- | --- |
| Exam policy support/activation matrix, and the LATENT definition | `docs/contracts/exam-policy-authority.md` (P7-M1) | `:135`, `:137`, `:300-305` |
| `timed_sync` clock semantics (frozen design) | `docs/contracts/timed-sync-semantics.md` (B0) | `:3`, `:23-27`, `:105-112`, `:302-307` |
| Representability ≠ support; reserved vocabulary cannot be implicitly activated | EXSEM-019 + the adjudication constants | `docs/architecture/exam-semantic-boundaries.md:86`, `:116-117`, `:156-163` |
| What the product currently promises (and the instruction not to "complete" the gap) | `docs/SPEC.md` | `:287`, `:292` |
| What the code does | production code + tests | `cbe33db1` |

`ATLAS-SEM-114` note: `docs/SPEC.md:292` and
`docs/contracts/timed-sync-semantics.md:23-27` agree, and
`timed-sync-semantics.md`'s own §1 is explicitly marked as a **point-in-time
baseline** superseded in part by `exam-policy-authority.md` §4 as the current
admission/timing support authority. There is therefore **no authority conflict**:
the design freeze is current for *semantics*, and the support matrix is current
for *activation status*. Both are recorded with their distinct fact types.

---

## 6. Supporting evidence

| Evidence | Kind | Strength | `proves` | `does_not_prove` |
| --- | --- | --- | --- | --- |
| `packages/domain/src/enums.ts:199-205`, `:214`; `packages/contracts/src/exam.ts:19-24`, `:31-35` | `STATIC_SOURCE` | `TOKEN_EXISTENCE` | The value is representable and authoring is type-excluded | Anything about activation |
| `packages/contracts/src/__tests__/contracts.test.ts:261-266` | `TEST_SEMANTIC` | `BEHAVIOURAL_PURE` | Shape-level acceptance is **intentional** — the wire contract is deliberately not the gate | That the saga's canonical validator accepts it |
| `packages/contracts/src/examProfile.test.ts:210-214` | `TEST_SEMANTIC` | `BEHAVIOURAL_PURE` | Profiles reject the value (a second authoring surface) | Exam create/update/publish |
| `packages/exam-engine/src/examPolicy.timingModes.test.ts` | `TEST_SEMANTIC` | `BEHAVIOURAL_PURE` | The canonical validator rejects regardless of the other fields | The HTTP path |
| `apps/api/src/routes/examPolicyValidation.test.ts:278-292` — `POST /api/exams` with `timingMode: "timed_sync"` → `400 VALIDATION_ERROR`, field code `EXAM_TIMING_MODE_INVALID` | `TEST_INTEGRATION` (real PostgreSQL) | `BEHAVIOURAL_COMPOSITION` | The refusal is **reachable over the real HTTP surface** and produces the canonical error envelope | The draft-update path (no API-level `timed_sync` update test exists — see §8) |
| `packages/exam-engine/src/examCommands.test.ts:439-449` | `TEST_SEMANTIC` | `BEHAVIOURAL_PURE` | Publish refuses a `timed_sync` draft (the second seam) | Reachability of publish for such a draft over HTTP (it cannot exist) |
| `packages/exam-engine/src/timer.ts:94-110` + `deadlineKernel.sync.test.ts` | `TEST_SEMANTIC` | `BEHAVIOURAL_PURE` | The deadline equations (T0 anchor, duration bound, `closeAt` cap, fail-closed without duration) | Activation |
| `packages/exam-engine/src/attemptCommands.timingModes.test.ts:196-241` | `TEST_SEMANTIC` | `BEHAVIOURAL_PURE` | The kernel behaves correctly **if** rows exist (shared deadline; pre-T0 start refused) — this is what makes "implementation = PARTIAL" precise rather than "absent" | That such rows are producible by the product |
| `packages/exam-engine/src/examCommands.test.ts:981-998` | `TEST_SEMANTIC` | `BEHAVIOURAL_PURE` | The scanner does not auto-open a `timed_sync` exam (the operator trigger owns open), and it still auto-closes an already-open one | That no other scanner path opens one; HTTP behaviour |
| Closed symbol search over `packages/` + `apps/` (`*.ts`, `*.sql`; `dist/`, `node_modules` excluded) for `syncStartedAt` / `sync_started_at` / `sync_start` / `startSync` | `STATIC_SOURCE` (absence, closed scope stated) | `TOKEN_EXISTENCE` | **No production writer of the T0 column exists** within that scope | Manual/operational SQL outside the repo (excluded and declared) |
| `apps/api/src/runtime/reserved-status-writers.structural.test.ts:91-127` | `TEST_SEMANTIC` (structural) | `TOKEN_EXISTENCE` | No `voidAttempt` symbol and no production assignment of the reserved attempt/enrollment statuses | `syncStartedAt` specifically (different mechanism — the closed search above covers it) |
| `packages/exam-engine/src/examPolicy.ts:36-41`, `:197-205`; `examPolicy.test.ts`; `apps/api/src/routes/examPolicyValidation.test.ts` (control-flag cases) | `TEST_SEMANTIC` + `TEST_INTEGRATION` | `BEHAVIOURAL_COMPOSITION` | The control-flag class: rejected at authoring, no coercion, historical rows readable | Any runtime enforcement (there is none) |
| `docs/SPEC.md:287`, `:292` | `CONTRACT` | `OWNER_JUDGEMENT` | The product's own statement that the value is reserved-and-unsupported, that the design contract is dormant, and that activation needs an explicit superseding decision | Implementation |

External refs (SREF-1 `external_revision` triple; external freshness is a
dimension separate from the repo SHA — `provenance-v0.1.md` §7.2):

```text
work:jnhu76/exam#291  external_revision { observed_state: CLOSED, observed_updated_at: 2026-09-04, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#292  external_revision { observed_state: CLOSED, observed_updated_at: 2026-09-14, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#295  external_revision { observed_state: OPEN,   observed_updated_at: 2026-10-11, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#293  external_revision { observed_state: OPEN,   observed_updated_at: 2026-10-11, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
```

`observed_updated_at` is the issue's own last observed state change, not the
observation time; every external freshness is `UNKNOWN` because no re-check was
performed.
| `docs/contracts/exam-policy-authority.md:135`, `:137`, `:300-305` | `CONTRACT` | `OWNER_JUDGEMENT` | The activation matrix, including `LATENT` and `UNSUPPORTED FOR ACTIVATION` | Implementation; the future direction of any reserved value |

---

## 7. Challenging evidence — the traps a careless reader falls into

These are **live hazards** at the base revision, and they are exactly what the
model must survive.

| # | Trap | Evidence (bound to `cbe33db1`) | What the model does about it |
| --- | --- | --- | --- |
| D-T1 | **The generated OpenAPI advertises `timed_sync` as an allowed request value** — the public API reference says you may create an exam with it | `apps/api/openapi.json`, `paths./api/exams.post.requestBody.content["application/json"].schema.properties.timingMode.enum` includes `"timed_sync"`; likewise `PATCH /api/exams/{id}`. No description or rejection note on either request schema. **Verified by parsing the document** | `representable = TRUE` + `activation_status = GATED` are separate fields. The OpenAPI fact is a `CONTRACT`-class fact about *shape*, not about acceptance; a consumer that reads the API reference alone will be wrong, and that is recorded as a hazard rather than papered over |
| D-T2 | **A production comment asserts a live command that does not exist** | `packages/db/src/schema/pg.ts:299-303`: "Written exactly once by the canonical sync-start command" (present tense); `packages/db/migrations/postgres/0041_phase_b_sync_started_at.sql:4-5`: "Written exactly once by the canonical sync-start command (B2 slice)" | Comments are **not** runtime authority (`ATLAS-SEM-033`; `#757` O-09 input state). The absent writer is established by a closed search, not by the comment's absence of a disclaimer |
| D-T3 | **A pure-function docblock describes the operator trigger as if it existed** | `packages/exam-engine/src/timer.ts:83-89`: "The decision-gated operator start persists T0 (`exam.syncStartedAt`)…" | Same rule. The `GATED` axis plus the named missing constituent (D-06) keep this honest |
| D-T4 | **The frozen contract reads like an implementation plan** | `docs/contracts/timed-sync-semantics.md:262-277` (B1/B2 plan) | The authority itself scopes this: §11 non-goals (`:302-307`) and `docs/SPEC.md:292` declare the plan to be design history, not authorization |
| D-T5 | **The spec contains a worked `timed_sync` example** | `docs/SPEC.md:295` | Mitigated in-source at `:287` and `:292` ("保留值，当前不受支持"), which the slice records as the operative statement. A one-line "example" is not a support claim, and `ATLAS-SEM-035` keeps it out of support inference |
| D-T6 | **The domain enum still carries the value**, and a DB CHECK in the same vocabulary family accepts reserved statuses | `packages/domain/src/enums.ts:199-205`; `packages/db/src/schema/pg.ts:531-537` (enrollment CHECK including `blocked`, with the explicit comment that it "stays a legal stored value by explicit design") | This is precisely F-02/F-04. `implementation = PRESENT` for representability is compatible with `activation_support = GATED` |
| D-T7 | **The UI is *not* a trap here** — and the model must not depend on that | `apps/web/src/components/exam/ExamConfigForm.tsx:24-25` (`AuthoringTimingMode = "timed_window" \| "deadline" \| "untimed"`) and `apps/web/src/components/exam/wizard/WizardPolicyFields.tsx:134-141` (three `SelectItem`s) offer only the three authoring modes | A missing UI control is **not** evidence of unsupportedness either: `UI absence ⇒ NOT_SUPPORTED` would be as wrong as `UI presence ⇒ SUPPORTED` (`ATLAS-SEM-060`). The verdict rests on the refusal seams and the absent writer, not on the form |
| D-T8 | **A consumer branches on the reserved value anyway** | `apps/web/src/exam/deriveTakeExamView.ts:73` maps `answerVisibility === "visible"` to `showAnswers`; the API test file only *mentions* the constant in a comment (`apps/api/src/routes/scores.test.ts:882-884`) | A read-side branch for a value the server can never emit. Kept as a **separate claim** about `answerVisibility`; it does not make `visible` supported, and it does not make the branch dead code that R0 may "clean up" |

`ATLAS-SEM-041` satisfied — eight falsification attempts against the negative
control, and the control held in every case without a special case.

---

## 8. UNKNOWN

| ID | Unknown | Why | Not converted into |
| --- | --- | --- | --- |
| D-U1 | Whether the draft-update (`PATCH`) route would reject `timed_sync` over HTTP | The validator is called at `apps/api/src/routes/exam.ts:1120-1183` and the publish gate independently rejects, but there is **no API-level `timed_sync` update test**; only the unit path and the create path have dedicated tests | left `UNKNOWN`; the refusal claim is bounded to the two seams and the create path that are proven |
| D-U2 | Whether any historical deployment row carries `timing_mode = 'timed_sync'` | No data census; hand-written SQL is out of scope | left `UNKNOWN`; the claim is about production paths, not about all possible rows |
| D-U3 | Whether a `timed_sync` row rejected by publish could still be opened by hand and reach the kernel | Explicitly out of scope (`EXSEM` §5 read-compatibility) | left `UNKNOWN`, **not** used to raise or lower the support verdict |
| D-U4 | Whether the `answerVisibility = visible` web branch is user-visible under any state | No producer can emit `visible`; the branch is unreachable from the API | left `UNKNOWN` for the UI effect; the API-side claim is proven |
| D-U5 | `external_freshness` of `#291`/`#292` since capture | External refs carry a capture-time revision | `UNKNOWN` |

---

## 9. CONFLICT

| ID | Kind | Parties | Status |
| --- | --- | --- | --- |
| D-K1 | `DECLARED_VS_RUNTIME_DIVERGENCE` | OpenAPI request schema advertises `timed_sync` as an allowed value ↔ the canonical validator refuses it | **UNRESOLVED**; owner: the policy/contract authority. That the breadth is **intentional** comes from the wire contract's own text (`packages/contracts/src/exam.ts:24-29` states that the value "remains in the wire enum" while the canonical validator rejects it and "Zod stays shape-level"; `:193` repeats "no duplicated enum gate here") — **not** from a test title, which would be exactly the `TOKEN_EXISTENCE`-grade inference `ATLAS-SEM-033` discounts. `contracts.test.ts:261-266` is cited as behavioural evidence of the shape only |
| D-K2 | `DECLARED_VS_RUNTIME_DIVERGENCE` | The T0 column's own comment/migration claim a "canonical sync-start command" ↔ no such command exists | **UNRESOLVED**; owner: the source owner (`#757` O-09 input state class). Recorded as a stale/misleading-comment hazard; no fix attempted in R0 |
| D-K3 | *(avoided)* `authority conflict` between the design freeze and the support matrix | `timed-sync-semantics.md` §1 is a point-in-time baseline; its own header (`:11-16`) declares `exam-policy-authority.md` §4 the current support authority, and `docs/SPEC.md:292` says the same | **RESOLVED_BY_SCOPE** — different fact types (semantics vs activation status), no adjudication needed. Recorded to show that "two documents about `timed_sync`" is not automatically a conflict |

---

## 10. RESIDUAL

```text
RESIDUAL = 3
  1. The canonical sync-start (T0) writer command does not exist.
     Blocking constituent for activation. owner: NONE_OPEN (see D-05);
     lift requires an explicit activation decision (docs/SPEC.md:292)
  2. Two active refusal seams (authoring validator + publish guard) must be
     lifted together before activation; lifting one alone is not sufficient.
     owner: same decision gate
  3. Four enforcement-less control flags remain UNSUPPORTED FOR ACTIVATION.
     owner: #295 decision gate for lockdown; the others have no enforce
     implementation at all. activation_support = NOT_SUPPORTED
```

---

## 11. Why the evidence is sufficient — or insufficient

- **D-04 (`GATED`) is adequately evidenced**: the refusing seams are located and
  quoted, the lift condition is named by the authority, and the missing
  constituent is identified by a closed search. All three elements required for a
  `GATED` claim (`ATLAS-SEM-071`) exist.
- **D-01 (`TRUE` at `B1`/`B2`) is adequately evidenced** by declared schema plus a
  test asserting that shape-level acceptance is intentional.
- **The support verdict is `INSUFFICIENT` by construction**: conjunct (1)
  "reachable production operation" fails — no production path can produce an open
  `timed_sync` exam — so `SUPPORTED` is unreachable regardless of how many kernel
  tests pass. This is the required negative control.
- **D-U1's `UNKNOWN` is not a weakness in the claim; it is the claim's boundary.**
  R0 asserts the two seams it verified over HTTP/unit evidence and refuses to
  generalize to the update path. Reporting the narrower truth is the correct
  outcome (`ATLAS-SEM-003`).
- **D-09 matters**: a reader must not conclude that opening the gate yields a
  working capability, because the implementation is `PARTIAL`. Both axes are
  carried.

---

## 12. Gate

```text
GOLDEN_NEGATIVE_CONTROL = PASS
  LOGICAL_ID                      = defined (§3 policy ids; §1 dimensions mapped to PolicyValue fields)
  PARSEABLE_TRUE                  = YES   (D-01)
  STORABLE_TRUE                   = YES   (D-01)
  READ_COMPATIBLE_TRUE            = YES   (D-01)
  ACTIVATION_WRITER_ABSENT        = YES   (closed-scope search, §1)
  ACTIVATION_REFUSED              = YES   (two canonical seams, §1)
  ATLAS_SUPPORT_NE_SUPPORTED      = YES   (D-04 = GATED)
  ENUM_EXISTS_IMPLIES_SUPPORTED   = REJECTED (D-08, F-02/F-03/F-04)
  ISSUE_CLOSED_IMPLIES_SUPPORTED  = REJECTED (D-07, F-01)
  TEST_EXISTS_IMPLIES_SUPPORTED   = REJECTED (kernel tests prove the kernel, not the capability)
  SLICE_SPECIFIC_SCHEMA_HACK      = 0
  BOUNDARY_ADEQUACY               = PASS  (D-01 split into representable / schema-capacity-storable / durably-writable; the B2 write claim is INSUFFICIENT, not asserted)
  CONFLICT_KINDS_OUTSIDE_CLOSED_SET = 0
  SECOND_EXAMPLE_CLASS_DISTINCT   = YES   (§3: implementation ABSENT vs PARTIAL)
  VOLUME_PADDING                  = NONE  (§4 registers the remaining reserved values without fixtures)
  TRAPS_FOUND                     = 8     (§7, all survived)
```
