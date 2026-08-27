# Hex Talent Layout Implementation Plan

## Status

- **State:** locked and in implementation.
- **Grounded base:** `a0d7ccd9c80dbb2cabce815912d05db6dbc5d037`
- **Intended schema/catalog boundary:** project schema `65`, catalog
  `0.48.0-hex-talent-layouts`.
- **Primary source authorities:**
  - [Hex Talent Layout Game-Data Audit](../audits/loadout-and-progression/HEX_TALENT_LAYOUT_GAME_DATA_AUDIT.md)
  - [Path of Stars and Spell Drop Game-Data Audit](../audits/loadout-and-progression/PATH_OF_STARS_AND_SPELL_DROP_GAME_DATA_AUDIT.md)
  - [Selene Spell Game-Data Audit](../audits/traits/SELENE_SPELL_GAME_DATA_AUDIT.md)
  - [Runtime Offer Fallback Audit](../audits/rewards-and-acquisition/RUNTIME_OFFER_FALLBACK_AUDIT.md)

This is a temporary delivery plan. It is not linked from `README.md`. The
closure gate must absorb lasting implementation facts into the durable audits
and progress record, then delete this file.

## Objective and user-visible outcome

Complete the graph-free Hex layer without turning the Planner into a Path of
Stars graph editor.

For an ordinary three-row Spell Drop:

1. the existing spell rows and Crescent/Half/Full Moonglow ordering remain;
2. only the selected Hex owns a generated-tree configuration;
3. the selected outcome area gains one layout dropdown;
4. the chosen layout exposes exactly two or three Rare-node identity pickers
   and exactly one or two Epic-node identity pickers for that Hex; and
5. the saved launcher summary includes the selected Hex, Moonglow tier, and
   layout.

The same frozen layout is available for Aspect of Selene's fixed Sky Fall,
without inventing a three-row spell screen that the Aspect skips in game.

Simulation then knows the finite tree capacity, derives and permanently adds
the fixed two-node God Sent extension when its audited condition is reached,
clamps writable Path investment to capacity, and closes ordinary Talent Drop
generation at the correct lifecycle boundary. Task Force requires a currently
equipped base Hex, remains authorable without simulating individual Hex-talent
acquisition, and receives its audited runtime fallback.

## Included scope

- the four layout declarations and all nine Hex Rare/Epic pools;
- the fixed linked Olympian talent, provider keepsake, and shared Lineage node
  for each Hex;
- a complete frozen tree configuration for the selected ordinary spell;
- a complete frozen Sky Fall tree configuration for Aspect of Selene;
- strict authored validation, schema migration, commands, Undo/Redo, and JSON
  round-trip;
- the selected-spell editor controls and Aspect-specific loadout controls;
- base capacity, persistent God Sent capacity, banked points, invested points,
  and latched Talent Drop closure;
- existing Minor, normal, Big, Aspect-routed, Moon Beam, and committed Hermes
  Path point contacts;
- replacement of the three hard-coded `allSpellInvested: false` facts with the
  branch's closed state; and
- Task Force's modeled base-Hex prerequisite, runtime-only Olympian-node
  requirement, and existing generic fallback export path.

## Excluded scope

- graph coordinates, links, prerequisites, or layout artwork;
- ordinary/repeatable node identities;
- individual Path-node selection order or acquisition history;
- equipping Hex talents into the normal trait ledger;
- simulating the effects of Rare, Epic, Olympian, or Lineage nodes;
- an authored God Sent checkbox or an authored Task Force predicate;
- tree rerolls, profile progression, or layout probability;
- reopening a latched-closed tree after late God Sent insertion;
- a Hex side tab, a separate Hex dialog, or a generic graph framework; and
- new pending-delivery or replay machinery for rewards already represented by
  Hermes Shrine and Echo acquisition lifecycles.

## Current-code assessment

The implementation should extend existing seams rather than establish parallel
ones:

- `AuthoredTraitOfferTraits` already freezes the ordered Spell Drop rows and
  selected option. The selected tree belongs on that offer, not on all three
  options.
- `TraitOfferEditorShell` already detects `providerKind === 'spell'` and renders
  selected-option detail. The layout and node controls belong in that same
  dialog.
- `ReplaceTraitOffer` already saves the complete local dialog draft and owns
  Undo/Redo. No per-node command family is needed.
