# Room guide: pending live acceptance

Implementation, independent review remediation, and automated verification are
complete. Full closure awaits the in-game visual check below. The original
delivery contract is retained in commit `c5b8898b`; current ownership is documented
in `docs/design/GAME_INTEGRATION_BOUNDARY.md` and module usage in its README.

The guide is read-only and disabled by default. It uses six visible instructions
and an explicit omitted-reminder count. Existing transaction completion hides
associated rows without renumbering; untracked instructions remain reminders.
There are no new gameplay hooks, action-completion tracking, or mismatches.

## Verified

- Independent review findings resolved: room-name fallback and a production
  composition/session-to-overlay progress witness.
- Planner typecheck, fixture integrity (23 tests), correctness (3,569 tests),
  performance comparison, lint, formatting, and build passed. Two unused test
  variables found by the initial closure command were removed; the affected
  117 tests and remaining stages then passed.
- Module suite: 586 tests passed; Lua lint: zero warnings/errors in 104 files.
- All 14 execution fixture pairs match byte-for-byte.
- Actual guide adapter exercised against the public ModpackLib retained-overlay
  API, including hiding completed rows and preserving numbering.

## Remaining acceptance

Deployment has not been requested or performed. For a live test, deploy the
updated module and republish a plan with the matching protocol 44 planner.
Existing authored saves need no migration.

Enable **Show room guide** in the in-game inspector and confirm:

- Header, instructions, and next-room/reward footer are readable and do not
  obstruct important HUD content at the user's preferred resolution and scale.
- Completed steering rows disappear; early disappearance on offer installation
  is expected, not proof that the player selected the trait.
- A long room's six-row window and omitted-reminder count are useful. Adjust
  the presentation size if needed, without adding action tracking.
- Ephyra side/main/Hub returns show useful navigation without replaying old
  instructions; Thessaly phases retain one room guide.
- The setting and native HUD/configuration-screen suppression behave correctly.

Record the live result and delete this temporary checklist at acceptance.
The separate planned-choice highlighting plan is not part of this closure.
