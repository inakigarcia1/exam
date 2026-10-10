# Golden slice A — Rich Subjective

> **Fixtures are falsification cases, not Atlas content.** This slice exists to
> break [`semantic-contract.md`](../semantic-contract.md) and
> [`ir-v0.1.md`](../ir-v0.1.md), not to demonstrate them.
>
> **Base revision:** `cbe33db1a7f241ba85aadbf21c4f6dea01133f03` (R0 base).
> Every repository source ref below is bound to that revision unless marked
> `HISTORICAL` or `external`. GitHub refs are `external` with a capture record.
>
> **Required falsification:** `#679/#301 CLOSED ⇒ every originally discussed
> Rich UX facet delivered` must be **rejected**, while `delivered core = true`
> and `some optional/residual facet = deferred/residual/unknown/separate
> follow-up` hold **simultaneously**.

---

## 1. Logical IDs

| ID | Kind | Note |
| --- | --- | --- |
| `capability:content.rich-subjective` | Capability | Rich prompt/answer content for subjective questions |
| `facet:content.rich.formula` | Facet | Formula (inline + block) authoring/save/render/re-edit |
| `facet:content.rich.table` | Facet | Table authoring/save/render |
| `facet:content.rich.code` | Facet | Code-block authoring/save/render |
| `facet:content.rich.typed-shortcuts` | Facet | Global formula-entry shortcut + `$…$` typed delimiters |
| `facet:content.rich.visual-source-sync` | Facet | Bidirectional expert-source ↔ visual-field synchronization |
| `facet:content.rich.char-count` | Facet | Character count in the candidate editor |
| `facet:content.rich.attachments` | Facet | Image / file attachment nodes |
| `workflow:answer.save-rich` | Workflow | Candidate writes a rich answer draft |
| `workflow:answer.render-rich` | Workflow | A stored document is rendered (take / result / grading / preview) |
| `workflow:content.author-rich` | Workflow | Staff authors rich question content |
| `operation:answer.save-answer` | Operation | `POST /api/attempts/:attemptId/answers/:questionId` |
| `operation:content.canonicalize` | Operation | Canonicalize + validate a document at a durable boundary |
| `interface:http.POST./api/attempts/:attemptId/answers/:questionId` | Interface | Answer save protocol |
| `entity:content.document-v1` | DurableEntity | Stored `ContentDocumentV1` payloads |
| `policy:content.docVersion/v1` | PolicyValue | The document version value |
| `authority:rich-contract` | NormativeAuthority | `docs/architecture/rich-content-semantic-contract.md` (ADR-019) |
| `authority:adr-019` | NormativeAuthority | Content document model decision |
| `authority:exsem` | NormativeAuthority | Cross-boundary semantics (EXSEM-019) |
| `work:jnhu76/exam#301` | WorkItem | Content/WYSIWYG V1 |
| `work:jnhu76/exam#679` | WorkItem | Math editing UX |
| `work:jnhu76/exam#669` | WorkItem | Rich Subjective umbrella |
| `work:jnhu76/exam#756` | WorkItem | Formula UX residuals (OPEN) |

---

## 2. Claims

`boundary` uses the IR/semantic-contract identifiers `B0`–`B6` — opaque
identifiers, not a severity order; adequacy is `boundary_coverage` membership
(`ATLAS-SEM-083`).

### 2.1 Capability boundary — the delivered core

| # | Subject | Claim | `claim_kind` | boundary | Axes | Authority owner | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A-01 | `capability:content.rich-subjective` | Candidate rich `text_response` answering is a supported product capability: an authoring surface, a save path with canonical closure, a render path and a re-edit path exist and are reachable, with the browser composition proven for the editor/formula/reload path (per-facet gaps are separate claims A-05/A-06) | `CAPABILITY_SUPPORT` | `B4` | design `ACCEPTED`, implementation `PRESENT`, verification `PASS`, activation_support `SUPPORTED`, freshness `CURRENT`, resolution `RESOLVED` | `authority:rich-contract` + `authority:adr-019` | **SUPPORTED** |
| A-02 | `capability:content.rich-subjective` | The document grammar is a **closed** vocabulary; unknown nodes/marks/attributes fail validation rather than being silently dropped | `AUTHORITY_STATEMENT` | `B5` | design `ACCEPTED`, verification `PASS` | `authority:rich-contract` | asserted by authority |
| A-03 | `capability:content.rich-subjective` | Documents are canonicalized before durable acceptance, and a non-canonical document is rejected with the existing `INVALID_ANSWER` category | `DURABLE_EFFECT` | `B2` | implementation `PRESENT`, verification `PASS` | `authority:rich-contract` | **SUPPORTED at B2** |

