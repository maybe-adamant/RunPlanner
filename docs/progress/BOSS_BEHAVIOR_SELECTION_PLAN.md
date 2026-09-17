# Optional Boss Behavior Selection

Status: execution-locked by user approval. Gate A is next. Explicit choices
override save-progression selection restrictions; Eris uses the bounded
ordered-prefix contract below.

Planning bases: planner `7aa15e5e`; Run Planner game module `c3e241e`.
Unrelated Room Capture and Hub work is outside this plan.

## Objective and scope

Add a small **Boss behavior** section to a supported Boss room's Overview.
Users can leave every setting at **Default**, or select particular native
combat outcomes. Default means no intervention, not a planner-selected default.

Included: normal and Rival Hecate, Scylla, Cerberus, and Eris. The actual
resolved Boss encounter determines support, not a second calculation of Vows
in React or the executor. Other bosses have no new controls.

The feature selects outcomes when the game reaches their native decision.
It does not schedule attacks, guarantee an optional summon happens, change
health thresholds, spawn enemies itself, or add Boss AI phases to the room
Timeline. Existing Boss-defeated, encounter-end, rewards, clocks and conformance
remain unchanged. No new transaction obligations or mismatch checks are needed
for whether a combat move occurred.

## Governing authorities

- `docs/design/ARCHITECTURE.md`: Ownership, Construction and Publication,
  Adding a Feature.
- `docs/design/SIMULATION_AND_VALIDATION.md`: read in full before engine work;
  in particular Authored State Is Not Evaluated Truth and Materialization.
- `docs/design/AUTHORED_PROJECT_MODEL.md`: Encounter Choices and Concrete
  Identity, Occurrence State and Replacement, Persistence and Validation.
- `docs/design/ROOM_LIFECYCLE_MODEL.md`: Boss/Postboss occurrences and Judgment.
  Internal Boss AI stages are not additional counted encounter phases.
- `docs/design/EDITOR_MODEL.md`: Readiness, Bound Interactions, Findings and
  Navigation. Retained invalid settings must remain repairable.
- `docs/design/GAME_INTEGRATION_BOUNDARY.md`: Prefer the Published Answer,
  Mismatch Classification, Compatibility.

Native evidence below is from `1GameData/Scripts` in the local modding workspace.
Symbols are the source anchors; line numbers are investigation conveniences.

## Source facts and selection matrix

| Decision                     | Normal fight                                                             | Rival fight                                                    | Native owner and timing                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hecate interlude attack      | Six patterns: large meteors, small meteors, rings, spirals, laser, cones | Six corresponding `_EM` variants                               | `EnemyData_Hecate.lua:309`; `HecateStageTransition1` in `EnemyAILogic.lua:6299` chooses once. `HecateStageTransition2` reuses `enemy.MidPhaseWeapon` alongside native Polymorph. |
| Scylla featured performer    | Scylla, Roxy (`Drummer`), Jetty (`Keytarist`)                            | Those three plus Charybdis                                     | `ApplyScyllaFightSpotlight` in `EncounterLogic.lua:2804`, using `EnemyData_Scylla.lua` phase-two `Flags`. Native code applies presentation, effects and AI flags.                |
| Cerberus howl summon         | Small, medium or large corrupted shades                                  | Corresponding elite shades                                     | `InfestedCerberusHowlSummonSelector` in `WeaponData_InfestedCerberus.lua:1414`; native attack readiness and a one-use limit apply.                                               |
| Cerberus burrow intermission | `CerberusSpawns01` through `05`                                          | `CerberusEMSpawns01` through `04`                              | `EnemyData_InfestedCerberus.lua:379`; `StagedAI` selects `RandomSpawnEncounter` before calling `CerberusStageExit`.                                                              |
| Eris early summon group      | `ErisSummon01/02`: Harpy Cutter / Drunk                                  | `ErisEMSummonHarpy/Swab/Jellyfish/Turtle`                      | `WeaponData_Eris.lua:784,953`; ordinary AI exposes the early selector during phases one/two. Rival phase-two grenade transition chains into its early selector.                  |
| Eris late summon group       | `ErisSummon03/04`: Stickler / Swab                                       | `ErisEMSummonFishmanRanged/FishmanMelee/FishSwarmer/Automaton` | `WeaponData_Eris.lua:806,978`; ordinary phases three/four expose the late selector. Rival phase-three grenade transition chains into its late selector.                          |

