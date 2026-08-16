# Unresolved Reward and Trait Authoring Implementation

## Status

Locked implementation plan created from audit base
`de3e339c7967a9ce61815c75b887a9d951a1729e`. The merged Gate-A contract was
adversarially reviewed against clean plan commit
`52ec615ef423b53ad19226aa9fc0326ebe7d00a6` before lock. Each executor handoff
records the exact later implementation base rather than treating the audit base
as executable state.

This document is temporary delivery authority. It is not linked from the
README or stable design documents. Implementation begins only after the fresh
adversarial review has checked the plan against the installed game scripts,
the live schema-41 code, representative persisted projects, and the exact
default-consumer inventory and every accepted plan finding is incorporated.

Owning evidence:

- [`AUTHORED_REWARD_AND_TRAIT_DEFAULTS_AUDIT.md`](../audits/AUTHORED_REWARD_AND_TRAIT_DEFAULTS_AUDIT.md)
- [`REWARD_GAME_DATA_AUDIT.md`](../audits/REWARD_GAME_DATA_AUDIT.md)
- [`TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`](../audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md)
- [`TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md`](../audits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md)

Stable model authorities remain truthful descriptions of schema 41 until the
closing gate absorbs the completed replacement.

The reward migration is one delivery boundary. Ordinary rooms, room-local
cohorts, Shops, supplemental entries, generic pickups, and Artificer all use the
same authored reward and acquisition machinery; splitting them would preserve
temporary default branches in shared code. Gate A therefore migrates every
reward owner together, using internal implementation checkpoints but one
schema, independent review, and commit.

## Objective

Remove every invented reward, payload, Shop, and generated-trait default from
authored semantics. Creating or structurally changing a room must never choose
a reward or trait outcome on the player's behalf.

The user-visible result is:

```text
new authorable reward or offer      -> Choose… / incomplete
user authors a supported outcome    -> complete selected value
upstream edit later invalidates it  -> retained selected-invalid repair state
fully fixed game outcome            -> derived concrete fact, no fake choice
```

Untouched authorable leaves produce one missing-authorship finding, not a set of
Apollo, first-store-entry, Shop-slot, Hammer-triple, or other default-derived
findings. They consume no bag entry, mutate no offer/history state, and publish
no acquisition consequences until authored.

The unresolved state must also be operationally safe. Replacing an invented
Apollo default with `null` is not successful if the same room creation,
replacement, selection, or unrelated authored command now throws on `null`.
Every supported unresolved project is a valid persisted and editable project,
even though selected simulation is incomplete.

## Locked Modeling Decisions

### 1. Unresolved is explicit and structurally valid

Every migrated authorable reward leaf supports an explicit unresolved value in
addition to a complete `AuthoredRewardState`. Every migrated generated-trait
leaf supports an explicit unresolved value in addition to a complete
`AuthoredTraitOffer`.

The strict codec distinguishes unresolved from an omitted required field and
from a malformed complete value. The implementation plan may select the
smallest exact JSON representation during Gate A, but it must use one canonical
representation everywhere; it may not mix omitted fields, sentinel strings,
empty objects, and `null` as equivalent unresolved states.

Preferred disposition for the live model is explicit `null`, matching existing
batch-store and child-result practice:

```text
authorable reward owner -> null | complete reward state
required trait role     -> null | complete trait offer
```

Sparse ownership remains separate. Absence means the declaration does not own
that leaf or a producer has not materialized the row; `null` means an owned,
active or retained authorable leaf has not been authored.

### 2. Fixed facts are derived at the narrowest complete boundary

A payload-free reward whose complete identity is fixed by the producer remains
concrete and requires no author interaction. Fixedness is field-sensitive:

- fixed Nectar is fully derived;
- fixed Mystery Boon derives its type but still requires the hidden source;
- fixed Apollo derives the provider but still requires the generated trait
  offer; and
- a Hammer provider derives the current loadout compatibility domain but not a
  concrete three-upgrade offer.

No uniform nullable wrapper may turn a zero-choice game fact into busywork.

### 3. A reward selection is one complete offer

Reward type and payload are one semantic selection. The existing compound
picker may retain transient type/source/Devotion steps, but it dispatches only
one complete offer. It never commits a partial payload and never fills a
missing payload from a catalog seed.

