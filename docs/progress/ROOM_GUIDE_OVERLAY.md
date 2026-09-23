# In-game room guide

Status: locked for implementation on 2026-09-23. Execution-protocol update and
bounded overlay probe approved. Resolved rows may dim or hide; choose the simpler,
clearer presentation through the probe. Plan commit and implementation requested;
deployment remains subject to a separate user request.
Planner base `3b4ffb3f`; module base `681c3f6`.

## Product contract

One independent game-module setting, **Show room guide**, displays ordered
instructions for the current planned room and a next-room/reward footer through
ModpackLib. It is general guidance, not a checklist that proves player actions.

Dimmed or hidden means the associated executor transaction has completed its
work. A boon instruction can dim or disappear when the offer screen opens; the native screen and optional
choice highlight guide the remaining selection. Order is advisory, not a cursor:
later rows can resolve visually before earlier rows. No added dependencies or enforcement.

Rows with no transaction remain informational until the room changes. Do not
add callbacks merely to dim them. Do not infer completion from inventory,
traits, payment, conformance, or elapsed time. Rendering errors never become
gameplay mismatches. Hide stale recommendations when no synchronized session
exists. The highlights feature is independent; neither setting requires the
other.

## Bridge evidence and chosen disposition

Paths below are relative to planner `packages/planner-engine/src/`, planner
`apps/planner/src/`, or module `src/mods/`, as indicated.

| Existing product                                                                                | Finding                                                                                                                                                                                                      | Disposition                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine `simulation/room-actions/model.ts:RoomActionRow` and `timeline.ts:RoomLifecycleTimeline` | Rows already carry stable owner, reference, rank, participation and lifecycle grouping. Timeline distinguishes actions, boundaries and automatic effects.                                                    | Project active ranked actions in existing timeline order. Do not sort execution transactions to reconstruct chronology.                                                       |
| App `projections/structured-workspace/assembly/occurrence-action-label.ts`                      | Current labels depend on catalog and workspace controls; this is not an engine or game-module API.                                                                                                           | Do not import React/workspace projections into execution assembly. Publish small semantic description operands, render concise copy in the module using native display names. |
| Engine `execution-plan/assembly/timeline-transactions.ts`                                       | Wheel, NPC interaction, fountain, keepsake, Well effect/transformation and ordinary acquisition transactions use the action's semantic owner. Multiple acquisition roles reside inside a single transaction. | An optional exact `transactionOwner` per guide row suffices. Use owner equality against emitted transactions; no many-to-many completion framework.                           |
| Same compiler: skipped actions                                                                  | Pool sales, boss reward collection and Fields cage actions have no independent transaction. Timepiece conversion events are filtered out of acquisitions.                                                    | Retain these authored instructions with no progress association. Never invent executable transactions for presentation.                                                       |
| Same compiler: automatic/refill work                                                            | Automatic effects, keepsake replay and Travel Deal replacement transactions are not necessarily player actions; some are appended outside the action loop.                                                   | Do not turn every transaction into an instruction. Guide the authored purchase/pickup, not a fake instruction to generate the refill.                                         |
| Module `room/timeline/session.lua:complete/close`                                               | `completedOwners` already records completed steering; it is cleared when the room session closes.                                                                                                            | Expose a narrow read-only progress query through the room owner. No second progress store or completed-action history.                                                        |
| Module ordinary/Chaos/Pom acquisition hooks                                                     | Some transactions complete during offer installation.                                                                                                                                                        | This is acceptable dimming, not a settlement defect to fix.                                                                                                                   |
| Module `route/session.lua:next/transparent`                                                     | Cursor distinguishes active occurrences and transparent N restores.                                                                                                                                          | Resolve footer from this route authority and published doors/Hub facts, not a new navigation cursor.                                                                          |

## Narrow product shape

Add a room guide alongside each selected occurrence's execution products:

```text
guide rows, in display order:
  key                 stable opaque action identity
  description         closed action kind + minimal resolved game operands
  transactionOwner?   exact existing owner, absent for informational rows
```

Description operands include only what makes the instruction recognizable:
reward/source, NPC, sold trait, keepsake, slot/wheel/cage identity, and an authored
conversion disposition where applicable. Reuse existing execution reward types
and game identifiers. Do not export complete authored references, picker
controls, labels, every trait option, a second timeline graph, or simulation
state. Selected trait payloads already live in transaction products; reference
them when useful rather than duplicate them. Exact wording is module-owned.

The source is the existing complete-valid canonical action timeline and resolved
acquisition/feature products. Assembly may translate explicit facts, but must
not re-evaluate eligibility or parse serialized owner keys. If a description
requires an unavailable fact, use a concise generic instruction for that row
instead of adding a new semantic model solely for prettier copy.

Emit one instruction per active authored action. Automatic mutations are not
imperatives; omit automatic-effect rows in this first guide. Existing phase
identities can group repeated O/H actions without duplicating lifecycle logic.
Do not require parity with every editor decoration or boundary label.

Both codecs validate row structure, stable unique keys and optional owner
references against that occurrence's transactions. Guide associations never
enter DAG dependencies, obligations or conformance. The wire fingerprint still
covers the published product as usual.

