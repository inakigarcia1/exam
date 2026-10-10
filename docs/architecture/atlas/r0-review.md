# R0 review and freeze record

> **This file is the R0-D deliverable**: independent adversarial review,
> adjudication of every finding, the correction record, the schema-overfit stress
> test, and the R0 verdict. Execution issue
> [#763](https://github.com/jnhu76/exam/issues/763); parent
> [#757](https://github.com/jnhu76/exam/issues/757).
>
> **This file is not an Exam authority.** It records what was reviewed, what was
> found, and what was changed — review history is evidence, and it is kept rather
> than rewritten (`#763` §11).

```text
R0_BASE                 = cbe33db1a7f241ba85aadbf21c4f6dea01133f03
R0_HEAD                 = the commit that adds this file (the R0 freeze commit;
                          see the PR body for the exact SHA)
BRANCH                  = design/atlas-r0-semantic-ir
PR                      = jnhu76/exam#768
IR_SCHEMA_VERSION       = v0.1
SOURCE_REF_VERSION      = SREF-1
```

## 0. How the review was run

Four **independent** read-only reviewers were dispatched, one per attack
direction, with no shared context and no access to the authors' reasoning. Each
was told to *disprove* the design and to report specific findings or nothing. The
reviewers were real subagents, not fresh passes by the author.

Review round 1 ran against the R0-C head `d4dcb54b` (the head a reviewer would
have seen at that point). Corrections landed in `476c0960`. **All four directions
were then re-run against the corrected head `476c0960`**, which produced a second
round; corrections landed in `a47e457a`. This document is added by the freeze
commit, so it is the first commit at which every `r0-review.md` reference in the
design area resolves.

```text
REVIEW_ROUND_1_HEAD     = d4dcb54b
REVIEW_ROUND_2_HEAD     = 476c0960
FREEZE_HEAD             = the commit adding this file
CORRECTION_COMMIT_1     = 476c0960  docs(atlas): address R0 adversarial review findings
CORRECTION_COMMIT_2     = a47e457a  docs(atlas): close final-head adversarial review findings
```

| Reviewer | Direction | Round-1 result | Round-2 result (after corrections) |
| --- | --- | --- | --- |
| 1 | FALSE SUPPORT | FALSE_SUPPORT = 3, UNJUSTIFIED_SUPPORTED = 4 | 2 constructible inputs remained → RV-32, RV-33 |
| 2 | AUTHORITY / CONFLICT | HIDDEN_AUTHORITY_CONFLICT = 3, DUPLICATE_AUTHORITY = 3, SILENT_CONFLICT_RESOLUTION = 6 | 1 + 1 remaining (both marker/label defects) → RV-36 |
| 3 | RBAC / SCOPE | FALSE_RBAC_AUTHORITY = 1, MISSING_SCOPE_DIMENSION = 2, REGISTRY_RUNTIME_CONFLATION = 0 | all three verified fixed |
| 4 | PROVENANCE / EVIDENCE / PRIVACY | 7 source-ref hazards, 4 unstable identities, 4 evidence overclaims, SENSITIVE_DATA_LEAK = 0 | all verified fixed |
| — | Schema-overfit stress test (§4 below) | SCHEMA_OVERFIT = NO | unchanged |

`SENSITIVE_DATA_LEAK = 0` was reported independently in both rounds: no
credential, token, environment value, candidate personal data or database row
content appears anywhere in `docs/architecture/atlas/`.

---

## 1. R0 checkpoint results

| Checkpoint | Result | Evidence |
| --- | --- | --- |
| **R0-A** — authority and claim semantics | **PASS** | `semantic-contract.md` §14.7 gate: all nine items YES. Fact/Evidence/Authority/Claim/WorkItem/Projection defined; six independent axes; explicit forbidden-inference table; UNKNOWN and CONFLICT propagation defined |
| **R0-B** — minimal IR + provenance | **PASS** | `ir-v0.1.md` §3 (12 node types, each justified; 8 rejected), §5 (11 edges registered; 4 rejected), §6–§7; `provenance-v0.1.md` SREF-1 with six resolution states, two freshness dimensions, and privacy rules. `THREEJS_DEPENDENCY = NONE`, `GRAPH_DB_DEPENDENCY = NONE` |
| **R0-C** — four golden slices | **PASS** | Four slices share one schema; `SLICE_SPECIFIC_SCHEMA_HACKS = 0`; `COMMON_SCHEMA = YES`; the required falsifications in all four are rejected (§2) |
| **R0-D** — adversarial review + freeze | **PASS** | This document: 4 independent reviewers, 2 rounds, 38 adjudicated findings, 2 correction commits, schema-overfit stress test, final verdict |

### 1.1 Golden-slice results (post-correction)

```text
GOLDEN_RICH                = PASS   (16 claims; delivered core SUPPORTED at B4, four verified residuals
                                     NOT_SUPPORTED/DEFERRED, roll-up MIXED; #679/#301-closed ⇒ all-facets
                                     delivered is REJECTED; A-05/A-06 declared at B3, the boundary their
                                     evidence covers)
GOLDEN_MANUAL_GRADING      = PASS   (capability → workflow → operation → interface → guard → permission →
                                     assignment scope → durable facts → terminal projection → evidence;
                                     manual grading ≠ result publication as two workflows, two permissions,
                                     two durable writes; F-16 rejected via the inert capability keys)
GOLDEN_RBAC                = PASS   (RolePreset ≠ effective authorization structurally; both the declared
                                     113-entry registry and the 127-of-148 runtime capture preserved;
                                     host operator outside application RBAC by construction;
                                     REGISTRY_RUNTIME_CONFLATION = 0)
GOLDEN_NEGATIVE_CONTROL    = PASS   (representable + storable + read-compatible all true, activation refused
                                     at two canonical seams, no T0 writer ⇒ activation_support = GATED;
                                     8 live traps recorded and survived; a second, genuinely different
                                     class added — the enforcement-less control flags, implementation ABSENT)
```

### 1.2 Anti-hallucination invariant, re-checked

Each forbidden inference was attacked by reviewer 1 and reported as rejected by
the model. Post-correction (and post-RV-32), the mechanisms that reject them:

| Forbidden inference | Rejected by |
| --- | --- |
| `enum exists ⇒ SUPPORTED` | `ATLAS-SEM-020`, `-083` (grade jump), `ATLAS-IR-040`/`-093` (representable/storable/write_reachable/activation separated), clause 2 of `ATLAS-IR-032` |
| `schema accepts ⇒ SUPPORTED` | same, plus the deliberate shape-vs-validator split recorded in golden D |
| `DB column exists ⇒ SUPPORTED` | `ATLAS-IR-093` (`storable` = schema capacity only) |
| `route exists ⇒ capability supported` | `ATLAS-SEM-080` conjuncts (2)–(4) |
| `UI control exists ⇒ supported` | `ATLAS-SEM-060`, `ATLAS-IR-052` |
| `test exists ⇒ verified` | `ATLAS-SEM-031`/`-032`/`-033` (mechanism must be named); worked in golden C C-27/C-29 |
| `CI green ⇒ verified` | no evidence kind for CI in the `§4.2` closed set |
| `Issue CLOSED ⇒ SUPPORTED` | `ATLAS-SEM-050` (now **any** boundary), `-051`, `-052`; worked in golden A and D |
| `historical ADR proposed X ⇒ X current` | `ATLAS-SEM-011`, `-013`, `-122`, conjunct (2) |
| `RolePreset contains P ⇒ resource access` | `ATLAS-IR-035` (no stored grantee set), `-039`/`-092`, `ATLAS-SEM-063` |
| `two sources conflict ⇒ pick one` | `ATLAS-SEM-002`, `-110`…`-115`; worked in golden C C-K1 and golden D D-K1 |
| `declared metadata ⇒ runtime truth` | `ATLAS-IR-036`/`-037`/`-082`, `ATLAS-SEM-040`/`-112` |
| `omission ⇒ nothing to report` | clause 2 of `ATLAS-IR-032` (mapping completeness is a support conjunct), `ATLAS-SEM-023`, `ATLAS-IR-091` |
| `boundary laundering` (B3 evidence ⇒ B4 claim) | `ATLAS-IR-032` clause 2 "qualifying at `support_boundary`", `ATLAS-IR-095` |

---

## 2. Adversarial findings and adjudications

Format per finding: `ID / REVIEWER / CLAIM / EVIDENCE / VALID / SEVERITY /
REQUIRED_ACTION / RESOLUTION`. "R1…R4" are the four review directions;
"R2nd" marks a round-2 (re-verification) finding.

### 2.1 Round 1

| ID | Reviewer | Claim | Evidence cited | Valid | Severity | Action | Resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RV-1 | R1, R2, R4 | Golden A's table/code facets were `SUPPORTED` at `B4` while the same slice admitted no browser proof for those mechanisms | slice's own A-C6 + §11; `ATLAS-SEM-001`, §9.3 `B4` | YES | HIGH | downgrade or strengthen evidence | A-05/A-06 declared at `B3` (the boundary the evidence covers) with `B4` named `INSUFFICIENT`; A-01's `B4` claim scoped to the proven browser mechanism; gate line `BOUNDARY_ADEQUACY = PASS` |
| RV-2 | R1 | `ATLAS-IR-032` could yield `SUPPORTED` when a facet was `UNKNOWN`, and when an inconvenient facet was never instantiated | rule text | YES | HIGH | make the function total and non-omissible | precedence-ordered clauses 0–5; `UNKNOWN` blocks; clause 2 requires `mapping_state = MAPPED` + a closed-search statement. **Extended again in round 2 → RV-32** |
| RV-3 | R1, R3 | `RolePreset.default_scope` is a reach-shaped field, contradicting C-01 and `ATLAS-IR-039` ("no field expressing resource reach"); no rule made rendering it a violation | `packages/authz/src/presets.ts:40`, `:283`, `:304`, `:365` | YES | HIGH | scope the field's semantics or drop it | `ATLAS-IR-092` added: `default_scope` names a scope **kind** only, may not be rendered as a resource claim, may never satisfy `assignment_required`; C-01 reworded; gate records the corrected item. Enforcement is an R1/R2 projection-conformance obligation (see **RV-9**) |
| RV-4 | R1, R3, R4 | `PolicyValue.activation_status` was hand-settable to `SUPPORTED`; `storable` had no defined semantics; golden D's D-01 asserted a below-boundary `PASS` | `ir-v0.1.md` §4.9; §9.3 `B2` | YES | HIGH | derive the field and split the dimensions | `ATLAS-IR-040a`: `activation_status` is DERIVED from an owning `CAPABILITY_SUPPORT` claim carrying all four conjuncts; `ATLAS-IR-093`: `storable` = schema capacity, `write_reachable` = production writability; D-01 split into D-01a/b/c with the `B2` write claim `INSUFFICIENT` |
| RV-5 | R3 | `assignment_required` could not express the actor-class exemption, so `TRUE` implied Admin is assignment-checked | `apps/api/src/authz/scopedCapability.ts` (Admin short-circuit at `:429` and siblings) | YES | HIGH | model the exemption | `ATLAS-IR-034a` adds `assignment_applies_to`; golden B B-04/C-04 remain honest and are now represented, not just described |
| RV-6 | R3 | The resource anchor and the assignment carrier were fused into one `Scope`, so result publication appeared to be enforced by the *grader* carrier | `apps/api/src/routes/exam.ts:1779-1784`, `routeRegistry.ts:1083-1087`, `:656-660` | YES | HIGH | separate the two | `ATLAS-IR-034b` adds `resource_anchor_ref`; golden B's second trace now uses `scope:course.assignment` with anchor = exam; grade-question anchor = attempt, carrier = exam assignment |
| RV-7 | R3 | Golden C claimed the System preset has an empty capability set | `packages/authz/src/presets.ts:265-270` — four grants; only the runtime context slot is empty (`systemActor.ts:58`) | YES | HIGH (factual) | correct the claim | C-17 rewritten with an explicit correction note; the corrected claim is narrower and true |
| RV-8 | R1, R3, R4 | C-19 asserted `verification = PASS` for an absence claim with no stated search scope; C-20 carried no verification axis | `ATLAS-SEM-023`; §9.3 `B3` | YES | MEDIUM | state the closed search, or downgrade | C-19 now states the search (catalog × presets × captured route surface + a handler scan for `pgdata\|pg_restore\|pg_dump\|wal_\|PG*\|POSTGRES*\|secret`, whose only hits are JWT-secret reads and redaction comments) and cites the two read-only views; C-20 gains `verification = PASS` with runtime evidence |
| RV-9 | R3 | C-14 (a route whose inner block is Admin-only) was a *claim*, not an obligation: no rule forced an in-handler capability branch into the IR, so omitting it would validate | `ir-v0.1.md` §4.5 | YES | MEDIUM | make it an obligation | `ATLAS-IR-091` + `Interface.additional_gates[]`; recorded in the golden C gate. The v0.1 absence of a projection-conformance surface is stated in `ATLAS-IR-092` rather than implied |
| RV-10 | R3 | The host operator was only a *named boundary*; "who is it and what may it do" was not answerable from the model | `ir-v0.1.md` §3.8 | YES | MEDIUM | bind the identity into the model | `ATLAS-IR-031a` + structured `outside_authority` on Scope; claims use `scope:host-infrastructure` as subject |
| RV-11 | R2, R4 | The slices used conflict kinds and statuses outside the closed sets (`DOCUMENTATION_DISSONANCE`, `RESOLVED_BY_SCOPE`, `RESOLVED_BY_CORRECTION`, `RESOLVED_BY_DERIVATION`), violating this design's own `ATLAS-SEM-090` | all four golden files | YES | HIGH | extend the closed sets or reclassify | `ATLAS-SEM-110` gains a sixth kind; `ATLAS-SEM-115` defines a closed resolution-status set with an enforcement rule; stragglers fixed in round 2 → RV-35 |
| RV-12 | R2 | Golden C's C-K3 resolved an ADR-vs-runtime disagreement via the ADR's own Status section, pre-empting `#762` O-03/O-04 | `#762` §2.4; `ATLAS-SEM-013` | YES | HIGH | mark unresolved | C-K3 → `UNRESOLVED` + `DECISION_GATED` (ADR-010 owner, `#762` O-03/O-04); `ATLAS-SEM-114` rewritten to call a Status section a party statement. Round 2 extended the same rule to A-K2 → RV-34 |
| RV-13 | R2 | `semantic-contract.md` §2.1 duplicated the `docs/README.md` fact-type table and claimed ownership of rows the index does not own | `docs/README.md` "Authority by fact type" | YES | HIGH | remove the duplication | demoted to a non-authoritative **locator map** with `*derived*` markers naming the indexed owner; `ATLAS-SEM-015` added. Round 2 found the marking rule was not applied to five rows → RV-36 |
| RV-14 | R2 | A **closed** issue (`#718`) was recorded as the owner of a policy and of a standing invariant | `docs/README.md` (standards own engineering policy; closed issues are historical) | YES | HIGH | attribute to the in-tree owner | §2.1, §4.5, `ATLAS-SEM-033` reworded: `#718` is consumed as historical evidence; the in-tree owner is `docs/standards/testing.md`/`code-quality.md`; the adoption gap is an open item recorded here (§5) |
| RV-15 | R2 | Atlas §9 restated the supported-capability rule owned by EXSEM §5 with different normative force | `docs/architecture/exam-semantic-boundaries.md` §5 (`SUPPORTED_SEMANTIC_TEST`), EXSEM-019 | YES | HIGH | name the owner and declare equivalence | owner statement added; `ATLAS-SEM-079` states the four conjuncts are a **decomposition** of EXSEM §5 and that EXSEM wins on divergence. Round 2 verified the decomposition is faithful (adds state prerequisites, disclosed as conjunct 3) |
| RV-16 | R4 | Two incompatible `resolution` closed sets existed (claim-level vs ref-level), while the contract said one was "defined in" the other | `semantic-contract.md` §8.6 vs `provenance-v0.1.md` §4 | YES | HIGH | distinguish them with a fixed derivation | §8.6 now defines the claim-level set as **derived** from the ref-level states with an explicit mapping and precedence (`ATLAS-SEM-075`/`-076`); `ATLAS-SREF-035` states the relation |
| RV-17 | R4 | The worst-state rule ranged over resolution only, so a claim could report `RESOLVED` while a required ref was stale | `ATLAS-SREF-033` | YES | MEDIUM | extend to both dimensions | `ATLAS-SREF-033` rewritten as worst-of-both with two orders; `ATLAS-SREF-034` states the combination rule; §7.3 declared normative rather than descriptive |
| RV-18 | R4 | External GitHub refs lacked `external_revision` records, and one slice used the wrong field semantics | golden B §6/§7, golden A §6, golden C §7, golden D | YES | MEDIUM | add compliant records | `external_revision` blocks added in all four slices with `observed_state` / `observed_updated_at` (the issue's own last state change) / `observed_at`, and `external_freshness = UNKNOWN` everywhere |
| RV-19 | R4 | `RUNTIME_ROUTE_CAPTURE` evidence was asserted for routes with only static source lines and no capture identity | golden A, golden B B-03 | YES | MEDIUM | name the capture or reclassify | reclassified to `STATIC_SOURCE` for the registration site, with the capture identity named as the whole-app capture test case where a capture is genuinely the evidence |
| RV-20 | R4 | Identity rules were undefined or unstable: no path-template normalization; a grammar that could not produce its own examples; `renamed_from` not in any record shape; durable-entity IDs mirroring physical column names | `ir-v0.1.md` §6 | YES | HIGH | make identity checkable | `ATLAS-IR-026` per-namespace sub-grammars; `-027` path-template normalization; `renamed_from`/`renamed_to`/`retired_at`/`rename_reason` added to the node header; entity IDs renamed to carrier-independent facts (`entity:answer.frozen-submission`, `entity:exam.result-publication`, …) |
| RV-21 | R4 | Normalization rules were stated but unenforceable: edge ordering had no discriminator for qualifying attributes, ordered-array merging was unspecified, `NONE` was used but undefined, and the optional-vs-absent rule had no default table | `ir-v0.1.md` §7 | YES | MEDIUM | make each rule testable | `ATLAS-IR-061` names per-edge discriminator tuples; `-065` covers order-bearing fields; `-068` defines `NONE` vs `UNKNOWN`; `-069` requires an explicit default table |
| RV-22 | R4 | Six evidence rows had an empty `does_not_prove`, violating `ATLAS-SEM-031` | golden A §4, golden B §4/§5, golden C §8, golden D §6 | YES | MEDIUM | state the limits | all six rewritten; round 2 verified zero remaining programmatically |
| RV-23 | R1, R4 | Factual citation errors: a component test's directory; the `publishResults` range running past EOF; `catalog.ts` role line; two ADR-017 anchors; a non-existent interface example in the IR | cited lines | YES | MEDIUM | correct | all corrected; round-2 reviewer verified the replacements |
| RV-24 | R4 | Evidence overclaims: `publishResults.concurrency.test.ts` was said to prove a row-lock schedule it explicitly disclaims; `completeManualEntry` (static SQL) was graded `BEHAVIOURAL_PHYSICAL` | the test's own header `:20-25` | YES | MEDIUM | reclassify and re-word | the concurrency test is `TEST_INTEGRATION` with the snake-lock disclaimer quoted; `completeManualEntry` is `STATIC_SOURCE`/`TOKEN_EXISTENCE` with the physical strength left to `gradingConcurrency.test.ts` |
| RV-25 | R2, R4 | Code comments/modules were named as `B5` authority owners (C-08, B-16) while the contract declares comments non-authoritative | `ATLAS-SEM-033`; EXSEM §6 | YES | MEDIUM | reassign the owner | owners are now `docs/architecture/authorization.md` + EXSEM-001 and EXSEM-018; the modules are the enforcement seam and the evidence |
| RV-26 | R2, R4 | `D-03` claimed `authority_status = CURRENT` while the same slice recorded a partial supersession | `ATLAS-SEM-120`; `timed-sync-semantics.md:11-16` | YES | LOW | use the amended relation | `AMENDED`, with the dated correction cited |
| RV-27 | R4 | `D-K1`'s claim that the wire breadth is "intentional" rested on a test title — the exact evidence kind `ATLAS-SEM-033` discounts | `contracts.test.ts:261-266` | YES | LOW | cite the contract text | now cites `packages/contracts/src/exam.ts:24-29` ("Zod stays shape-level") and `:193`; the test is cited as behavioural evidence only |
| RV-28 | R4 | `D-05`'s "no open issue owns the activation" rested on an unstated scan | `ATLAS-SEM-023` | YES | LOW | state the scope | the scan is stated (33 open issues read in full on 2026-10-11); `#291`'s `external_revision` recorded |
| RV-29 | R1 | `ATLAS-SEM-050` barred work-item closure only at `B3`/`B4`, reading narrower than intended | rule text | YES | MEDIUM | widen | now bars closure at **any** boundary and from all four conjuncts; work items can only place a gap in `GATED`/`DEFERRED` scope ownership |
| RV-30 | R2 | `ATLAS-SEM-114` let a source's own Status section act as a resolution | rule text | YES | MEDIUM | rewrite | rewritten (see RV-12) |
| RV-31 | R2 | A cross-reference pointed at §4.4 instead of §4.5 | `semantic-contract.md` | YES | TRIVIAL | fix | corrected |

### 2.2 Round 2 (re-verification against the corrected head)

| ID | Reviewer | Claim | Evidence cited | Valid | Severity | Action | Resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RV-32 | R1 (2nd) | Clause 2 of `ATLAS-IR-032` was still exploitable: zero parts satisfied it vacuously, and `B3`-only parts could raise a `B4` roll-up ("boundary laundering"); two clause predicates were undefined | rule text | YES | HIGH | close both inputs | clause 2 now requires ≥1 part, every part **qualifying at `support_boundary`**, `mapping_state = MAPPED`, and the closed-search statement; `support_boundary` is a required field; undefined predicates rewritten; `ATLAS-IR-095` aligned |
| RV-33 | R1 (2nd) | `ATLAS-IR-033` was cited as a rule in two places but never defined | `ir-v0.1.md`, golden A | YES | MEDIUM | define it | `ATLAS-IR-033` now states the no-flattening rule explicitly |
| RV-34 | R1 (2nd) | Golden A's A-K2 resolved a disagreement via the document's own scoping — the same pattern as C-K3 | `ATLAS-SEM-114`/`-115` | YES | MEDIUM | mark unresolved or cite a dated owner statement | A-K2 → `UNRESOLVED` + `DECISION_GATED` (status-document owner, `#762` O-10) |
| RV-35 | R1, R2 (2nd) | `golden/manual-grading.md` B-K3's Kind column carried `observed_kind` values instead of conflict kinds; one matter was filed under two different kinds (`TEMPORAL_CONFLICT` in §5 and `EVIDENCE_CONTRADICTION` in §9); golden D's avoided-case row named a Kind outside the closed set while its gate asserted zero | the four slices | YES | MEDIUM | relabel | B-K3 → `DECLARED_VS_RUNTIME_DIVERGENCE`; B-K1 → `TEMPORAL_CONFLICT` in both places; golden D's avoided case moved out of the Kind column |
| RV-36 | R2 (2nd) | §2.1's own marking rule was not applied: five non-index rows lacked the `*derived*` marker required by the section | `semantic-contract.md` §2.1 | YES | MEDIUM | apply the rule | all five rows marked `*derived*` and attributed to their indexed owner |
| RV-37 | R1 (2nd) | A rule citation pointed at `ATLAS-IR-034` where the splitting rule is `ATLAS-IR-034b` | golden B §1 | YES | TRIVIAL | fix | corrected; the same scan found the reference to `ATLAS-IR-091`'s list (`additional_gates[]`) resolves |
| RV-38 | R2 (2nd) | `r0-review.md` was referenced as a delivered artifact and as the record of open items, but did not exist at the reviewed head | `git ls-files` | YES | MEDIUM | add it or remove the references | resolved by this file, which is the first commit at which every reference resolves |

---

## 3. Findings raised but NOT adopted as stated

Adjudication is not blanket acceptance. Four reviewer suggestions were narrowed
or declined, with reasons:

| Finding | Reviewer's requested action | Adjudication |
| --- | --- | --- |
| RV-1 | "refute the claim or downgrade" with the implication that A-05/A-06 should be treated as unjustified claims | **Partially adopted.** The defect is valid; the claim is not unjustified — it is justified *at a lower boundary*. `ATLAS-SEM-001` permits downgrade as a resolution, so the facets are re-declared at `B3` rather than deleted. Deleting them would have hidden a real, evidenced capability, which is the mirror-image error |
| RV-2/RV-32 | delete the roll-up entirely (suggested as the simplest closure) | **Declined.** The Rich slice requires a roll-up that can express "delivered core + residual" — that is the fixture's purpose. The roll-up is kept and hardened instead |
| RV-13/RV-36 | delete the non-index rows from §2.1 | **Partially adopted.** The rows are kept but demoted and marked `*derived*`. Deleting them would force every slice and every future extraction to re-derive the mapping from `docs/README.md`, which is exactly the duplication the index exists to prevent; marking them keeps single ownership while keeping the locator usable |
| RV-8 | demote C-19 to `B5` | **Declined.** The claim is a runtime-absence claim and can be adequately evidenced at `B3` by stating the search; demoting it to `OWNER_JUDGEMENT` would have made it weaker than the evidence actually collected. The search is now stated instead |
| RV-24 | reclassify `publishResults.concurrency.test.ts` as `TEST_PHYSICAL` but with a caveat | **Partially adopted.** Kept at `TEST_INTEGRATION` with the caveat quoted verbatim from the test's own header, because promoting it to `TEST_PHYSICAL` while its own text disclaims the schedule would be precisely the name-vs-mechanism error `ATLAS-SEM-033` exists to catch |
| R2's note that `#762` §9 A2 "adjudicated this as a historical-section annotation rather than an authority conflict" | treat ADR-010's historical sections as settled by that classification | **Partially declined.** `#762` §9 A2 settled the *classification* (not an `AUTHORITY_CONFLICT`) but simultaneously filed O-03/O-04 as **pending owner decisions**. Classification is not resolution, so C-K3 stays `UNRESOLVED` + `DECISION_GATED` (RV-12) |
| RV-10 | admit exactly one non-application actor node type | **Declined.** The structured `outside_authority` block on the `OUTSIDE_APPLICATION_RBAC` scope makes the identity answerable from the model without adding a node type whose only member today is the host operator — and without giving any consumer a place to combine it with role presets |
| RV-20 | normalize parameter names in HTTP paths | **Declined.** The path template is the externally visible contract; `:attemptId` and `:id` are different templates and a rename is a real interface change. Normalizing them would have made the identity insensitive to a contract change |

---

## 4. Schema-overfit stress test

Four hypothetical inputs, attempted **without schema modification** (this is not
a fifth fixture):

| Case | Representation | One-off field needed? |
| --- | --- | --- |
| **1.** Accepted design + implementation absent | `design = ACCEPTED`, `implementation = ABSENT`, `activation_support = DEFERRED` (accepted design + owning work item) or `NOT_SUPPORTED` (no owner), `open_governance_item = WORK_ITEM`. **Real instance in this repository**: `docs/architecture/product-capability-composition.md`, adopted by ADR-022 (`Status: ACCEPTED`, 2026-10-02), **zero implementation** at the base revision (symbol search for `resolveDeploymentProductConfiguration` / `supportedProductCatalog` over `packages/`+`apps/` finds no source file), tracked by OPEN `#678`, and `docs/README.md:120-123` states exactly that ("Adopted design not yet implemented … zero implementation at master") | NO |
| **2.** Runtime operation exists + descriptive documentation stale | Two claims (`RUNTIME_OBSERVATION`, `DOCUMENTATION_DISSONANCE`/`TEMPORAL_CONFLICT`) + `Interface` declared-vs-runtime blocks + `resolution`/`freshness` on the refs. Worked for real in golden C C-K2 and golden D's migration/comment traps | NO |
| **3.** Evidence disappears + claim authority remains | `resolution = MISSING_REF` (claim-level) / `resolution_state = MISSING` (ref-level), `freshness = STALE`, `verification → INSUFFICIENT` or `UNKNOWN`. The authority fields are untouched because they are separate columns; the claim degrades without losing its owner | NO |
| **4.** Implementation present + activation intentionally gated | `implementation = PRESENT` or `PARTIAL`, `activation_support = GATED`, `PolicyValue.activation_gate = { locator, lift_condition }`, `refusing_seams[]`, `open_governance_item = DECISION_GATED`. Worked for real in golden D (`timed_sync`) and its second class (the enforcement-less control flags, `implementation = ABSENT`) | NO |

```text
SCHEMA_OVERFIT = NO
```

No case required a new field, a slice-specific branch, or a value outside the
closed sets. Case 1 is not hypothetical — it is an existing adopted-but-unbuilt
capability, which is the strongest available evidence that the axis split carries
a real input class rather than a designed-for-one-fixture shape.

---

## 5. Open items, known conflicts, deferrals

### 5.1 OPEN_UNKNOWNS (all left open on purpose — `ATLAS-SEM-003`)

```text
Rich (4):        whether every originally-discussed facet is enumerable; the B-F01
                 classification (contract owner); a candidate-take doc-keyed branch;
                 external freshness of #679/#756
Manual grading (4): completeness of assignment-gate coverage across grading surfaces;
                 hand-written DB writes outside the application; historical
                 inconsistent rows in any deployment; #552's historical closure reason
RBAC (6):        the per-module identity of the 14 registry gaps (attributed to #762,
                 not re-derived); whether the registry's exhaustive-intent claim
                 should hold or be narrowed (owner); the user-facing severity of the
                 permission-matrix hazard (#762 U-03); external freshness of #762;
                 host-operator practice documented outside ADR-017; whether every one
                 of the 148 routes is single-gated at runtime
timed_sync (5):  the PATCH/draft-update refusal has no API-level test; historical
                 deployment rows; hand-opened rows; the answerVisibility=visible UI
                 branch; external freshness of #291/#292
```

Retained `UNKNOWN`s are the *correct* outcome for each of these; none was
converted into a guess, and `HIDDEN_KNOWN_UNKNOWNS = 0`.

### 5.2 KNOWN_CONFLICTS (all `UNRESOLVED` with an owner, except where a dated owner statement settles them)

```text
Rich            A-K1  DOCUMENTATION_DISSONANCE  rich contract §4 "B-F01 NOT FIXED" vs the
                                               as-built rejection at the closure seam
                                               -> DECISION_GATED, contract owner (#762 O-06)
                A-K2  TEMPORAL_CONFLICT        status-document historical wording
                                               -> DECISION_GATED, status owner (#762 O-10)
Manual grading  B-K1  TEMPORAL_CONFLICT        a research doc still cites deleted E2E
                                               -> docs owner (bounded: non-authoritative)
                B-K2  DECLARED_VS_RUNTIME_DIVERGENCE  stale production JSDoc on grading
                                               -> WORK_ITEM (#762 O-09)
                B-K3  DECLARED_VS_RUNTIME_DIVERGENCE  granted-but-unconsumed capability
                                               -> RESOLVED_BY_DERIVATION (Atlas-derived `inert`)
RBAC            C-K1  DECLARED_VS_RUNTIME_DIVERGENCE  113 declared vs 127 protected
                                               -> WORK_ITEM (#762 O-07). Both facts preserved
                C-K2  DECLARED_VS_RUNTIME_DIVERGENCE  permission matrix shows no scope
                                               -> DECISION_GATED (#762 O-08)
                C-K3  TEMPORAL_CONFLICT        ADR-010 historical sections vs runtime
                                               -> DECISION_GATED (ADR owner, #762 O-03/O-04)
                C-K4  EVIDENCE_CONTRADICTION   the #762 input attributed the host-operator
                                               statement to the runbook (it is ADR-017)
                                               -> RESOLVED_BY_CORRECTION (Atlas-side)
timed_sync      D-K1  DECLARED_VS_RUNTIME_DIVERGENCE  OpenAPI advertises the value while
                                               the validator refuses it -> policy/contract owner
                D-K2  DECLARED_VS_RUNTIME_DIVERGENCE  column/migration comments assert a
                                               command that does not exist -> source owner
                D-K3  (no conflict)            RESOLVED_BY_SCOPE under all four conditions
                                               of ATLAS-SEM-115
```

`AUTHORITY_CONFLICT = 0` across all four slices: every disagreement was either a
declared-vs-runtime divergence, a documentation dissonance, a temporal conflict,
or was settled by a dated owner statement. `SILENT_CONFLICT_RESOLUTION = 0`.

### 5.3 Items NOT fixed because they belong to an owner

```text
#762 O-01..O-05   ADR amendment notes (permission renames, inert grants, registry
                  "not implemented" section, Shadow Permission Mode, ADR-017 R4-8)
#762 O-06         the rich contract's B-F01 classification
#762 O-07         route-registry coverage gap (14 entries) and the missing
                  runtime->registry completeness assertion
#762 O-08         permission-matrix scope presentation (product/UX)
#762 O-09         stale production JSDoc in gradingQueue.ts
#762 O-10         status-document wording
#762 U-01, U-03    dynamic/out-of-repo writers; permission-matrix user impact
```

R0 records these and fixes **none** of them, per its hard scope.

### 5.4 DEFERRED_TO_R1 (implementation concerns only)

```text
1. Implement the deterministic writer and prove the R0-B normalization contract
   (double-rebuild byte identity), the broken-locator -> STALE/MISSING behaviour,
   the ambiguity detection, and the identity-stability test across a pure move/rename.
2. Adopt the real-PostgreSQL `pg_class` vocabulary into docs/standards/ so the
   standing check has an in-tree policy owner (currently consumed as historical
   evidence from a closed issue).
3. Re-derive the registry's declared/exposed divergence from the actual route
   surface rather than inheriting #762's per-module breakdown.
4. Implement a projection-conformance surface that can enforce ATLAS-IR-091 and
   ATLAS-IR-092 mechanically (v0.1 states the rules; no conformance surface exists).
5. Decide whether `Fact` and `Claim` remain records or ever need node identity —
   deferred because no v0.1 query requires it (documented in ir-v0.1.md §3.13).
```

No **semantic** defect was deferred: every round-1 and round-2 finding that
affected a rule, a boundary, an identity or a claim was fixed in this PR.

---

## 6. Verification performed for this freeze

```text
git diff --check                                  PASS (clean)
source refs bound to R0_BASE                      YES; external refs carry external_revision
all referenced repository paths exist at R0_BASE  YES (each cited file read; anchors corrected in RV-23/RV-37)
all cited Git SHAs resolve                        YES (cbe33db1 base; dba53ada / b0e7a7ff deletions)
Accepted ADR decision text changed                NO
production runtime behaviour changed              NO (Markdown only under docs/architecture/atlas/)
DB schema / migrations changed                    NO
R1 implementation leaked in                       NO
secrets or private candidate data embedded        NO (independently reported twice)
four golden slices use one schema                 YES
rule-reference resolution                         every ATLAS-SEM / ATLAS-IR / ATLAS-SREF cited in the
                                                  design area resolves, with ATLAS-IR-033 and
                                                  ATLAS-IR-091/092/093/095 added or defined during review
boundary adequacy                                 every SUPPORTED claim declares a boundary its evidence covers
                                                  (A-05/A-06 corrected; D-01 split)
local gates                                       see §7
exact-head CI                                     see §7
```

## 7. Gate summary

```text
R0_A = PASS   R0_B = PASS   R0_C = PASS   R0_D = PASS
GOLDEN_RICH = PASS   GOLDEN_MANUAL_GRADING = PASS   GOLDEN_RBAC = PASS   GOLDEN_NEGATIVE_CONTROL = PASS

FALSE_SUPPORT                       = 0   (round-2 residual inputs closed by RV-32)
UNJUSTIFIED_SUPPORTED_CLAIMS        = 0   (RV-1, RV-4)
HIDDEN_AUTHORITY_CONFLICT           = 0   (RV-13/14/15 closed; round-2 marker defects RV-36 closed)
DUPLICATE_AUTHORITY                 = 0
FALSE_RBAC_AUTHORITY                = 0   (RV-3, RV-5, RV-6, RV-7)
MISSING_SCOPE_DIMENSION             = 0   (RV-5, RV-6)
REGISTRY_RUNTIME_CONFLATION         = 0
UNRESOLVED_SOURCE_REF_HAZARDS       = 0   (RV-18, RV-19, RV-20, RV-21)
UNSTABLE_IDENTITIES                 = 0   (RV-20)
EVIDENCE_OVERCLAIM                  = 0   (RV-22, RV-24)
SENSITIVE_DATA_LEAK                 = 0
SCHEMA_OVERFIT                      = NO
SLICE_SPECIFIC_SCHEMA_HACKS         = 0
HIDDEN_KNOWN_UNKNOWNS               = 0
SILENT_CONFLICT_RESOLUTION          = 0
FORCED_UNKNOWN_TO_KNOWN             = 0
CONFLICT_KINDS_OUTSIDE_CLOSED_SET   = 0   (RV-11, RV-35)

ACCEPTED_ADR_DECISION_TEXT_CHANGED  = NO
PRODUCTION_BEHAVIOR_CHANGED         = NO
R1_IMPLEMENTATION_LEAKAGE           = NO
MUST_FIX                            = none
MUST_RESTORE                        = none
```

## 8. R0 verdict

```text
R0_VERDICT              = APPROVE
NEXT_PHASE_AUTHORIZED   = R1
PR_DISPOSITION          = MERGE
READY_FOR_HUMAN_MERGE   = YES
```

The verdict is a *recommendation*, not a merge. `#763` §17 requires that R0 stop
at `READY_FOR_HUMAN_MERGE = YES`: this PR is not merged, R1 is not started, and
the downstream phase tickets are not re-authorized by this document. The human
gate reviews R0 before merge and before R1 is authorized.

Honest scope of the verdict: R0 approves a **semantic contract and representation
model**, not an implementation. Nineteen `UNKNOWN`s and ten open
conflicts remain by design (plus one recorded non-conflict), and five concrete
items are deferred to R1 (§5.4). The claim this
document supports is narrow and specific: *the model can represent Exam reality
without inventing support, authorization, evidence, completeness or authority,
and where it cannot, it says so.*
