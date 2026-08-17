# Trait Effect Interactions Implementation

## Status

Draft lock candidate created from clean base
`86dbd783f021e2c2be1f2708957e2be8d20c95d5` with strict project schema 43.
This document is temporary delivery authority. It is not linked from the
README or stable design documents, and implementation must not begin until a
fresh adversarial review has checked it against the installed game scripts,
the live engine/application products, and the current unresolved-authoring
contract.

The preceding schema-43 unresolved-authoring behavior has landed, but its
durable closure remains separate pending work at draft time. Complete that
closure and retire its temporary authority before this plan's first behavior
commit. This plan is self-contained and must not silently absorb or reinterpret
the predecessor's closure.

Owning evidence:

- [`TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`](../audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md)
- [`ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`](../audits/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md)
- [`ALL_TOGETHER_AND_SHOP_TRAITS_GAME_DATA_AUDIT.md`](../audits/ALL_TOGETHER_AND_SHOP_TRAITS_GAME_DATA_AUDIT.md)
- [`ARCANA_AND_FEAR_GAME_DATA_AUDIT.md`](../audits/ARCANA_AND_FEAR_GAME_DATA_AUDIT.md)
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md)
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md)
- [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md)

Primary source contacts:

- installed `EventLogic.lua` `EchoLastReward` for Reward Reward Reward;
- installed `EventLogic.lua` `EchoLastRunBoon` and `SelectEchoBoon` for Boon
  Boon Boon;
- installed Circe, Hera, Echo Pom, Bridal Glow, and Latest Model declarations
  and effect functions already cited by the owning audits.

## Objective

Separate three interactions that are currently rendered as one family of
option-card children even though they have different game ownership:

1. a selected trait may have one or more direct authored effect outcomes;
2. Reward Reward Reward creates a real required pickup whose payload is
   configured and settled through acquisition machinery; and
3. Boon Boon Boon opens a second forced trait-choice checkpoint immediately
   after Echo's outer trait selection without creating a pickup.

The user-visible shape is:

```text
Trait 1 | Trait 2 | Trait 3

Selected trait outcome
<only the selected trait's direct outcome, generated pickup summary,
 or forced dependent choice>
```

Option cards keep a stable height. Context-dependent targets, multi-target
sets, generated reward editors, and Echo's second trait offer do not expand an
individual card. The lower outcome region appears only when the selected trait
owns an active consequence.

The completed model must preserve the existing unresolved-authoring rule:
missing active authored detail is a normal blocking frontier with one exact
finding and an engine-backed repair interaction. It must not throw, fabricate a
first candidate, or make unselected option detail active.

## Source Facts and Planner Presentation

### Direct selected-trait outcomes

The following effects are direct consequences of the selected outer trait;
they do not create a pickup:

- Bridal Glow chooses one eligible equipped trait and applies its exact
  rarity-scaled level effect.
- Latest Model chooses one eligible Rank-I Hammer and promotes it to Rank II.
- Red Citrine activates one inactive Arcana.
- Lapis Lazuli promotes up to its exact required count of distinct active
  Arcana; the source stops when its eligible domain is exhausted.
- Black Night disables one eligible configured active Vow without changing its
  authored rank.
- All Together resolves one direct grant from each of Earth, Fire, Air, and
  Water; an exhausted set records no grant. These grants do not pass through an
  ordinary offer and do not mutate god-pool history.
- Pom Pom Pom resolves its exact greatest-level target, or the legal no-target
  result when the domain is empty.

The planner presents these as a selected-option outcome below the complete
outer offer. It may reuse the existing contextual picker and the Trial reward
picker's sequential compound-draft pattern, but it must not claim that these
effects are Trial rewards or generic pickups.

### Reward Reward Reward

The game recreates the exact latest effective `LastRewardEligible` source.
Consumables are spawned as required Echo-room objects; loot is recreated and
opens a fresh offer owned by that acquisition. The recreated item must be
interacted with before Echo's exits become usable.

The trait dialog therefore shows only a read-only summary:

```text
Selected trait outcome
Spawns: Apollo Boon
Configure in Acquisitions
```

