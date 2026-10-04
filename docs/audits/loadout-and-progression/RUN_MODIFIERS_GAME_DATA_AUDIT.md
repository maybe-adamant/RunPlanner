# Run modifier game-data audit

Evidence is the local extracted Hades II `Scripts` snapshot inspected on
2026-10-02. These source facts do not establish live-game acceptance or the
behavior of other mods that replace the same contacts.

## Critical hits and double damage

`CombatLogic.lua:Damage` resolves attacker, weapon, projectile and effect before
calculating damage and its two independent bonus rolls. Its sequence is
`CalculateCritChance`, `CalculateDoubleDamageChance`, the hero `LuckMultiplier`,
then the outgoing hero's `OutgoingUnmodifiedCritBonus`, followed by the crit
`RandomChance` and the double-damage `RandomChance`.

For the hero, final crit chance is calculated crit chance times luck plus the
unmodified crit bonus. Final double-damage chance is calculated double-damage
chance times luck; it does not receive that bonus. `RandomLogic.lua:RandomChance`
returns false without drawing only for a nil chance. Numeric zero still calls
`rng:Random()` and compares its result with the chance.

`CalculateCritChance` owns weapon/projectile, required-trait, active-effect,
Omega and other contextual prerequisites, plus victim crit vulnerability.
`CalculateDoubleDamageChance` separately owns its modifier prerequisites.
`TraitData_Ares.lua:AresStatusDoubleDamageBoon` requires `AresStatus` on the
victim. `MissingHealthCritBoon`, despite its name, adds double-damage chance
proportional to the hero's missing health.

After the rolls, projectile or effect `BlockCrit` prevents the native factor
of three. Effect `BlockDoubleDamage` prevents the factor of two; `Damage` does
not test a projectile field of that name. Both successful, permitted outcomes
can apply together. Pure damage, invulnerability, `IgnoreAllModifiers`, and
`IgnoreFutureModifiers` retain their native branches. Other crit rolls exist
outside `Damage`, including the `FirstHitHealTrait` hit-effect contact.

Planner disposition: retired. The guaranteed-crit and guaranteed-double-damage
modifiers were never released; their declarations, executor wraps and authored
keys are removed, and a save carrying them decodes to the gold-only shape. The
source facts above remain the evidence for any future damage-roll modifier,
which would have to keep each original RNG call's arguments and consumption,
leave native blockers and flags intact, and affect only exact outgoing-player
`Damage` rolls with positive final chances.

## Capped hostile-enemy gold

`CombatLogic.lua:Kill` calls
`CheckMoneyDrop(victim, victim.MoneyDropOnDeath, killer)`. Reaction drops call
`CheckMoneyDrop(victim, reaction.DropMoney)` instead. Native `Kill` clears effects
with allegiance reset before its death-drop call; `EffectLogic.lua:CharmClear`
removes the Lua `Charmed` marker. Hostility must therefore be observed before
that cleanup, not reconstructed from the victim at drop time.

`EnemyData.lua:BaseVulnerableEnemy` declares `DamageType = "Enemy"` and
`AddToEnemyTeam = true`; neutral and ally declarations use distinct damage types.
Live enemy identity is carried by `ActiveEnemies`. Charmed and permanent
`AlwaysTraitor` units are excluded from hostile-enemy modifier scope. Breakables
and uncapped drops do not become eligible merely because they reach `Kill`.

`RoomLogic.lua:CheckMoneyDrop` rolls the supplied chance before checking
`BlockMoney`. It computes native money bonuses and parcels, then debits
`CurrentRun.CurrentRoom.Encounter.MoneyDropStore` unless the drop ignores the
store. `RunLogic.lua` initializes the store from encounter bounds, run-depth
ramp and the hero money multiplier. Exhausted stores produce no capped parcels.
The loop checks the remaining store before each parcel and deducts the full
rounded amount afterward: the last parcel can overshoot the remaining store.
It also decrements its local parcel budget by the paid amount, not by one.

Planner disposition: the enemy gold-drop chance multiplier is the only released
run modifier. At the exact three-argument death contact for a hostile
victim, a positive chance is scaled to `min(1, chance * multiplier)` only when
an encounter store exists and the data does not ignore it. A call-local copy
changes only `Chance`. The game owns all other checks, parcel amounts and store
mutations. Reaction drops, urns, cocoons, neutral/allied units, authored rewards,
and uncapped drops remain native. There is no stricter final-parcel clamp,
extra money store, or gold-amount multiplier.

## Native lifetime contacts

`RunLogic.lua:StartNewRun` creates a new `CurrentRun` table before hero creation.
`DeathLoopLogic.lua:HandleDeath` sets `SessionMapState.HandlingDeath` and the
hero's `IsDead` flag without replacing that table. Hub entry sets
`CurrentHubRoom`; leaving the hub clears it. These are distinct lifetime facts.

Planner disposition: settings belong to the admitted plan and that native run
identity, and require successful starting-loadout verification or supported
Postboss entry admission. Same-run prefix completion does not end these
run-wide options; mismatch and executor faults do. Native death/hub guards and
run-identity replacement prevent carryover without persisting activation into
game saves. Already-entered room restoration does not introduce an additional
admission path. Gold-urn generation is outside the supported modifiers.