Selecting a complete reward establishes the ordinary acquisition baseline and
declaration-fixed data only. It creates unresolved player-authored nested
children for trait offers, Pom resolutions, Artificer replacements, or other
separate decisions rather than recursively choosing them.

### 4. A generated trait offer is one complete outcome

A known giver owns an unresolved offer until the user submits either:

- one to three concrete trait options and the selected option; or
- a supported mutually exclusive Fallback Gold outcome.

The trait dialog may keep an empty or partial draft in transient UI state. One
semantic command commits the complete offer. Persisted partial option arrays,
placeholder trait keys, and a declaration-selected option are forbidden.

Option-owned results that are legitimately separate decisions—Circe, Echo
children, All Together sets, targeted acquisition detail, and similar closed
children—retain their existing explicit completeness rules beneath the
completed outer offer.

### 5. Missing authorship and contextual invalidity remain distinct

An active unresolved leaf produces exactly one missing-authorship finding at
its stable owner, stops selected chronology at that lifecycle point, and
retains the exact pre-leaf candidate capability. Candidate failures remain in
the picker and do not become selected-plan findings.

A complete value that becomes invalid remains persisted, visible, navigable,
and replaceable. No command, codec, materializer, candidate evaluator, or React
effect silently resets it to unresolved or another candidate.

### 6. Payload and participation remain separate

An optional inventory row may be active and editable while absent from pickup
or purchase order. This applies to supplemental Shops and ordered Artificer
replacements. Structurally dormant or unreached leaves publish no controls or
findings, but unselected participation is not structural dormancy.

### 7. Cohort semantics do not collapse to row defaults

Unresolved peers preserve their owning generation contract:

- door rewards use physical order, store consumption, and prior-peer
  exclusions;
- Fields cages and optionals retain their existing producer order;
- Shop profiles preserve group counts and without-replacement assignment;
- O wheels preserve their wheel-local order;
- Devotion resolves one source pair; and
- trait offers assess the whole one-to-three-option result against one
  immutable pre-selection history.

A later unresolved row may be conditioned only on earlier outcomes the user
has actually authored, or on an engine-owned existential completion across the
remaining unresolved cohort. Neither selected simulation nor candidate
evaluation may temporarily install the first candidate as authored state.

### 8. Clean schemas; no compatibility layer

Each gate that changes persisted shape advances the strict schema and rejects
its immediate predecessor. There is no compatibility decoder, migration shim,
dual old/new field, or runtime default repair. Named project fixtures are
reauthored explicitly for the new contract.

Intermediate gates may retain catalog seed fields only while an explicitly
unmigrated owner still consumes them. A migrated owner must remove its old
consumer in the same commit. The final behavior gate deletes every remaining
production seed field and helper.

Schema numbers follow semantic model boundaries, not room-family boundaries.
Gate A advances the shared reward model and immediate keepsake-result model
once. Gate B advances the remaining encounter-owned trait-offer model once.
The project must not advance a schema
for an internal implementation checkpoint.

### 9. Unresolved handling is total, not exceptional

Canonical unresolved values never enter evaluators that require a concrete
reward, payload, giver, trait option, or selected child. Every owning boundary
must branch on unresolved before concrete assessment, bag consumption,
composition, history mutation, or lifecycle settlement.

For a structurally supported unresolved leaf:

- strict decoding succeeds;
- room creation, room replacement, count changes, participation changes, and
  unrelated semantic commands remain applicable according to their own
  structural contracts;
- the command that completes the unresolved leaf can be derived from the exact
  retained pre-leaf candidate product;
- selected simulation stops normally at the leaf and returns one
  missing-authorship finding plus its pre-leaf artifacts;
- application projection remains constructible and navigable from that partial
  evaluation; and
- React renders the repair control without catching or translating a domain
  exception.

Malformed complete values and complete-but-context-invalid selections retain
their existing strict rejection/finding behavior. Unresolved is neither a
candidate nor an invalid concrete value, and exceptions must not be used as its
control flow.

### 10. Encounter and keepsake identity remain concrete

This phase removes invented trait outcomes owned by encounters and keepsake
equip transitions; it does not make encounter or keepsake identity unresolved.
Existing encounter selection/default behavior for Combat, Artemis, Heracles,
and other encounter identities remains intact. Selecting Jeweled Pom or
Experimental Hammer also remains one concrete keepsake selection; only its
random immediate trait result is unresolved. Reauthoring those identities would
add repeated work without removing a random reward or trait outcome.

