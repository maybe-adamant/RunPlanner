# Snap exit corrections live acceptance

Requires a current planner and an installed game module of the same schema
pair, Snap back to the plan on, and a complete-valid plan sent and set to play
next. Automated hook coverage is not live verification; the owner confirms or
waives each check.

- [ ] After a mismatch, take a native door that leads elsewhere into a
      depth-gated planned encounter (for example Icarus in Olympus at depth 3
      or later). Snap rebuilds the planned room, the planned encounter plays,
      and a planned generated encounter there reports no `budget-mismatch`.
- [ ] In a planned room with a Hermes Shrine and no planned purchase, buy an
      order (SpellDrop if offered) and leave. That exit reports a
      `hermesDeliveries` mismatch, snap removes the order, and the next save
      has no `StorePendingDeliveryItem`.
- [ ] After a mismatch, buy a Hermes order at a Shrine in the out-of-sync room
      and leave. Snap removes the order at that exit, and the next save has no
      `StorePendingDeliveryItem`.
- [ ] After a mismatch, take an unplanned god's boon and leave so snap installs
      the planned god's boon instead. The next save's `LootTypeHistory` holds
      the planned god and not the unplanned one, and a later shop or god draw
      offers only gods the plan allows.
