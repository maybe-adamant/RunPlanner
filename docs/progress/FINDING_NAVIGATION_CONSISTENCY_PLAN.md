# Finding Navigation Consistency Plan

Status: A/B delivered; Gate C implemented and reviewed, awaiting user approval.
Changes remain uncommitted pending user approval; Gate D is not started.

Original base: `70d69e74` (`fix(fields): close spatial layout plan`)

Amendment base: `11fc48c5` (`docs(planner): lock chronological authoring readiness plan`).
The separate chronological-readiness implementation was withdrawn; that plan
remains paused and is not part of this work.

Delivered navigation/repair commits: `646c2ca6`, `552f11b6`, and `be777898`.

## Objective

Make every finding click select the complete destination already published for
its semantic origin: route, biome, visible rail stop, containing inspector,
room or Hub tab, optional dialog, and narrowest truthful repair control.
Clicking the same finding again from another tab in the same occurrence must
reapply that destination.

The same resolved repair target must also receive the visible finding
highlight. Replace inline numeric finding badges with border styling attached
to that existing control or truthful container, without adding layout elements.

The evidence and finding-family disposition are locked in
[`FINDING_NAVIGATION_AND_REPAIR_OWNERSHIP_AUDIT.md`](../audits/editor/FINDING_NAVIGATION_AND_REPAIR_OWNERSHIP_AUDIT.md).
This plan contains only the resulting implementation actions.

## Scope

Included:

- preserve the selected finding origin as the authority for its complete
  structured-workspace destination;
- keep redirected focus responsible only for DOM focus and scroll;
- use the existing navigation revision to reapply same-finding tab requests;
- add exact semantic owners and markers for the audited Room Overview repair
  controls;
- retain aggregate destinations where more than one field owns the conflict;
- remove the four audited dead finding codes and their application copy; and
- strengthen exact-destination assertions for every live fine-grained address
  family;
- use the resolved destination's repair target for both navigation and
  highlighting, including findings redirected from a child to its containing
  action; and
- replace inline numeric markers with control/container border styling while
  retaining aggregate counts on navigation and the Findings panel.

Excluded:

- chronological authoring gating or a new authoring cursor;
- changes to finding severity, game rules, candidate support, persisted
  authored state, or schema;
- fabricating a field for biome-, route-, or aggregate findings;
- a production finding-code registry or one test per finding code.

## Ownership

- Planner engine owns finding codes and semantic origins. It introduces the
  narrow occurrence-owned Room Overview feature target needed for resource,
  Fields count, Well, Shrine, and Pool controls. Ixion findings reuse the
  existing Chaos `AdditionalExitAddress`.
- Application projection owns semantic containment, exact destination binding,
  room/Hub tabs, rail ownership, and grouping findings by the repair target in
  that same completed destination. It does not independently route badges.
- Editor-session coordination retains the selected finding origin and existing
  navigation revision. It does not store a copied workspace destination.
- React attaches finding styling and focus/scroll behavior to the existing
  target control/container. It does not infer containment from a finding code,
  evidence, or the tab where a shared value happens to be rendered.

## Gate A — Preserve complete click navigation (delivered)

Deliverables:

- Resolve inspector subject, selected rail stop, room/Hub tab, and dialog from
  the selected finding origin.
- Continue to use the destination's redirected focus address for the focused
  marker only.
- Remove the second lookup that treats the redirected focus address as finding
  navigation authority.
- Pass a finding-navigation request token derived from the existing
  `semanticNavigationRevision` to occurrence and Hub workbenches so an
  identical repeated tab request is reapplied.
- Leave ordinary non-finding semantic navigation unchanged.

Primary tests:

- Clicking a finding from another room selects its visible room rail stop and
  requested tab.
- Clicking the same finding after manually changing tabs switches back and
  focuses the same control.
- Repeating the click reuses the same destination while advancing the existing
  navigation revision.
- Trait and level findings still open their containing dialogs.
- A genuine coarse biome finding does not acquire a room highlight.

Intended commit: `fix(planner): preserve finding destinations`

## Gate B — Align Room Overview repair owners (delivered)

Deliverables:

- Add one closed, occurrence-owned Room Overview feature-target address with
  discriminated targets for:
  - resource family;
  - Fields optional-reward count;
  - Well presence, initial/refill offer, Mystery Item result, and inventory
    container;
  - Shrine presence, initial/refill offer, and inventory container; and
  - Pool offer slot and inventory container.
- Publish markers for those targets and wrap the matching Overview controls in
  semantic owner markers.
