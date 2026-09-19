# Dream Dive content and availability

## Status and delivery boundary

- Status: locked by user approval; Gates A–C complete and independently reviewed;
  A/B committed as `29922aee` and `b2345df4`; Gate D in progress; Gate E pending.
- Base: planner `daca6903`; downstream game module `26c2feb`.
- Input: `docs/investigations/DREAM_DIVE_SCOPE.md`, reassessed after route
  foundation closure. The completed foundation is not reopened.
- Plan and reassessment committed as `c57e1667` before implementation.

## Objective

Make internal Dream itineraries obey native content availability and timed-drop
rules through the existing catalog and engine authorities. Ordinary routes keep
their current behavior. The application reflects engine-owned availability;
it does not decide Dream legality.

This phase prepares correct authoring products but does **not** enable public
Dream creation, loading, recovery or publication. Tests may construct internal
Dream projects through existing supported engine entry points.

## Scope and locked decisions

1. Disable G Anomaly support and resource placement in Dream.
2. Add World Shop Dream inclusion/exclusion rules, independent of existing
   ordinal first/second-half inventory.
3. Exclude Spark of Ixion, Plentiful Forage and Discovery in Dream through
   declaration-owned requirements.
4. Preserve Fateful Twist's existing catalog whitelist: Ixion is absent in
   **every** route. This is verification, not new Dream-specific plumbing.
5. Apply Dream boss timed-drop deferral through Supply Chain's existing clock.
6. Cover existing terminal-preboss Hermes maturity without changing its policy.

Route identity comes from the saved route/resolved context. Do not introduce
an `ordinary` route abstraction, persisted mode flag, ambient context registry,
new scheduler or generalized rule engine. Existing distinct requirement domains
may consume the same narrow route fact without being merged into one framework.

Preserve structurally representable context-invalid choices and provide their
existing repair paths. Mode restrictions apply to both selected assessment and
candidate support. No silently clearing authored choices, candidate-only bans,
or UI-only guards. An unavailable resource cannot contribute elements or force
a resource host through an internal execution-policy product.

### Source facts, not global bans

| Native fact                                                                                                                              | Required planner treatment                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `RoomData.lua:AnomalyDoorRequirements` excludes Dream.                                                                                   | Extend G takeover availability, not Chaos or Zagreus topology.                                                                 |
| `RunLogic.lua:656–744` excludes Dream from resource setup.                                                                               | No supported tool/fishing placements. Keep Meta Reward Stands' separate exclusion separate; do not invent a new stand feature. |
| Ordinary Shop group 2 removes Ashes/Bones/Nectar and adds four individual elemental boosts (`StoreData.lua:260–268`).                    | Conditional option membership on the existing profile, including Travel Deal generation.                                       |
| I/Q Shop group 5 replaces Nightmare/Moon Dust/Obol Points with ElementalBoost (`StoreData.lua:405–446,538–579`).                         | Mode requirement on shared options, composed with existing ordinal rules.                                                      |
| Boosts already have acquisition-owned element contributions.                                                                             | Reuse settlement; individual boost = +1 matching element, ElementalBoost = +1 each.                                            |
| Ixion, Plentiful Forage and Discovery declare Dream exclusions in `TraitData_Store.lua`, `TraitData_Demeter.lua`, `TraitData_Chaos.lua`. | Apply restrictions at their existing Well/trait eligibility contacts. Preserve independent conditions.                         |
| `ConsumableData.lua:RandomStoreItem.UseFunctionArgs` omits Ixion.                                                                        | Retain declaration whitelist and selected/candidate concordance. No fabricated Twist-to-Ixion acquisition case.                |
| `TraitLogic.lua:CheckChamberTraits` defers due DropResources in Dream-flagged rooms to interval−1.                                       | Resolve the room restriction against route identity and reuse producer deferral. Bosses are not generally non-counting.        |

World Shop exclusions do not remove metaprogression rewards globally from
doors, optional rewards, Wells, Twist or Shrines. Natural Chaos remains governed
by its existing local requirements. No executor/native spawn interception is
needed for these rules.

## Ownership and governing authorities

Before engine work read `docs/design/SIMULATION_AND_VALIDATION.md` fully.
Relevant specialist authorities:

- `CATALOG_MODEL.md`: Requirements and Closure Obligations; Routes, Layouts
  and Rooms; Rewards and Acquisitions; Traits, Loadout and Supported Effects.
- `REWARD_MODEL.md`: Shops; Offer and Acquisition; Validation Boundaries.
- `ROOM_LIFECYCLE_MODEL.md`: Counter and Cache Timing; Operations, Effects,
  and Events; lifecycle structure and derived authoring timeline.
- `CANDIDATE_EVALUATION_MODEL.md`: exact artifact boundaries and application
  boundary; candidates must consume the same reached context as assessment.
- `docs/audits/rooms-and-routes/ROUTE_POSITION_GAME_DATA_AUDIT.md` and the
  source references in the focused investigation.

