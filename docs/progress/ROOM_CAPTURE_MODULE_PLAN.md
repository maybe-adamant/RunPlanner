# Internal Room Capture Mod

Status: **Complete** — all delivery gates closed on 2026-09-17.
The user accepted the settled capture model after using it for the planner's
room-map assets.

## Delivered

The standalone `adamantRunPlanner-Room_Capture` repository contains the initial
camera/loading implementation in `5c177ae` and completed room coverage in
`e0e4cfd`.

- Direct capture of F/G/H/I and N/O/P/Q run rooms, Chaos, Anomaly, and Zagreus,
  using native loading with combat and progression interactions suppressed.
- Zoom, pan, reset, hidden HUD, and explicit stop/disable cleanup.
- Fields entry/cage/optional point references with stable native ordering and
  a separate Nemesis view.
- Ephyra Hub marked/clean views and main-room side-door destination labels.
- Family-specific presentation setup, one sample reward in G combat rooms,
  and native O ship wheels without added reward holders or sample boons.

The utility remains internal and coordinator-free. It does not alter the
planner execution protocol or require modpack publication. Disable the Run
Planner game module while capturing; capture sessions are disposable.
Installation and operating instructions belong to the standalone README.

## Verification

Lua syntax and all five standalone suites pass: capture, composition,
special-room, native-contact, and real ModpackLib boot/UI tests. Independent
closure review identified an O sample-reward fallthrough; it was corrected and
covered with a nonempty loot-point witness before committing.

The final source was fast-deployed to `h2-dev` and verified byte-for-byte.
User captures establish usable native rendering across the delivered room
families; automated checks cover the latest G/O sample cleanup, not a separate
claim of new in-game verification.

## Retained Limitations

Extreme zoom-out can exhaust the native renderer in large Fields rooms; use
multiple overlapping captures when necessary. The 10% control minimum is not
a guarantee that every room renders safely there.

H_Combat13's native cage-point declaration discrepancy remains diagnostic.
The user verified its visible entry/cage/optional markers; the capture utility
does not invent a correction to game encounter data.

No delivery gates remain open. This concise completion record is retained at
the user's request; the superseded implementation plan remains in Git history.
