# Atlas provenance — `ArchitectureSourceRef` (`SREF-1`)

> **Status:** R0 design artifact — the provenance schema for the Architecture
> Atlas. Execution issue [#763](https://github.com/jnhu76/exam/issues/763);
> parent [#757](https://github.com/jnhu76/exam/issues/757).
>
> **`SOURCE_REF_VERSION = SREF-1`** · IR schema
> [`v0.1`](ir-v0.1.md) · semantic contract
> [`semantic-contract.md`](semantic-contract.md).
>
> R0 defines the schema and the **meaning** of each state. R0 implements no
> extractor and no resolver; every detection criterion below is frozen so that
> R1 cannot redefine what a state means while implementing it.

---

## 1. Why a new provenance model

Existing repository conventions do not fit:

- **Source Map v3** (VLQ `mappings`) is a *minified-output* mapping format. It
  encodes generated→original positions compactly for tooling, has no notion of
  symbol, section, authority, resolution state or external revision, and its
  compressed mappings cannot express `UNKNOWN` or ambiguity. **It must not be
  reused** (`ATLAS-SREF-001`).
- **Line-number anchors** are the most fragile possible binding: any edit above
  the anchor invalidates it, and they tempt consumers into treating position as
  meaning.
- **GitHub issue links** are not a revision — an issue's title, body and state
  change in place, so "the issue says X" is only meaningful with a captured
  external revision.

`ATLAS-SREF-002` — Provenance answers **two independent questions**, and they
must never be collapsed:

```text
RESOLUTION  — does this locator resolve, and uniquely, at the revision it claims?
FRESHNESS   — is the revision it claims still the live revision of that source?
```

A source ref bound to a 2026-08 audit can be **perfectly `RESOLVED` and
simultaneously not `CURRENT`.** That is a normal, expected state
(`ATLAS-SREF-030`), not a defect to be repaired by rewriting the anchor.

---

## 2. `ArchitectureSourceRef` record

```text
source_ref_version   # "SREF-1"
repo                 # "owner/name" — REQUIRED for every repo-hosted source
git_sha              # full 40-hex commit — REQUIRED for repo sources
source_kind          # §3 closed set — REQUIRED
path_or_uri          # repo-relative path, or URI for external/artefact sources
symbol?              # symbol name / qualified path within the target
section?             # document section, heading text or section id
line_or_range?       # { start, end } 1-based inclusive — a HINT (§6), never identity
extractor            # { id, version } — the tool/source that produced the ref
extraction_method    # §5 closed set
resolution_state     # §4
resolution_detail?   # candidate list for AMBIGUOUS, nearest-anchor info for STALE
external_revision?   # §7 — for external sources only
external_freshness?  # §7 — for external sources only
repo_freshness?      # §7 — for repo sources only
sensitivity          # NONE | INTERNAL | SENSITIVE_METADATA  (§8)
```

`ATLAS-SREF-003` — `repo` + `git_sha` + `path_or_uri` + `source_kind` are
mandatory for every non-external ref. A ref without a revision does not satisfy
any claim boundary (`ATLAS-SEM-021`).

`ATLAS-SREF-004` — `line_or_range` is optional and advisory. Its absence must
never reduce a ref's usability; its presence must never be required for
resolution.

---

## 3. `source_kind` (closed set)

| `source_kind` | Target | Notes |
| --- | --- | --- |
| `REPO_FILE` | A file at a revision | Identity: path + SHA |
| `REPO_SYMBOL` | A named symbol (function, class, const, type, route registration) | Preferred over lines: `symbol` is drift-tolerant |
| `REPO_SECTION` | A documented section (heading / clause id, e.g. `EXSEM-019`, `ATLAS-SEM-080`) | Preferred for normative text |
| `WIRE_CONTRACT` | Contract artefact: an OpenAPI document/operation/schema, or a contract-test case | Includes generated artefacts that are checked into the tree |
| `GENERATED_ARTEFACT` | Generated file (e.g. `apps/api/openapi.json`) | Records the generating command identity where known |
| `RUNTIME_CAPTURE` | An observation of the composed runtime (route capture) | Bound to the app composition + revision; the capture identity is recorded |
| `TEST_CASE` | A specific test case/group inside a test file | Distinguished from `REPO_SYMBOL` so evidence can name the case |
| `SCHEMA_OBJECT` | A schema/DDL object: table, column, constraint, index, migration | Physical carrier of a `DurableEntity` |
| `GIT_COMMIT` | A commit itself (history evidence) | For "this change happened" claims |
| `GITHUB_ISSUE` / `GITHUB_PR` | External work items | Requires `external_revision` (§7) |
| `HUMAN_STATEMENT` | A recorded owner/reviewer statement | Used by `HUMAN_REVIEW` evidence; `extractor` names the recording channel |
| `ARCHIVED_DOC` | Historical document under `docs/archive/` | Always `HISTORICAL` (intentionally historical, not decayed) |

`ATLAS-SREF-005` — `ARCHIVED_DOC` is not a substitute for a current authority. It
is evidence about the past (`ATLAS-SEM-121`).

---

## 4. `resolution_state` (closed set) — semantics and detection criteria

| State | Meaning | Detection criterion (frozen; R1 implements) |
| --- | --- | --- |
| `RESOLVED` | The locator resolves to **exactly one** target at the bound revision | At `git_sha`: the path exists and, when `symbol`/`section` is present, the anchor matches exactly one target there |
| `STALE` | The locator resolved at the bound revision but **no longer resolves at the live revision** — the anchor drifted, moved, was renamed, or its surrounding content changed | The bound-revision resolution succeeds **and** the live-resolution lookup fails or lands on a different target |
| `HISTORICAL` | The ref is **intentionally** bound to an older revision (archived document, closed issue, past audit), and resolves there | A declaration on the ref plus successful resolution at its bound revision. This is a *choice*, never a decay |
| `MISSING` | The locator does **not** resolve even at its own bound revision | Path absent / symbol absent / external object not found at the bound revision |
| `AMBIGUOUS` | The locator resolves to more than one candidate, or the anchor is not unique | ≥2 matches at the bound revision; `resolution_detail` lists them |
| `UNKNOWN` | Not evaluated, or not evaluable (e.g. an external source unreachable at capture time) | No successful or failed evaluation is recorded |

### 4.1 Consequences (frozen)

`ATLAS-SREF-010` — `MISSING` means the claim **was never verifiable at that
revision**. It is not a decay state and must not be silently treated as "the fact
disappeared later".

`ATLAS-SREF-011` — `AMBIGUOUS` cannot support any claim until disambiguated.
Two candidates are not evidence. The ref may not be replaced by "the first
match".

`ATLAS-SREF-012` — `STALE` requires **re-anchoring**, not re-interpretation: the
ref's target is re-located and the ref updated with a new revision + anchor,
recorded as a provenance change. Guessing which of several drifted anchors was
meant is forbidden.

`ATLAS-SREF-013` — `UNKNOWN` resolution must be reported as `UNKNOWN`. It must not
default to `RESOLVED` because the path "looks right", and it must not default to
`MISSING` because a lookup was not attempted.

`ATLAS-SREF-014` — A `HISTORICAL` ref may support claims about the past (intent,
scope, decisions, past state) and may **not** satisfy any conjunct of a
current-state claim (`ATLAS-SEM-111`, `ATLAS-SEM-122`).

---

## 5. `extraction_method` (closed set)

| Method | How the ref was produced | Typical `source_kind` |
| --- | --- | --- |
| `MANUAL_CURATION` | A human/agent read the source and wrote the ref | any |
| `AST_SYMBOL_LOOKUP` | Resolved through a compiler/AST symbol table | `REPO_SYMBOL`, `TEST_CASE` |
| `LEXICAL_ANCHOR` | Textual match on a literal string or heading | `REPO_SECTION`, `REPO_FILE` |
| `ROUTE_CAPTURE` | Enumerated from the composed runtime | `RUNTIME_CAPTURE` |
| `SCHEMA_INTROSPECTION` | Read from the schema/DDL definitions or migration files | `SCHEMA_OBJECT` |
| `OPENAPI_ARTIFACT` | Read from the generated OpenAPI document | `WIRE_CONTRACT`, `GENERATED_ARTEFACT` |
| `TEST_NAME_MATCH` | Matched a test case by name/description | `TEST_CASE` |
| `GITHUB_API` | Read from the GitHub API at a captured moment | `GITHUB_ISSUE`, `GITHUB_PR` |
| `COMMIT_LOOKUP` | Resolved from Git history | `GIT_COMMIT` |
| `HUMAN_RECORDED` | A human statement recorded as evidence | `HUMAN_STATEMENT` |

`ATLAS-SREF-020` — `extractor` records the producing tool **and its version**.
Two refs extracted by different tool versions are not equivalent evidence even
when they name the same target; a rebuild must be able to explain a diff that is
purely an extractor-version change (`ATLAS-IR-072`).

`ATLAS-SREF-021` — `LEXICAL_ANCHOR` refs must record the literal anchor text
they matched, so that `STALE` detection can distinguish "moved" from "renamed"
from "deleted".

---

## 6. The locator model

### 6.1 Anchor preference (most stable first)

```text
REPO_SECTION with a clause/section id   (e.g. EXSEM-019, ATLAS-SEM-080)
REPO_SYMBOL with a qualified name
TEST_CASE with an exact test name
WIRE_CONTRACT with an operation/schema pointer
REPO_FILE + line_or_range               (hint only)
```

`ATLAS-SREF-022` — Prefer the most **stable** anchor available. A clause id or a
qualified symbol name survives reflow, reordering and line insertion; a line
number does not. This is a **recording preference over anchor forms**, not an
axis and not a severity scale: it never changes a ref's `resolution_state`,
`freshness`, or a claim's eligibility.

### 6.2 Rules

`ATLAS-SREF-023` — **Position is never identity.** No ID (IR §6) and no claim may
depend on a line number. Line ranges exist to help a human open the right place.

`ATLAS-SREF-024` — **Ranges are 1-based and inclusive**, expressed as
`{ start, end }`. No VLQ, no delta encoding, no offsets.

`ATLAS-SREF-025` — A ref that must cover several distinct targets is expressed as
**several refs**, never as one wide range. Wide ranges make `AMBIGUOUS`
undetectable.

`ATLAS-SREF-026` — For a symbol whose body moved *within* the same revision
scope, resolution is by `symbol`, so the ref survives. For a symbol that was
renamed, the ref becomes `STALE` and a rename record is required — the Atlas does
not guess that two differently named symbols are the same concept.

---

## 7. Freshness — two independent dimensions

`ATLAS-SREF-030` — Repository-SHA freshness and external-tool freshness are
**separate dimensions**, each with its own state. Collapsing them produces
nonsense such as "this ADR clause is stale because an Issue was updated".

### 7.1 Repo freshness

```text
repo_freshness ∈ { CURRENT, STALE, UNKNOWN }
```

| Value | Meaning |
| --- | --- |
| `CURRENT` | The ref's `git_sha` equals the snapshot's base revision for that repository |
| `STALE` | The repository has advanced past the ref's `git_sha` (the ref describes an earlier revision) |
| `UNKNOWN` | Freshness was not evaluated |

`ATLAS-SREF-031` — A `STALE` repo ref may be **perfectly `RESOLVED`**. Staleness
is about the *description's currency*, not about the locator's integrity. This
combination (`RESOLVED` + `repo_freshness = STALE`) is the expected state for
historical and archived evidence, and is exactly the case the R0 requirement
"a historical source ref can be perfectly RESOLVED but not CURRENT" describes.

### 7.2 External freshness

```text
external_revision  : { observed_state, observed_updated_at, observed_at }
external_freshness ∈ { CURRENT, STALE, UNKNOWN }
```

| Value | Meaning |
| --- | --- |
| `CURRENT` | The external object's state/updated-at at re-check equals `external_revision` |
| `STALE` | The external object has changed since the captured revision |
| `UNKNOWN` | The external object was not re-checked, or is unreachable |

`ATLAS-SREF-032` — An external ref's `external_freshness` may never be used to
infer a repo state, and a repo `git_sha` may never be used to infer an external
state. A work item's closure (`ATLAS-SEM-050`) is an external fact; the code it
claims to have delivered is a repo fact.

### 7.3 Combined-state matrix (what a claim may conclude)

This matrix defines per-ref **eligibility** and is normative for
`ATLAS-SREF-033`/`-034`; it is a set of joint conditions, **not** an order over a
combined scale. A derivation that does not apply it is non-conformant.

| resolution | freshness (repo or external) | A claim may conclude |
| --- | --- | --- |
| `RESOLVED` | `CURRENT` | Usable as **current** evidence for this source |
| `RESOLVED` | `STALE` | Usable as evidence **about the bound revision**; may not satisfy a current-state conjunct (`ATLAS-SEM-081` condition 2/4) |
| `HISTORICAL` | `STALE` | Historical evidence only (`ATLAS-SREF-014`) |
| `STALE` (anchor drift) | any | Support is **suspect**: re-anchor before use (`ATLAS-SREF-012`) |
| `MISSING` | any | **No evidence**; the claim loses this support and must degrade to `UNKNOWN`/`INSUFFICIENT` (`ATLAS-SREF-010`) |
| `AMBIGUOUS` | any | **No evidence** until disambiguated (`ATLAS-SREF-011`) |
| `UNKNOWN` | `UNKNOWN` | Reported as `UNKNOWN`; never silently treated as usable |

`ATLAS-SREF-033` — **Resolution and freshness are independent axes and are never
combined into one ordinal.** A ref can be perfectly `RESOLVED` (the locator
identifies exactly the intended artifact at exactly the bound revision) while its
`freshness = STALE` (that artifact no longer describes live state), and a
`CURRENT` description can rest on an `AMBIGUOUS` locator. Neither axis may be
rewritten from the other, and neither closed set is a severity scale: there is no
natural ordinal over `{MISSING, AMBIGUOUS, UNKNOWN, STALE}`.

What *is* joint is **eligibility for use as evidence**, a per-ref predicate
defined by §7.3's matrix:

```text
a required ref is usable as CURRENT evidence
    iff resolution ∈ {RESOLVED, HISTORICAL} AND freshness = CURRENT
a required ref is usable as evidence ABOUT THE BOUND REVISION
    iff resolution ∈ {RESOLVED, HISTORICAL}   (freshness may be STALE)
anything else: not usable, and the ref is named as the cause
```

`ATLAS-SREF-034` — A claim's derived eligibility verdict
(`current_support_usable ∈ {YES, NO}`, with the non-usable refs named) is a
**separate field**: it is computed from §7.3 and it **never overwrites** either
axis. A claim whose only required ref is bound to an old revision legitimately
reports

```text
resolution             = RESOLVED
freshness              = STALE
current_support_usable = NO
```

and may not report a worse `resolution` merely because freshness is `STALE`.
`min(resolution_worst, freshness_worst)` — or any other total-order combination
of the two dimensions — is non-conformant.

`ATLAS-SREF-035` — The **claim-level** `resolution` axis
(`semantic-contract.md` §8.6: `RESOLVED`/`STALE_REF`/`MISSING_REF`/`AMBIGUOUS`/
`CONFLICT`/`UNKNOWN`) is *derived* from the per-ref `resolution_state` values by
the mapping fixed in that section. The two closed sets are deliberately different
(ref-level includes `HISTORICAL`, which is a binding decision; claim-level
includes `CONFLICT`, which is a multi-ref condition), and neither may be
substituted for the other.

---

## 8. Privacy, sensitivity and excerpt discipline

`ATLAS-SREF-040` — **A source ref is a locator, not a copy.** The default and
preferred form is `repo + git_sha + path + symbol/section`. Content is not
embedded.

`ATLAS-SREF-041` — If an excerpt is necessary (e.g. the exact phrasing of an
authority clause), it must be **bounded** (a short line/character cap), attached
to the ref, and marked `sensitivity`.

`ATLAS-SREF-042` — The following must **never** appear in a source ref, excerpt,
fixture or snapshot body:

- credentials, API keys, tokens, session identifiers, password material;
- environment values from `.env*`, deployment secret files or Compose env;
- real candidate personal data (names, contact details, identity-document
  numbers, answers of identifiable persons);
- database row contents; a database observation is recorded as the
  **assertion/query identity plus its outcome class**, never as row data;
- internal sensitive configuration (SMTP credentials, storage paths containing
  personal data, signing material).

`ATLAS-SREF-043` — `sensitivity` marks the highest sensitivity of the referenced
target as `NONE` / `INTERNAL` / `SENSITIVE_METADATA` so a projection can refuse to
render it. A ref whose target is sensitive may still be recorded — as a locator —
but never with embedded content.

`ATLAS-SREF-044` — A committed snapshot must be **reviewable without opening a
database and without any secret**. If a claim cannot be checked that way, the
missing check is recorded as `UNKNOWN` rather than replaced by captured data.

---

## 9. Binding a snapshot

```text
snapshot:
  snapshot_id                # stable id, e.g. "sref1-ir0.1-<short-sha>-<hash>"
  repo
  git_sha                    # the R0/R1 base revision
  ir_schema_version          # "v0.1"
  source_ref_version         # "SREF-1"
  extractor: { id, version }
  curation_input_revision     # revision/identity of any curated mapping input
  normalized_body_hash       # hash of the normalized semantic body (IR §7)
  generated_at               # EXCLUDED from normalized semantic comparison
```

`ATLAS-SREF-050` — **Every source ref in a snapshot is bound to that snapshot's
`git_sha`, or explicitly marked `HISTORICAL`/`external`.** A ref that is neither
is a defect in the writer, not a curation judgement.

`ATLAS-SREF-051` — External refs carry their own `external_revision`; they are
never bound to a repository SHA as if that made them current.

`ATLAS-SREF-052` — `snapshot_id` changes when the semantic body changes. A
rebuild of the same revision with the same extractor version and the same
curation input must produce the **same** normalized body hash
(`ATLAS-IR-060`).

---

## 10. What R1 must prove (specified here, implemented later)

R0 freezes the criteria; R1 ([#764](https://github.com/jnhu76/exam/issues/764))
must prove them with repository-owned evidence:

| Required proof | Criterion |
| --- | --- |
| Deterministic rebuild | Same revision rebuilt twice → byte-identical normalized body (`ATLAS-IR-060`) |
| Broken locator detection | A deliberately invalidated anchor yields `STALE`/`MISSING`, not silent success (`ATLAS-SREF-010`, `-012`) |
| Ambiguity detection | A duplicated anchor yields `AMBIGUOUS` with both candidates listed |
| Freshness separation | A historical ref is reported `RESOLVED` + `repo_freshness = STALE`, never as a conflict, and never as current evidence (`ATLAS-SREF-031`) |
| External separation | A changed external object yields `external_freshness = STALE` while the repo refs remain `CURRENT` (and vice versa) |
| Identity stability | A pure file move/rename does not change any semantic ID (`ATLAS-IR-024`, IR §6.4) |
| Privacy | No committed snapshot contains a secret, credential or candidate personal data (`ATLAS-SREF-042`) |

---

## 11. Rejected alternatives

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Source Map v3 VLQ `mappings` | **REJECTED** | Minified-output-oriented, position-only, no symbol/section/authority/resolution/UNKNOWN concept (`ATLAS-SREF-001`) |
| Line/offset as identity | **REJECTED** | Position is not meaning (`ATLAS-SREF-023`); it breaks on any edit above the anchor |
| One global freshness field for repo + external | **REJECTED** | Guarantees a false conclusion in one direction or the other (`ATLAS-SREF-030`) |
| One "valid/invalid" boolean per ref | **REJECTED** | Collapses `MISSING`-from-the-start, `STALE` drift, intentional `HISTORICAL`, and `AMBIGUOUS` — four states with different consequences (`ATLAS-SREF-010`…`-014`) |
| Embedding source excerpts by default | **REJECTED** | Turns the snapshot into a copy of the repository and a privacy surface (`ATLAS-SREF-040`…`-044`) |
| Inferring a rename from similarity | **REJECTED** | Identity changes require a recorded rename (`ATLAS-IR-023`); similarity guessing silently rewrites history |
