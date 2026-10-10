# Golden slice B — Manual grading

> **Fixture, not content.** This slice attempts to break the IR by requiring a
> complete trace from product concept to evidence, and by requiring
> `manual grading ≠ result publication`.
>
> **Base revision:** `cbe33db1a7f241ba85aadbf21c4f6dea01133f03`. All repository
> refs are bound to it unless marked `HISTORICAL`/`external`.

**Required reader outcome** — after this slice, a reader must be able to answer,
without a second undocumented matrix:

1. *Can this grading action happen?*
2. *Under which permission, scope and runtime state?*
3. *What durable state changes?*
4. *What proves those facts?*

---

## 1. The trace

```text
capability:grading.manual
  → workflow:grading.manual.review            (capability → workflow)
  → operation:grading.grade-question          (workflow → operation, performs)
  → interface:http.POST./api/admin/attempts/:attemptId/grade-question   (exposes)
  → runtime guard chain (authz seam)
  → permission:grading.score.write            (requires_permission)
  → scope:exam.assignment                     (scoped_by; assignment_required = TRUE
                                               for non-Admin; resource anchor = attempt)
  → entity:grading.entry, entity:answer.frozen-submission  (writes/reads)
  → terminal projection: entity:attempt.terminal-score, entity:enrollment.final-score-projection
  → evidence (TEST_SEMANTIC / TEST_INTEGRATION / TEST_PHYSICAL where named)
```

Second, deliberately separate path:

```text
capability:result.publication
  → workflow:result.publish
  → operation:exam.publish-results
  → interface:http.POST./api/exams/:id/publish-results
  → permission:exam.result.publish
  → scope:course.assignment                   (scoped_by; assignment_required = TRUE
                                               for non-Admin; carrier = teacher_course_assignments;
                                               resource anchor = exam)
  → writes entity:exam.result-publication
```

`authority_requirement` keeps the **resource anchor** and the **assignment
carrier** as two fields (`ir-v0.1.md` §4.4 `ATLAS-IR-034b`), because they are not
the same thing here: the resolved resource is an *exam* while the assignment that
must exist is a *course* assignment. Fusing them into one node would make the
grader carrier look like the enforcement for result publication.

`depends_on`: `capability:result.publication --depends_on--> capability:grading.manual`
(product dependency: results cannot be published as visible until grading is
complete for manual attempts).

---

## 2. Logical IDs

| ID | Kind |
| --- | --- |
| `capability:grading.manual` | Capability |
| `capability:result.publication` | Capability |
| `workflow:grading.manual.review` | Workflow |
| `workflow:result.publish` | Workflow |
| `operation:grading.grade-question` | Operation |
| `operation:exam.publish-results` | Operation |
| `interface:http.POST./api/admin/attempts/:attemptId/grade-question` | Interface |
| `interface:http.POST./api/exams/:id/publish-results` | Interface |
| `permission:grading.score.write` | Permission |
| `permission:grading.queue.view`, `permission:grading.detail.view` | Permission |
| `permission:exam.result.publish` | Permission |
| `permission:grading.finalize`, `permission:grading.identity.view` | Permission (inert — §5) |
| `role:Grader`, `role:Admin`, `role:Teacher` | RolePreset |
| `scope:exam.assignment` | Scope (`assignment_carrier` = `grader_exam_assignments`; resource domain = exam) |
| `scope:course.assignment` | Scope (`assignment_carrier` = `teacher_course_assignments`; resource domain = course) |
| `entity:grading.entry` | DurableEntity (semantic: per-question grading entry; carrier: `attempt_grading_entries`) |
| `entity:answer.frozen-submission` | DurableEntity (semantic: answers frozen once at submit; carrier: `exam_attempts.submitted_answers`) |
| `entity:attempt.terminal-score` | DurableEntity (semantic: terminal attempt score; carrier: `exam_attempts.score/passed/grading_result/graded_at/grading_status`) |
| `entity:enrollment.final-score-projection` | DurableEntity (semantic: enrollment final selection; carrier: `enrollments.final_score/final_passed/final_attempt_id`) |
| `entity:exam.result-publication` | DurableEntity (semantic: results released for an exam; carrier: `exams.results_published_at`) |
| `policy:gradingEntry.status/pending_manual`, `policy:gradingEntry.status/completed_manual` | PolicyValue (STATE) |
| `policy:attempt.gradingStatus/pending_manual`, `policy:attempt.gradingStatus/auto_graded`, `policy:attempt.gradingStatus/fully_graded` | PolicyValue (STATE) |

---

## 3. Claims

### 3.1 Can this action happen?

