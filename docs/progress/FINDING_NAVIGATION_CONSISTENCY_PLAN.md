# Finding Navigation Consistency Plan

Status: draft for review  
Base commit: `70d69e74` (`fix(fields): close spatial layout plan`)

## Objective

Make every finding click select the complete destination already published for
its semantic origin: route, biome, visible rail stop, containing inspector,
room or Hub tab, optional dialog, and narrowest truthful repair control.
Clicking the same finding again from another tab in the same occurrence must
reapply that destination.

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
  family.

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
- Application projection owns marker containment, exact destination binding,
  room/Hub tabs, and rail ownership.
- Editor-session coordination retains the selected finding origin and existing
  navigation revision. It does not store a copied workspace destination.
- React renders the published destination and focuses its marker; it does not
  infer containment from a finding code or evidence.

## Gate A — Preserve complete click navigation

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

## Gate B — Align Room Overview repair owners

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

## Gate C — Durable closure

- Absorb the destination-versus-focus invariant and four repair dispositions
  into `EDITOR_MODEL.md` and `STRUCTURED_EDITOR_WORKSPACE.md` without copying
  the audit inventory.
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

The final bird's-eye review verifies that ordinary semantic navigation is
unchanged, all corrected finding origins remain engine-owned, no parallel
navigation path remains, and the broader authoring-cursor discussion is still
excluded.
