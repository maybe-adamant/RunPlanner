# Persistent hub offers and safe inventory steering

## Status and objective

Approved and locked execution contract. Gates A and B are complete for automated
acceptance; Gate C has not started. Manual runtime acceptance remains pending.
Plan committed at `b2ed470d`; independent pre-implementation review passed.
Planner base: `29268b21`. Game-module base: `ae7c8e8`.

Gate A verification: 277 catalog tests, all 2,090 engine tests, seven application
repair/Undo tests, and 17 dependent Surface application/product tests passed.
All-package/fixture typecheck, changed-file ESLint, formatting and diff checks
passed. No schema/protocol bump or generated JSON fixture changes.

Independent implementation review found a refill-coverage gap, not a proven
production defect. Remediation added a real N-to-O acquisition/rush/refill/repair
witness, which exposed and corrected a missing acquisition-time lookup handoff.
The witness proves selected invalid refill rejection, candidate parity and a
fully valid repaired project. Dream tests separately cover pre-N chronology
and the carried lookup's refill domain, without duplicating the complete route
workflow for every mode. Main-session review accepted that division of coverage.
The standalone test fixture's old unvisited hub hammer was replaced with a
legal boon so its later shop-hammer witness no longer relies on the corrected
eligibility gap. Full repository closure and runtime testing remain later gates.

Gate B verification: all 567 Lua tests, 35 focused inventory/refill tests,
`luacheck src/` and diff checks passed. An opt-in probe loading the local native
`FillInShopOptions` body passed both tests: weighted undersupply reproduces the
malformed result, nonweighted narrowing preserves eligible survivors, and the
adapter falls back through native generation without leaking forced providers.
The Well empty-Options check uses a standalone RNG stub; engine RNG behavior
and shrine/refill runtime acceptance remain for in-game testing.

Independent review found no production defect; its native-evidence gap was
resolved by that source-loading probe and accepted on bounded re-review. A
fresh reviewer spawn hit the agent thread limit, so the independent Gate A
reviewer handled Gate B with a focused packet. Failed inventory installation
is diagnostic and cannot complete a Travel Deal refill; native exceptions
still propagate after scope cleanup. Retry consumes native RNG and requirement
diagnostics, but generation does not itself purchase or spawn items. No schema,
protocol or generated execution fixture changes, deployment or commits were
made during Gate B.

Make store inventory eligibility respect the game's persistent Ephyra offered
reward lookup, and prevent narrowed executor inventory groups from causing a
native store-opening crash when a planned item fails native requirements.

This is a focused behavior correction, independent of the approved authoritative
simulation-state refactor. Do not begin that refactor as part of this work.

## Authorities and evidence

Read `docs/design/SIMULATION_AND_VALIDATION.md` in full before engine work.
Relevant specialist authorities are `REWARD_MODEL.md` (N Persistent Hub
Composition, Shops), `CANDIDATE_EVALUATION_MODEL.md` (exact candidate context),
and `GAME_INTEGRATION_BOUNDARY.md` (Mismatch classification).

Source root on this machine: `/home/ayyatma/wsl-projects/modding/1GameData/Scripts`.

- `RoomDataN.lua:1190` invokes `UpdateHubRewardLookup` on hub departure.
- `RoomLogic.lua:5625` unions every offered board reward type into
  `CurrentRun.HubRewardLookup`; visit and acquisition are not prerequisites.
  `AssignRoomToExitDoor` records offered rewards around line 4098.
- No in-run reset was found. New-run initialization replaces `CurrentRun`;
  historical-run save stripping is not an ongoing-run biome reset.
- `StoreData.lua` declares the source-specific consumers below. Generic
  `SpellDropRequirements` and `HammerLootRequirements` in `RequirementsData.lua`
  do not impose a global hub exclusion.
