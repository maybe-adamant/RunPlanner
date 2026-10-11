# Practice Boss Start Plan

Status: locked. Base commit: `df85d5911`.

## Objective

Add the biome Boss room as a third Practice start point beside Opening and
Preboss. The run starts in the Boss room with the planner's state as it stands
after the Preboss.

## Source facts

- `StartNewRun(args.RoomName)` creates the start room through `CreateRoom`
  (`RunLogic.lua:506-510`), the same path the Preboss start uses.
- Boss rooms declare their encounters (story variants chosen natively), forced
  boss drop, `NoReward`/`NoReroll` and `LinkedRoom` to the Postboss
  (`RoomDataF.lua:2019-2099`; G 625, H 1460, I 1200, N 2184/2345, O 991, P 922,
  Q 1988/2351). They have no shop; the Postboss Well and shops are generated on
  the Boss's own `LeaveRoom`.
- Boss entrance functions are declared per room and do not read room history,
  depth or visit order (`RoomPresentation.lua:57-84`).
- The Rivals check reads `EnteredBiomes` and `BiomeVisitOrder`
  (`ShrineLogic.lua:939-960`), already published with the start biome entered;
  the plan names the resolved Boss map (`completion-boss.ts:24-40`).
- Mourning Fields Clockwork counters affect only music and VO at the Boss
  (`MusicData.lua:444`, `HeroData.lua:9959`).

## Decision

- **Authored value.** `startPoint.point` admits `'boss'` in the tolerant
  run-modifier record (`run-modifiers.ts`). No authored schema bump; unknown
  points still heal to absent.
- **Engine.** Capture the received state at the Boss's `roomPrepared`
  alongside the Preboss capture (`chronology-seams.ts` `prebossStartState`
  generalized per completion room kind). `StartPoint` gains `'boss'`; the
  mid-biome branch in `start-point.ts` serves Preboss and Boss; biome records
  publish in `'current'` form for both. Clockwork counters stay Preboss-only.
- **Protocol.** `start_state.point` admits `'boss'`; the `biome` block is
  published for every non-Opening point. This is an execution-protocol change
  carried by the module build id.
- **Game module.** Decoder rules become mid-biome rules (start biome entered,
  start not the first selected room, `biome` present for non-Opening points,
  Clockwork only for an I Preboss). The Preboss install becomes a mid-biome
  install; shop generation stays Preboss-only. Tight Deadline handling at the
  Boss follows the same rule as the Preboss unless the source shows otherwise.
- **Editor.** A third "Boss" column in the start-point grid.

## Gates

1. **Engine and protocol.** Value, capture, installation, assembly, codec, one
   new execution fixture (prefer a Rivals `_Boss02` or a Surface/Dream Boss
   start), equivalence rewrite (the new capture changes `simulateProject`
   digests), editor column.
2. **Game module.** Decoder, mid-biome install, Lua tests against the new
   fixture.
3. **Closure.** Docs (`GAME_INTEGRATION_BOUNDARY.md` §Practice mode start,
   `AUTHORED_PROJECT_MODEL.md` run modifiers, `SIMULATION_AND_VALIDATION.md`
   start states, `STRUCTURED_EDITOR_WORKSPACE.md` Practice controls), a live
   checklist in `docs/testing/`, plan retirement — by the gate 2 executor.

## Tests

- Engine: Boss capture equals the state after Preboss departure; installation
  and assembly for Boss starts across a generated biome, Ephyra and Mourning
  Fields; codec admits `'boss'`; eligibility offers Boss where Preboss is
  offered.
- Module: decoder accepts Boss starts and rejects malformed ones; install
  creates the Boss room without shop generation; `verifyStart` checks depth.
- Live: Boss starts in F, G, H, I (Chronos), N with Rivals (`N_Boss02`), O, P,
  Q (Typhon) and Dream; Boss music, entrance, Tight Deadline and the Postboss
  that follows.

## Non-goals

- Removing the Preboss start point.
- Any change to ordinary route simulation of Preboss rooms.