- `RouteLoadout` and `ReplaceRouteLoadout` already own Aspect of Selene. The
  fixed Sky Fall configuration belongs there because no ordinary spell offer
  exists under the Aspect. One whole-tree route command is sufficient for
  later layout/node edits; per-node route commands are not.
- `RewardBranchState.hexProgress` already owns banked and invested Path points.
  It should become the complete finite-tree run state rather than gain a second
  capacity ledger.
- `settlePathScreen` is the one shared writable Path boundary. Normal, Minor,
  Big, and Aspect-routed Path screens must continue to use it.
- Hermes Shrine already stores a committed concrete reward through delayed
  delivery. Closed-tree delivery is a settlement rule, not another pending
  object.
- `KeepsakeState.olympianSources` already represents active ordinary and Echo
  Olympian keepsake sources. God Sent must consume that state rather than
  reconstruct keepsake semantics.
- `TraitHistoryState` already retains the currently equipped trait identities
  and their giver keys, including All Together's direct children and later
  Ransom removals. That post-settlement state is the Planner equivalent of the
  source's current `MetGods`; reward history and the ordinary god pool are not.
- runtime trait fallback resolution already chooses one legal same-giver
  alternative and publishes it. Task Force needs declaration data, not new
  fallback machinery.

## Locked model

### 1. Catalog-owned Hex declarations

Add one normalized Hex declaration collection keyed by base spell trait. Each
entry contains only facts with current consumers:

- the spell trait key and label contact;
- the four layouts, each with key, label, base capacity, Rare count, and Epic
  count;
- the ordered Rare candidate identities and labels;
- the ordered Epic candidate identities and labels; and
- the fixed God Sent contract: linked provider key, linked force-keepsake key,
  fixed Olympian talent identity/label, shared Lineage identity/label, and
  capacity delta `2`.

The catalog compiler validates exact four-layout closure, unique node keys,
pool sufficiency for every layout, known spell/provider/keepsake contacts, and
one God Sent pair per Hex. Hex node declarations do **not** enter
`Catalog.traits`; they are frozen execution identities, not normal offerable or
equipped traits.

The exhaustive nine-Hex matrix has one primary test owner in the catalog
package. Engine and UI tests use representative Hexes and must not duplicate
the complete source table.

### 2. One complete selected-tree value

Introduce one authored value with this semantic shape:

```text
Hex tree configuration
  layout key
  unordered unique Rare talent keys
  unordered unique Epic talent keys
```

The persisted arrays use catalog declaration order as their canonical order.
Their cardinalities come from the chosen layout. They carry identities, not
hidden graph positions.

An ordinary resolved `SpellDrop` offer has exactly one configuration for its
`selectedOptionKey`. Unselected rows carry no dormant trees. A non-spell offer
must not carry this field.

Aspect of Selene stores the same value in `RouteLoadout` for its fixed Sky Fall
tree. Other aspects must not retain it. Switching to Aspect of Selene installs
a complete declaration-owned default; switching away removes it. This is the
only Hex UI outside the Spell Drop dialog because the Aspect has no spell
selection screen in the source game.

Ordinary Spell Drop continues to save through `ReplaceTraitOffer`. Aspect
editing adds one semantic `ReplaceAspectHexTree` command carrying the complete
configuration. `ReplaceRouteLoadout` remains responsible for atomically adding
or removing the default when the Aspect identity changes. There is no command
per layout field or node row.

A single pure default builder selects Lung plus the declaration-first legal
Rare/Epic identities. It is used for:

- a new ordinary Spell Drop draft;
- changing the selected spell row;
- selecting Aspect of Selene; and
- changing a layout, preserving still-valid selected identities in declaration
  order and filling or trimming only to the new cardinality.

That builder prevents catalog-default rules from being reimplemented in React,
commands, codecs, and migration code. The schema `64 -> 65` migration uses the
schema-64 catalog-specific equivalent to add complete defaults to existing
resolved Spell Drop offers and Aspect of Selene loadouts, reports how many were
defaulted, and preserves unresolved outer offers as unresolved. The current
strict decoder does not accept schema-64 objects directly.

### 3. Editor behavior

Extend the existing selected Spell Drop outcome; do not create a new editor or
navigation surface.

- Layout is a four-value scalar dropdown.
- Rare and Epic identities use the existing contextual picker presentation.
- The picker rows are labeled Rare node 1..N and Epic node 1..N, but persisted
  meaning remains an unordered set.