Catalog owns mode-sensitive facts and normalization. Engine owns normalized
contracts, explicit context propagation, predicates, findings, retained repair,
resource policy and lifecycle transitions. Application projections adapt those
products; React renders unavailable controls using existing conventions.
The authored itinerary and current persistence shape remain authoritative.

## Gates and intended commits

Each implementation gate is a complete vertical slice, including its consumers
and primary tests. Do not land unused context plumbing for a later gate.

### A — Route-aware Anomaly and resource availability

Starting points:

- Catalog `declarations/layouts/g.ts`, `declarations/resources.ts`, relevant
  layout/room compiler contracts.
- Engine `requirements/model.ts`, `requirements/evaluator.ts`,
  `authored-project/route-context.ts`, `simulation/resources.ts`,
  `simulation/generation/first-target-takeover.ts`.
- Existing resource/Anomaly authoring projections and interaction bindings.

Add the smallest declaration-driven route requirement needed by these real
consumers. Route identity must survive exact candidate contexts, not be
reconstructed from a biome name. Resource authoring exposes unavailable support
to the application; retained-invalid resource values still have a way to clear.
Do not force resource suppression everywhere in the game: native Dream setup
already suppresses hosts. The planner must simply emit no illegal force/effect.

Acceptance:

- Same eligible G situation: Anomaly supported ordinarily, unavailable in Dream;
  a retained selection is assessed consistently with its candidates.
- Natural Chaos remains supported where otherwise legal.
- Dream resource placements have no legal targets/effective element grants or
  force dispositions; a retained placement is reported and removable.
- Ordinary resource protection envelopes, including N side rooms, are unchanged.
- Representative projection/UI witness reflects engine availability without
  opening public Dream admission or duplicating route policy in React.

Primary tests: catalog normalization, engine resource and G takeover suites;
one application interaction witness at the existing consuming boundary.

Delivered: narrow `excludedRouteKeys` declarations and catalog reference closure;
existing engine assessment owns both candidate and selected restrictions.
Existing application projections already retain unavailable resource removal,
so no production React change was needed. No generic requirement context was
added for these route-only checks.

Verification: six focused files / 60 tests and catalog/engine/application
typechecks passed. Independent review's Anomaly-witness gap was corrected with
an otherwise-eligible internal Dream G project, unmodified catalog and ordinary
control; targeted reviewer verification passed 9/9. Formatting and diff checks
passed. Gate A delivered in its dedicated implementation commit.

### B — World Shop mode-sensitive inventory

Starting points: catalog `declarations/rewards/shops.ts`, reward compiler;
engine reward requirements/facts and `simulation/rewards/shop/`.
Existing ordinal reaches reward chronology through `routePosition.ordinal`.

Apply inclusion/exclusion to existing option declarations. Keep ordinary,
Clockwork and Summit profiles and their slot identities. Reuse element
acquisition settlement. Thread the route fact to initial inventory and exact
post-purchase Travel Deal generation, not a guessed room-entry context.

Acceptance:

- Owning catalog/kernel matrix covers ordinary versus Dream membership for
  normal/I/Q shops, independently of first/second-half ordinal.
- Representative internal Dream purchase produces correct element history and
  candidate support; an I/Q case proves all-four ElementalBoost settlement.
- Travel Deal uses the same mode-correct pool at its existing generation point.
- Retained excluded offers yield repairable findings; unrelated door/minor
  rewards, Shrine items and Contract inventory do not inherit this exclusion.

Primary tests: catalog `reward-shops.test.ts`, engine reward-kernel behavior
and Shop purchase chronology. Do not duplicate the full membership matrix in UI.

Delivered: declaration-owned `routeKeyEquals` requirements with catalog route
reference closure; reward facts carry the saved source route to initial Shop
inventory and captured Travel Deal generation. Existing element settlement is
unchanged. Run State's exhaustive requirement-copy renderer recognizes the new
predicate without owning eligibility.

Verification: five focused files / 95 tests passed. Independent review's
refill-witness correction now uses the settled purchase branch and asserts its
captured use record; both Dream contact tests passed again after remediation.
The Dream witnesses use command-built authored state, materialization and
production reward facts at the Shop contact, not a bypass of preboss eligibility
in full-route simulation. All three workspace typechecks, changed-file lint,
formatting and diff checks passed. No schema, protocol or fixture changes.

### C — Well and trait exclusions; Twist verification

Starting points: catalog `declarations/rewards/shops.ts`,
`declarations/traits/demeter.ts`, `declarations/traits/chaos.ts`; engine
`catalog-schema/traits.ts`, trait requirement consumers and
`simulation/commerce/stygian-well.ts`.

Well eligibility currently handles its own conditions rather than generic Shop
requirements. Ensure the declared Ixion route requirement is actually consumed
by initial assessment, Travel Deal refill and captured candidates. Extend this
existing contact; do not create a parallel Well legality system.
Trait selected validation and candidates consume the same supplied route fact,
including Chaos blessing alternatives. Preserve Forage's existing conditions.

Acceptance:

- Ixion remains available ordinarily where otherwise legal, unavailable in Dream
  for both initial and refill inventory, with consistent selected assessment.
- Forage and Discovery exclusions hold at selected and candidate contacts; a
  neighboring allowed trait remains selectable and existing restrictions remain.
- Twist result domain is derived from `nestedResultItemKeys`; current whitelist
  excludes Ixion in both routes and still admits an allowed resource outcome.
  Reuse existing coverage if sufficient; do not refactor Twist just for this plan.

Primary tests: Well/refill, trait eligibility/candidates and catalog normalization.

Delivered: declaration-owned Well and trait route exclusions, with exact route
context at acquisition/candidate/Embryo contacts and catalog reference closure.
Twist retains its existing all-route whitelist. Independent review passed.
Focused C tests passed; broad engine verification passed 2,037 tests initially,
with six stale Shop tests repaired by supplying their fixture's route identity;
both affected files then passed all 32 tests. Workspace typechecks and changed-file
lint passed. The catalog Forage expectation was updated; room snapshot hashes
predating C will be refreshed once with Gate D's room declaration changes.

### D — Dream boss Supply Chain deferral

Starting points: catalog boss room declarations and `compiler/rooms/core-facts.ts`;
engine room schema, `simulation/rewards/biome/lifecycle-transitions/encounter-end-effects.ts`
and `simulation/traits/history/transitions.ts:advancePickupProducerProgress`.

Declare the native Dream-only room restriction and resolve it alongside existing
unconditional `skipTimedDropResources`. Pass the resulting deferral to the
existing pickup-producer transition. Supply Chain is the only inspected trait
using this native DropResources mechanism; no bespoke trait-name clock is needed.

Acceptance:

- Native boss variants carry the appropriate declaration, including inherited
  variants; add Zagreus's currently missing unconditional deferral declaration
  from `RoomDataC.lua:55`, using the existing `skipTimedDropResources` field.
- Before threshold, a Dream boss advances progress normally. At threshold it
  holds at acquired interval−1, emits no pickup, then matures once at the next
  qualifying unrestricted encounter. Deferred progress persists across Postboss
  and biome transition without rescaling the acquired interval.
- Cover both acquisition intervals (seven and three) at the transition owner.
  The interval-three variant is acquired at ordinal four, so its deferral test
  must not invent a fifth biome or terminal Postboss. Cross-biome continuation
  uses the interval-seven variant; interval-three is a bounded clock contact.
- One lifecycle witness runs acquisition → due Dream boss → deferred state →
  next qualifying encounter → generated pickups with usable placement/targets.
- Ordinary boss maturity and unrelated automatic effects remain unchanged.

Primary tests: room normalization, producer transition and representative
cross-biome lifecycle workflow. No new scheduler, lifecycle checkpoint or executor hook.

### E — Coverage and closure

Add bounded coverage for existing terminal-preboss Hermes maturity:

- Dream final non-Q Preboss matures outstanding delivery.
- Final Q does likewise; Q earlier in the itinerary does not flush early.
- Test through existing delivery placement/acquisition products, not only counters.

Native non-Q uses `ShopRoomEvents` plus `AutocompleteSurfaceShopDelivery`; final
Q uses `SpawnHermesInPerson`. Both already align with the engine's resolved
terminal-preboss policy. No planner/executor behavior change is planned here.
If coverage reveals a genuine contradiction, report it and amend scope rather
than silently expanding this gate.

Review the complete diff for duplicated predicates, missing context contacts,
overbroad bans and stateful side channels. Run the complete `npm run check` at
phase closure after focused remediation is stable, plus any separately required
schema/fixture check only if those surfaces actually changed. Record truthful
results in the closure commit; do not repeatedly rerun broad gates for review.

Promote settled source facts to their existing owning audits and only new
cross-cutting contracts to design authorities. Remove this plan at closure.
Trim delivered content/lifecycle questions from `DREAM_DIVE_SCOPE.md`, retaining
its concrete unresolved public-authoring/runtime questions. Do not retire
unrelated plans or append a bug-fix narrative to several durable documents.

## Execution discipline and non-goals

Use the repository gate routine: one write-capable executor, bounded packets,
reuse across coherent remediation, independent review once a gate stabilizes.
Main session owns plan amendments, Git and closure. Focused tests run in the
owning lane; use internal Dream builders without bypassing public admission in
production. Fixtures must come from production builders and keep canonical
formatting; regenerate only semantically changed products.

No authored-schema or protocol bump is expected: these are catalog/context and
derived behavior changes, not new persisted choices. If implementation proves
a wire/persistence change necessary, stop and amend the plan before migration.
Do not change downstream protocol, fixtures or game module merely to enable
tests of an intentionally unpublished Dream route.

Excluded: public Dream project creation/itinerary legality UI, import/recovery
admission, publication, native Dream startup/transition steering, combat scaling,
Dream Points economy, new element settlement, generic event buses, and unrelated
catalog cleanup. Opening/NPC/Postboss foundation remains as delivered.
