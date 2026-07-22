# Game Generation Rules

## Purpose and Scope

This document owns cross-biome room-generation behavior shared by concrete
biome authorities. It defines verified picker, physical-door, cap, force,
generated-store, standard linear-batch, forked-preboss,
conditional-terminal batch, fixed biome-completion, and intentionally deferred
side-system semantics.

`ROOM_LIFECYCLE_MODEL.md` owns the ordered single-room timing that decides when
these generation rules observe room-local acquisitions.

It does not own a biome's start, room set, concrete exits, target reward ratio,
requirements, terminal depth, or biome-specific feature dispositions. Those
facts remain in `../biomes/F_GAME_RULES.md`, `../biomes/G_GAME_RULES.md`, `../biomes/P_GAME_RULES.md`,
`../biomes/Q_GAME_RULES.md`, `../biomes/H_GAME_RULES.md`, `../biomes/O_GAME_RULES.md`,
`../biomes/I_GAME_RULES.md`, and `../biomes/N_GAME_RULES.md`.

## Evidence Status

Picker, door, cap, force, and lifecycle behavior was verified against the
Hades II extraction on 2026-07-16. Generated reward-store behavior was
reverified on 2026-07-18. Primary sources are:

```text
../../1GameData/Scripts/RoomSets.lua
../../1GameData/Scripts/RunLogic.lua
../../1GameData/Scripts/RoomLogic.lua
../../1GameData/Scripts/RewardLogic.lua
../../1GameData/Maps/bin/
```

Concrete biome scripts and maps remain the evidence for whether each biome
actually uses a shared rule.

## Shared Feature Projection Map

The disposition vocabulary is defined by `CATALOG_MODEL.md`; implementation
coverage is defined by `../progress/MIGRATION_PROVENANCE.md`.

| Feature                               | Verified game behavior                                                                                             | Disposition and planner projection                                                                  | Current shared coverage                                   | Reconsider when                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| Room selection weights                | Eligible room-set members have relative weights and forced rooms replace the ordinary pool                         | **Simplified:** retain possible and forced support, never likelihood                                | documented                                                | Probability analysis or seeded replay becomes a product goal |
| Physical target creation              | Doors create targets sequentially; peers may repeat a game room and unpicked peers still affect history            | **Exact:** distinct ordered Room Occurrences                                                        | documented, declared, authored; F simulated and presented | --                                                           |
| Creation, appearance, and force rules | Caps use distinct histories; force windows use a capped chance formula and do not imply eligibility ceilings       | **Exact:** separate predicates over canonical history                                               | documented, declared; F simulation implemented            | --                                                           |
| Ordinary combat identity              | Concrete maps choose internal enemy encounters and wave compositions                                               | **Simplified:** preserve room identity and relevant encounter-depth effect, not enemy-wave identity | documented, declared for F/G                              | Combat composition becomes an authored or validated output   |
| Generated reward-store RNG            | Entered-room ratios determine RunProgress/MetaProgress probability when a generated target observes that store     | **Simplified:** preserve possible/forced support through authored, source-derived, or absent stores | documented and declared; F simulation implemented         | Probability analysis or exact RNG replay is introduced       |
| Biome-specific batch outcomes         | A generated peer batch may resolve one semantic outcome that affects all targets and later history                 | **Exact:** batch-owned typed state selected by normalized layout policy                             | documented for H; schema and simulation pending           | --                                                           |
| Door reward lifecycle                 | Every created target with a reward producer receives an offer; only the entered target acquires it                 | **Exact:** separate resolved-offer and concrete-acquisition events                                  | documented; F simulation implemented                      | --                                                           |
| Reward offer projections              | Devotion writes its spacing depth during offer setup even when its target is unpicked                              | **Exact:** declaration-selected offer-time projection, separate from acquisition                    | documented; F simulation implemented                      | --                                                           |
| Forked preboss generation             | One preboss map may be created once per predecessor exit, first as Shop and then as free rewards                   | **Exact:** distinct terminal target occurrences with derived realization roles                      | documented, declared, authored; F simulated and presented | --                                                           |
| Conditional terminal generation       | A generated peer batch may contain one terminal room beside ordinary targets                                       | **Exact:** the picked target declaration determines completion or continuation                      | documented for I; schema and simulation pending           | --                                                           |
| Persistent hub generation             | One fixed physical hub creates a stable offer board, restores it after visits, and later opens a separate terminal | **Exact:** fixed catalog slots, one offer batch, authored visit order, and derived restores         | documented for N; schema and simulation pending           | --                                                           |
| Fixed biome completion                | A terminal continues through a biome-owned ordered sequence of derived rooms, which may omit postboss rooms        | **Exact:** layout-ordered derived Room Declarations followed by the declared next step              | documented and declared; F simulation implemented         | --                                                           |
| Persistent NPC encounters             | NPC variants can replace or extend ordinary encounter spines and alter counters, rewards, or exits                 | **Deferred:** omit and suppress all NPC variants in the v1 NPC-free baseline                        | documented                                                | Persistent NPC entities are implemented                      |
| Natural Chaos routing                 | A natural Chaos gate creates a detour room and reward offer even when the gate is never entered                    | **Deferred:** omit and suppress natural Chaos generation                                            | documented                                                | Route-structural detours are implemented                     |
| Anomaly replacement                   | Some biomes can replace a generated target with a one-room detour that returns to the prior room set               | **Deferred:** omit and suppress Anomaly replacement                                                 | documented; concrete use verified for G                   | Route-structural detours are implemented                     |
| Optional player interactions          | Challenges, wells, gathering, and rerolls can add encounters, rewards, purchases, resources, or alternate RNG      | **Deferred:** canonical v1 traces never activate or use them                                        | documented                                                | The corresponding authored action enters product scope       |
| Save/profile gates                    | Persistent progression can alter room and encounter availability                                                   | **Excluded:** concrete biome authorities define progressed-save baselines and omit those predicates | documented; F/G baselines declared                        | Save-profile state becomes a project input                   |
| Pure presentation                     | Maps contain dialogue, animation, audio, and visual presentation systems                                           | **Excluded:** no canonical planner facts                                                            | documented by scope only                                  | One becomes necessary for route execution or validation      |

