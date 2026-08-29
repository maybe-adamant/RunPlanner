# Room Feature Availability and Resource UX Plan

## Status

- **State:** locked and ready for implementation
- **Locked:** 2026-08-28
- **Base commit:** `c049685f`
- **Delivery shape:** two reviewed implementation gates followed by closure in
  Gate B

This is a temporary implementation plan. It is intentionally absent from the
project README and durable documentation map. At completion, retain the stable
editor ownership decisions in `docs/design/EDITOR_MODEL.md`, record delivery in
`docs/progress/IMPLEMENTATION_PROGRESS.md`, and delete this file.

## Objective

Make room-feature controls state what the planner already knows before an edit
is attempted. A room feature must be omitted when its declaration can never
host that feature, remain visible but disabled when the exact run prefix makes
it temporarily unavailable, remain removable when it is an optional authored
feature, and remain checked but non-removable when the game forces it.

The same change must make successful resource-element placement truthful.
Resource controls may retain checkbox presentation, but must disclose their
route-wide uniqueness, exact element outcome, and any relocation of an existing
successful point.

The user-visible result is:

| Semantic state                                                                             | Presentation           |
| ------------------------------------------------------------------------------------------ | ---------------------- |
| Room has no structural feature capability                                                  | Control omitted        |
| Optional feature is structurally supported and currently eligible                          | Unchecked and enabled  |
| Optional feature is structurally supported but temporarily unavailable or not yet assessed | Unchecked and disabled |
| Optional feature is authored                                                               | Checked and removable  |
| Feature is forced by the game                                                              | Checked and disabled   |

An optional authored feature that later becomes context-invalid remains
visible and removable. The editor never silently deletes retained authored
state merely because an earlier route edit changed its assessment.

## Owning Authorities

- Natural Chaos, Spark of Ixion, and Zagreus Contract facts:
  `docs/audits/rooms-and-routes/ROUTE_DETOUR_FINDINGS.md`
- Resource elements, placement envelopes, Shrine spacing, and Well spacing:
  `docs/audits/room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md`
- Authored occurrence and retained-invalid-state rules:
  `docs/design/AUTHORED_PROJECT_MODEL.md`
- Candidate, finding, and progressive evaluation ownership:
  `docs/design/SIMULATION_AND_VALIDATION.md`
- Room-feature presentation and interaction ownership:
  `docs/design/EDITOR_MODEL.md`

This plan does not reopen those game facts. If implementation contradicts an
authority, stop and amend the plan instead of encoding a new rule in React.

## Current-Code Audit

### Natural Chaos and Spark of Ixion

`naturalChaosSpawnAuthoringEligibility` currently answers only static topology
questions: whether the occurrence is on the selected spine and whether a
natural or Spark Chaos exit already conflicts at that source. The workspace
turns that boolean directly into the Chaos checkbox's disabled state.

The ten-room natural-offer spacing rule is evaluated later in normal-target
generation, after a natural Chaos exit has already been authored. The resulting
finding is correct for retained invalid state, but the editor therefore permits
an ordinary click that it already has enough reached-prefix information to
disable.

Spark remains a distinct authored `sparkChaos` additional exit. Its forced
semantics must not be collapsed into natural Chaos in the engine, even though
the room feature presents both as one player-facing **Chaos Gate** row.

### Zagreus Contract

The workspace currently exposes the contract Add action whenever a selected
Midshop has materialized Shop state and has not already authored its local
contract exit. That surface does not distinguish a contract-capable Midshop
from a later Midshop after entered `C_Boss01` has consumed the run allowance.

The durable rule is entry-consumed: an offered but unentered contract does not
consume the allowance, while entering `C_Boss01` does. An absent contract at a
later consumed Midshop has no useful authoring action and should therefore be
omitted, not shown as a temporary-spacing disabled control. A retained authored
contract remains visible and removable if an earlier edit makes it invalid.

### Stygian Wells and Hermes Shrines

The engine already publishes entry-frontier placement assessments for Wells and
Shrines, including `eligible`, `forced`, and recent-placement evidence. The
workspace already carries `placementEligible`, `required`, and `present`, but
feature inclusion and checkbox mutability are not expressed through one exact
presence state.