### 2.2 Facet boundary — delivered parts

| # | Subject | Claim | `claim_kind` | boundary | Axes | Authority owner | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A-04 | `facet:content.rich.formula` | Inline and block formulas are authored (visual LaTeX entry), saved, rendered and re-edited | `CAPABILITY_SUPPORT` | `B4` | implementation `PRESENT`, verification `PASS`, activation_support `SUPPORTED` | `authority:rich-contract` | **SUPPORTED** |
| A-05 | `facet:content.rich.table` | Tables (cells = paragraphs only) are authored, saved and rendered; the authoring surface, the save path and the render path are reachable | `CAPABILITY_SUPPORT` | **`B3`** (see A-C6) | implementation `PRESENT`, **verification `PASS` at `B3` / `INSUFFICIENT` at `B4`**, activation_support `SUPPORTED` **at `B3` only** | `authority:rich-contract` | **SUPPORTED at B3; B4 INSUFFICIENT** |
| A-06 | `facet:content.rich.code` | Code blocks are authored, saved and rendered; the authoring surface, the save path and the render path are reachable | `CAPABILITY_SUPPORT` | **`B3`** (see A-C6) | implementation `PRESENT`, **verification `PASS` at `B3` / `INSUFFICIENT` at `B4`**, activation_support `SUPPORTED` **at `B3` only** | `authority:rich-contract` | **SUPPORTED at B3; B4 INSUFFICIENT** |

### 2.3 Facet boundary — residuals (the falsification core)

| # | Subject | Claim | `claim_kind` | boundary | Axes | Authority owner | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A-07 | `facet:content.rich.typed-shortcuts` | A global formula-entry shortcut and generally-promised `$…$` / `$$…$$` typed delimiters were **not adopted** | `RESIDUAL_OR_EXCLUSION` | `B5` | design `REJECTED` (not adopted), implementation `ABSENT`, activation_support `NOT_SUPPORTED` | the work item's own record (`work:jnhu76/exam#679`, `work:jnhu76/exam#756`) | **NOT_SUPPORTED** |
| A-08 | `facet:content.rich.visual-source-sync` | Full bidirectional expert-source ↔ visual-field synchronization was **not delivered**; a KaTeX preview was | `RESIDUAL_OR_EXCLUSION` | `B5` | design `ACCEPTED` (preview), implementation `PARTIAL` (preview present, sync absent), activation_support `DEFERRED` | `work:jnhu76/exam#756` (owner decision issue) | **DEFERRED**, `open_governance_item.kind = WORK_ITEM` |
| A-09 | `facet:content.rich.char-count` | Character count is **not shipped**, deliberately: no ContentDocument-independent counting semantic exists and no product limit depends on one | `RESIDUAL_OR_EXCLUSION` | `B5` | design `REJECTED` for now (recorded as optional scoped follow-up), implementation `ABSENT`, activation_support `NOT_SUPPORTED` | `docs/design/candidate-rich-editor-ux.md` (design authority for candidate interaction) | **NOT_SUPPORTED** (follow-up scoped) |
| A-10 | `facet:content.rich.attachments` | Image/attachment nodes do not exist; an Asset authority is a prerequisite (the schema comment names `ContentDocumentV2`) | `RESIDUAL_OR_EXCLUSION` | `B5` | design `DEFERRED`, implementation `ABSENT`, activation_support `NOT_SUPPORTED` | `authority:rich-contract` + `authority:adr-019` | **NOT_SUPPORTED** (prerequisite absent) |
| A-11 | `capability:content.rich-subjective` (roll-up) | The capability's support state is **`MIXED`**: a supported delivered core coexists with not-supported/deferred facets | `CAPABILITY_SUPPORT` (derived roll-up, `ATLAS-IR-032`/`-033`) | — | `support_summary = MIXED`, `support_boundary = B4`, `mapping_state = MAPPED` with the enumeration criterion of `ATLAS-IR-032` met by a **named basis**: the rich contract's feature inventory and V2-extension notes (delivered core; attachments), OPEN `#756`'s residual list (typed shortcuts, visual/source sync), and the candidate-editor design doc's recorded rejections (char count), all at `cbe33db1`; whether sources *beyond that basis* discuss further facets is A-U1's separate `UNKNOWN` and does not lower coverage (`ATLAS-SEM-102`) | derived | **MIXED** |