## Room Selection

The room picker filters eligible room-set entries, prefers the forced pool
when non-empty, and otherwise selects from the eligible pool. Room-set
multiplicity represents random weight; the planner does not simulate those
probabilities.

The simulator retains the resulting support set only. Every eligible member
of the selected pool is possible regardless of relative weight. A non-empty
forced pool makes ordinary eligible rooms impossible for that decision; it
does not merely make them less likely.

## Sequential Physical Doors

Physical doors are processed sequentially. Every selected target is created
immediately, so later peers see earlier creation history. Ordinary eligibility
does not generally exclude a game room merely because another exit in the same
batch already selected it.

Consequently:

- peer exits may create the same concrete game room;
- an unentered room may be created again in a later batch;
- every rewarding creation has independent incoming reward state;
- unpicked peers still affect creation history and, when they own producers,
  reward-offer history.

The app represents each creation as a separate Room Occurrence with its own
persisted occurrence ID. It never substitutes another compatible combat name
to manufacture uniqueness.

Door type and source/target tags may further restrict candidates. Concrete
biome authorities own those physical facts; P is the first verified
source-sensitive example.

## Caps

The game caps are separate predicates:

`MaxCreationsThisRun`
: Counts concrete room creations, including unpicked peers.

`MaxAppearancesThisBiome`
: Counts entered appearances in the current biome.

`MaxCreationsPerRoom`
: Restricts creation relative to the current predecessor. It is not a generic
same-batch uniqueness rule.

A concrete Room Declaration carries every cap that applies to it. The shared
generator does not infer caps from room kind or compatible-room capacity.

## Force Semantics

`ForceAtBiomeDepth` is exact-depth eligibility and force on that counter.
`ForceAtBiomeDepthMin/Max` retains the game's raw minimum and maximum values.
The minimum is also an eligibility boundary. At an eligible integer depth
`currentDepth`, the planner derives the capped force chance as:

```text
forceChance = 1 / max(1, forceAtDepthMax - currentDepth)
```

When `forceChance < 1`, both forced and unforced realizations have positive
support. When `forceChance = 1`, the room must enter the forced pool. The
maximum is therefore formula input, not a separately interpreted deadline or
an eligibility ceiling. A separate current-run requirement must express a real
upper eligibility bound.

