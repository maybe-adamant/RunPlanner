# I Game Rules

## Scope and evidence

This document is the game-rule authority for Tartarus (`I`) under the
progressed-save static baseline with supported Nemesis combat. Shared occurrence, picker, reward, and
completion rules are defined by
[`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md). I
declarations own the Clockwork policy, candidate facts, caps, exits, and shop
profile.

The rules were checked against `RoomSets.lua`, `RoomDataI.lua`, Tartarus map
data, encounter data, `RunLogic.lua`, and `RoomLogic.lua` on 2026-07-18.

## Authored shape

- `I_Intro` is the fixed authored start.
- I uses the declared Clockwork generated-progression policy, with at most
  thirteen batches and twenty-three target occurrences.
- Goal state is batch-owned. It determines the declaration-supported candidate
  support without giving React a second topology or lifecycle authority.
- `I_PreBoss02` uses the `retainNormalPeers` policy. It can appear once in an
  ordinary batch beside normal room occurrences; it does not take over the
  physical exits or create a synthetic free-reward peer.
- The selected I Preboss begins the `I_Boss01`, `I_PostBoss01` completion tail.

I has no over-bound terminal takeover envelope. Its Preboss remains an
ordinary per-target retained peer, evaluated with ordinary candidates and
selected through the normal target path, so the normal batch and target bounds
continue to apply without a takeover exception.

The I Preboss is a Shop occurrence with declaration-owned `I_WorldShop` state.
Its shop inventory is entry-time state. An unselected peer retains its
occurrence and no inventory; selecting it materializes the declaration's
complete shop inventory.

`I_WorldShop` filters its option entries from the entered-biome history at
entry: `enteredBiomes <= 2` admits first-half entries and `enteredBiomes >= 3`
admits second-half entries. Phase-independent entries remain available, and
the five groups and one-offer-per-group shape do not change. The current
fixed-route evaluator supplies `biomeIndex + 1` as `enteredBiomeCount`, which
is equivalent for I's supported fourth-biome route and preserves its existing
second-half standard inventory. A future Dream Dive implementation must
update that fact producer for reordered history; it must not add an I-local
phase or alter the Shop declarations.

## Clockwork and history facts

The game-rule model keeps creation, appearance, entered history, goal updates,
and force pressure as separate declared effects. Door creation is sequential,
so a peer can observe earlier creation history. Target room identity,
eligible support, and physical exit keys remain catalog facts; the authored
project stores only occurrences, decisions, selected exits, and owned leaves.

The planner models possible and forced support, capped candidate creation,
complete offer defaults, concrete encounter selection, and the fixed completion
tail. It deliberately omits weighted RNG, combat-wave composition, NPC events
and interactions beyond selected combat, natural Chaos, anomalies, and optional
player interactions from the canonical baseline.

### Clockwork state and physical capacity

Entering `I_Intro` initializes five remaining Clockwork Goals and one authored
non-goal cap from the supported `3 | 4 | 5 | 6` outcome set. These are separate
facts: a Goal decrements the countdown on entry, while an entered concrete
Tartarus non-goal increments the non-goal count. An unselected target remains
an offered occurrence and does not advance either entered counter.

Targets are created in physical-door order. The first eligible combat offer in
a Clockwork batch receives the Goal realization; a later combat peer can
receive a concrete Tartarus reward while capacity remains. At the selected
non-goal cap, remaining combat rewards resolve to Goal. Two-door room
declarations also reserve capacity for a later two-door decision, preventing
an authored branch from evading the countdown indefinitely.

Goal and NonGoal are derived realizations of one occurrence-owned room state,
not alternate persisted topology. A dormant non-goal leaf survives while the
same room currently resolves to Goal, so a compatible upstream edit can change
the realization without destroying authored room-local intent.

### Concrete encounter selection

I's ordinary combat phase binds `IEncountersDefault` or
`IEncountersSmaller` according to its declaration. Each set includes
`NemesisCombatI` beside its exact ordinary/Goal definitions, so Nemesis can
replace only a supported active combat phase. Fixed starts, specials, Shops,
minibosses, Preboss, and completion rooms remain direct-definition slots with
no encounter picker.

Nemesis selection leaves the room's Clockwork reward realization and ordinary
reward ownership intact. Its requirements use exact definition history and the
same lifecycle counter timing as other encounters; the Gold wager, NPC
interaction, random/Shop/Bridge event paths, and enemy composition are not
modeled.

### Producers, special rooms, and Preboss

I ordinary batches have no authored Run/Meta store. Supported targets resolve
their declaration-owned `TartarusRewards` provenance before their counted
offer is validated. Combat, Reprieve, miniboss, Story, and Preboss declarations
then apply their concrete filters and producers. `I_Story01` is an ordinary
room occurrence only on a qualifying later physical door; it cannot occupy the
one-door Intro batch. Reprieve and miniboss declarations retain their own
forced stores and caps.

`I_PreBoss02` remains an ordinary target with `retainNormalPeers`: it may be
offered beside a continuing room, has its one-creation-per-source cap, and
only selection starts completion. Its `I_WorldShop` inventory materializes on
entry. It never rewrites the batch into a synthetic Shop/free pair.

The thirteen-batch and twenty-three-target bounds cover five Goals, up to six
non-goals, an optional entered Story, and the selected Preboss under the
physical exit constraints. `I_Boss01` and `I_PostBoss01` remain derived
completion declarations; automatic boss drops and persistent-save variants
remain out of the canonical modeled reward surface.
