# Hex tree live acceptance

Requires a matching current planner and installed game-module build. Automated
tests are not live verification; the owner confirms or waives each check.

- [ ] Plan a Spell Drop with an edited tree (a swapped Common node, a traded
      deck talent and a changed Rare node) on a non-default layout. Accept the
      Spell Drop in game: the talent screen shows exactly the planned talent on
      every node, and the God Sent pair appears after the duo node once
      eligible.
- [ ] Equip Aspect of Selene with an edited starting tree. The run starts with
      that tree on the talent screen.
- [ ] Open a planned Path of Stars screen. Each planned node that is not yet
      invested or queued carries the highlight overlay; queuing it removes the
      overlay; unplanned nodes have none. The overlay reads clearly and nothing
      blocks choosing other nodes.
- [ ] Invest different nodes than planned with the same point count. The run
      continues with no conformance mismatch.
- [ ] Plan Task Force after investing the Olympian node and take it live. Then
      plan a route where the Olympian node is not invested before the Athena
      offer: the planner withholds Task Force there.
