# Fresh File — rewards outline

Status: design outline, not a locked delivery plan or schema approval.
The [viability investigation](FRESH_FILE_PROJECT_VIABILITY.md) owns the complete
reward-pool and shop-slot evidence tables; do not duplicate their inventories.

## Outcome

Offer only rewards reachable in the first attempt, including unlocks reached
during that attempt. Preserve native bag pressure and source-specific rules.

## Settled profile and first-offer contracts

Select Fresh File-specific MetaProgress, RunProgress and world-shop profiles,
fed into the same bag/inventory/requirement machinery as mature profiles.
Keep the mature declarations clean rather than adding Fresh File exceptions
to each existing entry. Reuse unchanged entries where appropriate. Generic
gain/history accounting does not itself decide what those facts unlock.

Fresh File WorldShop omits Armor. An inventory group with no eligible candidates
emits no item; the Tartarus resource group yields no fifth item, not a blank
editable slot or replacement reward.

Reuse existing core-offer eligibility and rarity validation. Under Fresh File
with no core boons at all, exclude Apollo Special/Cast and restrict the offer
to Common. Apollo is guaranteed first, so the remaining three core choices
produce the intended screen. Keep ordinary editing and outcome selection;
no fixed-offer model or read-only editor. Other core-offer rules and later
acquisition behavior remain unchanged. This is Fresh File integration work.

Fresh File Nectar grants its resource but no boon level. Native
`ConsumableData.GiftDrop.RunProgress` installs the level-up function only with
`WorldUpgradeGiftDropRunProgress`; `CreateConsumableItemFromData` applies that
upgrade condition. Do not remove eligible Fields Nectar merely because its
mature run-progress effect is absent.

Element placement is entirely disabled for Fresh File, including candidates,
authoring/readiness and exported placement instructions—not merely hidden UI.
Native element-drop entries in `LootData.lua` require
`WorldUpgradeElementalBoons`, as does the infusion unlock. This is not a request
to remove elemental classification metadata from ordinary boon declarations.

## Three change categories

### Fixed exclusions and offers

No hammers, excluded gods, Hermes, Hex/Path of Stars, Mystery Boons, Devotion
or infusions. The forced first combat offers Common Apollo with Nova Strike,
Blinding Rush and Lucid Gain; selection/acquisition remains ordinary trait
authoring after combat.

Shop Armor is absent, but Fields optional Armor is not globally banned.
Ordinary Nectar is absent, but Fields optional Nectar is allowed. Shop and
Fields Bones do not inherit the MetaProgress Ashes threshold.

### Dynamic consumers

The shared god-history contract is settled: mature projects start with all
relevant gods historically met, while Fresh File starts empty and accumulates
the same facts during authoring/simulation. The following are general consumers
of that history, not separate Fresh File shop or god-unlock algorithms.

- Hestia/Aphrodite unlock from qualifying Poseidon/Demeter use.
- World-shop gods intersect eligible gods with reached historical pickups,
  with native empty-intersection fallback. This does not change the current-run
  god cap or let shops bootstrap new gods after mandatory Apollo.
- MetaProgress Bones require five lifetime Ashes gained; later small/large
  entries switch at both 100 Ashes and 500 Bones, under their ordinal rules.
- Eligibility reads facts at generation. Preserve ineligible bag copies and
  normal refill/fallback behavior; do not rewrite an existing offered reward
  because resources were subsequently acquired.

Delivered: engine god-use and god-pickup history producers, with mature and
closed initialization.
Delivered: the Hestia/Aphrodite lifetime-use requirement and the shop
god/historical-pickup intersection with its empty-intersection fallback.

### Inventory shape

Ordinary WorldShop retains three nonempty groups. Fresh I_WorldShop has four
items: its resource group has no eligible candidate and no replacement major;
the engine's shop assessment reports that slot as valid-empty (see the Shops
section of `docs/design/REWARD_MODEL.md`). Poms and other surviving inventory
retain their existing conditions.

## Ownership and seams

Catalog owns source-local entries, requirements and group declarations, starting
with `declarations/rewards/shops.ts` and its compiler. Engine owns bag selection,
god candidates, generation snapshots, inventory assessment and acquisition.
Application adapts those products; executor receives their resolved inventory.

Engine history and resource-quantity products supply the facts; this document
owns why/when reward consumers read them.
[Rooms](FRESH_FILE_ROOMS.md) supplies bridge and first-combat producers.

## Settled god matrix

| God                | Fresh File rule                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Apollo             | Mandatory first reward in F_Combat01, with fixed Common offers and an editable picked outcome; ordinary rules afterward |
| Poseidon / Demeter | No additional Fresh File unlock condition                                                                               |
| Hestia / Aphrodite | Require prior use of either Poseidon or Demeter                                                                         |
| Other gods         | Unavailable in this profile                                                                                             |

Sources: the five `LootData_<God>.lua` declarations. Initial top-level
eligibility is not proof of a reachable door at every boundary; reward bags,
god-cap policy and offer generation still apply.

Poseidon's legacy forced offer is excluded from the Fresh File matrix.
`NarrativeData.lua:PoseidonUpgrade.InteractTextLinePriorities` places
`PoseidonFirstPickUp` first, ahead of `PoseidonLegacyBoonIntro01`.
`NarrativeLogic.GetRandomEligibleTextLines` returns the first eligible priority.
After the first interaction, the legacy dialogue's requirement of no
`CurrentRun.UseRecord.PoseidonUpgrade` fails. It therefore cannot force Common
Buried Treasure on either the first or subsequent first-run interactions.
`TraitData.LegacyGameStateRequirements` also explicitly removes the old legacy
dialogue prerequisite. Another forced Sea Star dialogue requires previous runs
and is likewise excluded. No live precedence probe is needed for this issue;
ordinary offer/rarity legality remains separate from this resolved exclusion.

This matrix is settled for design. Native god-cap, source-specific shop pickup
history and ordinary trait/rarity eligibility continue to apply. Live testing
should verify these contacts during delivery; it is not a prerequisite for
another god-order design round. No live probe is claimed here.

## Decisions needed before delivery

- Bind the Fresh File god matrix to its profile's generation consumers.
- Wire the first Apollo eligibility/rarity conditions into existing machinery.
- Bound the initial god pool: the Zeus/Hephaestus text-record gates are not
  declared, so a closed profile yields seven gods where the game allows three.
- Inventory exact bag/history consumers and compatibility implications.

## Representative acceptance cases

- Door offering does not unlock Hestia/Aphrodite; qualifying use does.
- Shop cannot introduce an unmet god after Apollo; mature shops remain unchanged.
- Threshold crossings alter later bag eligibility, retaining separate copies.
- Optional Armor/Nectar/Bones remain eligible despite restrictions elsewhere.
- Fresh Tartarus shop exports four items with no synthetic fifth reward.
- First Apollo offer cannot be moved into the opening/loadout.

Primary tests belong to catalog inventory/compiler and engine reward/history
owners, with representative shop/first-offer UI and executor witnesses.

## Unchanged

Ordinary Pom legality, god cap, duplicate prevention, bag refill/consumption,
ordinal rules and mature reward behavior, unless a concrete discrepancy emerges.
