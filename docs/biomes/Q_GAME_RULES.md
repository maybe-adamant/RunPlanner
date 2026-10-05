# Q Game Rules

## Scope and evidence

This document is the game-rule authority for Mount Olympus Summit (`Q`) under
the progressed-save static baseline. The shared cross-biome contract lives
in [`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md); Q
room declarations own its exact depth eligibility and physical exits.

The rules were checked against `RoomSets.lua`, `RoomDataQ.lua`, summit map
data, encounter data, `RunLogic.lua`, and `RoomLogic.lua` on 2026-07-18.

## Authored shape

- `Q_Intro` is the fixed authored start.
- Generated progression uses ordinary room eligibility at the reached
  `biomeDepthCache`. The six depth groups are not structural topology stages.
- Q's two-door rooms and miniboss rooms use ordinary batches with
  declaration-owned exit keys. A selected normal target remains the only
  editable traversal spine.
- `Q_PreBoss01` is a width-one atomic takeover Preboss that becomes eligible
  and required at `BiomeDepthCache = 7`. It owns a single Q World Shop
  occurrence and has no remaining free offer.
- Selecting the Preboss creates the ordinary `Q_Boss01` occurrence through a
  fixed link. Q has no modeled Postboss at route position four.

The width-one rule is physical: Q does not create an unpicked peer and does
not need a second offer owner. The Preboss occurrence is real authored state
and its shop inventory materializes on entry.

At depth 7 no ordinary room is eligible. The frontier instead evaluates the
same declaration-owned `Q_PreBoss01` eligibility and force used by other
Preboss takeovers.

## Eligibility and repair

Room eligibility is contextual. Compatible ordinary replacements keep their
stable occurrence owner and remain structurally representable even at the
wrong depth. Evaluation reports the unavailable target and retains the exact
candidate context for repair. A source-room change that makes an existing
physical target unavailable retains that target until explicit capacity
reconciliation; the repair command owns removal and downstream cleanup.

The planner represents possible and forced support, declaration-defined
history effects, concrete encounter selection, and physical door order. It
omits weighted RNG, unmodeled combat composition, NPC event/interactions,
natural Chaos, anomalies, and optional player interactions from the canonical
baseline.

## Exact depth groups

The ordinary room declarations own these `biomeDepthCache` ranges, each with
identical minimum and maximum:

| Depth | Eligible rooms                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------- |
| 1     | `Q_Combat10`, `Q_Combat11`                                                                                     |
| 2     | `Q_Combat03`, `Q_Combat05`, `Q_Combat15`                                                                       |
| 3     | `Q_MiniBoss02`, `Q_MiniBoss05`                                                                                 |
| 4     | `Q_Combat01`, `Q_Combat02`, `Q_Combat04`, `Q_Combat06`, `Q_Combat07`, `Q_Combat08`, `Q_Combat09`, `Q_Combat16` |
| 5     | `Q_Combat12`, `Q_Combat13`, `Q_Combat14`                                                                       |
| 6     | `Q_MiniBoss03`, `Q_MiniBoss04`                                                                                 |

Native `RoomDataQ.lua` declares `ForceAtBiomeDepth` for the fork and miniboss
groups. `RunLogic.lua:953` rejects those rooms outside that exact depth,
while `RunLogic.lua:906` supplies force priority. The planner normalizes the
supported ordinary sequence into exact eligibility without ordinary room
force. The available room set is unchanged; ordinary candidates have possible
support rather than forced pressure. `Q_PreBoss01` retains force because it
owns the atomic takeover. A consumer requiring native force provenance or
weighted selection would need that distinction restored explicitly.

First and second forks expose two physical doors; other declarations retain
their own one- or two-door facts. Selection follows the common normal-exit
contract. Fixed Boss declarations are completion rooms, never ordinary room
candidates.

Q ordinary batches own no Run/Meta base store. Rewardless combat preserves its
declared no-reward shape; miniboss declarations own their forced
`TyphonBossRewards` offer. That biome-local store still counts: each entered Q
miniboss adds one non-MetaProgress entry to the run-wide ratio's denominator.

Q's one rolled door is the boss door. Native applies the ordinary chance there
against Q's `0.15` target, so `Q_PreBoss01`'s outgoing boss link carries an
authored RunProgress-or-MetaProgress store decision, bounded by run-wide
support like any other batch store — on the Surface route that support reads
O's and P's entries plus Q's own, N being count-excluded. It is the only
Run/Meta store authored anywhere in Q. A selected Miniboss Room Occurrence contributes its
entered history before the next outgoing generation, while an unselected fork peer remains a
real offered occurrence. These differences are declaration-owned and are not
collapsed into a generic combat-reward UI state.

## Final Shop and declared completion

After the second miniboss room, entered-room history reaches the exact depth
where `Q_PreBoss01` takes over the final one physical normal exit. Its
width-one batch has only the entry-time `Q_WorldShop` occurrence and no
synthetic free reward. Selecting that occurrence closes the editable Q body
and creates the ordinary `Q_Boss01` occurrence through its fixed link.

`Q_WorldShop` filters its option entries from the entered-biome history at
entry: `enteredBiomes <= 2` admits first-half entries and `enteredBiomes >= 3`
admits second-half entries. Phase-independent entries remain available. The
first group still emits two distinct options without replacement after phase
filtering, while the five-group and six-slot shape remains fixed. The evaluator
supplies the resolved itinerary ordinal as `enteredBiomeCount`; ordinary Q
therefore retains its fourth-biome second-half inventory. Dream-specific item
membership remains separate from this shared phase rule.

Q miniboss declarations own the room-level sparse rarity override. Its Rare
check is guaranteed, so a retained Common Q miniboss option is an invalid but
repairable authored value while Rare and later supported checks remain
candidate outcomes. The same offer-local ledger consumes an exact boosted Q
Shop-item witness rather than inferring rarity from the Q profile.

The canonical baseline retains the progressed-save summit maps, depth groups,
physical door order, Typhon miniboss rewards, Shop lifecycle, and completion
counters. Q binds exact concrete encounter definitions for its rooms, but no
Q Encounter Set contains a supported field-NPC member. Weighted room-set
replay, external profile conditions, natural Chaos, optional actions,
combat-wave details, and NPC event or interaction variants remain deliberately
outside the product until they have explicit catalog and authored-state
ownership.

The source-backed Hermes deliveries forced at the Preboss of the fourth entered
biome are required pickups sharing the occurrence's one action chronology with
World Shop purchases; a Q Preboss reached earlier in a shorter Dream itinerary
does not flush, and the obligation carries into the Boss encounter; one still
pending when the planned route ends stays pending without a finding. A
delivery before a purchase may change the exact Travel Deal or Gold Gold Gold
payload frontier—for example by locking a fourth god into the pool—while a
delivery after that purchase cannot alter an already-generated payload.
