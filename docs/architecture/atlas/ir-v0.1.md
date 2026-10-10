# Atlas IR v0.1

> **Status:** R0 design artifact — the minimal Architecture Atlas intermediate
> representation. Execution issue
> [#763](https://github.com/jnhu76/exam/issues/763); parent
> [#757](https://github.com/jnhu76/exam/issues/757).
>
> **`IR_SCHEMA_VERSION = v0.1`** · source-ref schema
> [`SREF-1`](provenance-v0.1.md) · semantic contract
> [`semantic-contract.md`](semantic-contract.md).
>
> R0 **implements nothing**. This document specifies records, nodes, edges,
> identity and normalization well enough for R1 to build a deterministic
> writer, and no further.
>
> Dependencies: **no Three.js, no graph database, no renderer, no Atlas UI, no
> production extractor.** Queries over a v0.1 snapshot are answered by scanning
> records and traversing the edges below; a graph DB is not required and is not
> assumed (`ATLAS-IR-001`).

---

## 1. Model split: records, nodes, edges

v0.1 has three layers, deliberately separated:

| Layer | Contents | Why separate |
| --- | --- | --- |
| **Records** | `Claim`, `Evidence`, `Fact`, `Snapshot`/`Manifest` | Not graph identity. A claim is referenced by ID, but its authority comes from the semantic contract, not from incoming edges. Making every observation a node would turn the Atlas into a code graph. |
| **Nodes** | 12 types in §2 | Things that need **stable logical identity** because queries or edges reference them by that identity. |
| **Edges** | 11 types in §5 | Precise, directional, typed relations. No edge exists "to connect the graph". |

`ATLAS-IR-001` — Nothing in this IR depends on a renderer, a layout, a graph
database, or a UI. If a requirement can only be met by one of those, it is out of
scope for v0.1.

`ATLAS-IR-002` — A node exists only if it has a **named query** that requires
stable identity (`WHY_FIRST_CLASS` / `WHAT_QUERY_REQUIRES_IT`) **and** a
justification that a source ref cannot answer that query
(`WHY_SOURCE_REF_IS_NOT_ENOUGH`). All three are recorded per node type in §3.

`ATLAS-IR-003` — Derived fields are marked `DERIVED` and must never be hand-set
or hand-corrected; a derived value that disagrees with its inputs is a defect in
the writer, not a curation choice.

---

## 2. Node types (12)

| Kind | ID namespace | Primary purpose |
| --- | --- | --- |
| `Capability` | `capability:` | Product capability — the top navigation axis |
| `Facet` | `facet:` | Independently supported aspect of one capability |
| `Workflow` | `workflow:` | Ordered set of operations realizing a capability stage |
| `Operation` | `operation:` | Guarded production behaviour unit |
| `Interface` | `interface:` | Exposed seam (HTTP route or internal entry point) |
| `Permission` | `permission:` | Capability key from the authorization catalog |
| `RolePreset` | `role:` | Named capability container from the catalog |
| `Scope` | `scope:` | Resource boundary requirement and its assignment carrier |
| `PolicyValue` | `policy:` | Representable reserved/active vocabulary value |
| `DurableEntity` | `entity:` | Durable fact family and its state vocabulary |
| `NormativeAuthority` | `authority:` | The owner of a fact type |
| `WorkItem` | `work:` | Issue / PR / recorded decision / review |

---

## 3. Node types, justified

Format per type: `WHY_FIRST_CLASS` · `WHAT_QUERY_REQUIRES_IT` ·
`WHY_SOURCE_REF_IS_NOT_ENOUGH`.

### 3.1 `Capability`

- **WHY_FIRST_CLASS** — The product axis of every G1/G2 query, and the subject of
  most `CAPABILITY_SUPPORT` claims.
- **WHAT_QUERY_REQUIRES_IT** — "What major capabilities does Exam have?", "which
  are SUPPORTED / GATED / DEFERRED / NOT_SUPPORTED / UNKNOWN / unmapped?",
  "which work item owns this gap?"
- **WHY_SOURCE_REF_IS_NOT_ENOUGH** — A capability is a *product* concept that no
  source owns as a symbol. Its identity must survive reimplementation, re-routing
  and file moves; a source ref to any one implementation would make the identity
  a location in disguise (`ATLAS-IR-020`).

### 3.2 `Facet`

- **WHY_FIRST_CLASS** — The semantic contract requires `delivered core = true`
  to coexist with `some optional/residual facet = deferred/unknown`, for the same
  capability.
- **WHAT_QUERY_REQUIRES_IT** — "Which parts of capability X are delivered, and
  which are residual or separately owned?"
- **WHY_SOURCE_REF_IS_NOT_ENOUGH** — A facet carries an **independent support
  verdict**. If facets were only fields of `Capability`, every facet verdict would
  have to be flattened into the parent's single `activation_support`, which either
  contaminates a delivered core with a residual, or forces the whole capability to
  `UNKNOWN`. Golden slice A falsifies that flattening.
- **Constraint** — A `Facet` has exactly one parent (`contains`), may not carry
  its own `Workflow` parentage outside that capability, and may not be shared.

### 3.3 `Workflow`

- **WHY_FIRST_CLASS** — It is the ordered bridge between product intent and
  runtime behaviour, and the unit in which "the same operation serves two product
  paths" is expressed.
- **WHAT_QUERY_REQUIRES_IT** — "Trace capability → workflow → operation → route →
  permission → scope → durable fact"; "which step of the flow is gated?"
- **WHY_SOURCE_REF_IS_NOT_ENOUGH** — A workflow is a *sequence with semantics*
  (which step is terminal, which is a separate product door). Ordering and
  grouping are not attributes of any single source file, and the same operation
  legitimately appears in more than one workflow.

### 3.4 `Operation`

- **WHY_FIRST_CLASS** — It is the unit that is gated, scoped, and durable: the
  authorization question in G2 is per-operation.
- **WHAT_QUERY_REQUIRES_IT** — "Which operation implements capability X?",
  "which permission and scope gate it?", "what durable state does it change?",
  "what state must hold first?"
- **WHY_SOURCE_REF_IS_NOT_ENOUGH** — One operation spans a route registration, a
  guard chain, an engine command and a transaction. Its identity must persist if
  the route is renamed and the engine file is split; and its `state_prerequisites`
  are semantic predicates, not a source location.

### 3.5 `Interface`

- **WHY_FIRST_CLASS** — It is the seam where **declared metadata** and **runtime
  truth** can diverge, which the semantic contract requires Atlas to keep as two
  facts about one thing.
- **WHAT_QUERY_REQUIRES_IT** — "Which protected runtime routes are absent from the
  declared registry (and vice versa)?", "which interfaces expose operation O?",
  "which permission gates this route at runtime?"
- **WHY_SOURCE_REF_IS_NOT_ENOUGH** — A route is simultaneously declared (in a
  registry/ADR) and registered (in the composed app); the *divergence* is a
  property of the pair, not of either source. v0.1 therefore carries both blocks
  on one node (§4.5) so the divergence is structural rather than a special case.

### 3.6 `Permission`

- **WHY_FIRST_CLASS** — Capability keys are a shared namespace referenced by
  catalog, presets, route gates, route metadata, projections and docs; the
  effective-authority question is stated in terms of them.
- **WHAT_QUERY_REQUIRES_IT** — "Which operations require permission P?", "which
  presets contain P?", "which granted permissions are **inert** (granted but
  consumed by no operation)?"
- **WHY_SOURCE_REF_IS_NOT_ENOUGH** — The key is referenced from many sites; the
  catalog's own inert/reserved annotations are *claims about* the key, and
  `inert` must be **derived** from the operation/interface data
  (`ATLAS-IR-003`), not read from a comment.

### 3.7 `RolePreset`

- **WHY_FIRST_CLASS** — It is the capability term of the authorization model and
  the container that a role-matrix projection renders.
- **WHAT_QUERY_REQUIRES_IT** — "What does preset R declare?", "which permissions
  does R omit (and are therefore unreachable for R)?", "is R an application role
  or a synthetic actor?"
- **WHY_SOURCE_REF_IS_NOT_ENOUGH** — Preset membership is one input to effective
  authorization; the node must be traverable to permissions and (via operations)
  to scope, which is exactly how the "preset ≠ access" invariant is expressed.
- **Invariant (`ATLAS-IR-030`)** — The `role:` namespace contains **exactly** the
  catalog's closed role set. A `RolePreset` node that is not in that set is a
  defect. Non-RBAC identities (host operator) are **not** represented as presets —
  see §3.8.

### 3.8 `Scope`

- **WHY_FIRST_CLASS** — It is the term that makes "preset ≠ resource reach"
  representable, and the carrier of the assignment dimension.
- **WHAT_QUERY_REQUIRES_IT** — "Which scope must operation O resolve?", "which
  durable carrier enforces the assignment?", "which routes are
  assignment-scoped?", "which identities and resource domains are **outside**
  application RBAC?"
- **WHY_SOURCE_REF_IS_NOT_ENOUGH** — A scope requirement is a composite: a scope
  dimension value plus the enforcement carrier (assignment table + seam) or an
  explicit `NONE`. A source ref to the seam would not answer "which operations
  require this scope", and would not be able to represent `NONE` (a scope
  requirement with no assignment dimension — itself a finding).
- **Field** — `rbac_participation ∈ {APPLICATION_SCOPE, OUTSIDE_APPLICATION_RBAC}`.
- **Invariant (`ATLAS-IR-031`)** — An `OUTSIDE_APPLICATION_RBAC` scope may not be
  the target of any `scoped_by`/`requires_permission` path, and no `Permission`
  may reference it. Host/infrastructure authority is therefore structurally
  unable to be rendered as an application role.

### 3.9 `PolicyValue`

- **WHY_FIRST_CLASS** — The negative control requires a first-class representation
  of **representable-but-not-supported vocabulary** whose verdict is not derivable
  from any single source.
- **WHAT_QUERY_REQUIRES_IT** — "Which values exist in the wire contract?",
  "which are activatable in production?", "what refuses activation?",
  "which values have no writer?", "which state transitions are one-way?"
- **WHY_SOURCE_REF_IS_NOT_ENOUGH** — The same value appears in the domain enum,
  the wire schema, the DB constraint, the canonical validator, the generated
  OpenAPI and the policy support matrix, and these disagree *by design*: the enum
  says "representable", the OpenAPI says "acceptable input", the validator says
  "rejected", the support matrix says "not activated". A source ref can point at
  one of them; only a node with an explicit `activation_status` plus the refusing
  seam can hold the answer. Modelling these as `Capability` nodes would invert the
  error: it would promote reserved vocabulary to product concepts.
- **Field** — `vocabulary_class ∈ {STATE, MODE, FLAG, VISIBILITY, POLICY_VALUE}`.

### 3.10 `DurableEntity`

- **WHY_FIRST_CLASS** — "What durable state changes, and what proves it?" is a
  required reader question, and durable facts carry **semantic authority**
  (freeze-once, one-way transitions, projection-is-not-input).
- **WHAT_QUERY_REQUIRES_IT** — "Which operations read/write entity E?", "which
  semantic authority governs E?", "which state values are reachable?", "which
  capability is affected by a change to E?"
- **WHY_SOURCE_REF_IS_NOT_ENOUGH** — The semantic fact and its physical carrier
  are different objects that can drift: the authority owns *"submitted answers
  freeze once"*, whereas the schema owns a table and column name that migrations
  can rename. Identity must be the semantic fact; the physical carrier is a
  separate, resolution-checked mapping, so a missing carrier is reported
  `MISSING`/`STALE` and never silently absent.

### 3.11 `NormativeAuthority`

- **WHY_FIRST_CLASS** — Authority is by fact type and must be traversable, with
  supersession and amendment relations between authorities.
- **WHAT_QUERY_REQUIRES_IT** — "Which authority governs this node/claim?", "is it
  current, historical, superseded or amended?", "which nodes are governed by an
  authority that is no longer current?"
- **WHY_SOURCE_REF_IS_NOT_ENOUGH** — One authority source governs many
  heterogeneous nodes; the governance relation is many-to-many and cannot be
  carried by a path. Supersession is a relation between authorities, not between
  files.

### 3.12 `WorkItem`

- **WHY_FIRST_CLASS** — Residual, deferred, gated and scheduled states are
  expressed partly through work items, and closure semantics is a first-class
  claim.
- **WHAT_QUERY_REQUIRES_IT** — "Which work item owns this gap?", "what is this
  item's closure semantics?", "which claims does a closed item still support?"
- **WHY_SOURCE_REF_IS_NOT_ENOUGH** — A work item's identity is an external
  object identifier (e.g. `jnhu76/exam#756`), not a path; its state and
  `closure_semantics` change over time while the claims it supports do not.

### 3.13 Rejected candidates

| Candidate | Verdict | Reason |
| --- | --- | --- |
| `Module` (file/package) | **REJECTED** | A module is a *locator*. "Which capabilities are affected if `packages/authz` changes?" is answered by reverse-scanning evidence source refs, which is what refs are for. A module node would begin the forbidden code graph (`ATLAS-IR-001`, `ATLAS-IR-020`). |
| `Fact` as node | **REJECTED** | Facts are observations bound to a ref; they are consumed by `Claim` records. Node-per-fact explodes the graph with tokens and would make `enum exists` look like a first-class architectural entity — the exact false-support shape R0 exists to prevent. |
| `Evidence` as node | **REJECTED** | Evidence is referenced only by claims. Node-per-evidence would promote every test file into the graph. Queries about evidence are answered by claim→evidence references plus refs. |
| `Claim` as node | **NOT A NODE** (record) | A claim is a record with authority semantics; it has no edges of its own beyond being referenced. Permitted by the phase contract; revisit only if a query needs it. |
| `Assignment` node | **REJECTED** | The assignment dimension lives on `Scope` (`assignment_carrier` + enforcement seam). A separate node would let a consumer model an assignment without its enforcement seam — the failure mode behind "missing assignment dimension". |
| `Actor` / `ActorClass` node | **REJECTED** | The eight identities are covered without a new type: seven by the closed `RolePreset` set, the synthetic actor by `role:System`'s own flags, and the host operator by an `OUTSIDE_APPLICATION_RBAC` `Scope` plus the explicit absence of any granting `Permission` (`ATLAS-IR-031`). Adding an actor node would duplicate `RolePreset` for seven of eight members and invite combining it with presets. |
| `reads`/`writes` into `Fact` nodes | replaced | Retained as edges, but pointing at `DurableEntity` — the durable fact family — instead of a generic `Fact` node. |
| Generic `DataEntity` naming | replaced | Named `DurableEntity` to force the semantic-fact-vs-physical-carrier distinction. |

---

## 4. Node record shapes

All nodes share a common header:

```text
kind                     # §2 closed set
id                       # §6 stable logical ID
label                    # human-readable name (non-identifying)
source_refs[]            # ArchitectureSourceRef[] (SREF-1)
authority_refs[]         # NormativeAuthority refs governing this node
freshness                # §semantic-contract 8.5
resolution               # §semantic-contract 8.6 (derived; names the causing refs)
review_state             # §semantic-contract 5.4
claim_refs[]             # claims whose subject is this node
open_governance_item     # §semantic-contract 6.4
renamed_from[]           # retired IDs this node previously carried (ATLAS-IR-023)
renamed_to?              # successor ID if this node was renamed away
retired_at?              # revision at which the rename was recorded
rename_reason?           # why the identity changed
```

Type-specific fields below. Fields marked `DERIVED` are computed; every other
field is curated or extracted.

### 4.1 `Capability` / `Facet`

```text
support_summary          # DERIVED: activation_support roll-up, see below
support_boundary         # REQUIRED: the boundary identifier (B0..B6) support_summary speaks about
                         # (identifiers, not a total order — semantic-contract §9.3)
mapping_state            # MAPPED | PARTIAL | UNMAPPED | UNKNOWN
external_identity?        # e.g. the OPEN Issue that authorizes work on it
```

`ATLAS-IR-032` — `support_summary` is a **total function** over the capability's
own `CAPABILITY_SUPPORT` claims and its facets'. It is evaluated in this
precedence order and the first matching clause wins. Throughout, a part is
**qualifying** at a given boundary when it has a `CAPABILITY_SUPPORT` claim whose
`verification = PASS` **at that boundary** (§9.3); a part with no such claim is
never counted as supported.

```text
0. if mapping_state ≠ MAPPED, or any part's activation_support = UNKNOWN,
   or any part's evidence is inadequate for its declared boundary
                                                              → UNKNOWN
   (unresolved precedence over every other clause; an incomplete
    mapping yields no aggregate verdict about the whole capability
    at all — an UNMAPPED capability is never NOT_SUPPORTED,
    ATLAS-SEM-102)
1. if ≥1 qualifying part and ≥1 non-qualifying part exists     → MIXED
   (must be rendered, not flattened)
2. if there is ≥1 part,
   AND every part is qualifying at support_boundary,
   AND a closed-search statement records that no known
       non-supported part is unmapped
                                                              → SUPPORTED
3. if no part is supporting and ≥1 part has an accepted design
   with an owning work item or a named decision gate            → GATED | DEFERRED
                                                                 (from the strongest such part,
                                                                  naming it)
4. if no part is supporting, no part has an accepted design,
   an owning work item, or a named decision gate,
   AND positive negative evidence covers the capability at
   support_boundary — an explicit current-authority rejection
   or non-support statement, a closed absence search with its
   scope stated, or a proven-refusal claim
   (ATLAS-SEM-084)                                             → NOT_SUPPORTED
5. otherwise                                                   → UNKNOWN
```

`ATLAS-IR-033` — **The roll-up must not be flattened.** `MIXED` exists precisely
so that "delivered core" and "residual facet" can hold at the same time: a
rendering that collapses `MIXED` into a boolean is a Projection violation
(`ATLAS-SEM-060`/`-063`), not a display choice.

Binding rules:

- Clause **0** implements `ATLAS-SEM-101` and `ATLAS-SEM-102`: `UNKNOWN` parts
  block a `SUPPORTED` roll-up rather than being silently treated as absent, and
  an incompletely-mapped capability (`PARTIAL`/`UNMAPPED`/`UNKNOWN`) yields
  **no aggregate verdict at all**. The coverage gate precedes every other clause,
  so no mapping state can ever roll up `NOT_SUPPORTED` just because no part was
  mapped — that is exactly the `UNMAPPED ≠ NOT_SUPPORTED` rule, and R1's
  major-capability inventory depends on it.
- Clause **2** is the only path to `SUPPORTED`, and it is deliberately hard to
  satisfy. It requires **three** conjuncts: at least one part exists; every part
  qualifies **at `support_boundary`**; and a closed-search statement about
  unmapped parts. (Coverage — `mapping_state = MAPPED` — is already enforced by
  clause 0 for every clause.) The "at least one part" and "qualifying at this
  boundary" conjuncts close two constructible false-SUPPORTED inputs found during
  the R0-D review: (a) a capability with zero claims rolling up `SUPPORTED`
  vacuously, and (b) *boundary laundering*, where parts proven only at `B3` would
  raise a `B4` roll-up.
- `support_boundary` is mandatory and must be rendered with the summary. A
  `support_summary` without a boundary is invalid (`ATLAS-SEM-001`). The boundary
  is an **identifier**, never a rank: adequacy is checked by
  `boundary_coverage` membership (`ATLAS-SEM-083`), not by comparing `B`-values.
- Clause **3** is where `GATED` and `DEFERRED` differ (`ATLAS-SEM-072`): a part
  whose gate names a lift condition is `GATED`; a part whose design is accepted
  and whose work is owned by a work item is `DEFERRED`.
- Clause **4** is `NOT_SUPPORTED`: **positive negative evidence exists**
  (`ATLAS-SEM-084`) and nobody owns the future. The absence of supporting claims
  is *not* negative evidence — a capability whose support is simply unknown falls
  through to clause 5, not to clause 4.
- `mapping_state` records coverage, never support — an `UNMAPPED` capability is
  not an unsupported capability (`ATLAS-SEM-102`). Its role in this function is
  the clause-0 coverage gate: an incomplete mapping must not yield `SUPPORTED`
  *or* `NOT_SUPPORTED`.

### 4.2 `Workflow`

```text
capability_ref           # containing Capability/Facet
step_count               # DERIVED
terminal_step_ref?       # the step whose completion ends the workflow
```

### 4.3 `Operation`

```text
gate_kind                # CAPABILITY | RESOURCE_AWARE_CAPABILITY | AUTH_ONLY | PUBLIC | INTERNAL_SYNTHETIC
authority_requirement    # §4.4
state_prerequisites[]    # predicates over DurableEntity values + effective-time conditions
durable_effects[]        # { entity_ref, effect_kind: READ|WRITE|MATERIALIZE|PROJECT, mutability }
idempotency              # IDEMPOTENT | SINGLE_WINNER | NOT_IDEMPOTENT | UNKNOWN
atomicity                # describes which durable effects commit together
```

`state_prerequisites` is a structured field, not an edge, because a prerequisite
is a **predicate over state** (e.g. "attempt.status = submitted",
"grading_status = pending_manual", "effective deadline not reached"), not a
dependency on another capability. Edge `depends_on` is reserved for
capability-level dependencies (§5.10) so that the two are never conflated.

### 4.4 `authority_requirement` (composite record)

The composite that makes `RolePreset ≠ effective authorization` representable:

```text
capability_ref           # Permission ref; NONE for AUTH_ONLY/PUBLIC/INTERNAL_SYNTHETIC
scope_ref?               # Scope ref carrying the ASSIGNMENT CARRIER (see note below)
resource_anchor_ref?     # Scope ref naming the resource KIND the resolver resolves
                         #   (may differ from scope_ref: e.g. anchor = exam, carrier = course)
assignment_required      # TRUE | FALSE | UNKNOWN      (the assignment dimension)
assignment_applies_to    # [actor_class_or_role_key]  — who is subject to the assignment gate;
                         #   e.g. ["!Admin"] meaning "all actors except Admin", or [] for none
enforcement_seam         # the code seam that applies it (locator)
enforcement_evidence     # evidence that the seam is applied on every surface of the operation
resource_resolution      # how the resource is resolved (e.g. attemptId → examId)
deny_mapping             # canonical deny shape (e.g. 404 anti-enumeration, 403, 503 fail-closed)
```

`ATLAS-IR-034` — `assignment_required = TRUE` requires `enforcement_seam` and
`enforcement_evidence`. `enforcement_evidence` must be evidence **of the seam**,
not of the permission's existence (`ATLAS-SEM-035`).

`ATLAS-IR-034a` — **`assignment_required` is not a property of every actor.**
Where the runtime exempts an actor class (the current case: Admin short-circuits
the assignment gate on every scoped seam), the exemption is recorded in
`assignment_applies_to`. Stating only `assignment_required = TRUE` would let a
consumer infer that Admin is assignment-checked, which is false; stating only
"non-Admin" in prose would make the exemption unverifiable. If the exemption
cannot be established, `assignment_applies_to = UNKNOWN`.

`ATLAS-IR-034b` — **The resource anchor and the assignment carrier are separate
fields.** A scope requirement resolves a resource of one kind while requiring an
assignment over a resource of another kind (result publication resolves an *exam*
while requiring a *course* assignment). A single `scope_ref` cannot carry both, and
fusing them makes one carrier look like the enforcement for an unrelated operation.

`ATLAS-IR-035` — The IR represents the **requirement** and its enforcement
evidence. It must not compute or store a grantee set ("the actors who can do
this"). Computing effective access would require reimplementing server
authorization, which is an explicit STOP condition for R0/R1. Projections may
show the requirement, the scope and the seam — never a computed allow-list.

### 4.5 `Interface`

```text
seam_kind                # HTTP | INTERNAL
contract_identity        # for HTTP: METHOD + normalized path template
declared?                # { source_ref, permission_ref?, scope_ref?, extra_metadata... }
runtime_observation?     # { capture_ref, permission_ref?, gate_kind, resolver?... }
declared_vs_runtime      # MATCH | DECLARED_ONLY | RUNTIME_ONLY | DIVERGENT | UNKNOWN
```

`declared_vs_runtime` (DERIVED, `ATLAS-IR-036`) is `DIVERGENT` when both blocks
exist and disagree on permission, scope, gate kind or resolver; `DECLARED_ONLY`
and `RUNTIME_ONLY` cover the one-sided cases. Both blocks are kept; no side is
promoted (`ATLAS-SEM-112`).

`ATLAS-IR-037` — An `Interface` node with `RUNTIME_ONLY` is exactly the shape of
"a protected runtime route missing from the declared registry", and
`DECLARED_ONLY` is the shape of an orphan declaration. Neither is an error state
in the IR; both are renderable findings.

```text
additional_gates[]       # in-handler authorization branches that narrow this
                         # interface beyond its pre-handler gate:
                         # { capability_ref, effect: NARROW | EXPAND,
                         #   evidence, applies_to_responses[] }
```

`ATLAS-IR-091` — An in-handler capability branch is an **obligation**, not an
observation. When a handler consults a capability that its pre-handler gate does
not require (the current case: the Admin-only business-integrity block inside a
route open to Admin *and* Maintainer), the branch must appear either as its own
`Operation` or in `Interface.additional_gates[]`. Omitting it is a conformance
defect, because omission would otherwise **validate silently** and the model would
understate an interface's effective gating. Without this rule, a two-truth route
would be expressible as one truth.

### 4.6 `Permission`

```text
key                      # the authoritative permission key (mirrors the catalog)
catalog_status           # ACTIVE | RESERVED | DEPRECATED | UNKNOWN
preset_refs[]            # DERIVED: RolePreset refs whose membership includes this key
consumed_by[]            # DERIVED: Interface/Operation refs gated by this key
inert                    # DERIVED: GRANTED_BUT_UNCONSUMED | CONSUMED | UNKNOWN
consumption_evidence[]   # evidence for the derived consumption state
```

`inert` (DERIVED, `ATLAS-IR-038`) is `CONSUMED` only when at least one
routed/operation gate is observed, with evidence. `GRANTED_BUT_UNCONSUMED` when
`preset_refs` is non-empty and `consumed_by` is empty within a stated closed
search. Note the asymmetry: **permission existence is never evidence of
consumption** (`ATLAS-SEM-035`, forbidden inference F-16).

### 4.7 `RolePreset`

```text
key                      # Role name (mirrors the catalog)
preset_kind              # APPLICATION_ROLE | SYNTHETIC_ACTOR
login_allowed            # TRUE | FALSE
assignable               # TRUE | FALSE
default_scope?           # Scope ref
permissions[]            # Permission refs
sensitive_permissions[]
```

`ATLAS-IR-039` — A `RolePreset` has no field expressing **resource reach**.
Resource reach exists only as `Operation.authority_requirement` (`scope_ref`,
`resource_anchor_ref`, `assignment_required`, `assignment_applies_to`).

`ATLAS-IR-092` — The one scope-shaped field a preset may carry is
`default_scope`, and its semantics are restricted: it names the **scope kind** at
which the role's capabilities are evaluated when no assignment narrows them (e.g.
"course", "exam", "organization"). It is **not** a resource claim and may not be
rendered as one. Concretely:

- a projection may say "Teacher capabilities are evaluated at course scope";
- a projection **may not** say or imply "Teacher → course X" from `default_scope`,
  nor derive any resource list from it;
- `default_scope` may never be used to satisfy `assignment_required`.

`ATLAS-IR-092` exists because a scope-kind field is the natural place for a
reach claim to creep back in. Without the restriction, the
"preset ≠ effective authorization" invariant would be editorial rather than
structural. Whether a projection violates this is an R1/R2 conformance
obligation (a projection conformance surface does not exist in v0.1; see
`r0-review.md` RV-9).

### 4.8 `Scope`

```text
value                    # the scope dimension (mirrors the catalog), or a named
                         # non-application boundary
rbac_participation       # APPLICATION_SCOPE | OUTSIDE_APPLICATION_RBAC
resource_domain          # the kind of resource this scope governs (e.g. course, exam, host infrastructure)
assignment_carrier       # { entity_ref, enforcement_seam, evidence } or NONE
list_filtering           # whether collection reads are filtered before pagination (TRUE|FALSE|UNKNOWN)
outside_authority?       # REQUIRED when rbac_participation = OUTSIDE_APPLICATION_RBAC:
                         # { holder_identity, granted_by, governed_by, resources[], excluded_from[] }
```

`ATLAS-IR-031a` — An `OUTSIDE_APPLICATION_RBAC` scope must carry
`outside_authority`, and claims about that identity use the **scope node as their
subject**. This is what makes the host operator answerable *from the model*
("who is it, what may it do, what is it excluded from") instead of requiring a
reader to leave the IR for an ADR — while still forbidding the identity from
being represented as a role or a permission.

### 4.9 `PolicyValue`

```text
value                    # the vocabulary value, e.g. timed_sync
vocabulary_class         # §3.9
representable            # TRUE | FALSE   (declared in the wire contract / schema)
storable                 # TRUE | FALSE | UNKNOWN   (SCHEMA CAPACITY: see ATLAS-IR-093)
write_reachable          # TRUE | FALSE | UNKNOWN   (a production path can persist it: a DIFFERENT question)
read_compatible          # TRUE | FALSE | UNKNOWN
activation_status        # DERIVED — see ATLAS-IR-040
activation_claim_ref     # the CAPABILITY_SUPPORT claim this value's status is derived from
activation_gate?         # { locator, lift_condition } when GATED
refusing_seams[]         # every place that refuses activation, with locators
transition_refs[]        # PolicyValue refs this value may transition to (with direction)
default_when_absent?     # canonical default resolved by the authority, or NONE
```

`ATLAS-IR-093` — `storable` means **schema capacity only**: a column or slot can
hold the value and no constraint rejects it. Whether any production path can
*persist* it is `write_reachable`, and whether the product *activates* it is
`activation_status`. The three are different questions and may not be collapsed:
a value can be `representable` + `storable` + `read_compatible` while
`write_reachable = FALSE` and `activation_status = GATED` — which is the negative
control's whole point.

`ATLAS-IR-040` — `representable`/`storable`/`read_compatible`/`write_reachable`
are **separate** from `activation_status`. A value with the first three true,
`write_reachable = FALSE` and `activation_status = GATED` is the negative-control
shape; the fields may never be collapsed into one "supported" flag.

`ATLAS-IR-040a` — `activation_status` is **DERIVED** from the value's owning
`CAPABILITY_SUPPORT` claim(s) (`activation_claim_ref`), not hand-set. It is
`SUPPORTED` only when such a claim exists and carries all four conjuncts of
`ATLAS-SEM-080` at the capability boundary; otherwise it takes the strongest
applicable non-supported value from those claims. A `PolicyValue` marked
`SUPPORTED` with no claim, no boundary and no supporting evidence is therefore
**invalid by construction** — which is what makes the negative control
non-bypassable at the node level and not merely at the slice level.

`ATLAS-IR-041` — `refusing_seams` is a list, not a single value, because
activation is refused at more than one seam by design (validator + publish gate +
…). A seam list that is empty while `activation_status` is
`GATED`/`NOT_SUPPORTED` is a defect.

### 4.10 `DurableEntity`

```text
semantic_name            # e.g. "frozen submitted answers"
semantic_authority_refs[]# NormativeAuthority refs that own its semantics
physical_carrier         # { schema_ref, table, columns[], migrations[] } or NONE
carrier_resolution       # RESOLVED | STALE | MISSING | AMBIGUOUS | UNKNOWN
state_values[]           # PolicyValue refs of this entity's state vocabulary
freeze_rule?             # e.g. freeze-once-at-submit, one-way completion
```

### 4.11 `NormativeAuthority`

Fields per semantic contract §2.2.

### 4.12 `WorkItem`

Fields per semantic contract §6.2.

---

## 5. Edges (11)

Every edge is directional and carries the following declaration:

```text
EDGE_SEMANTICS       source_type → target_type       DIRECTION: SOURCE_MEANS_EDGE_TARGET
ALLOWED_MULTIPLICITY source side 0..n / target side 0..n (with constraints)
EVIDENCE_REQUIRED    the minimum evidence for the edge to be asserted
CAN_BE_UNKNOWN       YES/NO + what partial representation is allowed
```

`ATLAS-IR-050` — The graph may be **incomplete**. A missing edge is represented
by the absence of the edge plus the node's `UNKNOWN`/`mapping_state`, never by
inventing an edge to make a traversal succeed.

`ATLAS-IR-051` — No `related_to`, no `associated_with`, no untyped "see also".
If a query needs a relation, it needs semantics, direction and evidence.

### 5.1 `contains`

```text
SOURCE_TYPE          Capability | Facet | Workflow
TARGET_TYPE          Facet | Workflow
DIRECTION            parent --contains--> child
SEMANTIC_MEANING     "the parent product concept is composed of, and is not
                      complete without, this child for the purposes stated in
                      the capability's boundary"
ALLOWED_MULTIPLICITY Capability 0..n facets, 0..n workflows
                     Facet exactly 1 parent Capability (single-parent constraint)
                     Workflow ≥1 parent (shared workflows allowed)
EVIDENCE_REQUIRED    a curation claim with review_state; the child's own
                     support/verification evidence is separate
CAN_BE_UNKNOWN       YES — a capability may have UNKNOWN composition (unmapped
                     parts), represented by mapping_state, not by a placeholder
                     child node
```

### 5.2 `performs`

```text
SOURCE_TYPE          Workflow
TARGET_TYPE          Operation
DIRECTION            workflow --performs--> operation   (the workflow step)
SEMANTIC_MEANING     "this operation is a step of this workflow"
ALLOWED_MULTIPLICITY Workflow 1..n steps; Operation 0..n workflows
EDGE_ATTRIBUTES      step_index (ordered), optionality (REQUIRED | OPTIONAL)
EVIDENCE_REQUIRED    operation source refs + a curation claim for the ordering
CAN_BE_UNKNOWN       YES — step ordering may be UNKNOWN while membership is known
```

### 5.3 `exposes`

```text
SOURCE_TYPE          Interface
TARGET_TYPE          Operation
DIRECTION            interface --exposes--> operation
SEMANTIC_MEANING     "this seam is an entry point that reaches this operation"
ALLOWED_MULTIPLICITY Interface exactly 1 operation; Operation 0..n interfaces
EVIDENCE_REQUIRED    RUNTIME_ROUTE_CAPTURE (runtime) or a named declaration
                     (declared); the node's declared_vs_runtime carries the split
CAN_BE_UNKNOWN       YES — for INTERNAL seams where the entry point cannot be
                     established, the interface is absent and the operation's
                     reachability is UNKNOWN
```

`ATLAS-IR-052` — A UI control is never a source of `exposes` (§7 Projection).

### 5.4 `requires_permission`

```text
SOURCE_TYPE          Operation
TARGET_TYPE          Permission
DIRECTION            operation --requires_permission--> permission
SEMANTIC_MEANING     "the operation's capability gate is this permission key"
ALLOWED_MULTIPLICITY Operation 0..1 (exactly 1 unless gate_kind is
                     AUTH_ONLY/PUBLIC/INTERNAL_SYNTHETIC); Permission 0..n
EVIDENCE_REQUIRED    the captured route gate (RUNTIME_ROUTE_CAPTURE) or, for
                     non-route operations, the guard seam's own locator + its test
CAN_BE_UNKNOWN       YES — gate_kind = UNKNOWN with no edge, never a guessed edge
```

### 5.5 `scoped_by`

```text
SOURCE_TYPE          Operation
TARGET_TYPE          Scope
DIRECTION            operation --scoped_by--> scope
SEMANTIC_MEANING     "the operation resolves this resource scope, and the
                      authority_requirement.assignment_required dimension applies"
ALLOWED_MULTIPLICITY Operation 0..1 scope (absent = no resource dimension);
                     Scope 0..n operations
EVIDENCE_REQUIRED    the enforcement seam locator + evidence that the seam is
                     applied on every surface (not merely the presence of a
                     scope value in the catalog)
CAN_BE_UNKNOWN       YES — assignment_required may be UNKNOWN while the scope
                     dimension is known
```

### 5.6 `reads` / `writes`

```text
SOURCE_TYPE          Operation
TARGET_TYPE          DurableEntity
DIRECTION            operation --reads|writes--> entity
SEMANTIC_MEANING     reads: "the operation's behaviour depends on this durable
                      fact"; writes: "the operation changes durable state here"
ALLOWED_MULTIPLICITY n..n
EVIDENCE_REQUIRED    a locator at the statement/transaction that performs it; for
                     `writes`, evidence of the effect (not merely a repository
                     method's existence)
CAN_BE_UNKNOWN       YES — an operation whose durable effects cannot be
                     established is reported with an empty effect list plus
                     durable_effects_state = UNKNOWN; an empty list is never
                     silently read as "no writes"
```

`ATLAS-IR-053` — `writes` must not be inferred from a route's presence or from a
repository method that the route does not call (`ATLAS-SEM-035`, F-05).

### 5.7 `governed_by`

```text
SOURCE_TYPE          any node (including NormativeAuthority, for supersession chains)
TARGET_TYPE          NormativeAuthority
DIRECTION            node --governed_by--> authority
SEMANTIC_MEANING     "this authority owns the fact type this node instantiates"
ALLOWED_MULTIPLICITY n..n
EVIDENCE_REQUIRED    a locator in the authority's own text declaring the fact type
                     it owns (not an inference from subject matter)
CAN_BE_UNKNOWN       YES — a node with no established owner carries
                     AUTHORITY_OWNER_UNKNOWN on its claims rather than a guessed edge
```

### 5.8 `tracked_by`

```text
SOURCE_TYPE          any node
TARGET_TYPE          WorkItem
DIRECTION            node --tracked_by--> work item
SEMANTIC_MEANING     "this work item owns or owned the gap/work that establishes,
                      changes or activates the node"
ALLOWED_MULTIPLICITY n..n
EVIDENCE_REQUIRED    the work item reference + the relation type
                     (DELIVERS | BLOCKS | RESIDUAL | DECISION_GATE)
CAN_BE_UNKNOWN       YES — OWNER_UNRESOLVED is represented on
                     open_governance_item, not by omitting the item
```

### 5.9 `transitions_to`

```text
SOURCE_TYPE          PolicyValue (STATE vocabulary class, or a MODE/FLAG value
                     with an activation transition)
TARGET_TYPE          PolicyValue (same vocabulary dimension)
DIRECTION            from_state --transitions_to--> to_state
SEMANTIC_MEANING     "this value may become this value under the stated guard"
EDGE_ATTRIBUTES      direction (ONE_WAY | BIDIRECTIONAL), guard_ref, evidence
ALLOWED_MULTIPLICITY n..n within one vocabulary dimension; no cross-dimension edges
EVIDENCE_REQUIRED    the conditional-write/guard locator, or a "no writer exists"
                     closed-search result (which yields a transition with
                     reachability = NOT_REACHABLE rather than no edge)
CAN_BE_UNKNOWN       YES — reachability per transition is UNKNOWN when the search
                     scope is incomplete
```

`ATLAS-IR-054` — A one-way transition (e.g. grading `pending_manual` →
`completed_manual` with no revision path) is represented as a `transitions_to`
edge with `direction = ONE_WAY` plus a **recorded reverse-absence** claim. "No
reverse transition" is evidence-bearing, not an omission.

### 5.10 `depends_on`

```text
SOURCE_TYPE          Capability | Facet
TARGET_TYPE          Capability | Facet
DIRECTION            dependent --depends_on--> prerequisite
SEMANTIC_MEANING     "the source is not operable as a product capability unless
                      the target is operable" (product-level dependency)
ALLOWED_MULTIPLICITY 0..n, acyclic (cycles are a defect)
EVIDENCE_REQUIRED    authority text or a reachable-path argument naming the
                     dependency; operation-level state predicates must NOT be
                     expressed here (use Operation.state_prerequisites)
CAN_BE_UNKNOWN       YES
```

### 5.11 Rejected edges

| Candidate | Verdict | Reason |
| --- | --- | --- |
| `implements` (Operation → Capability) | **REJECTED** | It would duplicate the `contains`+`performs` path to the same conclusion — two ways to ask one question, the second drifting from the first. If a direct traversal is ever needed it is a derived shortcut over those edges, not a stored edge. |
| `verified_by` (→ Evidence) | **REJECTED** as an edge | Evidence is not a node in v0.1. It is realized as `Claim.supporting_evidence[]` / `challenging_evidence[]`, which also avoids promoting every test file into the graph. |
| `related_to` | **REJECTED** | No semantics, no direction, no evidence requirement. |
| `flows_to` between workflows | **REJECTED** | Cross-workflow sequencing is a product statement; express it as `depends_on` or not at all. |

---

## 6. Stable identity

### 6.1 Grammar

`ATLAS-IR-026` — The grammar is **per namespaces**, not one character class. There
are three sub-grammars, and each ID must satisfy exactly its own:

```text
kind       ∈ {capability, facet, workflow, operation, interface,
              permission, role, scope, policy, entity, authority, work}

(curated)     capability | facet | workflow | operation | entity | scope
              local-name = dot-separated segments, each [a-z0-9][a-z0-9_-]*
              e.g. capability:grading.manual, entity:answer.frozen-submission

(mirrored)    permission | role | policy | authority | work
              local-name = the owning source's key, VERBATIM
              e.g. role:Grader (catalog spelling), permission:grading.score.write,
                   authority:adr-019
              work additionally uses the external object form:
                   work:<owner>/<repo>#<number>   e.g. work:jnhu76/exam#756

(http)        interface, HTTP form
              interface:http.<METHOD>.<normalized-path-template>
              METHOD is upper case; the path is the wire path template
              e.g. interface:http.POST./api/admin/attempts/:attemptId/grade-question

(seam)        interface, non-HTTP form
              interface:<seam-kind>.<curated-name>   e.g. interface:internal.deadline-scanner
```

`ATLAS-IR-026` rationale: a single `[a-z0-9-]` class could not produce the
mirrored or HTTP forms at all, so "closed namespace" would have been stated but
unenforceable. Per-namespace grammar makes each ID validatable.

`ATLAS-IR-027` — **Path-template normalization** (HTTP interfaces), so that two
writers cannot emit different IDs for one endpoint:

1. the method is upper-cased;
2. the registered path is used **with its runtime prefix** (`/api/…`) and with
   leading `/`;
3. duplicate slashes are collapsed and a trailing slash is removed;
4. parameter names are **kept verbatim** — `:attemptId` and `:id` are different
   templates and produce different IDs, because the template is the externally
   visible contract and a parameter rename is a real interface change;
5. no query string, no fragment, no host;
6. case is preserved in the path (paths are case-sensitive).

Examples:

```text
capability:grading.manual
facet:content.rich.typed-shortcuts
workflow:grading.manual.review
operation:grading.grade-question
interface:http.POST./api/admin/attempts/:attemptId/grade-question
interface:http.POST./api/attempts/:attemptId/answers/:questionId
permission:grading.score.write
role:Grader
scope:exam.assignment
scope:host-infrastructure
policy:exam.timingMode/timed_sync
entity:answer.frozen-submission
authority:exsem
work:jnhu76/exam#756
```

Every ID above is checked against the sub-grammar that owns it
(`ATLAS-IR-026`); the two HTTP IDs are registered paths with their runtime prefix
and verbatim parameter names (`ATLAS-IR-027`), not illustrative strings.

### 6.2 Rules

`ATLAS-IR-020` — **`SEMANTIC_ID != SOURCE_PATH`.** No identity may contain a
repository path, file name, file extension, line number, byte offset or commit
SHA. A file move, rename or split must not change any semantic ID.

`ATLAS-IR-021` — Identity namespaces are **closed**: a new `kind:` prefix or a
new top-level namespace segment requires a semantic-contract change, not a
writer-local decision.

`ATLAS-IR-022` — **Retired IDs are never reused.** An ID that changes meaning is
a new ID; the old ID is recorded as retired with the reason. Reusing a retired ID
for a different concept is a defect (it silently rewrites history for every
snapshot diff and every external reference).

`ATLAS-IR-023` — **Renames are explicit.** The node header (§4) carries
`renamed_from[]`, `renamed_to?`, `retired_at?` and `rename_reason?`, so an
identity change is representable rather than implied. Aliases resolve old→new for
traversal; aliases are never emitted as identities, and a `renamed_from` entry
must reference an ID that is now retired (`ATLAS-IR-022`).

### 6.3 Two identity origins, never mixed

| Origin | Applies to | Rule |
| --- | --- | --- |
| **Mirrored** | `permission`, `role`, `policy`, `authority`, `work` | The ID **mirrors the owning source's key** (`grading.score.write`, `Grader`, `timed_sync`, the doc slug, `owner/repo#number`). Atlas does not invent or re-spell these; a mismatch with the owner is a defect. |
| **Curated** | `capability`, `facet`, `workflow`, `operation`, `interface`, `entity` | The ID is an Atlas-curated name in a closed namespace, owned by the curation registry, and changeable only through `ATLAS-IR-023`. |

`ATLAS-IR-024` — For HTTP interfaces, `contract_identity` (method + normalized
path template) **is** the wire-contract identity, because the path is the
externally visible contract, not a file location. A route rename is therefore a
real interface change requiring a rename record; the file/symbol that registers
it lives in the source ref only.

`ATLAS-IR-025` — Symbol names, line numbers and section headings live in
`ArchitectureSourceRef` (§provenance), never in identity.

### 6.4 Stability test (R1 gate, specified here)

A snapshot must preserve every semantic ID across: file rename, file move,
module split/merge, route re-registration in a different plugin, and test
relocation. R1 must prove this by rebuilding at two revisions that differ by a
pure move/rename and asserting an identity-preserving diff.

---

## 7. Deterministic normalization contract

Goal (`ATLAS-IR-060`):

```text
same semantic input ⇒ byte-identical normalized representation
```

Same semantic input means: same revision, same extractor version, same curation
input, same IR schema version.

### 7.1 Rules

1. `ATLAS-IR-061` — **Canonical record order.** Nodes sorted by `(kind, id)`;
   edges sorted by `(source_id, edge_kind, target_id, discriminator)` where
   `discriminator` is the edge's full qualifying-attribute tuple in schema field
   order — for `performs`: `step_index`; for `transitions_to`: `direction` then
   `guard_ref`; for `reads`/`writes`: `effect_kind` then `mutability`. Every edge
   type with qualifying attributes must name its discriminator tuple so that
   parallel edges (§7.1 `ATLAS-IR-066`) have a total order. Sorting is by
   **Unicode code point**, never locale collation.
2. `ATLAS-IR-062` — **Canonical key order.** Object keys serialized in the
   schema's declared field order (or sorted; whichever R1 chooses, it must be one
   rule, applied everywhere).
