# Echo Trait Implementation Plan

## Status

**Locked and in execution.** This plan has been
regrounded against clean commit `25e25e2`, authored schema 30, and the completed
supported-keepsake and Cherished Heirloom phase. It supersedes the earlier
schema-20 seven-choice draft.

The source authorities are:

- `TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md` for Echo's menu, direct choices, and
  prior-run approximation;
- `ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md` for replay and Shop settlement;
- `REWARD_GAME_DATA_AUDIT.md` for exact replayable reward sources; and
- `ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md` for captured keepsake identity and
  biome-start replay; and
- `KEEPSAKE_GAME_DATA_AUDIT.md` for the general Experimental Hammer equip and
  exhausted-result contract.

Do not link this temporary plan from stable design or audit documents while it
is active. Lock and commit the audit/plan before implementation. At final
closure, absorb only durable contracts and delete this file.

## Objective

Publish Echo as a complete player-rarityless Story provider with the game's eight
menu identities:

1. Reward Reward Reward;
2. Boon Boon Boon;
3. Survive Survive Survive;
4. Pom Pom Pom;
5. Evade Evade Evade;
6. Fight Fight Fight;
7. Gold Gold Gold; and
8. Gift Gift Gift.

The planner models exact supported state changes while keeping the established
collapsed boundaries for previous-run history, Death Defiance counts, combat
statistics, and the 27 keepsakes whose individual effects remain deferred.

The implementation extends the current trait, acquisition-settlement,
keepsake, candidate, workspace, and Run State authorities. It must not add a
generic trait-effect interpreter, keepsake callback registry, prior-run
simulator, Shop-private chronology, parallel pending booleans, or React-owned
policy.

## Current baseline and corrections to the old plan

The current code already supplies several contacts the old plan expected to
create:

- `Story_Echo_01` and `H_Bridge01` exist, but the encounter has no trait-offer
  producer and Echo has no trait declarations or giver;
- field-NPC and Story offers already use exact encounter-phase owners,
  schema-30 strict codecs, semantic commands, candidate artifacts, workspace
  controls, and finding destinations;
- trait history already owns an exact acquisition-identity removal event, so
  Gold Gold Gold can consume its equipped one-use trait without introducing a
  second removal vocabulary;
- ordered Shop settlement and producer-owned pickup entries already exist, but
  a Shop site currently rejects supplemental pickup detail;
- reward history does not yet retain an exact latest replayable source;
- branch-owned keepsake state now owns all 33 identities, exact current and
  removed history, the six supported effect ledgers, fixed rank-III ordinary
  equips, rank-I through rank-IV declarations, and Cherished rank-IV behavior;
  and
- biome-start reward initialization already has one keepsake transition hook,
  currently used only to reset Fig Leaf's biome guard.

Gift Gift Gift is therefore no longer blocked on keepsake identity. The old
exclusion is retired. Its captured identity still cannot be inferred later
from `currentKey` or `removedKeys`: the Echo acquisition must snapshot the
current keepsake into the equipped Echo trait's own chronological state.

The reassessment also exposes two required Experimental Hammer corrections.
Every equip attempts to select one compatible Hammer, but an exhausted domain
is a legal consumed no-result rather than an incomplete child. Separately, a
rank-I Echo Hammer may be granted while the original temporary Hammer is still
active. The game excludes already-equipped Hammer keys and permits a second
distinct Hammer, with each instance carrying its own remaining-use lifetime.
The current singular `experimentalHammer` ledger cannot represent that legal
overlap. Gift delivery must generalize the shared equip result to a selected
Hammer or explicit exhausted result and replace the ledger with an exact
collection of temporary Hammer instances.

## Locked planner interpretations

### Echo's outer Story offer

Echo uses the existing encounter-local trait-offer owner on
`Story_Echo_01`. The authored outer offer remains three distinct selected menu
rows from Echo's declaration-owned pool, not eight simultaneous controls.
Context-invalid retained rows remain visible and repairable.

Each menu declaration owns a closed selected disposition. Secondary authored
detail belongs only to the selected effect's exact child owner. Switching the
outer selection makes unrelated detail dormant without deleting it; switching
back restores it. React renders supported children supplied by the workspace
and never switches on Echo trait keys.

