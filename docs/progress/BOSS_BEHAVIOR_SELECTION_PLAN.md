# Encounter-Owned Boss Customization

Status: Gate A implemented and independently reviewed; the user accepted its
functionality and requested the included Timeline/dialog polish. Runtime
adapters B–D and integrated closure E remain pending. No deployment yet.

Implementation bases: planner `5ad66aa1`, game module `c3e241e`. Unrelated Room
Capture edits are preserved.

Gate A verification: catalog 265 tests; focused engine bundles 64 and 87 tests;
encounter UI/layout 37 tests, with the final dialog changes rechecked by three
focused workflows; package typechecks and changed-source ESLint passed. The
game module passed 509 Lua tests and Luacheck. All 13 execution fixture mirrors
match byte-for-byte with only protocol/fingerprint scalar changes. Independent
review's misplaced-wire-field and retained-choice-label findings were resolved.
The complete repository gate remains scheduled for E.

## Outcome and scope

Show every active encounter row on the Timeline, including fixed ordinary,
passive and Boss phases. Add **Customize encounter** beside the existing
encounter control when that exact resolved encounter declares customization.
The editor configures selected native decisions of that exact encounter; fixed
identity never hides the row or its supported customization.

Include normal and Rival Hecate, Scylla, Cerberus (both howl and burrow), and
Eris. Every decision supports **Default**, meaning no intervention. No other
encounter gains configurable behavior in this delivery.

The governing flow is:

```text
loadout / Vow edit
  -> existing Boss room reconciliation and encounter identity resolution
  -> concrete encounter definition's customization domain
  -> phase-owned authored choices, assessed against that encounter
  -> resolved settings on the published encounter phase
  -> encounter-owned adapter at the native decision
```

The room owns the encounter's location. The encounter owns the available
behavior and its selected customization. Neither the editor nor customization
validation recalculates Rival status independently.

These settings are encounter metadata, not additional player actions or Boss
AI phases on the room Timeline. Native code still decides when attacks happen,
spawns enemies and applies effects. Existing Boss-defeated, encounter-end,
rewards, automatic clocks, DAG obligations and conformance remain unchanged.

## Authorities and current code

Before engine work, read `docs/design/SIMULATION_AND_VALIDATION.md` in full.
Relevant specialist authority:

- `AUTHORED_PROJECT_MODEL.md`: Encounter Choices and Concrete Identity,
  Semantic Addresses, Commands, Ordered reconciliation, Persistence.
- `ROOM_LIFECYCLE_MODEL.md`: Concrete Encounter Preparation and
  Boss/Postboss occurrences. Internal Boss stages are not counted room phases.
- `EDITOR_MODEL.md`: Authored-First Assembly, Readiness, Bound Interactions,
  Findings and Navigation.
- `ARCHITECTURE.md`: Dependency Direction, Construction and Publication,
  Adding a Feature.
- `GAME_INTEGRATION_BOUNDARY.md`: Prefer the Published Answer, Mismatch
  classification, Compatibility.

The existing engine already supplies the ownership path:

- `authored-project/commands/project-state.ts` reconciles completion Bosses
  on a Rivals edit, using `authored-project/completion-boss.ts`.
- Room declarations bind their stable `Encounter` slot to a concrete normal
  or Rival definition. `simulation/encounters/resolve.ts` resolves the slot;
  `preparation.ts` assesses it. Customization consumes this identity.
- `RoomEncounterState` already carries phase-owned leaves.
  `EncounterPhaseAddress` supplies occurrence identity and stable phase key.
- `WorkspaceEncounterPhase` and `EncounterPhaseControl.tsx` already place
  encounter controls in the Timeline, including fixed encounters.
- Execution publication already emits `overview.encounterPhases[]`, with
  concrete identity and slot-local settings such as Fig Leaf.

The execution product's `overview` is not the application's Overview tab.
Putting customization inside its encounter-phase record preserves encounter
ownership without inventing a Timeline transaction or relocating unrelated
protocol products.

## Source facts and native decision matrix

Evidence is in the local `1GameData/Scripts` tree. Symbols are the durable
anchors; line numbers below are navigation aids. Native facts do not prescribe
new planner lifecycle events.

