# Q Game Rules

## Scope and evidence

This document is the game-rule authority for Mount Olympus Summit (`Q`) under
the progressed-save static baseline. The shared cross-biome contract lives
in [`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md); Q
declarations own its staged room pools and exact physical exits.

The rules were checked against `RoomSets.lua`, `RoomDataQ.lua`, summit map
data, encounter data, `RunLogic.lua`, and `RoomLogic.lua` on 2026-07-18.

## Authored shape

- `Q_Intro` is the fixed authored start.
- The generated progression has six declaration-owned stages and a maximum of
  eight target occurrences. Each stage admits only its named candidate pool;
  room replacement cannot bypass that pool.
- Q's forced two-door rooms and miniboss stages are ordinary batches with
  declaration-owned exit keys. A selected normal target remains the only
  editable traversal spine.
- `Q_PreBoss01` is a width-one atomic takeover Preboss at the declared final
  frontier. It owns a single Q World Shop occurrence and has no remaining free
  offer.
- Selecting the Preboss begins the `Q_Boss01` completion tail.

The width-one rule is physical: Q does not create an unpicked peer and does
not need a second offer owner. The Preboss occurrence is real authored state
and its shop inventory materializes on entry.

The six declared stages are six realized ordinary units. After the second
miniboss stage, one terminal zero-target normal decision envelope is admitted
solely for the fixed width-one `Q_PreBoss01` takeover; it has no seventh
ordinary stage or ordinary target domain.

## Staged candidates and repair

Staged eligibility is structural. A target may be replaced only with a room
from the same declared stage, while compatible room-local leaves keep their
stable occurrence owner. A source-room change that makes an existing ordinary
target unavailable retains that target until explicit capacity reconciliation;
the repair command owns removal and downstream cleanup.

The planner represents possible and forced support, declaration-defined
history effects, concrete encounter selection, and physical door order. It
omits weighted RNG, unmodeled combat composition, NPC event/interactions,
natural Chaos, anomalies, and optional player interactions from the canonical
baseline.

## Exact stage body

The six ordinary Q stages are declaration-owned: foyer, first fork, first
miniboss, ordinary room, second fork, and second miniboss. Each stage has a
finite named room pool; a candidate can only be offered or replace a compatible
occurrence inside that stage. The first and second forks expose two physical
doors where their concrete room declaration does so, while miniboss and
ordinary declarations retain their own one- or two-door facts. Selection still
follows the common normal-exit contract rather than a separate staged topology.

Q ordinary batches own no Run/Meta base store. Rewardless combat preserves its
declared no-reward shape; miniboss declarations own their forced
`TyphonBossRewards` offer. A selected Miniboss Room Occurrence contributes its
entered history before the next stage, while an unselected fork peer remains a
real offered occurrence. These differences are declaration-owned and are not
collapsed into a generic combat-reward UI state.

## Final Shop and declared completion

After the second miniboss stage, `Q_PreBoss01` takes over the final one
physical normal exit. Its width-one batch has only the entry-time `Q_WorldShop`
occurrence and no synthetic free reward. Selecting that occurrence closes the
editable Q body and starts the derived `Q_Boss01` completion declaration.

`Q_WorldShop` filters its option entries from the entered-biome history at
entry: `enteredBiomes <= 2` admits first-half entries and `enteredBiomes >= 3`
admits second-half entries. Phase-independent entries remain available. The
first group still emits two distinct options without replacement after phase
filtering, while the five-group and six-slot shape remains fixed. The current
fixed-route evaluator supplies `biomeIndex + 1` as `enteredBiomeCount`, which
is equivalent for Q's supported fourth-biome route and preserves its existing
second-half standard inventory. A future Dream Dive implementation must
update that fact producer for reordered history; it must not add a Q-local
phase or alter the Shop declarations.

Q miniboss declarations own the room-level sparse rarity override. Its Rare
check is guaranteed, so a retained Common Q miniboss option is an invalid but
repairable authored value while Rare and later supported checks remain
candidate outcomes. The same offer-local ledger consumes an exact boosted Q
Shop-item witness rather than inferring rarity from the Q profile.

The canonical baseline retains the progressed-save summit maps, stage pools,
physical door order, Typhon miniboss rewards, Shop lifecycle, and completion
counters. Q binds exact concrete encounter definitions for its rooms, but no
Q Encounter Set contains a supported field-NPC member. Weighted room-set
replay, external profile conditions, natural Chaos, optional actions,
combat-wave details, and NPC event or interaction variants remain deliberately
outside the product until they have explicit catalog and authored-state
ownership.

In particular, the source-backed final-Preboss forced Hermes delivery remains
unimplemented. When that feature enters scope, its concrete pickup and the
World Shop purchases must share the occurrence's one action chronology. A
delivery before a purchase may change the exact Travel Deal or Gold Gold Gold
payload frontier—for example by locking a fourth god into the pool—while a
delivery after that purchase cannot alter an already-generated payload.
