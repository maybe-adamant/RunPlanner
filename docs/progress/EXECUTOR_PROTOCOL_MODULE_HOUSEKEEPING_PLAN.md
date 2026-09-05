# Executor Protocol Module Housekeeping Plan

## Status

Locked on 2026-09-05 for one behavior-preserving executor pass.

Starting commits:

- Run Planner: `56710e87d3e714584f934b7b356812f320dfff57`
- Plan Executor: `607e53a0feb284bab82d9def07345763bd8a9115`
- Modpack shell: `fb4696d210bf20678f9788fdb4c0bd818a6ded88`

## Objective

Turn the executor's root-level `protocol_*` files into one navigable protocol
decoder package whose filenames state their wire responsibility. Separate
diagnostic Run State frame decoding from conformance-fact decoding, which have
different inputs and consumers despite currently sharing one file.

This pass changes no execution-plan shape, fingerprint input, protocol or
catalog version, fixture byte, session behavior, native hook, mismatch policy,
or planner product.

## Current inventory and target

| Current module             | Target module              | Sole responsibility                                      |
| -------------------------- | -------------------------- | -------------------------------------------------------- |
| `protocol.lua`             | `protocol/decoder.lua`     | Envelope, versions, fingerprint, and derived indexes     |
| `protocol_primitives.lua`  | `protocol/primitives.lua`  | Closed-shape primitives and canonical fingerprint helper |
| `protocol_rewards.lua`     | `protocol/rewards.lua`     | Reward, trait-offer, acquisition-role, and equip shapes  |
| `protocol_overview.lua`    | `protocol/overview.lua`    | Room Overview feature shapes                             |
| `protocol_timeline.lua`    | `protocol/timeline.lua`    | Timeline transactions, dependencies, and obligations     |
| `protocol_occurrences.lua` | `protocol/occurrences.lua` | Occurrences, Doors, identity references, connectivity    |
| `protocol_diagnostics.lua` | `protocol/diagnostics.lua` | Sparse diagnostic frame validation and expansion         |
| conformance section above  | `protocol/conformance.lua` | Named conformance-fact resolution from expanded state    |
| `loadout/protocol.lua`     | `protocol/loadout.lua`     | Starting loadout shape                                   |

`protocol/decoder.lua` is the deliberate supported decoder entry point. No
`index.lua`, forwarding module, alias, compatibility path, or registration
table is introduced. Every production and test import moves to the owning
target in the same change, and all superseded files are deleted.

The large rewards, Timeline, and diagnostic validators remain intact when they
already express one closed wire family. File size alone does not justify
splitting declaration-heavy decoder code.

## Ownership and exclusions

The Plan Executor owns strict decoding. The Run Planner remains the sole wire
producer and receives no code or fixture changes in this pass. The modpack shell
only pins the reviewed executor revision.

Explicitly excluded until a later discussion:

- moving or splitting `native_fact_bindings.lua`;
- moving Hex, Chaos, host, runtime, JSON, or composition modules;
- consolidating native trait-offer adapters;
- renaming tests for unrelated feature ownership;
- changing error text except where a module-qualified test description must
  follow the new location; and
- any protocol-version bump or fixture regeneration.

## Delivery gate

1. Move each decoder family to its target path and update imports atomically.
2. Extract only the conformance-fact resolver from diagnostics. Its explicit
   input remains the already-expanded diagnostic state; diagnostics retains
   sparse-frame validation and expansion.
3. Keep the outer decoder's returned product, derived indexes, and fingerprint
   calculation byte-for-byte equivalent.
4. Update the executor README's architecture map to name the protocol package.
5. Delete every superseded root-level protocol module and
   `loadout/protocol.lua`.

Primary acceptance:

- existing strict protocol tests pass without weakening or replacing their
  assertions;
- focused conformance tests prove the extracted resolver still rejects unknown
  and duplicate fact kinds and returns the same expected values;
- all Lua tests pass;
- Luacheck, Lua parse/import scan, smoke preflight, and diff checks pass; and
- checked-in execution fixtures remain byte-identical and unmodified.

Commit boundaries:

- Run Planner: this locked plan, then its deletion after closure;
- Plan Executor: `refactor(executor): consolidate protocol decoding`;
- Modpack shell: pin the reviewed executor revision.

## Closure

After independent review, record any durable architecture wording in the
executor README, delete this temporary plan, and stop. The next housekeeping
pass is not implicitly authorized by this plan; Hex placement and remaining
root modules are discussed from the resulting tree.
