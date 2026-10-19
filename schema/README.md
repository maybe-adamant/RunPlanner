# Project schema boundary

Schema 97 saves the Draft settings in `route.draft`, makes every Postboss
keepsake rack a permanent timeline row, and moves the Practice start point
from `loadout.runModifiers.startPoint` to `route.practiceStart`.

```bash
npm run schema:migrate-96-to-97 -- path/to/schema-96-project.runplanner.json
```

The migration adds an empty `route.draft`. On every Postboss occurrence whose
route offers the rack, it adds an unchanged rack (`keepsakeKey: null`) right
after Use Fountain; on routes that exclude the rack (Fresh File) it drops a
retained rack. The Practice start keeps its value, and empty run modifiers are
removed.

Schema 96 makes every N Hub own its completed-Hub exit: the width-one
`N_PreBoss01` batch sourced by the Hub decision, with its fixed Boss and
route-position Postboss.

```bash
npm run schema:migrate-95-to-96 -- path/to/schema-95-project.runplanner.json
```

The migration gives each Hub without that exit the chain with
declaration-owned default room state and new biome-scoped identities
(`<biomeKey>:preboss`, `:boss`, `:postboss`); Hubs that already own it and
every existing identity are unchanged.

Schema 95 adds `hexActivationsByAcquisitionRole` to a reward: the nodes each
reached Path of Stars screen invests.

```bash
npm run schema:migrate-94-to-95 -- path/to/schema-94-project.runplanner.json
```

The migration changes only the version and leaves every screen unresolved; each
reached screen then reports its missing selection until its nodes are chosen.

Schema 94 stores each Hex tree (a Spell Drop offer's `hexTree` and the Aspect of
Selene `loadout.aspectHexTree`) as `{ layoutKey, nodes }`, the talent on every
non-Olympian node, instead of Rare and Epic identity sets.

```bash
npm run schema:migrate-93-to-94 -- path/to/schema-93-project.runplanner.json
```

The migration places the Rare picks in the layout's Keystone nodes and the Epic
picks in its Legendary nodes, in layout order, and fills every repeatable node
with the catalog's default draw; nothing else changes.

Schema 93 adds the loadout `familiarKey`, required on a mature save and `null`
on Fresh File, and an optional Worry Free `maxHealthRoll` offset above the
acquired rarity's minimum roll, whose absence is offset 0.

```bash
npm run schema:migrate-92-to-93 -- path/to/schema-92-project.runplanner.json
```

The migration equips Frinos (`FrogFamiliar`) on every mature route and `null`
on Fresh File, after `startingKeepsakeKey`; nothing else changes.

Schema 92 stores an Anvil of Fates result on the reward that carries the Anvil,
in `anvilResultsByAcquisitionRole`, instead of on the World Shop slot.

```bash
npm run schema:migrate-91-to-92 -- path/to/schema-91-project.runplanner.json
```

The migration moves each Shop slot's `anvilResult` onto its reward's `self`
role and gives every other reward carrying an Anvil, such as a Gold Gold Gold
duplicate, an unauthored `null` result.

Schema 91 authors each Hermes Shrine purchase as a `purchaseHermesShrineOffer`
room action that owns its rush; `purchaseBySlot` and the Travel Deal refill
purchase keep only their delay.

```bash
npm run schema:migrate-90-to-91 -- path/to/schema-90-project.runplanner.json
```

The migration adds one action per purchased generation in slot order, then the
refill, before the Shrine room's own pickups, so the first rushed purchase is
unchanged.

Schema 90 admits the Fresh File route, whose loadout stores `null` weapon,
aspect and starting keepsake selections. Every schema-89 document is a mature
save with its selections already written.

```bash
npm run schema:migrate-89-to-90 -- path/to/schema-89-project.runplanner.json
```

The migration changes only the schema version and writes a sibling file
without overwriting the source.

Schema 89 gives every project a unique identity. Schema 88 created every new
project with the shared default `projectId` `'run-plan'`.

```bash
npm run schema:migrate-88-to-89 -- path/to/schema-88-project.runplanner.json
```

The migration replaces a `projectId` that is exactly `'run-plan'` with a unique
`run-plan-<uuid>` and changes nothing else; every other id is kept. Because the
new id is random, the output is not byte-for-byte reproducible. It writes a
sibling file without overwriting the source.

Schema 88 replaces a Hub decision's room-only `visitOrder` with one ordered
`actions` list of room visits (`{ kind: 'roomVisit', hubSlotKey }`) and the
single Hub fountain use (`{ kind: 'useFountain' }`). It adds the Hub-owned
Phial outcome `fountainRarityResult`. Encounter customization may also record an
Arachne cocoon count or an ordered Anomaly roster; neither needs migrated values.

```bash
npm run schema:migrate-87-to-88 -- path/to/schema-87-project.runplanner.json
```

The migration places fountain use before the first visit of every Hub,
including incomplete and empty visit lists. It preserves room order, open
targets, and other data, and selects no Phial target, so a Phial route reports a
repairable target finding. It writes a sibling file without overwriting the
source.

Schema 87 removes the retired per-wave `weights` from generated encounter
customizations.

```bash
npm run schema:migrate-86-to-87 -- path/to/schema-86-project.runplanner.json
```

The migration deletes only those weights, preserving wave type selections and
every other customization. It writes a sibling file without overwriting the
source.

The application migrates documents from schema 86 onward to the current schema
when it opens them. Earlier schemas are no longer supported.

Run the focused boundary tests with:

```bash
npm run test:schema:migrate
```