`ATLAS-IR-033` is the rule that makes A-01 and A-07…A-10 coexist without
contradiction: the roll-up is `MIXED`, not a boolean.

### 2.4 Work-history and evidence-role claims

| # | Subject | Claim | `claim_kind` | Axes | Authority owner | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| A-12 | `work:jnhu76/exam#301` | Closed 2026-08-31 as completed for **Content/WYSIWYG V1** scope; its own body defers image/asset work pending an Asset authority | `WORK_STATUS` | `closure_semantics = CLOSED_PARTIAL` (body names an explicit deferral) | the issue record (external) | **CLOSED_PARTIAL** |
| A-13 | `work:jnhu76/exam#679` | Closed 2026-10-09 as completed for **math editing UX**, and its own header states that global shortcuts and visual/source synchronization were **not adopted and are not claimed as implemented** | `WORK_STATUS` | `closure_semantics = CLOSED_PARTIAL` | the issue record (external) | **CLOSED_PARTIAL** |
| A-14 | `work:jnhu76/exam#756` | OPEN; owns the four residuals (typed shortcuts, visual/source sync, bounded `$$$…$$$` inventory, formula-focused accessibility/viewport evidence) | `WORK_STATUS` | `state = OPEN`, `open_governance_item.kind = WORK_ITEM` | the issue record (external) | **OPEN** |
| A-15 | `work:jnhu76/exam#669` | Closed 2026-10-05 for the Rich Subjective umbrella (protocol/backend closure → candidate editor UX → adversarial proof) | `WORK_STATUS` | `closure_semantics = CLOSED_IMPLEMENTED` for the umbrella's named stages | the issue record (external) | **CLOSED_IMPLEMENTED** (umbrella scope only) |
| A-16 | `capability:content.rich-subjective` | `#679` and `#301` being CLOSED is **not** evidence that every originally discussed Rich UX facet was delivered | `CAPABILITY_SUPPORT` (rejection) | `verification = INSUFFICIENT` for that proposition at any boundary | — | **REJECTED** (see §5) |

---

## 3. Authority owners

| Fact type | Owner | Source ref |
| --- | --- | --- |
| Rich V1 grammar, canonicalization, limits, read/write/render seams | `docs/architecture/rich-content-semantic-contract.md`, adopted by ADR-019 | `REPO_SECTION docs/architecture/rich-content-semantic-contract.md §2/§4` @ `cbe33db1` |
| The content-document decision itself | ADR-019 | `REPO_SECTION docs/adr/ADR-019-content-document-model.md` (status `ACCEPTED`, amended 2026-10-02) @ `cbe33db1` |
| Representability ≠ support (the rule this slice leans on) | EXSEM-019 | `REPO_SECTION docs/architecture/exam-semantic-boundaries.md:86` @ `cbe33db1` |
| Candidate editor interaction contract (incl. the char-count decision) | `docs/design/candidate-rich-editor-ux.md` | `REPO_SECTION docs/design/candidate-rich-editor-ux.md:215-221` @ `cbe33db1` |
| What was requested / not adopted / left residual | the work items themselves | external (GitHub) |
| What the code does today | production code + tests | `cbe33db1` |

