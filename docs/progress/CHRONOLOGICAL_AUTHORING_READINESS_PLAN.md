# Chronological authoring readiness

Status: revised execution contract; implementation not started
Base: `54847862` (`fix(planner): unify finding repair highlights`)

## Objective

Make required incomplete input create one exact chronological authoring horizon.
Controls before that horizon, within its atomic region, or responsible for
repairing it remain editable. Controls after it remain visible but are greyed
and cannot mutate the authored project.

Invalidity does not create this lock. Existing progressive candidate validation
continues to determine whether a proposed value is legal at its own semantic
pre-decision point.

The implementation must remain small: the engine distinguishes incomplete from
invalid, publishes one horizon, and answers whether a semantic owner lies after
it. The application consumes that answer through native disabled controls and
one command-boundary guard. The finding system already explains, highlights,
and navigates to the missing prerequisite; readiness must not duplicate it.

Authority: [chronological readiness audit](../audits/editor/CHRONOLOGICAL_AUTHORING_READINESS_AUDIT.md),
`SIMULATION_AND_VALIDATION.md`, `CONTEXTUAL_EDITOR_UX.md`, `EDITOR_MODEL.md`,
`STRUCTURED_EDITOR_WORKSPACE.md`, and the existing biome and room-lifecycle
rules.

## Locked policy

- **Incomplete** means required active authoring input is missing. The first
  incomplete atomic region is the only authoring horizon.
- **Invalid** means authored input exists but is not legal in the evaluated
  context. Invalidity produces findings and candidate restrictions, not a
  chronological authoring lock.
- Before the horizon is editable. The horizon's entire atomic region is
  editable. After the horizon is locked.
- A containing replacement, optional-participation withdrawal, or other repair
  resolves to the horizon region or an earlier region and therefore remains
  editable without a special exception list.
- Several controls may share one atomic region when the game authors them as
  one generated set. Repairing one missing member recomputes the horizon; it
  must not lock its siblings.
- Optional absent or untaken content is complete. Authored participation may
  activate required outcomes. Generated offer identities can be required even
  when their acquisitions are not selected.
- Retained suffix values remain visible and unchanged. Readiness never prunes,
  defaults, or repairs authored data.
- Loading, inspection, finding navigation, tab and rail navigation, undo, and
  redo remain available.
- Low-level engine commands continue to construct any structurally representable
  document. The readiness policy governs application authoring against an exact
  evaluation assembly.

## One engine product

The engine publishes a horizon with this conceptual shape:

```ts
type AuthoringHorizon =
  | { readonly kind: 'open' }
  | {
      readonly kind: 'incomplete';
      readonly regionKey: string;
      readonly repairTarget: SemanticAddress;
    };
```

`regionKey` is an opaque engine-owned identity for one atomic chronological
region. `repairTarget` is the exact missing semantic owner selected by the
existing deterministic finding chronology. The application does not interpret
region keys.

The engine exposes one query over the exact evaluation assembly:

```ts
authoringReadinessAt(assembly, owner) -> 'editable' | 'locked'
```

The query locates `owner` using the same semantic chronology that located the
horizon:

- an open horizon returns editable;
- a region before or equal to the horizon returns editable;
- a region after the horizon returns locked; and
- an owner outside the active incomplete biome is ordered by route chronology.

There is no command-kind readiness policy, UI control registry, persisted
cursor, second evaluation replay, or application-owned ordering table.

### Atomic regions

Atomic regions preserve authoring sets that have no meaningful internal order:

- route-start outcomes that are authored together;
- a generated trait, spell, or Chaos offer screen;
- H active optional reward identities generated together;
- an O wheel's active generated offers;
- an N Hub board generation set; and
- one Hub visit's generated side-room sibling set.

Ordinary batch creation still follows its real cascade: batch facts, target,
that target's required reward description, then the next target. Room timeline
actions use their authored lifecycle/rank chronology. A later action is not made
editable merely because it could be independent during game execution; this is
the document-authoring order selected by the user.

## Hub viability

The Hub does not require a second readiness model. Its existing semantic
chronology is:

1. board generation;
2. each visit's target lifecycle;
3. that visit's side generation;
4. entered local-room lifecycles in visit order; and
5. the next visit or Hub handoff.

All board siblings share one region. All side rooms generated together for one
visit share one region. A missing board member leaves the whole board region
editable and locks visits. A missing side-generation member leaves its sibling
generation controls editable and locks later local lifecycles and visits.

The current finding chronology already distinguishes `hubBoard`, visit index,
`targetLifecycle`, `sideGeneration`, and `localRoomLifecycle`. Implementation
generalizes that owning chronology from findings to arbitrary semantic owners;
it must not recreate Hub order in the application.

## Engine-to-application bridge

Every application mutation already carries a `ProjectCommand`. The command
boundary obtains its semantic owner through `projectCommandAddress` and asks the
same readiness query used by projections. If locked, the reducer returns the
existing project and history unchanged. It does not throw and does not record an
undo entry.

Before implementation, audit `projectCommandAddress` for chronological
precision. A command that currently reports only an occurrence while editing a
narrower room feature must report its real semantic owner. This is an address
contract correction, not a place to encode readiness semantics per command.

Application projections attach one `locked` boolean to existing authoring
controls or interactions. React applies native `disabled` behavior where
available and one shared `data-authoring-locked` grey treatment. Existing
containers may carry the presentation state when they truthfully own a grouped
control, but no readiness wrapper hierarchy or event-capture blocker is added.

Locked controls receive no new finding, badge, explanation panel, prerequisite
button, or navigation route. The existing incomplete finding remains on the
actual repair control and is the sole explanation and navigation authority.

## Gate A — Horizon authority and bridge proof