| # | Claim | `claim_kind` | boundary | Axes | Authority owner | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| B-01 | A grader can complete a manual grading entry for a `text_response` question of a submitted attempt, reaching a durable terminal score | `CAPABILITY_SUPPORT` | `B4` | design `ACCEPTED`, implementation `PRESENT`, verification `PASS`, activation_support `SUPPORTED` | EXSEM-006/008/009 (`authority:exsem`) + `docs/architecture/exam-runtime.md` + `docs/architecture/authorization.md` | **SUPPORTED** |
| B-02 | The grading operation is reachable only through a resource-aware capability gate | `AUTHORIZATION_EFFECT` | `B3` | implementation `PRESENT`, verification `PASS` | `authority:exsem` (EXSEM-001) + `docs/architecture/authorization.md` | **SUPPORTED** |
| B-03 | `grading.queue.view` / `grading.detail.view` / `grading.score.write` are the capability keys gating the three grading surfaces | `DECLARED_METADATA` + `RUNTIME_OBSERVATION` | `B3` | implementation `PRESENT`, verification `PASS` | `docs/architecture/authorization.md`; the route registrations themselves (`gradingQueue.ts`) | **SUPPORTED** (registration and declared metadata agree; no second declaration exists to diverge from) |

### 3.2 Under which authority, scope and state?

| # | Claim | `claim_kind` | boundary | Axes | Authority owner | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| B-04 | Effective authority is `capability × assignment`: a non-Admin actor must hold an **active Grader→Exam assignment** to the attempt's exam, otherwise the request is denied as not-found | `AUTHORIZATION_EFFECT` | `B3` | implementation `PRESENT`, verification `PASS` | `docs/architecture/authorization.md:180-181` | **SUPPORTED** (`assignment_required = TRUE`) |
| B-05 | The scope's enforcement carrier is `grader_exam_assignments`, and the assignment gate fails closed (`503 AUTHZ_UNAVAILABLE`) rather than open on lookup failure or mis-declared route | `AUTHORIZATION_EFFECT` | `B3` | implementation `PRESENT`, verification `PASS` | `docs/architecture/authorization.md` + the seam itself | **SUPPORTED** |
| B-06 | Runtime state prerequisites: `attempt.status = submitted` **and** `attempt.gradingStatus = pending_manual` **and** the grading entry's own `status = pending_manual`; an auto-graded entry is rejected with a permission-class error | `DURABLE_EFFECT` / `AUTHORIZATION_EFFECT` | `B2`/`B3` | implementation `PRESENT`, verification `PASS` | EXSEM-006/008 | **SUPPORTED** |
| B-07 | The state transition is **one-way** (`pending_manual → completed_manual`); re-grading / score revision is not part of the protocol, including for the same value | `AUTHORITY_STATEMENT` + `DURABLE_EFFECT` | `B2` | design `REJECTED` for revision, implementation `PRESENT` (guards), verification `PASS` | EXSEM-009 ("当前没有终态重评能力"); `REGRADING_CURRENTLY_SUPPORTED = NO` | **NOT_SUPPORTED** for revision; transition itself `SUPPORTED` |
| B-08 | Graders are **not** globally authorized: the location of the restriction is the seam, not the preset | `AUTHORIZATION_EFFECT` | `B3` | verification `PASS` | `docs/architecture/authorization.md` | **SUPPORTED** |

### 3.3 What durable state changes?

| # | Claim | `claim_kind` | boundary | Axes | Authority owner | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| B-09 | On **submit** (not on grading), the same protected transaction freezes the accepted answers into `SubmittedAnswers`, flips the attempt to `submitted`, sets `gradingStatus` from the frozen question snapshot, and materializes the per-question grading workset | `DURABLE_EFFECT` | `B2` | implementation `PRESENT`, verification `PASS` | EXSEM-008 | **SUPPORTED** |
| B-10 | On **grading completion**, one transaction locks Enrollment→Attempt (canonical order), completes the manual entry via a **conditional UPDATE**, and — when it is the last outstanding entry — aggregates and writes the terminal attempt score plus the enrollment final projection | `DURABLE_EFFECT` | `B2` | implementation `PRESENT`, verification `PASS` | EXSEM-009/010 | **SUPPORTED** |
| B-11 | The terminal score projection is a **derived output and never a scoring input** | `AUTHORITY_STATEMENT` | `B5` | design `ACCEPTED` | EXSEM-010 | asserted by authority |
| B-12 | Partial credit is supported: the entry score is bounded `0 ≤ score ≤ maxScore` and `correct` is derived from `earnedScore >= maxScore` | `DURABLE_EFFECT` | `B2` | implementation `PRESENT`, verification `PASS` | `docs/architecture/exam-runtime.md` + engine | **SUPPORTED** |
| B-13 | Auto-finalization **cannot** close a `pending_manual` attempt; only manual completion owns the `submitted → graded` transition for manual attempts | `DURABLE_EFFECT` | `B2` | implementation `PRESENT`, verification `PASS` | EXSEM-009 | **SUPPORTED** |