The boundary is:

```text
encounter identity                         -> existing concrete behavior
trait-producing encounter becomes active  -> known provider, unresolved offer
completed encounter-owned trait offer      -> existing settlement behavior
keepsake identity                           -> existing concrete behavior
random immediate keepsake trait result      -> unresolved result
```

No gate may reinterpret an encounter/keepsake default, fixed encounter
assignment, or identity-selection command as part of the reward/trait seed
cleanup. A newly created supported occurrence must not gain a
missing-encounter or missing-keepsake finding merely because its owned random
trait result is unresolved.

## Included Scope

- reward-type payload seeds;
- counted-store and per-room counted defaults;
- ordinary fixed/count/free/anomaly incoming reward leaves;
- Ephyra main and side rewards;
- Fields cages and optional rewards;
- O reward wheels;
- initial Shop inventory and without-replacement groups;
- Infernal Contract, Travel Deal, and Echo Gold supplemental rows;
- acquisition-site pickups, including Narcissus;
- Artificer replacement generation and later pickup;
- Echo last-reward recreation and other generated acquisition entries;
- acquisition-role trait offers for ordinary gods, Hermes, Hammers, Devotion,
  Blind Box, Shop wrappers, and recreated rewards;
- encounter/NPC-generated trait offers, including Gorgon Athena;
- Jeweled Pom and Experimental Hammer immediate equip trait results at route
  start and Postboss, including Experimental Hammer Echo replay consistency;
- room creation, replacement, activation, retention, commands, codecs,
  completeness, progressive evaluation, candidates, findings, focus,
  undo/redo, persistence, and Run State contact where relevant; and
- deletion of normalized and raw production defaults after their final
  consumer is migrated.

## Excluded Scope

- changing reward-store composition, requirements, refill, or bag semantics;
- changing trait pools, rarity, offer composition, replacement, Denial, or
  Forfeit rules;
- changing Shop purchase/acquisition chronology or supplemental-row ordering;
- RNG replay, probability display, rerolls, prices, affordability, or resource
  balances;
- making encounter identities—including Combat, Artemis, Heracles, and other
  once-per-run encounter selections—or keepsake identities, numeric counts,
  topology, Arcana, Fear, or unrelated child results unresolved;
- introducing a generic effect/callback registry, parallel reward engine,
  pending-reward map, UI-owned candidate policy, or partial authored draft
  model;
- implementing Stygian Wells, Shrines of Hermes, or natural-resource element
  events; and
- broad presentation polish already retained in `PRODUCT_POLISH.md`.

## Authority and Data Flow

### Catalog

The catalog continues to own domains and fixed facts:

- store entries, multiplicity, requirements, and duplicate rules;
- reward payload domains and source-support policy;
- Shop option identities, groups, slot-to-group structure, counts, and
  without-replacement policy;
- acquisition roles and lifecycle points;
- giver trait pools, priority traits, rarity policy, offer contexts, and Hammer
  compatibility; and
- producer-fixed reward/provider identity.

The final catalog must not own an authored first choice. Retired production
vocabulary includes:

- reward-type `defaultPayload`;
- store `defaultRewardType` and normalized `defaultOffer`;
- counted-binding `defaultRewardTypesByStore` and normalized
  `defaultOffersByStore`;
- Shop-slot `defaultOptionKey` and `defaultOffer`;
- Infernal Contract `defaultRewardType`;
- giver `defaultOffer`; and
- giver `defaultsByLoadout` concrete triples.

A Shop option still owns its reward-type identity. Its current normalized
`defaultOffer` must become an identity/domain product rather than disappear
with slot defaults. Likewise, fixed reward bindings must retain fixed type or
complete fixed-offer identity without gaining a fake choice.

### Planner engine

The engine owns unresolved persistence, strict decoding, semantic replacement,
complete-selection commands, active completeness, lifecycle stopping,
candidate evaluation, selected-invalid retention, and findings. Existing
reward-kernel and trait-composition authorities remain the only semantic
evaluators.

Every stage must return the unresolved owner and the exact pre-owner candidate
product explicitly. No sidecar map may be the sole carrier of a capability
needed by the application.

### Application and React

