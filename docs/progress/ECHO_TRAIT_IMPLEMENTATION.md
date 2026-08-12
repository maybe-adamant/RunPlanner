# Echo Trait Implementation Plan

## Status

**Lock candidate.** This isolated Gate E follow-up is based on the source
facts in `TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md` and
`ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`. It starts from the schema-20
acquisition-settlement baseline at `c8bf9f9` after the current closure gate.

Do not link this temporary plan from stable design or audit documents while it
is active. Absorb durable contracts and retire the plan at delivery closure.

## Objective

Publish Echo as an explicitly supported seven-choice Story provider:

1. Reward Reward Reward;
2. Boon Boon Boon;
3. Survive Survive Survive;
4. Pom Pom Pom;
5. Evade Evade Evade;
6. Fight Fight Fight; and
7. Gold Gold Gold.

Gift Gift Gift remains absent until the planner owns previous-keepsake identity
and keepsake lifecycle. The product and documentation must call this the
planner's supported Echo subset rather than a complete transcription of the
eight-choice game menu.

The implementation extends the existing trait and acquisition authorities. It
must not add a generic effect interpreter, prior-run simulator, Shop-private
order, Echo callback registry, or React-owned replay policy.

## Locked source interpretation

### Direct Echo choices

- Evade and Fight equip fixed-Common Echo traits. Their numeric bonuses and
  decay remain outside the planner.
- Survive reuses Echo's source-local Death Defiance condition. Restoration
  count and healing remain collapsed.
- Pom evaluates the equipped Pom-eligible traits at Echo's pre-choice state,
  finds those tied at the greatest current level, authors one target from that
  exact domain, and adds the target's current level to itself. The source game
  permits a no-op when no target exists; the planner must not invent an
  ineligible outer choice merely to require a target.

### Boon Boon Boon

The game reads the previous run's exact trait/rarity cache, filters it against
the current run, and offers up to three results. Previous-run state is not a
planner input. The supported approximation is therefore:

- author one to three distinct trait-and-rarity options;
- draw them from the declaration-owned Echo-last-run provider domain;
- assess each against Echo's exact pre-offer equipped state;
- exclude currently equipped traits, occupied ordinary slots, explicit trait
  exclusions, and providers excluded from this source;
- apply the current scalable rarity floor;
- do not apply first-Olympian or replacement composition; and
- directly equip the selected option.

The previous-run Shrine predicate is collapsed with the unavailable prior-run
input. Selecting this Echo choice explicitly authors the approximation; the
planner does not invent a Shrine-history flag.

The options may come from different providers. This is a closed mixed-provider
offer, not an `AuthoredTraitOffer` with a fictional Echo giver. The UI presents
the giver and trait label for each option and supports one to three rows without
empty placeholder options.

### Reward Reward Reward

Canonical acquisition history retains the exact latest effective
`LastRewardEligible` replay descriptor. That fact is updated only by a concrete
acquisition whose normalized declaration opts in. It is not derived from the
last generic reward event.

The replay descriptor identifies the exact source needed to construct the
recreated acquisition:

- a consumable recreates that concrete consumable;
- a loot source recreates that source and owns a fresh trait offer; and
- replayed consumables use Echo's run-progress-upgrade path, so replayed Nectar
  applies its room-progress Pom behavior.

Selecting Reward materializes one mandatory Echo-room acquisition entry at a
declaration-owned pre-outgoing settlement point. The exact replayed offer is
history-derived; acquisition-time trait or level detail remains authored on
that entry. An atomic engine command may carry the current assessment-derived
replay value, but simulation remains the authority that validates it against
the canonical pre-Echo history. React never scans earlier rendered rewards.

### Gold Gold Gold

Selecting Gold equips `EchoDoubleShop` as a fixed-Common one-use trait. The
equipped trait is the complete pending state; there is no parallel pending-
effect field.

World Shop settlement examines purchases in authored order. For the first
eligible purchased entry while `EchoDoubleShop` is equipped:

1. settle the original purchase;
2. materialize the exact free duplicate as a mandatory supplemental entry at
   the same Shop site;
3. settle that duplicate immediately after the purchase; and
4. consume/remove `EchoDoubleShop` from equipped state.

`SpellDrop` neither triggers nor consumes the trait. If no eligible World Shop
purchase occurs, the trait remains equipped. Wells and future Hermes Shrines
use different source paths and are not included.

A duplicated loot source owns a fresh trait offer. A duplicated consumable
owns its exact acquisition behavior, but Shop duplication does not opt Nectar
into its room-progress Pom effect. The mandatory duplicate has no Purchased or
Picked Up checkbox and cannot be reordered away from its triggering purchase.

## Ownership and product contract

### Catalog

The Hades II catalog owns:

- the seven Echo declarations, labels, fixed rarity, and dispositions;
- exact Echo-last-run giver/trait participation and exclusions;
- effective `LastRewardEligible` replay descriptors for concrete acquisitions;
- the Echo replay producer lifecycle and exact settlement point;
- the highest-level Pom target effect; and
- the World Shop duplication trigger, `SpellDrop` exclusion, and recreated
  acquisition mapping.

Normalization rejects unknown replay targets, unsupported mixed-provider
members, invalid settlement points, and a duplicate trigger without a concrete
recreation mapping.

### Authored project

Persist only author decisions and acquisition-time children:

- the outer three-choice Echo Story offer;
- one closed mixed-provider Boon offer when that selected Echo option is
  active;
