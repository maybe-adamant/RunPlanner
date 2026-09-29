# Fresh File — rooms outline

Status: design outline, not a locked delivery plan or schema approval.
Evidence: [viability investigation](FRESH_FILE_PROJECT_VIABILITY.md), room
inventory and pressure follow-up.

## Outcome and established facts

Reuse Underworld topology with profile-aware room/feature eligibility.
No new topology system is required.

- Only `F_Opening01`; its next room is forced `F_Combat01`.
- No Arachne, Narcissus or Hades story room; no Reprieve rooms.
- F miniboss domain is Root Stalker; G retains Hellifish/Serpent, not Uh Oh.
- No Chaos, Zagreus or Anomaly detours, Wells or Purging Pools.
- Ordinary postboss rooms and fountains remain present.
- `H_Bridge01` carries Shop instead of Echo. Preserve its existing generation
  window, forced pressure and creation limit, including missing it by choosing
  another offered door. Shop is not guaranteed to be visited.
- G/H/I intros can host Eris and their respective gifts, gated by the physical
  health condition and absence of her existing curse/interaction state.

## Required behavior and owners

The following contracts are settled:

- Reuse existing requirement-based room forcing: catalog data forces `F_Combat01` at
  the appropriate biome depth under `FreshFile`, not in ordinary projects.
  Apollo contents use existing no-core offer eligibility and rarity validation;
  neither requires a new generic fixed-offer mechanism.
- G/H/I intro room features expose the bounded Eris trigger/health-condition
  checkbox. When checked and eligible, it creates an ordinary Interact with
  Eris timeline action. That action owns the interaction and gift; setting the
  feature alone must not credit the resources. Existing curse/history still
  prevents repeat interactions. Exact checkbox copy remains presentation work.
- Echo cannot be met in Fresh File. The existing `H_Bridge01` resolves to Shop;
  no choice between Echo and Shop is exposed for this profile.

Catalog room declarations own exclusions and content variants. Engine
candidates, topology and lifecycle resolve them; React does not filter by
room name or implement pressure.

1. Initialize the empty opening and enforce its first-combat successor.
2. Resolve bridge content to the existing shop model, including generation,
   inventory, acquisition and export; remove the assumption that this
   occurrence necessarily owns Echo interaction.
3. Add the bounded Eris health-condition input to intro authoring. Derive actual
   occurrence, gift and repeat prevention; do not expose independent gift
   toggles. The condition describes leaving the preceding boss at the required
   health threshold, not a new health simulator.

Starting neighborhoods: `packages/hades2-catalog/src/declarations/rooms/f.ts`,
`g.ts`, `h.ts`, `i.ts`; their existing initialization, room-candidate,
topology and timeline consumers in the engine/application. Exact handler
ownership and executor contacts must be pinned in the delivery plan.

## Dependencies

[Loadout](FRESH_FILE_LOADOUT.md) supplies initialization;
[rewards](FRESH_FILE_REWARDS.md) owns Apollo and bridge inventory;
[encounters](FRESH_FILE_ENCOUNTERS.md) owns first-combat identities;
engine resource gains credit Eris resources.

## Representative acceptance cases

- No invalid opening variant or detour can be selected.
- Empty opening leads to the fixed first combat, with Apollo acquired afterward.
- Postboss fountain remains usable despite Reprieve/Wells/Pool exclusions.
- Bridge Shop replaces Echo without changing the bridge pressure window.
- Midshop is excluded at a one-exit boundary; forced status cannot override
  eligibility. G's shop cutoff remains distinct from its force-window maximum.
- Eris condition false yields no gift; true grants the correct eligible gift;
  subsequent intros respect repeat prevention and later resource unlocks.

Primary tests: catalog restrictions and engine topology/candidate/lifecycle
owners; representative bridge and Eris application/execution witnesses.

## Remaining decisions and exclusions

Pin Eris action representation and native enforcement contact. No damage
simulation, new room identities, new pressure algorithm or save manipulation.
