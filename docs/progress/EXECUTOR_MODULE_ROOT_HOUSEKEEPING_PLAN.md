# Executor Module Root Housekeeping Plan

## Status

Locked on 2026-09-05 for two behavior-preserving executor gates.

Starting commits:

- Run Planner: `5e2fd05e314203fda1b67a57e0279e0e9d7512ce`
- Plan Executor: `4f145f8ad39e3dbc93be937da5f2ef143f7af6e9`
- Modpack shell: `917aa5d61f0578b14120aafebd189cf79ebbecac`

## Objective

Remove the remaining accidental collection of feature, host, and runtime files
from `src/mods/` while preserving one intentional root declaration:
`native_bindings.lua`, the cross-domain planner-to-native dictionary.

The resulting tree expresses shared Spell and trait behavior, host integration,
runtime composition, and strict protocol decoding as separate owners. This is
pure module movement and naming. It changes no execution wire, native hook,
session behavior, plan fixture, mismatch policy, or feature semantics.

## Locked target

```text
src/mods/
├─ native_bindings.lua
├─ host/
│  ├─ data.lua
│  ├─ inbox.lua
│  └─ status_ui.lua
├─ runtime/
│  ├─ composition.lua
│  └─ session.lua
├─ protocol/
│  ├─ json.lua
│  └─ ...existing decoder families
├─ spells/
│  └─ hex_tree.lua
├─ traits/
│  └─ chaos.lua
├─ keepsakes/
├─ loadout/
├─ navigation/
├─ room/
└─ route/
```

The NPC-only offer adapter moves from `native_timeline_adapters.lua` to
`room/timeline/acquisitions/npc/trait_offer.lua`.

## Ownership decisions

- `native_bindings.lua` remains at the root because it is the one intentional
  cross-domain immutable translation boundary. It is not moved or split.
- `spells/hex_tree.lua` is shared by route-start Aspect of Selene and ordinary
  Spell acquisition. It must not be nested beneath the room acquisition
  adapter or owned by loadout.
- `traits/chaos.lua` remains one closed processed-trait adapter shared by Chaos
  acquisition, Transcendent Embryo, and conformance. Curse/blessing halves are
  not split.
- `room/timeline/acquisitions/npc/trait_offer.lua` owns the pure NPC offer
  installation currently used only by the NPC acquisition adapter. It is not a
  general native service.
- `runtime/session.lua` coordinates route and room sessions and therefore does
  not belong to either child domain.
- `runtime/composition.lua` is the active hook-composition root beneath
  `main.lua`.
- `host/` owns ModpackLib declarations, the published-file inbox, and the
  inspection UI. These remain separate files because their effects differ.
- `protocol/json.lua` is the tagged, bounded JSON decoder used at the strict
  execution-plan boundary.

No `index.lua`, compatibility forwarding module, alias, registry, or empty
directory is introduced.

## Gate A — Shared Spell and trait modules

- move `hex/tree.lua` to `spells/hex_tree.lua`;
- move `chaos.lua` to `traits/chaos.lua`;
- move `native_timeline_adapters.lua` to the NPC acquisition neighborhood as
  `trait_offer.lua`;
- update every production and test import in the same change;
- delete the superseded files and empty `hex/` directory; and
- preserve each moved module byte-for-byte except for its ownership comment or
  module-local name when clarity requires it.

Acceptance:

- focused Hex, Chaos, NPC, loadout, keepsake, and conformance tests;
- full Lua suite, Luacheck, Lua parse/import scan, smoke, and diff checks;
- no fixture, protocol, host, runtime, or native-binding changes.

Commit boundaries:

- Plan Executor: `refactor(executor): rehome shared spell and trait adapters`
- Modpack shell: pin the reviewed executor revision

## Gate B — Host and runtime composition

- move `data.lua`, `inbox.lua`, and `ui.lua` under `host/`, renaming the UI file
  to `status_ui.lua`;
- move `json.lua` to `protocol/json.lua` and update protocol plus feature/test
  consumers;
- move `runtime_session.lua` to `runtime/session.lua`;
- move `logic.lua` to `runtime/composition.lua`;
- update `main.lua`, production imports, tests, and the README architecture map;
- delete every superseded root path; and
- retain `native_bindings.lua` as the only file directly beneath `src/mods/`.

Acceptance:

- existing inbox, JSON, protocol, runtime-session, composition, and boot tests
  retain their assertions and pass;
- full Lua suite, Luacheck, Lua parse/import scan, smoke, and diff checks;
- fixtures remain byte-identical; and
- no protocol version, wire shape, hook set, or runtime behavior changes.

Commit boundaries:

- Plan Executor: `refactor(executor): organize host and runtime modules`
- Modpack shell: pin the reviewed executor revision

## Closure

After both gates receive independent review, update the executor README with
the stable module map, delete this temporary plan, and stop. No feature
implementation or further decomposition is implied by this housekeeping pass.