Every legally selected outer Echo identity first enters ordinary trait history
without authored rarity, including the source-hidden Reward, Boon, Survive,
and Pom identities. In an ordinary run the source assigns Echo internal Epic
scaling; Dream Dive replaces it with an entered-biome-indexed tier, and
`ForceCommonAppearanceTrait` hides the rarity name. Those numeric scaling rows
and Dream Dive are outside scope, and Echo is excluded from the modeled
god-boon rarity mutations. The planner therefore omits the internal tier rather
than misrepresenting it as Common. The selected declaration's closed effect settles after that
outer acquisition. Boon therefore leaves both its outer Echo identity and its
selected nested trait; Gold later removes only its own exact outer acquisition
when its use is consumed. A missing or context-invalid active child does not
erase a structurally reached outer acquisition.

The provider grows only when a gate lands the complete vertical slice for its
new choice. Earlier gates must not publish later Echo rows as selectable no-op
placeholders. Gate E completes the final eight-choice pool. Survive, Evade,
Fight, and Pom land together so the partial provider always has three
unconditional legal identities and never needs temporary two-option Story
offer machinery.

### Direct choices

- Evade and Fight retain their rarityless outer Echo identities. Their
  numeric bonuses and decay remain outside the planner.
- Survive retains its rarityless outer identity and reuses the existing
  source-local `deathDefianceConditionMet` fact. Death Defiance restoration
  count and healing remain collapsed.
- Pom evaluates the exact pre-choice trait frontier, restricts targets to
  Pom-eligible equipped traits tied at the greatest current level, and adds the
  target's current level to itself. No eligible target is a legal no-op, not an
  ineligible outer Echo choice and not a missing-target finding. Its outer
  rarityless identity remains in trait history even when the effect is a
  no-op.

### Boon Boon Boon

The game reads an unmodeled previous-run trait-and-rarity cache. The planner
continues to use the audited explicit approximation:

- author one to three `{giver, trait, rarity}` source-resolved outcome rows,
  with distinctness enforced by trait identity rather than by the composite
  row; a row carries only declaration-owned selected-acquisition detail, which
  currently means an optional exact target for Bridal Glow;
- draw them from the closed declaration-owned Echo-last-run provider domain:
  the nine ordinary Olympians, Hermes, Artemis, Athena, and Dionysus, with
  Hades and every other provider excluded;
- assess every authored row against the exact pre-Echo trait state, including
  the outer offer's Death-Defiance condition, and settle no nested result when
  any selected or unselected row is invalid;
- exclude currently equipped traits, occupied ordinary slots, explicit trait
  exclusions, and source-excluded providers;
- validate the authored rarity against the trait's exact equipped-rarity
  domain, including Heroic, Legendary, and Duo, then apply the current scalable
  floor only to Common results;
- do not apply first-Olympian composition, replacement composition, or
  Calling Card actions, and do not create Vow of Denial bans for unselected
  previous-run rows; and
- directly equip the selected row through ordinary trait history while also
  recording its resolved loot source in the existing reward-history
  `lootTypeHistory` when the source game does so. The direct acquisition reuses
  the selected declaration's existing acquisition behavior: Bridal Glow
  promotes its authored eligible target, while Cherished Heirloom advances the
  current keepsake without a new Echo-specific effect path.

This is a closed mixed-provider child, not an `AuthoredTraitOffer` with Echo as
a fictional giver. The absent previous-run Shrine fact stays collapsed; the
authored approximation does not claim those rows actually appeared in a prior
run.

The provider-bearing row represents the source outcome, not an extra ordinary
offer decision. A trait present in exactly one participating giver contributes
one variant. A Duo trait present in two participating giver inventories
contributes two variants, one per giver, because source `GetLootSourceName`
returns the first match of an unordered `pairs(LootData)` traversal. An authored
offer may contain only one row for a given trait, so the two variants can never
make the same Duo appear twice among the three displayed options. Selecting one
variant increments exactly that giver's history and equips one copy of the
trait; it never increments both partners.