Force pressure applies across the complete peer batch. A forced target created
on an earlier physical exit can change what remains forced or eligible for a
later exit.

The simulator must therefore preserve physical generation order and evaluate
force and eligibility from the appropriate pre-creation history view.

The F implementation records the result as one immutable force-pressure entry
per physical target. Each entry contains the exact pre-creation counters and
cap counts, eligible rooms, optional and required forced rooms, final support,
and the selected room's exclusion reasons. A selected room is legal exactly
when it belongs to that support set. Room-set membership is treated as
positive-weight support; multiplicity and likelihood remain outside the model.

## Intentionally Deferred Side Systems

The v1 planner deliberately closes the room spine before composing persistent
NPCs or route-structural detours into it.

Persistent NPC encounter variants are absent from v1 encounter support. They
can replace, extend, or block ordinary encounter phases and can change modeled
counters, rewards, or exit behavior, so they are not treated as equivalent
combat presentation. The future game adapter must suppress an NPC variant
unless a later execution plan explicitly configures that persistent entity.

Natural Chaos is likewise absent from v1 route support. A spawned Chaos gate
immediately creates a real detour room and reward offer even if the player
never enters it, so a mere no-entry assumption is insufficient. The future
game adapter must suppress natural Chaos generation until the app models Chaos
as an additive route-structural detour.

Anomaly replacement follows the same structural deferral. It substitutes a
generated room with a real detour room and later returns to the prior room set;
it is not an alternate encounter inside the selected room. The future game
adapter must suppress Anomaly replacement until layouts and execution plans
can represent detour entry, history, reward, and return. G is the first
verified concrete user of this rule.

Challenges, wells, gathering points, and rerolls use a different deferral
contract. Their physical presence does not by itself enter canonical v1
history. The supported trace never activates a challenge, purchases from a
well, gathers a resource, or rerolls an offer. These no-action traces remain
valid without pretending the underlying systems do not exist.

## Generated Targets and Entered Lifecycles

While a source room is current, it generates every next-room occurrence and
offers every incoming reward. The picked occurrence is entered later.

```text
source.generate_next
  -> room.create for every physical exit
  -> reward.offer for every target with a producer
      -> reward.offer_projection, when declared

source RoomLifecycleProfile continues
  -> source.commit
  -> source.exit through selected target

picked target lifecycle
  -> target.prepare from post-source-commit state
  -> target.enter
  -> room.appear
  -> producer-defined acquisition point(s)
  -> outgoing-generation checkpoint, when present
```

Offer projections occur during target generation and therefore affect later
peer or downstream eligibility even when the target is unpicked. Devotion's
spacing marker is the only supported reward-specific projection. Counted bag
consumption and common offer history remain generic offer-point behavior.
Unpicked targets never emit concrete acquisitions from their incoming offers.
Targets with no reward producer emit no reward offer at all. This distinction
is essential for counted bags, creation caps, reward-free Q batches, and
repeated game names.

`ROOM_LIFECYCLE_MODEL.md` is the authority for the operation order inside the
entered room and for the rule that a generated outgoing batch is immutable
under later room-local acquisitions.

## Generated Reward-Store Selection

Biomes may use entered-room history to choose one reward-store context for a
generated peer batch. Physical target creation precedes reward assignment, and
target order remains observable during forced-store resolution.

Concrete biome authorities own target ratios, adjustment parameters, and room
overrides. `REWARD_MODEL.md` owns the support formula, two-pass target-store
resolution, counted-bag behavior, and fixed Story/Shop provenance.
`AUTHORED_PROJECT_MODEL.md` owns the candidate persisted batch-store shape.

The normalized batch-store policy has three verified forms:

`authoredBaseStore`
: The otherwise-unrepresented generated-store outcome is persisted on the
batch. F/G/P and non-ShipCombat O sources use this form when their
generated store is observable.

`sourceOfferPoint`
: The batch reads a store already authored by a room-owned offer point. An O
ShipCombat source uses its final active wheel store. The batch never persists
a competing copy.

`none`
: No observable generated base store exists. Q reward-free batches use this
form. H uses it because supported targets are reward-free or resolve
declaration-owned RunProgress provenance. I likewise uses it because every
supported target resolves the declaration-owned `TartarusRewards` override;
counted targets retain that concrete provenance without an authored batch
value.