Important qualifications:

- Hecate has two interludes but **one authored attack choice**, not independent
  choices for each transition. `WeaponData_Hecate.lua` gates some normal
  patterns behind prior Hecate clears; Rival variants inherit their base data.
- Scylla's function overrides its random result with Jetty for the first
  ordinary fight and Charybdis for the first Rival fight. A random-pick hook
  alone cannot reliably implement an explicit performer choice.
- Cerberus's Rival list contains `CerberusEMSpawns04` twice and omits `05`.
  Although `EncounterData_Boss.lua` declares `05`, it is not an authorable
  native draw. Preserve native weighting under Default; do not repair game data.
- Normal Cerberus intermission sets contain, respectively: four elite Lamia,
  two elite Lycanthropes, three elite Mourners, four elite Lovesick, or nine
  elite small shades plus a FogEmitter. Rival reachable sets contain five
  elite Pitchers, six elite Wave Fists, five elite Grenadiers, or seven elite
  Self-Destruct enemies. Presentation should use verified friendly names.
- Cerberus's normal burrow threshold is 50% health; Rival overrides it to 65%.
  Native intermission timeouts and re-emergence remain untouched. The separate
  phase-two howl selector is not equipped in the inspected active phase lists;
  do not expose unused declarations just because they exist.
- Both normal and Rival Eris have summons. Each selector allows at most two
  uses, and each concrete summon variant allows one. `IsEnemyWeaponEligible`
  checks `enemy.WeaponHistory`; the executor must not implement a second limit
  system. Attack readiness means ordinary summons can be skipped by a fast kill.
- Rival Eris's Automaton choice itself draws between two Automaton types.
  This plan selects the summon family, not every individual enemy inside it.

## Agreed policy and authoring shape

### Default and explicit settings

Every control independently supports Default. Entirely default Boss behavior
has no stored override and emits no execution instruction. Existing plans
migrate without selecting any behavior. A selected native outcome does not
become a required action: if the game never reaches that selector, no action is
manufactured and no mismatch is raised.

**Agreed — save progression:** an explicit Hecate/Scylla choice wins over their
save-progression selection gates, while Default preserves them completely.
This is a narrowly scoped selection override, not permission to mutate
`GameState` clear counts or disable general requirements. Do not add save-profile
inputs to the planner. Attack timing, readiness and native use limits remain
game-owned; those are not save-progression restrictions.

### Eris authoring

Two independent groups, Early summons and Late summons. Each stores a dense
ordered prefix of zero, one or two distinct variants from its declared pool.
Zero is Default. An empty second position means the remaining selection stays
native; a forced second choice cannot exist behind an unspecified first choice.

The first and second choices refer to uses of the native summon selector, not
elapsed time or Boss health phases. Restrict the next native selection to the
authored variant while the prefix remains. After it is consumed, leave the
remaining eligible pool native. Native weapon history is the evidence of
actual use; querying AI data must not consume a prefix entry. No extra cursor,
attack scheduler, artificial attack, or requirement override for use limits.

This bounds the control without requiring a full attack script. A room may end
without consuming the prefix. Tests must cover repeated data reads and skipped
summons, not only the two-use happy path.

## Ownership and data flow

| Owner                      | Product and boundary                                                                                                                                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog                    | Explicit closed behavior domains on the concrete Boss Encounter Definition: supported decisions, friendly source labels, variant domains, native result identities and bounded Eris prefix size. No generic arbitrary AI-property editor.            |
| Authored engine            | Sparse boss-specific settings on the owning occurrence's encounter state; exact semantic commands/addresses, structural codecs, defaults, replacement reconciliation and Undo. Persist semantic choice keys, not function names or AI stage indexes. |
| Simulation/materialization | Validate support against the resolved Boss encounter and carry the complete selected settings to the canonical room product. These choices do not add inventory deltas, history events, possibility branches or encounter-depth ticks.               |
| Execution compiler/codec   | Translate validated settings to a closed, optional Boss-behavior product on the occurrence Overview, resolving declared native identities. No inferred intent, arbitrary Lua payload, or Timeline transaction for a Boss move.                       |
| Application/React          | Project supported controls and bind complete commands in Boss Overview. Use existing single-select and compact ordered-choice controls; no Save/Discard draft, engine logic or parallel finding destination.                                         |
| Executor                   | Encounter-owned Boss adapters read the active occurrence's settings and supply the selected native operands. No changes to route/navigation, the generic room Timeline, or conformance semantics.                                                    |