The outer Boon row is available only when the pre-Echo candidate product has at
least one legal nested result. A retained authored row may become invalid after
earlier route edits without being deleted.

The current ordinary god pool is not an input restriction on the authored
Echo-last-run domain. A selected ordinary-Olympian row whose provider was not
previously acquired adds that provider to loot history before the trait is
equipped. That provider therefore joins the acquired and future cap-narrowed
ordinary pool, including when Echo expands an already capped pool. An already
present provider changes only its history count. Hermes and the eligible
field/Story providers retain their source-specific history behavior and never
become ordinary-pool members merely because Boon Boon Boon selected one of
their traits. Invalid or unselected rows produce no history mutation.

### Reward Reward Reward

Canonical acquisition history retains the latest concrete acquisition whose
normalized source opts into effective `LastRewardEligible`. The replay value
is the exact concrete source descriptor, not the last generic reward event or
a Boon/Pom/consumable alias.

Selecting Reward creates one mandatory Echo-room acquisition at the declared
post-interaction, pre-outgoing settlement point:

- a consumable recreates that exact consumable;
- a loot source recreates that source and owns a fresh trait offer; and
- Echo-replayed consumables use the run-progress path, including Nectar's
  random `+1` Pom effect.

The replay identity is derived from pre-Echo history. Persist only the
acquisition-time decisions needed by the reached recreated entry. A stale or
missing child remains addressable and invalid; simulation revalidates it
against the canonical replay descriptor. Current-room exits are never
regenerated after replay settlement.

Only an acquisition that actually settles updates the replay descriptor. A
nonparticipating pickup, rejected purchase, or Time Piece gold conversion must
not become a false replayable source. Blind Box history distinguishes the box
pickup from the concrete god source resolved at interaction.

### Gold Gold Gold

Selecting Gold equips rarityless `EchoDoubleShop` with one use. That exact
equipped trait is the only pending representation.

World Shop settlement examines purchased entries in authored order. At the
first purchased non-`SpellDrop` entry while the trait remains equipped:

1. settle the original paid purchase;
2. publish one mandatory free duplicate immediately after it at the same
   acquisition site;
3. settle the duplicate through the ordinary concrete-acquisition path; and
4. remove the exact `EchoDoubleShop` acquisition through trait history.

`SpellDrop` neither triggers nor consumes the use. With no eligible purchase,
the trait persists to later World Shops. Wells and future Hermes Shrines are
not consumers.

The duplicate is a separate free acquisition. It owns fresh loot/level detail
and participates in other acquisition policy at that exact frontier,
including Time Piece eligibility. It is not inserted into the authored Shop
purchase order and cannot be independently purchased, abandoned, or moved.

### Gift Gift Gift

Gift is offered according to the source's current-keepsake exclusions. The
progression predicate is collapsed by the progressed baseline. A successful
selection snapshots the current keepsake key into the equipped
`EchoRepeatKeepsakeBoon`; later rack changes do not retarget it.

The planner keeps the two audited declaration axes separate:

1. the exact effect attempted at biome start; and
2. whether replay is one-shot or reconsidered every biome.

For the six currently supported keepsake effects:

| Captured keepsake   | Gift disposition                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gorgon Amulet       | source-excluded; Gift is unavailable                                                                                                                                                                                                                         |
| Fig Leaf            | on the first succeeding-biome start, set remaining uses to `max(existing, 1)` and record that the one-shot planner replay occurred even when the count was already positive                                                                                  |
| Experimental Hammer | at the first succeeding-biome start after the captured keepsake is no longer current, settle the shared rank-I equip result: add one authored compatible Hammer with 10 uses, or consume the attempt as an explicit no-result when the exact domain is empty |
| Jeweled Pom         | source-excluded; Gift is unavailable                                                                                                                                                                                                                         |
| Calling Card        | add the rank-I value of two charges at every later biome start                                                                                                                                                                                               |
| Time Piece          | add the rank-I value of two charges at every later biome start                                                                                                                                                                                               |

