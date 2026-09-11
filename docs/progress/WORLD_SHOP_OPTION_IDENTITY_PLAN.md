# World Shop Option Identity Plan

Status: locked  
Base: `5708964c`

## Objective

Preserve the exact declaration-owned World Shop option selected for every
authored inventory slot. The Q World Shop must expose ordinary **Boon** and
**Boosted Boon** as distinct choices, and downstream trait authoring must use
the one rarity context owned by that selected item.

## Authority and scope

- Catalog Shop option entries remain the authority for item identity,
  requirements, purchase interaction, and item-owned rarity overrides.
- Authored `ShopOfferState` gains the selected option key beside its resolved
  reward. A selected reward may temporarily retain a null option key only to
  represent an ambiguous migrated document that requires repair.
- Shop generation and focused candidates consume the exact authored option
  key. Without-replacement selection remains a Shop-kernel rule.
- The application adapts exact Shop options into the existing contextual
  authoring flow. `BoostedRandomLoot` is labelled **Boosted Boon**; selecting
  either Boon identity then resolves its God normally.
- Trait acquisition remains an ordinary boon acquisition. The selected Shop
  option supplies only its item-owned rarity context.

Room-wide rarity overrides, including miniboss boosts, are unchanged. Wells,
Hermes Shrines, purchase participation, and acquisition settlement are out of
scope.

## Delivery

1. Add exact Shop option identity to the authored schema, codec, commands,
   materialization, Shop kernel, simulation candidates, and execution assembly.
2. Add the Shop-specific contextual projection needed to distinguish options
   that resolve to the same reward type, without inventing a second boosted
   reward/acquisition type.
3. Add schema 80 -> 81 migration. Infer an option only when the old authored
   value has one semantically exact explanation; retain ambiguous Q
   `RandomLoot` rows with a null option key for explicit repair.
4. Update the durable Shop and rarity documents to describe authored exact
   option ownership, then remove this temporary plan at closure.

## Acceptance

- Q group one can author ordinary Boon and Boosted Boon in either emitted slot
  while retaining exact without-replacement behavior.
- An ordinary authored Hera Shop boon has only ordinary item rarity context;
  a Boosted Boon has only the declared boosted item rarity context.
- Reopening either choice preserves its exact item identity and God.
- Mystery Boon remains type-only in Shop inventory and resolves its God only
  after purchase.
- Existing unambiguous Shop fixtures migrate exactly; an ambiguous legacy Q
  boon remains repairable without guessing its profile.
- Authored codec, Shop kernel/simulation, application projection/UI, migration,
  fixture integrity, typecheck, lint, and formatting checks pass.