The complete reward, fresh trait/Pom detail, supported Time Piece disposition,
findings, focus, and settlement belong to one generated acquisition row. The
trait dialog does not contain a second reward editor.

### Boon Boon Boon

The game waits for Echo's outer menu, builds a separate cross-provider upgrade
choice, then directly calls `AddTraitToHero` for the selected nested result.
It creates neither loot nor a world pickup.

The planner keeps the useful chronological UX without inventing an item:

```text
Select Echo trait
-> if Boon Boon Boon was selected, resolve its dependent trait choice
-> continue the room chronology
```

This dependent choice is fixed immediately after the outer Echo selection. It
has no pickup checkbox and no move control. It remains a specialized
cross-provider offer because ordinary `AuthoredTraitOffer` is single-provider
and cannot truthfully represent the source union.

## Locked Cross-Cutting Decisions

### 1. Only selected options activate child outcomes

An option may retain authored direct-effect, Reward, or Boon child data while
unselected. Unselected detail is dormant:

- it emits no finding;
- it publishes no control, focus destination, or candidate requirement;
- it does not mutate history or room chronology; and
- it is restored if the user selects that option again.

Selecting an option whose required child is missing stops at the exact child
frontier after the outer trait identity has been acquired. The selected child
is not repaired by clearing or replacing the outer offer.

### 2. Contextual domains use contextual picker vocabulary

Any trait-owned outcome selected from route history, Arcana/Fear state, current
keepsake, equipped traits, or branch-specific source support uses an
engine-backed contextual picker. Native HTML selects remain appropriate only
for closed unconditional enums.

The engine owns:

- exact candidates and unavailable retained values;
- required cardinality and distinctness;
- branch agreement and per-candidate explanations;
- legal no-target/no-grant outcomes; and
- the complete semantic command value.

The application may adapt those products into a sequential transient draft.
React may display progress and labels, but it must not filter eligible targets,
derive cardinality, or synthesize a preferred first value.

### 3. Multi-target selection is atomic

The Trial reward picker is the presentation precedent: a transient draft walks
through named roles and dispatches one complete value. Direct effects reuse
that pattern where it fits:

- Bridal Glow, Latest Model, Red Citrine, Black Night, and Pom Pom Pom use one
  target/result role;
- Lapis uses an unordered bounded set with the exact engine-required count;
  duplicate cards are impossible and fewer targets are accepted only when the
  legal domain itself is smaller;
- All Together uses four named roles in Earth, Fire, Air, Water order, each
  accepting one legal grant or the exact exhausted `No grant` value.

Partial progress is editor-session state only. Canceling the picker does not
persist an incomplete child. One command commits the complete result.

This is reuse of the established compound-draft interaction pattern, not a
mandate to build a generic multi-target framework. A new abstraction is
allowed only if it deletes duplicated application/React behavior from at least
two real consumers while keeping each engine domain explicit.

### 4. Generated reward payload and chronology have different owners

Reward Reward Reward's source identity is derived from exact pre-Echo history.
Its authored payload is one shared acquisition entry. Its required
participation and its chronological position are acquisition-site semantics.

The active generated row is editable independently of settlement, following
the repository-wide payload/participation/order invariant. Because the source
object is required, participation is fixed rather than an optional checkbox;
the row may participate in shared ordering only where the room exposes another
acquisition at the same checkpoint. The outer trait editor never owns payload
fields or an acquisition-order command.

### 5. Boon Boon Boon is not an acquisition entry

Boon Boon Boon must not be inserted into `pickupEntries`, a Shop order, or a
generic acquisition participation list. It is one dependent trait checkpoint
whose predecessor is the exact outer Echo option and whose successor is the
remaining room chronology.

Its authored approximation remains one to three distinct
`{ giverKey, traitKey, rarity }` rows plus one selected row. Candidate support
comes from the audited previous-run approximation domain: nine Olympians,
Hermes, Artemis, Athena, and Dionysus, with Hades and other unsupported
providers excluded; current requirements, open slots, already-equipped state,
provider-specific source variants, and rarity domains still apply.

The selected row alone may own declaration-specific acquisition detail. In the
current domain that is Bridal Glow's exact target. Its target appears beneath
the specialized BBB outcome rows, not in the outer Echo option card.