Use a small discriminated Boss-specific contract. Do not create a configurable
AI framework, arbitrary property paths, an event bus, or parallel normal/Rival
simulation. Shared validation may enforce declared domains and prefix shape;
it must not interpret native attack eligibility.

Normal/Rival replacement follows existing room/encounter reconciliation:
retain compatible semantic choices (for example Hecate's pattern), remove
structurally foreign family payloads, and retain representable choices that
become context-invalid with an exact repair finding. Do not silently switch a
chosen performer or wave to a different result. Default is always repairable.

### Focused starting files

- Catalog: `packages/hades2-catalog/src/declarations/encounters/{f,g,h,o}.ts`,
  `encounters/types.ts`, `compiler/encounters/definitions.ts`;
  normalized contract `packages/planner-engine/src/catalog-schema/index.ts`.
- Engine: `authored-project/model.ts`,
  `room-state/decoding/encounter-state-codec.ts`,
  `room-state/encounter-reconciliation.ts`, the existing semantic command
  neighborhood, and `simulation/encounters/preparation.ts` under engine `src/`.
  Follow the actual retained/canonical encounter product to publication; do
  not add a compiler back-read into raw authored state.
- Execution product: engine `execution-plan/model.ts`, `assembly/overview.ts`,
  `codec/overview.ts`; executor `src/mods/protocol/overview.lua`.
- Application: `apps/planner/src/projections/structured-workspace/assembly/`,
  its interaction bindings, and
  `ui/editor/biome/room-features/RoomFeaturesWorkbench.tsx` / the owning Overview
  composition. Add a local Boss section, not a new top-level tab.
- Executor: `src/mods/room/timeline/encounters/hooks.lua` and the Boss
  neighborhood. Existing `boss.lua` owns death/Arcana behavior; do not mix
  unrelated attack selectors into that coordinator. Group new boss behavior
  adapters together only to the extent needed by these four actual consumers.
- Tests mirror each owning source neighborhood. Use `schema/README.md` and
  the current migration scripts for the single offline authored migration.

## Native intervention contract

Prefer direct native input/result insertion over additional global RNG hooks.
Never mutate shared `EnemyData`, `WeaponData` or `EncounterData` declarations.

- **Hecate:** intervene at `HecateStageTransition1`'s selected interlude result
  or its local choice input. Keep `MidPhaseWeapon` and equipped options
  consistent; the second transition remains native. Cover progression gates
  according to the agreed policy without replacing the transition body.
- **Scylla:** use `ApplyScyllaFightSpotlight`'s native flag-data input/selection
  boundary. Account for both first-fight overrides; let the same native code
  apply effects, spotlight, music, presentation and weapon changes exactly once.
- **Cerberus intermission:** select the declared encounter before `StagedAI`
  consumes `RandomSpawnEncounter`. `CerberusStageExit` is too late: the native
  spawn request precedes it. Prefer encounter-owned enemy stage data prepared
  before that choice, including Rival overrides, over wrapping the whole
  yielding AI loop. Native code starts the encounter and owns its termination.
- **Cerberus howl / Eris:** `GetWeaponAIData` returns local, conditional-data-
  resolved attack inputs; the chained-weapon selection in `DoAttackerAILoop`
  is the consumer. Narrow the exact summon selector's local choice input, not
  unrelated attacks or the spawner's lifecycle. Preserve eligibility, native
  one-use limits, burst sizes, locations and ordinary timing.

At implementation preflight, prove the selected seam using the native caller
order. Do not treat a likely hook name as sufficient evidence. If a threaded
scope is truly necessary, name its unavailable context, exact consumer,
retirement point and coroutine-isolation witness before adding it.

Desynchronized/no-plan/default sessions pass through. Native infrastructure
errors propagate. An unexpected unsupported runtime selector may produce a
bounded diagnostic and pass through, not a new gameplay mismatch or fabricated
combat action. Known deterministic override paths must be solved, not hidden
behind that diagnostic.

## Delivery gates and commit boundaries

Use focused executors and fresh independent review under the repository gate
routine; give them this gate's exact paths and source symbols, not broad history.
One writer at a time. Reuse the same executor for bounded remediation.

### A — Planner settings, editor and publication

Deliver the complete catalog → authored commands/codec → retained/canonical
product → Overview controls → execution product path for all six decision
families. Include strict Lua decoding of that product so both consumers agree.
Use one authored-schema migration and one protocol bump for the whole feature,
with the existing catalog compatibility mechanism. Do not bump per Boss.

Primary acceptance: declaration domains, semantic commands/reconciliation,
codec/migration, default neutrality, exact finding destinations, Eris uniqueness
and prefix repair, save/reload and Undo/Redo, execution round-trip and Lua decode.
Use representative real Underworld and Surface plans to exercise publication.

Commit the coherent planner feature and matched executor decoder separately by
repository after review. Intermediate development heads are not deployable
completion: do not publish a release or declare behavior delivered until every
non-default decoded setting has its adapter below. No temporary compatibility
flags or silent decoder drops.

### B — Hecate and Scylla native realization

Deliver their small selection adapters with normal/Rival and agreed
save-progression-policy witnesses. Prove Hecate chooses once/reuses once and
Scylla applies one native performer including first-fight branches. Test native
errors, inactive/default pass-through and no shared declaration mutation.
Independent review, then one focused executor commit.

### C — Cerberus native realization

Deliver independent howl and burrow-wave controls. Cover normal/Rival domains,
four reachable Rival intermission sets, Rival stage override precedence,
spawn-before-transition timing and native optional-howl readiness. Preserve
native intermission timeout/re-emergence and main Boss encounter identity;
spawned enemies must not advance planner room phases or automatic clocks.
Independent review, then one focused executor commit.

### D — Eris native realization

Deliver both native selector groups using the ordered-prefix contract. Cover
normal/Rival paths, one/two authored picks, distinctness, native tail after a
partial prefix, repeated AI-data reads, one-use history, selectors never reached,
and native Automaton sub-selection. No internal attack timing engine.
Independent review, then one focused executor commit.

### E — Integration, live verification and closure

- Consolidate overdue closure for all delivered work still represented by
  pending plans, including `HUB_MAP_EDITOR_PLAN.md` (after B.2) and
  `POSTBOSS_RESYNCHRONIZATION_PLAN.md`. The user confirms postboss resync has
  already passed in-game testing; reconcile its stale status with that evidence.
  Inventory remaining acceptance and documentation work, share applicable
  closure checks, promote only durable facts, and retire the completed plans
  together. Do not mark genuinely unfinished work complete merely to remove a
  plan.
- Primary rule matrices remain in catalog/engine or owning adapter tests.
  Application/product tests prove representative handoffs, not copied matrices.
- Keep default execution fixtures semantically unchanged except the protocol/
  catalog scalar when required. Add configured behavior to representative
  Underworld and Surface witnesses; do not create one giant route or a fixture
  per option. Generated JSON uses repository Prettier and byte-identical mirrors.
- Run focused lanes while developing; once stable run `npm run test` and
  `npm run check` in the planner, plus `lua tests/all.lua` and `luacheck src/`
  in the executor. Record truthful results, not assumed live coverage.
- Live probes: explicit/default normal and Rival Hecate; Scylla performer
  including Charybdis; normal/Rival Cerberus howl and burrow wave; Eris early/late
  groups including a partial prefix and a fast fight that skips a summon.
  First-fight/save-progression paths need source-based harness witnesses where
  the available save cannot reproduce them; label those as non-live evidence.
- Promote the settled source matrix to the existing encounter source audit,
  update the feature-to-hook map, and integrate only the new optional-settings
  ownership into the smallest design sections. Do not append per-fix narratives.
- Delete this temporary plan at closure. No unfinished feature guards,
  speculative hooks, duplicate catalogs or independent AI state machines remain.

## Adversarial checks before locking

1. Hecate is one choice, not one roll per interlude.
2. Scylla first-fight overrides cannot bypass the explicit setting unnoticed.
3. Cerberus exposes reachable draws, not every declared spawn encounter.
4. Eris is not Rival-only, and a constant repeated mob choice violates native
   one-use limits; incomplete prefixes cannot hide an uncontrolled first pick.
5. Optional AI use is not a Timeline obligation. Skipping a summon is valid.
6. Default stores/publishes no forcing instruction and needs no required edit.
7. Existing Boss lifecycle and downstream state are unaffected by selector
   configuration; no combat simulation or generic Boss scripting framework.
8. The settings remain independently repairable after upstream Vow/room edits,
   and prior-room exits do not require authorship of future Boss choices.