### 3.4 `manual grading ≠ result publication`

| # | Claim | `claim_kind` | boundary | Axes | Authority owner | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| B-14 | Grading completion is **not** candidate result visibility. For `resultPublicationMode = manual`, results remain hidden until `exams.resultsPublishedAt != null`; and a `pending_manual` attempt is hidden regardless | `AUTHORITY_STATEMENT` + `RUNTIME_OBSERVATION` | `B5` + `B3` | implementation `PRESENT`, verification `PASS` | EXSEM-018 + the visibility authority (`packages/exam-engine/src/candidateResultVisibility.ts`) | **SUPPORTED** |
| B-15 | Publishing results is a separate capability, operation and permission (`exam.result.publish`), idempotent with a single winner under a row lock, and it does **not** itself advance grading | `CAPABILITY_SUPPORT` | `B4` | implementation `PRESENT`, verification `PASS`, activation_support `SUPPORTED` | EXSEM-018 | **SUPPORTED** |
| B-16 | Visibility is the **AND** of "publish done" (manual mode) and "result computable" (grading done) | `AUTHORITY_STATEMENT` | `B5` | — | EXSEM-018 (`docs/architecture/exam-semantic-boundaries.md:85`); the module that implements it is evidence, not the authority (its own docblock cites this rule) | asserted by authority |
| B-17 | An Admin-side view (`view === "all"`) bypasses the publication gate — a deliberate, documented branch, not a leak | `RUNTIME_OBSERVATION` | `B3` | implementation `PRESENT`, verification `PASS` | `docs/architecture/exam-runtime.md:734` (+ checklist `:1062`) and the visibility authority | **SUPPORTED** (documented bypass) |
| B-18 | `depends_on`: result publication depends on grading completion for manual attempts | `CAPABILITY_SUPPORT` (dependency) | `B4` | implementation `PRESENT`, verification `PASS` | derived from B-14/B-15 | **SUPPORTED** |

### 3.5 Permission-level claims (the F-16 rejection)

| # | Claim | `claim_kind` | boundary | Axes | Authority owner | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| B-19 | `grading.finalize` and `grading.identity.view` exist in the catalog and are granted to Admin, but **no HTTP route gates on them**; the catalog itself records this | `DECLARED_METADATA` | `B0` | implementation `PRESENT` (as reserved vocabulary), activation_support `NOT_SUPPORTED` | the catalog's own annotation (`packages/authz/src/catalog.ts:99-103`) | **inert → NOT_SUPPORTED as a gate** |
| B-20 | `grading.answer.view` exists and is granted to the Grader preset, but no production route consumes it | `DECLARED_METADATA` | `B0` | implementation `PRESENT` (declaration), activation_support `NOT_SUPPORTED` | catalog + `packages/authz/src/presets.ts:218-224` | **inert** (`inert = GRANTED_BUT_UNCONSUMED`, derived) |
| B-21 | **`permission key exists ⇒ an operation is gated by it` is false here** | `CAPABILITY_SUPPORT` (rejection) | — | `verification = INSUFFICIENT` for the proposition | — | **REJECTED** (F-16) |
| B-22 | Consequently the route layer does **not** separate "score write" authority from "finalize" authority: finalization is implicit in the grading command, not behind its own gate | `AUTHORIZATION_EFFECT` | `B3` | implementation `PRESENT`, verification `PASS` | `packages/authz/src/catalog.ts:99-103` + the grading route | **SUPPORTED** (as a limitation, recorded as residual) |

---

## 4. Supporting evidence (classified, with what each proves)