Well inclusion already consults declaration support. Shrine inclusion can
currently disappear when both authored state and an evaluator assessment are
absent, even if the room declaration structurally supports a Shrine. Both must
follow the same declaration-first visibility rule:

- declaration support determines whether an absent control can exist;
- entry assessment determines whether that absent control is enabled;
- authored optional presence remains removable;
- forced Postboss presence remains checked and non-removable.

### Successful Resources

The resource projection already distinguishes `add`, `remove`, and `move`.
`ReplaceResourcePlacement` stores one route-wide placement per resource family,
so selecting an unchecked family in a second room replaces the prior placement.
The current React row renders all three actions as the same unlabeled checkbox
and hides that relocation.

The catalog already declares each resource family's element through
`resourcePointSupport.rules[family].element`. Presentation must consume that
fact rather than duplicate the Pickaxe/Fire, Exorcism/Air, Shovel/Earth, and
Fishing/Water mapping in React.

## Locked Product Decisions

### 1. Feature presence is a derived application product

Do not add feature-presence state to the authored schema. The persisted facts
remain the existing optional feature state and additional exits. The engine
continues to own feature-specific structural and contextual assessments; the
application adapts those products into one small presentation vocabulary.

The application contract may use a closed discriminated presence state rather
than combinations of `present`, `required`, `placementEligible`, `action`, and
optional interaction keys. It must express only the concrete states consumed
by Chaos, Contract, Wells, and Shrines:

- optional absent and enabled;
- optional absent and disabled;
- optional present and removable; and
- forced present and locked.

Structural absence is represented by omitting the feature product. Resources
do not consume this presence product because their route-wide `move` semantics
are materially different.

### 2. Unassessed optional placement is disabled

When the room declaration supports a feature but progressive evaluation has
not reached the feature's exact entry frontier, retain the row and disable the
unchecked control. Do not guess eligibility from room category, authored depth,
or React-local history. Existing authored optional state remains visible and
removable even when its current prefix is unassessed.

### 3. Natural Chaos is assessed before creation

Publish an engine-owned natural-Chaos placement capability at the reached
source occurrence. It must consume the same declaration, exact entry history,
source requirements, physical capability, target-domain support, and ten-room
offer-spacing facts used by normal-target evaluation. There must be one primary
rule owner; do not copy the spacing scan into a candidate adapter or workspace
projection.

The resulting UI behavior is:

- no natural-Chaos declaration/capability: omit the optional control;
- reached and eligible natural source: unchecked and enabled;
- structurally capable but too soon or unassessed: unchecked and disabled;
- authored natural gate: checked and removable, including retained invalid
  state; and
- authored Spark gate: checked and locked under the same **Chaos Gate** label.

Spark continues to bypass natural spacing and consumes its modeled Well item at
the first capable host. This plan changes only how the already-authored forced
gate is presented; it does not turn Spark into a natural gate or make it
user-removable.

### 4. Zagreus availability is entry-consumed

Publish an engine-owned Contract placement assessment at a reached Midshop
entry. It must use entered `C_Boss01` history rather than offered-contract
history.

- Contract-capable, materialized, eligible Midshop: show unchecked and enabled.
- Earlier contract offered but not entered: a later eligible Midshop can still
  show unchecked and enabled.
- Earlier `C_Boss01` entered: omit an absent later Contract control.
- Authored local Contract: show checked and removable even if later assessment
  is invalid after upstream edits.
- A room without a declaration-owned Contract destination never shows the
  control.

This is a consumed terminal state, not a temporary-disabled state.

### 5. Wells and Shrines share presence language, not policy

Reuse the existing feature-specific placement assessments. Do not introduce a
generic engine feature registry or generic spacing evaluator.

- Ordinary declared host, eligible: unchecked and enabled.
- Ordinary declared host, spacing-blocked or unassessed: unchecked and
  disabled.
- Optional authored Well/Shrine: checked and removable, even when retained
  invalid.
- Forced Postboss Well/Shrine: checked and locked.
- Room without the relevant declaration support and without retained authored
  state: omitted.

Inventory, Travel Deal, purchase, interaction, delivery, and item-effect
behavior are unchanged.

### 6. Resources retain checkboxes but disclose route-wide allocation

Resource labels describe the configured outcome rather than the mutation:

- `Successful Mining — Fire`
- `Successful Spirit — Air`
- `Successful Seed — Earth`
- `Successful Fishing — Water`

The exact label/element pair must be projected from catalog resource rules and
the existing application label vocabulary, not hard-coded in the component.

The Resources group includes concise explanatory copy:

> Each successful element outcome can be placed once across the route.

For an internal `move` action, the row additionally identifies the current
placement and states that selecting this room moves it here. The current room
is a semantic navigation link to its occurrence workbench. `add` and `remove`
do not show relocation copy. Disabled illegal targets remain disabled and do
not mutate the prior placement.

No confirmation dialog is added. The stable checkbox statement, route-wide
explanation, explicit current location, move disclosure, and existing undo are
the complete safety treatment.

## Ownership and Data Flow

### Catalog

No catalog schema or declaration change is expected. Existing room additional-
exit declarations, Shop/Shrine declarations, physical anchor facts, resource
family support, and resource element rules remain authoritative.

### Planner engine

The engine owns exact reached-prefix placement facts for natural Chaos and the
Zagreus Contract, alongside the existing Well/Shrine candidate capabilities.
The most local existing chronology/candidate-artifact seam should publish these
facts. It must return complete explicit products; no module registration,
sidecar identity map, or React-facing labels are permitted.

Static authored commands retain their structural validation. Context-invalid
authored state remains representable and is still reported by simulation
findings. The new capability prevents ordinary supported UI interactions from
creating a known-invalid feature; it does not make the authored command layer
run a hidden full simulation.

Resource placement commands and authored state do not change.

### Planner application

Structured-workspace source indexing carries the new engine capabilities to the
exact occurrence assembly. Occurrence feature assembly owns the application
presence state and omission rules. Interaction binding publishes intents only
for mutable states and must fail loudly if a supposedly mutable row lacks its
bound semantic interaction.

Resource occurrence projection adds the declaration-owned element and the
current placement's semantic navigation target when the action is `move`.
Marker/navigation composition resolves the destination; React does not search
the project for the prior occurrence.

### React

React renders the closed presence state and resource-placement presentation.
It does not inspect room declarations, count prior rooms, detect entered
`C_Boss01`, calculate spacing, infer forced state, or locate an earlier resource
placement.

## Delivery Gates

### Gate A — Room-feature availability vertical slice

**Commit boundary:** one coherent feature-availability foundation commit.

Deliverables:

1. Add exact reached-occurrence natural-Chaos and Zagreus Contract placement
   capabilities at the existing engine evaluation/candidate-artifact seam.
2. Reuse the normal-target Chaos rule owner so source capability, requirements,
   target domain, and offer spacing cannot diverge between pre-authoring
   availability and retained-state findings.
3. Preserve the Contract distinction between offered and entered `C_Boss01`.
4. Carry the capabilities through project source indexing.
5. Replace loose feature-presence boolean combinations in the application
   contract with the smallest closed state needed by the four concrete feature
   families.
6. Adapt Chaos/Spark, Contract, Well, and Shrine occurrence feature assembly to
   that state.
7. Render the complete omitted, enabled, disabled, removable, and forced
   feature behavior in React in the same gate. Natural and Spark exits share
   one **Chaos Gate** checkbox language while retaining distinct underlying
   semantic interactions.

Primary tests:

- `packages/planner-engine/test/simulation/route-detours.test.ts` owns the
  natural/forced Chaos spacing and Contract entry-consumption matrix.
- Existing Well and Shrine simulation tests retain their placement matrices;
  add only representative capability-contact assertions where needed.
- `apps/planner/src/projections/structured-workspace/source-index.test.ts`
  witnesses exact occurrence capability transport.
- `apps/planner/src/projections/structured-workspace/assembly/occurrence-features-assembly.test.ts`
  owns the closed presence-state projection matrix.
- `apps/planner/src/ui/editor/biome/DecisionWorkbench.test.tsx` owns natural
  Chaos, forced Spark, and Contract workflows.
- `apps/planner/src/ui/editor/biome/StygianWellWorkbench.test.tsx` and
  `HermesShrineWorkbench.test.tsx` own optional, blocked, and forced checkbox
  presentation.

Acceptance:

- an eligible natural Chaos source publishes mutable optional presence;
- a source within the ten-room natural window publishes disabled optional
  presence without requiring an authored invalid gate;
- an authored Spark publishes forced locked presence;
- entered `C_Boss01` consumes later absent Contract authoring while an unentered
  offer does not;
- forced and spacing-blocked Well/Shrine states use the same application
  presence language without sharing their engine policy;
- the corresponding React rows expose no presence-mutation command when the
  projected state is disabled or forced;
- clicking an enabled natural Chaos control cannot immediately produce the
  known “too soon” finding;
- structurally capable but temporarily blocked controls remain visible and
  disabled, forced controls remain checked and locked, structurally impossible
  and consumed absent Contract controls are omitted, and retained invalid
  optional features remain removable; and
- no authored codec, catalog version, or persistence migration changes.

### Gate B — Resource disclosure and closure

**Commit boundary:** one editor presentation and closure commit.

Deliverables:

1. Render declaration-derived successful-resource labels and the route-wide
   uniqueness explanation.
2. For resource `move`, show the current placement, explain relocation, and
   navigate to its occurrence; retain the existing semantic replacement command
   and undo behavior.
3. Update `docs/design/EDITOR_MODEL.md` with the stable presence and route-wide
   resource presentation policy, update the durable progress record, and delete
   this temporary plan.

Primary tests:

- `apps/planner/src/ui/editor/biome/BiomeInspectorControls.test.tsx` owns
  resource labels, add/remove/move presentation, relocation disclosure,
  navigation, semantic edit count, and undo.
- Keep one representative application/product-loop witness if navigation or
  interaction composition crosses the existing component boundary; do not
  duplicate every feature matrix at product level.

Acceptance:

- all four resource rows use the declared successful-outcome element labels and
  the group discloses route-wide uniqueness;
- `add` and `remove` retain one semantic edit and ordinary undo behavior;
- `move` alone exposes the prior occurrence navigation link and relocation
  explanation before mutation;
- an illegal target remains disabled and cannot replace the prior placement;
- resource movement cannot occur without visible disclosure of the prior
  location and relocation effect; and
- no resource uniqueness or element-mapping policy is reimplemented in React.

## Verification

During implementation, use the narrowest owning tests named by each gate. Run
one bounded verification pass after review remediation. Because Gate A changes
shared engine evaluation products and Gate B changes cross-layer application
wiring, phase closure runs the complete repository gate once:

```text
npm run check
```

Do not rerun the full gate merely to obtain duplicate review evidence. Record
the truthful closure result in `IMPLEMENTATION_PROGRESS.md`.

## Review Against Overengineering

The implementation must be challenged against these constraints:

- No generic room-feature engine, registry, plugin system, or policy table.
- No persisted presence state, compatibility field, or schema migration.
- No second Chaos spacing calculation in application code.
- No room-category inference for feature capability.
- No React lookup of route history, prior feature occurrences, or current
  resource placement.
- No automatic deletion of retained invalid optional features.
- No confirmation-dialog framework for Resources.
- No changes to Well/Shrine inventory, purchases, Travel Deal, delivery, or
  effect expiration.
- No changes to resource point probabilities, failed rolls, meta-resource
  yields, or the successful-placement abstraction.
- No expanded Purging Pool, Nemesis, encounter, or reward-editor work.

Every new production type or module must have a concrete consumer and a named
primary test above. Prefer extending existing candidate artifacts, source
indexing, occurrence feature assembly, and feature UI neighborhoods over
creating new generic `feature`, `availability`, or `services` subsystems.

## Closure Checklist

- [ ] Gate A implementation and focused tests complete.
- [ ] Independent Gate A review findings resolved once.
- [ ] Gate A committed.
- [ ] Gate B implementation and focused tests complete.
- [ ] Independent Gate B review findings resolved once.
- [ ] Final bird's-eye diff review confirms no duplicated policy or superseded
      path remains.
- [ ] One complete `npm run check` closure gate passes.
- [ ] Stable editor policy absorbed into `EDITOR_MODEL.md`.
- [ ] Durable delivery result recorded in `IMPLEMENTATION_PROGRESS.md`.
- [ ] Temporary plan deleted and Gate B committed.
