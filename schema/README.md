# Project schema boundary

The application migrates documents from schema 86 onward to the current schema
when it opens them. Earlier schemas are no longer supported. The floor moves
only together with a major schema bump, and only by explicit owner decision;
until then every transition from the floor stays. The same
transitions run offline through one tool, which reads the file's own
`schemaVersion`, applies every transition up to the current schema (or `--to`
an older one) and writes a sibling `-schema<N>` file without overwriting the
source:

```bash
npm run schema:migrate -- path/to/project.runplanner.json
npm run schema:migrate -- --to 98 path/to/project.runplanner.json
```

A new schema adds its browser-safe transform beside the others in
`apps/planner/src/persistence/project-<from>-to-<to>.js` (with its `.d.ts`),
appends it to `PROJECT_TRANSITION_STEPS` in
`apps/planner/src/persistence/project-transitions.js`, which both the
application loader and `migrate-project.js` read, and owns its behavior in a sibling
`migrate-project-<from>-to-<to>.test.js` here. Run the boundary tests with:

```bash
npm run test:schema:migrate
```

## History

Schema 100 makes the Zagreus Contract pedestal a Preboss room feature in
either reward form: every Preboss that declares a pedestal destination owns
`infernalContractPedestal` (its item), collected by an
`interactInfernalContractPedestal` action, and a collected Mystery item's
source lives in the `infernalContractPedestal` acquisition site. The Shop no
longer has an `infernalContractReward` offer.