| Decision                     | Normal domain                                              | Rival domain                                                   | Native selection contact                                                                                                 |
| ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Hecate interlude             | Large meteors, small meteors, rings, spirals, laser, cones | Corresponding `_EM` patterns                                   | `HecateStageTransition1`, `EnemyAILogic.lua:6299`; transition two reuses `enemy.MidPhaseWeapon`.                         |
| Scylla featured performer    | Scylla, Roxy (`Drummer`), Jetty (`Keytarist`)              | Those three plus Charybdis                                     | `ApplyScyllaFightSpotlight`, `EncounterLogic.lua:2804`; flags in `EnemyData_Scylla.lua`.                                 |
| Cerberus howl                | 8 small, 4 medium, or 1 large corrupted shade              | Corresponding elite shades                                     | `InfestedCerberusHowlSummonSelector`, `WeaponData_InfestedCerberus.lua:1414`; its chosen attack uses `SpawnBurstOnFire`. |
| Cerberus burrow intermission | `CerberusSpawns01..05`                                     | `CerberusEMSpawns01..04`                                       | Stage `RandomSpawnEncounter` in `EnemyData_InfestedCerberus.lua:379`, consumed by `StagedAI` before `CerberusStageExit`. |
| Eris early summons           | `ErisSummon01/02`                                          | `ErisEMSummonHarpy/Swab/Jellyfish/Turtle`                      | Early selectors in `WeaponData_Eris.lua:784,953`; Rival also reaches the selector through a grenade chain.               |
| Eris late summons            | `ErisSummon03/04`                                          | `ErisEMSummonFishmanRanged/FishmanMelee/FishSwarmer/Automaton` | Late selectors in `WeaponData_Eris.lua:806,978`; Rival also reaches the selector through a grenade chain.                |

Preserve these distinctions:

- Hecate has two interludes but one selected pattern. Transition two's Polymorph
  stays native. Some patterns have prior-clear requirements in
  `WeaponData_Hecate.lua`; Rival variants inherit their base declarations.
- Scylla overrides its random selection with Jetty on the first normal fight
  and Charybdis on the first Rival fight. Steering only the random draw is
  insufficient for the agreed explicit-choice policy.
- Cerberus howl is a real first-phase summon, not the burrow intermission.
  It has `RequireTotalAttacks = 12` and `MaxUses = 1`; a fast phase may never
  use it. The separate phase-two howl selector is commented out of active
  weapon lists and is not exposed.
- Normal Cerberus burrow sets are four elite Lamias, two elite Lycanthropes,
  three elite Mourners, four elite Lovesick, or nine elite small shades plus
  fog. Rival sets are five elite Pitchers, six elite Wave Fists, five elite
  Grenadiers, or seven elite Self-Destruct enemies. Use verified game display
  names in the editor, not these internal identifiers.
- The Rival burrow list repeats `04` and omits declared `05`. Only four
  distinct results are selectable; Default retains native weighting. Normal
  burrow begins at 50% health, Rival at 65%; timeouts and re-emergence stay native.
- Both normal and Rival Eris have summons. Each early/late selector permits at
  most two uses; each concrete variant permits one. Native weapon history
  governs those limits. Fast combat can skip uses. The Automaton variant's
  internal enemy-type draw is not part of this feature.

## Chosen customization contract

### Default and explicit selection

Default is omission, not a stored sentinel or an automatically chosen result.
Each decision is independent. Existing documents load with no overrides,
and unsupported encounters receive no empty customization object. Absence is
also the current representation for a newly authored Default, not legacy-data
handling. This additive feature requires no authored-schema bump or migration.

An explicit Hecate or Scylla choice overrides the save-progression selection
restrictions described above; the user approved this policy. Default preserves
those restrictions. Do not mutate save clear counts, add save-profile inputs,
or disable unrelated eligibility checks.

An authored choice selects the outcome only if native gameplay reaches its
decision. It does not require the move to occur. Never schedule an attack,
force readiness, change health thresholds, or create an unresolved transaction
because a summon was skipped.

### Eris ordered choices

Early and Late each accept a dense prefix of zero, one or two distinct choices
from that encounter's declared domain. Zero means Default. A first choice with
no second choice leaves the remaining use native. A second choice cannot exist
behind a Default first choice.

Positions mean successive actual uses of that selector, not health phases or
AI-data reads. Native weapon history determines the next use and enforces
one-use variants. Repeated input queries must not consume a selection; no
parallel attack clock or authored-use counter is introduced.