| Evidence | Kind | Strength | `proves` | `does_not_prove` |
| --- | --- | --- | --- | --- |
| `packages/exam-engine/src/manualGrading.ts:89` `gradeQuestion`; guards `:114-126`; auto-entry rejection `:140-144`; one-way guard `:150-157`; score bound `:160-162` | `STATIC_SOURCE` | `TOKEN_EXISTENCE` | The domain rules exist and are where the trace says | Reachability, persistence, authorization |
| `packages/domain/src/gradingEngine.ts:192-194` `requiresManualGrading`, `:213-217` `isManualGradedQuestion` — `type === "text_response"`, explicitly **not** `standardAnswer` | `STATIC_SOURCE` | `TOKEN_EXISTENCE` | The manual-mode discriminator is the question type in the frozen snapshot | That the frozen snapshot is consulted at submit |
| `packages/exam-engine/src/manualGradingHold.test.ts`, `manualGradingCompletion.test.ts`, `gradingWorkset.test.ts`, `gradingAggregation.test.ts`, `gradingScoreIdentity.test.ts`, `gradingPoison.test.ts`, `grading.test.ts`, `gradingEngine.test.ts` | `TEST_SEMANTIC` | `BEHAVIOURAL_PURE` | Domain invariants: hold/refusal, one-way completion, workset materialization/consistency, aggregation, identity/poison handling — with in-memory owners | HTTP surface, real persistence, authorization, concurrency |
| `apps/api/src/runtime/gradingArchitecture.structural.test.ts` | `TEST_SEMANTIC` (structural/source-scan) | `TOKEN_EXISTENCE` | The architectural placement rules the trace asserts (e.g. workset derived from frozen truth) | Behaviour of any kind |
| `packages/db/src/repository/attemptGradingEntryRepo.ts:173-204` `completeManualEntry` — conditional UPDATE with `grading_mode='manual' AND status='pending_manual'`, returning `null` on no-match | `STATIC_SOURCE` | `TOKEN_EXISTENCE` | Where the one-way transition is enforced: a SQL CAS-style predicate, not only an in-memory guard | That the predicate is exercised, that it wins any race, and any lock schedule — those belong to `gradingQueue.test.ts` and `gradingConcurrency.test.ts` respectively |
| `apps/api/src/routes/gradingQueue.test.ts` — queue behaviour; repeat/conflicting grade → 409 at `:1778` (retry), `:1812` (revise), `:1871`, `:1916` | `TEST_INTEGRATION` (real PostgreSQL) | `BEHAVIOURAL_COMPOSITION` | The HTTP+durable composition: duplicate/conflicting grading is refused at the wire and leaves no second effect | Physical lock contention (its own oracle) |
| `apps/api/src/routes/attempts/gradingConcurrency.test.ts` — two physical sessions, Enrollment `FOR UPDATE` blocking, observer evidence, no `Promise.all` raciness | `TEST_PHYSICAL` (real PostgreSQL) | `BEHAVIOURAL_PHYSICAL` | The lock order Enrollment→Attempt and the contended-block oracle | Product capability (that comes from the composition evidence) |
| `apps/api/src/routes/attempts/manualGradingClosure.test.ts` | `TEST_INTEGRATION` | `BEHAVIOURAL_COMPOSITION` | The closure writes the enrollment projection together with the terminal attempt score | Locking mechanism |
| `apps/api/src/routes/crashAtomicity.test.ts` (incl. manual terminalization rollback) | `TEST_INTEGRATION` | `BEHAVIOURAL_COMPOSITION` | Atomicity/rollback of the multi-fact grading closure | Lock contention |
| `apps/api/src/routes/resultPublishing.test.ts`, `candidateResultVisibility.test.ts` | `TEST_INTEGRATION` (real PostgreSQL) | `BEHAVIOURAL_COMPOSITION` | The publication gate and the visibility truth table | Grading itself; the lock schedule |
| `apps/api/src/routes/publishResults.concurrency.test.ts` | `TEST_INTEGRATION` (real PostgreSQL; two physical connections, distinct PIDs) | `BEHAVIOURAL_COMPOSITION` | The single-winner transition of `resultsPublishedAt`, the loser observing committed truth, and that the old code shape fails it | **Not** a deterministic row-lock blocking proof: the test's own header states the blocking overlap is "HIGHLY LIKELY … but not deterministically proven by this coordination alone" (`apps/api/src/routes/publishResults.concurrency.test.ts:20-25`). Classified `TEST_INTEGRATION`, not `TEST_PHYSICAL` |
| `apps/api/src/authz/permissionMatrix.grading.test.ts`, `apps/api/src/authz/graderExamMatrix.test.ts` | `TEST_INTEGRATION` (real PostgreSQL) | `BEHAVIOURAL_COMPOSITION` | The capability×assignment matrix for grading: who is allowed where | Physical locking |
| `apps/api/src/routes/graderAssignments.admin.test.ts`, `packages/db/src/repository/graderExamAssignmentRepo.test.ts`, `packages/db/src/migrations/0037-grader-exam-assignment.test.ts` | `TEST_INTEGRATION` / migration test | `BEHAVIOURAL_COMPOSITION` | The assignment carrier's durable semantics (active assignment, partial unique index) | Route-level enforcement |
| `apps/web/src/pages/admin/GradingQueuePage.test.tsx`, `GradingDetailPage.test.tsx` | `TEST_SEMANTIC` (component/jsdom) | `BEHAVIOURAL_PURE` | Admin UI projection behaviour | Anything server-side |
| `packages/exam-engine/src/candidateResultVisibility.ts:25-52` + `:70-101` | `CONTRACT`/`STATIC_SOURCE` | `OWNER_JUDGEMENT` | The authoritative separation of grading completion from result visibility, and the two-stage gate | That every candidate surface applies it (proven by the visibility tests) |
| `packages/exam-engine/src/examCommands.ts:530-556`, `:553-582` `publishResults` | `STATIC_SOURCE` | `TOKEN_EXISTENCE` | Publishing is a separate command, idempotent, single-winner, and explicitly does not advance grading | Route gating |
| `apps/api/src/authz/scopedCapability.ts:416-468` (grader assignment gate), `apps/api/src/plugins/authz.ts:120-131` (gate definition) + `:169-171` (wiring into the scoped-gate options), `docs/architecture/authorization.md:180-181` | `STATIC_SOURCE` + `CONTRACT` | `TOKEN_EXISTENCE` | The assignment dimension is real, and its definition and wiring points are named | That the gate is applied on **every** grading surface — that is what the matrix tests prove |
| `docs/architecture/exam-semantic-boundaries.md` EXSEM-006/008/009/010/018 (`:73-77`, `:85`) | `CONTRACT` | `OWNER_JUDGEMENT` | The frozen semantics of manual grading, freezing, one-way completion, terminal projection and the visibility door | Implementation |

