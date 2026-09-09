# Scheduled Acquisition Identity Stability Plan

## Status and base

Status: **Locked for execution; implementation has not started**.

Planning base:

- Run Planner: `ffe7f657`
- Plan Executor: `fc433e3`
- Modpack parent: `de7cc10`

This is a focused authored-identity and reconciliation correction. It is not a
scheduler redesign or permission to reorganize otherwise working lifecycle
transitions.

## Objective

Make a scheduled generated acquisition retain one stable persisted identity
when unrelated earlier chronology changes. Its source, generated siblings,
authored participation, payload, target, and Timeline position must remain
intact when the semantic source and due point have not changed.

The reported failure is Supply Chain. Starting from a valid Surface route with
two authored Q Pom Slices, generating an unvisited `N_Combat23` side room and
assigning Tiny Gold shifts the producing trait's global history sequence from
`339` to `340`. The semantic Icarus acquisition and the Q maturity point are
unchanged, but the persisted Slice keys still contain `339`. They cease to
match the derived frontier, become `rewardSourceUnavailable`, and lose their
target controls.

The correction is:

```text
semantic producing acquisition + declaration pickup key
  -> stable persisted acquisition-entry key
  -> simulator derives the due host and phase independently
  -> existing acquisition machinery owns participation and payload
```

Global history sequence remains chronology evidence. It must not identify a
persisted scheduled acquisition.

## Authorities and evidence

- [`SCHEDULED_AND_AUTOMATIC_TIMELINE_OUTCOMES_AUDIT.md`](../audits/rooms-and-routes/SCHEDULED_AND_AUTOMATIC_TIMELINE_OUTCOMES_AUDIT.md)
  owns the lifecycle inventory, source evidence, inclusion boundary, and the
  open Supply Chain identity finding.
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md) owns the
  lifecycle signals and native encounter-end ordering.
- The authored-project model owns persisted acquisition sites, entry keys, and
  Room Action references.
- Simulation owns whether a clock matures and the exact derived acquisition
  frontier where its pickup exists.
- Ordinary acquisition settlement owns the generated pickup after it
  materializes.

The code already has the correct broad maturity structure:

- `encounter-end-effects.ts` coordinates encounter-counted Hammer, Chaos,
  Well, Supply Chain, Shrine, Steady Growth, and Embryo effects in native order;
- boss settlement coordinates boss-counted Well expiry, Judgment, and Crystal
  Figurine;
- Chaos God-Boon-screen and location clocks remain at their distinct native
  signals; and
- Shrine delivery and Supply Chain already publish
  `DerivedAcquisitionEntryFrontier` products consumed by ordinary acquisition
  machinery.

Those paths are retained. The audit establishes their ownership boundaries; it
does not justify replacing them with a new universal coordinator, signal API,
or maturity-result union.

## Root cause

Trait settlement currently constructs the acquisition identity for a clocked
pickup-producing trait as:

```text
semantic trait-offer address + global history sequence
```

Supply Chain progress carries that value into its maturity result, and
`clockedTraitGeneratedPickupEntryKey` embeds it into each persisted generated
pickup key. The authored source-retraction path already discovers selected
clocked producers by semantic trait-offer address, but must compare them to the
sequence-bearing persisted identity by prefix.

This creates two representations of the same source:

- semantic address for source existence; and
- semantic address plus incidental sequence for generated entry identity.

An unrelated edit can change the latter while leaving every game-domain fact
unchanged. That is the defect.

## Locked design

### Stable producer identity

For a selected clocked pickup-producing trait, the acquisition identity is the
semantic trait-offer owner plus its acquisition role. It must not include the
global history sequence.

The implementation must first inventory every producer and consumer of this
identity and prove that the semantic owner plus role is collision-safe for all
currently modeled clocked pickup sources. If a real same-owner collision is
found, add the smallest source-local discriminator. Do not retain sequence and
do not add a parallel schedule-only identity merely to avoid updating a
consumer.

The persisted generated entry remains:

```text
stable producing acquisition + declaration pickup key
```

Supply Chain's `pom1` and `pom2` remain distinct sibling entries.

### Identity and placement remain separate

The source identity answers **which acquisition created this repeating
producer**. The derived frontier answers **where and when this particular
maturity exists**.

Occurrence, encounter phase, and history sequence remain placement or
chronology facts. They must not be smuggled into persisted source identity.

This gate does not change clock intervals, qualifying encounters,
`skipTimedDropResources`, repeated maturity, or same-seam ordering. It does not
move a Slice to a different due point unless the simulator already derives a
different point under existing rules.

### Reconciliation

The existing source-owned reconciliation contract remains:

- removing or replacing the exact producing acquisition retracts its active
  later pickup actions atomically;
- retaining that producing acquisition retains its generated entries;
- unrelated upstream edits that leave source and due point unchanged preserve
  each entry's participation, payload, target, and Timeline order; and
- changing one sibling does not author, delete, or retarget the other.

Source comparison becomes exact stable-identity comparison. The current
sequence-bearing prefix convention must be removed from clocked-pickup source
retraction.

This plan does not add a global post-command repair pass. If a future command
legitimately changes a maturity's due host, that movement must be specified by
the owning command and simulator contract rather than inferred as part of this
bug fix.

### Migration

The authored schema advances from `79` to `80` because scheduled generated
pickup keys and matching Room Action references are persisted bytes.

The focused migration must:

1. identify legacy clocked generated-pickup entry keys;
2. replace the sequence-bearing source portion with the stable semantic source;
3. rekey the corresponding acquisition-site entry;
4. rewrite every matching `interactAcquisitionEntry` Room Action reference;
5. preserve payload, Pom target, participation, encounter phase, and order; and
6. reject a true migrated-key collision rather than silently overwriting data.

No unrelated authored shape changes belong in schema 80. This migration is the
only supported compatibility step added by the plan.

### Planner/executor boundary

The execution-plan compiler remains a parser of the validated planner product.
It does not reconstruct or repair scheduled identity.

If the opaque owner bytes change in a published transaction, refresh the
affected execution fixtures and their executor copies. No Lua clock,
reconciliation, or semantic adapter changes are authorized.

## Included scope

- Inventory clocked pickup producer identity producers and consumers.
- Replace sequence-bearing Supply Chain source identity with stable semantic
  identity.
- Replace prefix-based source retraction with exact identity matching.
- Preserve existing derived acquisition placement and ordinary acquisition
  settlement.
- Add schema `79 -> 80` migration for entries and Room Action references.
- Add the exact unvisited-N-side-room regression.
- Refresh only artifacts whose serialized owner bytes actually change.
- Close the durable audit finding after implementation is verified.

## Explicit non-goals

- No unified clock or scheduler implementation.
- No new lifecycle coordinator or universal signal entry point.
- No cross-family due-effect union or generic pending-effect registry.
- No movement of maturity state between trait, keepsake, Well, Shrine, or
  Arcana ledgers.
- No changes to Hammer, Chaos, Well, Shrine, Steady Growth, Embryo, Judgment,
  or Figurine rules.
- No redesign of `DerivedAcquisitionEntryFrontier`.
- No generic scheduled-acquisition command union.
- No global authored-project reconciliation after arbitrary commands.
- No UI redesign.
- No executor-side clock advancement or recovery logic.
- No tests added merely to prove absent scheduler abstractions or unchanged
  effect families.

## Delivery gates

### Gate A — Stable clocked-pickup identity

1. Inventory every construction, persistence, parsing, comparison, and
   publication contact for clocked pickup producer identity.
2. Lock the collision-safe semantic source identity and characterize the
   legacy sequence-bearing form.
3. Change clocked pickup-producing trait settlement and downstream maturity
   products to carry the stable identity.
4. Change source retraction to exact identity comparison and delete the old
   prefix convention.
5. Preserve existing maturity progression, frontier placement, optional Slice
   participation, and sibling independence.
6. Add focused engine witnesses for source retention, exact source removal,
   repeated maturity, and independent `pom1`/`pom2` state.

Primary owners: trait settlement, clocked pickup progression, authored
generated-pickup reconciliation, and their engine tests.

Commit boundary: `fix(engine): stabilize scheduled acquisition identity`.

### Gate B — Schema migration and product regression

1. Advance the authored schema to 80 and implement the focused `79 -> 80`
   migration.
2. Add migration witnesses preserving both Pom targets, participation, and
   Room Action order while rekeying entry and reference bytes together.
3. Add the supplied product regression: from a valid Surface route with both Q
   Supply Chain Slices authored, generate but do not visit an earlier N side
   room and assign Tiny Gold. The plan must remain valid and both Q targets
   must remain visible, editable, and unchanged.
4. Verify encode/decode and workspace reload of the migrated document.
5. Refresh only affected execution fixtures and executor copies if their opaque
   owner bytes change.

Primary owners: authored codec and migration, application product-loop witness,
and execution fixture copies when applicable.

Commit boundary: `feat(project): migrate stable scheduled acquisition keys`.

### Gate C — Durable closure

1. Record the implemented stable identity and regression result in the durable
   scheduled-outcomes audit.
2. Update the room-lifecycle design only if implementation reveals a missing
   stable lifecycle invariant; do not document code movement that did not
   occur.
3. Confirm the audit continues to reject a universal scheduler action, signal
   API, result union, and pending-effect registry.
4. Delete this temporary plan after its stable conclusions are absorbed.
5. Run the complete repository gate once at closure. Run executor Lua tests and
   lint only if execution fixture bytes changed.

Commit boundary: `docs: close scheduled acquisition identity correction`.

## Acceptance witnesses

The primary tests must prove:

- the same semantic producer receives the same identity when unrelated earlier
  history changes its event sequence;
- a generated-but-unvisited N side room does not invalidate either later Q Pom
  Slice;
- both Slice targets, participation states, and Timeline positions survive the
  edit and a document round trip;
- removing or replacing the exact Supply Chain acquisition retracts only its
  active later actions;
- `pom1` and `pom2` remain independent siblings;
- repeated Supply Chain maturity produces the same stable source identity with
  distinct declaration pickup keys at the newly derived host;
- schema 79 migration rewrites entry keys and Room Action references
  atomically without losing authored detail; and
- a migrated-key collision fails explicitly.

Existing effect-family tests remain the authority for maturity timing and
ordering. They should not be copied into this plan's suites because those rules
are unchanged.

## Overengineering check

The implementation earns one semantic correction: persisted scheduled pickup
identity no longer depends on global chronology. Supporting work is limited to
exact source reconciliation, migration, and the regression that exposed the
defect.

The broad maturity audit remains useful because it confirms the boundary and
prevents Supply Chain's repair from absorbing pending pressures or unrelated
automatic effects. It is not an implementation checklist for refactoring all
listed families.

Expected production growth is small outside the focused migration. A helper or
module boundary is justified only if it replaces duplicated live identity
construction or comparison. Any new scheduler, coordinator facade, shared
effect union, or second identity path fails this plan's acceptance criteria.
