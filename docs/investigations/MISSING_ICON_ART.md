# Missing Icon Art

Question: which game entities does the planner show by name only, with no
icon art yet? Answering it bounds the remaining data-mining for the icon set
under `apps/planner/src/ui/artwork/`.

Status: open. Each row closes when its art is added to the owner's icon source
folder and wired, or is judged unnecessary.

## Art to data-mine

| Entity                        | Count | Examples                                                                       | Where the planner shows it                                         |
| ----------------------------- | ----- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Enemies                       | many  | generated encounter rosters                                                    | encounter composition and roster controls                          |
| Fangs perks                   | —     | elite perks                                                                    | encounter Fangs selection                                          |
| Boss and miniboss portraits   | 39    | Polyphemus; 22 minibosses, 17 bosses                                           | encounter pickers (generic combat encounters need none)            |
| Biome / region icons          | 8     | Erebus, Oceanus, Ephyra                                                        | route panel, biome tabs, biome entry picker (boss art used today)  |
| Weapons (Nocturnal Arms)      | 6     | Witch's Staff, Black Coat                                                      | weapon step of the weapon picker (borrows the Melinoë aspect icon) |
| Exit door art                 | 16    | ErebusExitDoor, EphyraExitBossDoor                                             | biome rail, decision rooms                                         |
| No-reward door arrows         | ≤6    | F, G, H, I, N, P (O and Q exist)                                               | biome rail; skip biomes the game shows none for                    |
| Room objects                  | ~10   | Fountain, Keepsake Rack, Pool of Purging, Stygian Well, Hermes Shrine, Anomaly | room feature sections, hub fountain, Anomaly controls              |
| Gathering tools and resources | 4     | Pickaxe, Exorcism tablet, Shovel, Fishing rod                                  | resource controls, route resources panel                           |
| Fields objects                | 2     | Cocoon, Cage                                                                   | cocoon and cage controls                                           |
| Eris                          | 1     | Eris; Blessing of Strife trait                                                 | Eris spawn control, trait icons                                    |
| Routes                        | 2?    | Underworld, Surface                                                            | route panel (Dream Dive and Fresh File are planner concepts)       |

## Not needing art

- The 264 rooms: the game shows map previews, not icons.
- Planner-only concepts: run modifiers and Practice start points, findings,
  status labels, and internal catalog tables that are never displayed.