### 6. One editor and one finding destination per semantic owner

Moving a control may not duplicate it. Every active child has:

- one persisted semantic owner;
- one engine candidate/finding frontier;
- one application interaction;
- one visible editor or read-only summary; and
- one exact focus destination.

The Acquisitions editor exclusively owns Reward Reward Reward's generated
payload. The selected-outcome region exclusively owns direct results and BBB's
dependent offer. Finding navigation must reopen the containing trait dialog or
focus the generated acquisition row as appropriate.

### 7. Clean schema boundaries

Gate A advances schema 43 to strict schema 44 because All Together stops
receiving a declaration-first invented complete result and selected child
completeness changes. Gate B advances schema 44 to strict schema 45 because
Reward Reward Reward moves from a custom option-owned acquisition payload to a
shared generated acquisition entry.

Gate C retains schema 45 if the existing specialized BBB authored value can be
relocated to a dependent checkpoint without changing persisted shape. It may
advance once only if live implementation proves a clean persisted-shape change
is necessary; it must not add a compatibility decoder or bump merely for UI
layout.

Each strict decoder rejects its immediate predecessor. Named fixtures are
reauthored explicitly; there is no migration shim, dual field, or runtime
repair.

## Included Scope

- selected-option outcome layout and contextual authoring for Bridal Glow,
  Latest Model, Circe's Red/Lapis/Black effects, All Together, and Pom Pom Pom;
- All Together unresolved/dormant selected-child semantics;
- Reward Reward Reward as one required generated pickup using shared reward,
  acquisition-role, candidate, finding, focus, and settlement products;
- Boon Boon Boon as one fixed dependent trait-choice checkpoint after Echo;
- retained-invalid and switch-away/switch-back behavior for every moved child;
- Redux undo/redo for complete child commits and generated reward editing;
- exact product-loop witnesses for the three user-visible flows; and
- deletion of the superseded custom/default/editor paths named by each gate.

## Excluded Scope

- changing ordinary trait-offer eligibility, composition, replacement, Denial,
  Forfeit, Fallback Gold, rarity, or Calling Card policy;
- changing the audited effect semantics or probabilities;
- manufacturing previous-run history for Boon Boon Boon;
- treating direct grants as ordinary acquisitions or god-history events;
- changing Gold Gold Gold, Gift Gift Gift, Narcissus, Travel Deal, or Artificer
  chronology except where a shared product regression is exposed;
- adding a generic effect registry, generic pending-effect store, parallel
  acquisition order, or React-owned eligibility map;
- broad visual redesign of the trait dialog beyond the selected-outcome region;
  and
- Stygian Wells, Hermes shrines, natural-resource elements, or other future
  producer work.

## Gate A — Direct Selected-Trait Outcomes

### Authored model and schema

Advance to strict schema 44.

- Preserve option-local authored fields so switch-away/switch-back retention
  remains natural.
- Stop installing `createDefaultAllTogetherResult` through
  `withDefaultTraitOptionDetail`. A newly authored All Together option has no
  result until the user commits one complete four-role outcome.
- Decode a missing All Together result as a structurally valid unresolved
  selected child, not as malformed input. Decode a present value strictly:
  exactly Earth, Fire, Air, and Water; each value is a set member or `null`.
- Keep Circe, target, and Echo Pom child values complete-only when present.
  Partial multi-target drafts do not enter the authored project.
- Preserve dormant child values on trait replacement only when the option's
  exact trait identity still owns that child kind; do not carry a Circe result
  onto Hera or vice versa.

### Engine and simulation

- Keep the outer trait acquisition as the first event.
- For the selected option, assess its direct child against the exact post-outer,
  pre-effect branch and stop there if it is missing or unavailable.
- Publish explicit domain products for one-target, bounded-set, named-set, and
  legal no-target/no-grant outcomes without collapsing them into a generic
  effect interpreter.
- Retain branch agreement. A value supported only by combining different
  histories is unavailable.
- Preserve exact effects: targeted levels/upgrade, Arcana activation or
  promotion, Fear suppression, direct elemental grants, and Pom mutation.
- Unselected child data produces no lifecycle event, finding, or capability.

