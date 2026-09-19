# Dream Dive: remaining delivery questions

## Boundary

The route foundation resolves a supplied itinerary, contextual starts and
completion rooms, and acquisition-ordinal NPC effects. Their durable source
evidence is in
[Route-position profiles](../audits/rooms-and-routes/ROUTE_POSITION_GAME_DATA_AUDIT.md).
Public Dream creation, loading and execution publication remain disabled.
This investigation retains only the concrete work needed to enable them; it
is not an implementation authorization or a second route authority.

Sources below are relative to the installed Hades II Scripts directory.
Source inspection is not in-game verification.

## Itinerary authoring and native legality

User direction: choose four biomes once at project creation. No later reorder
command; a different itinerary means a new project. Biome-local topology
remains reusable. The full itinerary, not the configured prefix, determines
terminality and neighbors.

DreamRunLogic.lua:SelectNextDreamBiome establishes:

- First biome pool: G, H, I, O, P, Q. F/N enter the later pool.
- No repeated biome.
- A later choice cannot be the current biome's natural successor.
  RoomSets.lua:NextRoomSets declares F→G→H→I and N→O→P→Q. The exclusion
  is directional, not a symmetric adjacency ban.
- The first-ever forced H start and avoiding the previous starting biome are
  external profile predicates, excluded by the fully progressed baseline.
- GameData.FullRunBiomeCount = 4 (NarrativeData.lua), and
  CheckDreamBiomeCompletion ends the run after the fourth biome.

The internal structural itinerary currently does not enforce these game-order
restrictions. They need an owning creation/validation policy before public
admission. Navigation should consume the saved itinerary, not reconstruct it
from a new catalog entry for every permutation.

## Inventory, eligibility and resources

| Boundary                     | Source evidence                                                                                                              | Remaining work                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Ordinary World Shop          | Group 2 excludes Ash/Psyche/Nectar and admits individual elemental boosts (StoreData.lua:260–268)                            | Mode-aware membership, including Travel Deal refills                                            |
| I/Q World Shops              | Group 5 replaces rare resources with ElementalBoost (StoreData.lua:405–446,538–579)                                          | Separate mode membership from ordinal first/second-half inventory                               |
| I/Q inventory phase          | EnteredBiomes <= 2 versus > 2 (RequirementsData.lua:3181–3196)                                                               | Verify actual itinerary ordinal reaches every generation contact                                |
| Elements                     | Individual boosts grant +1; ElementalBoost grants all four                                                                   | Existing acquisition settlement is reusable; no new element simulator                           |
| Spark of Ixion               | Dream exclusion (TraitData_Store.lua:301–313)                                                                                | Shared mode predicate for Well and indirect/random outcomes                                     |
| Plentiful Forage / Discovery | Dream exclusions (TraitData_Demeter.lua:1812–1832, TraitData_Chaos.lua:634–646)                                              | Existing trait-requirement authority must consume route identity                                |
| Resource hosts               | Tool/fishing successes excluded (RunLogic.lua:658+); Meta Reward Stands also exclude Dream (RoomData.lua:552–565)            | Disable resource authorship and enforcement obligations; this is not a blanket minor-reward ban |
| Travel Deal                  | No Dream exclusion                                                                                                           | Reuse normal acquisition/refill ordering with mode-correct inventories                          |
| Hermes delivery              | Final-biome Preboss maturity (EncounterSets.lua:415–430)                                                                     | Verify existing route-terminal policy on Dream's resolved Preboss alternatives                  |
| Supply Chain                 | CheckChamberTraits defers DropResources in SkipTimedDropResourceInDream rooms and sets interval−1 (TraitLogic.lua:2880–2903) | Defer drops through the declared Dream boss rooms, not every automatic effect                   |

Resolve these through catalog requirements, existing settlement and lifecycle
seams. Do not introduce a separate Dream shop or clock engine. Confirm current
source locations when implementation begins; line numbers are inspection aids.

## Runtime integration and native ownership

Native spine:

```text
Dream_Intro → first biome intro + opening reward
  → Boss + Dream Points → Dream_PostBoss01
  → second biome → Boss + Dream Points → Dream_PostBoss02
  → third biome → Boss + Dream Points → Dream_PostBoss03
  → fourth biome → Boss + Dream Points → end
```

The planner excludes the matured-state prologue, but runtime startup must
still enter the first authored occurrence correctly. Verify fixed itinerary
selection, Dream Points completion, each Dream Postboss admission/resync,
and published NPC outcomes. Dream Postboss has a Well, not a Hermes Shrine
or purging pool. Do not invent those features during integration.

SetupEncounter applies DreamBiomeData before generation. Inspected F–Q
overlays alter money and active-enemy caps, not wave/type/highlight domains.
Preserve explicit inheritance suppression (DreamBiomeData="nil") on
openings, some minibosses, G extra-door combat and N subrooms. Combat scaling
and boss visuals remain native; they do not justify new customization controls.

## Recommended next sequence

1. Inventory/eligibility/resource support through existing authorities.
2. Creation-time itinerary legality and locked public Dream authoring.
3. Remaining lifecycle exceptions and downstream runtime integration, with
   explicit live acceptance before enabling publication.

No open foundation checklist remains here. Remove this investigation when the
remaining questions are delivered or promoted into their durable owners.