The application adapts the engine's unresolved and candidate products into the
existing reward and trait controls. React may own transient picker/dialog draft
state. It must not choose a default, compose a Shop assignment, calculate a
trait offer, or infer fixedness from labels or reward/provider names.

One completed reward or trait intent produces one semantic command and one
undo entry. Finding navigation resolves to the containing control even when the
selected-plan prefix stops at that unresolved leaf.

## Superseded Paths and Required Deletions

The completed phase must have no semantic consumer of the retired catalog seed
fields. Expected superseded concepts include:

- complete reward initialization in room-state defaults and replacement;
- recursive trait/Pom construction when merely choosing a reward;
- `createDefaultTraitOffers` and `createDefaultEncounterTraitOffer` as authored
  value constructors;
- `withDefaultKeepsakeEquipResult` branches that select Jeweled Pom's giver
  default or the first compatible Experimental Hammer;
- `createDefaultAcquisitionRewardState` at generated-choice boundaries;
- Shop profile materialization from slot defaults;
- derived-entry commands that install a `defaultValue` before editing or
  participation;
- `artificerDefaultReplacement` and Run Progress's default-derived
  replacement;
- candidate-only settlement that depends on a fabricated selected default;
- reset commands that restore an arbitrary concrete reward/trait offer; and
- tests and fixtures whose only purpose is to characterize which arbitrary
  first value was installed.

Helpers may be renamed and narrowed for constructing a user-selected complete
state or a fully fixed game fact. They may not keep default semantics under a
new name.

## Gate A — Shared Reward and Acquisition-Trait Migration

### Objective

Replace the shared invented-default machinery across every reward owner and
both immediate random keepsake results in one complete vertical slice.
Ordinary incoming rewards establish the core unresolved contract; room-local
cohorts, generated inventory, supplemental entries, Artificer, Jeweled Pom,
and Experimental Hammer use that same contract before the gate is reviewed.

### Persisted boundary

Advance schema 41 to strict schema 42 once. Migrate ordinary
fixed/count/free/anomaly rewards, Ephyra, Fields, O wheels, initial and
supplemental Shops, acquisition-site pickups, Artificer replacements, and Echo
recreated entries to unresolved-or-complete state wherever their identity is
not fully fixed. A complete reward's required trait-producing roles become
unresolved-or-complete offers with exact role keys. Fully fixed producers
remain derived concrete values. Route-start, Postboss, and Echo-replayed
Jeweled Pom or Experimental Hammer selections retain their concrete keepsake
identity while their immediate random trait result is absent/unresolved until
authored through the existing result command.

### Behavior

- New ordinary rooms and structurally incompatible replacements begin with an
  unresolved authorable reward.
- Selecting a complete reward consumes one command and creates unresolved
  trait-role children where applicable.
- A known direct provider publishes an unresolved trait offer rather than a
  triple.
- The trait dialog commits one complete one-to-three-option/fallback result.
- Unresolved reward and trait leaves each stop at their exact lifecycle point,
  publish one finding, retain their candidate domain, and remain navigable.
- Compatible selected rewards/offers survive room replacement unchanged,
  including selected-invalid state.
- Reset returns an authorable leaf to unresolved; it does not restore a seed.
- Selecting Jeweled Pom or Experimental Hammer never installs a giver default,
  catalog-first trait, or loadout triple. Their existing exact result candidate,
  finding, focus, and command products own completion.
- Completed immediate keepsake results survive swap-away/back and upstream
  invalidation as retained authored values. Experimental Hammer Echo replay
  uses the same unresolved-or-complete result contract.

### Primary witnesses

- Creating an F ordinary target yields a visible unresolved reward, no bag
  mutation, one exact finding, and no thrown command, simulation, projection,
  or render exception.
- Selecting Boon plus source is one command; it creates one unresolved
  source-role trait offer, one exact missing-authorship finding, and no trait
  history mutation.
- Authoring a complete Apollo offer then selecting one option settles normally.
- One-to-two-option exhaustion and Fallback Gold commit as complete outcomes.
- Changing upstream history makes a selected reward or offer invalid without
  clearing it.
- A fixed payload-free reward remains concrete; fixed Mystery Boon exposes only
  its unresolved payload; fixed Apollo exposes only its unresolved trait offer.
- Room replacement preserves compatible selected values and makes only new or
  incompatible authorable leaves unresolved.
