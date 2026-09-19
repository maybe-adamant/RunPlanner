# Dream Dive: public authoring and runtime admission

## Remaining question

What must be established before a fixed-itinerary Dream project can be created,
loaded and executed? Internal route context, ordinal effects, mode-sensitive
content and timed-drop rules are implemented. Their source facts belong to
[Route-position profiles](../audits/rooms-and-routes/ROUTE_POSITION_GAME_DATA_AUDIT.md),
not this investigation. Public Dream admission and publication remain disabled.
Source inspection below is not live-game verification.

## Public authored project

User direction: choose four biomes once during creation; no later reorder
command. A different order means a new project.

`DreamRunLogic.lua:SelectNextDreamBiome` declares:

- first pool G/H/I/O/P/Q; F/N join only for later positions;
- no repeated biome;
- a later biome cannot be the current biome's natural successor, using
  `RoomSets.lua:NextRoomSets` (F→G→H→I and N→O→P→Q);
- successor exclusion is directional, not a symmetric adjacency ban.

`GameData.FullRunBiomeCount` is four. First-ever forced H and previous-run
starting-biome avoidance are external save predicates, excluded by the agreed
fully progressed/profile-independent model.

The authored model stores `itineraryBiomeKeys`. Internal defaults/codec accept
one to four unique known biomes without enforcing Dream start/adjacency rules.
Foundation tests deliberately exercise some non-public itineraries. Public
creation/admission needs one engine-owned legality policy consumed by the UI;
those internal fixtures do not establish legal public Dream routes.

Application contacts: `composition/projectBootstrap.ts`,
`workspace/projectOperations.ts`, `workspace/project-admission.ts`,
`projections/editorNavigation.ts`, and `ui/project/ProjectFileControls.tsx`
under `apps/planner/src/`. Creation currently supplies only a route key. Pass
the complete chosen itinerary once, preserve it across load/autosave/Undo,
and retain the configured-prefix workflow. Admission must agree with creation.

The existing schema represents itinerary identity; exposing Dream alone does
not establish a need for a schema bump. Assess actual persisted changes when
planning this work. Execution is a separate closed contract.

## Runtime and publication

Planner execution model/codec/assembler and downstream protocol decoder accept
only Underworld/Surface. Downstream first-biome checks also assume ordinary
routes. Required source contacts and unresolved integration witnesses:

- Native `Dream_Intro` remains outside authored chronology. Startup supplies
  an explicit room and bypasses initial `ChooseStartingRoom`
  (`RunLogic.lua:511–515`, `DeathLoopData.lua:7062–7067`). The module synchronizes
  around `StartNewRun` and expects its first published occurrence at `StartRoom`;
  Dream admission needs deliberate handling there.
- Native `SelectNextDreamBiome` chooses the itinerary. Steering must supply
  authored choices while preserving `EnterNextDreamBiome` and native entry
  work. The current `ChooseStartingRoom` override applies only while session
  state is `starting`, not later synchronized transitions.
- Dream Points spawning/use, ordinal Postboss transition and the fourth-biome
  ending belong to the game (`RewardLogic.lua:71–72`,
  `DreamRunLogic.lua:63–83`). They replace boss material drops; no planner points
  economy is needed.
- Reuse postboss admission/resync and NPC steering, but verify Dream room
  identities, ordinal effects and onward itinerary steering in game.
- Preserve native combat scaling, presentations, difficulty and inheritance
  suppression. Inspected overlays do not establish a separate wave/type/highlight
  authoring domain.

## Recommended disposition

Plan public fixed-itinerary authoring next, then runtime integration. Public
authoring can be a development milestone before runtime delivery; publication
must stay unavailable until its integration contract is implemented and tested.
Do not equate a valid editor route with a supported playable execution plan.

Remove this investigation when these questions are delivered or promoted to
their durable owners. No new route framework, scheduler or mode registry is
indicated by the current evidence.
