# Finding Navigation and Repair Ownership Audit

Status: complete current-code audit  
Audited base: `70d69e74` (`fix(fields): close spatial layout plan`)

## Question

When a planner finding is selected, does the editor preserve enough semantic
information to open the owning route and biome, select the truthful room on the
rail, open the correct inspector tab or dialog, and focus the narrowest repair
control? This audit also asks whether every declared finding still has a live
producer and whether its engine-owned origin is as precise as the available
repair surface permits.

The audit covers finding production, structured-workspace destination
assembly, transient editor navigation, and rendered repair controls. It does
not change finding severity or game rules, and it does not settle the separate
question of whether later authoring should be locked behind an incomplete
earlier point.

## Evidence inspected

- The closed 131-code `FindingCode` union in
  `packages/planner-engine/src/simulation/model.ts`.
- Every literal producer beneath `packages/planner-engine/src/simulation/`,
  including completeness, topology, Hub, Fields, encounter, reward,
  acquisition, Shop, Well, Shrine, Pool, Arcana, keepsake, level, trait, and
  Chaos settlement.
- The semantic address union and ancestry helpers in
  `packages/planner-engine/src/authored-project/addresses.ts` and
  `packages/planner-engine/src/simulation/progressive/finding-location.ts`.
- Preliminary marker redirects and tab assignment in
  `apps/planner/src/projections/structured-workspace/navigation/marker-builder.ts`
  and occurrence/Hub assembly.
- Final inspector and rail binding in
  `apps/planner/src/projections/structured-workspace/navigation/inspector-destinations.ts`.
- Finding selection, editor-session coordination, and inspector consumption in
  `ProjectFindings`, `editorSessionSlice`, `BiomeWorkspace`,
  `OccurrenceWorkbench`, and `HubDecisionWorkbench`.
- Existing destination, editor-session, inspector, dialog, Hub, side-room,
  Fields, and room-feature tests.

## Current destination product

The structured workspace already publishes one complete destination for a
finding origin. Depending on the owner, that product contains:

- the finding's semantic owner;
- a possibly redirected focus address and focus key;
- its route and biome;
- its containing frontier or node inspector;
- its visible rail stop, when one exists;
- its room or Hub tab; and
- its trait or level-resolution dialog target.

The distinction between owner and focus is intentional. A trait-child finding,
for example, remains owned by that child while its visible focus can be the
Room Timeline row that launches the containing trait editor. Rail ownership is
bound after the final presentation rail exists; it is not derived from address
shape or rendered order.

## Confirmed navigation defect

`ProjectFindings` looks up the complete destination, but dispatches only the
redirected focus address plus dialog targets. `findingSelected` then stores the
focus address as `focusedSemanticOwner`. `BiomeWorkspace` uses that redirected
address to perform a second destination lookup and derives the inspector, rail,
and requested tab from the second result.

That second lookup changes authority from the finding origin to its visible
focus target. Any rail, tab, or containment information that was meaningful
only on the original destination can be lost. This explains why navigation can
open the right content without highlighting its room on the rail.

The same path explains the same-occurrence tab defect. The room and Hub
workbenches correctly react when a newly requested tab differs from the prior
request. They do not receive the navigation revision. If a finding requests
the same tab as an earlier navigation, the user can manually leave that tab and
then click the finding again; the request value has not changed, so the local
tab state wins. The reducer already increments `semanticNavigationRevision` on
every finding click, including repeated clicks, but the workbenches do not use
that signal.

The correction is therefore not a new navigation model. The selected finding
origin must remain the authority for inspector, rail, tab, and dialog context;
the destination's focus address remains responsible only for marker focus and
scroll. Repeated navigation must carry the existing revision to the containing
workbench.

## Finding-origin audit

Of the 131 declared finding codes, 127 have live engine producers. The live
producers fall into four repair dispositions.

| Disposition                   | Current result                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exact field                   | Reward, target, spatial point, acquisition, trait-child, level, Arcana, keepsake-result, encounter, and room-action findings already use a semantic leaf that can own one control or dialog.                             |
| Exact structural control      | Batch/store/selection/target, Hub membership and visit order, side-room generation, and occurrence creation or removal findings already use the smallest structural owner available.                                     |
| Truthful aggregate            | Biome topology, joint Shop offer support, duplicate-across-several-slots, and cardinality conflicts legitimately require a container rather than one fabricated field.                                                   |
| Imprecise Room Overview owner | A bounded set of resource, Fields capacity, Chaos, Well, Shrine, and Pool findings carries child identity only in evidence—or does not preserve it at all—while all such findings share an occurrence-level destination. |

The first three dispositions need navigation preservation, not new finding
semantics. The last disposition needs precise semantic ownership before React
can focus the correct field. `focusByOwner` is keyed by semantic address, so
two findings with the same occurrence origin cannot be routed to two different
rows even if their evidence contains different slot keys.

### Confirmed Room Overview precision gaps