- Codec rejects schema 41, missing required selection fields, and malformed
  complete values.
- Redux undo/redo spans unresolved -> reward -> trait offer as two intentional
  authored commands.
- Creating a room with an unresolved reward, changing an unrelated route field,
  replacing the room, and finally authoring the reward all succeed without a
  temporary concrete value or exception-based recovery.
- Route-start and Postboss Jeweled Pom/Experimental Hammer selections retain
  their concrete keepsake identity, publish one exact missing-result finding,
  expose their complete candidate domain, and settle only after a result is
  authored. Experimental Hammer Echo replay has the same behavior.
- Gate A removes reward-payload, counted-store, Shop-slot, Contract, and derived
  replacement seeds plus Hammer `defaultsByLoadout` from production
  catalog/compiler products. Only giver `defaultOffer` seeds still required by
  the not-yet-migrated encounter-offer/Gorgon owner may remain for Gate B;
  Jeweled Pom no longer consumes that seed.

### Commit boundary

One coherent `feat:` commit after catalog/engine/application/React contact,
focused review remediation, owning-lane tests, and final main-session review.
The commit includes all Gate-A internal checkpoints below. No room family may
retain a compatibility default or parallel concrete-only authored path.
After Gate A is stable, stop for the user's product review before starting Gate
B; encounter-offer migration must not hide unresolved-reward UX problems found
at that checkpoint.

## Gate A Internal Implementation Sequence

The following sections are executor checkpoints, not delivery gates. They share
one worktree, schema, unresolved owner model, final independent review, and
commit. Their purpose is to keep implementation and focused testing readable
without preserving separate production paths.

The executor establishes the ordinary reward/trait path first, then immediately
applies it to room-local cohorts and generated inventory. A checkpoint may not
introduce a temporary compatibility union, default installer, or consumer that
the next checkpoint is expected to remove. If a specialized owner exposes a
real contradiction in the shared model, execution stops for a plan decision
rather than quietly splitting that owner into another machinery path.

## Gate A Checkpoint — Room-Local and Cohort Reward Surfaces

### Objective

Remove concrete initialization from the bounded and cohort-owned room surfaces
while preserving their exact generation order and retained dormant structure.

### Persisted boundary

Within schema 42, migrate Ephyra main/side rewards, Fields cages and optional
rewards, and O reward-wheel offers to the same unresolved-or-complete state.
Apply Gate A's acquisition-role trait contract to their selected rewards.

### Behavior

- Ephyra main and generated side rewards begin unresolved at their real offer
  points; dormant ungenerated side rooms publish nothing.
- Fields creates its declaration-capacity inventory without reward identities.
  Only the active cage/optional prefix publishes missing findings and controls;
  increasing count reactivates unresolved retained slots without seeding them.
- O wheels retain store/count/picked structure while each active offer begins
  unresolved; inactive wheel positions remain dormant.
- Candidate products preserve Fields sequential bag consumption, optional
  unpicked offer depletion, O wheel order, Ephyra peer behavior, and
  append-refill-with-leftovers without selecting hypothetical offers.
- Lowering and raising counts, room replacement, and dormant retention never
  create a reward or trait seed.

### Primary witnesses

- Representative capacity-2/3/4 Fields rooms start with only their active
  unresolved controls and zero reward-history mutation.
- Authoring sequential Fields rewards consumes the exact bag entries; leaving
  a generated optional unpicked retains offer-time depletion but no acquisition.
- Count lower/raise and room replacement retain selected compatible slots and
  unresolved untouched slots without dormant findings.
- Refill-with-leftovers remains exact with unresolved later slots.
- Ephyra main and generated side rewards can be authored independently; an
  ungenerated side reward is absent, not unresolved-active.
- O wheel count changes expose unresolved positions without default findings;
  selected-invalid retained offers remain repairable.
- Time Piece and Artificer controls appear only after a concrete eligible
  source is authored.
- Schema 41 is rejected; codec, finding focus, and Redux count/selection
  workflows round-trip schema 42.
- Representative Ephyra, Fields, and wheel projects with multiple unresolved
  peers evaluate to bounded incomplete prefixes without throwing or installing
  candidates as authored values.

### Checkpoint completion

