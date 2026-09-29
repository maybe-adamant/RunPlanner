# Fresh File — shared infrastructure outline

Status: design outline, not a locked delivery plan or schema approval.
Source evidence and overall scope: [viability investigation](FRESH_FILE_PROJECT_VIABILITY.md).

## Outcome and boundaries

Support one closed first-run initial profile alongside the existing mature
baseline, using the same chronological simulation and eligibility machinery.
Infrastructure can land before Fresh File creation is exposed when it has a
complete producer-to-consumer slice and preserves existing project behavior.
Do not build an arbitrary save-state editor or parallel Fresh File simulator.

## Settled profile and god-history direction

Fresh File has its own project tag, `FreshFile`. Catalog conditions declare
restrictions and variants against that tag, including boss-option exclusions.
Projects without the tag retain their existing mature behavior; do not scatter
Fresh File policy through editor branches.

Enrich all projects with the same supported historical god-use/pickup facts.
Existing projects initialize those facts with all relevant gods already met;
Fresh File initializes them empty and fills them through the project's actual
interactions and acquisitions. These are derived initial/simulated facts, not
user-authored save-history controls.

Both profiles use the same consumers: shop generation reads historical pickup
facts, and Hestia/Aphrodite unlocks read qualifying god-use facts. An offered
door supplies neither fact. Keep the distinct native observations even though
the mature initial state satisfies both. Current-run god-pool membership remains
separate and is not prefilled by historical initialization.

## Required products and ownership

First prerequisite, before the other feature work: the general executor
encounter-binding audit/correction described in the encounter outline. Establish
semantic conflict exclusions, phase binding and shared selection/reload proof
for existing projects first; Fresh File then inherits that boundary. Do not
introduce a FreshFile-only permissive binding exception as a shortcut.

| Product                                 | Producer / owner                                                           | Consumers                                        |
| --------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| Closed initial progression facts        | Catalog declares supported facts; engine initializes the selected profile  | Loadout, room, reward and encounter requirements |
| Reached god use and pickup history      | Engine interaction/acquisition settlement, seeded from the initial profile | God unlocks and shop god filtering               |
| Resolved resource quantity on a pickup  | Catalog amounts/modifiers; engine production context                       | Acquisition settlement                           |
| Cumulative resource gains               | Engine acquisition settlement                                              | MetaProgress thresholds                          |
| Encounter occurrence/completion history | Existing preparation and completion boundaries                             | Introduction resolution and enemy eligibility    |

Mature projects already represent having met the relevant gods. That initial
history must not populate the current-run god pool, consume run encounters,
or masquerade as current-run pickups. Similarly, mature resource unlocks must
not be represented as invented spendable inventory. Pin the narrow fact
representation when designing the implementation.

## Current seams and required changes

- `packages/planner-engine/src/authored-project/route-context.ts` supplies route
  context; `simulation` already carries chronological state and history.
- Catalog declarations and normalization own thresholds, gain amounts and
  profile restrictions. Engine-owned normalized contracts expose only facts
  actually consumed by requirements; no generic Lua requirement interpreter.
- Reuse existing use/acquisition history when it matches the native fact.
  Keep offered, used, acquired, equipped and historically introduced distinct.
- Add actual Ashes/Bones gain accounting, not another interpretation of pickup
  counts. Spending does not reduce cumulative gains.
- Resolve resource modifiers at pickup production: Buried Treasure rounds each
  object independently; Double Up repeats its stored quantity at the second
  acquisition. Eris gifts follow their NPC exemption/non-duplication rules.
- Reuse the existing acquisition product/lifecycle rather than a UI-owned
  quantity cache. Inventory generation and delayed collection may see different
  player states; the product must retain the appropriate production facts.
- Export only products the executor needs to enforce the plan. Do not mirror
  the whole progression ledger into Lua merely to duplicate simulation.

## Dependencies and open decisions

Resource accounting is generic machinery. Fresh File-specific reward/shop
profiles own numeric unlock conditions; existing mature profiles retain their
current clean rules and need no invented resource baseline. This supersedes
the suggestion to add a separate historical resource-unlock representation.
God history remains initialized as agreed for mature versus Fresh File projects.

Conditional room forcing reuses existing requirement-based force declarations;
its Fresh File condition is integration work, not a new prerequisite mechanism.
The first Apollo offer reuses core-offer eligibility and rarity validation under
Fresh File with no core boons at all. There is no immutable-offer infrastructure
or read-only editor. Stable shop slots with derived valid emptiness are the
remaining shared inventory capability.

Rewards owns the exact god/history and threshold consumers. Rooms owns Eris
occurrence and gift production. First delivery resolves deterministic encounter
identities only; detailed enemy-introduction history and composition control
are deferred. Do not build state products solely for those deferred consumers.
These outlines must identify actual consumers before adding new state fields.

Still pin: initial-fact representation, pickup-quantity product lifetime,
affected codecs, and whether any persisted shape needs owner-approved migration.
No schema or protocol number is selected here.

## Representative acceptance cases

- Mature shop candidates stay unchanged while Fresh File shops cannot introduce
  an unmet god after Apollo; initial history does not fill the run's god pool.
- Offered god versus used god produces different unlock outcomes where native
  rules require use; selling a boon does not erase pickup history.
- Common Buried Treasure turns five Ashes into eight; duplication grants eight
  again. A later trait change does not retroactively modify the spawned pickup.
- Eris gains contribute to thresholds without receiving the ordinary bonus.
- Threshold crossing changes subsequent generation, not already-generated
  doors or inventories. Existing mature fixtures remain valid.

Primary tests belong to history, production/acquisition settlement and the
owning requirement consumers. Product tests retain representative workflows.

## Unchanged

One authoritative simulation, existing undo/redo and semantic commands,
source-local eligibility, and current mature-route authoring remain intact.
