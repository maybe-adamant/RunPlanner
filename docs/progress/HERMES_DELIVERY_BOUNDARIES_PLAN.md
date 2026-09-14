# Hermes delivery boundaries

Status: locked for implementation. Base: `f04487a6`.

## Outcome and authority

Pending Hermes Shrine orders become required pickups at the final Preboss of
the catalog route, even when no ordinary encounter clock advances there.
Shrine Travel Deal replacements can be rushed through the ordinary same-room
delivery workflow. Maturation never acquires a reward automatically.

The engine owns timing, placement, acquisition settlement, and authoring
capabilities. The application renders these capabilities and the shared Shrine
purchase controls. The executor continues to use native delivery timing and
published acquisition transactions; it gains no clock or purchase policy.

Governing authorities are `docs/design/SIMULATION_AND_VALIDATION.md`, the Hermes
delivery and Travel Deal sections of `docs/design/ROOM_LIFECYCLE_MODEL.md`, and
the source evidence in `docs/audits/room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md`.
Native `SpawnHermesInPerson` / `CompleteSurfaceShopItems` expire outstanding
orders before the final boss. `HandleSurfaceShopAction` permits speeding up a
replacement; its first-speed-up guard prevents another Travel Deal refill.

## Locked scope

- Identify final Preboss by declaration kind and the catalog route's final
  biome, not a room name, Shop profile, or last currently authored biome.
  Shop, free-reward, and no-reward Preboss declarations share the rule.
- Move forced maturity out of the ordinary encounter decrement. Ordinary
  encounter eligibility and counting remain unchanged.
- Reuse pending deliveries, due frontiers, placement findings, ranked actions,
  and acquisition settlement. No new scheduler, persisted timing tag, fake
  combat phase, or automatic pickup.
- Final-Preboss entry maturity uses an explicitly placed phase-less delivery
  action in the existing post-outgoing pickup window. Ordinary delayed
  deliveries remain phase-bound. Earlier unresolved required deliveries must
  still stop progression; final maturity is not a bypass.
- Share the narrowly owned due-delivery frontier construction between entry
  and encounter-end contacts. Preserve complete branch cohorts and exact
  placement repair, including an already-retained wrong-phase action.
- A rushed refill creates its required same-room pickup after its triggering
  initial delivery. Resolve its payload using existing acquisition controls.
  Unrush, unpurchase, and source removal retain the established cleanup rules.
- Remove explicit refill-rush prohibitions in commands, decoding, and UI.
  The existing purchase model already has a boolean `rushed` field; no schema
  or execution-protocol bump is intended.

## Delivery and verification

One focused implementation gate, followed by independent review and closure:

1. Correct engine transitions, placement/capability contacts, codec, and the
   shared Shrine UI. Start at `encounter-end-effects.ts`, `room-entered.ts`,
   reward `chronology.ts`, acquisition `acquisition-point-reached.ts`,
   `PlaceHermesShrineDelivery`, room-action state/domain, occurrence codec and
   dispatch, and the workspace due-row / rushed-control projections.
2. Keep the timing and purchase matrices in engine tests; retain representative
   application workflows for placement and refill rushing. Cover final versus
   earlier Preboss, non-Shop final Preboss, ordinary countdown preservation,
   multiple pending orders, payload-preserving placement/repair, delayed ↔
   rushed refill cleanup, no second refill, and editable Mystery Boon delivery.
   Use real simulator/command workflows rather than a fabricated completion
   event supplied to the unused isolated delivery-derivation helper.
3. Verify `/mnt/c/Users/Mohammed Ayyat/Desktop/plans/hex-schema82.json` read-only:
   the P Postboss Mystery Boon order becomes due in Q Preboss; placing and
   resolving it can produce a publishable plan. Verify a rushed Travel Deal
   replacement through authoring, simulation, and execution serialization.
   Do not make repository tests depend on this external path.
4. Run focused tests during implementation, independent adversarial review,
   then one complete repository check. Regenerate only semantically affected
   fixtures and preserve their established formatting; mirror changed wire
   products only if needed.

## Exclusions and closure

No Dream Dive implementation, new native delivery forcing, executor redesign,
unrelated Shop/Contract changes, or deployment. Preserve the existing dirty
documentation and executor fixes. Correct stale owning documentation in place
(including Q's obsolete unimplemented-delivery statement); do not add a bug
changelog. Remove this temporary plan at closure. Keep implementation changes
uncommitted for user inspection unless a subsequent commit is requested.
