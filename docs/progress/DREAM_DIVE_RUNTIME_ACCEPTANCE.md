# Dream Dive runtime acceptance

Implementation is delivered in planner `725ccb84` / `a07f4337` and game module
`37acc97`. This file retains only pending manual acceptance; it is not design
authority. Automated closure results belong in the closure commit.

With a legal four-biome Dream project and the matching published plan:

- [ ] Create, save and reopen the project; confirm its route order stays fixed.
- [ ] Start a native Dream run; confirm the prologue does not consume the first
      occurrence and the first biome receives its chosen room and starting reward.
- [ ] Confirm all three onward biome choices and ordinal Dream Postboss rooms.
      Include later F/N entries to exercise empty openings and Ephyra Hub setup.
- [ ] Reload in a Dream Postboss; confirm resync and the next authored biome.
- [ ] Complete a full route; confirm native Dream Points and final completion.
- [ ] Publish a shorter configured prefix; confirm native selection continues
      after it without forcing an unauthored biome.
- [ ] Confirm ordinary Underworld/Surface startup and Postboss reload still work.

No item is claimed passed by source inspection, fixture compilation or hook
tests. Remove this checklist once live acceptance is recorded.
