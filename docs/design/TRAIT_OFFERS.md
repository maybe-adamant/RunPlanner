# Trait Offers

## Purpose

This document owns trait-bearing offers: the authored outcome a reward or
encounter role persists, the state an offer is assessed against, how a valid
selection settles, and the equipped-trait facts later offers read.

The [Reward Model](REWARD_MODEL.md) owns the rewards and acquisition roles that
carry these offers; [Encounter Preparation](ENCOUNTER_PREPARATION.md) owns the
encounters that declare them. [Candidate
evaluation](CANDIDATE_EVALUATION_MODEL.md#trait-offer-candidate-boundary) owns
picker queries. The trait audits under
[`docs/audits/`](../audits/README.md#traits)
own native pools, construction stages, rarity contributions and per-trait
effects.

## Authored outcome

Every reward- or encounter-owned trait role persists one closed
`AuthoredTraitOffer` at its exact `TraitOfferAddress`. A `traits` outcome owns a
one-to-three tuple of distinct options and a selected key that addresses a
materialized position. A `fallbackGold` outcome owns only its giver; it has no
selected key, rarity, target, Circe resolution, or Death Defiance condition.
Only Olympian and Hermes givers support sparse or fallback outcomes. Defaults
for every giver remain complete three-option trait outcomes, and an upstream
edit may retain a context-invalid outcome for explicit repair.

Providers resolve from declaration-owned acquisition roles, not room names or
presentation. Dormant, unpicked and unpurchased sources produce no reached
trait event.

Trait outcome discovery and updates belong to the authored engine boundary.
The engine derives typed semantic children from the complete offer or a
supported partial Echo draft, including missing required values. These
children are derived products, not a persisted payload container. Structural
completion, contextual support and settlement remain distinct: discovery does
not evaluate eligibility, and an unavailable candidate context does not erase
a retained child's repair identity. Updates reconstruct the complete owning
offer through the engine boundary.

### Spell Drop and Hex trees

`SpellDrop` uses the same `traits` shape at its `self` acquisition role:
exactly three distinct, rarityless options from Selene's ordered eight-spell
provider pool and one selected option. It is not a separate spell offer model.
Under Aspect of Selene, the loadout instead requires one complete
`loadout.aspectHexTree` for fixed Sky Fall. Its later concrete Spell Drop has
no trait-offer child—nullable, dormant, and retained children are all
unsupported—and settles the three-point Path screen.

Both trees share one planner-owned shape, `{ layoutKey, nodes }`: the layout
and the talent on every non-Olympian node, keyed `depth:slot` in layout order.
Choosing the spell or Aspect generates the layout's default tree, so a reached
offer always holds a complete tree. The codec checks each node on its own: every
authored node of the layout is present and holds a talent of its local domain
(its pool, drawable at its depth); the God Sent nodes are never authored.
Tree-wide policy—no repeated Rare or Epic talent, and repeatables forming the
refill-cycle draw sequence—is a finding naming its nodes, so a conflicting
tree stays representable. The `hexTree` address names the tree under its Spell
Drop offer or the route.

Edits are kind specific: a Rare or Epic node takes any talent of its pool; a
Common node swaps with a node at its depth, trades with its refill deck's
talent in another column, or, in the partial last deck, takes a talent that
deck left undealt—each keeps a legal tree legal. Changing the layout
regenerates its default tree; choosing the current layout keeps the tree.
Nothing reflows and nothing is repaired automatically: a repeat names every
node holding it, and a broken draw sequence names the nodes of the smallest
changes that restore it. The Spell Drop tree edits in its offer's draft; the
Aspect tree edits in its own draft, saved as one `ReplaceAspectHexTree` step.
The [Hex layout
audit](../audits/loadout-and-progression/HEX_TALENT_LAYOUT_GAME_DATA_AUDIT.md)
owns the native layouts and draw rules.

Each writable Path of Stars screen—a Path reward's role, or a Spell Drop that
Aspect of Selene routes to the tree—owns its invested nodes on the reward:
`hexActivationsByAcquisitionRole[role] = { selectedNodeKeys }`, a set of
`depth:slot` keys, like the Anvil result. The selection is the author's
choice: nothing fills it, and a reached screen without one is the required
input `hexActivationMissing`. The screen's count, invested set and God Sent
presence are simulation facts. A selection is kept as authored; a wrong count,
an absent, invested or unknown node, or a node no order can reach is a
`hexActivationUnavailable` finding on the role with the nodes in evidence, and
a branch the selection does not fit reports the same finding. The screen's
candidate offers additions only while the selection is under its count; a
saved selection over a count an upstream edit shrank is kept with its finding
and can only shrink.

### Option-owned results

Some selected traits own one further frozen result on their option. A
semantic command replaces it while ordinary trait selection and Undo/Redo own
the complete outer option. Dormant sibling options may retain authored detail
for later editing, but only an option that is actually acquired exports its
carrier consequence to execution.

- **All Together.** One complete result keyed by its four declaration-owned
  sets; each value is one member of its pair or `null` for an exhausted pair. No
  direct-effect bag, provider-history choice or child offer is persisted.
- **Natural Selection.** One nonempty ordered `naturalSelectionTargets` sequence
  of one to eight known trait keys: the complete successful round-robin
  allocation, not eight independent Pom choices.
- **Bridal Glow.** The exact acquisition target; its selected-effect fallback
  may retain an already-Heroic target.
- **Aspect of Persephone.** Any option may retain an optional
  `persephoneLevelBonus`. While the Aspect is active, omission resolves as
  native roll zero and positive stored values encode native roll minus one; the
  engine supplies that mapping without changing the stored field or its domain.
  Omission is not a missing-authorship finding; only explicit malformed or
  out-of-range values receive the focused repair finding. The value stays intact
  through sibling edits, Calling Card rerarity and Concave Stone residual
  selection.
- **Worry Free.** Optional `maxHealthRoll` (also on an Echo Boon Boon Boon row):
  an offset above the acquired rarity's minimum roll, from 0 through the
  catalog's roll width. Omission is offset 0, and 0 is stored as omission. The
  offset is independent of rarity, so offered-rarity edits and Calling Card
  rarification keep it; the engine realizes the acquired rarity's minimum plus
  the offset.
- **Ransom.** Nothing: no removal set or level total.

Concave Stone's chosen residual option and Echo Boon Boon Boon's selected
nested option reuse these same option-owned results. An authored Stone proc
makes the residual option's children active alongside the primary option's
children, with their original option addresses. Their candidate state follows
primary acquisition; neither editing nor querying the residual changes the
primary selection.

Concave Stone requires an active authored choice only to proc. Omitted results
mean no proc, as do explicit `noProc` results; neither consumes its pending use.
A guaranteed proc with eligible residual rows still requires a selection. An
explicit proc with no available Stone remains invalid. Simulation publishes the
resolved no-proc disposition for an available Stone without rewriting the save.

Echo's nested acquisition is repaired atomically through its `echoLastRunBoon`
choice owner. Its internal settlement offer must not escape as an
independently authored finding destination. A blocked Natural Selection child
retains the pre-offer candidate capability for both prefix editing and the
owning offer's complete-draft assessment.

Steady Growth persists only reached random targets: ordinary occurrences,
including Boss occurrences, use a sparse `steadyGrowthTargetByPhase` map. A
missing target is unresolved only at a reached nonempty threshold; an empty
target domain is a derived no-op. The semantic `ReplaceSteadyGrowthTarget`
command owns one exact phase/contact and preserves retained invalid known keys
for repair. Progress and threshold settlement are derived from trait history.

### Encounter-owned offers

An Encounter Definition may declare one `traitOfferProducer`. The owning room
occurrence then persists its complete offer outcome sparsely at
`encounters.traitOffersByPhase[phaseKey][encounterKey]`, keyed by the native
definition rather than its authoring choice. Selecting that encounter installs
its declaration-owned default when no retained offer exists; selecting another
definition makes the prior offer dormant, and reselecting it restores the
retained value. Only the selected, active, entered definition publishes,
validates or acquires its offer, and it settles at its declared phase contact.

The exact encounter phase owns the offer's `TraitOfferAddress` with child role
`selection`. An option may retain an exact `targetTraitKey` only when its trait
declares a targeted acquisition. Dormant and unselected options may remain
incomplete or context-invalid; the selected targeted option must resolve to an
eligible equipped target before the offer can fold. Provider authorship stays
catalog-owned: ranked Artemis/Athena are not rarityless Icarus or Hammer
choices.

## Assessment and settlement

At the declared lifecycle point, the reward kernel applies the exact loot/use
projection. Each retained branch assesses the offer against its
[generation-time context](#generation-time-context) and settles the selection
against its current state. Validation separates three products:

| Product                      | Question                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Individual option assessment | Does this identity and concrete rarity satisfy its declaration, generation-time requirements and exact replacement rules? |
| Complete-screen generation   | Can these distinct alternatives coexist as an initial screen through the provider's construction stages?                  |
| Selected acquisition         | Are the selected child results complete and legal, and what history transitions follow?                                   |

An invalid reached offer keeps its trace, semantic owner and repair capability;
it does not fold the selected trait. A valid offer folds only its selection and
any explicitly selected carrier effects. Valid Gold records the reached offer
but no trait acquisition. Devotion's chosen offer precedes combat and the
spurned offer observes the resulting state afterward. Shop acquisitions settle
at their authored timeline positions.

Picker candidates use individual assessment. A row may be selectable while
the current complete screen has a generation finding. This is intentional:
the user can repair siblings and cardinality without a circular lock.

### Generation-time context

A trait offer is evaluated against the state at the position where the game
builds its options, not the state when it is opened:

| Offer                                                                                  | Options built at                                                                                                                               |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary incoming reward, incl. Devotion's spurned reward                              | The producing phase's `encounterCompleted`, or the producer point when no encounter precedes it (Opening, Devotion's chosen pair, story rooms) |
| Incoming reward of an encounter declared to create it before combat (the H minibosses) | That encounter's `encounterStarted`, before its start effects                                                                                  |
| Ship-wheel reward                                                                      | Its own phase's `encounterCompleted`                                                                                                           |
| Fields cage and optional rewards; World Shop items                                     | The room's `offerPointMaterialized`                                                                                                            |
| Hermes Shrine delivery                                                                 | Falling due: at encounter end before chamber-count effects, or at room entry                                                                   |
| Echo last reward; Sea Star duplicate                                                   | Its source screen's completion                                                                                                                 |
| Echo Gold duplicate                                                                    | Gold's materialization, before the source screen                                                                                               |
| Nemesis trade result; Artificer replacement; Travel Deal refill                        | The trade, the conversion, or the triggering purchase                                                                                          |
| `afterUnwrap` roles (Mystery Box), field NPC and Story screens                         | Open time                                                                                                                                      |

Three classes of event touch an unopened offer, each a property of the
transition that owns the native contact:

- **Rebuild.** A completed upgrade screen—boon, Hermes, Hammer, Pom, Chaos
  pair, NPC screen or Fallback Gold, but not a Spell Drop—publishes one
  screen-completed product after its selection, nested children (Concave
  Stone residual, acquisition effects, derived level mutations) and charge
  consumption (Ordinary, Hymn, Yarn). It re-anchors every unopened offer in
  the room to the resulting state and clears stale marks. Completion follows
  legality; a missing, invalid or blocked screen publishes none.
- **Invalidate.** A Steady Growth interval, a Transcendent Embryo interval, a
  firing fountain-rarity keepsake and a Nemesis trade sale mark every unopened
  offer in the room stale, whether or not a trait changed. A stale offer's
  context is the state at the next rebuild in the room or at its open,
  whichever comes first.
- **Silent.** Everything else: curse maturation, essences and element grants,
  consumables, level changes outside a screen, direct grants, rarity blocks,
  trait removal (Anvil, Purging Pool sale, Echo double-shop consumption,
  Experimental Hammer expiry, Jeweled Pom cleanup), Chaos clocks and Death
  Defiance uses.

The generation-time context supplies identity eligibility, base rarity from
held rarity sources, replacement support and whether Hymn seeded a swap. The
current state supplies Rejected, Denial, Calling Card, level and keepsake
calculations, targeted acquisition, charge consumption and the history
append, so events between generation and open are never discarded. Offer
contexts are replaceable simulation state, never persisted authored data;
opening an offer or leaving its room discards its record.

Recreated and duplicated loot follows the same rule: a Gold duplicate exists
before its source screen opens and is rebuilt when that screen completes, and
Reward Reward Reward's loot is created at the Echo screen's completion. A
Mystery Boon's hidden source does not exist until unwrap and uses that state.
No open-time Pom target check is modeled; the native `StackOnly` regeneration
has no reachable trigger once duplicates re-anchor at their source screen. A
delivered Shrine boon is built in its host room and takes that room's declared
boon rarity override, whether it fell due there or was rushed. The
[composition
audit](../audits/traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md#generation-position-and-option-rebuild)
owns the native contacts.

### Ordinary initial-screen support

Olympian/Hermes generation consumes the exact source-rarity context and an
unchanged generation-time history. Its staged possibility model covers
replacement or core seeding, optional linked-priority insertion, seed rarity,
finite ordinary bucket draws, replacement vacancy rescue and—only when
effective Denial is off—final rarity rescue. Empty terminal output means Gold.
Short screens must also be terminally reachable; no ordinary/high-tier count
quota stands in for construction.

A selected identity is removed from every generation bucket, but is never
equipped while assembling alternatives. Provider-eligible priority state
decides core seeding, not a persisted first-offer flag or a generic occupied
slot count. Present-zero and absent rarity chances remain distinct for rescue.
The [construction
audit](../audits/traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md)
owns the full source sequence and Trial inheritance exception matrix.

A room's `firstRunOffer` rule is source policy for trait screens opened in that
room on its route: identities outside its forced loot table fail row
eligibility (`offerContext`), and its Common rarity is the source's forced
rarity, so no rarity facts cross the screen. It reproduces native
`ForceLootTableFirstRun`/`ForceCommonLootFirstRun` for the first Apollo offer
on `FreshFile`; mature routes never carry it.

Replacement carries exact old identity, slot, promoted rarity and transferred
level; it waives occupied-slot failure, not other eligibility. Its explicit
rarity is not retested as a fresh roll. Hymn can seed despite Ordinary and
credits every replacement alternative when used. Complete-screen support and
selected effects must succeed within the same history branch; evidence is
never assembled from incompatible branches.

Echo replay, Chaos pairs, NPCs, Hammers and Spells retain their separate
provider algorithms.

### Fear and reward settlement

After a valid participating Olympian or Hermes trait selection, effective Vow
of Denial records up to two exact unselected materialized keys on that same
trait event. The folded banned set is route-wide eligibility history;
suppressing Denial stops new bans but never removes existing ones.

Effective Vow of Forfeit is narrower: for qualifying RoomReward sources it
substitutes the first supported incoming `Boon` or `HermesUpgrade` in each
biome with a required `RoomRewardConsolationPrize` (Red Onion). The authored
offer and bag result remain, while a `rewardForfeited` event records the fixed
replacement and the canonical concrete acquisition settles the Onion. This
also covers a picked Thessaly Ship-wheel reward, a Fields cage reward, and an
Artificer-generated RoomReward Boon/Hermes replacement; it does not inspect the
resolved giver.

Fields fixes this outcome on selected room entry in active cage-list order,
independently of later cage activation and pickup order; the entry-fixed
realization is published for the cage's acquisition roles from that entry.
Between choosing a Ship wheel offer and collecting its reward after that
wheel's combat, no other Forfeit-eligible RoomReward spawn can occur in the
room: Artificer outputs cannot intercede there, and NPC interactions never touch
the RoomReward spawn path. A picked `Boon` or `HermesUpgrade` wheel offer whose
biome use is unconsumed on every branch at the pick therefore has its Red Onion
realization published from the pick, while consumption and the
`rewardForfeited` event stay at pickup settlement, so event order is
unchanged. Entry- and pick-fixed realizations are retained when a later
contact in the same room blocks, including a block that withholds the room's
lifecycle. Unentered offered rooms do not consume the use. Pickup settles the
fixed replacement without spending Forfeit again.

Other required rewards, such as miniboss rewards, retain acquisition-time
settlement where it yields the same modeled outcome. Native spawn timing alone
does not require a separate simulation phase; earlier consumption is needed
when coexisting rewards make pickup order observably different. Shops,
Devotion, and other acquisitions outside the qualifying native RoomReward spawn
path do not trigger or consume Forfeit. The Red Onion keeps its normal pickup,
Time Piece, and Sea Star contacts, but cannot start a trait offer, Artificer
conversion, or Echo last-reward recreation. The Arcana/Fear ledger retains only
the per-biome consumed flag needed by later settlement and Run State.

## Equipped state and acquired effects

Trait history owns slot occupancy, elements, boon-rarity counts, levels and
upgrade target predicates. Ordinary god loot resolves its trait-bearing role
through this ledger: the concrete selected trait, rather than the loot source
name, determines slot, element, rarity and upgradeability facts. Upgradable
count, Steady Growth eligibility and Bridal Glow offer eligibility are distinct
queries, not one generic counter. Their core-god classification differs from
broader shop-aware rarity counting.

Source-rarity resolution precedes ledger construction and limited-bonus
consumption. Forced Common suppresses ignored contributions instead of
coexisting with a guaranteed-Rare ledger. Specialized NPC/Gorgon and Chaos
contacts use the same applicable source facts, with their declared orders and
direct-grant distinctions.
[The rarity audit](../audits/traits/BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md)
owns exact contributions, overrides and exclusions.

Proper's activation, reactivation and active-source recheck at Ordinary expiry
are history transitions. They mutate equipped state without rewriting authored
offer rarity. Deactivation removes the future-screen bonus, not completed
promotions.

Targeted acquisitions are a closed set. Bridal's offer availability requires
a preferred superchargeable target; after acquisition its target domain may
widen only when that preferred pool is empty. A missing or stale chosen target
does not activate fallback. Stone's residual sees state after the primary
acquisition. Bridal remembers its recipient so any later source-rarity
increase credits only the positive change in its level grant; removing Bridal
does not undo prior benefits. Latest Model instead upgrades a source-capable
permanent Hammer to Rank II using an ordered, distinct target list whose
required size is capped by the acquisition-ordinal count and eligible pool.
Its candidate and settlement consumers share that frozen target domain.
These contracts do not create a generic effect interpreter or a second
acquisition ledger.

A retained trait may also carry a derived in-run rarity block. Personal Loan's
non-final boss payout sets that block without removing its identity, element,
rarity or Common-count contribution. A fresh acquisition does not inherit an
earlier instance's block. Level eligibility and fresh-offer rarity are not
aliases of in-run rarifiability. The payout's lifecycle contact is recorded in
the [scheduled-outcomes
audit](../audits/rooms-and-routes/SCHEDULED_AND_AUTOMATIC_TIMELINE_OUTCOMES_AUDIT.md#encounter-end-and-boss-contacts);
[effect
evidence](../audits/traits/RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md)
owns Bridal's non-Pom-level omission and Loan's exact native contacts.

`pendingSpellDrop` is a derived reservation from a non-rushed purchased Shrine
offer. It blocks later Spell Drop generation until concrete acquisition makes
it redundant; it is not inferred from the equipped Spell slot. Inventory,
delivery and required pickup use the ordinary acquisition authorities.

The editor renders these products and dispatches semantic commands. It does
not recompute rarity arithmetic, reward legality or acquired effects.