`/` note: the authority for *delivered scope* is **not** the work item and **not**
a status document — it is the code plus the contract, with the work item
supplying only intent and residual scope (`ATLAS-SEM-050`).

---

## 4. Supporting evidence

| Evidence | Kind | Strength | `proves` | `does_not_prove` |
| --- | --- | --- | --- | --- |
| `packages/domain/src/content/contentDocument.ts:134` `ContentDocumentV1` + closed block/inline/mark unions (`:30-31`, `:65-68`, `:124-130`) | `STATIC_SOURCE` | `TOKEN_EXISTENCE` | The grammar is closed and enumerable | That any surface uses it |
| `packages/contracts/src/contentDocument.ts:248` `ContentDocumentV1Schema` with `.strict()` (`:32-35`) | `CONTRACT` | `TOKEN_EXISTENCE` | Wire-level strictness is required | Runtime rejection behaviour |
| `packages/contracts/src/contentDocument.ts:34-35` — image/attachment nodes absent pending an Asset authority | `CONTRACT` | `TOKEN_EXISTENCE` | Attachments are grammatically impossible in V1 | That no other surface advertises attachments (a UI-inventory question this slice does not answer) |
| `packages/contracts/src/contentDocument.ts:268` `canonicalizeContentDocument` | `STATIC_SOURCE` | `TOKEN_EXISTENCE` | A canonicalization seam exists | That it is applied at every durable boundary |
| `apps/api/src/lib/validateAnswerForQuestion.ts:118-159`, closure rejection at `:151-157` | `STATIC_SOURCE` | `TOKEN_EXISTENCE` | The save path re-validates the canonical value before durable acceptance | That the rejection is reachable over the wire |
| `apps/api/src/routes/attempts.candidate.ts:944-945` — `POST /attempts/:attemptId/answers/:questionId` (registered under the `/api` prefix) | `STATIC_SOURCE` (registration site). The `RUNTIME_ROUTE_CAPTURE` evidence for the composed surface is the whole-app capture test (`apps/api/src/authz/routeRegistryConformanceWholeApp.test.ts`), whose capture identity is that test case; no separate capture artefact exists at R0 | `TOKEN_EXISTENCE` | The answer-save interface is registered on the candidate surface | That the composed app exposes it (the capture test asserts the route-count split, not this route's metadata); its scope/idempotency behaviour or its durable effect |
| `apps/api/src/routes/answerRichClosure.test.ts:192-199` — merge-class seed rejected at the wire with `accepted: false`, `reason: "INVALID_ANSWER"` | `TEST_INTEGRATION` | `BEHAVIOURAL_COMPOSITION` | The closure rejection is reachable through the HTTP composition and no durable write is accepted | Browser behaviour; the *set* of all non-canonical classes |
| `apps/api/src/lib/validateAnswerForQuestion.test.ts:234` — validation rejects the merge-class seed | `TEST_SEMANTIC` | `BEHAVIOURAL_PURE` | The pure validation decision for that class | HTTP surface, persistence |
| `apps/e2e/e2e/rich-content.spec.ts` — block/inline formula insert → save → reload → submit; paste/drag; typed-math rules | `TEST_INTEGRATION` (browser E2E, `BEHAVIOURAL_BROWSER`) | `BEHAVIOURAL_BROWSER` | The browser composition: contenteditable → adapter → save → reload → re-edit survives, which is a browser-only mechanism (`docs/standards/testing.md` §4.0) | Table/code node families; authoring by staff |
| `apps/e2e/e2e/rich-editor-input-boundaries.spec.ts` — first-keystroke survival, list Tab containment, persisted-formula re-edit | `TEST_INTEGRATION` (browser E2E) | `BEHAVIOURAL_BROWSER` | Editor interaction boundaries in a real browser | Anything outside the exercised interactions |
| `apps/web/src/components/shared/content/contentAdapter.test.ts`, `ContentRenderer.security.test.tsx`, `ContentRenderer.trust.test.tsx`, `MathRenderer.evidence.test.tsx`; `apps/web/src/components/exam/RichTextAnswerInput.readTrust.test.tsx` | `TEST_SEMANTIC` (component/jsdom) | `BEHAVIOURAL_PURE` | Read-classification and render-path decisions, incl. the math trust boundary | Real layout, real KaTeX rendering fidelity, browser selection behaviour |
| `docs/design/candidate-rich-editor-ux.md:215-221` — char count not shipped, reason recorded | `CONTRACT` (design authority) | `OWNER_JUDGEMENT` | The char-count exclusion and its rationale | What any *other* surface displays; whether a future counting semantic will be adopted |
| `docs/architecture/rich-content-semantic-contract.md` §2/§4 (grammar + the `B-F01` seam record) | `CONTRACT` | `OWNER_JUDGEMENT` | The frozen grammar and the seam's declared status | That the seam's declared status matches as-built (checked in §5) |
| `work:jnhu76/exam#756` (OPEN) body — residual list | `HISTORICAL_WORK_ITEM` | `OWNER_JUDGEMENT` | What is explicitly still outstanding and un-adopted | Current implementation of those residuals (they are absent) |
| `work:jnhu76/exam#679` header — "not adopted and are not claimed as implemented" | `HISTORICAL_WORK_ITEM` | `OWNER_JUDGEMENT` | The author's own exclusion of shortcuts/sync | Anything about delivered code |

### 4.1 Evidence roles are distinct

- **CONTRACT** fixes the grammar and the strictness requirement; it cannot show
  that any surface honours them.
- **STATIC_SOURCE** shows the seams exist and where they are; it cannot show
  reachability or durable effect.
- **TEST_INTEGRATION** (HTTP composition with real PostgreSQL) shows the
  rejection is reachable and durably inert for that input class.
- **Browser E2E** shows the browser-only mechanisms; it is the only evidence that
  can establish the editor/reload/re-edit composition.
- **HISTORICAL_WORK_ITEM** shows intent, non-adoption and residual ownership; it
  is never evidence of delivered scope.

No layer substitutes for another (`ATLAS-SEM-035`).

---

## 5. Challenging evidence

| # | Challenge | Evidence | Consequence for the claims |
| --- | --- | --- | --- |
| A-C1 | `#679` is CLOSED, which naively reads as "formula UX complete" | `work:jnhu76/exam#679` header states global shortcuts and visual/source sync were not adopted; `work:jnhu76/exam#756` is OPEN with four named residuals (external, captured 2026-10-11) | Forces `CLOSED_PARTIAL` for A-13 and `NOT_SUPPORTED`/`DEFERRED` for A-07/A-08. The naive reading is **rejected**; the closed state alone cannot support the delivered-scope proposition (A-16) |
| A-C2 | `#301` is CLOSED and its scope mentions "asset-ready" | `work:jnhu76/exam#301` body defers image/asset work pending an Asset authority; `packages/contracts/src/contentDocument.ts:34-35` states image/attachment nodes do not exist | Forces A-10 `NOT_SUPPORTED` (prerequisite absent) and A-12 `CLOSED_PARTIAL` |
| A-C3 | The rich contract §4 still records the `B-F01` merge-class seam as **"NOT FIXED by this Phase-B authority pass"** (repair algorithm deferred to Phase-C/D) | `docs/architecture/rich-content-semantic-contract.md` §4; as-built the merge class is **rejected at the closure seam** (`validateAnswerForQuestion.ts:151-157`; wire proof `answerRichClosure.test.ts:192-199`) | A **DOCUMENTATION_GAP/DISSONANCE** between the authority's current text and as-built behaviour. Atlas reports the authority as `CURRENT` but records the divergence; it does **not** upgrade the contract text (out of R0 scope) and does **not** call the seam "fixed" on the strength of the code alone |
| A-C4 | Status documents use broad acceptance language | `docs/status/implementation-status.md:129-130`, `:236-238` ("shipped … accepted/current" scoped to ADR-019); `docs/SPEC.md:748-750` ("Rich 题干/答案与公式编辑已由 ADR-019 / #301 交付") | Broad wording is **not** a false claim of the *whole* originally-discussed UX, but it is a careless-reader hazard: it would let a reader infer A-16. Recorded as a hazard with the exact scoping that limits it; the wording question itself is A-K2 |
| A-C5 | A test named for a guarantee may not provide it | Not applicable to this slice's claims (the Rich browser specs exist and were not pruned); retained as a general hazard demonstrated in slice C | No consequence for this slice's verdicts |
| A-C6 | Per-layer evidence is uneven across this capability | Table/code facets have component-level tests but **no browser E2E** exercising table authoring through the real editor; the browser specs cover formulas and input boundaries | A-05/A-06 are therefore declared at **`B3`**, not `B4`: at `B4` their verification is `INSUFFICIENT` because the browser mechanism (contenteditable table editing) is the unproven conjunct. A-01's `B4` claim is scoped to the browser mechanism that *is* proven (editor/formula/reload path), so the two are consistent rather than contradictory |

`ATLAS-SEM-041` satisfied: the falsification attempt produced A-C1…A-C6, and two
of them (A-C3, A-C6) changed the recorded state.

---

## 6. Source refs

All refs are `RESOLVED` at `git_sha cbe33db1a7f241ba85aadbf21c4f6dea01133f03`
with `repo_freshness = CURRENT` for the R0 snapshot base.

| Ref | `source_kind` | anchor |
| --- | --- | --- |
| `packages/domain/src/content/contentDocument.ts` | `REPO_FILE` | `:30-31`, `:65-68`, `:124-130`, `:134`, `:148-169`, `:560` |
| `packages/contracts/src/contentDocument.ts` | `REPO_FILE` | `:32-35`, `:248`, `:268` |
| `apps/api/src/lib/validateAnswerForQuestion.ts` | `REPO_SYMBOL` | validation + canonical closure `:118-159` |
| `apps/api/src/routes/attempts.candidate.ts` | `REPO_SYMBOL` | answer-save route `:944-945`, invocation `:1094` |
| `packages/contracts/src/attempt.ts` | `REPO_FILE` | `:203-206` |
| `apps/api/src/routes/answerRichClosure.test.ts` | `TEST_CASE` | "rejects the merge-class seed at the wire with INVALID_ANSWER" |
| `apps/api/src/lib/validateAnswerForQuestion.test.ts` | `TEST_CASE` | merge-class rejection |
| `apps/e2e/e2e/rich-content.spec.ts` | `TEST_CASE` | file (browser E2E) |
| `apps/e2e/e2e/rich-editor-input-boundaries.spec.ts` | `TEST_CASE` | file (browser E2E) |
| `apps/web/src/components/shared/content/contentAdapter.test.ts`, `ContentRenderer.security.test.tsx`, `ContentRenderer.trust.test.tsx`, `MathRenderer.evidence.test.tsx`, `apps/web/src/components/exam/RichTextAnswerInput.readTrust.test.tsx` | `TEST_CASE` | each file is one resolvable target (no glob) |
| `docs/architecture/rich-content-semantic-contract.md` | `REPO_SECTION` | §2 authority block; §4 `B-F01` record |
| `docs/adr/ADR-019-content-document-model.md` | `REPO_SECTION` | Status |
| `docs/design/candidate-rich-editor-ux.md` | `REPO_SECTION` | `:215-221`, `:298-301` |
| `docs/architecture/exam-semantic-boundaries.md` | `REPO_SECTION` | `:86` (EXSEM-019) |
| `docs/status/implementation-status.md`, `docs/SPEC.md` | `REPO_SECTION` | `:129-130`, `:236-240`; `:748-750` |
| `work:jnhu76/exam#301`, `#669`, `#679`, `#756` | `GITHUB_ISSUE` (`external`) | see the external-revision block below |

External refs (SREF-1 `external_revision` triple; external freshness is a
dimension separate from the repo SHA — `provenance-v0.1.md` §7.2):

```text
work:jnhu76/exam#301  external_revision { observed_state: CLOSED, observed_updated_at: 2026-08-31, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#669  external_revision { observed_state: CLOSED, observed_updated_at: 2026-10-05, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#679  external_revision { observed_state: CLOSED, observed_updated_at: 2026-10-09, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#756  external_revision { observed_state: OPEN,   observed_updated_at: 2026-10-11, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
work:jnhu76/exam#763  external_revision { observed_state: OPEN,   observed_updated_at: 2026-10-11, observed_at: 2026-10-11 }  external_freshness: UNKNOWN
```

`observed_updated_at` is the issue's own last observed state change (its close
date where closed), not the observation time; `observed_at` is when R0 read it.
All external freshness values are `UNKNOWN` because no re-check was performed.

