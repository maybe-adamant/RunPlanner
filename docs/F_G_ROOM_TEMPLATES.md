# F/G Room Template Contracts

## Purpose

This document defines the app-native room-template contracts required for the
F/G vertical slice. A template describes the typed leaf shape and
materialization behavior shared by concrete Room Declarations. It is not a UI
component, Lib control, persistence allocation, or source of topology.

Concrete declarations own game-specific exits, requirements, caps, labels,
encounter-profile keys, and reward bindings. Templates consume those
normalized facts and complete authored state.

## Shared Contract

Every template implementation provides pure operations equivalent to:

```ts
interface RoomTemplate<State, Fragment> {
  createDefaultState(context: TemplateDefaultContext): State;
  decodeState(value: unknown, context: TemplateDecodeContext): State;
  validateLocalState(state: State, context: TemplateContext): LocalIssue[];
  materialize(state: State, context: TemplateContext): Fragment;
}
```

Exact APIs may differ. The invariants do not:

- defaults come recursively from declarations;
- constructed active leaf state is complete;
- replacements are atomic and cannot empty an existing value;
- local validation checks shape and declaration membership only;
- route history, force, caps, peers, and contextual eligibility belong to the
  simulator;
- topology is never passed as mutable state;
- findings return to occurrence-based semantic addresses.

An occurrence replacement preserves `occurrenceId` and installs the new Room
Declaration's complete template defaults.

## Common Reward Fragments

Templates compose the reward values defined in `REWARD_MODEL.md`:

```ts
type IncomingRewardState =
  | { kind: 'none' }
  | { kind: 'fixed'; payload?: RewardPayload }
  | { kind: 'counted'; choice: CountedRewardChoice }
  | { kind: 'shop'; shop: ShopState };
```

The normalized declaration determines the legal branch. Templates do not
infer bindings from room names.

## `FixedOpening`

### Coverage

`F_Opening01`, `F_Opening02`, and `F_Opening03`.

### State

One complete counted `RunProgress` reward excluding Devotion,
`RoomMoneyDrop`, `MaxHealthDrop`, and `MaxManaDrop`.

```ts
interface FixedOpeningState {
  generatedReward: CountedRewardChoice;
}
```

The default begins with the binding's explicit default reward and recursive
payload defaults. The opening encounter identity is immutable declaration
data and is not authored state.

### Materialization

Emits one start room fragment, its fixed opening encounter profile, and the
concrete incoming opening reward. Root selection and outgoing topology remain
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
  generatedReward: CountedRewardChoice;
}
```

The concrete room binding determines allowed stores, filters, and defaults.
The same template therefore covers `F_Combat01`, ordinary F combat, the four
Devotion-excluding G combat rooms, and ordinary G combat without conditionals
inside the template.

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
  generatedReward: {
    storeKey: 'RunProgress';
    reward: {
      rewardType: 'Boon';
      payload: { source: BoonSourceGameName };
    };
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

Fixed state rejects reward replacement rather than persisting a redundant
`Story` key.

## `Fountain`

### Coverage

`F_Reprieve01` and `G_Reprieve01`.

### State

```ts
interface FountainState {
  generatedReward: CountedRewardChoice;
}
```

Both bindings permit `RunProgress` and `MetaProgress` and exclude Devotion.
Health restoration is a fixed encounter-profile fact rather than authored
reward state.

### Materialization

Emits the concrete incoming reward and `HealthRestore` encounter profile.

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

Every declared World Shop slot begins with a complete default offer and a
concrete `purchased` boolean. Reward replacement remains within the slot's
declared option set. The state carries no counted `storeKey`.

### Materialization

Entering the room exposes all declared offers and acquires exactly those with
`purchased: true`. The incoming door offer is the fixed Shop producer; shop
inventory is room-internal state.

Player-facing labels are `Offer 1`, `Offer 2`, and `Offer 3`. Stable internal
slot keys remain semantic addresses and persistence keys.

## `ForkedPreboss`

### Coverage

`F_PreBoss01` and `G_PreBoss01`.

### Structural Context

This template is used through the `PrebossEntry` terminal policy. The selected
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
      shop: ShopState;
    }
  | {
      kind: 'freeReward';
      choice: CountedRewardChoice;
    };
```

The terminal policy supplies the discriminant while the Room Declaration
supplies both branches' complete defaults. The free binding fixes
`RunProgress` and excludes Devotion and `RoomMoneyDrop`.

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

- each counted binding owns a default store and reward;
- each payload-bearing primitive owns a complete payload default;
- every shop slot owns a default offer and purchase state;
- the preboss terminal policy owns the realization-role ordering.

Ordinary leaf commands only replace complete values. A counted choice cannot
return to unspecified, a Boon cannot lose its source, and a shop slot cannot
lose its offer. Structural deletion removes the owning occurrence; undo is the
recovery boundary.

## Semantic Addresses

Template findings and editor destinations attach beneath the occurrence:

```text
room reward       biomeStepKey + occurrenceId + generatedReward
shop offer        biomeStepKey + occurrenceId + shopSlotKey + offeredReward
shop purchase     biomeStepKey + occurrenceId + shopSlotKey + purchased
preboss reward    biomeStepKey + occurrenceId + generatedReward
```

No template addresses state by game room name, UI row, or array position.

## Registration Gate

Catalog construction rejects a template/declaration pairing when:

- the producer kind is unsupported by that template;
- the required encounter profile is absent or incompatible;
- the binding has no complete default;
- a fixed template receives editable reward state;
- a shop references an unknown profile or slot option;
- a forked preboss realization disagrees with its terminal policy.

These are contract failures, not correctable user findings.

## Later Templates

H Fields combat, I Clockwork combat, N hub rooms, O Ship combat, P internal
encounter structure, and Q deterministic miniboss structure are deferred.
They should reuse these reward atoms and occurrence rules rather than expand
this F/G template set with dormant branches.