3. `ATLAS-IR-063` — **Canonical set semantics.** Set-valued fields are
   deduplicated and sorted by ID; arrays whose order is semantic (`step_index`)
   keep their declared order and must not be re-sorted.
4. `ATLAS-IR-064` — **No wall-clock in normalized semantic comparison.**
   Extraction timestamps, `generated_at`, durations and external `updatedAt`
   values are excluded from the normalized comparison form; they live in a
   provenance/telemetry section that is hashed separately or not at all.
   The snapshot's *semantic* identity must not change because a rebuild happened
   later.
5. `ATLAS-IR-065` — **No iteration-order or filesystem-order dependence.** Where
   two records share `(kind, id)`, they **merge deterministically**:
   - single-valued fields must agree; disagreement is a `CONFLICT` record —
     never last-write-wins, never first-wins;
   - set-valued fields are the union of the inputs;
   - **order-bearing** fields (`performs.step_index`, `additional_gates[]`,
     workflow steps) are ordered by their declared ordering key, and two records
     claiming the same ordering key with different content are a `CONFLICT` —
     they are not concatenated.
6. `ATLAS-IR-066` — **Parallel edges remain distinct** where their semantics or
   qualifiers differ; exactly identical edges collapse to one.
7. `ATLAS-IR-067` — **Source-ref ordering** is `(repo, source_kind, path_or_uri,
   symbol, section, line_start)`; duplicate refs collapse.
