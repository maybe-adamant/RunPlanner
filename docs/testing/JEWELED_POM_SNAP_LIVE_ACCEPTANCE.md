# Jeweled Pom rack swap and snap live acceptance

Requires a current planner and an installed game module of the same schema
pair, Snap back to the plan on, and a complete-valid plan that starts with
Jeweled Pom and swaps it for a Fated-disabling keepsake (Gorgon Amulet or an
Olympian keepsake) at a later Keepsake Rack, sent and set to play next.
Automated hook coverage is not live verification; the owner confirms or waives
each check.

- [ ] Leave the planned rack room without swapping. The exit reports the
      missed rack, snap equips the planned keepsake, the Pom's granted Hades
      boon is gone, and the next save shows `FatedStatus` `Unfated`. The
      following rooms report no `keepsakeEffects` or boon level mismatch.
- [ ] Swap at the planned rack and leave at once. The run stays synchronized
      and the next save shows `FatedStatus` `Unfated`.