---

## 7. Work items

| ID | State | `closure_semantics` | Relation to this slice |
| --- | --- | --- | --- |
| `work:jnhu76/exam#301` | CLOSED (2026-08-31) | `CLOSED_PARTIAL` | DELIVERS the core grammar/content model; defers asset work |
| `work:jnhu76/exam#669` | CLOSED (2026-10-05) | `CLOSED_IMPLEMENTED` (umbrella stages) | DELIVERS protocol/backend closure + editor UX stages |
| `work:jnhu76/exam#679` | CLOSED (2026-10-09) | `CLOSED_PARTIAL` | DELIVERS math UX core; explicitly excludes shortcuts + sync |
| `work:jnhu76/exam#756` | OPEN | `OPEN` | RESIDUAL owner — the four named residual facets |
| `work:jnhu76/exam#763` | OPEN | `OPEN` | This R0 design work (not a product work item) |

---

## 8. UNKNOWN

| ID | Unknown | Why it remains UNKNOWN | Not converted into |
| --- | --- | --- | --- |
| A-U1 | Whether every originally-discussed Rich UX facet from the #669/#679/#301 discussions is enumerated | The issue bodies name their own exclusions, but no source claims to enumerate the *complete* original discussion; a full issue-comment archaeology is out of R0 scope | **Not** converted into "therefore all facets are delivered" nor "therefore facets are missing" |
| A-U2 | Whether the `B-F01` inconsistency (`A-C3`) is classified as repaired-by-rejection or still open | The contract's own text and the code disagree; the classification is the contract owner's decision (`#762` O-06) | **Not** decided by Atlas (`ATLAS-SEM-053`) |
| A-U3 | Whether a doc-keyed `answerVisibility = visible`-style branch exists for rich answers in the candidate take projection | Not searched; no claim depends on it | left `UNKNOWN` |
| A-U4 | `external_freshness` of `#756`/`#679` after capture | External refs carry a capture-time revision only | Reported `UNKNOWN` until re-checked |