### Encounter-local persistence and repair

Persist sparse customization by stable phase key inside
`RoomOccurrence.encounters`, following the existing phase-owned leaf pattern.
Use the closed selection shapes below with declaration-owned decision and
choice keys. A decision's identity does not determine its React component.
Do not persist native function names, AI stage indexes, Rival flags, UI state,
or a second selected encounter identity in each setting.

Commands identify the existing `EncounterPhaseAddress` and the decision being
edited. Fixed identity and editable customization are separate capabilities.
Structural decoding checks owner/phase, closed kinds and keys, duplicate
decisions, and Eris prefix bounds. Commands remain structurally driven; they
must not invoke simulation or require successful contextual evaluation.

Current option support and native operands come from the resolved encounter.
Do not find a matching behavior by scanning other phases or union normal/Rival
options for the active picker. Declaration-known retained values may still be
structurally representable when not supported by the current variant.

On an upstream edit:

- compatible choices remain on the same stable phase;
- a same-family choice unavailable in the new variant remains visible with a
  repairable finding, rather than being changed or silently discarded;
- structural replacement reconciles only compatible phase/family ownership;
  deleting an occurrence removes its settings with the occurrence;
- dormant phases emit no active settings or findings.

Semantic keys must retain their meaning across variants. A common pattern may
have different native IDs, but an ordinal such as wave 1 must not silently
switch to a different enemy family.

A contextual finding belongs to the exact encounter phase with the affected
decision identified in its evidence. The application uses the phase as the
single repair target: navigation opens its Timeline and focuses/highlights the
Customize encounter button; the popup remains a deliberate manual action.
Default always provides a repair path. Missing customization is never an
incompleteness finding.

### Declaration-driven capability

An Encounter Definition's customization declarations are the capability. No
separate show-button flag, Boss-name allowlist, room-template check or
customization-local Rival calculation controls the editor.

Each decision declares its semantic key, verified display label, choices and
selection constraints. Choices carry semantic identity, display label and the
native operand needed by their adapter. This delivery supports two selection
shapes:

- a single optional choice, with omission meaning Default;
- a bounded ordered prefix of distinct choices, with an empty prefix meaning
  Default. Eris declares Early and Late as independent decisions of this shape.

These are domain constraints, not widget descriptors: no dropdown names,
component references, CSS, popup layout or executable callbacks enter catalog
data. The engine owns structural validation and contextual support; the
application adapts the resulting data into one shared editor.

Adding an encounter that uses these shapes requires its catalog declarations
and native realization, not another editor or decision-specific wiring through
every layer. A genuinely new selection shape requires an explicit contract
extension. Do not implement hypothetical shapes or normal-combat customization
in anticipation of that work.

## Ownership and publication

| Owner                            | Responsibility                                                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog                          | Closed customization domains on concrete Encounter Definitions, verified labels, semantic keys, native operands and bounded Eris choices.           |
| Authored engine                  | Phase-owned persistence, structural commands/codecs, defaults, reconciliation and Undo/Redo.                                                        |
| Encounter resolution/preparation | Resolve identity through the existing authority, then assess customization against that definition and return phase-owned settings/findings.        |
| Canonical/materialized product   | Carry the complete encounter-local product explicitly. Retain authored repair data without pretending invalid settings are executable.              |
| Execution compiler/codec         | Publish optional resolved customization inside the matching `overview.encounterPhases[]` record. Preserve its slot and concrete encounter identity. |
| Application/React                | Adapt the encounter's domain and authored values into controls, bind commands/readiness and provide exact finding navigation.                       |
| Game module                      | Consume settings through existing native encounter binding, then steer the corresponding native decision.                                           |

No room-wide settings sibling, lookup by first matching Boss in a room, compiler
back-read into raw authored state, or parallel Rival resolver. Invalid settings
prevent valid publication; the compiler must not silently drop them to make a
plan publishable.

The shared declaration-driven path is part of this delivery. It does not imply
generic AI properties, arbitrary scripts, a plugin registry, a general-purpose
settings framework or an event bus.

### Timeline presentation

Keep the existing encounter label/selector. Add Customize encounter alongside
it when the resolved encounter declares customization, retaining a repair entry
point for incompatible stored settings. Open one shared compact popup whose
contents come from those declarations. Render by the two supported selection
shapes, never by Hecate/Scylla/Cerberus/Eris identity. Early/Late are declared
Eris decisions, not a separate bespoke Eris editor. Changes apply through
normal commands and Undo; no separate Save/Discard draft.

