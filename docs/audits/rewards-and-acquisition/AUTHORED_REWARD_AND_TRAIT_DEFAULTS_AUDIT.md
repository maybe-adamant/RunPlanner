# Authored Reward and Trait Defaults Audit

## Status

Implementation-free audit completed against the installed Hades II scripts and
authored schema 41 on 2026-08-16. It records the source/model discrepancy and
the intended planner disposition. It does not prescribe a persisted shape,
module layout, migration sequence, React layout, or delivery gates; those
belong in a separately reviewed implementation plan.

This audit answers one question: when the game will eventually generate a
concrete reward or trait offer but the planner user has not authored that
outcome yet, should the planner install a concrete default?

The answer is no. A source-fixed fact may be derived without authoring, but a
player-authored outcome begins unresolved. A previously authored outcome that
later becomes invalid remains selected and repairable.

## Sources

### Game execution

- `RewardLogic.lua`: `ChooseRoomReward` builds the eligible entries from the
  current run-local store, refills when necessary, honors priority, and chooses
  one eligible entry. There is no Apollo, first-store-member, or other static
  authoring default.
- `RoomLogic.lua`: `DoUnlockRoomExits` resolves each generated door's store and
  calls `ChooseRoomReward`; Fields cages repeat the same concrete generation
  against the shared peer set.
- `StoreLogic.lua`: `FillInShopOptions` filters eligible traits and consumables,
  resolves god offers, and samples the declared groups. A profile's first
  declaration member is not a fixed generated inventory.
- `TraitLogic.lua`: `SetTraitsOnLoot` derives priority, replacement, high-tier,
  rarity, eligibility, and exclusion domains from the current run, then fills
  the concrete option list.
- `UpgradeChoiceLogic.lua`: `CreateBoonLootButtons`, `GetPriorityTraits`, and
  `GetReplacementTraits` consume or regenerate that concrete list. The
  supported offer may contain one to three traits or the whole-offer fallback,
  as recorded in
  [`../traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md`](../traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md).

The planner models supported outcomes rather than replaying RNG. It therefore
needs the user to author the concrete result, but RNG existence does not make
one arbitrary supported result a source fact.

### Current planner contracts

The current production model deliberately requires complete values:

- `AuthoredRewardState` always contains a complete resolved offer plus every
  acquisition disposition and applicable trait/Pom child;
- `AUTHORED_PROJECT_MODEL.md` says every occurrence begins with complete
  declaration defaults;
- `REWARD_MODEL.md` says every active counted choice and payload is complete;
- `EDITOR_MODEL.md` says parent selection installs complete child defaults and
  never commits an intermediate empty reward;
- non-Hammer trait givers must declare one complete three-option
  `defaultOffer`; Hammer givers must declare one for every weapon/aspect
  loadout; and
- room, replacement, Shop, local-reward, encounter, derived-Shop, Echo replay,
  and Artificer construction all consume those defaults.

These statements accurately describe schema 41. They are not source-backed
reasons to retain the behavior in the next schema.

## Current Default Inventory

| Default family                       | Current example                                                                                              | Source status                                              | Audit disposition                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Reward payload                       | `Boon`, `RandomLoot`, and `BlindBoxLoot` begin with Apollo; Devotion begins Apollo/Zeus                      | Planner convenience                                        | Retire as authored intent                                                           |
| Counted store                        | Run Progress begins with Boon; Meta Progress with Nectar; other stores name one first reward                 | Planner convenience                                        | Retire as authored intent                                                           |
| Per-room counted override            | Some I/N bindings replace an inadmissible store default with Boon                                            | Planner convenience needed only by default initialization  | Retire with store defaults                                                          |
| Shop inventory                       | Every emitted slot declares one `defaultOptionKey` and complete offer                                        | Planner convenience                                        | Begin each authorable generated slot unresolved                                     |
| Infernal Contract                    | The free pedestal begins as Blind Box                                                                        | Planner convenience inside a five-member domain            | Begin unresolved when the pedestal exists                                           |
| Travel Deal and Echo Gold            | Derived rows install the first engine-supported complete reward                                              | Planner convenience                                        | Materialize the row without inventing its payload                                   |
| Artificer                            | Selecting Artificer installs the current Run Progress default and its nested defaults                        | Planner convenience                                        | Select Artificer with an unresolved replacement                                     |
| Ordinary trait giver                 | Apollo and every other non-Hammer provider declare one selected three-trait offer                            | Planner convenience                                        | Begin the concrete offer unresolved                                                 |
| Hammer trait giver                   | Every weapon/aspect pair declares one selected compatible triple                                             | Planner convenience; compatibility itself is source-backed | Keep compatibility domain, retire the triple as intent                              |
| Encounter/NPC trait offer            | Selecting a trait-producing encounter installs its giver's default triple                                    | Planner convenience                                        | Preserve the provider, leave its generated offer unresolved                         |
| Fixed reward identity                | A producer explicitly grants Nectar, Infernal Contract, a particular essence, or another payload-free reward | Game/declaration fact                                      | Derive the fixed identity; do not create a fake choice                              |
| Fixed producer with variable payload | A fixed Mystery Boon still needs an eventual hidden source                                                   | Type is fixed; payload is not                              | Derive the type and leave the payload-bearing offer unresolved                      |
| Ordinary acquisition disposition     | A concrete pickup is acquired normally unless Time Piece or Artificer changes it                             | Modeled game baseline, not random identity                 | Retain the normal baseline; this audit does not make every boolean or mode nullable |