- `StoreLogic.lua:225–247`: an undersupplied weighted group can exhaust its
  selection guard and return `{}`. `SurfaceShopLogic.lua:22–27` subsequently
  calls `UpdateStoreOptionsDictionary`, which iterates `StoreOptions` at
  `StoreLogic.lua:1428` without accepting that malformed result.

The supplied run offers SpellDrop behind open, unvisited N_Combat07, then
authors SpellDrop in the N postboss shrine alongside Hermes. SpellDrop is not
purchased. Native filtering rejects it, leaving one eligible member in a
narrowed two-offer group. The supplied log crashes at StoreLogic.lua:1428.
A bounded probe using the real native generation/dictionary functions and a
stubbed eligibility outcome reproduces that error; this is not an in-game test.

## Required source matrix

These restrictions supplement, rather than replace, each entry's other rules.

| Inventory entry                            | Hub lookup exclusion    | Source                                                |
| ------------------------------------------ | ----------------------- | ----------------------------------------------------- |
| SurfaceShop SpellDrop (all Hermes shrines) | SpellDrop               | StoreData.lua:143–173                                 |
| WorldShop SpellDrop                        | SpellDrop               | StoreData.lua:280–303                                 |
| WorldShop early hammer                     | WeaponUpgrade           | StoreData.lua:231–245                                 |
| I_WorldShop early hammer                   | WeaponUpgrade           | StoreData.lua:371–382                                 |
| Q_WorldShop early hammer                   | WeaponUpgrade           | StoreData.lua:506–517                                 |
| Late hammer entries                        | None from this lookup   | StoreData.lua:247–257; RequirementsData.lua:1261–1296 |
| I_WorldShop / Q_WorldShop SpellDrop        | None from this lookup   | StoreData.lua:349,473                                 |
| Other reward sources                       | No new global exclusion | Their own declarations remain authoritative           |

The late-hammer path still requires the third-or-later entered biome and exactly
one previously acquired hammer. Reaching biome three alone does not restore a
shop hammer. Map native lookup identities deliberately: WeaponUpgrade is not
the planner's WeaponUpgradeDrop spelling.

## Ownership and bounded design

### Planner

- Catalog owns the inventory-entry predicates. Reuse `rewardLookupExcludes`;
  do not modify generic spell/hammer requirements used by unrelated sources.
- Engine owns a chronological, run-persistent lookup and its exact snapshots.
  A completed board contributes all open offered types at the first departure;
  restores are idempotent. A future board must not affect earlier inventory or
  its own generation. Closed targets and unassessed future state do not count.
- Carry the lookup through the existing biome completion/seed boundary,
  including Dream Dive routes where N is not first. Reset on a new simulation;
  upstream edits and Undo rebuild it from the authored run, not a sticky cache.
- Inventory validation, candidates and Travel Deal use the same predicates at
  their existing generation contacts, whether or not the item is purchased.
- Preserve invalid authored inventory and its exact repair capability. React
  consumes normal findings/candidates; no shrine-specific legality patch.

Starting points: `simulation/rewards/biome/prepared-inputs.ts::rewardLookup`
currently derives only the current biome's full board up front;
`biome/generation/hub-board.ts::flushHubBoard`, reward chronology and the route
completion/seed owner establish the proper reached-state handoff. Catalog
starting points are `declarations/rewards/shops.ts`, `requirements.ts`, and
`declarations/rooms/n/completion.ts`. Remove the superseded N-preboss-only
restriction once entry-owned rules replace it; retain unrelated room policy.

### Executor

The inventory adapter owns safe narrowing, not game eligibility. A planned
inventory that cannot be installed is diagnostic, not a new mismatch and not
permission to override native requirements.

Prevent weighted undersupply before invoking the unsafe narrowed native loop.
First test whether copied, fully narrowed groups can use native nonweighted
enumeration while retaining native requirements and the existing exact-item
verification. If supported for all affected group shapes, use that bounded
mechanism; do not build a second eligibility evaluator or invoke random native
requirements twice as a speculative preflight.