The other 27 keepsakes remain system-active but effect-neutral under this
slice. The source-excluded Discordant Bell and Aromatic Phial also make Gift
unavailable. Any other eligible identity may be captured and shown in trait
history and Run State, but its biome-start transition is a deliberate no-op
until that keepsake receives its own inherent, Cherished, and Gift effect
slice. This narrow socket does not normalize speculative effect descriptors
for those keepsakes.

Fig Leaf's duplicate source traits remain collapsed to the deterministic
future-skip count above. Calling Card and Time Piece reuse their existing
retained ledgers. Experimental Hammer is the only supported Gift result with
an authored future child: that child belongs to the exact reached biome-start
replay address, not the historical Echo room or a later rack. It reuses the
general Experimental Hammer result vocabulary: a selected compatible key when
the domain is nonempty or an explicit exhausted result when it is empty.

The Fig Leaf rule is an explicit planner simplification of source trait
presence: the planner does not persist a second unslotted Fig Leaf trait. Its
one-shot marker makes the collapsed `max(existing, 1)` transition exactly once.
Experimental Hammer retains the source presence distinction because the
current keepsake identity is already modeled and determines whether the
unslotted replay can occur.

## Ownership and product contract

### Catalog

The Hades II catalog owns:

- Echo's eight declarations, labels, rarityless domain, pool membership,
  requirements, and closed selected dispositions;
- exact Echo-last-run provider/trait outcome variants, trait-key distinctness,
  exclusions, rarity domains, and resolved loot-history source;
- effective last-reward replayability and concrete recreation descriptors;
- Echo's replay settlement point and Shop duplication trigger;
- Gift's four source exclusions, rank-I supported values, replay schedule, and
  effect-neutral boundary for the remaining identities; and
- the distinction between ordinary temporary-Hammer rank profiles and Echo's
  forced rank-I replay, plus the shared legal exhausted-result contract.

Normalization rejects unknown sources, mixed-provider members outside the
closed domain, invalid recreation mappings, unsupported settlement points,
and incomplete Gift schedule/effect pairs. It does not add a generic callback
or effect language.

### Authored project

Persist only authored decisions and explicit possibility resolutions:

- the ordinary outer Echo offer;
- Pom's selected target or explicit no-target result;
- the one-to-three mixed-provider Boon child;
- acquisition-time children for the reached Reward replay;
- acquisition-time children for a reached Gold duplicate; and
- the selected Hammer key or explicit exhausted result for every reached
  Experimental Hammer equip, including Gift's future replay.

The captured Gift keepsake, latest replayable reward, pending Gold use, Gift
replay schedule, and temporary-Hammer counters are derived chronological
state, not authored flags. Every child has an exact semantic address and strict
codec applicability. Schema versions before the first Echo schema are
rejected; no compatibility decoder is added.

The rarity correction itself did not advance schema 31. Trait-option rarity was
already optional for the normalized `none` domain, and catalog legality closes
whether a concrete option may carry it. Gate B advances authored persistence to
schema 32 for the mixed-provider child. Older documents that attach rarity to a
now-rarityless NPC option remain rejected by the strict codec rather than
migrated through a compatibility shim.

### Simulation and history

Trait history remains the authority for all eight rarityless outer Echo
acquisitions, Boon direct equip, Gold consumption, and Gift's immutable captured
identity and one-shot replay marker.
Reward history owns the latest exact replayable acquisition. Keepsake state
owns the supported replayed effect ledgers. The existing biome-start boundary
applies Gift once per branch before any new-biome encounter or acquisition.

Boon direct settlement also advances the existing reward-history loot-source
record before equipping the selected trait. Ordinary god-pool and Run State
products consume that same record; Echo does not own a second provider set or
an exception to the reward kernel.

Temporary Experimental Hammers become an acquisition-identity-keyed
collection. Every qualifying completion decrements every active temporary
Hammer instance, and expiry removes only that instance's exact Hammer trait.
Ordinary single-Hammer routes retain their current observable result.

Equivalent-branch attestation includes replay descriptors, Echo trait payload,
consumption/removal events, Gift replay markers, and the complete temporary-
Hammer collection. Candidate evaluation consumes the same frozen frontiers as
selected simulation and never replays Echo, a Shop, or a biome-start fold to
rediscover support.

### Application and React

