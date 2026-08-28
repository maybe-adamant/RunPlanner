# Postboss Keepsake Rack Authoring Plan

Status: locked for implementation

Base commit: `70debe57`

Scope owner: planner-engine authored state and simulation products, with planner
application and React adaptation

## Objective

Represent only an actual postboss keepsake switch as authored state. A physical
Keepsake Rack remains a declaration-owned room fact, while carrying the current
keepsake through that room is the absence of an authored interaction, timeline
action, lifecycle event, and keepsake-history entry.

The user-visible result is one sparse workflow:

- an unused rack offers **Add keepsake change**;
- an authored rack action lets the user change the replacement keepsake;
- that action exposes **Delete keepsake change**; and
- the keepsake picker contains only candidate keepsakes, never a synthetic
  **Retain current keepsake** option.

Deleting the action means the carried keepsake remains equipped. It is not an
unequip operation.

## Current mismatch

- Catalog room declarations already own `hasKeepsakeRack`.
- Schema 66 nevertheless requires every declared automatic Postboss rack to
  persist `keepsakeRack.disposition`, defaulting it to `{ kind: "retain" }`.
- Selecting `retain` removes `interactKeepsakeRack` from the room-action order
  but leaves the no-op authored leaf and its application control behind.
- The application manufactures a **Retain current keepsake** candidate that is
  not supplied by the engine candidate domain.
- Derived keepsake history still supports `kind: "retain"`, even though the
  ordinary selected lifecycle emits no rack event when the action is absent.
- All 27 current checkpoint files containing racks persist this default shape:
  45 retain leaves and no replacement leaf.

The durable keepsake audit already states the intended chronology: retention
means the optional rack participant is absent, while a replacement adds one
ranked action atomically. The implementation should match that disposition
directly.

## Locked model

### Physical rack versus authored use

- `RoomDeclaration.hasKeepsakeRack` remains the sole physical-availability
  fact. No catalog declaration or normalized catalog version changes.
- `RoomOccurrence.keepsakeRack` becomes a sparse authored replacement leaf:

  ```ts
  keepsakeRack?: {
    keepsakeKey: string;
    equipResults?: AuthoredKeepsakeEquipResults;
  };
  ```

- The leaf is absent when the player does not switch keepsakes. There is no
  persisted `interacted`, `retain`, or empty-result value.
- `PostbossKeepsakeDisposition` is deleted rather than narrowed to a one-case
  union.
- Route-start keepsake selection is unchanged.

### Commands and chronology

- `ReplacePostbossKeepsake` accepts one `keepsakeKey`. It creates the sparse
  leaf and `interactKeepsakeRack` action when absent, or changes the selected
  key without moving an existing ranked action.
- `RemovePostbossKeepsake` is the explicit destructive command. It atomically
  removes the sparse leaf, its `interactKeepsakeRack` reference, and all
  leaf-owned immediate equip results.
- Changing the selected key continues to retain inactive Jeweled Pom,
  Experimental Hammer, and Transcendent Embryo result detail inside the same
  authored leaf for restoration if that key is selected again. Explicit
  deletion removes those children.
- Generic `RemoveRoomAction` remains unable to remove this required action;
  semantic deletion goes through `RemovePostbossKeepsake`.
- An absent leaf emits no `keepsakeRackUsed` event. A present leaf emits exactly
  one event at its ranked action and keeps the existing before/after-fountain
  ordering semantics.
- Derived keepsake selection history contains only the starting equip and real
  replacement entries. Effect-specific uses described as retained—Fig Leaf,
  Calling Card, Time Piece, Jeweled Pom, Experimental Hammer, and similar—are
  unrelated and remain unchanged.

### Candidate and simulation products

- The engine publishes the postboss selection capability from the physical
  rack declaration even when the authored replacement leaf is absent.
- Absence is a legal no-interaction state, not the carried keepsake masquerading
  as a selected candidate. No candidate option is selected until a replacement
  is authored.
- A known but context-invalid authored replacement remains persisted and
  repairable through the existing candidate evidence and finding policy.
- The existing `KeepsakeSelectionAddress`, candidate query, room-action
  machinery, and `keepsakeRackUsed` lifecycle transition are reused. No generic
  room-feature framework, interaction boolean, alternate chronology, or new
  candidate service is introduced.

### Application and React

- Structured workspace assembly publishes a rack selection control whenever
  the existing occurrence-detail policy exposes a room whose declaration has a
  physical rack, independent of whether a replacement leaf exists. This does
  not broaden reached or dormant completion-detail visibility.
- The application stops adding a Retain section to the contextual picker and
  removes `retainIntent` from its interaction contract.
- An absent leaf renders **Add keepsake change** outside the timeline. Selecting
  a candidate authors the replacement and adds its required action.
- A present leaf renders **Change keepsake** in the shared Room Action timeline,
  retains the contextual candidate picker, and exposes a danger-styled
  **Delete keepsake change** command.
- Deletion returns the room to the add state in one undoable semantic history
  step. Undo restores the exact selected key, action order, and immediate-result
  children.

### Persistence migration