---

## 9. CONFLICT

| ID | Kind | Parties | Status |
| --- | --- | --- | --- |
| A-K1 | **DOCUMENTATION_DISSONANCE** (not an authority conflict) | `authority:rich-contract` §4 declares the merge-class seam "NOT FIXED" ↔ as-built code rejects the merge class at the closure seam | `UNRESOLVED`; `open_governance_item.kind = DECISION_GATED` (contract-owner classification, #762 O-06). Both facts retained; neither is promoted |
| A-K2 | **TEMPORAL_CONFLICT** | `docs/status/implementation-status.md` historical closeout wording vs the current browser-test surface | **UNRESOLVED**; `open_governance_item = { kind: DECISION_GATED, ref: the status-document owner (#762 O-10), lift_condition: "the owner's wording decision (an annotation that the browser specs were later removed)" }`. **Correction:** an earlier draft resolved this as `RESOLVED_BY_SCOPE` on the strength of the document's own scoping — the party-statement pattern `ATLAS-SEM-114` forbids, and `#762` already tracks this wording as a pending owner decision |

No `AUTHORITY_CONFLICT` found in this slice: the grammar authority, the design
authority and the code agree on everything except A-K1.

---

## 10. RESIDUAL

```text
RESIDUAL = 4 owned + 1 unowned-by-issue
  owned by work:jnhu76/exam#756 (OPEN):
    1. global formula-entry shortcut                       NOT_SUPPORTED (not adopted)
    2. $…$ / $$…$$ typed delimiters                        NOT_SUPPORTED (not generally promised;
                                                            a bounded $$$…$$$ rule exists and must be
                                                            inventoried, not reimplemented)
    3. expert-source ↔ visual-field full synchronization     DEFERRED (KaTeX preview shipped)
    4. formula-focused accessibility/viewport evidence      UNKNOWN (no unsupported assertion of a bug)
  recorded outside an issue, in the design authority:
    5. character count                                      NOT_SUPPORTED (optional scoped follow-up)
  prerequisite-blocked, contract-declared:
    6. image / attachment nodes                             NOT_SUPPORTED (Asset authority absent)
```

---

## 11. Why the evidence is sufficient — or insufficient

- **A-01 (`SUPPORTED` at `B4`)** — all four conjuncts hold: (1) the save interface
  is registered and its guard chain is locatable; (2) the contract and ADR-019 are
  `CURRENT` and accept the behaviour; (3) the durable prerequisite (a stored
  `ContentDocumentV1` payload on the frozen answer boundary) exists and is
  exercised through the HTTP composition with real PostgreSQL; (4) evidence
  covers the boundary — the browser-only mechanisms (contenteditable, reload,
  re-edit) are covered by browser E2E, and the durable rejection semantics by an
  API integration test. Nothing in the chain is `TOKEN_EXISTENCE`-only.
- **A-04 (`SUPPORTED` at `B4`)** — formula authoring has browser E2E covering
  insert → save → reload → re-edit, which is the browser-only mechanism, plus
  component and API evidence for the lower layers.
- **A-05/A-06 (`SUPPORTED` at `B3`, `INSUFFICIENT` at `B4`)** — the authoring
  surface, save path and render path are reachable and are proven by contract,
  component and API evidence; the browser mechanism for *table/code editing* is
  not proven, and `ATLAS-SEM-001` forbids asserting a boundary the evidence does
  not cover. The claim is therefore made at the boundary the evidence covers
  (`B3`) with the `B4` shortfall named (A-C6), instead of a `B4` claim with a
  caveat.
- **A-07…A-10 (not supported / deferred)** — adequacy is not the issue: these are
  **exclusion** claims, supported by the owner's own record plus the absence of
  grammar/implementation, and they cannot be upgraded by any test passing.
- **A-16 (rejected)** — the proposition "every originally-discussed facet was
  delivered" has **no adequate evidence at any boundary**: work-item closure is
  `HISTORICAL_WORK_ITEM` grade and the issues themselves contradict the
  proposition. `verification = INSUFFICIENT`. This is the required falsification.
- **A-C3's dissonance** is reported, not resolved: the contract text is an
  authority statement whose currency is for the owner to correct; the code is a
  runtime observation. Atlas keeps both (`ATLAS-SEM-112`, `ATLAS-SEM-114`).

---

## 12. Gate

```text
GOLDEN_RICH = PASS
  LOGICAL_ID                     = defined (§1)
  CLAIMS                         = 16 (§2)
  STATUS_AXES                    = assigned per claim; no completed:boolean
  AUTHORITY_OWNER                = named per claim (§3)
  SUPPORTING_EVIDENCE            = classified with proves/does_not_prove (§4)
  CHALLENGING_EVIDENCE           = 6 falsification attempts, 2 changed a state (§5)
  SOURCE_REFS                    = bound to cbe33db1; GitHub refs marked external (§6)
  WORK_ITEMS                     = closure semantics per item (§7)
  UNKNOWN                        = 4, none converted (§8)
  CONFLICT                       = 2, both retained, no winner; kinds/statuses from the closed sets (§9)
  RESIDUAL                       = 6, all verified against live sources (§10)
  WHY_EVIDENCE_IS_SUFFICIENT     = per claim (§11)
  BOUNDARY_ADEQUACY              = PASS (A-05/A-06 declared at B3, the boundary their evidence covers; the B4 shortfall is named in A-C6 rather than caveated)
FALSE_DELIVERY_CLAIM               = 0
  (#679/#301 CLOSED ⇒ all facets delivered is rejected; A-16)
DELIVERED_CORE_AND_RESIDUAL_COEXIST = YES (A-01 + A-11 MIXED, A-07..A-10)
SLICE_SPECIFIC_SCHEMA_HACK         = 0
```