Numeric room defaults, encounter identity defaults, topology selections,
keepsake choices, Pom targets, and other non-reward/trait authoring are outside
this audit except where they depend on an unresolved reward or offer.

## Findings

### 1. Defaults currently masquerade as authored intent

A newly created occurrence immediately persists a reward, source payload,
three trait options, and one selected trait even though the user selected only
the room. Picking a Shop similarly persists complete inventory. Selecting
Artificer persists a replacement the user did not choose.

Those values affect bag depletion, peer exclusions, Devotion spacing, god-pool
history, Denial bans, Forfeit, slot occupation, and acquisition chronology.
They are semantic outcomes, not harmless display placeholders.

### 2. Contextual invalidity is reported against choices the user never made

Defaults are validated at the real frontier. That is correct for authored
values, but misleading for fabricated values. A default can be unavailable
because its bag entry is depleted, its Boon source is capped, its traits are
already equipped or banned, its slots are occupied, its Hammer is
loadout-incompatible, or its Shop group conflicts with a sibling default.

The UI then presents findings caused by initialization rather than user intent.
Trait offers amplify the problem: one arbitrary reward source creates up to
three arbitrary trait rows and a selected option, so a single untouched room
can emit several specific findings.

### 3. Invalid defaults can erase their own repair surface

Progressive evaluation correctly stops at the first invalid semantic child.
Several candidate and workspace products are derived from the reached valid
prefix. When the invalid child exists only because a constructor installed a
default, the editor may lose the control or exact destination required to
replace it.

The concrete schema-41 reproduction is an F `Combat 08` Ashes pickup changed
to Artificer. Artificer installs an Apollo replacement. Earlier Apollo
acquisition and Denial history make its default trait offer invalid. Simulation
retains the exact invalid trait child, but application projection cannot build
its dynamic repair destination and throws. Repairing only that destination
would leave the underlying fabricated-choice failure class intact.

### 4. Structural edits cause unrelated semantic edits

Room creation, room replacement, Shop entry, encounter selection, Fields count
growth, and activation of a dormant derived row may all introduce concrete
reward or trait outcomes. One structural command therefore authors unrelated
RNG outcomes and may change bags/history before the user visits their controls.

Replacement already has the correct policy for compatible authored state: it
retains that value even when it becomes context-invalid. The problematic branch
is a newly introduced or structurally incompatible leaf, which currently falls
back to another concrete default rather than becoming unresolved.

### 5. Catalog defaults mix facts with fixtures

Store membership, Shop group membership, source domains, trait pools, rarity
domains, Hammer compatibility, and offer cardinality are authoritative facts.
The specific first reward, Apollo payload, Shop option, and three selected
traits are not. Housing both in normalized production declarations makes the
convenience values easy to reuse as policy, candidate ordering, and authored
state.

The catalog should retain domains and fixed facts. Planner-only sample values
may remain in test builders if useful, but must not be the production meaning
of an untouched authorable leaf.

### 6. The existing unresolved model is a successful precedent

Schema 41 already distinguishes missing authorship from invalid authorship for
batch reward stores, Fields Min/Max, topology selections, and several
declaration-owned children. These values publish one exact prerequisite
finding, retain the control at the prepared frontier, and do not fabricate a
downstream result.

Reward and trait offers need the same semantic distinction, while respecting
their simultaneous peer/offer composition rules.

## Planner Disposition

### Unresolved is a first-class authored state

Every active authorable reward or trait outcome has two semantic states:

```text
never authored                -> unresolved and incomplete
authored, then made invalid   -> concrete, retained, and repairable
```

Unresolved is not malformed data and does not mean the producer is absent. The
room, reward slot, Shop slot, pickup, acquisition role, or trait provider
continues to exist at its stable semantic address.

An active unresolved leaf:

- emits one exact missing-authorship finding at that leaf;
- performs no offer, bag, history, acquisition, or trait mutation;
- stops selected chronology at the leaf's real lifecycle point;
- retains the candidate capability prepared immediately before that point; and
- remains visible and navigable so the user can author it.

