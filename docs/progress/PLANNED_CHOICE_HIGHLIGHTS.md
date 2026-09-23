# Planned-choice highlights: pending live acceptance

Implementation and automated closure are complete. One independent review found
five gaps in native lifecycle cleanup, rerolls, mid-room enable, source scope,
and adapter-level tests. These were corrected and verified by the main session.
The complete module suite passes 609 tests; Luacheck reports no warnings or
errors. No schema, protocol, planner behavior, or fixture change was needed.

**Highlight planned choices** is persistent and off by default, independent of
**Show room guide**. It uses owned native markers, never selects a choice, and
never changes transaction completion, steering, conformance, or native pins.
The durable contact mapping lives in the existing feature hook map.

## Remaining in-game checks

Deployment and native visual acceptance have not occurred. After deployment,
compare highlighting alone, the room guide alone, and both together:

- Normal two-exit room: correct picked door, readable placement beside native
  reward/pin art, and immediate off/on without regenerating doors. Include
  normal exits from Chaos; entering its special gate remains excluded.
- N Hub: next visit updates on return, side-room excursions do not advance it,
  final visit clears it. Non-Hub N doors remain unmarked.
- O ship: one/two offers and successive phases, including a reused wheel.
- Shared trait screen: ordinary boon/Hammer, Chaos with repeated curses,
  NPC or Pom, and nested Echo when available. Verify native player pins and
  hover remain intact; test mid-screen off/on, Boon Info, and row rebuild.
- Leaving, desynchronization, and resync remove old recommendations. Missing
  or ambiguous targets show nothing. Special doors, inventories, pickups,
  and Selene's separate spell/tree screens remain out of scope.

Retire this checklist once the user confirms the live checks.