### Application and UI

- Render three equal-height option cards with trait, rarity where editable,
  selected state, and compact status only.
- Render one `Selected trait outcome` region after the card grid.
- Use engine-backed contextual pickers for every route-dependent target.
- Adapt All Together and Lapis to a sequential compound draft with named
  progress, duplicate prevention, Cancel, and one complete Save.
- Use effect-specific labels rather than exposing address or command names.
- Keep Duo/Legendary fixed-rarity presentation and the compact related offer
  action strip established by the preceding picker-polish commit.

### Deletions

- delete `createDefaultAllTogetherResult` and every production consumer/export;
- delete raw target, Circe, All Together, and Echo Pom `<select>`/checkbox
  implementations from individual option cards;
- delete duplicated card-local candidate loading once the selected-outcome
  region owns the active child; and
- remove tests that assert a declaration-first All Together choice.

### Primary witnesses

- selecting Bridal Glow or Latest Model keeps all option cards equal height and
  reveals one contextual Target row below them;
- Red, Lapis, and Black Night use exact engine domains; Lapis commits one
  complete distinct set and handles an undersized legal domain;
- All Together begins unresolved, blocks only when selected, commits all four
  roles atomically including exhausted `No grant`, applies no god-history
  mutation, and restores its result after switch-away/back;
- Pom Pom Pom exposes one greatest-level target or a legal no-target result;
- an unselected missing or retained-invalid child emits no finding/control;
- selected-invalid values remain visible and repairable; and
- complete child authoring and selection changes support Redux undo/redo and
  exact finding navigation.

### Commit boundary

One Conventional Commit contains schema 44, direct-child engine products,
selected-outcome UI, tests, and deletion of the old inline/default paths. No
Reward Reward Reward or Boon Boon Boon ownership change belongs in this commit.

## Gate B — Reward Reward Reward Generated Pickup

### Authored model and schema

Advance to strict schema 45.

- Derive one stable generated acquisition-entry identity from the exact Echo
  outer trait owner and its Reward Reward Reward option.
- Store the authorable reward as ordinary `AuthoredRewardState | null` in the
  owning room acquisition site's `pickupEntries`; do not persist the replay
  source twice.
- Derive the fixed recreated reward type/provider from exact
  `lastRewardRecreation` history. Leave genuinely fresh trait offers, Pom
  resolutions, and other author decisions unresolved.
- Make active source-required participation structural and non-removable.
  Preserve payload separately from the site's chronological order.
- When the outer option becomes dormant, retain its structurally owned authored
  payload without publishing an active pickup or requirement. Reactivation
  restores it after revalidation.

### Engine and simulation

- Materialize the generated row only after the outer Reward Reward Reward trait
  identity is selected and its exact replay source exists.
- Publish it through the existing pickup reward frontier, reward control,
  acquisition-role frontier, conversion capability, and finding products.
- Stop at missing generated reward or nested detail without throwing and
  without adding a second outer-trait finding.
- Settle the concrete pickup through the shared acquisition kernel before Echo
  exits become usable. Consumable and loot behavior retain their exact source
  identity and chronology.
- Preserve producer overrides, including any source/type for which Time Piece
  or Artificer is not supported. Do not infer transformations in React.
- Keep source derivation branch-exact; divergent replay identities do not
  combine into one supported row.

### Application and UI

- Replace the custom nested Reward Reward Reward editor with a read-only spawn
  summary and a focus/open action for the generated Acquisitions row.
- Render that row through the same reward editor, nested trait/Pom controls,
  conversion selector, markers, and finding routing used by other generated
  pickups.
- Present required participation without an editable pickup checkbox. If the
  room has multiple same-checkpoint entries, expose only engine-supported move
  controls.
- Keep active payload authoring independent of chronology and make all edits
  ordinary semantic commands with Redux undo/redo.

### Deletions

- delete `AuthoredEchoLastRewardAcquisition`, its custom normalizer/default
  constructor, codec branch, commands, workspace domain, and custom editor once
  the shared acquisition entry fully owns those responsibilities;
- delete duplicated Reward replay trait/Pom target UI and candidate adaptation;
- delete routing that sends generated reward findings back to a nested option
  editor; and