The strict existing decoders require a coordinated execution-protocol update.
The project owner approved that update; use one bump for this feature.
No authored schema bump or saved-project migration. Users regenerate published
plans using compatible planner/module versions. Do not introduce a sidecar file
or a permissive decoder escape hatch to avoid the protocol contract.

## Runtime and presentation

- Module owns the toggle, wording, layout, native display-name lookup and guide
  projection. Start disabled. Show room identity, numbered instructions and a
  footer. Retain pending/informational rows in normal styling; dim or hide a row only
  when its optional owner is present in existing completed-owner state.
- A narrow room-session read API answers progress; renderer does not reach into
  `_timeline` or call begin/claim/complete. Cache rendered values only if useful,
  never semantic progress.
- Refresh through managed setting commits and a modest ModpackLib overlay
  interval, comparing the current projection before updating visuals. This
  reads existing state and avoids installing new gameplay observation hooks.
- On a fresh occurrence, replace the displayed guide. On session loss, hide it.
  O phases remain one room guide, with independent owner progress; do not clear
  it between waves or wheel cohorts.
- N transparent Hub/main restores must not reopen or replay a finished room
  checklist. Show navigation-only guidance there. Use the next planned visit or
  side destination when directly resolved; label the native Hub/parent return
  when appropriate. If the immediate transition cannot be resolved simply,
  omit that footer instead of recommending the wrong fresh occurrence.
- Footer uses published next destination and reward when applicable. Fields
  cage rewards are a set, not a made-up single incoming reward. O wheel rewards
  belong to local instructions, not the next-room footer. End of configured
  prefix shows no invented continuation.

### ModpackLib boundary and bounded visual probe

The inspected `docs/module-authors/capabilities/OVERLAYS.md` supports retained
lines/tables in `middleRightStack`, commit/interval refresh and native HUD/UI
suppression. Current `core/overlays/retained.lua` tables have a declaration-time
`maxRows` and column styling; row values alone do not expose a row-color setter.

Before production wiring, prove a compact numbered list, resolved-row dimming
or hiding, and a footer through the public overlay API. Hiding rows through
existing retained table values is an acceptable first choice and avoids needing
dynamic row-color support. Keep original instruction order and stable numbering
when filtering resolved rows. Do not add a second user setting merely to offer
both presentations. Do not depend on unverified text markup
or reach into Lib's renderer internals. Prefer existing native text formatting
if a live probe proves it; otherwise propose the smallest supported styling
extension to ModpackLib for approval. Do not build a new overlay framework.

Long-room overflow is a presentation choice, not a semantic cap. Test a real
long room; never silently truncate to four actions. A bounded visible window
with explicit remaining-count indication is acceptable as a proposed fallback,
but settle its appearance with the user before visual closure. Pending
informational rows must not permanently prevent later guidance from being seen.

## Delivery gates and ownership

### A — Guide product and bridge

Implement the approved pure execution projection and both
codecs in one coordinated slice. Keep existing transaction generation unchanged.
Primary engine tests own ordered row inclusion, descriptions and exact owner
mapping, including rows without owners. Compare enforcement products before/
after with guide data removed to prove no DAG/conformance changes.

Use representative existing real projects: an ordinary boon room; an interleaved
Shop/Travel Deal room; a pool sale; Timepiece/Artificer; an O multi-phase room;
Fields cages; and N navigation. These are contact witnesses, not new full-run
fixture collections. Regenerate only affected execution fixtures, using the
repository formatting policy; mirror module copies byte-for-byte. Add one
cross-repository witness containing both associated and informational rows.

Intended commit boundary: guide publication and coordinated protocol decoding.

### B — Read-only HUD

Resolve the bounded ModpackLib styling probe, then implement setting, module
guide projection, read-only progress access and retained overlay. Reuse existing
native display-name conventions. No new selection, purchase or settlement hooks.

Module tests prove out-of-order completion, early offer-install dimming/hiding, no-owner
rows remaining visible, room replacement, O phase continuity, transparent N
restores, prefix completion, toggling and desynchronization. An overlay harness
proves visual refresh and native HUD suppression without mutating execution
state. Live testing settles sizing, resolved-row presentation and long-room behavior; deployment
requires a user request.

Intended commit boundary: room-guide setting and HUD presentation.

### C — One independent review and closure

Review both sides once after stabilization, then one bounded remediation pass.
Check that this remained guidance rather than action tracking, that untracked
instructions remain useful, and that every protocol field earns its keep.
Run narrow owning tests during work; run planner `npm run check` and module
`lua tests/all.lua`, `luacheck src/`, and diff checks at closure. If a Lib change
is approved, run its owning overlay tests and required repository gate too.

Update only the owning integration contract, module guide usage and any actual
Lib API extension documentation. Retire this plan after acceptance. Preserve
pending visual tests explicitly if they prevent full closure. Do not promote
the rejected earlier investigation or introduce action-tracking documentation.

## Decision summary

The bridge is sufficiently understood to plan this feature. The intended
simplicity is one ordered guide, zero-or-one transaction reference per row,
existing progress as a presentation hint, and a derived navigation footer. The
execution-protocol update and bounded overlay probe are approved. Resolve the
presentation through that probe; hiding is acceptable if dimming would require
unnecessary machinery. Neither justifies player-action tracking or new game-rule
research.