- Already-selected identities are excluded from sibling picker domains.
- The linked God Sent pair is shown read-only with its linked god and the note
  that chronology adds it automatically. It is never a checkbox.
- Changing the selected spell row atomically installs that Hex's complete
  default tree before Save can occur.
- Changing the layout applies the shared complete-draft transition above.
- Save remains the existing one `ReplaceTraitOffer` action, and Reset retains
  the current outer-offer behavior.
- Aspect of Selene exposes the same layout and node controls immediately below
  the Aspect selector in Route Loadout, only while that Aspect is active.

Application projections adapt the normalized catalog declaration into labels,
layout choices, and contextual picker models. React renders and edits the
complete local draft; it does not validate cardinality, candidate membership,
or God Sent eligibility.

### 4. Finite Hex progress

Extend `hexProgress` into one explicit branch product containing:

- the installed spell/tree identity when a Hex exists;
- banked Path points;
- aggregate invested Path points;
- whether the God Sent pair has been added; and
- a latched `talentDropsClosed` value.

Capacity is derived from the installed layout's base capacity plus two when
God Sent has been added. It is not separately mutable state.

Ordinary Spell Drop settlement installs the selected configuration before
banking that row's zero/one/two Moonglow bonus. Aspect of Selene installs its
fixed Sky Fall configuration at branch initialization; its first concrete
Spell Drop continues to route through the existing semantic three-point Path
screen with no ordered spell bonus.

Writable Path accounting follows the audited screen chronology:

1. add the pickup's `grant - 1` to the raw bank;
2. invest the implicit first point only when capacity remains;
3. spend banked points only while capacity remains;
4. retain unused raw bank after capacity exhaustion;
5. never allow invested points to exceed current capacity; and
6. latch closure when that writable screen fills the then-current tree.

This distinguishes the important full-tree case: a three-point committed
delivery opened on an already-full tree invests zero and leaves two additional
raw points banked, not three.

The branch's latched value replaces the current hard-coded
`allSpellInvested: false` in normal target generation, room/encounter
preparation, and reward-fact construction. Any branch-agreement checkpoint
that currently transports `pendingSpellDrop` must also transport this closed
fact so candidate generation does not guess across branches.

Run State adds layout, base/effective capacity, God Sent absent/present, and
open/closed alongside the existing spell, banked, and invested counts.

### 5. God Sent chronology

God Sent is one idempotent branch transition. It adds the fixed pair once and
never removes it.

The Planner's closed unlock predicate is:

1. a Hex tree is installed and its God Sent pair has not already been added;
2. the fully progressed profile baseline satisfies the source's Selene-duo
   unlock; and
3. either the post-settlement equipped-trait state contains at least one trait
   whose `giverKey` is the Hex's linked provider, or the active
   `olympianSources` contain the linked provider's force keepsake.

This is current state, not provider encounter history, `LootTypeHistory`, or
ordinary god-pool membership. If the last linked-provider trait is removed
before a reevaluation and no linked keepsake source is active, the provider
side is false. Once the pair is added, later removals do not undo it. Spending
the keepsake's reward-force charge also does not remove its active source or an
already-added pair.

The transition is evaluated only at concrete audited contacts:

- tree installation, against the current equipped traits and active keepsake
  sources;
- after one complete selected trait settlement, after its outer acquisition,
  direct grants, nested Echo result, and removals have all folded; and
- after a starting, ordinary, or Gift-replayed force-keepsake source is
  installed or a keepsake-rack replacement is completed.

All Together requires no special God Sent action. Its outer Hera identity and
four frozen direct-grant identities are already in the post-settlement trait
state before the one reevaluation. The exact matching children are:

| Hex            | Matching All Together result         |
| -------------- | ------------------------------------ |
| Twilight Curse | `ElementalDamageFloorBoon` (Zeus)    |
| Total Eclipse  | `ElementalBaseDamageBoon` (Hestia)   |
| Dark Side      | `ElementalDodgeBoon` (Aphrodite)     |
| Wolf Howl      | `ElementalDamageBoon` (Hephaestus)   |
| Lunar Ray      | `ElementalRallyBoon` (Apollo)        |
| Night Bloom    | outer `AllElementalBoon` (Hera)      |
| Phase Shift    | `ElementalDamageCapBoon` (Demeter)   |
| Moon Water     | `ElementalHealthBoon` (Poseidon)     |
| Sky Fall       | `ElementalOlympianDamageBoon` (Ares) |