Every Ephyra combat, Mini-Boss and side room also owns `phantomExit`, its
hidden return door: `placeholderRoomGameName` and `rewardType`. A null field
is settled by the simulation (first eligible placeholder; the reward type with
the most entries left in that placeholder's store); a pinned value is kept and
assessed. The transition gives every such room both fields null.

Rerolls are new optional state. A `reroll` room action (`rerollId`, `target`:
a door, a door's cage slot or a wheel offer, and the new `reward`) and a Hub
`reroll` action (`rerollId`, `hubSlotKey`, `reward`) each record one press;
the target keeps its first draw. A rerolled owner holds the reward it is
entered with in `rerolledIncomingReward`, `rerolledCages` or
`rerolledOffers`. Trait, Chaos and Pom choice screens hold optional
`rerolledScreens`: the screens shown before the final one, oldest first, each
complete (trait rows with rarities and optional `persephoneLevelBonus`, an
optional `rejectedOptionKey`, three
Chaos curses, or Pom `offeredTraitKeys`) or null while unauthored. A Stygian Well or Pool of Purging reroll is a room action
(`rerollStygianWell` with `offerKeyBySlot`, `rerollPurgingPool` with
`traitKeyBySlot`, each with its `rerollId` and only its pinned slots); a Well
purchase names its roll in `generationKey` (`r1:healing`), and a Pool sale
names a reroll's list in `rollKey` (absent for the initial list). The feature
state holds the initial stock and no `interacted` flag; the transition drops it,
keeping an interacted feature's slots and clearing an uninteracted one's. The transition writes none of them.

The migration moves a Shop-owned pedestal item, its collect action and its
source entry to the room unchanged, and gives every other pedestal-declaring
Preboss occurrence an unset item.

Schema 99 keys Steady Growth targets and Transcendent Embryo blessings by their
source and cycle: a trait offer that gives Steady Growth owns
`steadyGrowthTargets`, and the keepsake selection that installs the Embryo owns
`transcendentEmbryoTransformations` in its equip results, each keyed by cycle
from 1. A room's encounter state no longer has `steadyGrowthTargetByPhase` or
`transcendentEmbryoBlessingByPhase`.

The migration drops the phase-keyed outcomes; each reached interval then reports
its missing target or blessing until it is chosen again.

Revision 98.1 adds the draft spec's `roomForcing`, `purchasesPerBiome`,
`retriesPerBiome` and `resourceRoomChance`. A revision changes no saved shape,
so it has no transition.

Schema 98 adds the plan's `name`.

The migration names the plan after the file it is loaded from (its stem,
trimmed and bounded) and otherwise gives it the default. A slot source stored
before 98 names its plan beside the project, and rebuilding the slot migrates
the project under that name.

Schema 97 saves the Draft settings in `route.draft`, makes every Postboss
keepsake rack a permanent timeline row, and moves the Practice start point
from `loadout.runModifiers.startPoint` to `route.practiceStart`.

The migration adds an empty `route.draft`. On every Postboss occurrence whose
route offers the rack, it adds an unchanged rack (`keepsakeKey: null`) right
after Use Fountain; on routes that exclude the rack (Fresh File) it drops a
retained rack. The Practice start keeps its value, and empty run modifiers are
removed.

Schema 96 makes every N Hub own its completed-Hub exit: the width-one
`N_PreBoss01` batch sourced by the Hub decision, with its fixed Boss and
route-position Postboss.

The migration gives each Hub without that exit the chain with
declaration-owned default room state and new biome-scoped identities
(`<biomeKey>:preboss`, `:boss`, `:postboss`); Hubs that already own it and
every existing identity are unchanged.

Schema 95 adds `hexActivationsByAcquisitionRole` to a reward: the nodes each
reached Path of Stars screen invests.

The migration changes only the version and leaves every screen unresolved; each
reached screen then reports its missing selection until its nodes are chosen.

Schema 94 stores each Hex tree (a Spell Drop offer's `hexTree` and the Aspect of
Selene `loadout.aspectHexTree`) as `{ layoutKey, nodes }`, the talent on every
non-Olympian node, instead of Rare and Epic identity sets.

The migration places the Rare picks in the layout's Keystone nodes and the Epic
picks in its Legendary nodes, in layout order, and fills every repeatable node
with the catalog's default draw; nothing else changes.

Schema 93 adds the loadout `familiarKey`, required on a mature save and `null`
on Fresh File, and an optional Worry Free `maxHealthRoll` offset above the
acquired rarity's minimum roll, whose absence is offset 0.

The migration equips Frinos (`FrogFamiliar`) on every mature route and `null`
on Fresh File, after `startingKeepsakeKey`; nothing else changes.

Schema 92 stores an Anvil of Fates result on the reward that carries the Anvil,
in `anvilResultsByAcquisitionRole`, instead of on the World Shop slot.

The migration moves each Shop slot's `anvilResult` onto its reward's `self`
role and gives every other reward carrying an Anvil, such as a Gold Gold Gold
duplicate, an unauthored `null` result.

Schema 91 authors each Hermes Shrine purchase as a `purchaseHermesShrineOffer`
room action that owns its rush; `purchaseBySlot` and the Travel Deal refill
purchase keep only their delay.

The migration adds one action per purchased generation in slot order, then the
refill, before the Shrine room's own pickups, so the first rushed purchase is
unchanged.

Schema 90 admits the Fresh File route, whose loadout stores `null` weapon,
aspect and starting keepsake selections. Every schema-89 document is a mature
save with its selections already written.

The migration changes only the schema version and writes a sibling file
without overwriting the source.

Schema 89 gives every project a unique identity. Schema 88 created every new
project with the shared default `projectId` `'run-plan'`.

The migration replaces a `projectId` that is exactly `'run-plan'` with a unique
`run-plan-<uuid>` and changes nothing else; every other id is kept. Because the
new id is random, the output is not byte-for-byte reproducible. It writes a
sibling file without overwriting the source.

Schema 88 replaces a Hub decision's room-only `visitOrder` with one ordered
`actions` list of room visits (`{ kind: 'roomVisit', hubSlotKey }`) and the
single Hub fountain use (`{ kind: 'useFountain' }`). It adds the Hub-owned
Phial outcome `fountainRarityResult`. Encounter customization may also record an
Arachne cocoon count or an ordered Anomaly roster; neither needs migrated values.

The migration places fountain use before the first visit of every Hub,
including incomplete and empty visit lists. It preserves room order, open
targets, and other data, and selects no Phial target, so a Phial route reports a
repairable target finding. It writes a sibling file without overwriting the
source.

Schema 87 removes the retired per-wave `weights` from generated encounter
customizations.

The migration deletes only those weights, preserving wave type selections and
every other customization. It writes a sibling file without overwriting the
source.
