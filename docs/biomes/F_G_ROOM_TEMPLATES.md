# F/G Room Template Contracts

## Purpose

This document defines the app-native room-template contracts required for the
F/G vertical slice. A template describes the typed leaf shape and
materialization behavior shared by concrete Room Declarations. It is not a UI
component, Lib control, persistence allocation, or source of topology.

Template materialization produces room-local semantic input. The
catalog-selected lifecycle profile defined by `../design/ROOM_LIFECYCLE_MODEL.md`
turns that input into an ordered `RoomHistoryFragment`; templates do not own or
imperatively execute history ordering.

Concrete declarations own game-specific exits, requirements, caps, labels,
encounter-profile keys, and reward bindings. Templates consume those
normalized facts and complete authored state.

## Shared Contract

Every template implementation provides pure operations equivalent to:

```ts
interface RoomTemplate<State, RoomLocalMaterialization> {
  createDefaultState(context: TemplateDefaultContext): State;
  decodeState(value: unknown, context: TemplateDecodeContext): State;
  validateLocalState(state: State, context: TemplateContext): LocalIssue[];
  materialize(state: State, context: TemplateContext): RoomLocalMaterialization;
}
```

Exact APIs may differ. The invariants do not:

- defaults come recursively from declarations;
- constructed active leaf state is complete;
- replacements are atomic and cannot empty an existing value;
- local validation checks shape and declaration membership only;
- counted materialization receives its resolved store from the owning batch
  and Room Declaration context;
- route history, force, caps, peers, and contextual eligibility belong to the
  simulator;
- topology is never passed as mutable state;
- normalized template/encounter composition resolves one compatible lifecycle
  profile rather than switching on a concrete room name;
- findings return to occurrence-based semantic addresses.

An occurrence replacement preserves `occurrenceId` and installs the new Room
Declaration's complete offer-time defaults plus entry-time defaults when that
occurrence is picked.

## Common Reward Fragments

Templates compose the reward values defined in `../design/REWARD_MODEL.md`:

```ts
type RoomRewardState =
  | { kind: 'none' }
  | { kind: 'fixed'; payload?: RewardPayload }
  | { kind: 'counted'; offer: ResolvedRewardOffer }
  | { kind: 'shop'; shop?: ShopState };
```

The normalized declaration determines the legal branch. Templates do not
infer bindings from room names. `fixed` and `counted` describe door-offer
state; `shop` describes entry-materialized state and is required only when the
occurrence is picked.

## `FixedOpening`

### Coverage

`F_Opening01`, `F_Opening02`, and `F_Opening03`.

### State

One complete counted `RunProgress` reward excluding Devotion,
`RoomMoneyDrop`, `MaxHealthDrop`, and `MaxManaDrop`.

```ts
interface FixedOpeningState {
  incomingOffer: ResolvedRewardOffer;
}
```

The default begins with the binding's explicit default reward and recursive
payload defaults. The opening encounter identity is immutable declaration
data and is not authored state.

### Materialization

Emits one start room fragment, its fixed opening encounter profile, and the
complete resolved incoming opening offer. Root selection and outgoing topology remain
Biome Plan facts.

## `FixedIntro`

### Coverage

`G_Intro` for the current slice.

### State

G's intro has `none` incoming reward, so its authored state is empty or an
explicit zero-field discriminant according to the final codec.

### Materialization

Emits the fixed intro room and encounter profile. Encounter counter effects
come from the profile. The template owns no start selection or continuation.

## `StandardCombat`

### Coverage

`F_Combat01..22` and `G_Combat01..20`.

### State

```ts
interface StandardCombatState {
  incomingOffer: ResolvedRewardOffer;
}
```

The owning batch and room override determine the resolved store. The concrete
room binding determines filters and the complete reward domain accepted from
possible resolved stores. The same template therefore covers `F_Combat01`,
ordinary F combat, the four Devotion-excluding G combat rooms, and ordinary G
combat without conditionals inside the template.

### Materialization

Emits one standard combat encounter profile and the occurrence's concrete
incoming reward. It does not own physical exits, candidates, picked state,
eligibility, or repeated-name policy.

## `Miniboss`

### Coverage

`F_MiniBoss01..03` and `G_MiniBoss01..03`.

### State

The F/G binding fixes `RunProgress` and positively filters to `Boon`, leaving
one complete Boon-source payload:

```ts
interface MinibossState {
  incomingOffer: {
    rewardType: 'Boon';
    payload: { source: BoonSourceGameName };
  };
}
```

### Materialization

Emits the concrete miniboss encounter profile selected by the Room
Declaration and its incoming Boon offer. Which miniboss is offered or entered
is topology and history, not template state.

## `Story`

### Coverage

`F_Story01` and `G_Story01`.

### State

No authored fields. Both produce fixed payload-free `Story`.

### Materialization

Emits the fixed Story reward and declared story encounter profile. Room
eligibility and creation caps remain declaration requirements.

This template owns only the incoming Story producer. Concrete NPC dialogue,
gift choices, and trait/resource effects inside the room are a deferred entity
and trait-resolution surface; they are not hidden Story state.

Fixed state rejects reward replacement rather than persisting a redundant
`Story` key.

## `Fountain`

### Coverage