Deliver the complete invariant through a narrow vertical slice:

1. Make progressive evaluation explicitly publish whether its first block is
   incomplete or invalid. Only incomplete authoring produces the horizon.
2. Generalize the existing semantic finding-location chronology into an
   engine-owned owner-region locator and comparator. Finding ordering must reuse
   it rather than retain a parallel comparator.
3. Publish the horizon and `authoringReadinessAt` from the exact project
   evaluation assembly without replaying simulation or storing hidden sidecar
   state.
4. Audit and correct `projectCommandAddress` only where a real command reports
   a chronologically coarse owner.
5. Add the reducer guard and wire one ordinary-route authoring slice to native
   disabled presentation.
6. Prove the same product against an N Hub board and visit boundary before
   broader UI migration. Stop if Hub requires a second ordering model.

Primary engine witnesses:

- A missing opening reward creates a horizon; earlier loadout, the reward
  control, and its containing replacement are editable while later doors lock.
- An invalid opening reward creates no authoring horizon.
- Completing a locally legal prefix may reveal an invalid retained suffix; the
  completion succeeds, the suffix is preserved, and no incomplete lock remains.
- Sibling controls in one generated region remain editable while the next
  region locks.
- A missing Hub board member locks visits but not other board members.
- A missing Hub side-generation member locks later local lifecycle and visits
  but not its generated siblings.

Application witnesses:

- One locked direct dispatch leaves project and history identity unchanged.
- One ordinary contextual picker and one ordinary non-picker control render
  disabled from the same engine answer.
- Clicking the existing prerequisite finding still highlights and focuses the
  repair control; readiness adds no second route.
- Undo, redo, and loading a retained incomplete project remain unaffected.

Intended commit: `feat(engine): publish chronological authoring horizon`

## Gate B — Complete control coverage

Apply the same boolean contract to all remaining authoring surfaces. This gate
adds no new chronology or UX concepts.

| Contact                        | Acceptance behavior                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ordinary routes                | Batch facts, room, required reward description, and later targets follow engine chronology. Zero-reward rooms add no fabricated prerequisite.                                        |
| H                              | Cage generation, active optional reward identities, Layout placement, room Timeline, and Doors use their owning regions. Sibling generated rewards remain mutually editable.         |
| N                              | Board generation, visit order, target lifecycle, side generation, and local-room lifecycle use the proven Hub chronology. Rail position is irrelevant.                               |
| O                              | Active wheel store/count/offers/selection and selected acquisition follow wheel lifecycle. Dormant wheel two and unpicked acquisitions do not block.                                 |
| P                              | Controlled encounter composition uses its declared atomic and ordered regions without flattening phases.                                                                             |
| Commerce                       | Dormant uninteracted Well/Pool inventory is complete. Authored Shop/Shrine inventory remains required. Delayed mystery source/outcome belongs to delivery.                           |
| Optional and automatic actions | Nonparticipation is complete. Selected or matured outcomes create a horizon at their actual region. The participation control remains editable when it can withdraw the requirement. |
| Route-wide controls            | Resource, NPC, feature, and summary shortcuts inherit readiness from the semantic owner they edit, not their rendered location.                                                      |
| Detours and completion         | Chaos, Contract, Anomaly, boss/postboss, and later biomes preserve selected-path chronology and retained suffix visibility.                                                          |

Cover each distinct native control mechanism once: picker, select/input,
checkbox, button, delete, reorder, and dialog save. Engine tests own the
chronology matrix; application tests retain representative bridge and rendering
witnesses rather than duplicate it.

Remove the currently explicit enabled-unassessed authoring bypasses only where
the engine reports `locked`. An unavailable candidate context caused by
invalidity remains separate and retains current candidate behavior.

Intended commit: `feat(planner): lock authoring beyond incomplete input`

## Gate C — Combined closure

Perform final review across both implementation gates and the landed finding
navigation/highlight change.

- Absorb the incomplete-versus-invalid distinction, atomic-region horizon, and
  finding/readiness ownership split into the smallest stable design documents.
- Revise stable statements that currently treat every unassessed control as
  authorable. Preserve retained-document visibility and locally scoped candidate
  evaluation.
- Complete the durable absorption from
  `FINDING_NAVIGATION_CONSISTENCY_PLAN.md`, update the audit disposition and
  `IMPLEMENTATION_PROGRESS.md`, and delete both temporary plans.
- Run one complete `npm run check` after narrow tests and independent review are
  stable.
- Run the existing performance comparison against `54847862` only if horizon
  preparation measurably affects project rebuild or interaction work. Do not add
  another benchmark system.

Intended commit: `docs(planner): close authoring readiness and navigation work`

## Review requirements

Each implementation gate uses a fresh executor and independent read-only
reviewer. The main session owns scope, finding dispositions, final diff review,
and commits.

Review must challenge:

- invalid or merely unavailable context producing an incomplete horizon;
- atomic siblings incorrectly locking one another;
- parent repair or participation withdrawal being placed after its child;
- Hub order reconstructed outside the engine;
- coarse command addresses bypassing or over-applying the reducer guard;
- disabled appearance without native interaction blocking, or vice versa;
- new readiness copy, badges, navigation, wrappers, or event interception;
- hidden simulation replay or a second chronology product; and
- broad production growth for cases not named by the acceptance matrix.

Gate A is not accepted unless ordinary and Hub contacts use the same horizon
and comparison authority. Gate B is not accepted while any interactive mutation
can change history after its engine owner is locked.

## Exclusions

No schema or migration change, catalog game-rule change, executor/protocol work,
persisted authoring cursor, alternate simulation DAG, speculative downstream
state, automatic suffix pruning, general UI redesign, readiness-specific
navigation, or per-command semantic readiness policy.