- the Pom target where applicable;
- the source-local Death Defiance fact where applicable;
- exact replay acquisition detail when Reward is active; and
- fresh trait/level detail for a materialized Shop duplicate.

Switching the selected outer option makes unrelated children dormant without
deleting them; switching back restores them. Applicability is strict at codec
contact. Do not add a generic option-outcome record or string-keyed effect bag.

The current acquisition-site order remains the authority for optional Shop
purchases and optional pickups. Mandatory Reward and Gold-generated entries
are declaration-derived insertions: they may own persisted child detail, but
their participation and relative placement are not authored order members.
Gate C must allow a Shop site to carry both producer-owned offers and
supplemental pickup detail; it must not restore `purchaseOrder` or a second
pickup order.

### Trait history

Add one explicit equipped-trait consumption/removal event. Folding it removes
the exact one-use trait from `equippedTraits` while retaining chronological
evidence that it was acquired and consumed. The event is general to a
declaration-owned consumed equipped trait, but this plan adds no general
duration, charge, combat-use, or effect interpreter.

Gold queries the canonical equipped state immediately before each Shop entry.
It does not mirror an `echoDoubleShopPending` boolean into reward history.

### Settlement

Reward replay and Shop duplication both produce ordinary
`AcquisitionSettlementEntry` products. The reward kernel applies their exact
concrete acquisition, trait offer, and level effects. The only exceptional
facts are how the entries become due and where declaration policy inserts
them.

Equivalent-branch keys must include the latest replay descriptor and equipped
trait consumption state. Candidate evaluation consumes the same pre-entry
frontiers as selected simulation; it never replays a second Echo or Shop fold.

### Application and React

The structured workspace exposes:

- the ordinary Echo outer trait editor;
- a focused mixed-provider editor only for active Boon;
- a replay acquisition row only for active Reward;
- the existing target picker for Pom; and
- a supplemental duplicate row in the Shop Acquisitions workbench only when
  Gold has actually made that entry due.

Producer and acquisition findings navigate to their exact separate owners.
React receives labels, candidate domains, entry placement, and commands from
the workspace. It does not inspect trait keys to decide which secondary UI to
render.

## Delivery gates

### Gate A — Echo provider and direct choices

1. Add the seven source-backed Echo trait declarations and giver.
2. Bind `Story_Echo_01` to the provider.
3. Implement Evade, Fight, Survive, and Pom through current trait authorities.
4. Add the highest-current-level target domain and exact doubling fold.
5. Add the mixed-provider Boon authored product, codec, commands, progressive
   candidates, selected simulation, findings, and contextual UI.
6. Prove one-to-three cross-provider options, rarity-floor behavior, slot and
   equipped exclusions, and absence of ordinary composition rules.

Default commit:

```text
feat(planner): model Echo direct trait choices
```

### Gate B — Exact last-reward replay

1. Normalize exact replay eligibility and recreation descriptors.
2. Fold the latest eligible descriptor through canonical reward history.
3. Add Echo's pre-outgoing replay settlement point and mandatory entry.
4. Author and validate the entry's fresh trait/level children without nesting
   them in the outer trait dialog.
5. Prove consumable replay, loot-source fresh offers, replayed Nectar, branch
   divergence, no-prior-reward ineligibility, persistence, and undo/redo.

Default commit:

```text
feat(engine): model Echo last-reward replay
```

### Gate C — One-use World Shop duplication

1. Add equipped-trait consumption/removal history.
2. Permit one Shop site to publish its authored purchases plus derived
   supplemental pickup detail.
3. Trigger only after the first eligible purchase, insert the duplicate
   immediately, and consume the trait exactly once.
4. Preserve fresh trait/level editing on duplicated loot sources.
5. Prove `SpellDrop` skip, no-purchase persistence, later-Shop triggering,
   sequential purchase interaction, consumable behavior, and no Well contact.

Default commit:

```text
feat(engine): model Echo World Shop duplication
```

### Gate D — Product closure and absorption

1. Run the complete repository gate.
2. Verify every active Echo and supplemental acquisition owner has one
   containing inspector, interaction, and finding destination.
3. Search for provider-name switches, parallel pending state, Shop-private
   chronology, and duplicate trait/acquisition folds.
4. Retain one primary policy matrix per authority and representative product
   loops only.
5. Absorb durable contracts into design and progress authority, then retire
   this plan.

Default commit:

```text
docs: absorb Echo trait delivery
```

## Explicitly deferred

- Gift Gift Gift and all previous-keepsake state;
- an actual previous-run trait cache or Shrine-history input;
- Echo numeric healing, dodge, Life, Magick, and decay effects;
- probability and random selection witnesses;
- Well or Hermes Shrine duplication;
- generic trait charges, duration, combat consumption, or callbacks; and
- arbitrary dynamic acquisition insertion rules.

## Acceptance audits

- The production Echo menu exposes exactly the supported seven choices and
  clearly omits Gift.
- No Echo descriptor enters equipped state except Evade, Fight, and the
  one-use Gold trait; Boon equips its selected nested option.
- Reward always replays the exact latest eligible source and never a generic
  alias.
- Gold has one pending representation—the equipped trait—and one consumption
  event.
- Every generated duplicate appears once, immediately after its triggering
  purchase, and cannot be abandoned or reordered.
- Inactive secondary children emit no active finding or run-state effect.
- Current room exits are generated at the source-backed checkpoint and are not
  regenerated by replay or Shop duplication.
- React contains no Echo, replay-eligibility, duplication, or trait-legality
  policy.