The migrated room-local owners delete the store/trait seed consumers they
replace and retain no default fallback for candidate evaluation. Focused tests
must be green before the executor proceeds, but no commit or independent gate
review occurs here.

## Gate A Checkpoint — Shops, Acquisition Entries, and Derived Rewards

### Objective

Remove invented payloads from generated inventory and source-owned acquisition
entries while preserving payload/participation separation and exact room-local
chronology.

### Persisted boundary

Within schema 42, migrate initial Shop slots, supplemental Shop entries, generic
acquisition-site pickup entries, and Artificer replacements to the same
unresolved-or-complete authoring where their outcome is not fully fixed.

### Behavior

- Entering a Shop materializes its profile and stable slots but not concrete
  inventory outcomes.
- The engine supplies Shop choices and complete profile/slot support without
  replacement across already-authored and unresolved peers; candidate order is
  not a hidden selected inventory.
- Contract and Travel rows materialize at their existing source frontiers with
  unresolved variable reward offers. Gold instead preserves its triggering
  purchase's fixed facts: reward type is always source-derived, and an ordinary
  offer-resolved payload is copied exactly. Only a genuinely fresh
  acquisition-resolved payload, such as Blind Box's hidden source, and fresh
  nested trait/Pom children remain unresolved. Participation and Acquisitions
  order remain independently authorable.
- A Travel refill retains the source slot/profile/exclusion facts without
  choosing its regenerated offer.
- Gold consumes at the accepted purchase frontier and creates its stable row
  with the exact source-derived identity plus unresolved variable layers; later
  pickup order remains weaveable.
- Narcissus and other fixed payload-free pickups stay concrete. A pickup with
  variable payload or generated acquisition child is unresolved only at that
  variable layer.
- An unresolved Artificer disposition stops before the source interaction and
  therefore spends no use, consumes no Run Progress entry, and creates no
  replacement object. Completing the replacement authoring command itself
  also has no simulation side effect. When the authored source interaction is
  evaluated, the established source checkpoint atomically consumes the use
  and bag entry and creates the separate replacement; the later replacement
  pickup retains the existing required/optional order.
- Echo last-reward and other recreated entries derive the replay identity when
  fixed by history but leave fresh trait/Pom/acquisition detail unresolved.
- The attached-project regression becomes a stable fixture: F Combat 08 Ashes
  -> Artificer produces an unresolved replacement editor and exact finding,
  never an Apollo child or workspace exception.

### Primary witnesses

- A 3-slot World Shop initially shows three unresolved inventory slots; a
  complete assignment obeys group membership and without-replacement.
- I/Q multi-slot groups admit existentially completable choices without
  silently filling peers.
- Real Contract+Travel and real Gold workflows preserve visual order,
  payload-before-pickup, Acquisitions chronology, move, undo/redo, and exact
  finding focus with unresolved variable layers.
- A rejected paid purchase does not create Gold. An accepted ordinary purchase
  creates one Gold row with exactly the same reward type and offer-resolved
  payload and no redundant one-choice identity editor. An accepted Blind Box
  purchase creates one Gold row whose fixed Blind Box type is retained while
  its freshly generated hidden source remains unresolved. Both consume the
  trait at the established checkpoint.
- Travel and Gold source rebind/removal rules remain deterministic without
  `defaultValue` commands.
- Fixed Narcissus Nectar/Psyche/Bones stay concrete; any source-owned generated
  nested result remains unresolved until authored.
- Artificer uses are unchanged while the replacement is unresolved and after
  the authoring command alone; the exact bag/use transition occurs once when
  selected simulation settles the now-complete source interaction.
- Ordinary, Time Piece, Pom regeneration, Blind Box freshness, and Echo replay
  chronology remain unchanged after explicit authoring.
- Schema 41 is rejected by the shared schema-42 codec. Strict recursive codecs
  reject incomplete objects that are not the canonical unresolved
  representation.
- Real Shop, Gold, Travel, Narcissus-variable, Echo-replay, and Artificer
  unresolved rows remain projectable and editable before completion; each
  selected path stops at its exact owner rather than throwing from a concrete
  acquisition helper.

### Checkpoint completion

All current Gate-A behavior, witnesses, and deletions proceed to one independent
review and commit. No private pending map, Shop-specific unresolved order, or
derived-entry default installer may survive.

## Gate B — Encounter Trait Outcomes and Final Trait-Seed Removal

