# Dream route live acceptance

Requires a current planner and an installed game module of the same schema
pair, and a complete-valid Dream plan sent and set to play next. Automated
protocol and hook coverage is not live verification; the owner confirms or
waives each check.

- [ ] Play a complete Dream run on the plan. The run admits after the native
      `Dream_Intro` prologue, each biome in the plan's order is selected and
      entered as planned, and the run stays synchronized through every
      Postboss departure to the end of the configured prefix.
- [ ] Play a Dream plan whose configured prefix ends at a Postboss. Leaving
      that Postboss enters the next biome the game picks (never the same
      Postboss again), and no boss encounter diagnostic names the Postboss
      room.
