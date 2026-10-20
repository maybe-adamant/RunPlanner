# Smarter Draft

Status: locked 2026-10-20. Base commit: `b5b49e93e`.

## Objective

Draft mode produces plans that respect basket order within a god, scale to the
biomes being planned, catch selected NPCs in their windows, and buy what they
need from Shops at a reasonable pace. Every improvement is measured against a
deterministic corpus. A heavy basket must stay within about 15 s.

## Model

1. **Strict order within a god.**
   - The basket's order is the acquisition order of each god's own traits.
   - When a god's room comes up, only that god's next unmet trait may be
     authored. If it can't be offered, the walk skips that god for now and
     retries in later rooms.
   - Prerequisites still win. The engine refuses a basket order that places a
     trait above its own prerequisite, in the same way as the existing caps,
     and the UI reorders traits per god.
   - The persisted `basketTraitKeys` array already keeps order, so no schema
     change is needed.
2. **Duos.**
   - Duos sit outside both gods' order lists.
   - Once a Duo's prerequisites are met, the first room of either god accepts
     it with 33% probability, the next with 66%, and the third with 100%.
   - In a short biome it carries over to the next one.
   - Legendaries gate on their prerequisites and close their god's list.
3. **Scaling by planned biomes.**
   - The draft follows the route's configured prefix ("Plan up to"). This
     reverses the full-route-only draft of `1ebe3ab11`.
   - The god boon cap and the combined Hermes-plus-Hammer cap scale by the
     planned share of the route, rounded up. For example, one biome of four
     gives 3 boons (2 under Forfeit) and 1 Hermes-or-Hammer.
   - The Selene and NPC caps do not scale.
   - A basket over the scaled cap is an over-budget state shown as usual; it
     is not trimmed automatically.
   - Targets and the report cover only the planned biomes.
4. **NPC windows outrank traits.**
   - A selected NPC's qualifying room is reserved ahead of a due god trait.
   - The qualifying conditions are read generically from the encounter
     requirements:
     - room-reward exclusions;
     - depth-cache window;
     - indoor or outdoor tags;
     - the 6-room gap since the previous NPC;
     - once per route.
   - Once the window opens, the steering favours hosting rooms, prefers a
     non-excluded door reward at that door, and keeps the gap clear of other
     NPCs.
   - A missed window is reported as a miss.
5. **Purchases.**
   - The walk buys due items from a Shop it reaches: a god boon (including
     Mystery), Hermes or a Hammer.
   - A soft pace nudge aims at about 2 purchases per planned biome in total.
     Purchases become less likely ahead of that pace and more likely behind
     it. The pace never blocks a purchase and never forces one.
   - Gold is not modelled; this is draft policy.
6. **Offer exclusions in the walk.** The walk acts on
   `RewardProducerCandidateResult.exclusions`:
   - `peerConflict` re-authors the peer;
   - `godCap`, `godNotInteracted` and `devotionSourceNotAcquired` stop chasing
     that god in the biome;
   - static kinds that hold in every branch prune the type for the biome;
   - `entriesSpent` and `storeExhausted` drop that supply hope early;
   - `priorityRequired` authors the queued priority first.

## Source facts

- Field NPCs and their extra requirements (catalog), beyond the shared rules
  of once per route and no other NPC encounter in the previous 6 rooms:

  | NPC      | Biomes  | Extra requirements                                                                                                                                                             |
  | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | Artemis  | F, G, N | depth cache ≥4; room reward not Boon, SpellDrop, Devotion, HermesUpgrade or WeaponUpgrade                                                                                      |
  | Icarus   | O, P    | depth cache ≥3; same reward exclusion; P needs an outdoor room                                                                                                                 |
  | Athena   | P       | depth cache ≥4; same reward exclusion                                                                                                                                          |
  | Heracles | N, O, P | reward not Devotion; no Heracles in the previous 20 rooms; P needs an indoor room                                                                                              |
  | Nemesis  | F–I     | depth cache ≥4 (her H encounter uses encounter depth ≥1); not Fresh File; same reward exclusion plus StackUpgrade and TalentDrop; her random event (F, G, H) is also not Dream |

- Median god-room capacity per biome is F5 G2 H1 I2 and N5 O1 P2 Q2, minus 1
  under Forfeit.
- The Preboss incoming reward is the Shop. Today the walk buys only Hermes and
  Hammers.
- Today the walk re-settles every applied command, which takes about two
  thirds of draft time.

## Ownership

- **Planner engine** (`simulation/draft/`):
  - order legality and the per-god queue in the schedule and in
    `trait-offers`;
  - Duo escalation;
  - prefix scaling of caps, the schedule, the report and `ReplaceRoute`;
  - the generic NPC requirement reader and its steering;
  - purchase steering with the pace nudge;
  - exclusion-driven repairs.
- **Planner application:**
  - per-god ordered basket chips with reordering, through `ReplaceDraftSpec`;
  - showing the scaled caps;
  - the prefix-aware Draft action.
- **No catalog, schema, plan-wire or game-module change.**

## Measurement

- An opt-in corpus lane, excluded from `test:correctness` like
  `test:equivalence`. It covers N specs × M seeds over all three routes:
  - light, medium and heavy baskets;
  - Hermes or Hammer;
  - a field NPC;
  - Forfeit;
  - 1, 2 and 4 planned biomes.
- It records, per run:
  - drafted or failed;
  - targets met per kind;
  - order violations;
  - NPC windows met;
  - purchases;
  - attempts and ms.
- Each gate reports its delta against the previous gate's numbers. A heavy
  basket's worst run must stay within about 15 s.

## Gates

0. **Corpus.**
   - The lane, plus a committed summary baseline of rates and medians, not
     plans.
   - No behaviour change.
1. **Order and Duos.**
   - Engine order legality and the per-god queue.
   - Duo escalation.
   - The app's per-god reorder.
   - Tests: schedule, trait-offers and walk witnesses; `test:engine`,
     `test:planner`; the corpus delta.
2. **Scaling.**
   - The prefix-aware generator, `ReplaceRoute` prefix and report.
   - Scaled caps (engine-owned) and the app's cap display.
   - Tests: `test:engine`, `test:planner`, `test:product`; the corpus delta.
3. **NPC windows.**
   - The generic requirement reader, the steering and the miss report.
   - Tests: `test:engine`; the corpus delta.
4. **Purchases and exclusions.**
   - Purchase steering with the pace.
   - Exclusion-driven repairs.
   - Tests: `test:engine`; the corpus delta.
5. **Closure.**
   - An independent review.
   - Promote durable rules to the draft design documentation.
   - Update `docs/testing/DRAFT_MODE_LIVE_ACCEPTANCE.md`.
   - Delete this plan.

## Non-goals

- Fresh File drafting, which comes later;
- draft share codes, which follow this plan;
- per-biome purchase budgets or a gold model;
- per-biome milestone targets other than prefix scaling;
- a biome-by-biome live reveal.