8. `ATLAS-IR-068` — **Sentinel serialization.** Three sentinels are defined and
   distinct from an absent field:
   ```text
   field absent      → not applicable / not present in this schema version
   field = UNKNOWN   → required by the schema, not establishable (may carry a reason)
   field = NONE      → the concept does not apply (e.g. capability_ref = NONE for a
                       PUBLIC operation; assignment_carrier = NONE for a scope with
                       no assignment dimension)
   field = null      → not used in v0.1
   ```
   A field whose value is genuinely unknown must be serialized as `UNKNOWN`, not
   omitted, whenever the schema requires it. `NONE` and `UNKNOWN` must never be
   interchanged: `NONE` is a knowledge claim ("there is no such thing here"),
   `UNKNOWN` is its absence.
9. `ATLAS-IR-069` — **Optional vs absent, enforced by an explicit default table.**
   Every optional field must appear in a single **default table** (one row per
   field: `field → default sentinel/value`), and the writer must materialize the
   default value for any omitted optional field. "Omitted" and "explicitly
   default" therefore normalize to the same bytes. A field that is optional but
   absent from the default table makes this rule unenforceable and is a schema
   defect, not a writer choice.
10. `ATLAS-IR-070` — **No floating-point fields** in semantic positions.
    Numeric facts are integers or exact strings.