### Objective

Complete generated-trait migration at every remaining encounter-owned contact,
then remove the production catalog vocabulary that can still express invented
defaults.

### Persisted boundary

Advance schema 42 to strict schema 43. Migrate encounter/NPC trait offers,
Gorgon Athena, and every remaining encounter-generated trait outcome to the
same unresolved-or-complete contract. Delete the remaining giver
`defaultOffer` seeds and their compiler-normalized products. Gate A's immediate
keepsake-result model and deleted Hammer loadout triples are not reopened.

### Behavior

- Selecting or activating a trait-producing encounter retains the existing
  concrete encounter identity and provider but leaves only its generated trait
  offer unresolved.
- Gorgon's condition may activate a known Athena provider without choosing
  three Athena traits.
- Circe, Echo, All Together, Denial, Forfeit, Calling Card, targeted
  acquisition, rarity, and selected child semantics run only after one complete
  outer offer is authored and retain their current exact rules.
- Resetting an encounter offer returns it to unresolved. Switching encounters
  preserves dormant complete offers by stable provider/encounter identity and
  gives a newly introduced offer no seed.
- Existing Combat/Artemis/Heracles encounter defaults and encounter-selection
  commands remain unchanged; no encounter identity gains an unresolved state
  or repeated authoring control.
- Reward support and Shop option identity already enumerate from Gate A's
  source support and fixed declarations; Gate B does not reopen that model.
- The compiler rejects reintroduction of giver authoring seeds, while Gate A's
  existing mutation tests continue rejecting store, payload, Shop-slot, and
  Contract seeds.

### Primary witnesses

- Every giver compiles without an authored default offer.
- Representative Olympian, Hermes, NPC, Gorgon, Circe, and Echo offers
  start unresolved and emit only one missing finding.
- Representative Combat, Artemis, and Heracles occurrences retain their
  existing encounter identity without a missing-encounter finding; only a
  declaration-owned trait offer, when present, is unresolved.
- A complete one-, two-, and three-option offer plus Fallback Gold round-trip
  and settle through the same command family.
- Denial bans and Forfeit effects are absent while the offer is unresolved and
  exact after a complete selection.
- Switching encounters away/back retains a completed prior offer; selecting a
  new provider begins unresolved.
- No selected or candidate behavior depends on catalog iteration order after
  seed deletion.
- Catalog mutation tests reject every retired seed field and preserve the
  factual store, Shop, payload-domain, trait-pool, rarity, and compatibility
  invariants.
- Schema 42 is rejected; all canonical projects and product fixtures use strict
  schema 43.
- Representative unresolved encounter offers survive provider changes,
  unrelated commands, persistence, evaluation, projection, and finding
  navigation without an exception or hidden seed.

### Deletion proof

Before disposition, search production and stable tests for the retired field
and helper vocabulary. Any remaining occurrence must be either:

- historical text in this temporary plan/audit;
- a negative compiler/codec fixture proving rejection; or
- a clearly renamed fixed/domain identity that cannot initialize authored
  state.

### Commit boundary

One coherent `feat:` commit after fresh executor/reviewer gates and main review.
This is the last behavior commit in the phase.

## Gate C — Durable Closure

### Objective

Perform a fresh architecture/product audit, correct any concrete defect, absorb
schema 43 into durable authorities, and retire this temporary plan.

### Closure audit

Confirm:

- catalog -> pure engine <- application/React direction;
- one reward kernel and one trait composition authority;
- no default moved from catalog into engine, candidate, application, React, or
  tests as semantic policy;
- no partial authored reward/trait draft model;
- no pending registry or sidecar capability map;
- all active unresolved leaves have one control, finding, candidate domain,
  containing inspector, and exact focus destination;
- structurally dormant leaves publish none;
- selected-invalid values remain retained everywhere;
- fixed facts do not create redundant authoring; and
- default deletion produced a smaller, explainable authority surface rather
  than duplicated unresolved paths.

### Durable documentation

Update the smallest owning portions of:

- `README.md`;
- `CATALOG_MODEL.md`;
- `AUTHORED_PROJECT_MODEL.md`;
- `REWARD_MODEL.md`;
- `SIMULATION_AND_VALIDATION.md`;
- `CANDIDATE_EVALUATION_MODEL.md`;
- `EDITOR_MODEL.md` and `STRUCTURED_EDITOR_WORKSPACE.md`;
- the reward and trait audits where planner disposition changed; and
- `IMPLEMENTATION_PROGRESS.md` with exact commits, accepted remediations,
  growth/deletion accounting, and final validation totals.

