# Run Planner

Run Planner is a standalone Hades II route-authoring and simulation
application for Run Director.

The application owns:

- route, biome, room, encounter, and reward declarations;
- unified biome-decision authoring, including Ephyra Hub;
- deterministic game-language materialization and history;
- possibility, force, eligibility, and reward-store evaluation;
- semantic validation, findings, and contextual candidate feedback;
- project profiles, autosave recovery, and undo/redo;
- the future compilation of a declarative execution-plan document.

The game module is intentionally outside the current implementation scope. It
will eventually consume a validated execution plan through fixed runtime
adapters and audit the real run against the app's simulation. It will not own a
second planner or simulator.

## Current Product

All eight route biomes participate in the production catalog and complete
application loop:

```text
Underworld: F -> G -> H -> I
Surface:    N -> O -> P -> Q
```

Each route participant has declarations, authored state, simulation,
candidates, editor projection, profile persistence, recovery, and semantic
finding navigation. The editor uses one shared workspace for ordinary and Hub
decisions, including H's fixed-count Fields decisions, I's generated Preboss
peer, O's ordered ship encounters and reward wheels, Q's staged progression,
and N's persistent ranked Hub board, side rooms, and WorldShop.

The browser application remains the primary development host. A permission-minimal
Tauri 2 shell packages the same application as a no-install Windows preview;
native desktop file integration and the app/game execution boundary remain
deliberate later steps.

Oceanus Anomaly replacement, the selected Midshop Zagreus contract, and
natural Chaos are supported closed detours. Natural Chaos is an occurrence-owned
additional exit on declared N/F/G/P source rooms: it may be skipped or selected,
enters a concrete Chaos room, then resumes through a fresh ordinary host target.
All detours preserve normal-door takeover and completion ownership.

Both routes author one mandatory fixed rank-III (`Epic`) keepsake and reached
nonfinal Postboss retain-or-replace frontiers. All 33 ordinary identities
participate in chronology, no-return legality, and Fated policy. Jeweled Pom,
Experimental Hammer, Calling Card, Time Piece, Fig Leaf, and Gorgon Amulet add
source-backed four-rank effect profiles, simulation, findings, and Run State.
Cherished Heirloom advances the current supported effect on acquisition and
uses rank IV (`Heroic`) when a supported keepsake is equipped later.

Echo is supported as a player-rarityless eight-choice Story provider. Its
direct, previous-run-boon approximation, exact last-reward replay, World Shop
duplication, and captured-keepsake replay effects all use the existing trait,
reward, acquisition-site, keepsake, candidate, finding, and Run State
authorities. Gift Gift Gift replays the four supported eligible effects at
biome start and retains the other eligible keepsakes as effect-neutral captured
history until their individual effect slices are implemented.

Hera's All Together, the Zagreus Infernal Contract, and Hermes's Travel Deal
are also supported. All Together resolves one exact
rarityless Infusion from each non-exhausted declaration-owned pair without
changing god-pool history. Qualifying World Shops retain their declaration-owned initial
inventory and add the free Contract pedestal, one source-derived Travel refill,
and Echo's stable `echoDoubleShopReward` pickup as supplemental rows. Payload
and participation are authored on those rows, while one shared Acquisitions
order owns chronology; Gold materializes from the first accepted paid
non-Spell purchase before that source's acquisition effects and may be picked
up later among the other room entries.

Authored schema 41 also closes the Narcissus, Mourning Fields, and Artificer
surface. Narcissus exposes every pickup consequential to Time Piece or
Artificer, including producer-owned Psyche without adding it to a counted
store. Each Fields combat room owns its exact optional-pickup capacity,
retained optional inventory, and one action chronology that interleaves atomic
cage completion with cage, optional, and Artificer-replacement interactions.
Optional offers consume the persistent `FieldsOptionalRewards` bag when they
spawn and remain history-neutral when left behind.

The Artificer uses one mutually exclusive acquisition disposition beside
ordinary pickup and Time Piece. A successful free-source conversion spends one
rank-derived Arcana use, consumes the current `RunProgress` bag, destroys the
source without acquiring it, and creates a separately acquired replacement.
Epic supplies three uses; Lazuli's Heroic promotion preserves spent-use
evidence and adds one remaining use. Paid Shop items and Echo's Reward Reward
Reward recreation remain ineligible.