A structurally dormant unresolved leaf emits no finding, history, marker,
candidate, or phantom editor. Reactivation restores the unresolved leaf rather
than installing a default. An active optional inventory row that has not been
acquired is not structurally dormant: payload authorship and pickup/purchase
participation remain separate, as they already are for supplemental Shop rows.

### Fixed facts remain derived

If the declaration and current context leave no authored degree of freedom,
the result remains a derived concrete fact. A fixed payload-free pickup should
not require the user to select its only possible identity merely to satisfy a
uniform nullable model.

If only part of an offer is fixed, only that part is derived. A fixed Mystery
Boon type still has an unresolved hidden source. A known god provider still has
an unresolved concrete trait offer. Fixed Hammer compatibility narrows the
domain but does not pick three upgrades.

### Reward authoring commits one complete offer

Reward type and payload form one semantic offer. An unresolved reward has no
payload default. The user may move through type/source or Devotion-pair steps
transiently, but authored state changes only when one complete supported offer
is submitted.

Selecting a concrete reward establishes its ordinary acquisition disposition
and any genuinely declaration-fixed children. It does not fabricate its
player-authored trait offer, Pom resolution, Artificer replacement, or another
nested outcome. Each unresolved nested decision owns its own checkpoint and
candidate domain.

### Trait authoring commits one complete displayed outcome

A known giver does not imply a concrete offer. Its authored offer remains
unresolved until the user supplies one supported whole outcome:

- one to three concrete trait options plus the selected option; or
- the mutually exclusive whole-offer fallback where supported.

The three positions are a game envelope, not three declaration defaults.
Partial picker work may be transient, but persisted partial triples would
create additional malformed/repair states and are not justified by this audit.
Option-owned details that are legitimately separate authored decisions retain
their existing declaration-owned lifecycle beneath the completed offer.

### Cohort and whole-offer constraints remain authoritative

Unresolved support must follow the game's generation unit rather than treating
each rendered row as an independent choice:

- sibling door rewards retain their physical generation order and peer
  exclusions inside one prepared cohort;
- Fields cages and optional pickups share their respective sequential producer
  rules;
- a Shop profile must preserve group counts and without-replacement across all
  unresolved and authored slots;
- Devotion resolves its pair as one offer; and
- a trait offer resolves its full one-to-three-option surface against one
  immutable pre-selection history.

The planner must not make an unresolved sibling's arbitrary candidate a
temporary selected fact in order to assess a later sibling. Candidate products
may instead expose complete supported cohort proposals or condition a later
domain only on earlier values the user has actually authored.

### Findings distinguish absence from invalidity

An unresolved leaf receives only its missing-authorship finding. Hypothetical
candidate failures belong to the candidate surface and must not appear as
selected-plan findings.

Once a concrete value is authored, its exact contextual findings are retained.
Upstream edits never silently clear, reroll, or replace it. This preserves the
current selected-invalid repair contract while removing false findings from
untouched defaults.

## Rejected Alternatives

### Choose the first currently valid candidate

This still authors a value the user did not choose, makes outcome identity
depend on candidate ordering, and silently changes authored state when the
frontier changes. It is a dynamic default, not an unresolved model.

### Keep defaults but suppress their findings

The defaults still mutate bags, peer support, history, and chronology. Hiding
their findings would make selected simulation less truthful and could allow an
invalid plan to advance.

### Persist partially filled reward payloads or trait slots

Partial persistence multiplies codec, command, finding, and repair states. The
existing compact picker already demonstrates that transient multi-step input
can commit one complete semantic value. One explicit unresolved state plus one
complete authored state is the smaller contract.

### Remove invalid defaults automatically

Automatic clearing cannot distinguish untouched initialization from a value the
user intentionally authored before an upstream edit. Authored intent must be
retained; the model must avoid inventing it in the first place.

## Scope for the Subsequent Plan

The implementation plan must inventory every production consumer of the
retired defaults and prove the result across ordinary rooms, structural room
replacement, Ephyra, Fields, O wheels, Shops and supplemental entries,
Narcissus, Artificer, Echo reward recreation and Gold, encounter/NPC offers,
Hammer loadouts, Devotion, Denial, Forfeit, codecs, undo/redo, findings, and
exact focus.

That inventory is an acceptance boundary, not a request to build a generic
effect registry or parallel reward engine. The existing reward kernel, trait
composition authority, lifecycle checkpoints, semantic addresses, and
application projection remain the intended owners.

Schema compatibility, gate boundaries, fixture migration, deletion of catalog
default fields, and the exact user interaction are deliberately deferred to
the plan. No implementation should begin until that plan has been adversarially
checked against this audit and the current code.
