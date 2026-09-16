# Encounter Choice and Identity Resolution

Status: locked after focused adversarial review; ready for implementation.
Base: `a1ed2fa5` (native Trial identity correction).

## Objective

Keep friendly encounter choices such as Combat while making their concrete
meaning explicit and unambiguous for each room, phase and reward context.
Authored choices must not masquerade as resolved native encounters. Simulation,
eligibility and execution publication must agree on the same exact definition.

This is one complete implementation slice followed by review and closure, not
a replacement encounter engine or a UI redesign.

## Evidence and Current Boundary

- Catalog `EncounterAuthoringProfile` presently groups definition keys. F/G/I
  use mutually exclusive definition requirements to select contextual Combat
  variants; most other profiles are direct one-definition choices.
- `simulation/encounters/resolve.ts::resolveEncounterPhases` reads the profile
  key as a definition key and returns `ResolvedEncounterPhase`, including
  behavior flags, before contextual preparation occurs.
- `simulation/encounters/preparation.ts::prepareRoomEncounterPhases` subsequently
  filters eligible profile members and resolves the actual definition. This
  mixes identity selection with eligibility assessment.
- `history/composition.ts` and `history/lifecycleInput.ts` also support structural
  traversal without eligibility validation. That traversal needs honest
  identity resolution, not a profile's representative behavior.
- Materialization, Fields/NPC discovery, generation, reward-wheel projections,
  authored trait/default handling, application projections and execution
  assembly have consumers of these preliminary phases or namesake keys.
- The preceding fix changed entry restrictions and publication to read resolved
  identities. Preserve its F/G/I Trial and I goal behavior and regression tests.

Native evidence is owned by
`docs/audits/rooms-and-routes/ENCOUNTER_SELECTION_AND_COMPOSITION_FINDINGS.md`:
reward setup assigns F/G/I Trial definitions directly; small and ordinary I
rooms share `DevotionTestI`. I goal variants depend on room/reward setup.
The planner retains friendly choices rather than separately authoring the
native encounter implied by an already-authored reward. This is a deliberate
authoring simplification, not a license to pick an arbitrary eligible encounter.

## Locked Target Contract

### Choice, mapping, eligibility

1. A room's existing envelope/slot binding identifies its authored choice domain.
   Fixed bindings remain fixed. A choice owns its stable key and friendly label;
   its key need not be interpreted as a concrete definition key.
2. Catalog declarations own a small closed resolution mapping: direct definition,
   or reward-type-specific definition with an explicit ordinary/default mapping.
   Room-specific differences belong in the room's bound set. Reuse existing
   normalized catalog construction; do not introduce a predicate DSL or resolver
   registration system.
3. One pure engine resolver returns the concrete identity for that choice and
   known context. It does not read eligibility history to choose a different
   member. Reward selector predicates move out of definition eligibility when
   they exist solely to select identity; genuine eligibility requirements stay.
4. Preparation assesses the resolved definition against the existing exact
   history checkpoint, including prior same-room recorded phases. An ineligible
   choice remains authored and repairable. It never becomes another choice.
5. Missing contextual authorship remains incomplete; do not guess a definition
   to make later phases or controls seem evaluated. A broken or ambiguous
   declaration is a contract error, not a player finding or first-match rule.

Examples that must retain their exact meaning:

| Binding/context                  | Combat definition             |
| -------------------------------- | ----------------------------- |
| F ordinary reward                | `GeneratedF`                  |
| F Trial                          | `DevotionTestF`               |
| G Trial                          | `DevotionTestG`               |
| I small room, ordinary reward    | `GeneratedI_Small`            |
| I ordinary room, ordinary reward | `GeneratedI`                  |
| I small room, goal reward        | `GeneratedI_Small_GoalReward` |
| I ordinary room, goal reward     | `GeneratedI_GoalReward`       |
| Either I room binding, Trial     | `DevotionTestI`               |

### Authored and resolved products

The normalized authoring profile owns a choice key, label and closed direct or
reward-context resolution specification. Catalog construction validates every
target reference, the explicit default for a contextual mapping, and exclusive
context cases. Direct-only declarations can normalize to this product using
their existing definition label. Remove the compiler/decoder requirement that
a profile key must itself name one of its definitions; authored commands and
codecs validate choice membership instead. Preserve current persisted key
values for compatibility, not as an implicit definition lookup convention.

One typed resolution-context input distinguishes a known reward type, known
absence of a reward, and unavailable reward authorship. Its engine-owned
producer derives facts from the retained canonical room: Clockwork goal
disposition takes precedence over the incoming reward, a resolved incoming
offer supplies its reward type, explicit no-reward is known absence, and an
unresolved required incoming reward is unavailable. Room declarations and
retained incomplete markers distinguish absence from missing authorship;
undefined alone must not mean ordinary. Direct mappings need no reward context;
contextual mappings with unavailable context return no resolved phase or
effects. Structural history and lifecycle input consume the same identity
resolver without an eligibility check, retaining the existing incomplete
frontier rather than substituting an ordinary encounter.

- Retained materialization carries active slot identity, authored choice/fixed
  binding and authored dispositions. It must not carry guessed effective
  encounter behavior under a resolved-phase type.
- A genuinely resolved phase carries the exact definition and its effective
  behavior. Lifecycle execution and recorded history use only that product.
  Identity-only structural traversal can use the same pure resolver without
  pretending that eligibility has been evaluated.