- Change only the audited finding origins:
  - resource placement and Fields optional capacity;
  - Well placement/inventory/refill/twist;
  - Shrine placement/inventory/refill; and
  - Pool trait selection/cardinality.
- Preserve per-slot or per-generation identity in Well and Pool assessment
  findings where the current assessment collapses it.
- Route Ixion missing/unavailable findings to the existing Chaos additional
  exit owner.
- Keep Well/Shrine duplicate and Pool cardinality conflicts on their real
  inventory containers.
- Extend the exact-destination assertion to the audited fine-grained address
  families, including Nemesis event, Natural Selection, Crystal Figurine,
  postboss keepsake selection, and the new feature targets.
- Remove `fieldsActionDependency`, `fieldsActionInactive`,
  `fieldsActionMissing`, and `echoShopDuplicateChildMissing` from the engine
  union and application presentation switches.

Primary tests:

- One representative finding for each new feature-target branch resolves to
  the correct Overview control, tab, occurrence inspector, and rail stop.
- A Well/Shrine duplicate and Pool cardinality finding focuses the feature
  container rather than one arbitrary row.
- Ixion focuses the Chaos additional-exit checkbox.
- Existing timeline purchase/sale findings remain on their action rows.
- Projection fails when a fine-grained live finding lacks its exact marker.
- Type checking closes the removed-code switches; no durable negative test is
  added solely to prove that historic codes do not exist.

Intended commit: `fix(planner): align finding repair targets`

## Gate C — One repair target and control highlighting

### Confirmed defect and current contacts

In the reported schema-78 save, `H_Combat05` (`golden-h-combat05`) has three
active optional rewards and `optional3` is null. Its missing definition already
navigates to Overview, but the numeric marker appears on the optional pickup
in Timeline. The repair is to define the reward, not take the pickup.

The current paths diverge:

- `navigation/marker-builder.ts` and `navigation/inspector-destinations.ts`
  publish the navigation destination. `ProjectFindings` consumes it.
- `ui/feedback/EvaluationFeedback.tsx` renders `SemanticOwnerMarker` from an
  independent origin-keyed findings lookup, with a selected-finding fallback
  for redirected focus.
- `assembly/occurrence-action-row-projection.ts` keeps `showOwner` enabled for
  the Fields pickup despite disabling `showOffer`.
- `OccurrenceEncounterWorkbench.tsx` renders the Overview reward editor but
  not that semantic marker. The existing inspector-destination test asserts
  navigation only, so it misses this visual disagreement.

These paths are all application-owned. No engine finding-origin or schema
change is needed for the reported case.

### Locked contract

1. Resolve each finding through the existing complete destination once. Its
   semantic origin remains diagnostic identity; its resolved focus/repair
   target determines both navigation and highlight placement. Group findings
   for highlighting from that result, not through another ancestry search,
   family redirect table, or raw-origin fallback in React.
2. Attach the highlight to the target's existing interactive control or its
   smallest truthful existing container. Missing Optional 3 highlights the
   Overview reward picker; the Timeline pickup does not receive that finding.
   A trait-child finding intentionally redirected to a pickup still highlights
   that pickup's existing control/container.
3. Highlight current findings without requiring a prior finding click. Clicking
   one reapplies the existing complete destination, scrolls/focuses the same
   target, and visually distinguishes it as selected. Multiple findings on one
   target share one border; individual explanations remain in the Findings
   panel. Clearing one finding does not clear a highlight needed by another.
4. Retire inline `(1)`/`(2)` markers and badge-only spacing. Use one consistent
   finding-border treatment and selected-target emphasis without changing
   control dimensions or inserting a new wrapper hierarchy. Preserve normal
   keyboard focus styling and accessible association with finding descriptions;
   an inaccessible color-only explanation or hover-only message is not enough.
5. Preserve aggregate counts on the rail, route/biome summaries, and Findings
   panel. Aggregate repair findings highlight their real container, never a
   fabricated leaf. Ordinary navigation, dialogs, retained values, keyboard
   editing, and undo behavior remain unchanged.

### Implementation boundary and retirement

Keep this one complete application slice: shared destination-derived feedback,
feedback styling/focus, and its control consumers land together. Inspect the
current `SemanticOwnerMarker` consumers across loadout, room features,
encounters, timeline, doors, and trait/level editors; classify real repair
targets versus summary counts. Do not turn this inventory into a production
manifest or a finding-code registry.