### 4.1 Why these layers are not interchangeable

- `TEST_SEMANTIC` proves the domain rules; it cannot prove the wire or the
  database.
- `TEST_INTEGRATION` proves composition across durable boundaries; it does **not**
  prove physical lock behaviour.
- `TEST_PHYSICAL` proves the lock/contention mechanism; it does **not** prove the
  product capability.
- `TEST_SEMANTIC` (structural) proves architectural placement, not behaviour.
- Neither `CONTRACT` nor `STATIC_SOURCE` can show reachability.

`ATLAS-SEM-035` — no layer is called "stronger" without naming what it proves.

---

## 5. Challenging evidence

| # | Challenge | Evidence | Consequence |
| --- | --- | --- | --- |
| B-C1 | The browser layer no longer proves grading at all | `apps/e2e/e2e/manual-grading.spec.ts` (169 lines) was deleted in `dba53ada` (2026-10-05); `manual-grading-partial-recovery.spec.ts` (175 lines) in `b0e7a7ff`; `result-publishing.spec.ts` (286 lines) in `dba53ada` (verified via `git show --stat`) | B-01's browser layer is **absent by design** (the retention bar moved assertions to the API/component layers). Recorded as an explicit coverage boundary, not as an assumed browser proof |
| B-C2 | A current research document still cites the deleted E2E as evidence | `docs/research/product-semantics-audit-1-code-reality.md:149` still lists "E2E manual-grading*" for SC-12 | A **STALE** claim in a non-authoritative research document. Recorded once, as `B-K1` (`TEMPORAL_CONFLICT`); Atlas does not treat the research doc as authority, and does not silently accept or delete its statement |
| B-C3 | The Grading Queue JSDoc claims a write mode the domain forbids | `apps/api/src/routes/gradingQueue.ts:270` JSDoc "saves (or overwrites)" vs `packages/exam-engine/src/manualGrading.ts:150-157` one-way + the repeat/revise 409 assertions in `gradingQueue.test.ts:1778`, `:1812`, `:1871`, `:1916` | A production-comment mismatch (`#762` O-09 territory). It is **not** runtime authority (`ATLAS-SEM-033`, and `#757`'s O-09 input state). B-07 keeps the code/authority reading; the comment is recorded as a stale-comment hazard |
| B-C4 | Whether a manual grade can be *retried* idempotently | `manualGrading.ts:148-149`: the API carries no idempotency key, so payload equality is not accepted as a retry; the repeat returns a 409 state-transition error | B-07/B-06 hold; "idempotent retry" is **not** claimed. Recorded as a limitation with its own evidence rather than softened into "idempotent" |
| B-C5 | Route-level finalize/finalize-authority separation does not exist | `catalog.ts:99-103` records the inert grants; no route gates on them | B-19…B-22. A reader must not conclude that finalization has its own authorization gate |
| B-C6 | An assignment-less Grader is denied as **404**, not 403 | `scopedCapability.ts:462-466` (anti-enumeration fold) | The claim is stated precisely; the deny mapping is part of the `authority_requirement`, not a rendering detail |

`ATLAS-SEM-041` satisfied — and B-C1/B-C2/B-C3 each changed or sharpened a
recorded statement.

---

## 6. Source refs

Bound to `git_sha cbe33db1a7f241ba85aadbf21c4f6dea01133f03`;
`repo_freshness = CURRENT` for the R0 snapshot base.

| Ref | `source_kind` | Anchor |
| --- | --- | --- |
| `packages/exam-engine/src/manualGrading.ts` | `REPO_SYMBOL` | `gradeQuestion` `:89`; guards `:114-126`, `:140-144`, `:150-157`, `:160-162` |
| `packages/exam-engine/src/gradingWorkset.ts` | `REPO_SYMBOL` | `computeExpectedGradingEntries`, `materializeGradingWorkset`, `validateGradingWorksetConsistency`, `aggregateGradingEntries` |
| `packages/exam-engine/src/grading.ts` | `REPO_SYMBOL` | `finalizeTerminalGrading` `:212`; attempt write `:265-283`; enrollment write `:325-337`; auto path refusal `:378-386` |
| `packages/exam-engine/src/examCommands.ts` | `REPO_SYMBOL` | `publishResults` declaration `:553`, body to EOF `:582`; non-advancement note `:548-551` |
| `packages/exam-engine/src/candidateResultVisibility.ts` | `REPO_SYMBOL` | doc `:25-35`; gate `:70-101` |
| `packages/exam-engine/src/attemptCommands.ts` | `REPO_SYMBOL` | submit freeze `:609-632`; workset materialization `:637` |
| `packages/domain/src/gradingEngine.ts` | `REPO_SYMBOL` | `requiresManualGrading` `:192-194`; `isManualGradedQuestion` `:213-217` |
| `apps/api/src/routes/gradingQueue.ts` | `REPO_SYMBOL` | queue `:64-70`; details `:154-166`; grade-question `:280-292` |
| `apps/api/src/routes/exam.ts` | `REPO_SYMBOL` | `publish-results` `:1775-1786` |
| `apps/api/src/authz/scopedCapability.ts` | `REPO_SYMBOL` | grader gate `:416-468` |
| `apps/api/src/plugins/authz.ts` | `REPO_SYMBOL` | gate wiring `:120-131` |
| `packages/db/src/repository/attemptGradingEntryRepo.ts` | `REPO_SYMBOL` | `completeManualEntry` `:173-204` |
| `packages/db/src/schema/pg.ts` | `SCHEMA_OBJECT` | `attempt_grading_entries` `:953`; `submitted_answers` `:588-589`; `grader_exam_assignments` `:2231`; enrollment status CHECK `:531-537` |
| `packages/authz/src/catalog.ts` | `REPO_FILE` | grading permissions `:94-105` |
| `packages/authz/src/presets.ts` | `REPO_FILE` | `GRADER_PERMISSIONS` `:218-224` |
| `docs/architecture/authorization.md` | `REPO_SECTION` | `:180-181` (authority = capability × assignment) |
| `docs/architecture/exam-semantic-boundaries.md` | `REPO_SECTION` | EXSEM-006/008/009/010/018 `:73-77`, `:85` |
| `docs/architecture/exam-runtime.md` | `REPO_SECTION` | grading protocol + result-visibility matrix |
| `apps/e2e/e2e/manual-grading.spec.ts` (**deleted in `dba53ada`; intentionally unresolvable at R0_BASE — `resolution_state = HISTORICAL`, not `MISSING`**) | `GIT_COMMIT` | `dba53ada` deletion — `resolution_state = HISTORICAL`, `repo_freshness = STALE` (intentionally bound to that commit) |
| `docs/research/product-semantics-audit-1-code-reality.md:149` | `REPO_FILE` (non-authoritative research) | stale evidence citation (see B-C2) |

External refs (GitHub). Each carries the SREF-1 `external_revision` triple so that
external freshness is a separate dimension from the repo SHA
(`provenance-v0.1.md` §7.2):

```text
work:jnhu76/exam#296  external_revision { observed_state: CLOSED, observed_updated_at: 2026-08-28, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#286  external_revision { observed_state: CLOSED, observed_updated_at: 2026-08-28, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#324  external_revision { observed_state: CLOSED, observed_updated_at: 2026-08-25, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#542  external_revision { observed_state: CLOSED, observed_updated_at: 2026-09-14, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#613  external_revision { observed_state: CLOSED, observed_updated_at: 2026-09-25, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#302  external_revision { observed_state: CLOSED (state_reason: not_planned), observed_updated_at: 2026-08-27, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#718  external_revision { observed_state: CLOSED, observed_updated_at: 2026-10-06, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#763  external_revision { observed_state: OPEN, observed_updated_at: 2026-10-11, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
```

`observed_updated_at` above is the issue's close date (the last observed state
change), not the observation time; `observed_at` is when R0 read it. Every
external freshness is `UNKNOWN` because no re-check has been performed
(`ATLAS-SREF-032`).