The sibling identity in the same All Together set does not unlock that Hex.
This reuses `TraitHistoryState` and `olympianSources`; it does not create a
second current-god, god-pool, All Together, or equipped-keepsake ledger.

If the tree is already latched closed, adding God Sent raises capacity by two
but does not reopen ordinary Talent Drop generation. Read-only inspection is
not modeled as a settlement action. A concrete Hermes delivery committed
before closure still arrives and may invest into any remaining capacity, while
the closure latch remains true.

### 6. Task Force adjustment

Model `OlympianSpellCountBoon` with two deliberately different layers:

- Planner legality requires at least one concrete `SpellDrop` acquisition to
  have settled in the current run; and
- a source-only runtime requirement such as `equippedOlympianSpellTalent`
  retains the deeper God Sent node predicate that the Planner does not
  simulate.

Give it the audited fallback trio:

1. `InvulnerabilityDashBoon`;
2. `RetaliateInvulnerabilityBoon`; and
3. `FocusLastStandBoon`.

The settled-acquisition requirement keeps Task Force unavailable before the
player has actually taken a Spell Drop. This matters for Aspect of Selene:
built-in Sky Fall alone does not qualify, while the Aspect's later concrete
Spell Drop does. The existing generic runtime fallback resolver still removes
companion rows and unavailable simulated-history traits, then exports one
fallback. There is no authored Task Force checkbox, no inference from generated
God Sent presence, and no generated Path talent in `TraitHistory`.

The runtime-requirement enum is declaration/execution evidence only. Planner
legality stops at the modeled Spell Drop acquisition prefix; it does not claim
that the required God Sent node was actually acquired.

## Ownership map

| Concern                                                             | Authority                                            | Main change neighborhood                                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Layouts, node pools, labels, linked gods/keepsakes                  | Hades II catalog                                     | `packages/hades2-catalog/src/declarations/traits/`, compiler, catalog-schema                                  |
| Frozen tree value, strict decode, defaults, route/offer transitions | Planner engine authored model                        | `packages/planner-engine/src/authored-project/`                                                               |
| Capacity, point settlement, closure, God Sent chronology            | Planner engine simulation                            | `packages/planner-engine/src/simulation/hex-progress.ts` and existing acquisition/keepsake lifecycle contacts |
| Talent Drop requirement facts                                       | Planner engine requirements/generation               | existing normal-target, preparation, and reward-fact builders                                                 |
| Spell and Aspect controls                                           | Planner application projection and React             | existing structured-workspace trait interaction, `TraitOfferEditorShell`, Route Loadout                       |
| Task Force acquisition prefix and runtime fallback                  | Catalog declaration plus branch-aware engine history | Athena declaration/compiler, reward-use history, and existing selected-trait products                         |
| Durable evidence and delivery record                                | Docs                                                 | the four named audits and `IMPLEMENTATION_PROGRESS.md`                                                        |

## Delivery gates and commit boundaries

### Gate A — Task Force runtime volatility correction

**Outcome:** Task Force owns its runtime-only node predicate and one safe
fallback without fabricating Hex-node history. Gate C replaces the initial
equipped-Hex approximation with the exact settled-Spell-Drop prefix at the
branch-aware offer frontier.

Work:

- add the closed runtime requirement value to the raw and normalized catalog
  contracts;
- replace Task Force's nine-node `offerRequirements` expression with the
  conservative equipped-Hex approximation available before Gate C;
- declare the audited Athena fallback trio;
- retain the existing one-step fallback resolver and export format; and
- update the runtime fallback audit's current-coverage section only if the
  implementation names differ from its present disposition.

Primary tests:

- catalog: Task Force owns the exact base-Hex requirement, runtime requirement,
  and fallback trio, and malformed declarations are rejected;
- engine: the interim declaration gate is illegal before a Hex and the generic
  resolver exports the first legal non-companion Athena fallback; and
- representative selected-trait product: the one fallback is emitted without
  recursive or authored fallback behavior.

Acceptance lanes: `npm run test:catalog`, the focused engine fallback tests,
then `npm run test:changed`.

Commit: `fix(catalog): move task force eligibility to runtime fallback`

### Gate B — Frozen Hex declaration, authoring, and editor slice