## Architecture

The repository is split by ownership:

```text
packages/hades2-catalog   Hades II declarations and catalog construction
packages/planner-engine   pure authored model, reward kernel, simulation, and validation
apps/planner              application composition, Redux session state, and React UI
```

The core dependency direction is:

```text
catalog construction -> pure planner engine <- application composition -> React UI
```

The architectural spine is:

```text
declarations
  -> normalized catalog
  -> authored project
  -> canonical materialization
  -> game-language history
  -> validation
  -> semantic findings
  -> editor presentation
```

The authored project and immutable catalog declarations are the durable
semantic inputs. Materialization, history, validation, candidates, findings,
and UI projections are replaceable derived results.

Important modeling contracts:

- simulation models possibility, not probability;
- game Room Declarations are unique, while authored Room Occurrences are
  repeatable and own stable persisted IDs;
- incomplete and context-invalid authored states remain editable;
- only complete-valid biomes advance the validated route prefix;
- the next active biome may publish a truthful partial evaluation without
  producing a canonical biome snapshot;
- catalog route placement means the biome's complete product loop is
  supported;
- route tabs, panel selection, findings selection, and other UI-session state
  never enter authored history.

## Technology

- TypeScript for catalog, authored model, simulator, and UI;
- React and Redux Toolkit for UI projection and application state;
- Vite for browser development and production builds;
- Vitest for domain, application, and interaction fixtures;
- Tauri 2 for the no-install desktop host and platform release artifacts.

React Flow is not a foundation dependency. If introduced, it may render a
projection of semantic authored topology but will never own topology or node
identity.

## Documentation

Read by authority and task; the full set is not a prerequisite for every
change. Rules should live in one owning document and be referenced rather than
copied elsewhere.

- Product boundaries: [architecture](docs/design/ARCHITECTURE.md) and the
  future [game integration boundary](docs/design/GAME_INTEGRATION_BOUNDARY.md).
- Domain model:
  [catalog](docs/design/CATALOG_MODEL.md),
  [authored project](docs/design/AUTHORED_PROJECT_MODEL.md),
  [rewards](docs/design/REWARD_MODEL.md),
  [game generation](docs/design/GAME_GENERATION_RULES.md),
  [room lifecycle](docs/design/ROOM_LIFECYCLE_MODEL.md), and
  [simulation and validation](docs/design/SIMULATION_AND_VALIDATION.md).
- Biome rules:
  [F](docs/biomes/F_GAME_RULES.md),
  [G](docs/biomes/G_GAME_RULES.md),
  [H](docs/biomes/H_GAME_RULES.md),
  [I](docs/biomes/I_GAME_RULES.md),
  [N](docs/biomes/N_GAME_RULES.md),
  [O](docs/biomes/O_GAME_RULES.md),
  [P](docs/biomes/P_GAME_RULES.md), and
  [Q](docs/biomes/Q_GAME_RULES.md).
- Editor model:
  [candidate evaluation](docs/design/CANDIDATE_EVALUATION_MODEL.md),
  [editor ownership](docs/design/EDITOR_MODEL.md),
  [contextual UX](docs/design/CONTEXTUAL_EDITOR_UX.md), and the
  [structured workspace](docs/design/STRUCTURED_EDITOR_WORKSPACE.md).
- Evidence and disposition:
  [reward audit](docs/audits/REWARD_GAME_DATA_AUDIT.md),
  [trait-offer pools and dependencies](docs/audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md),
  [acquisition delivery and room settlement](docs/audits/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md),
  [Arcana and Fear audit](docs/audits/ARCANA_AND_FEAR_GAME_DATA_AUDIT.md),
  [All Together and Shop-trait audit](docs/audits/ALL_TOGETHER_AND_SHOP_TRAITS_GAME_DATA_AUDIT.md),
  [Fields optional rewards and Artificer audit](docs/audits/FIELDS_OPTIONAL_REWARDS_AND_ARTIFICER_GAME_DATA_AUDIT.md),
  [keepsake audit](docs/audits/KEEPSAKE_GAME_DATA_AUDIT.md),
  [Echo Gift Gift Gift keepsake audit](docs/audits/ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md),
  [Cherished Heirloom keepsake audit](docs/audits/CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md),
  [Shop and Well interaction lifecycle](docs/audits/SHOP_AND_WELL_INTERACTION_LIFECYCLE.md),
  [Ephyra side-room findings](docs/audits/N_SIDE_ROOM_FINDINGS.md),
  [encounter selection and composition findings](docs/audits/ENCOUNTER_SELECTION_AND_COMPOSITION_FINDINGS.md),
  [cross-biome UX audit](docs/audits/CROSS_BIOME_EDITOR_UX_AUDIT.md),
  [user-facing vocabulary audit](docs/audits/USER_FACING_VOCABULARY_AUDIT.md),
  and
  [migration provenance](docs/progress/MIGRATION_PROVENANCE.md).
