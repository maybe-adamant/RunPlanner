# I Game Rules

## Scope and evidence

This document is the game-rule authority for Tartarus (`I`) under the
progressed-save, NPC-free baseline. Shared occurrence, picker, reward, and
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

The I Preboss is a Shop occurrence with declaration-owned `I_WorldShop` state.
Its shop inventory is entry-time state. An unselected peer retains its
occurrence and no inventory; selecting it materializes the declaration's
complete shop inventory.

## Clockwork and history facts

The game-rule model keeps creation, appearance, entered history, goal updates,
and force pressure as separate declared effects. Door creation is sequential,
so a peer can observe earlier creation history. Target room identity,
eligible support, and physical exit keys remain catalog facts; the authored
project stores only occurrences, decisions, selected exits, and owned leaves.

The planner models possible and forced support, capped candidate creation,
complete offer defaults, and the fixed completion tail. It deliberately omits
weighted RNG, combat-wave composition, persistent NPCs, natural Chaos,
anomalies, and optional player interactions from the canonical baseline.

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