The workspace adapts engine-owned support into:

- the ordinary Echo outer offer;
- the active Pom target child;
- the active mixed-provider Boon editor;
- the reached Reward replay acquisition;
- the reached Gold supplemental duplicate; and
- the reached Gift Hammer biome-start result.

Run State exposes equipped Echo identities, Gold's pending/consumed state,
Gift's captured keepsake and replay status, and all active/expired temporary
Hammer instances. Findings navigate to the exact outer row, active child,
recreated acquisition, Shop duplicate, or biome-start replay owner. React owns
labels and layout only.

## Delivery gates

### Gate A — Echo provider, simple choices, and Pom Pom Pom

1. Add the rarityless Echo giver and the Survive, Evade, Fight, and Pom
   declarations as one partial-provider slice.
2. Bind `Story_Echo_01` to the giver and NPC presentation.
3. Record every selected outer identity in rarityless trait history before
   settling its effect; keep Evade/Fight numeric behavior and Survive's DD
   restoration count collapsed.
4. Evaluate Pom's exact pre-choice Pom-eligible frontier and publish only
   targets tied at the greatest current level.
5. Add strict selected-target or explicit no-target authored state, semantic
   commands, candidates, findings, focused projection, and Run State contact.
6. Prove three-option availability with and without Survive, omitted rarity, all
   four outer acquisitions, DD condition retention, greatest-level ties, exact
   doubling, legal no-target persistence, context-invalid repair, and
   undo/redo.

Default commit:

```text
feat(planner): model Echo direct choices
```

### Gate B — Boon Boon Boon

1. Add the Echo last-run declaration and exact mixed-provider participation
   matrix: nine ordinary Olympians, Hermes, Artemis, Athena, and Dionysus,
   with Hades and all other providers excluded.