The completed biome audit set freezes this batch-store policy shape. This
document owns only its placement in the generated-door lifecycle; it does not
duplicate the reward algorithm.

## Standard Linear Generated Decisions

F, G, H, O, and P use the ordinary `LinearBiome` generated-decision shape. Q
uses the same occurrence and continuation shape with declaration-driven staged
candidate pools:

```text
declared start
  -> generated batch
  -> picked target
  -> generated batch
  -> ...
  -> terminal transition
```

Every ordinary batch has one target occurrence per active physical exit and
exactly one picked target. Only the picked occurrence owns the downstream
continuation. Unpicked occurrences are dead leaves.

Physical exit count belongs to the selected source Room Declaration. Reward
count, encounter count, and UI row count never determine it. A later biome may
use a different layout or decision policy without changing these physical-door
facts.

A normalized biome policy may add required typed batch state after every
physical target is known. That state belongs to the batch when it coordinates
peer targets or updates batch-level history; it does not move local values out
of the target occurrences. H is the first concrete use: one semantic cage
outcome activates the same bounded local-slot prefix on every combat target
and updates a biome counter even when capacity hides the visible result.
`../biomes/H_GAME_RULES.md` owns the exact outcome support, capacity fold, counter, and
the narrow terminal omission.

## Conditional-Terminal Generated Batches

I proves that a generated batch and terminal transition are not always
separate game decisions. After Clockwork Goals reach zero, sequential door
generation creates `I_PreBoss02` on the first physical exit and may create an
ordinary I target on a second exit. Exactly one target is picked:

```text
picked I_PreBoss02 -> complete biome
picked ordinary I  -> continue from that occurrence
```

The app keeps this as one generated batch. Every target is a normal Room
Occurrence, and the normalized batch policy permits both continuation and
terminal declaration roles. The picked Room Declaration derives the
continuation effect; authored state does not duplicate it as an entry mode.
The editor therefore uses `Add Next Decision` for I both before and after Goal
completion. After completion the derived first target is immediately pickable
as preboss; no separate `Go to Preboss` action gates or replaces it.

An unpicked preboss is an ordinary dead-leaf occurrence. A later predecessor
may create a new occurrence of the same declaration when the game's cap is
per predecessor rather than per run. No singleton room state, synthetic
terminal companion, or separate declined-offer record is introduced. Its
entered-room shop state is required and materialized only when that occurrence
is picked.

Biome authorities own the exact eligibility, force, ordering, and local leaf
state. `../biomes/I_GAME_RULES.md` owns the first concrete policy. Other linear biomes
continue to use an independent terminal transition unless their game data
proves the mixed form.

## Persistent Hub Generation

N proves that a generated offer batch need not belong to one selected-spine
parent whose picked target becomes the next decision parent. Its hub owns a
fixed physical slot-to-room mapping and creates one persistent board of nine or
ten open targets. Every open target and incoming reward is generated together;
six distinct targets are then entered in authored player order.

The app separates four axes:

- catalog hub-slot order and fixed room identity;
- physical target and reward generation order;
- authored main-target visit order;
- canonical room-history order, including side-room parent restores and hub
  returns.

Open unvisited targets remain offered dead leaves. Returning to the hub reuses
the same target objects and rewards, so it emits no new creation or offer
events. Entering a side room and restoring its parent likewise reuses one main
Room Occurrence. Repeated history records therefore do not imply repeated
occurrences or authored cycles.

After the declared visit count is complete, the hub exposes a separate fixed
terminal role. The persistent board and terminal may coexist structurally;
neither is encoded as an ordinary linear continuation owned by the restored
hub. `../biomes/N_GAME_RULES.md` owns the exact availability, pylon, side-room, reward,
and terminal rules.

## Shop-Then-Fill Preboss Policy

F, G, P, and H preboss rooms combine a forced first Shop reward with no
per-predecessor creation cap. When a predecessor has several exits, the game
may create the same preboss room on every exit:

```text
exit 1 -> X_PreBoss with Shop
exit 2 -> X_PreBoss with free RunProgress reward
exit 3 -> X_PreBoss with another free RunProgress reward, when capacity permits
```

Free rewards exclude `Devotion` and `RoomMoneyDrop`. Every exit contributes a
real room creation and reward offer. Exactly one exit is picked and all exits
load the same concrete map identity.