Reuse the existing destination and semantic control identity mechanisms.
`semanticOwner.ts` currently distinguishes marker-element IDs from control IDs;
retire badge-only identity/focus handling where superseded, rather than keeping
an invisible badge as a second navigation target. Remove the old marker
renderer, selected-finding badge fallback, and marker-specific CSS/spacing as
their consumers migrate. Existing semantic workspace descriptors may remain
where they still own assessment or navigation facts; this is not a blanket
rename of everything called a marker.

Primary verification:

- Extend the existing missing Fields optional-definition witness to assert
  Overview picker highlighting before clicking, no corresponding Timeline
  highlight, and matching focus/tab/rail behavior after clicking repeatedly.
  Use a repository fixture equivalent to the supplied save, not its Windows
  path as a test dependency.
- At the destination/feedback projection boundary, cover exact owners,
  redirected trait children, multiple findings sharing a target, and truthful
  aggregate targets. One resolved target must serve navigation and styling.
- Representative React workflows cover a normal input/picker, a Timeline
  launcher, and a group container. Verify keyboard focus and clearing findings
  without changing control values or remounting editors. Keep the existing
  finding-navigation regressions; do not duplicate the engine finding matrix.
- Review layout in Overview/Timeline/Doors and a dialog: no extra marker row,
  spacing accommodation, or duplicate target element. Preserve summary counts.

Run focused application tests, typecheck, lint, formatting, and application
build. Use a fresh executor and independent reviewer; the main session owns
final diff review. No chronological gating, new severity policy, DOM discovery
registry, or engine semantic rework enters this slice.

Intended commit: `fix(planner): unify finding repair highlights`

### Gate C implementation record

The completed workspace repair destination now supplies both navigation and
the finding-highlight index. Existing controls and truthful containers bind
that target directly; the inline badge renderer, its raw-origin feedback path,
and badge-only spacing have been removed. Aggregate finding counts remain.
No engine, catalog, schema, or chronological-readiness changes are included.
The border audit also reset browser-default fieldset borders, removed the last
trait-specific finding-border rule, and placed the shared finding ring after
ordinary component shadows so picked exits and focused Hub cards cannot hide
it. Intentional structural, validity, selection, and keyboard-focus treatments
remain separate.

Independent adversarial review and the final bounded review refresh found no
outstanding actionable issues after remediation. Browser verification with the
supplied save confirmed that H_Combat05 Optional 3 highlights its Overview
picker before navigation, has no corresponding Timeline highlight, and receives
focus when the finding is clicked. The browser reported no page exceptions.

Focused verification passed after bounded corrections: App interaction tests
(38), the shared feedback and destination tests, and the corrected UI/product
files. The final eight-file run passed 132 of 133 tests; its remaining Hub
assertion was corrected to follow the existing completed repair destination
and passed in isolation. Earlier failures in the broader UI run were covered
by these corrected-file reruns; no single clean full-UI rerun is claimed.
Typecheck, lint, formatting, diff checks, and the application build passed.
The complete repository gate and durable document absorption remain Gate D
work.

## Gate D — Durable closure

- Absorb the destination-versus-focus invariant and four repair dispositions
  into `EDITOR_MODEL.md` and `STRUCTURED_EDITOR_WORKSPACE.md` without copying
  the audit inventory.
- Record that the destination's resolved repair target owns both navigation
  and inline highlighting; update the audit disposition and contextual UX
  guidance for border feedback versus aggregate counts.
- Record delivery in the durable progress history.
- Delete this temporary plan.
- Run one complete repository gate after focused checks and independent review
  are stable.

Intended commit: `docs(planner): close finding navigation plan`

## Review requirements

Each implementation gate uses a fresh executor and independent adversarial
reviewer. Review must challenge:

- complete destinations copied into Redux;
- finding-code or evidence switches in React;
- rail ownership inferred from visual order;
- same-tab navigation depending on component remount;
- generic feature targets with open stringly typed identities;
- aggregate conflicts forced onto arbitrary fields; and
- authoring-frontier behavior entering this slice.

For Gate C, also challenge independent badge/focus routing, highlighting raw
finding owners instead of resolved repair targets, a selected-click-only
highlight path, and replacing badge-placement work with wrapper-placement
machinery. A single focused behavior witness must exercise both navigation
and the actual styled target, not assert their projections independently.

The final bird's-eye review verifies that ordinary semantic navigation is
unchanged, all corrected finding origins remain engine-owned, no parallel
navigation path remains, and the broader authoring-cursor discussion is still
excluded.