- Keep the existing chronological preparation owner; no extra evaluator,
  timeline cursor, scheduler or replay pass. Resolve once per owning contact
  and return the complete product to its consumers.
- Consumers needing an authored NPC/trait leaf before simulation may use the
  declared direct mapping or explicit invariant authoring facts. They may not
  index definitions by a contextual choice key or borrow its first member.
- Candidate projections retain the authored selection and label but assess its
  resolved definition. Compiler/executor consumers do not reconstruct mappings.
  Entered publication stays sourced from recorded exact encounters; unentered
  structural output may resolve known identity without inventing entry effects.

### Uniqueness and friendly labels

The invariant is one concrete definition per visible choice within one room,
phase and supported context, not one combat encounter globally. Mutually
exclusive variants may share Combat. Two genuinely distinct available choices
in that context need distinct keys and friendly labels. An incorrectly bound
definition must be removed from the binding, not cosmetically relabeled.

Use production resolution in a catalog-owned matrix over declared room/slot
bindings and their reward contexts. Assert total, single-valued resolution for
supported contexts, membership in the bound set and no indistinguishable Combat
choices. Keep explicit expected I small/ordinary/goal and Trial witnesses so a
uniqueness check cannot certify a uniquely wrong binding. If mapping shape
prevents competing variants by construction, test that construction boundary
and same-context choice-label collisions rather than fabricate impossible data.
Do not require global label uniqueness across rooms, phases or mutually
exclusive contexts, or exhaustively simulate unrelated reward eligibility.

## Ownership and Change Neighborhood

- Catalog: `declarations/encounters/{types,f,g,i}.ts`, compiler encounter-set
  normalization and closure; direct declarations elsewhere only as needed by
  the supported normalized shape. Catalog owns the mapping/label matrix.
- Engine contracts/authorship: `catalog-schema`, `authored-project/room-state/
encounter-*`, encounter commands and declaration-owned trait leaf handling.
  Preserve persisted keys, defaults, addresses and repair behavior.
- Engine interpretation: `simulation/encounters/{model,resolve,preparation,
candidates,authoring-domain}.ts`; materialization rooms/templates/hub;
  history composition/lifecycle input; remaining phase consumers under
  generation, Fields, rewards and execution assembly.
- Application: encounter picker/workspace projections adapt supported choice
  metadata and resolved products; no room/reward dispatch in React or Redux.
- Executor: excluded from production edits. Mirror fixtures only if their
  semantic execution product genuinely changes.

## Delivery

### Gate A — One complete implementation slice

Implement mappings, honest phase products, consumer changes and primary tests
together. Remove superseded profile-member eligibility selection, namesake
definition lookups and preliminary behavior paths in the same slice. Do not
land a compatibility shim or interface-only commit. Existing persisted keys and
wire format are expected to remain unchanged; escalate a demonstrated need to
change either before doing so.

Acceptance:

- Catalog normalization/reference tests and complete binding/context uniqueness
  matrix, with exact F/G/I expected identities and clear collision diagnostics.
  Include a choice key distinct from its definition, missing contextual default
  and representable conflicting mappings at their construction boundary, plus
  unavailable reward context separately from known no-reward/direct mapping.
- Engine tests retain invalid NPC repair, contextual reward edits, Trial
  Fig Leaf/Gorgon restrictions, exact I goal publication, and F/G acquisition
  windows. Existing H/O/P phase and N side-room witnesses remain authoritative;
  use them rather than duplicate their full policy matrices.
- One representative application witness preserves a Combat picker and its
  alternatives/findings across a contextual reward change. No UI redesign.
- TypeScript separates retained and resolved products; lifecycle consumers
  cannot accept preliminary behavior accidentally. Avoid a production audit
  registry or duplicate shadow model for testing.
- Complete valid execution products remain semantically unchanged from the
  base. Investigate differences rather than refreshing fixtures automatically.

### Gate B — Independent review and closure

Fresh independent review checks resolver ownership, wrong-room collisions,
identity-versus-legality, incomplete/invalid repair, dormant/multi-phase behavior,
structural replay and fixture churn. Main session owns finding disposition,
bounded remediation, final broad verification and Git operations.

Run narrow catalog/engine/application witnesses during implementation, then one
complete repository `npm run check` after stable review fixes. If a stale
snapshot needs an expected update, inspect its semantic cause and rerun the
affected lane; do not repeatedly run the broad gate for review evidence.

At closure, rewrite the inaccurate Concrete Encounter Selections section of
`docs/design/AUTHORED_PROJECT_MODEL.md` and integrate the distinction into the
owning encounter preparation section of `ROOM_LIFECYCLE_MODEL.md`. Update other
authorities only if their contract actually changes. Delete this temporary
plan; do not add bug-history paragraphs or stable links to it. Implementation
and closure may be one commit once review and checks pass.

## Exclusions

No encounter wave/enemy simulation, native game hooks, reward eligibility
redesign, new user choice for Trial identity, renamed saved keys solely for
style, changes to counters/phasing, broad directory reorganization, generic
condition language, new fixture family, or fresh long-lived audit document.

## Verification Record

Plan review and implementation results are recorded here while delivery is
active and summarized in the closure commit when this plan is retired.

- Independent plan review identified two contract gaps: explicit unavailable
  resolution context, and removal of profile-key-as-definition construction
  constraints. Both are incorporated above; no remaining scope conflict was
  reported.