- Delivery:
  [implementation plan](docs/progress/IMPLEMENTATION_PLAN.md) for forward
  acceptance gates and
  [implementation progress](docs/progress/IMPLEMENTATION_PROGRESS.md) for the
  active frontier and chronological delivery record. Phase 7 Slice 4,
  Commit 5a prompt removal, the re-anchor program, and the four Commit 5b
  presentation slices are complete. Campaign B made candidate artifacts
  explicit, Campaign C separated the justified authored-core authorities, and
  Campaign D retained the coherent ordered history and reward folds. Echo's
  eight-choice delivery, All Together, Infernal Contract, Travel Deal, and the
  corrected Gold Shop chronology are complete. Narcissus pickup correction,
  Fields room chronology and optional rewards, and Artificer conversions are
  complete through authored schema 41.
  Shop inventory, supplemental reward payloads, purchase/pickup participation,
  and room-local chronology remain distinct supported products. The ranked Hub
  follow-up and manual Shop UX acceptance close Phase 7. Phase 8 is complete
  with the successful `v0.1.0` tagged Windows portable release. Wells and exact
  Surface Shop delivery timing remain focused follow-up work.

## Source Evidence

Two external sources remain useful evidence:

- `../run-director-modpack/Submodules/adamantRunDirector-Run_Planner/` contains
  the earlier Lua/ImGui prototype and revamp documents;
- `../../1GameData/Scripts/` contains the game-data reference used to verify
  declarations and simulation rules.

Neither is imported at runtime. Verified rules move into the catalog,
simulator, and focused fixtures; the previous control, storage, draw, and Lib
lifecycle machinery is not an API contract.

## Development

The repository uses the Linux-native Node installation selected by `.nvmrc`.
From the repository root in WSL:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm install
npm run dev
```

Activating `nvm` matters on systems where Windows npm also appears in the WSL
`PATH`; workspace symlinks must be created by Linux npm.

Run the complete validation suite with:

```bash
npm run check
```

The desktop host wraps the same production Vite build without adding Rust-side
domain behavior. On a machine with the platform's Tauri prerequisites:

```bash
npm run desktop:dev
npm run desktop:build
```

`desktop:build` creates an unbundled native executable. The Windows release
workflow runs the complete repository gate, builds and launch-smokes that
executable, then publishes a no-install ZIP and SHA-256 checksum. Trigger the
workflow manually with a stable version such as `0.1.0`. The workflow injects
that version into its temporary Tauri build configuration; it does not edit or
commit package metadata. After the build, smoke test, and artifact upload pass,
the same run creates `v0.1.0` on the exact tested commit and creates or resumes
its GitHub release. Re-running the same version is safe only from that same
commit; an existing tag on another commit is rejected.

The complete `test` and `check` commands remain the phase, push, and release
gates. Development uses narrower test lanes:

```bash
npm run test:changed   # tests related to uncommitted source/test changes
npm run test:ui        # React component and editor fixtures
npm run test:planner   # intentional planner superset: source, UI, architecture, workspace support
npm run test:contract  # application architecture plus workspace overlay/closure/support contracts
npm run test:product   # full browser product loops
npm run test:engine    # authored model, simulator, and validation
npm run test:catalog   # declaration and catalog construction
```

Vitest's changed-file selection follows the static import graph. Use an
explicit lane when a change has no uncommitted source file, when validating a
specific ownership boundary, or when the intended downstream scope is broader
than the detected graph. Configuration, dependency, shared test setup, and
cross-layer architecture changes require the complete gate.

Individual scripts are also available for `typecheck`, `test:watch`, `lint`,
`format`, `format:check`, and `build`.