11. `ATLAS-IR-071` — **No free-text escape hatch.** There is no `notes`,
    `comment` or `misc` field in the normalized form. Rationale and human
    explanation live in the referenced claim; a free-text field would let a
    writer bypass every rule above.
12. `ATLAS-IR-072` — **Manifest is part of the snapshot** and declares: repository,
    `git_sha`, `ir_schema_version`, `source_ref_version`, extractor id + version,
    curation input revision, and the hash of the normalized body. The manifest is
    excluded from the semantic diff except for its identity fields.

### 7.2 What R0 does not do

R0 specifies these rules; R1 implements the writer and proves them with a
double-rebuild equality gate. **No serializer is written in R0** and no
machine-readable fixture is added in R0.

---

## 8. IR-level invariants

| ID | Invariant |
| --- | --- |
| `ATLAS-IR-080` | Every node except `Capability`/`Facet`/`Workflow` has ≥1 source ref; `Capability`/`Facet`/`Workflow` must have ≥1 sanctioned mapping (an operation path or a work item) or `mapping_state = UNMAPPED`/`UNKNOWN`. |
| `ATLAS-IR-081` | No node contains a path, line number or SHA in its identity (§6.2). |
| `ATLAS-IR-082` | `Interface.declared_vs_runtime` is derived; both blocks survive. |
| `ATLAS-IR-083` | `Permission.inert` is derived from consumption ∪ closed search, never read from a comment. |
| `ATLAS-IR-084` | `PolicyValue.representable`/`storable`/`read_compatible` never imply `activation_status`. |
| `ATLAS-IR-085` | The `role:` namespace equals the catalog's closed role set exactly. |
| `ATLAS-IR-086` | `OUTSIDE_APPLICATION_RBAC` scopes have no permission/gate path into them. |
| `ATLAS-IR-087` | `Capability.support_summary` is `MIXED` (not flattened) when supported and unsupported parts coexist. |
| `ATLAS-IR-088` | No stored grantee set exists anywhere (§4.4 `ATLAS-IR-035`). |
| `ATLAS-IR-089` | The snapshot contains no secret, credential, token, or candidate personal data; source refs are locators, and any excerpt is bounded and non-sensitive (§provenance 6). |
| `ATLAS-IR-090` | The IR has no dependency on a renderer, layout, Three.js, or a graph database. |
| `ATLAS-IR-091` | Every in-handler authorization branch is modelled as its own `Operation` or recorded in `Interface.additional_gates[]`; omission is a conformance defect. |
| `ATLAS-IR-092` | `RolePreset.default_scope` names a scope **kind** only; no projection may derive a resource list from it or use it to satisfy `assignment_required`. |
| `ATLAS-IR-093` | `PolicyValue.storable` is schema capacity, `write_reachable` is production writability, `activation_status` is product activation; the three are never collapsed. |
| `ATLAS-IR-094` | Every non-HTTP `interface:` ID and every HTTP `interface:` ID satisfies its own sub-grammar, and every HTTP ID satisfies the path-template normalization (`ATLAS-IR-026`/`-027`). |
| `ATLAS-IR-095` | `Capability.support_summary = SUPPORTED` requires clause 2 of `ATLAS-IR-032` in full: ≥1 part, every part qualifying **at `support_boundary`**, and a closed-search statement about unmapped parts (mapping coverage is enforced for all clauses by clause 0). A `support_summary` without `support_boundary` is invalid. `NOT_SUPPORTED` requires the positive negative evidence of `ATLAS-SEM-084`; it may never be derived from an empty evidence set, and `mapping_state ≠ MAPPED` yields `UNKNOWN`, never `NOT_SUPPORTED`. |