- retain `EchoLastRewardAddress` only if it remains the truthful producer or
  summary owner. Do not keep it as an alias over the acquisition entry.

### Primary witnesses

- an exact latest replayable consumable produces one required active row before
  Echo exit and acquires only through that row;
- an exact replayed Boon shows `Spawns: <provider> Boon` in the trait dialog,
  starts with its fresh offer unresolved in Acquisitions, and is fully authored
  there;
- replayed Pom and supported Time Piece behavior use shared controls and exact
  candidates;
- payload edits work before settlement, while the required pickup cannot be
  removed from participation;
- switching away from Reward makes the row dormant with no finding/settlement,
  switching back restores its payload, and invalid retained payload stays
  repairable;
- a missing or invalid generated child blocks before Echo exits and never
  throws during command, simulation, projection, or React render;
- exact finding navigation focuses the generated row, not a duplicate nested
  editor; and
- payload edit, switch-away/back, settlement, and order movement (where a real
  same-checkpoint peer exists) support Redux undo/redo.

### Commit boundary

One Conventional Commit contains schema 45, generated acquisition ownership,
shared editor integration, exact chronology, tests, and deletion of the custom
Reward replay payload/editor path. It must not relocate BBB into acquisitions.

## Gate C — Boon Boon Boon Forced Dependent Choice

### Authored model

- Retain `AuthoredEchoLastRunBoonOffer` as the specialized persisted complete
  value unless execution proves a smaller clean replacement. It remains one to
  three distinct cross-provider rows plus one selected option.
- Keep selected-row declaration detail, currently Bridal Glow's target, on that
  exact row and complete-only when present.
- Preserve the child while its outer option is dormant. Do not materialize it
  as an acquisition entry or add a persisted order index.

### Engine and simulation

- Model an explicit dependent checkpoint immediately after the outer Echo trait
  identity and before the rest of room chronology.
- If BBB is selected and the child is missing or invalid, publish its existing
  exact candidate/finding frontier and stop at that checkpoint.
- Assess all one-to-three authored rows against one immutable pre-BBB frontier.
  Do not combine branch support, admit already-equipped traits, or count two
  source variants of the same Duo as distinct rows.
- On valid selection, increment only the selected resolved source's loot
  history, equip one trait, and run only its exact selected-acquisition effect.
  Preserve the audited bypasses of ordinary composition, replacement, Calling
  Card, and Denial unselected-row handling.
- Continue room chronology immediately after the dependent choice. Expose no
  pickup participation or move proposal.

### Application and UI

- Remove BBB editing from the outer Echo option card.
- Render a dedicated `Boon Boon Boon choice` row in the selected-outcome region
  after the outer selection.
- Use a contextual compound picker for one to three heterogeneous
  giver/trait/rarity rows and one selected row. Fixed-rarity traits show a
  read-only rarity; selectable rarities use engine-backed candidates.
- When the selected BBB row is targeted, render its contextual Target section
  below the BBB rows. Do not change row/card height.
- Make the fixed chronology obvious in copy and controls: no Picked up checkbox,
  no order handle, and no movement command.

### Deletions

- delete the inline `EchoLastRunBoonEditor` from outer option cards;
- delete raw BBB target selects and duplicated local candidate filtering;
- delete any application type or adapter whose only purpose was nesting BBB
  inside one option card, while retaining the engine-owned specialized domain;
  and
- do not replace those paths with a fake acquisition wrapper.

### Primary witnesses

- a real reached Echo flow records outer selection first, then blocks at the
  missing BBB child with no later room chronology;
- the picker includes representative Olympian, Hermes, Artemis, Athena, and
  Dionysus outcomes while excluding Hades, unsupported providers, equipped
  traits, and context-invalid rows;
- provider-specific Duo variants remain alternatives for one trait identity
  and cannot occupy two rows;
- fixed and selectable rarity domains render correctly;
- selected Bridal Glow exposes one target picker below BBB rows and commits one
  complete specialized offer;
- successful selection mutates only the selected provider's loot history and
  exact selected trait effect;
- switching outer options makes the BBB row dormant and restores it on return;
- missing/invalid BBB never throws through command, simulation, projection, or
  React; and