2. Add the strict one-to-three `{giver, trait, rarity}` source-resolved child,
   plus only declaration-owned selected-acquisition detail (currently Bridal
   Glow's target), reject repeated trait keys across giver variants, and add
   semantic commands.
3. Publish engine-owned pre-Echo candidate domains, including row-distinct
   replacement and append eligibility, and assess direct acquisition without
   ordinary offer-composition policy.
4. Project the focused mixed-provider editor and exact findings.
5. Prove cross-provider rows, cardinality, trait-key duplicate rejection, the
   full Common/Rare/Epic/Heroic/Legendary/Duo equipped-rarity domain,
   Common-to-Rare floor behavior, empty-domain outer unavailability,
   slot/equipped/provider exclusions, Athena Death-Defiance context behavior,
   Bridal Glow missing/valid target behavior, Cherished Heirloom contact,
   engine-owned row-distinct candidate domains, selected and unselected
   context-invalid retention, outer-plus-nested persistence, and undo/redo.
6. Prove selected-source chronology: an absent ordinary provider is added to
   loot history and the future god pool, an already-present provider changes
   no set membership, an at-cap selection expands the acquired/effective pool,
   non-ordinary participants do not enter the ordinary pool, each Duo variant
   adds exactly its selected partner and never both, and invalid or unselected
   rows do not mutate history.

Default commit:

```text
feat(planner): model Echo last-run boon
```

### Gate C — Reward Reward Reward

1. Normalize effective replayability and exact concrete recreation descriptors.
2. Fold the latest eligible descriptor through canonical acquisition history.
3. Add Echo's mandatory pre-outgoing replay settlement entry and strict child
   authoring.
4. Reuse ordinary trait, level, conversion, and acquisition settlement for the
   recreated item.
5. Prove consumable and loot replay, fresh offers, replayed Nectar, latest-
   eligible precedence, Blind Box box-versus-resolved-source identity,
   nonparticipating and gold-converted exclusions, no-prior-reward
   unavailability, branch divergence, retained-invalid repair, persistence,
   and undo/redo.

Default commit:

```text
feat(engine): model Echo last-reward replay
```

### Gate D — Gold Gold Gold

1. Add and equip the rarityless one-use Gold trait.
2. Extend one reached Shop site with one derived supplemental acquisition
   immediately after its triggering paid entry.
3. Reuse exact trait-history removal and ordinary acquisition child products.
4. Project the duplicate without adding it to the purchase order.
5. Prove `SpellDrop` skip, no-purchase persistence, later-Shop triggering,
   sequential purchases, fresh loot offers, consumables, Time Piece contact,
   exact-once consumption, and no Well contact.

Default commit:

```text
feat(engine): model Echo World Shop duplication
```

### Gate E — Gift Gift Gift

1. Add Gift's source exclusions and current-keepsake eligibility.
2. Snapshot the exact acquisition-time keepsake into the equipped Echo trait.
3. Extend the biome-start fold with declaration-owned one-shot/every-biome
   replay and exact replay status.
4. Implement Fig Leaf, Calling Card, and Time Piece through their existing
   ledgers; preserve effect-neutral capture for the remaining eligible keys.
5. Generalize every Experimental Hammer equip to a selected compatible result
   or a legal explicit exhausted result; replace the singular temporary-Hammer
   ledger with an exact instance collection and reuse that result at Gift's
   biome-start rank-I child.
6. Project captured identity, replay status, Hammer choices, findings, and Run
   State without a generic keepsake effect switch in React.
7. Prove all four source exclusions, capture-before-swap, later swaps not
   retargeting, Fig Leaf positive/zero one-shot behavior, Card/Time every-biome
   addition, neutral capture, no-successor behavior, ordinary/rack/Gift
   exhausted Hammer attempts, overlapping Hammer instances, independent expiry,
   branch attestation, persistence, and undo/redo.

Default commit:

```text
feat(engine): model Echo keepsake replay
```

### Gate F — Product closure and absorption

1. Run the single complete repository gate after all narrow lanes and review
   remediations are stable.
2. Verify every active Echo child and generated acquisition has exactly one
   containing inspector, interaction, and finding destination.
3. Audit against all five source documents and the complete eight-choice menu.
4. Search for provider-name switches, parallel pending state, generic effect
   registries, Shop-private order, duplicate trait/acquisition folds, and
   singular temporary-Hammer assumptions.
5. Retain one primary policy matrix per authority and representative product
   witnesses elsewhere.
6. Absorb durable contracts into the smallest owning design/audit/progress
   documents and delete this plan.

Default commit:

```text
docs: absorb Echo trait delivery
```

## Explicitly deferred

- an actual previous-run trait cache or Shrine-history input;
- Echo numeric healing, dodge, Life, Magick, and decay effects;
- inherent, Cherished, and Gift effects for the other 27 keepsakes;
- probability distributions or random-selection simulation;
- Well or Hermes Shrine duplication;
- arbitrary trait charges, duration, combat consumption, or callbacks; and
- arbitrary dynamic acquisition insertion rules.

## Final acceptance audits

- The reached Echo menu draws three distinct rows from exactly eight
  rarityless identities, subject only to their supported source conditions.
- Every selected outer Echo identity enters rarityless trait history before
  its effect settles; Boon additionally equips its selected nested trait and
  presentation-only source hiding does not suppress Run State truth.
- Pom doubles one exact greatest-level target and is a legal no-op with none.
- Boon rows preserve resolved giver identity, reject the same trait across Duo
  variants, increment exactly one selected history source, and accept only the
  selected trait's exact equipped-rarity domain.
- Reward replays the exact latest eligible concrete source and never a generic
  alias.
- Gold has one pending representation, creates one immediate free duplicate,
  and consumes only at the first eligible World Shop purchase.
- Gift captures the keepsake held at Echo acquisition, never a later outgoing
  or incoming rack identity.
- Gift's supported rank-I effects and replay schedules match the focused audit;
  excluded keys are unavailable and remaining keys stay effect-neutral.
- Overlapping temporary Hammers retain independent identity, use counts, trait
  removal, and Run State presentation; an empty compatible domain is a legal
  consumed no-result for every Experimental Hammer equip path.
- Inactive or dormant secondary children emit no active finding or run-state
  effect but remain repairable when structurally valid.
- Current-room exits are never regenerated by Echo replay or Shop duplication.
- React contains no Echo legality, replay, duplication, keepsake-key, or
  temporary-Hammer lifecycle policy.
