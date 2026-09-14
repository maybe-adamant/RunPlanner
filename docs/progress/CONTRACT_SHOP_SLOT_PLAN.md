# Contract Pedestal as Initial Shop Inventory

Status: locked for implementation. Base: `8e5cdb82`.

## Outcome

Infernal Contract exposes one conditional, free initial Shop slot. Inventory is
chosen against room-entry state; optional collection and its outcomes use the
existing Shop acquisition path. Selecting a Path must not borrow a Hex acquired
later in the room. Selecting a Mystery Boon must not require its hidden god in
Overview or evaluate that god against inventory-generation state.

The current uncommitted attempt uses one acquisition-entry owner for both
inventory and resolution. Replace that approach, rather than adding another
candidate facet or a permissive decoder exception.

## Facts and Ownership

- Native `SpawnZagContractRewards` uses `FillInShopOptions` with the one-slot
  `ZagPedestalOptions` pool and `SpawnStoreItemInWorld`. It requires the Contract
  trait, sets cost zero and `IgnorePurchase`; it does not trigger paid-purchase
  effects such as Travel Deal or Gold Gold Gold.
- Catalog owns the pool and room descriptor. The host profile and pedestal pool
  remain separate native generation cohorts; do not invent conditional kernel
  groups or change the host's slot counts and without-replacement rules.
- Authored state stores the pedestal as an ordinary `ShopOfferState` at
  `state.shop.offers.infernalContractReward`. A narrow declaration binding
  resolves this slot to its own profile. Its action is `interactShopOffer`.
- Hidden-source acquisition state uses the existing matching acquisition entry,
  exactly as an ordinary Shop Mystery Boon. Inventory uses `ShopOfferAddress`;
  source and child repair use their existing acquisition addresses.
- Materialization reuses `CanonicalShopOffer` for the pedestal but keeps the
  host's indexed offer arrays separate from the extra one-slot cohort.
- Simulation captures activation and generation support at room entry. An
  active null inventory produces a repairable finding; inactive retained detail
  stays dormant. Acquisition reuses the normal source/role settlement with free
  provenance and excludes paid-purchase effects. Do not recheck activation or
  generate the item during acquisition.
- The application presents supported engine slot products through existing
  Shop inventory/participation and timeline controls, with no new eligibility
  policy. The physical pedestal can retain its label/grouping.
- Execution publication copies the existing pedestal wire shape and acquired
  outcome products. No game-module behavior or protocol redesign is in scope.

## Delivery

One coherent implementation slice, followed by independent review and closure:

1. Replace the special inventory/source ownership across defaults, commands,
   codecs, materialization, generation/candidates, acquisition and presentation.
   Remove superseded Contract candidate, supplemental pickup and UI paths.
2. Bump authored schema once and supply a focused migration preserving selected
   inventory, Mystery source/results, non-Mystery outcome detail, participation
   and action order. Migrate affected fixture inputs through that function.
3. Verify and update the smallest stable owning documents, then retire this plan.

Do not introduce a generic registry, conditional-slot framework, dual candidate
mode, fallback normalization, or second acquisition settlement. Preserve
unrelated dirty work and do not commit implementation without handoff approval.

## Acceptance and Test Ownership

- Engine primary witnesses: active/uncollected missing inventory; inactive
  retained detail; entry-time Path legality with a later first Hex purchase;
  identity-only Mystery inventory; acquisition-time god-pool support and child
  repair; optional participation and free/non-Travel behavior.
- Command/codec/migration owners: ordinary slot editing and roundtrip; preserve
  old Contract identity/results and exact order; no placeholder child required
  for an uncollected Mystery.
- Application: a representative real command/workspace loop selecting Mystery
  in Overview then collecting/resolving it in Timeline; exact finding/control
  owner correspondence. Avoid duplicating the engine's full policy matrix.
- Read the supplied `hex.json` without overwriting it; migrate in memory, check
  missing inventory routes to Overview and Path choices are rejected without
  throwing. Complete a legal alternative and verify publication as applicable.
- Keep execution fixture formatting and mirror only changed generated products.
  Narrow tests first; one full repository gate after review is stable.

Review specifically for retained special paths, lost outcome/level/disposition
context, host witness indexing, conditional activation timing, source candidate
context, and schema/migration fidelity.