The app models this without a singleton preboss control:

- the terminal transition owns one target occurrence per active predecessor
  exit;
- every target references the same terminal Room Declaration but has its own
  occurrence ID;
- the terminal policy derives realization kind from physical generation order:
  first `shop`, then `freeReward`;
- topology owns the one picked terminal target;
- each free target owns its complete resolved reward offer;
- the shop target requires complete shop state only when picked for entry;
- unpicked targets contribute creation and door-visible offer history but no
  acquisition or room-internal shop offers and purchases.

There is no authored preboss `entryMode`. Picking a physical target already
expresses the entered realization. Concrete biome authorities own terminal
depth, room identity, maximum free-reward capacity, and predecessor exit facts.

## Fixed Biome Completion Transitions

A biome continues from its editable terminal through an ordered completion
sequence before the next biome begins or the route ends. F, G, H, I, N, O, and
P use a fixed boss followed by a fixed postboss:

```text
editable terminal
  -> fixed boss
  -> fixed postboss
  -> next biome entry or route completion
```

Completion rooms are not authored topology and do not receive editor controls.
They are concrete derived Room Declarations referenced by an ordered layout
completion sequence:

```ts
completion: {
  rooms: [
    { role: 'boss', roomGameName: 'G_Boss01' },
    { role: 'postboss', roomGameName: 'G_PostBoss01' },
  ],
}
```

The simulator walks that declared sequence after the editable terminal. Each
room contributes its declared appearances, room-history ordinal, encounter,
reward, reward-store history, and biome-transition effects before downstream
rules are evaluated. Derived rooms have no authored leaf state and never enter
generated candidate pools. The sequence may contain only a boss, as in Q's
canonical repeat-run projection, or another ordered set justified by a
concrete biome authority. The route transition or route completion follows
only after the declared sequence is exhausted.

Automatic boss-specific and weapon-dependent drops are outside the current
modeled reward surface because they do not affect any supported authored
choice, validation rule, or execution instruction. A boss may still contribute
the store resolved for its linked offer to the game's ratio ledger. That
bookkeeping is an explicit Room Declaration policy and does not require a boss
reward type, bag mutation, concrete acquisition, or editor state.

Concrete biome authorities own the canonical boss variant, any postboss
identity, narrative-progression exclusions, and exceptional local effects.
User-selected difficulty variants remain excluded unless difficulty becomes
an explicit project input. The route owns biome order; the layout owns
completion-room order; Room Declarations own the room facts.
`ROOM_LIFECYCLE_MODEL.md` owns their single-room operation ordering.
`SIMULATION_AND_VALIDATION.md` owns event folding and cross-room composition.

Physical exits no longer encode a `fixedBoss` or other semantic target mode.
The terminal Room Declaration owns its physical exit type, while the layout's
ordered completion sequence is the sole authority for the derived boss and
postboss identities. This keeps physical map facts independent from completion
roles and leaves route order with the Route Declaration.

## Completeness and Validation

A standard linear biome is complete only when its selected chain reaches a
complete terminal transition, or a policy-admitted generated batch picks a
terminal target, and every ordinary or terminal target has complete offer-time
leaf state while every picked target has complete entry-time state. A
generated batch is complete only when its normalized
store policy is resolved: an authored policy owns a concrete store, a
source-offer policy resolves an active addressed offer point, and a reward-free
policy owns none. If the normalized biome policy declares additional
batch-global state, every required value must also be concrete; H therefore
requires one semantic cage outcome on every ordinary generated batch,
including a batch with no combat target.

Completeness does not imply legality. A complete snapshot may still contain:

- an ineligible room;
- a violated creation or appearance cap;
- unsatisfied force pressure;
- an authored reward unavailable from current history;
- a terminal target inconsistent with predecessor capacity;
- a repeated entered room rejected by its appearance cap.

Validation reports these facts without rewriting topology or substituting game
room identities.

## Explicitly Rejected Legacy Rules

The standalone app does not carry forward:

- injective top-level room references;
- compatible combat-room substitution;
- static combat-pool capacity proofs whose purpose was supporting substitution;
- one global dormant Room Control per game room;
- a singleton forked-preboss control with an authored `entryMode`.

The actual creation, appearance, force, exit, reward, and encounter rules are
retained through concrete declarations and occurrence history.