- the dedicated row and its nested target support exact focus plus Redux
  undo/redo without any acquisition participation/order product.

### Commit boundary

One Conventional Commit contains the forced dependent checkpoint, dedicated
BBB authoring surface, tests, and deletion of the inline editor. It retains
schema 45 unless a separately reviewed persisted-shape necessity is found.

## Test Ownership and Verification

Policy matrices remain with their semantic authorities:

- catalog tests own declared effect kinds, provider membership, direct sets,
  and source-backed exclusions;
- authored-project command/codec tests own strict shapes, dormant retention,
  complete atomic replacements, and schema rejection;
- simulation tests own pre/post checkpoints, branch agreement, history
  mutations, required pickup settlement, and blocked chronology;
- application projection/binding tests own exact controls, domains, semantic
  intents, markers, and finding destinations;
- React tests own equal card layout, selected-outcome visibility, contextual
  picker workflow, required/dependent copy, and Redux undo/redo; and
- product tests retain one representative end-to-end witness per gate rather
  than duplicating each engine matrix.

During implementation, use narrow owning lanes and `npm run test:changed`.
Each executor handoff records workspace typecheck, affected package lanes,
lint, formatting, build when application wiring changes, and `git diff
--check`. The complete `npm run check` runs once at final phase closure, not
after every gate.

Every gate requires a fresh executor, a fresh read-only adversarial reviewer,
bounded remediation for accepted findings, main-session holistic diff review,
and explicit authorization before commit.

## Adversarial Review Checklist

Before lock, the reviewer must answer with source and live-code evidence:

1. Does any named direct effect actually spawn an item or use chronology that
   contradicts the Gate-A lower-panel model?
2. Can All Together safely become unresolved without a hidden consumer still
   requiring `createDefaultAllTogetherResult`?
3. Does the four-role All Together draft preserve exhausted-set `null` and
   branch-specific domains without fabricating a full result?
4. Does Lapis require ordered outcomes anywhere, or is an unordered distinct
   set the truthful authored value?
5. Is Reward Reward Reward's generated row representable by the existing
   `pickupEntries`/acquisition-site products without a custom pending registry
   or duplicated replay identity?
6. Which exact replay sources are required objects, which open loot, and which
   transformation overrides must survive the move?
7. Can the required Reward row coexist with every real same-checkpoint
   acquisition without introducing a second order?
8. Does any BBB source path create loot or a world object? If not, confirm that
   acquisition participation is prohibited.
9. Does the existing BBB specialized value cover provider-source variants,
   Duo identity distinctness, rarity, and Bridal Glow target detail without a
   schema change?
10. Do dormant children retain authored state while publishing no capability,
    finding, destination, or lifecycle effect?
11. Can every missing selected child block and remain editable without an
    exception in command, simulation, workspace assembly, finding routing, or
    React?
12. Does the proposed contextual picker reuse delete real duplicated behavior,
    or would a new abstraction merely rename three effect-specific adapters?
13. Are any production custom editor, default, codec, command, or routing paths
    left after their gate's shared owner is established?
14. Are schema 44 and 45 the minimum truthful semantic boundaries, with no
    compatibility branch or unnecessary Gate-C bump?

Any source contradiction, required new persisted owner, or inability to model
Reward through one shared acquisition site is a lock blocker. Presentation
preferences that do not change semantic ownership may be resolved within the
named gate.

## Phase Closure

After Gate C and its bounded review remediation are stable:

1. perform a fresh cross-lane architecture, default, duplicate-editor,
   navigation, and chronology audit;
2. absorb the final schema and ownership rules into the smallest stable design,
   audit, and progress authorities;
3. update the durable audits without erasing source/model discrepancies;
4. remove gate language from production comments;
5. delete this temporary plan and leave no stable links to it;
6. run one complete `npm run check` exactly once; and
7. record its exact typecheck, test, lint, format, and build results in the
   durable implementation history before the final closure commit.

Phase closure must verify that the final product has one selected-outcome
surface, one generated Reward acquisition editor, one forced BBB checkpoint,
and no parallel effect registry, acquisition order, pending payload map, or
React-owned eligibility policy.
