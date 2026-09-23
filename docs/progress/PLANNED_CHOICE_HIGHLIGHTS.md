# Planned-choice highlights

Status: agreed scope committed for later delivery; source trace complete, native
visual probe pending. Room-guide overlay is being implemented first. Highlight
implementation and deployment await a separate user request.

Bases: planner `3b4ffb3f`; game module `681c3f6`.

## Outcome and scope

Add one persistent game-module setting, **Highlight planned choices**, initially
disabled. When enabled for a synchronized admitted run, mark the planned exit,
Ship wheel offer, or selected trait-screen row. The player still makes every
selection. Disabling it removes guidance immediately, including on an open
screen. Keep the existing player pins and hover behavior intact.

This is best-effort guidance, not a complete walkthrough. Reuse suitable native
highlight surfaces; do not create new prompt systems to cover every planned
action. Missing guidance is acceptable. A stale or incorrect recommendation is
not: when identity or presentation is unsuitable at runtime, show nothing and
let the player continue normally. This safe fallback does not waive coverage of
the included surfaces below.

Included: normal picked exits in F/G/H/I/P/Q, O's next normal door and per-phase
wheel selection, the next selected N Hub visit, and selected rows
on the shared upgrade-choice screen (ordinary boons, Hammers, Chaos, NPC offers,
visible Poms, and Echo's nested boon screen), where exact identity and a suitable
native presentation contact are available.

Excluded: timeline HUD or completion tracking, automatic selection, input focus
changes, new eligibility/conformance/mismatch rules, highlighting inventory
purchases or world pickups, all special doors (including Chaos gates and
Zagreus Contract exits), "use Artificer now", "use Timepiece now", or similar
action prompts, Selene's separate spell/tree screens, and the
Hub zoom-out map screen. Chaos trait-screen choices remain distinct from Chaos
gate guidance and are in scope. All N doors outside the Hub, including side
doors and parent returns, are excluded from this first delivery. Their native
highlight viability may be investigated before closure, but is not acceptance
work and must not expand implementation scope without agreement. A trait offer
still receives guidance when it comes from an excluded shop or room surface.

For N, the required behavior is explicit: mark the visit 1 room on the Hub
board, then visit 2 on returning, and so on through the planned visits. Side-room
excursions must not advance the Hub recommendation. After the final planned
visit, clear the visit marker; do not invent an extra visit or require guidance
for the scripted continuation to Preboss/Boss.

No catalog, engine, application, authored-schema, execution-protocol, or fixture
format change is expected. Do not parse semantic owner strings to recover facts.
The rejected broader investigation is not an authority for this plan.

## Independently checked source contacts

Game paths below are relative to the local game `Scripts/` directory; module
paths are relative to the game module's `src/mods/` directory.

| Surface                     | Published identity and current adapter                                                                                                                                                    | Native presentation and lifetime                                                                                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ordinary exits              | `navigation/doors.lua:destinationId/targets` matches occurrence IDs stamped on doors or their target Room; `navigation/hooks.lua:DoUnlockRoomExits` realizes and binds the actual doors.  | `RewardPresentation.lua:CreateDoorRewardPreview` constructs and attaches previews. Fields cage previews recurse for each reward: one guidance marker per physical door, not per cage icon.                                                             |
| N Hub                       | `overview.hub.slots` supplies `physicalDoorId` and destination occurrence. `route/session.lua:next` handles both active-room and between-room cursor positions.                           | `RoomLogic.lua:RestoreUnlockRoomExits` calls `DoUnlockRoomExits` after restoration. Refresh there; do not depend only on `StartRoom`. `ObstacleDataN.lua:EphyraExitDoor` skips native resource-pin icons.                                              |
| O wheels                    | `room/timeline/encounters/thessaly.lua` stamps `__runPlannerWheelKey` and `__runPlannerOfferKey` during `CreateDoorRewardPreview`; `UseShipWheel` consumes the matching published choice. | Mark the exact offer object for the active wheel. Retire after accepted use and rebind on the next phase; an object can survive and be reused. O obstacle declarations also skip resource pins.                                                        |
| Ordinary/Hammer/NPC choices | Ordinary offer payload supplies the selected key; NPC adapters already carry their exact selected offer.                                                                                  | `UpgradeChoiceLogic.lua:CreateUpgradeChoiceButton` creates `StoreItemPin` and `button.PinIcon`; `CreateBoonLootButtons` builds `screen.UpgradeButtons`. Match final button identity, not visual position after sorting.                                |
| Chaos                       | `acquisitions/traits/chaos_offer.lua` installs the selected curse/blessing row by option index.                                                                                           | Preserve the adapter's actual selected row mapping; curse name alone is not a unique selected blessing identity. Do not reuse an old index after a native reroll changes the offer.                                                                    |
| Visible Pom / nested Echo   | `acquisitions/levels/hooks.lua` holds `selectedTarget`; `acquisitions/npc/echo.lua` owns the nested menu's selected key.                                                                  | Same native button construction, different payload owners. Pass their selected identity explicitly; a nested screen must not inherit the outer NPC selection. Direct level effects and automatic Stone residual grants have no selectable row to mark. |

### Visual choice and ownership

`PopulateDoorRewardPreviewSubIcons` uses
`RoomRewardSubIcon_ForgetMeNot`; `AddDoorInfoIcon` attaches its obstacle to the
reward preview. `RemoveRoomRewardPreviews` destroys native additional icons.
This proves usable native art and attachment primitives, not visual suitability
at every door. Reuse the art for a module-owned guidance marker; do not change
resource requirements, pin data, or `SkipResourcePinIcons` to manufacture it.

Trait buttons' `Highlight.Id` is hover-owned: `MouseOffBoonButton` replaces its
animation with `BoonHighlightOut`. Do not share that component. Prototype a
separate, visibly distinguishable marker using native `StoreItemPin` art. Keep
the native pin component untouched; confirm spacing/color in game rather than
locking an untested visual offset into the contract.

`CloseUpgradeChoiceScreen` closes all `screen.Components`, but
`DestroyBoonLootButton` destroys an explicit list and `TryUpgradeBoon` rebuilds
individual rows. Therefore registering a component only covers final teardown,
not reroll/rarification cleanup. The presentation adapter must explicitly retire
its own marker before replacing a row, then attach to the new selected button.

## Implementation boundaries

- `host/data.lua` and `host/status_ui.lua` own the Boolean setting and UI control;
  use the existing managed settings/commit mechanism. No ModpackLib change.
- Runtime composition constructs one guidance instance. Keep world-target
  resolution and screen presentation in small feature-owned modules, not the
  growing status UI or transaction session.
- Navigation and acquisition owners supply already-resolved target identities
  at existing binding/installation contacts. Guidance only reads state; it must
  not call `begin`, `claimReady`, `complete`, or advance the route merely to draw.
- Selected screen identity must survive enforcement completion until the screen
  closes. Retain only presentation context tied to the exact screen/source and
  session. Do not introduce another pending-acquisition queue or global
  "last selected trait" variable. Echo's nested menu supplies its own context.
- After reroll, render only if the planned choice can still be identified
  unambiguously in the actual native rows. Otherwise clear the marker. Never
  recommend an unrelated row occupying the previous index.
- World markers use actual bound objects, not nearest-object or reward-name
  guesses. For a restored Hub, resolve the next selected Hub visit through its
  published slot and physical door identity. Do not mistake a side-room cursor
  position for the next Hub visit or highlight any N door outside the Hub.
- Refresh after completed binding, wheel preparation and screen construction,
  plus setting/session changes. Do not add per-frame scanning or a threaded
  pending marker that searches for its target.
- Own and destroy only guidance-created visual IDs. Clear them on selection,
  preview removal, screen teardown, room departure, session replacement,
  desynchronization/fault, configured-prefix completion, and disable. Re-enable
  can inspect the existing live door/screen; it must not regenerate content.
- Missing/ambiguous targets or presentation failures mean no marker, with at most
  a bounded diagnostic. They must not stop native gameplay or affect enforcement.

## Delivery gates

### A — Native visual witness and world guidance

Implement the setting, exact world-target selection, and owned marker lifecycle.
Use one ordinary two-exit room, one restored Hub, and a two-phase O ship to check
the native visual in game. Do not deploy without a user request. Automated
acceptance can pass before the visual check, but do not call visual acceptance
complete until the user has seen it.

Primary tests: pure target mapping plus native-hook harnesses in the module.
Cover active vs exited cursor; successive Hub visits, intervening side-room
excursions, exhausted board, and no guidance on N doors outside the Hub;
same-named occurrences; one/two wheel offers and object reuse; Fields
recursive previews; toggle off/on; missing object; mismatched session and exit.
Prove repeated refresh is idempotent and native pins/door behavior are unchanged.

Intended commit: `feat: highlight planned doors and ship wheel choices`.

### B — Trait-screen guidance

Wire selected identities from existing ordinary/Chaos/NPC/Pom/Echo adapters to
the same setting and presentation owner. No new trait-choice semantics. Use
the shared screen lifecycle where possible without pretending every source has
the same selection identity.

Primary tests: adapter-contact and visual-ID lifecycle harnesses. Cover sorted
ordinary choices, Hammer, repeated Chaos curses with distinct selected row,
NPC offers, Pom target, nested Echo, fallback gold, blocked/missing selection,
full reroll, single-row rarification, Boon Info opening/closing, native pins,
hover behavior, disable/re-enable while open, and unrelated unbound menus.
Assert no extra transaction claims/completions or gameplay mutations.

Live witness: ordinary and Chaos screens, one NPC/Pom representative, nested
Echo when available, mid-screen toggle and one button rebuild. Keep untested
native contacts explicitly pending rather than calling harness coverage visual
proof.

Intended commit: `feat: highlight planned trait choices`.

### C — Review and closure

One independent review of the complete feature after both gates, with bounded
remediation. Check stale-context leakage, hook ordering, ID cleanup, repeated
rooms and restores, disabled pass-through, and absence of enforcement changes.
Run `lua tests/all.lua`, `luacheck src/`, and `git diff --check` in the module.
No planner full test run is needed for this docs-only planner scope.

Update only the existing feature hook map and module user-facing setting copy
for the accepted behavior. Remove this temporary plan when acceptance closes;
retain any genuinely pending in-game probe explicitly. Do not revive the
timeline HUD investigation as a dependency of this feature.

## Size and risk check

The feature reuses published identities and native visual assets. It needs no
new scheduler, legality model, protocol, action tracker, or generic event bus.
The real risks are stale visual lifetimes, ambiguous Chaos/nested selections,
and transparent N navigation—not missing planner decisions. If implementation
finds an included surface lacking exact identity or a suitable native visual
contact, report the coverage gap for disposition rather than silently declaring
it delivered. At runtime, omit unsafe highlights rather than widening the
protocol, inventing prompts, or inferring a choice from native list order.
Test safe omission as well as successful highlighting. Optional viability
research for excluded N doors does not block closure.