**Outcome:** every selected Hex has one complete frozen layout and Rare/Epic
composition, authored in the existing Spell Drop surface or the Aspect of
Selene loadout surface.

Work:

- add and compile the nine exact Hex declarations;
- add the one authored tree shape and shared complete-default/layout transition;
- attach it to selected ordinary Spell Drop offers and Aspect of Selene;
- bump schema/catalog versions and implement/test migration `64 -> 65`;
- validate exact layout membership, uniqueness, and cardinality in codec and
  `ReplaceTraitOffer`/`ReplaceAspectHexTree` paths, while
  `ReplaceRouteLoadout` owns Aspect entry/exit defaults;
- extend the structured interaction with one selected-Hex editor product;
- render layout plus Rare/Epic contextual pickers and read-only God Sent
  identity in the current spell dialog;
- render the same configuration under Aspect of Selene in Route Loadout; and
- add layout to the existing spell launcher summary.

Primary tests:

- catalog exhaustive matrix: all four layout counts/capacities, all nine
  Rare/Epic pools, and each linked God Sent pair;
- authored model/codec: strict exact shape, wrong pool, duplicate key, wrong
  cardinality, spell mismatch, non-spell leakage, Aspect-only ownership, and
  schema migration defaults;
- command tests: selected-spell/aspect/layout changes yield one complete value
  and Undo/Redo restores the prior value;
- projection/UI: selected Hex only, Lung/Pyramid/Maze/Nacelle control counts,
  contextual identity exclusion, read-only God Sent row, launcher summary,
  and Aspect-only controls; and
- product witness: open a reached Spell Drop, change spell/layout/nodes, save,
  reopen, and Undo without an extra evaluation loop.

Acceptance lanes: `npm run test:catalog`, `npm run test:engine`,
`npm run test:ui`, `npm run test:contract`, schema migration tests, then
`npm run test:changed`.

Commit: `feat(planner): author frozen hex talent layouts`

### Gate C — Finite Path settlement, God Sent, and reward closure

**Outcome:** the authored tree constrains chronological Path investment and
ordinary Talent Drop eligibility, including late God Sent and committed
delivery edges.

Work:

- install normal and Aspect tree configurations into `hexProgress`;
- expose the canonical settled-`SpellDrop` reward-use fact to branch-aware
  trait legality, replace Task Force's interim equipped-Hex approximation with
  that fact, and keep Aspect-start Sky Fall alone ineligible;
- replace unlimited `settlePathScreen` with the audited implicit-first/raw-bank
  calculation and capacity clamp;
- derive capacity and latch closure after writable screens;
- implement the one idempotent God Sent transition at tree, provider, and
  keepsake contacts using post-settlement equipped-trait provider presence;
- carry closed-state agreement through generation checkpoints;
- replace all three hard-coded `allSpellInvested: false` values;
- retain committed Hermes delivery and existing Echo/Path acquisition paths;
  and
- expand Run State with layout, capacity, God Sent, and closure.

Primary engine tests in `hex-progress.test.ts` or a deliberately split nearby
owner:

1. all four base capacities clamp exactly;
2. Minor/normal/Big screens invest `1/3/5` while capacity remains;
3. a full tree plus normal Path delivery banks `2` and invests `0`;
4. preexisting Moon Beam/offer bonus bank is spent only up to capacity and the
   remainder survives;
5. completing a writable screen latches closure and makes later ordinary
   Talent Drop generation fail `TalentLegal`;
6. Aspect of Selene installs frozen Sky Fall and its first Spell Drop invests
   the existing semantic `3`, with no row bonus;
7. Task Force is illegal for Aspect-start Sky Fall before that Spell Drop,
   becomes Planner-legal after the concrete Spell Drop settles, and still
   exports its runtime fallback;
8. God Sent exists at tree creation when a currently equipped trait belongs to
   the linked provider;
9. God Sent exists at tree creation for the linked starting keepsake;
10. later acquisition of a trait from the linked provider adds exactly two
    capacity once;
11. a matching All Together direct child adds the pair, while its sibling from
    the same set does not;
12. Night Bloom's All Together outer Hera trait adds the pair even when every
    child set is exhausted;
13. removing the last linked-provider trait before tree creation does not
    qualify, while removal after insertion does not remove the pair;
14. later ordinary or Gift-replayed linked keepsake installation adds exactly
    two capacity once;
15. removing or spending the keepsake source does not remove the pair;
16. late God Sent after closure raises capacity but does not reopen ordinary
    generation; and