- Advance the strict authored contract from schema 66 to schema 67. The
  normalized catalog version remains `0.48.0-hex-talent-layouts` because no game
  declaration changes.
- The explicit 66-to-67 migration:
  - deletes a `keepsakeRack` whose disposition is `retain`, including any
    now-unowned dormant equip-result detail; and
  - converts a `replace` leaf to `{ keepsakeKey, equipResults? }` without
    changing its selected key or children.
- Schema 67 accepts an absent leaf on a declared rack, rejects a rack leaf on a
  room without one, and strictly decodes the sparse replacement shape.
- Migrate the existing checkpoint files and regenerate their manifest hashes
  through the repository fixture workflow. Do not hand-maintain a parallel
  compatibility decoder or add a new checkpoint solely for this refactor.

## Included changes

- schema-67 model, strict codec, defaults, encoder, and explicit migrator;
- semantic add/change/delete commands and history integration;
- physical-rack-backed candidate publication with sparse authored selection;
- room-action assembly, lifecycle settlement, and derived history cleanup;
- structured-workspace contracts, bindings, presentation, and React controls;
- focused engine, migration, application, Redux/Undo, and UI tests;
- migration of existing checkpoint bytes and manifest hashes;
- durable keepsake-audit, authored-model, room-lifecycle, and progress updates;
  and
- deletion of this temporary plan at closure.

## Excluded scope

- route-start keepsake editing;
- changing rack locations, rack availability, or no-return eligibility;
- changing Cherished Heirloom, Gift Gift Gift, Fated, Echo, or keepsake-specific
  equip effects;
- changing the legality of selecting the currently equipped or previously
  blocked keepsake;
- adding an unequip-to-none operation;
- changing the relative order of fountain and replacement actions;
- changing inactive-detail retention when switching between replacement keys;
- adding a generic optional-feature or interaction framework;
- adding a new checkpoint scenario when focused authority and product witnesses
  already cover replacement settlement; and
- unrelated schema, catalog, fixture, or editor cleanup.

## Gate A - sparse rack replacement vertical slice

Deliver the complete schema-67 correction across engine and planner in one
behavioral commit. This gate must not stop at an engine contract that leaves the
application uncompilable or at a UI-only disguise over persisted retain state.

Primary authority tests:

- authored defaults contain no postboss rack leaf;
- strict codec round-trips a replacement leaf and rejects malformed/non-rack
  ownership;
- migration maps schema-66 retain to absence and replace to the sparse shape,
  preserving replacement children;
- replace creates one action, changing the key preserves its exact order, and
  delete removes leaf/action/children atomically;
- Undo after delete restores the exact action order and result detail;
- candidate capability exists at a reached physical rack with no authored
  replacement, shows no selected pseudo-candidate, and retains invalid authored
  replacement repair;
- no-interaction simulation carries the current keepsake without a retain
  history event, while a replacement still settles at its ranked lifecycle
  position;
- the application shows Add, then Change plus Delete, never Retain; and
- representative Jeweled Pom, Experimental Hammer, Transcendent Embryo,
  Cherished Heirloom, Fated, and later-rack no-return tests remain green.

Focused verification:

- schema migration tests;
- authored-project keepsake and room-action tests;
- keepsake candidate and lifecycle simulation tests;
- structured-workspace contract/binding tests;
- Keepsake Rack React and Undo interaction tests;
- checkpoint fixture integrity after migration;
- workspace typechecking; and
- changed-file lint and formatting.

Intended commit:

```text
feat(keepsakes): make postboss rack changes sparse
```

## Gate B - durable closure

- update the planner disposition in the keepsake audit without altering its
  source facts;
- update the schema boundary and sparse-rack ownership in
  `AUTHORED_PROJECT_MODEL.md`;
- clarify in `ROOM_LIFECYCLE_MODEL.md` that only a selected replacement creates
  the ranked rack event;
- record schema 67, validation, and the user-visible workflow in
  `IMPLEMENTATION_PROGRESS.md`;
- delete this temporary plan; and
- run one complete `npm run check` after independent review remediation.

Intended commit:

```text
docs(keepsakes): close sparse rack authoring
```

## Review requirements

Gate A receives one fresh executor and one independent reviewer. The main
session retains final diff and Git ownership. The review must confirm:

- no authored or application `retain` case survives in the rack-selection path;
- effect-retention concepts outside rack selection were not removed;
- physical rack availability remains declaration-owned;
- an absent leaf is valid, creates no action/event/history entry, and still
  exposes candidate-backed Add authoring;
- a present leaf creates exactly one required ranked action;
- change preserves action order and dormant result detail, while delete clears
  the complete owned subtree;
- the current carried keepsake is not presented as an authored selection;
- invalid persisted replacement intent remains visible and repairable;
- generic Room Action deletion cannot leave a rack leaf without its action;
- schema-66 documents migrate deterministically with no production
  compatibility path;
- all migrated fixture hashes describe canonical schema-67 bytes; and
- no new abstraction exists without one of the concrete tests named above.

Only one complete repository gate runs at closure. Narrow owning-lane tests are
used during implementation and review remediation.