`F_Reprieve01` and `G_Reprieve01`.

### State

```ts
interface FountainState {
  incomingOffer: ResolvedRewardOffer;
}
```

Both bindings permit `RunProgress` and `MetaProgress` and exclude Devotion.
Health restoration is a fixed encounter-profile fact rather than authored
reward state.

### Materialization

Emits the complete resolved incoming offer and `HealthRestore` encounter profile.

## `Shop`

### Coverage

`F_Shop01` and `G_Shop01`.

### State

```ts
interface ShopState {
  profileKey: 'WorldShop';
  offers: Readonly<Record<ShopSlotKey, ShopOfferState>>;
}
```

When the room is picked for entry, every slot emitted by the three ordered
World Shop groups begins with a complete default offer and a concrete
`purchased` boolean. An unpicked Shop occurrence may omit this
entry-materialized state or retain a previously authored complete value
dormantly. Reward replacement remains within its owning group's option entries;
group cardinality and per-option requirements are simulation facts. The state
carries no counted `storeKey`.

A Blind Box slot persists its intended eventual Boon source as part of the
complete resolved offer. That source is dormant while `purchased` is false and
is validated only at the purchase-time lifecycle point.

### Materialization

Entering the room exposes all three group-derived offers in group order and
acquires exactly those with `purchased: true`. Its WorldShop lifecycle
generates the outgoing batch while the complete inventory is still active,
then advances the purchased offers. The incoming door offer is the fixed Shop
producer; shop inventory is room-internal state. Purchase order is a derived
possibility witness used to prove an authored Blind Box source; it is not
another persisted leaf field.

Player-facing labels are `Offer 1`, `Offer 2`, and `Offer 3`. Stable internal
slot keys remain semantic addresses and persistence keys.

## `ForkedPreboss`

### Coverage

`F_PreBoss01` and `G_PreBoss01`.

### Structural Context

This template is used through the `forkedTransition` terminal policy. The selected
predecessor's declared physical exits produce ordered terminal target
occurrences:

```text
target 1 -> shop realization
target 2 -> free reward realization
target 3 -> free reward realization, G only
```

Every target has its own occurrence ID while referencing the same preboss Room
Declaration. The derived realization kind is immutable topology context, not
an editable or persisted `entryMode`.

### State

The active state shape follows the derived realization:

```ts
type ForkedPrebossState =
  | {
      kind: 'shop';
      shop?: ShopState;
    }
  | {
      kind: 'freeReward';
      offer: ResolvedRewardOffer;
    };
```

The terminal policy supplies the discriminant. The Room Declaration supplies
complete defaults for the active branch: free-reward state is always complete
because it materializes on the door, while shop state becomes required only
when that target is picked for entry. The free binding fixes `RunProgress` and
excludes Devotion and `RoomMoneyDrop`.

The project codec may encode the discriminant for self-description, but
contact validation must prove that it matches the target's derived terminal
role. User commands cannot arbitrarily change it.

### Materialization

All terminal targets emit room-creation and door-offer facts. The picked
target alone emits appearance and acquisition:

- picked `shop` enters the preboss map and acquires purchased shop offers;
- picked `freeReward` enters the same preboss map and acquires that concrete
  reward;
- unpicked targets contribute no acquisition or room-internal shop activity.

F permits one shop plus at most one free target. G permits one shop plus at
most two free targets. Predecessor exit capacity, target ordering, picked
state, and overflow reconciliation remain terminal-transition responsibilities.

## Defaults and Replacement

Defaults are semantic, not positional:

- each generated batch owns a default base store from its layout policy;
- each counted binding owns one complete default resolved offer for each store
  context it can receive;
- each payload-bearing reward type owns a complete offer-payload default;
- every shop slot owns a default offer and purchase state;
- the preboss terminal policy owns the realization-role ordering.

Ordinary leaf commands only replace complete values. A counted choice cannot
return to unspecified, a Boon cannot lose its source, and a shop slot cannot
lose its offer. Structural deletion removes the owning occurrence; undo is the
recovery boundary.

Replacing a batch's base store is a topology-owner command, not a leaf command.
It retains every target reward and lets contextual validation report any reward
that the newly resolved store cannot produce.

## Semantic Addresses

Template findings and editor destinations attach beneath the occurrence:

```text
room offer        biomeKey + occurrenceId + incomingOffer
shop offer        biomeKey + occurrenceId + shopSlotKey + offer
shop purchase     biomeKey + occurrenceId + shopSlotKey + purchased
preboss offer     biomeKey + occurrenceId + incomingOffer
```

No template addresses state by game room name, UI row, or array position.

## Registration Gate

Catalog construction rejects a template/declaration pairing when:

- the producer kind is unsupported by that template;
- the required encounter profile is absent or incompatible;
- the binding has no complete reward default for a store context it can
  receive;
- a fixed template receives editable reward state;
- a shop references an unknown profile or slot option;
- a forked preboss realization disagrees with its terminal policy.

These are contract failures, not correctable user findings.

## Later Templates

H Fields combat, I Clockwork combat, N hub rooms, O Ship combat, P internal
encounter structure, and Q's scripted paired-miniboss structure are deferred.
They should reuse these resolved-offer atoms and occurrence rules rather than expand
this F/G template set with dormant branches.
