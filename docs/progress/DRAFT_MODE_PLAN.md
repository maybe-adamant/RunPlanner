# Draft Mode Plan

Status: locked. Base commit: `d1dd40ee9`.

## Objective

From the loadout screen, a user describes a world and a trait basket, and the
planner fills the route's biomes with a random valid plan inside that world.
Rerolling is cheap and undoable. The result is an ordinary project the user
then edits by hand.

## Source facts (native, confirmed)

- **God cap:** `MaxGodsPerRun = 4`; the first four distinct gods picked up form
  the pool. Before the cap fills any eligible god can be offered. Shop
  `RandomLoot`, mystery boxes, Echo, starting and rack keepsakes that force a
  god (`ForceBoonName`) are all author choices that can bring in an outside
  god.
- **Hammers:** at most 2 per run from rooms and shops; the second only from the
  third biome. **Hermes:** at most 1 per biome and 2 per run from rooms. No
  minimum for either.
- **Story rooms** (one per biome, none in Q): Arachne F, Narcissus G, Echo H
  (Bridge, always forced), Hades I, Medea N, Circe O, Dionysus P. Each is
  created at most once per run when offered on a door, so taking another door
  loses it for the run. Depth windows and lifetime gates apply.
- **Field NPCs:** F and G Nemesis, Artemis; H and I Nemesis (H through Fields
  cages); N Artemis, Heracles; O Heracles, Icarus; P Heracles, Icarus, Athena;
  Q none. Artemis, Athena and Icarus give traits; Nemesis and Heracles do not.
  No field NPC within six rooms of another.
- **Core slots:** normal offers skip occupied slots; only exchange rows replace
  a held slot boon.

## The draft spec

An engine product held in application memory (not saved in v1). The draft
step comes before the loadout and sets it.

- **Loadout:** weapon, aspect, familiar, Arcana, Fear and starting keepsake,
  edited with the existing loadout controls and checked by the engine's
  existing loadout and route-start rules. The route and its itinerary are the
  project's structure: the draft reads them and never changes them. The
  FreshFile route is excluded. Run modifiers and the Practice start point carry
  over from the current project. The starting reward is not a spec field: the
  search chooses it like any other decision, toward the targets.
- **Keepsakes:** the starting keepsake is a loadout field; the draft sets
  one keepsake per Postboss rack between biomes, in order (a four-biome route
  has three). An empty slot keeps the current keepsake. God keepsakes
  (`Force*BoonKeepsake`) are banned in the slots and as the starting keepsake;
  a banned starting keepsake refuses the draft with that reason. Experimental
  Hammer is allowed: the Hammer it rolls is excluded from the search's door
  Hammer picks. A keepsake's own choices (Figurine Arcana, Phial target and
  similar) are random among legal values.
- **World:** the god pool; one story NPC per biome; field NPCs per biome. The
  choices offered come from an engine query over catalog room and encounter
  declarations for the itinerary's biomes.
- **Basket:** traits from the selected givers that grant traits. Static
  engine legality over basket plus loadout:
  - prerequisite groups (Duos, Legendaries), and excluded-trait groups;
  - one trait per core slot: once a slot is drafted, the slot's other traits
    leave the selectable pool;
  - loadout-static conditions (weapon and aspect Hammer compatibility, route,
    Arcana, Fear, Hex);
  - draft-illegal traits from the catalog: the Chaos Anvil
    (`ChaosWeaponUpgrade`) and the Hera and Zeus sacrifice Duos (Queen's and
    King's Ransom).

  Conditions that depend on run context (Devotion no-Duo, gift-blocking rooms,
  rarity or level counts, Death Defiance, Echo dispositions) are checked by the
  search and reported when unmet.

## The search

An engine generator: `draftProject(catalog, project, spec, seed, budget)`.

- It walks the route biome by biome, driven by the engine's next blocking
  finding, and authors each decision from the engine's legal options. It never
  computes game legality itself.
- **Hard filters:**
  - god pool: every god-choosing site (doors, shop, mystery box, Echo) stays
    in the pool until the cap holds it;
  - monotonic acquisition: never Purging Pool sales, Wells, exchange rows,
    Nemesis trades, trait-removing Chaos, the Chaos Anvil or the sacrifice
    Duos;
  - keepsakes: only the drafted rack keepsakes, equipped at their racks;
  - the Nemesis random-event family is never chosen; Nemesis combat is allowed.
- **Soft targets, weighted and reported:**
  - basket traits, selected whenever legal;
  - story NPC per biome: take its door when offered;
  - field NPCs per biome, through encounter choice;
  - Hammers and Hermes up to the native caps.
- Doors, rarity, encounters and other choices are random among legal options,
  within the world.
- **Restarts per biome:** a dead end or a missed target retries only the
  current biome, reusing earlier biomes through the biome simulation cache.
  Best of N within a wall-time budget, ranked by target coverage.
- The result always has zero findings. The report lists unmet targets and any
  extras with reasons.

## Application

- A Draft step before the loadout screen edits the spec through the engine
  queries, reusing the loadout controls. A project can be started by drafting
  or by hand, and an existing project can be drafted again.
- Accept runs the search in a worker with progress, then applies the result as
  one semantic command, `ReplaceRoute`:
  - replaces the loadout (with the generated starting reward) and each biome's
    state, topology and Echo keepsake replays, keeping the route and itinerary;
  - resets the route's resource placements;
  - keeps the run modifiers and the Practice start point.

  It is undoable through the existing snapshot history and never goes through
  the project-replaced action. A warning appears whenever any biome already
  has topology.

- The seed is shown with a reroll.

## Gates

1. **Spec and legality (engine and catalog).**
   - Catalog: draft-illegal trait declarations, and story and field NPC host
     declarations per biome with source evidence.
   - Engine: the spec model; the world query per itinerary; the static basket
     legality query over basket plus loadout.
   - Tests at each owner.
2. **Search (engine).**
   - A declared domain for each decision owner where the spike guessed (rooms
     per biome, offers per reward binding); the finding-to-repair dispatch stays
     inside the generator, keyed on the repair owner's address kind; encounter
     choice at the frontier.
   - Generalize the route replacement into `ReplaceRoute { loadout, biomes }`
     and give the spec its loadout fields.
   - The generator with per-biome restarts, its starting-reward choice, and the
     report.
   - Tests: valid output, target coverage and the report over a small fixed set
     of specs per route; determinism per seed. Measure post-cache cost on
     Underworld, Surface and Dream to set the default budget.
   - Delete the untracked spike.
3. **Application.** The Draft step before the loadout, the worker run, the command with its
   warning and Undo, reroll and the report. Interaction and product tests.
4. **Closure.** Docs (`SIMULATION_AND_VALIDATION.md` ownership,
   `AUTHORED_PROJECT_MODEL.md` for the new command), live checklist, and
   retire this plan.

## Non-goals

- Saving the spec in the project (with the next approved schema bump).
- Full search beyond per-biome restarts.
- Choosing rarities, levels, encounters or filler rewards beyond the soft
  targets.
- The FreshFile route.