Opening/closing is UI-session state. No duplicate Overview controls, separate
tab, reorderable customization row or forced expansion of every setting.
Encounter selection and customization remain distinct affordances.

Readiness comes from the existing encounter owner's authoring region. Do not
use selected-room status or successful evaluation as a substitute. Invalid
settings cannot hide the encounter row/editor; unknown context cannot be
presented as a validated option domain. Findings must open the correct Timeline
and focus the Customize encounter control from either another room or another
tab in this room; they do not open the popup automatically.
Every active phase remains visible even when it is fixed and has no additional
control; only semantic dormancy removes a row.

## Native realization

Use encounter-owned adapters under `room/timeline/encounters`. Obtain the
published phase through the existing binding between native encounter objects
and planner phases; do not introduce another room cursor or recover identity
from an authored-order scan. Any new access capability must stay narrow.

| Adapter              | Required intervention and preserved native behavior                                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hecate               | Supply the selected first-interlude pattern at its native local input/result boundary, including the agreed progression override. Preserve weapon setup and native reuse at the second transition.                            |
| Scylla               | Supply the selected flag through the native spotlight boundary, accounting for first-fight overrides. Native code applies music, visuals, effects and AI changes once.                                                        |
| Cerberus burrow      | Prepare the encounter-owned enemy's stage selection before `StagedAI` consumes `RandomSpawnEncounter`, including native Rival override precedence. `CerberusStageExit` is too late. Native code starts/ends the spawned wave. |
| Cerberus howl / Eris | Narrow the exact selector's conditional-data-resolved local `GetWeaponAIData` input before the chained draw in `DoAttackerAILoop`. Preserve eligibility, burst contents/locations and native usage limits.                    |

Prove each actual caller/consumer order before installing a hook. Prefer local
native input/result insertion, then narrowly scoped RNG steering if necessary.
Never mutate shared `EnemyData`, `WeaponData` or `EncounterData`, replace a
whole AI loop, or reproduce native spawning.

A threaded scope requires concrete justification: missing context at a single
contact, exact consumer, retirement point and coroutine-isolation witness.
Do not add one merely to reach a convenient hook.

Default, no-plan and desynchronized sessions pass through. Native infrastructure
errors propagate. An unexpected unsupported runtime selector may emit a bounded
diagnostic and pass through, not a new gameplay mismatch. Known deterministic
overrides must be implemented, not concealed by such a diagnostic.
Burrow subencounters must not rebind or advance the outer planner Boss phase.

## Delivery gates and acceptance

On resumption, reshape the retained catalog choice data and supporting types
into declared single-choice and ordered-prefix decisions, then build the
phase-owned path. The previous room-wide implementation is not a compatibility
target. Preserve unrelated work; do not restore its superseded wiring.

Use the repository gate routine: focused packets, one writer, narrow tests,
fresh independent review after stabilization, bounded remediation and main-session
oversight. Keep full rule matrices with their owner and representative workflow
witnesses in consumers.

### A — Encounter-owned planner, editor and protocol

Deliver one complete catalog -> phase-owned authoring -> encounter assessment
-> Timeline editor -> published encounter -> Lua decoder path for all included
decisions. Do not land an interface-only or forwarding layer.

Primary acceptance:

- Catalog domains distinguish normal/Rival definitions and reachable choices.
- Declared capability controls the button, including fixed encounters. The
  shared popup renders single-choice and ordered-prefix decisions from their
  declarations without encounter-name branches or a parallel UI option list.
- Commands/codecs prove exact phase ownership, structural bounds, Default
  omission, repairable invalid values, reconciliation and Undo/Redo.
- A real Rivals edit uses existing Boss reconciliation, changes the resolved
  encounter/domain, preserves compatible choices and retains an incompatible
  Scylla choice for repair. No customization-local vow calculation.
- Phase addressing is tested directly; supported fixed encounters remain
  customizable, and ordinary fixed/passive/Boss encounter rows remain visible.
  Do not fabricate a multi-Boss room to prove isolation.
- A real editor workflow sets a choice, changes Rival, follows the resulting
  finding to its highlighted Customize encounter control, repairs it,
  saves/reloads and publishes. Include an Eris prefix
  workflow and incomplete-predecessor readiness at the interaction root.
