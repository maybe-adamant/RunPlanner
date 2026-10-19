# Generated encounter live acceptance

Requires a plan published for the installed game module. Automated tests and source probes are not live
verification; the owner confirms or waives each check.

- [ ] Fresh profile, Fresh File route with uncustomized generated F combats at
      F depth 3 or more and uncustomized H cages. Each such combat starts the
      encounter identity the plan selected: no `RadiatorIntro`,
      `ScreamerIntro`, `FishSwarmerIntro`, `TurtleIntro` or H cage introduction
      appears where the plan has none.
- [ ] Mature profile, H route whose later cage has an authored composition with
      `FogEmitter2` and earlier uncustomized cages. No earlier cage spawns
      `FogEmitter2`, and the later cage admits its composition and spawns it.
- [ ] Mature profile, P route with a P Intro room planned as
      `GeneratedP_PreCombatChronosForces` with an authored composition. The
      room starts that encounter, its Olympus corpse obstacles spawn, and the
      authored roster still admits and spawns in full.