---

## 7. Work items

Only work items with a **verified** reference from the traced code or from a
verified GitHub lookup are listed. No attribution is inferred from a title.

| ID | State | `closure_semantics` | Relation | How the relation was verified |
| --- | --- | --- | --- | --- |
| `work:jnhu76/exam#296` | CLOSED (2026-08-28) | `CLOSED_IMPLEMENTED` | Grader@Exam scoped authority and assignment flow — the assignment dimension of B-04/B-05 | Referenced 7× in the traced grading sources (`gradingQueue.ts:40`, `:92`, `:163`, `:289`), and the issue title/state read directly from GitHub |
| `work:jnhu76/exam#286` | CLOSED (2026-08-28) | `CLOSED_IMPLEMENTED` | Teacher@Course scoped authority — the `teacherAccess` dimension used by result publication (B-15) | Referenced in the scoped-capability seam; issue read directly |
| `work:jnhu76/exam#324` | CLOSED (2026-08-25) | `CLOSED_IMPLEMENTED` | Unify the candidate result-visibility projection; close manual-publish score leaks — the origin of B-14/B-16 | Referenced in the visibility/publish sources and tests; issue read directly |
| `work:jnhu76/exam#542` | CLOSED (2026-09-14) | `CLOSED_IMPLEMENTED` | Core persisted-state contract (DB CHECKs + phantom grading state) — the persistence backstop referenced by B-06/B-10 | Referenced in the grading persistence sources; issue read directly |
| `work:jnhu76/exam#613` | CLOSED (2026-09-25) | `CLOSED_IMPLEMENTED` | Sensitive audit-evidence and auth-context oracle gaps — related to the deny/observation rules | Referenced in the traced sources; issue read directly |
| `work:jnhu76/exam#302` | CLOSED (2026-08-27) | `CLOSED_SUPERSEDED` (not planned) | Generic final-answer submit barrier (ADR-008 Option D) — superseded mechanism; the current submit correctness is owned by the pre-submit flush plus the locked submit/freeze path used by B-09 | Issue state/`state_reason` read directly; as-built owner named in `#762` F-21 |
| `work:jnhu76/exam#718` | CLOSED (2026-10-06) | `CLOSED_IMPLEMENTED` | PostgreSQL proof-integrity audit — the source of the `pg_class` vocabulary used in §4 | Issue read directly; taxonomy quoted in `semantic-contract.md` §4.5 |
| `work:jnhu76/exam#763` | OPEN | `OPEN` | This R0 design work (not a product work item) | current issue |