| Finding family                                                                                        | Current origin/evidence                                                                                  | Narrowest truthful repair destination                                                 |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `resourcePlacementUnavailable`                                                                        | Occurrence origin; resource family exists only in evidence                                               | That resource family's successful-outcome checkbox                                    |
| `fieldsOptionalCapacityUnavailable`                                                                   | The Nemesis spatial-point address                                                                        | Fields optional-reward count in Overview; the point picker is not the invalid value   |
| `ixionChaosMissing`, `ixionChaosUnavailable`                                                          | Occurrence origin                                                                                        | The existing Chaos additional-exit control                                            |
| `stygianWellPlacementUnavailable`                                                                     | Occurrence origin                                                                                        | Stygian Well presence control                                                         |
| `stygianWellMissing`, `stygianWellWrongGroup`                                                         | One aggregate issue string; affected slot is discarded                                                   | The affected initial offer row; missing issues must retain one issue per missing slot |
| `stygianWellTravelDealRefillUnavailable`                                                              | Aggregate issue string                                                                                   | The Travel Deal refill row                                                            |
| `stygianWellTwistInvalid`                                                                             | Aggregate issue string; generation identity is discarded                                                 | The affected Mystery Item result row                                                  |
| `stygianWellDuplicate`                                                                                | Occurrence origin                                                                                        | Well inventory container, because the conflict spans at least two offers              |
| `hermesShrinePlacementUnavailable`                                                                    | Occurrence origin                                                                                        | Shrine presence control                                                               |
| `hermesShrineInventoryMissing`, `hermesShrineInventoryWrongGroup`, `hermesShrineInventoryRequirement` | Occurrence origin; slot key survives only in evidence                                                    | The affected Shrine offer row                                                         |
| `hermesShrineTravelDealRefillMissing`, `hermesShrineTravelDealRefillUnavailable`                      | Occurrence origin; generation survives only in evidence                                                  | The Travel Deal refill row                                                            |
| `hermesShrineInventoryDuplicate`                                                                      | Occurrence origin                                                                                        | Shrine inventory container, because the conflict spans both second-group offers       |
| `purgingPoolTraitMissing`, `purgingPoolTraitUnavailable`, `purgingPoolTraitDuplicate`                 | Occurrence origin; unavailable/duplicate slot survives only in evidence and missing slots are aggregated | The affected Pool offer row when one row owns the repair                              |
| `purgingPoolWrongCardinality`                                                                         | Occurrence origin                                                                                        | Pool inventory container                                                              |

`purgingPoolSaleUnavailable` is not part of this gap: it already uses the exact
Room Timeline action. Likewise, individual ordinary Shop offer failures use
`ShopOfferAddress`; only a joint unsupported Shop set remains occurrence-owned,
which is a truthful aggregate.

The Room Overview lacks a semantic address family for most of these controls.
Interaction keys and React row positions are not suitable substitutes: they
are application implementation details and cannot become finding owners. A
small occurrence-owned, discriminated room-feature target is warranted for
feature presence, resource family, Fields count, Well/Shrine generation, and
Pool slot/container identity. Chaos should reuse its existing
`AdditionalExitAddress` rather than entering that new family.

### Exact-address assertion gap

The workspace currently labels only a hand-maintained subset of semantic
address kinds as fine-grained. Live exact owners such as Nemesis event,
Natural Selection result, Crystal Figurine result, and postboss keepsake
selection can still resolve because a marker happens to exist, but they do not
receive the stronger exact-node assertion. The assertion should follow the
audited address disposition, including the new Room Overview feature targets,
so a later missing marker fails projection rather than silently inheriting a
biome fallback.

## Stale finding vocabulary

Four declared codes have no production source anywhere in the engine:

- `fieldsActionDependency`
- `fieldsActionInactive`
- `fieldsActionMissing`
- `echoShopDuplicateChildMissing`

They remain only in the type union and application copy/explanation switches.
The active Fields model now uses spatial, capacity, local-reward, and room-action
findings; the active Echo Shop duplicate path uses acquisition and Shop
settlement findings. These four codes are stale vocabulary and should be
removed rather than assigned speculative destinations.

## Complete vocabulary disposition

The audit enumerated all declared groups, not only codes observed in current
checkpoint fixtures:

- 13 completeness codes: 10 live structural/state codes and the three stale
  Fields action codes above;
- 9 room-generation codes: eight already exact and
  `resourcePlacementUnavailable` requiring a Room Overview leaf;
- 3 encounter-resolution codes: all exact encounter or phase controls;
- 52 reward-generation codes: ordinary rewards, Shop actions, Arcana,
  keepsakes, conversions, automatic effects, Nemesis, and deliveries are exact;
  the bounded Room Overview families listed above need refinement;
- 50 trait codes: 49 live trait-offer or trait-child destinations and the stale
  Echo code above; and
- 4 Pom/level codes: all exact level-resolution destinations.

No other live finding family requires a new field owner. The remaining
occurrence-, biome-, route-, and project-owned findings are genuine structural
or aggregate states, not omitted field pointers.

## Durable disposition

Finding navigation has two independent invariants:

1. The finding origin owns the complete navigation destination. Redirected
   focus is a child concern and must never be used to reconstruct inspector,
   rail, tab, or dialog context.
2. A finding uses the narrowest truthful semantic owner. One repairable field
   gets one leaf owner; a multi-field conflict gets its smallest real
   container; route/biome state does not acquire a fabricated room target.

The implementation may use representative witnesses for each address family.
It should not create a production registry of all finding codes or duplicate
the engine's finding matrix in application tests.