Update `PRODUCT_POLISH.md` to close the foundational item while retaining its
unrelated presentation backlog. Delete only this temporary plan. Do not erase
source evidence from the owning audit.

### Final validation

After narrow remediation is stable, run `npm run check` exactly once. Record
the truthful typecheck, test, lint, formatting, and build result. Do not rerun
the complete gate merely to change the recorded prose.

### Commit boundary

One coherent `docs:` closure commit, or `fix:` if the fresh closure audit finds
a required production correction that is intentionally included after bounded
review.

## Test Ownership and Validation Policy

### Primary policy owners

- catalog compiler tests own factual domains and retired-seed rejection;
- authored codec/command/default/replacement tests own unresolved versus
  complete shapes and retention;
- reward-kernel and trait-composition tests own cohort possibility and complete
  outcome legality;
- progressive simulation tests own stopping checkpoints, no mutation while
  unresolved, exception-free partial evaluation, selected-invalid retention,
  and candidate publication;
- workspace projection/navigation tests own controls, markers, findings,
  inspector containment, and exact destinations;
- Redux/UI tests own one-command authoring and undo/redo; and
- product tests own representative ordinary, Fields/O, Shop/derived, and
  encounter-provider workflows.

Facade and product tests keep representative contact only; they do not copy the
full store, Shop, provider, or trait matrix from its owning package.

### Per-gate validation

During implementation use focused owning tests, then run the affected package
lanes, all workspace typechecks, lint, changed-file formatting, production build
when application wiring changes, and `git diff --check`. Do not run full
`npm run check` after each gate.

Each gate handoff records:

- exact base and worktree inventory;
- production/test additions and deletions;
- old paths removed;
- focused and owning-lane totals;
- accepted reviewer findings and remediation; and
- residual risks for main-session review.

## Adversarial Review Checklist Before Lock

The plan reviewer must answer with live evidence:

1. Does any catalog `default*` field encode a genuine fixed fact rather than an
   invented choice, requiring reclassification instead of deletion?
2. Can every authorable owner distinguish structural absence from explicit
   unresolved state without a parallel map?
3. Can ordinary and specialized candidate sessions publish a domain at the
   exact pre-leaf frontier after selected simulation stops?
4. Do multi-door, Fields, wheel, and Shop cohorts need complete proposal
   products rather than row-local candidates?
5. Can the current trait candidate API construct a complete outcome from no
   authored draft without using a hidden default?
6. Are fixed-type/variable-payload and fixed-provider/variable-offer cases
   represented without redundant user choices?
7. Does Artificer spend/generate at replacement selection or at source
   interaction under the established chronology, and does unresolved state
   preserve that exact checkpoint?
8. Do Travel, Gold, Contract, and optional pickup rows remain editable before
   participation without being classified as structurally dormant?
9. Does any reset, replacement, codec normalization, fixture builder, or UI
   initialization silently restore a concrete value?
10. Are the proposed schema gates independently valid products, with no gate
    depending on a later compatibility shim?
11. Does the deletion list cover every semantic consumer of payload, store,
    Shop-slot, Contract, giver, and loadout defaults?
12. Can the phase reduce or at least clearly explain production growth instead
    of layering unresolved state beside the old default machinery?
13. Does Gate A migrate every reward owner through one schema and shared
    machinery, with no ordinary/cohort/Shop compatibility branch or internal
    checkpoint masquerading as a separate production model?
14. Does every concrete-only evaluator have an explicit unresolved boundary,
    and do real command -> evaluation -> projection -> React workflows prove
    that `null` cannot recreate the command failures previously caused by an
    invalid invented default?
15. Does the implementation leave encounter and keepsake identity/default
    authoring intact and make only their owned generated trait outcomes
    unresolved, with no repeated Combat/Artemis/Heracles or keepsake-selection
    burden and no Jeweled Pom/Experimental Hammer first-choice fallback?

Any material contradiction or missing product decision returns to the main
session before the plan is locked. Reviewers must not weaken the no-invented-
default rule merely to preserve a current fixture or constructor.