`ATLAS-SEM-051` — `#286`/`#296`/`#324`/`#542` are `CLOSED_IMPLEMENTED` **for the
scope their own record names**; none of them is used as evidence that manual
grading is supported. That support claim (B-01) rests on the four conjuncts and
their own evidence, not on any closure.

`ATLAS-SEM-052` — the R0 author did **not** re-establish the closure reason of
every historically related item; anything not verified is omitted rather than
guessed. Named related work that R0 deliberately does **not** attribute:
predecessor grading work whose issue number is only referenced in historical
documents, and the research issues about test-evidence adequacy (they are
methodology, not grading ownership).

---

## 8. UNKNOWN

| ID | Unknown | Why | Not converted into |
| --- | --- | --- | --- |
| B-U1 | Whether every grading surface applies the assignment gate identically | The matrix tests cover the enumerated surfaces; no whole-surface completeness proof exists for grading specifically | **Not** "all surfaces are enforced" — the claim is scoped to the surfaces with named evidence |
| B-U2 | Whether a hand-written DB write could bypass the conditional UPDATE | Structural search shows no alternate writer; operationalSQL outside the application is not in scope (`#762` U-01) | left `UNKNOWN`, per `ATLAS-SEM-023` (open-ended absence) |
| B-U3 | Whether historical inconsistent rows (graded attempt with stale enrollment projection) exist in any deployment | The closure deliberately does not repair them; no data census was performed | left `UNKNOWN`; the authority text is quoted instead |
| B-U4 | Exact historical reason `#552` closed | Not re-established in R0 | `CLOSED_UNKNOWN` |

---

## 9. CONFLICT