17. a Hermes Talent Drop purchased before closure is delivered afterward,
    clamps to capacity, preserves raw bank, and does not clear the closure
    latch.

Additional boundary tests:

- requirement-fact owners observe open versus closed branch state in normal
  target generation, encounter preparation, and reward construction;
- disagreement across candidate branches is retained explicitly rather than
  collapsed to `false`;
- Run State presents spell, layout, base/effective capacity, God Sent, banked,
  invested, and open/closed truthfully; and
- one named checkpoint fixture covers a normal selected Hex through Path
  closure and one covers Aspect of Selene or late God Sent. The fixture tests
  assert semantic milestones rather than duplicate unit matrices.

Acceptance lanes: focused Hex/generation/Hermes tests, `npm run test:engine`,
`npm run test:planner`, `npm run test:fixtures:check`, then
`npm run test:changed`.

Commit: `feat(engine): enforce finite hex path progression`

### Gate D — Closure absorption

**Outcome:** no temporary plan or stale “minimal/infinite Hex” description
remains, and the complete repository gate is recorded truthfully.

Work:

- update the Hex and Path audits' current Planner coverage without changing
  source evidence;
- update the runtime fallback audit only for final Task Force coverage;
- add a concise durable delivery entry to `IMPLEMENTATION_PROGRESS.md`;
- remove superseded comments that claim no tree-capacity model;
- delete this plan; and
- run the one full repository closure gate after all narrow lanes and review
  fixes are stable.

Acceptance lane: `npm run check` exactly once at phase closure.

Commit: `docs(progress): close hex talent layout delivery`

## Gate review routine

This is a cross-lane schema and lifecycle feature, so each implementation gate
uses the repository's gated delivery routine:

1. start from the preceding clean gate commit;
2. use a fresh executor with the gate's exact ownership and exclusions;
3. run only owning-lane tests during implementation;
4. use a fresh independent read-only reviewer against this plan and the named
   audits;
5. route accepted findings through one bounded remediation pass;
6. perform the main session's bird's-eye diff review; and
7. commit the complete vertical slice before beginning the next gate.

The final review must specifically reject:

- a second Path or keepsake ledger;
- God Sent state derived continuously from the currently equipped keepsake;
- individual Hex nodes in `TraitHistory`;
- per-option dormant trees;
- React-owned cardinality or pool legality;
- new pending-delivery/replay infrastructure;
- a generic graph abstraction; and
- production growth not displaced by a concrete behavior or named test.

## Overengineering audit

Every new engine/catalog product has a stated consumer and witness:

| Addition                                               | Concrete consumers                                                            | Required witness                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Normalized Hex declaration                             | authored validation/defaults, editor projection, capacity/God Sent simulation | catalog matrix plus one editor and one capacity test                      |
| Authored selected-tree value                           | Spell/Aspect UI, persisted executor input, tree installation                  | codec/command round-trip plus product edit witness                        |
| Whole-tree Aspect command                              | Aspect of Selene loadout editor and Undo/Redo                                 | command validation plus route interaction test                            |
| Expanded `hexProgress`                                 | Path settlement, TalentLegal facts, Run State                                 | capacity/closure chronology plus presentation test                        |
| God Sent boolean                                       | effective capacity and Run State                                              | initial, late, persistent, and closed-tree tests                          |
| Closed-state checkpoint fact                           | branch-aware reward generation                                                | open/closed and branch-disagreement tests                                 |
| Task Force base-Hex requirement and runtime enum value | Planner minimum eligibility and game execution evidence                       | catalog normalization, pre/post-Hex legality, and fallback emission tests |

No addition is reserved for future full-Hex work. If an implementation needs a
new abstraction that is not in this table, the gate stops and the plan must be
amended before that abstraction lands.

## Completion definition

The delivery is complete only when:

- normal Spell Drop and Aspect of Selene both own complete frozen tree data;
- the editor exposes exactly the layout-owned Rare/Epic counts;
- God Sent is derived, persistent, and never authored;
- investment is finite and ordinary Talent Drop closure is branch-correct;
- committed delivery retains its distinct lifecycle behavior;
- Task Force uses runtime fallback without Hex-node simulation;
- all schema-64 fixtures migrate and current fixtures decode at schema 65;
- the full closure gate passes; and
- durable docs are updated and this temporary plan is removed.
