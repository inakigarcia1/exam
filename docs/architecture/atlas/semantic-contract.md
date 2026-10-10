# Atlas semantic contract (R0-A)

> **Status:** R0 design artifact — **frozen semantic vocabulary** for the
> Architecture Atlas. Execution issue
> [#763](https://github.com/jnhu76/exam/issues/763); parent
> [#757](https://github.com/jnhu76/exam/issues/757).
>
> **This document is the single canonical R0 semantic contract.** The IR
> structure in [`ir-v0.1.md`](ir-v0.1.md), the provenance schema in
> [`provenance-v0.1.md`](provenance-v0.1.md), and all four golden slices consume
> it. No golden slice may define a private variant of anything defined here.
>
> **It is not an Exam authority.** For every Exam fact type, the authority is
> the one named in
> [`docs/README.md` § Authority by fact type](../../README.md#authority-by-fact-type).
> This document governs only *how Atlas represents and grades its own claims*.

Rule identifiers in this file are `ATLAS-SEM-nnn`. They are Atlas
representation rules, not product semantics; nothing here may be cited as a
requirement on Exam behaviour.

---

## 1. Purpose and exact scope

R0 must answer one question:

> **What may Atlas legitimately claim, and how does it represent uncertainty,
> conflict, evidence and provenance?**

R0 must **not** answer "how do we automatically extract the repository?" — that
is R1 ([#764](https://github.com/jnhu76/exam/issues/764)).

Two failure modes define this contract:

- **False support**: concluding that a product capability works because a token,
  column, route, test or closed issue exists.
- **False precision**: converting a genuinely unknown or conflicting state into
  a single tidy value.

`ATLAS-SEM-001` — A claim whose evidence is weaker than the boundary it asserts
is **invalid**, not merely "weak". It must be downgraded or reported as
`UNKNOWN`/`INSUFFICIENT`.

`ATLAS-SEM-002` — A conflict between two current authorities is a **reported
state**, never an Atlas decision. Atlas does not pick a winner, and does not
treat "newer", "more convenient" or "easier to render" as a resolution rule.

`ATLAS-SEM-003` — `UNKNOWN` is a correct and expected outcome. Zero `UNKNOWN` is
not a goal, and suppressing an `UNKNOWN` by guessing is a defect of the same
severity as a false `SUPPORTED`.

---

## 2. NormativeAuthority

### 2.1 Definition

A `NormativeAuthority` is **the source that owns a fact type** — the source that
decides what is *required*, *permitted* or *true* for that fact type.

Atlas does not invent authorities and does not use one global ranking. Authority
is resolved **by fact type**. The fact-type → owner table is maintained by
[`docs/README.md`](../../README.md#authority-by-fact-type); Atlas consumes it and
must not duplicate or extend it.

Authorities relevant to R0 (consumed, not redefined):

| Fact type | Authority (owner) |
| --- | --- |
| Cross-boundary Exam semantics | `docs/architecture/exam-semantic-boundaries.md` (EXSEM-001..020, adopted by ADR-021) |
| Data authority, freeze/transfer points | EXSEM §2/§4 + the mechanism ADRs they name |
| A specific architectural decision | the Accepted ADR for that decision |
| External behaviour / data format / frozen semantic support | `docs/contracts/`, generated OpenAPI, contract tests |
| Product invariants, domain model | `docs/SPEC.md` |
| Current implemented architecture | `docs/architecture/` + production code |
| Authorization facts (capability, preset, scope, assignment, enforcement) | `docs/architecture/authorization.md` + `packages/authz` + the runtime enforcement seam |
| Runtime route truth | the **actual Fastify registration/capture**, not a declaration about it |
| Exam policy support/activation semantics | `docs/contracts/exam-policy-authority.md` (P7-M1) |
| Per-value reservation/activation status | EXSEM-019 / EXSEM §5 + the canonical validator + the policy support matrix |
| Engineering/test-evidence policy | `docs/standards/testing.md`, `docs/standards/code-quality.md` |
| Test proof-strength classification | the taxonomy frozen by [#718](https://github.com/jnhu76/exam/issues/718) (see §4.4) |
| Phase boundaries | `docs/roadmap/phase-roadmap.md` |
| Work history, closure reason, decisions taken in review | the Git/Issue/PR record |
| Task scope / acceptance | the authorized OPEN Issue |

`ATLAS-SEM-010` — Evidence is **not** authority. An `Evidence` record (§4) never
becomes the owner of a fact type; it only supports or challenges a claim about it.

`ATLAS-SEM-011` — A historical authority may remain **historically valid** while
no longer describing current implementation. Both statements may be true at the
same revision; Atlas records them as separate claims with different authority
status, not as a contradiction.

### 2.2 Authority record

```text
authority_id                # stable logical id, e.g. authority:exsem
governs_fact_types[]        # what this source owns
source_ref                  # ArchitectureSourceRef (SREF-1)
authority_status            # CURRENT | HISTORICAL | SUPERSEDED | AMENDED | UNKNOWN
supersedes[]                # authority_id
superseded_by[]             # authority_id
amendment_of[]              # authority_id
declared_scope              # the boundary within which this source owns the fact
enforcement_seam            # for runtime authorities: where the rule is actually applied
```

`ATLAS-SEM-012` — If two authorities with `authority_status = CURRENT` (or one
whose status cannot be established) claim the same fact type over overlapping
scope and disagree, the result is `AUTHORITY_CONFLICT` (§12). Atlas records both,
with both `source_ref`s, and opens an `open_governance_item` (§6.4).

`ATLAS-SEM-013` — `authority_status = SUPERSEDED` may only be assigned when a
named source states the supersession (an amendment note, a superseding ADR, a
dated in-file correction, a recorded owner decision). Atlas never infers
supersession from timestamps, file order or its own reading of intent.

`ATLAS-SEM-014` — If no owner can be established for a fact type, the claim
carries `authority_owner = AUTHORITY_OWNER_UNKNOWN`. That is a reportable
outcome, not a licence for Atlas to become the owner.

---

## 3. Fact

### 3.1 Definition

A `Fact` is a **source-locatable atomic observation** at a named revision.

Examples (all real; see the golden slices for the full evidence chains):

- a route is registered with a given method, path and gating pre-handler;
- a permission key exists in the catalog and is a member of a role preset;
- an exam policy value is representable in the wire schema and rejected by the
  canonical validator;
- a test asserts a physical row-lock property.

### 3.2 Record

```text
fact_id
statement                   # atomic, verifiable, no interpretation
source_ref                  # ArchitectureSourceRef — REQUIRED
snapshot                    # repo revision the observation is bound to
observed_kind               # DECLARED | RUNTIME | DURABLE | TEST_BEHAVIOUR | DOCUMENT | WORK_HISTORY
```

### 3.3 Rules

`ATLAS-SEM-020` — **A Fact does not imply product support.** `fact(enum member
exists)` does not support `claim(capability is supported)`. This is the single
most load-bearing rule in R0 and is falsified explicitly in §10 and in
[`golden/timed-sync-negative-control.md`](golden/timed-sync-negative-control.md).

`ATLAS-SEM-021` — A Fact without a `source_ref` bound to a revision is invalid.
It may be recorded as `UNKNOWN` provenance, never as a Fact.

`ATLAS-SEM-022` — Facts are **per revision**. A fact observed at revision `R` is
not a fact at revision `R'` without re-observation. `freshness` (§8.5) records
this; `provenance-v0.1.md` defines how the binding is expressed.

`ATLAS-SEM-023` — **Absence is a fact only when the search that establishes it
is closed and stated.** "No production writer sets this value" is a Fact only
with a named search scope (paths, symbol patterns, and what was excluded). An
unbounded "not found" is `UNKNOWN`, not `ABSENT`.

---

## 4. Evidence

### 4.1 Definition

`Evidence` is **why a claim is believed**. It is an input to a claim's status,
not a source of authority and not itself a claim.

### 4.2 Taxonomy (closed set, v0.1)

| `evidence_kind` | What it can establish | What it can never establish alone |
| --- | --- | --- |
| `STATIC_SOURCE` | A token, symbol, column, enum member, branch, guard, or call site exists (or does not exist within a stated search scope) at a revision | Reachability, activation, runtime effect, or that no other writer exists outside the search scope |
| `RUNTIME_ROUTE_CAPTURE` | The composed Fastify application registers a route with the captured method/path/gating metadata at that revision | Durable effects, data-level authorization effectiveness, or candidate-visible behaviour |
| `CONTRACT` | What behaviour/format is **required** within the contract's declared authority | That the requirement is implemented or activatable |
| `TEST_SEMANTIC` | A domain/pure invariant holds for the exercised inputs | HTTP surface, persistence, composition, authorization, or browser behaviour |
| `TEST_INTEGRATION` | Several durable facts commit/roll back together through the production composition | Physical DB mechanisms that are not part of the oracle |
| `TEST_PHYSICAL` | A physical DB/OS mechanism is load-bearing in the oracle (lock contention, SQLSTATE, constraint arbitration, isolation visibility, restart durability) | Product-level capability, unless combined with the other conjuncts of §9 |
| `PROCESS_RESTART` | Behaviour across a process lifetime (durability, worker restart, recovery) | Anything not exercised across the restart boundary |
| `HISTORICAL_WORK_ITEM` | What work was requested, decided, deferred or closed, and when | Current implementation or current product support |
| `HUMAN_REVIEW` | That a named owner/reviewer concluded a specific thing, and what | A runtime fact, unless the reviewed artifact is itself runtime evidence |

`ATLAS-SEM-030` — **Evidence never creates authority** (restates `ATLAS-SEM-010`
as an evidence-side rule). A green test does not make a requirement true; a
closed issue does not make a capability delivered.

### 4.3 Required fields

```text
evidence_id
evidence_kind                # §4.2 closed set
source_ref                   # ArchitectureSourceRef — REQUIRED for everything except HUMAN_REVIEW
proves                       # the BOUNDED proposition this evidence establishes
does_not_prove               # explicit non-claims — REQUIRED, may not be empty
strength                     # §4.4
boundary_coverage            # §9.3 boundary levels this evidence is adequate for
mechanism                    # for tests: the fault model actually exercised
locator                      # for tests: file + test name; for captures: capture identity
pg_class / e2e_class         # §4.5 when applicable
snapshot                     # repo revision
```

`ATLAS-SEM-031` — `proves` and `does_not_prove` are both mandatory. An evidence
record that claims everything proves nothing; an evidence record with no stated
limit cannot participate in a support verdict.

`ATLAS-SEM-032` — `strength` must name the mechanism, not an adjective. "Strong"
is invalid. Valid: "two independent sessions contend on the same row lock; the
oracle is the observed block plus the loser's error".

### 4.4 `strength`

`strength` is a closed set of **mechanism grades**, ordered by what they can
support (higher grade ≠ automatically stronger for every boundary; adequacy is
boundary-relative per §9.3):

| `strength` | Meaning |
| --- | --- |
| `TOKEN_EXISTENCE` | A declaration exists. No execution, no reachability, no durable effect. |
| `READ_COMPATIBILITY` | An existing read/projection path accepts and handles the value without error. |
| `BEHAVIOURAL_PURE` | A controlled-input invariant is exercised without a durable or process boundary. |
| `BEHAVIOURAL_COMPOSITION` | Several durable facts are composed in one production path, with an all-or-nothing or convergence oracle. |
| `BEHAVIOURAL_PHYSICAL` | A physical mechanism is part of the oracle, with a schedule that actually establishes it. |
| `BEHAVIOURAL_BROWSER` | A browser/system mechanism (contenteditable selection, reload, cross-tab ordering, real transport) is part of the oracle. |
| `PROCESS_LIFECYCLE` | The property is established across a process/worker restart boundary. |
| `OWNER_JUDGEMENT` | A named authority owner asserts a conclusion. |

`ATLAS-SEM-033` — A test whose name or comment claims a stronger mechanism than
its schedule establishes is **not evidence of that mechanism**; it is evidence of
whatever the schedule actually establishes, and the divergence is itself a
findable defect (issue + locator), not a resolved claim. `FALSE_PG_AUTHORITY = 0`
is the corresponding #718 invariant and remains an open standing check.

`ATLAS-SEM-034` — `TOKEN_EXISTENCE` evidence may support existence-boundary
claims (§9.3 `B0`) and **never** a capability-boundary claim (`B4`).

### 4.5 Test-evidence classification (consumes #718, does not redefine it)

For evidence that touches real PostgreSQL, `pg_class` uses the taxonomy frozen by
[#718](https://github.com/jnhu76/exam/issues/718) §5:
`REAL_PG_PHYSICAL_OWNER`, `REAL_PG_COMPOSITION_OWNER`, `REAL_PG_INCIDENTAL`,
`PSEUDO_CONCURRENCY`, `PSEUDO_ATOMICITY`, `DUPLICATE_PHYSICAL_PROOF`. A retained
real-PG evidence record must carry `why_real_pg_required` with a specific
mechanism; the four invalid answers named by #718 ("integration test",
"production uses PostgreSQL", "it talks to the database", "real is safer") are
also invalid here.

For browser E2E evidence, `e2e_class` records the material invariant owned and the
browser/system mechanism that requires the browser, per
[`docs/standards/testing.md` §4.0](../../standards/testing.md). A browser assertion
that only restates a lower-layer fact is not E2E evidence for that fact.

`ATLAS-SEM-035` — **Do not label an evidence kind "stronger" without naming what
it proves.** `TEST_INTEGRATION` is not automatically stronger than
`TEST_SEMANTIC`: the former is stronger *for durable-composition boundaries*, the
latter may be the only adequate evidence for a domain invariant, and either may be
inadequate for the boundary actually claimed.

---

## 5. Claim

### 5.1 Definition

A `Claim` is a **reviewable Atlas statement** about a subject, with an explicit
boundary, an authority owner, evidence on both sides, and a status.

A Claim is a first-class *record*. Whether it is also a graph node is an IR
question ([`ir-v0.1.md`](ir-v0.1.md) §3) — in v0.1 it is not.

### 5.2 Record

```text
claim_id
subject                       # logical ID (see ir-v0.1.md §4)
predicate                     # e.g. activation_support, design_status, authorization_effect
value                         # closed-set value from §8
claim_kind                    # §5.3
boundary                      # §9.2 — the exact boundary being claimed
axis_assignments[]            # §8 — one or more axis bindings
authority_owner               # NormativeAuthority ref | AUTHORITY_OWNER_UNKNOWN
supporting_evidence[]         # Evidence refs
challenging_evidence[]        # Evidence refs — may be empty, but §5.5 requires the attempt
support_verdict               # DERIVED, §9 — never hand-set without its derivation
review_state                  # §5.4
open_governance_item          # §6.4
source_snapshot               # repo revision
```

### 5.3 `claim_kind` (closed set, v0.1)

| `claim_kind` | Claims about |
| --- | --- |
| `CAPABILITY_SUPPORT` | Whether a product capability is operable end-to-end under stated authority |
| `DESIGN_STATUS` | Whether a design is proposed/accepted/rejected |
| `IMPLEMENTATION_STATUS` | Whether implementation exists in the as-built tree |
| `VERIFICATION_STATUS` | Whether a boundary is proven by adequate evidence |
| `AUTHORIZATION_EFFECT` | Whether an actor can perform an operation, and under which scope/state |
| `AUTHORITY_STATEMENT` | What a normative source says (Atlas reports; it does not assert on the source's behalf) |
| `DECLARED_METADATA` | What a declaration *says about itself* (e.g. a registry's coverage claim) |
| `RUNTIME_OBSERVATION` | What the composed runtime registers or does |
| `DURABLE_EFFECT` | What durable state a path changes |
| `RESIDUAL_OR_EXCLUSION` | What is deliberately not delivered, deferred, or excluded |
| `WORK_STATUS` | Requested/closed/deferred state of a work item, with its closure semantics |
| `PROVENANCE_INTEGRITY` | Whether a locator/claim binding still resolves and is current |

`ATLAS-SEM-040` — `DECLARED_METADATA` and `RUNTIME_OBSERVATION` are **different
claims even when they concern the same route**. When they diverge, both are kept
(§12).

### 5.4 `review_state` (closed set)

`PROPOSED` · `CURATED` · `REVIEWED` · `DISPUTED` · `SUPERSEDED` · `UNKNOWN`

`review_state` records Atlas's own curation workflow. It is **not** a product
status and must never be rendered as one (e.g. `REVIEWED` does not mean the
capability is supported).

### 5.5 Evidence discipline on a claim

`ATLAS-SEM-041` — `challenging_evidence` must be the result of an actual attempt
to falsify the claim **at its stated boundary**: a negative search, a
counter-test, a divergence between declared and runtime facts, a historical
statement that no longer matches, or an explicit statement that none was found.
An empty `challenging_evidence` with no recorded attempt is an incomplete claim.

`ATLAS-SEM-042` — A claim that would be falsified by evidence Atlas has already
collected elsewhere in the same snapshot is invalid. The snapshot must be
internally consistent; cross-slice contradictions are defects, not
`DISPUTED` states.

---

## 6. WorkItem

### 6.1 Definition

A `WorkItem` is the representation of a piece of **work history**: an Issue, a
PR, a recorded owner decision, or a review conclusion.

### 6.2 Record

```text
work_item_id
kind                    # ISSUE | PR | DECISION_RECORD | REVIEW
external_ref            # repo + number, or the in-repo decision locator
external_revision       # for GitHub: last-observed updatedAt/state; freshness is separate (§provenance)
title
requested_scope         # what the item claims to have asked for
closure_semantics       # §6.3
state
owns[]                  # logical IDs this item claims to own / deliver
related_claims[]
```

### 6.3 `closure_semantics` (closed set — required for every closed item)

| Value | Meaning |
| --- | --- |
| `OPEN` | Not closed |
| `CLOSED_IMPLEMENTED` | Closed as completed **and** the closure record names the delivered scope |
| `CLOSED_NOT_PLANNED` | Closed as not planned / rejected |
| `CLOSED_SUPERSEDED` | Closed because another mechanism/decision replaced it |
| `CLOSED_PARTIAL` | Closed as completed while the item's own scope names undelivered parts |
| `CLOSED_UNKNOWN` | Closed, but the closure reason cannot be established from the available record |

`ATLAS-SEM-050` — **`Issue CLOSED` is never evidence for `SUPPORTED`.** A closed
work item can support `WORK_STATUS` claims (`DESIGN_STATUS`,
`RESIDUAL_OR_EXCLUSION`) and can supply `HISTORICAL_WORK_ITEM` evidence about
*scope* and *intent*. It is never `evidence_kind`-sufficient for
`CAPABILITY_SUPPORT` at `B3`/`B4`.

`ATLAS-SEM-051` — A work item's body is a **request**, not a specification of
delivered scope. `CLOSED_IMPLEMENTED` requires the closure record to name what
shipped; otherwise the closure semantics is `CLOSED_PARTIAL` or
`CLOSED_UNKNOWN`.

`ATLAS-SEM-052` — Closure semantics is itself a claim. When the closure reason is
not establishable, the correct value is `CLOSED_UNKNOWN` (or `UNKNOWN`), never
`CLOSED_IMPLEMENTED` by default.

### 6.4 `open_governance_item` — who owns the gap

The axes in §8 do not express **who, if anyone, may close a gap**, so a claim
carries this companion field:

```text
open_governance_item:
  kind: NONE | WORK_ITEM | DECISION_GATED | OWNER_UNRESOLVED | UNKNOWN
  ref?                       # work item / authority ref
  lift_condition?            # what would have to be decided or done
```

`ATLAS-SEM-053` — `DECISION_GATED` means a **named authority** must decide before
the state can change (e.g. an activation decision gate). Atlas records the gate
and its lift condition; it never performs the decision and never assumes a
default direction.

`ATLAS-SEM-054` — `OWNER_UNRESOLVED` means no work item and no decision gate
could be found. That is the honest representation of "nobody currently owns this";
it must not be rendered as "planned", "in progress" or "not planned".

`ATLAS-SEM-055` — Atlas must not convert `OWNER_UNRESOLVED` into a scheduling
statement, and must not adjudicate any decision that #757/#762 reserve to an
owner.

---

## 7. Projection

### 7.1 Definition

A `Projection` is any consumer-facing derivation of the IR: role matrices,
generated user/developer/maintainer docs, 2D lists, Three.js layouts, impact
reports, diffs.

### 7.2 Rules

`ATLAS-SEM-060` — **A Projection cannot create a fact.** No projection output may
be read back as authority, and no projection may add a node, edge, axis value or
evidence record.

`ATLAS-SEM-061` — A Projection preserves provenance: every displayed statement
resolves to the claim, evidence and source refs behind it. A projection that
cannot show provenance for a statement must not display the statement as fact.

`ATLAS-SEM-062` — A Projection must render `UNKNOWN`, `CONFLICT`, `STALE_REF`,
`MISSING_REF`, `AMBIGUOUS` and `OWNER_UNRESOLVED` as visible states. Suppressing
them for readability is a defect.

`ATLAS-SEM-063` — A Projection must not flatten an aggregate into a stronger
claim than its inputs. Concretely: a role/permission matrix derived from a role
preset must not present preset membership as effective resource authorization
(falsified in [`golden/rbac-maintainer-admin.md`](golden/rbac-maintainer-admin.md)).

`ATLAS-SEM-064` — Layout, colour, grouping and position are **renderer state**.
No semantic fact may be derived from them (`layout coordinate ⇒ semantic fact` is
forbidden; frozen here so R2 cannot reintroduce it).

---

## 8. Status axes

Six independent axes. `completed: boolean` is forbidden (`ATLAS-SEM-070`).

### 8.1 `design`

`PROPOSED` · `ACCEPTED` · `REJECTED` · `UNKNOWN`

Whether a design is adopted by its owner. `ACCEPTED` requires a named adopting
authority (an Accepted ADR, a dated in-tree decision record, or a recorded owner
decision). Does **not** mean implemented.

### 8.2 `implementation`

`ABSENT` · `PARTIAL` · `PRESENT` · `UNKNOWN`

`PRESENT` means the implementation exists in the tree at the snapshot.
`PARTIAL` means some constituent mechanisms exist and at least one required
constituent does not (name which). `ABSENT` requires closed-search evidence
(`ATLAS-SEM-023`).

### 8.3 `verification`

`PASS` · `FAIL` · `INSUFFICIENT` · `UNKNOWN`

Relative to the claim's boundary (§9.3) and to a named evidence set. `PASS` at
`B0` is not `PASS` at `B4`. `INSUFFICIENT` means evidence exists but is below the
boundary; it is a first-class result.

### 8.4 `activation_support`

`SUPPORTED` · `GATED` · `DEFERRED` · `NOT_SUPPORTED` · `UNKNOWN`

| Value | Exact meaning | Distinguishing test |
| --- | --- | --- |
| `SUPPORTED` | All conjuncts of §9.1 hold at the claimed boundary | Every conjunct has adequate evidence |
| `GATED` | An activation path exists in principle but a **current, named gate** refuses it | The refusing gate is locatable and its lift condition is nameable (`ATLAS-SEM-071`) |
| `DEFERRED` | Accepted (or owner-proposed) intent to deliver, with the activation path not built | `design ∈ {ACCEPTED, PROPOSED}` **and** a work item owns it |
| `NOT_SUPPORTED` | No accepted requirement, or an explicit decision against; activation refused | No owning work item claims it as planned |
| `UNKNOWN` | Cannot establish which of the above holds | — |

`ATLAS-SEM-071` — `GATED` requires recording the gate's **locator and lift
condition**. `GATED` does not imply "will work when opened": if a constituent
mechanism is missing, the claim also carries `implementation = PARTIAL` and the
missing constituent must be named.

`ATLAS-SEM-072` — **`GATED` ≠ `DEFERRED` ≠ `NOT_SUPPORTED`.** They differ in
whether a gate is declared with a lift condition, whether the design is accepted,
and whether a work item owns the future. Collapsing them loses the answer to
"should a reader expect this to work later?"

`ATLAS-SEM-073` — `GATED` with `open_governance_item.kind = OWNER_UNRESOLVED` is
valid and must be reported as such: a declared gate that no one currently owns.
It must not be rendered as "planned".

### 8.5 `freshness`

`CURRENT` · `STALE` · `UNKNOWN`

Whether the bound snapshot still describes live state. Separate from
`resolution` (§8.6) and from external-tool freshness
([`provenance-v0.1.md`](provenance-v0.1.md) §5). A ref may be perfectly
`RESOLVED` at an old revision and therefore `STALE` as a description of live state.

### 8.6 `resolution`

`RESOLVED` · `STALE_REF` · `MISSING_REF` · `AMBIGUOUS` · `CONFLICT` · `UNKNOWN`

Whether the *locator* can be resolved, and unambiguously. Defined in
[`provenance-v0.1.md`](provenance-v0.1.md) §4. `resolution` is about locating the
evidence; it says nothing about whether the evidence supports the claim.

`ATLAS-SEM-074` — The axes are **not** inter-derivable. `design = ACCEPTED` does
not raise `implementation`; `implementation = PRESENT` does not raise
`activation_support`; `verification = PASS` at one boundary does not raise it at
another; `freshness = CURRENT` does not raise anything else.

---

## 9. Support inference rule

### 9.1 The four conjuncts

`ATLAS-SEM-080` — A `CAPABILITY_SUPPORT` claim may carry
`activation_support = SUPPORTED` **only** when all four hold, each with adequate
evidence at the claimed boundary:

```text
(1) reachable production operation
      a guarded production path exists AND is reachable
      (registration alone is not reachability; a path whose every guard
       denies, or which no command can enter, is not reachable)

(2) current semantic/policy authority permits it
      a CURRENT authority (contract/ADR/policy authority) permits the
      behaviour as product semantics — not a historical or superseded one

(3) required runtime/state prerequisites exist
      the durable/state prerequisites the behaviour needs are established,
      and (where the boundary crosses a transaction or process) that
      composition is proven

(4) adequate evidence for that exact boundary
      evidence whose strength covers the boundary being claimed (§9.3)
```

`ATLAS-SEM-081` — Failure of any conjunct yields a **specific** non-SUPPORTED
result, not a generic failure: (1) fails → `NOT_SUPPORTED`/`UNKNOWN` for the
operation; (2) fails → the activation is at most `GATED`/`NOT_SUPPORTED`;
(3) fails → `PARTIAL` implementation with the missing prerequisite named;
(4) fails → `verification = INSUFFICIENT`.

`ATLAS-SEM-082` — **Human-curated claims are expected and legitimate.** Atlas is
not required to automate support decisions. What is required is that a curated
claim carries the same four conjuncts and evidence records as any other claim, and
that its `review_state` says who curated it.

### 9.2 Boundary declaration

Every claim declares the boundary it asserts. Claiming `SUPPORTED` without a
stated boundary is invalid (`ATLAS-SEM-001`).

### 9.3 Boundary levels and minimum evidence

| Level | Boundary | Minimum adequate evidence |
| --- | --- | --- |
| `B0 TOKEN` | A declaration/symbol/column/enum member exists (or does not, within a stated closed search) | `STATIC_SOURCE` (+ the search scope for absence) |
| `B1 READ` | An input carrying the value is syntactically accepted and read compatibly | `STATIC_SOURCE` + `CONTRACT` (+ `TEST_SEMANTIC` for the parse path) |
| `B2 PERSIST` | Some path can durably write the value/state | `STATIC_SOURCE` writer + `TEST_INTEGRATION` proving the durable effect |
| `B3 OPERATION` | A guarded, reachable production operation exists under stated authority | `RUNTIME_ROUTE_CAPTURE` + `STATIC_SOURCE` guard + (for scope claims) the enforcement seam's own test |
| `B4 CAPABILITY` | A user-visible capability is operable end-to-end including durable effects and its authority/state prerequisites | all four conjuncts of §9.1, with `TEST_INTEGRATION` for the durable composition and browser evidence only where a browser mechanism is load-bearing |
| `B5 CONTRACTUAL` | A normative source requires this behaviour | the authority's own current text; implementation status is a **separate** claim |
| `B6 EVIDENCE_GRADE` | A named failure mode is proven by evidence of a named mechanism | the specific evidence record, with `proves`/`does_not_prove` and `mechanism` |

`ATLAS-SEM-083` — **Evidence grade must meet or exceed the boundary.** Evidence
adequate for `B0`/`B1` never supports `B3`/`B4`. This is the mechanism that makes
"enum exists ⇒ supported" unrepresentable rather than merely discouraged.

---

## 10. Forbidden inferences

Each row is an implication that must be **unrepresentable** in the model. The
"why the model rejects it" column is the design obligation; the golden slices
carry the worked falsifications at the R0 base revision.

| # | Forbidden implication | Why the model rejects it |
| --- | --- | --- |
| F-01 | `WorkItem CLOSED ⇒ SUPPORTED` | `WORK_STATUS` and `CAPABILITY_SUPPORT` are different `claim_kind`s with different authorities; closure semantics (`CLOSED_PARTIAL`/`CLOSED_UNKNOWN`) cannot raise `implementation` or `activation_support` (`ATLAS-SEM-050`, `-051`, `-052`) |
| F-02 | `enum member exists ⇒ SUPPORTED` | existence is `B0`; support is `B4`; `ATLAS-SEM-083` blocks the grade jump |
| F-03 | `schema accepts value ⇒ SUPPORTED` | acceptance is `B1`; `ATLAS-SEM-083`; and `EXSEM-019` makes representability explicitly non-supportive |
| F-04 | `DB column exists ⇒ SUPPORTED` | existence is `B0`; no writer ⇒ no `B2`; `ATLAS-SEM-083` |
| F-05 | `route exists ⇒ complete capability supported` | route presence is at most `B3` for one operation; `B4` additionally needs conjuncts (2)–(4) |
| F-06 | `UI control exists ⇒ capability supported` | UI is a Projection (§7); `ATLAS-SEM-060` forbids deriving facts from it |
| F-07 | `test file exists ⇒ claim verified` | `ATLAS-SEM-031`, `-032`, `-035`: evidence must name mechanism and boundary; existence of a file is `TOKEN_EXISTENCE`-grade |
| F-08 | `CI green ⇒ claim verified` | CI scope is a separate claim; green unrelated CI is not evidence for this boundary (`ATLAS-SEM-035`) |
| F-09 | `RolePreset contains Permission ⇒ actor has effective access to arbitrary matching resources` | `AUTHORIZATION_EFFECT` requires the enforcement seam and the assignment/scope dimension; preset membership is only the capability term (`ATLAS-SEM-063`, golden C) |
| F-10 | `historical ADR once proposed X ⇒ X is current supported behaviour` | `authority_status = HISTORICAL`/`SUPERSEDED` cannot satisfy conjunct (2) (`ATLAS-SEM-011`, `-013`, `-081`) |
| F-11 | `two sources conflict ⇒ silently pick whichever is newer/easier` | `ATLAS-SEM-002`, §12: conflict is a reported state plus an `open_governance_item` |
| F-12 | `declared metadata says X ⇒ runtime is X` | `DECLARED_METADATA` ≠ `RUNTIME_OBSERVATION` (`ATLAS-SEM-040`); divergence is preserved, not resolved |
| F-13 | `no evidence found ⇒ ABSENT` | absence requires closed-search evidence (`ATLAS-SEM-023`); otherwise `UNKNOWN` |
| F-14 | `projection renders X ⇒ X is a fact` | `ATLAS-SEM-060`, `-061`, `-064` |
| F-15 | `GATED ⇒ will work when opened` | `ATLAS-SEM-071` requires the missing constituent to be named and `implementation` to remain honest |
| F-16 | `permission key exists ⇒ an operation is gated by it` | an inert grant is `B0` metadata; `B3` requires the route's own captured gate (golden B) |

`ATLAS-SEM-090` — **No slice-specific escape hatch.** A golden slice (or any
later claim) may not represent its case with a private field, a free-text
"notes" channel, or a special-cased enum value. If a case cannot be represented
with the vocabulary in this document, that is a **defect in this document** and
must be fixed here (or R0 stops and reports it).

---

## 11. UNKNOWN propagation

`ATLAS-SEM-100` — `UNKNOWN` is a value, not a blank. Every axis accepts `UNKNOWN`,
and serialization must distinguish `UNKNOWN` from absent (§`ir-v0.1.md` §6).

`ATLAS-SEM-101` — **Unknown propagates with named reasons.** A derived claim is
`UNKNOWN` when a required input is `UNKNOWN`; the derivation records *which* input
and why. Derived claims never invent a default.

`ATLAS-SEM-102` — Missing evidence for one boundary does not lower a different
axis:

```text
missing implementation evidence        does NOT imply implementation = ABSENT
                                        (absence requires closed-search evidence)
missing test                            does NOT imply implementation = ABSENT
                                        (tests and implementation are separate axes)
unknown work-item closure semantics     does NOT imply not implemented
                                        (closure semantics is a separate claim)
unresolvable historical locator          does NOT imply the fact was never true
                                        (resolution ≠ truth, §8.6)
unmapped capability in a later snapshot does NOT imply unsupported
                                        (absence from a mapping is coverage, not support)
```

`ATLAS-SEM-103` — The inverse also holds: `implementation = PRESENT` does not
imply `verification = PASS`, and neither implies `activation_support = SUPPORTED`.

`ATLAS-SEM-104` — `UNKNOWN` must never be silently widened into a range,
interval, "probably", or an unstated assumption. Reporting `UNKNOWN` plus the
exact unresolved question is the required output.

---

## 12. CONFLICT propagation

`ATLAS-SEM-110` — Conflict is a **first-class outcome**. Five distinguishable
conflict kinds (v0.1); they must not be merged:

| Kind | Situation |
| --- | --- |
| `AUTHORITY_CONFLICT` | Two `CURRENT` authorities own the same fact type over overlapping scope and disagree |
| `DECLARED_VS_RUNTIME_DIVERGENCE` | A declaration about the system disagrees with the observed runtime (e.g. a registry's coverage claim vs the captured route surface) — neither is discarded |
| `EVIDENCE_CONTRADICTION` | Two evidence records, both adequate for their own boundaries, disagree about the same proposition |
| `LOCATOR_CONFLICT` | A locator resolves to more than one candidate, or its anchor is ambiguous (`resolution = AMBIGUOUS`) |
| `TEMPORAL_CONFLICT` | A statement was true at revision `R` and is false at revision `R'`; both are accurately bound and neither may be dropped, but only one describes live state |

`ATLAS-SEM-111` — For every conflict, Atlas records: both parties with their
source refs, the exact proposition in dispute, an `open_governance_item` naming
who may resolve it, and the resolution state (`UNRESOLVED` until an owner
resolves it). The resolution, when it comes, is recorded as an authority
supersession (§2.2) — Atlas does not become the resolver.

`ATLAS-SEM-112` — `DECLARED_VS_RUNTIME_DIVERGENCE` is **not** a bug in the
declaration by definition. A declaration may be intentionally narrower or
broader. What is required is that Atlas reports the divergence and the declared
intent, and never promotes the declaration to runtime truth or vice versa.

`ATLAS-SEM-113` — A conflict must not be resolved by rendering: choosing one side
for a summary, a matrix cell or a graph edge is a §7 violation.

`ATLAS-SEM-114` — Conflicting *scopes* of the same authority are not a conflict
(an ADR's own Status section naming the implementation model is a scope
statement). Distinguishing a genuine authority conflict from an in-source scope
statement is a curation duty; when it cannot be established, report
`AUTHORITY_CONFLICT` with `OWNER_UNRESOLVED` rather than deciding.

---

## 13. Historical, superseded and amended relationships

`ATLAS-SEM-120` — Four relations are distinguished and never inferred:

| Relation | Meaning | Recorded as |
| --- | --- | --- |
| current | Describes live requirements/behaviour at the snapshot | `authority_status = CURRENT` |
| historical | Was authoritative; describes a past state; still accurate *about that past* | `authority_status = HISTORICAL` + `freshness = STALE` |
| superseded | A named source replaced it | `authority_status = SUPERSEDED` + note the superseding source |
| amended | Partially changed by a dated amendment | `authority_status = AMENDED` + `amendment_of`/amended scope |

`ATLAS-SEM-121` — Historical facts are **kept, not overwritten**. A historical
work item, audit, or decision record remains valid evidence about intent,
scope and sequencing after it stops describing the implementation.

`ATLAS-SEM-122` — A `HISTORICAL` source is not evidence for a current-state
claim, and its `STALE` freshness does not make it wrong.

---

## 14. R0-A adversarial self-check — the model rejects the forbidden inferences

This section is the R0-A gate evidence: each forbidden inference is falsified
with a **real witness at the R0 base revision**
`cbe33db1a7f241ba85aadbf21c4f6dea01133f03`. Witnesses are developed as full
claims in the golden slices; the locators here are the decisive ones.

### 14.1 `Issue CLOSED ⇒ SUPPORTED` (F-01)

Witness: `timed_sync`. The owning work item
[#291](https://github.com/jnhu76/exam/issues/291) is `CLOSED` (2026-09-04), and
that closure delivered a **semantic freeze**, not an activation. At the R0 base
revision the canonical validator rejects the value
(`packages/exam-engine/src/examPolicy.ts:305-307`) and `publishExam` throws
(`packages/exam-engine/src/examCommands.ts:169-171`). Authority:
`docs/contracts/exam-policy-authority.md:135` records **NOT ACTIVATED**.

Model result: `WORK_STATUS = CLOSED_IMPLEMENTED` (for a *freeze*), while
`CAPABILITY_SUPPORT` for activating `timed_sync` is `GATED`/`NOT_SUPPORTED` at
`B3`/`B4`. The two claims have different `claim_kind`s; no inference exists
between them. Rejected. ✔

### 14.2 `enum member exists ⇒ SUPPORTED` (F-02)

Witnesses, all present at the base revision and all non-supportive:

- `TimingMode.TimedSync = "timed_sync"` — `packages/domain/src/enums.ts:199-205`;
- attempt statuses `not_started` / `queued` / `voided` and enrollment `blocked`
  are accepted by DB CHECK constraints but have no production writer (`EXSEM`
  §5; structural search witness
  `apps/api/src/runtime/reserved-status-writers.structural.test.ts`);
- `answerVisibility = "visible"` is representable in the candidate contract
  (`packages/contracts/src/attempt.ts:1097`, `:1172`) while the only producer is a
  constant: `apps/api/src/routes/attempts.shared.ts:46-48`.

Model result: each is a `B0`/`B1` fact with `implementation = ABSENT`/`PARTIAL`
and no `B3`/`B4` evidence ⇒ `ATLAS-SEM-083` blocks the grade jump. Rejected. ✔

### 14.3 `RolePreset contains Permission ⇒ global effective authorization` (F-09)

Witness: `grader_exam_assignments`. The Grader preset holds grading capabilities,
and the runtime additionally requires an **active assignment to the resolved
Exam**: non-Admin graders without one receive `404 RESOURCE_NOT_FOUND` at
`apps/api/src/authz/scopedCapability.ts:416-468`; the assignment gate is wired at
`apps/api/src/plugins/authz.ts:120-130`. The shared contract is stated by the
authority: "**authority = capability × assignment** — the scope row alone grants
zero capabilities"
(`docs/architecture/authorization.md:180-181`).

Model result: `AUTHORIZATION_EFFECT` requires the enforcement seam **and** the
assignment/scope dimension; preset membership alone is a `B0` fact about
configuration. Rejected. ✔

### 14.4 `test exists ⇒ claim verified` (F-07) — and its subtler form

Witness (subtle form): a documentation claim that a registry is reconciled by a
"whole-app" conformance test is **not** established by that test's existence.
`apps/api/src/authz/routeRegistryConformanceWholeApp.test.ts` asserts route
counts (127 protected of 148 total,
`apps/api/src/authz/routeRegistryConformanceWholeApp.test.ts:372-391`) and never
imports the registry module — it references it only in comments (`:10`, `:35`,
`:78`). The registry itself declares exhaustive intent
(`apps/api/src/authz/routeRegistry.ts:2-8`) while carrying 113 entries.

Model result: the claim "the registry is reconciled against the runtime surface"
has no adequate evidence at any boundary; the *actual* facts are two separate
claims (`DECLARED_METADATA` = 113-entry exhaustive claim;
`RUNTIME_OBSERVATION` = 127 protected routes in the whole-app capture) plus a
`DECLARED_VS_RUNTIME_DIVERGENCE`. Rejected. ✔

`ATLAS-SEM-033` note: this witness is also a permanent example of why evidence
must name its mechanism — a test named for a reconciliation it does not perform is
`TOKEN_EXISTENCE`-grade for that reconciliation regardless of its name.

### 14.5 `authority conflict ⇒ silent winner` (F-11)

Witness: `DECLARED_VS_RUNTIME_DIVERGENCE` above (registry 113 declared-exhaustive
vs 127 protected captured). Neither source is discarded: the registry is the
declared mapping (and is read by `routeRegistryConformance.test.ts` and
`proctorAccessConformance.test.ts`, which compare registry entries against the
runtime **forward** direction), while the whole-app capture is the runtime
observation. The divergence has no Atlas decision; it is an
`open_governance_item` (`kind = WORK_ITEM`, follow-up per #762 O-07, which R0 is
explicitly not authorized to fix).

Model result: `AUTHORITY_CONFLICT`/divergence reported with both parties and a
named owner for the follow-up. No winner chosen. Rejected. ✔

### 14.6 UNKNOWN propagation, worked

| Situation | Wrong output | Model output |
| --- | --- | --- |
| Implementation evidence missing for a capability | `implementation = ABSENT` | `implementation = UNKNOWN` + the open question, unless a closed search establishes absence (`ATLAS-SEM-023`) |
| No test covers a boundary | `verification = FAIL` | `verification = INSUFFICIENT` (evidence exists but is below the boundary) or `UNKNOWN` — `FAIL` requires counter-evidence, not absent evidence |
| Work item closed with no established reason | `CLOSED_IMPLEMENTED` | `CLOSED_UNKNOWN` (`ATLAS-SEM-052`) |
| Historical locator no longer resolves | "the fact was never true" | `resolution = MISSING_REF` + `freshness = STALE`; truth is a separate claim |
| Gate declared, no owner found for the lift | "planned" | `GATED` + `open_governance_item.kind = OWNER_UNRESOLVED` (`ATLAS-SEM-054`) |

### 14.7 R0-A gate

```text
R0_A_FACT_DEFINED              = YES  (§3)
R0_A_CLAIM_DEFINED             = YES  (§5)
R0_A_EVIDENCE_DEFINED          = YES  (§4)
R0_A_AUTHORITY_DEFINED         = YES  (§2)
R0_A_WORKITEM_DEFINED          = YES  (§6)
R0_A_PROJECTION_DEFINED        = YES  (§7)
FORBIDDEN_INFERENCES_EXPLICIT  = YES  (§10, F-01..F-16)
UNKNOWN_PROPAGATION_DEFINED    = YES  (§11)
CONFLICT_PROPAGATION_DEFINED   = YES  (§12)
```

---

## 15. Open items for R0-A (carried into the R0 review, not resolved here)

| Item | Why it is open | Owner |
| --- | --- | --- |
| Whether "insufficient evidence for a boundary" should be a distinct axis value from `UNKNOWN` at the *claim* level | `verification = INSUFFICIENT` covers it today; a claim whose evidence is insufficient for its own declared boundary is currently invalid rather than a status. Carried to the R0 review. | R0-D |
| Granularity rule for when a `Fact` must be split | Atomicity is defined semantically ("no interpretation"), not lexically. Carried as a curation duty with the golden slices as calibration. | R0-D / R1 |
| Whether `open_governance_item` should be an axis | Kept as a companion field in v0.1 because the six required axes cannot answer "who lifts the gate" (`ATLAS-SEM-053`..`-055`); revisited in the R0 review. | R0-D |