| ID | Kind | Parties | Status |
| --- | --- | --- | --- |
| B-K1 | `TEMPORAL_CONFLICT` | `docs/research/product-semantics-audit-1-code-reality.md:149` cites deleted E2E as evidence ↔ the deletion commits and the current `apps/e2e/e2e/` contents | `UNRESOLVED` but *bounded*: the research doc is non-authoritative; recorded as a stale citation with its resolution owner (docs owner) |
| B-K2 | `DECLARED_VS_RUNTIME_DIVERGENCE` | `gradingQueue.ts` JSDoc "saves (or overwrites)" ↔ one-way domain rule + 409 assertions | `UNRESOLVED`; `open_governance_item.kind = WORK_ITEM` (`#762` O-09 follow-up). No winner chosen |
| B-K3 | `DECLARED_VS_RUNTIME_DIVERGENCE` | `grading.finalize` / `grading.identity.view` / `grading.answer.view` exist and are granted ↔ no route consumes them | `RESOLVED_BY_DERIVATION`: `inert = GRANTED_BUT_UNCONSUMED` is **derived** from the data, which is a legitimate resolution *within* Atlas's own representation (not an authority adjudication) |

---

## 10. RESIDUAL

```text
RESIDUAL = 3
  1. Finalize/identity/answer-view capability keys are inert:
     no route-level separation between "score write" and "finalize".
     activation_support = NOT_SUPPORTED; owner: product decision (#762 O-02/O-13 territory)
  2. No idempotency key on the grading command: a repeat is refused (409),
     so payload-equality retries are not accepted as retries.
     activation_support = NOT_SUPPORTED (by design); no owner recorded -> OWNER_UNRESOLVED
  3. Browser-level grading/result-publication evidence does not exist
     (deleted 2026-10-05 under the reversed E2E retention bar).
     verification = INSUFFICIENT for a browser-composition boundary;
     owner: docs/standards/testing.md §4.0 policy (deliberate), so NOT a gap to "fix"
```

---

## 11. Why the evidence is sufficient — or insufficient

- **B-01 (`SUPPORTED` at `B4`)** — conjunct (1) reachability: the route is
  registered with its guard chain (`gradingQueue.ts:280-292`), and the grading
  integration tests exercise it end to end. Conjunct (2) authority: EXSEM-006/008/
  009 state the semantics and are `CURRENT`. Conjunct (3) prerequisites: the
  submit-time freeze and workset materialization exist and are composition-tested;
  the entry's own state machine is enforced in SQL. Conjunct (4) evidence grade:
  the durable composition has `TEST_INTEGRATION` evidence, the lock mechanism has
  `TEST_PHYSICAL` evidence, and the domain rules have `TEST_SEMANTIC` evidence.
  Nothing rests on `TOKEN_EXISTENCE` alone.
- **B-15 (`SUPPORTED`)** — same structure, with the publication gate's own tests
  including a single-winner concurrency test.
- **B-19/B-20 (inert)** — these are claims at `B0` only, and the model **must not**
  raise them: existence plus preset membership is not consumption. The derived
  `inert` value is the model's answer, and `B-21` records the rejected inference.
- **B-07 revision (`NOT_SUPPORTED`)** — the absence of a revision path is
  established by the guard, the one-way SQL predicate, and the 409 assertions;
  the authority text independently denies it (`REGRADING_CURRENTLY_SUPPORTED = NO`).
  Two independent sources agree, so this is **not** an `UNKNOWN`.
- **Browser boundary** — deliberately `INSUFFICIENT`: the lower-layer evidence is
  adequate for the claimed boundaries, and no claim in this slice asserts a
  browser-only mechanism. Nothing is upgraded on the strength of a deleted spec.

---

## 12. Gate

```text
GOLDEN_MANUAL_GRADING = PASS
  LOGICAL_ID                     = defined (§1/§2)
  CAPABILITY_TO_EVIDENCE_TRACE   = complete (§1), endpoints named
  GRADING_NEQ_PUBLICATION        = explicit (B-14…B-18, two workflows and two permissions)
  CAN_ACTION_HAPPEN              = answered (B-01…B-03)
  UNDER_WHICH_AUTHORITY          = answered (B-04…B-08: permission × assignment × state × deny mapping)
  DURABLE_STATE_CHANGES          = answered (B-09…B-13, with the write seams named)
  WHAT_PROVES_IT                 = answered (§4, per-layer, each with does_not_prove)
  EVIDENCE_LAYERS_DISTINGUISHED  = YES (semantic / integration / physical / structural / contract)
  UNIT_TESTS_CALLED_STRONGER     = NO (none labelled stronger without naming the mechanism)
  F16_REJECTED                   = YES (B-19…B-22)
  FALSE_SUPPORTED_CLAIMS         = 0
  SLICE_SPECIFIC_SCHEMA_HACK     = 0
```