- Publication and both decoders agree on encounter-local placement, closed
  payloads and Default neutrality. No additional action/clock/ledger effects.

Keep the authored-schema version unchanged. Omitted customization is valid in
old and new documents; when present, its fields are strictly decoded. No
version-specific defaults, migration utility or legacy representation is needed.
An older application rejects customized documents through its unknown-field
check rather than silently losing their settings.

Bump the execution protocol once when the replacement wire contract lands, not
per adapter gate. Do not retain the discarded intermediate wire format or add
dual decoding. Refresh authored checkpoints only if their content changes, not
for a schema scalar. Generate only affected execution products, preserve
repository Prettier, refresh fingerprints through owning utilities, and mirror
fixtures byte-for-byte.

Starting neighborhoods: catalog `declarations/encounters/{f,g,h,o}.ts`,
`compiler/encounters/definitions.ts`; engine `catalog-schema`,
`authored-project/room-state`, encounter commands and Boss reconciliation,
`simulation/encounters/{model,resolve,preparation}.ts`, materialization,
`execution-plan/{model,assembly/overview,codec/overview}.ts`; application
`structured-workspace` encounter projection/binding and
`ui/editor/biome/locals/EncounterPhaseControl.tsx`; game module
`src/mods/protocol/overview.lua`.

Commit coherent planner and matching decoder changes separately by repository
after review. Intermediate decoded-but-unrealized settings are not a delivered
feature; do not deploy/release until their adapters are implemented.

### B — Hecate and Scylla realization

Implement their selection adapters. Prove normal/Rival domains, explicit
progression override versus native Default, Hecate's one selection/two
transitions, and Scylla's first-fight branches with one native application.
Cover correct phase binding, pass-through, native errors and shared-data
immutability. Independent review, then a focused game-module commit.

### C — Cerberus realization

Implement both howl and burrow decisions independently. Prove four reachable
Rival wave choices, local stage override precedence, spawn-before-transition
timing, optional-howl readiness and no additional planner phase/clock effects.
Preserve native timeouts and re-emergence. Independent review, then a focused
game-module commit.

### D — Eris realization

Implement early/late prefixes for normal and Rival paths. Prove zero/one/two
choices, distinctness, native tail, repeated AI-data reads, actual-use history,
skipped uses and unchanged Automaton sub-selection. Independent review, then
a focused game-module commit.

### E — Integrated verification and consolidated closure

- After narrow tests/review stabilize, run planner `npm run test` and
  `npm run check`, and game-module `lua tests/all.lua` / `luacheck src/`.
  Record truthful results; do not repeat full suites just for review evidence.
- Use representative Underworld and Surface publication witnesses rather than
  one fixture per option. Inspect fixture diffs and verify mirrored bytes.
- Live-test explicit/Default normal and Rival choices, Hecate reuse, Charybdis,
  both Cerberus decisions, and Eris partial/skipped uses. Save-progression
  branches not reproducible on the available save need source-based harness
  evidence, clearly distinguished from live acceptance.
- Consolidate overdue closure for delivered pending plans, including Hub
  editor after B.2 and postboss resynchronization. The user confirms postboss
  resync already passed in-game. Inventory remaining acceptance for every
  pending plan, reconcile status with evidence and retire completed plans.
  Do not declare genuinely unfinished work complete merely to delete its plan.
- Promote source facts into the owning encounter audit and update the
  feature-to-hook matrix. Integrate encounter-local ownership into the smallest
  relevant design sections; no per-fix narratives or duplicated evidence.
- Delete this temporary plan at closure. Retire completed investigations and
  pending plans in the same closure change; preserve unresolved work explicitly.

## Review criteria

Reject a delivery that:

- treats room identity or a second Rival calculation as customization authority;
- moves only the JSX while retaining room-wide settings/publication;
- duplicates catalog domains in boss-specific editors or button allowlists;
- makes fixed identity mean non-customizable, or hides invalid repair controls;
- guesses another phase's settings or silently substitutes an unavailable choice;
- converts optional native attacks into required actions or adds Boss AI ticks;
- overrides progression under Default, or native timing/use limits when explicit;
- creates a generic combat framework, shadow usage counter or yielding AI wrapper
  without a proven requirement;
- leaves superseded room-feature wiring alongside the encounter-owned path.
