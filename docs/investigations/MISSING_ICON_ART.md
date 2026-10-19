# Missing Icon Art

Question: which game entities does the planner still show without icon art?
Answering it bounds the remaining data-mining for the icon set under
`apps/planner/src/ui/artwork/`.

Status: open. Each row closes when its art is added to the owner's icon source
folder and wired, or is judged unnecessary. Enemies, minibosses, bosses, Fangs
perks, biomes, room objects, fountains, gathering tools, Eris, cocoons and most
exit doors are covered.

## Still missing

| Entity                  | Count | Detail                                                                                                                              | Where the planner shows it |
| ----------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Exit doors              | 5     | N_OpeningDoor, EphyraExitDoorReturn, EphyraExitBossDoor, AnomalyAutoExitDoor, ChaosReturnExitDoor; the game shows glow effects only | decision exit cards        |
| Trial (Devotion) reward | 1     | no game icon; the planner shows the chosen god pair instead                                                                         | reward pickers and rail    |

## Candidates held for later

- Route banners: `Routes/Underworld.png`, `Surface.png`, route emblems and the
  Dream Dive poppy, for a project-type banner.
- God keepsake portraits and fuller Max Magick, Bones and Ashes art in
  `Items/Candidates/`, as possible replacements for the current icons.

## Not needing art

- Weapons: their codex cards are alternative Melinoë art; aspect icons cover
  the picker.
- Rooms: the rail uses room-type icons, not per-room art.
- Planner-only concepts: run modifiers and Practice start points, findings,
  status labels, and internal catalog tables.
