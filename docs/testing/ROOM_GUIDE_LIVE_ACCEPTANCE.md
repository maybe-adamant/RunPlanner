# Room guide live acceptance

Requires a matching current planner and installed game-module build with
**Show room guide** enabled. Automated tests are not live verification; the
owner confirms or waives each check.

- [ ] Plan a Surface Shrine with one delayed purchase and one rushed purchase.
      Before buying, the guide shows `Shrine: X` for each and `Rush: X` under the
      rushed one. Buying hides that `Shrine:` row; rushing hides its `Rush:` row.
      Neither row reappears after the Shrine screen closes.
- [ ] Plan a Shrine with all three offers bought and rushed. Every `Shrine:` and
      `Rush:` row hides, and none reappears once all three options are gone.
- [ ] With Travel Deal, rush the first initial purchase and plan a purchase of
      the refill. After the screen closes, `Shrine: X` for the refill shows until
      it is bought (and its `Rush:` row, if planned, until rushed).
- [ ] In the room where a delayed Shrine purchase arrives, the guide shows
      `Delivery: X` and hides it when the pickup is collected. The rushed item in
      its purchase room reads `Collect X`.
- [ ] Across a full Underworld and Surface run, no header, row or footer is
      clipped or wraps in the overlay; a room with more than six rows ends with
      `+N more`.
