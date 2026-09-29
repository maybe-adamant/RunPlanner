# Fresh File — loadout outline

Status: design outline, not a locked delivery plan or schema approval.
Evidence: [viability investigation](FRESH_FILE_PROJECT_VIABILITY.md), loadout
agreement and current planner seams. Foundation:
[shared infrastructure](FRESH_FILE_SHARED_INFRASTRUCTURE.md).

## User-visible outcome

A fourth creation choice, Fresh File, creates a fixed F → G → H → I project.
It is not an editable Underworld save-progression preset. The loadout clearly
shows its fixed starting conditions without presenting choices that cannot
exist on the first attempt.

## Agreed contract

- No weapon/aspect selection; the actual player has the fixed aspect-less staff.
  Represent absent selections without implying the player is unarmed.
- Zero Arcana, including automatic cards; zero Fear; no keepsake or familiar.
- No starting reward. Apollo belongs to the first combat, not the loadout.
- Initialize only `F_Opening01`, empty and rewardless, with `OpeningEmpty`.
- Keep configuration extent separate from fixed route order; reuse current
  route authoring rather than introduce a reorderable first-run itinerary.

## Current seams and ownership

- Catalog: fixed profile facts and allowable initialization.
- Engine: `authored-project/loadout.ts`, `defaults.ts`, `route-context.ts`,
  and `simulation/evaluation/project.ts`; real absence semantics and validation.
  Current default aspect/keepsake and null-starting-reward assumptions need
  explicit profile-aware treatment.
- Application: creation workflow and loadout projections render the engine's
  fixed state. Disabled controls must not conceal invalid mature defaults.
- Execution: `execution-plan/assembly/loadout.ts`, loadout codec and downstream
  decoder require an explicit representation decision. Preserve staff identity
  for any rules that consume it without inventing an authored aspect choice.

## Dependencies and decisions to pin

Settled ownership clarification: Fresh File disables weapon/aspect authoring
and may represent the selections as none. The executor owns native loadout
interpretation and conformance. The planner must still resolve the fixed staff
for weapon-dependent eligibility; absent selections must not imply an unarmed
player. This is wiring within the agreed fixed-loadout contract, not a reason
to introduce a weapon selector.

Shared profile initialization precedes creation UI. Rooms owns the next forced
combat; rewards owns its Apollo acquisition. Fresh File authoring should not
be enabled until those paths form a usable project.

Pin exact absent-selection encoding and compatibility before implementation.
Any authored migration requires explicit approval. Do not silently relax
mature loadout legality because Fresh File permits absence.

## Representative acceptance cases

- Creation yields the fixed route and genuinely empty loadout choices.
- Automatic Arcana do not activate from an empty selection.
- No starting-reward finding is emitted for a valid Fresh File project.
- Staff-specific trait legality still resolves correctly.
- Save/load, undo and export preserve the profile; ordinary project defaults
  and loadout editing remain unchanged.

Primary tests: engine defaults/codecs/validation; focused creation and loadout
projection tests; one creation-to-first-combat product witness.

## Excluded

Arbitrary progression, equipment/stat editing, save reset or certification,
and any executor conversion of a mature save into a fresh save.

## Compatibility inspection for delivery planning

Current authored schema is 89; execution protocol is 50. These are observations,
not proposed bump numbers. `authored-project/codec.ts` requires string weapon,
aspect and keepsake keys, validates their catalog membership and aspect/weapon
relationship. `startingReward: null` is already representable. Therefore
disabling controls alone cannot provide genuine absent equipment selections.
Defaults and `deriveRouteLoadout` also need the profile, not merely UI changes.

The owner explicitly approved one authored schema bump for this feature,
including nullable previously mandatory selections. Consolidate the feature's
persisted changes into that one migration, preserving existing projects' values
and behavior. Pin exact nullable fields and profile-dependent legality before
implementation; no fake equipment declarations or manufactured mature choices.
Route lookup, commands, defaults, simulation and projections must consume the
new contract. Initial history and resource gains remain derived. Ship the
migration through the existing app migration path and test mature round trips.
Additional authored bumps require separate approval.

Execution is a separate contract: TS `ExecutionRouteKey` and Lua
`mods/protocol/decoder.lua` enumerate only Underworld/Surface/Dream, and both
loadout codecs expect string equipment. FreshFile cannot be published to the
current executor unchanged. Pin the bilateral route/loadout and encounter-policy
wire extension and its version/re-export requirement in the plan; a protocol
change does not itself require migrating authored saves. Do not use catalog
version rejection as a substitute for approved authored migration.