If steering cannot produce the expected inventory, return to original native
generation with temporary steering/provider scopes cleared. Prove that any
attempt followed by fallback does not duplicate persistent generation effects,
misbind forced god sources, or falsely complete a Travel Deal obligation. If
native generation is not safely retryable at that boundary, stop and amend the
mechanism before implementation proceeds; do not hide that conflict behind
an empty `StoreOptions` table or an exception catch-all.

Starting points in the game module:
`src/mods/room/features/inventory/{hooks,primitives,hermes_shrine,world_shop,stygian_well}.lua`.
Audit initial inventory and Travel Deal refill paths. Incidental/native-only
contacts continue unchanged. Actual native exceptions retain fault semantics.

## Delivery gates and commit boundaries

### A — Planner eligibility and repair

Implement the persistent lookup and entry-owned declaration matrix as one
vertical correction. Primary tests belong to catalog normalization and engine
reward/history/candidate authorities.

Acceptance:

- Open unvisited SpellDrop blocks shrine and ordinary shop inventories after
  the hub, including N postboss and later biomes; earlier inventory is unaffected.
- I/Q SpellDrop remains eligible when its other requirements pass.
- Offered unvisited hammer blocks the early entries; late entries retain their
  independent acquired-count and ordinal rules.
- Closed board targets do not contribute; restores do not multiply state;
  Dream ordering, upstream reward replacement and Undo preserve exact context.
- Initial and Travel Deal inventories agree with the source matrix.
- A reduced real-plan witness derived from the supplied project produces a
  repairable shrine-inventory finding even with SpellDrop unpurchased. Replacing
  it with a legal option clears that issue; no whole-project golden dump needed.

Run focused catalog/engine tests and one application repair witness. Obtain an
independent review before the planner commit.

### B — Safe executor generation

Prove the native narrowing/fallback strategy above, then implement it and test
shared inventory contacts without broad commerce refactoring.

Acceptance:

- A two-offer narrowed shrine group with one native-rejected member cannot
  enter the native exhaustion path or return a malformed store.
- Failed steering emits bounded expected/observed inventory diagnostics and
  leaves native fallback usable; it does not trigger a new immediate mismatch.
- Fully eligible inventories preserve exact slots, source bindings and delivery
  delays. Initial world-shop/well paths and Travel Deal retain their contracts.
- Fallback cleans forcing scopes and cannot falsely acknowledge an uninstalled
  refill. Checkpoint/transaction policies remain unchanged.
- Include a native-faithful undersupply witness: current happy-path test doubles
  that blindly return every requested option cannot establish this safety.

Run affected Lua tests, then `lua tests/all.lua` and `luacheck src/`. Obtain an
independent review before the executor commit. User performs shrine-opening and
refill runtime testing; report this separately from automated acceptance.

### C — Closure

Run one complete planner `npm run test` / `npm run check` gate after narrow tests
and remediation stabilize. Record existing unrelated failures truthfully.
Review both final diffs for duplicate state, source-global bans, schema churn,
retry side effects and unnecessary UI changes.

Correct the existing hub-lookup explanation in `REWARD_MODEL.md` and put the
source consumer matrix in the existing reward source audit. Update executor
contact documentation only if its supported boundary changes. Do not duplicate
the crash narrative across durable documents. Delete this temporary plan at
closure, retaining verification results in the closure commit; explicitly hand
off any outstanding manual runtime acceptance.

## Non-goals and compatibility

No authored schema or execution-protocol bump is expected: this adds derived
eligibility state, not user choices or wire fields. Previously accepted invalid
plans receive findings, not automatic inventory substitution. Regenerate only
fixtures whose actual semantic product changes and follow fixture formatting
and byte-for-byte mirroring policy.

No authoritative-state refactor, new global reward ban, gameplay-rule override,
commerce payment tracking, new mismatch category, UI redesign, automatic
publication, deployment or push belongs to this plan.
