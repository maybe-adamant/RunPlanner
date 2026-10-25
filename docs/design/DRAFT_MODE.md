# Draft Mode

Draft Mode fills a route with a random plan inside a user-described world. The
engine owns all of it: the spec's world options, static basket legality with
its caps and refusals, the search and its biome walk, the encounter post pass
and the report. The application only runs it in a worker and applies the result
as one `ReplaceRoute`. Option ranges and defaults live in `DRAFT_OPTIONS`;
steering weights live in the draft steering code. This document owns their
meaning.

## Best-Effort Contract

The walk is driven by the route's next blocking finding and authors each
decision from an engine domain or candidate query through edit settlement,
including every selected-trait child; it never computes game legality. Its own
rules are draft policy, not legality: monotonic acquisition, the god pool,
draft-illegal traits (the Ransoms and the replaying Echo choices), the per-slot
basket claim, the basket's exclusive sets and the planner caps.

The contract is best effort with no compromise on validity: a drafted project
always has zero findings, and the report lists each basket trait, story and
field NPC and rack keepsake as met or unmet. After a biome's first success that
misses a target there, it retries up to the spec's retries per biome and keeps
the best. A biome that dead-ends retries only itself; attempt counts alone bound
the search, so a seed drafts the same project on every machine. The encounter
post pass then makes every reached encounter deterministic from the same seed.

## The Draft Spec

The route owns one always-present `draft` spec: the persisted Draft settings
and the recipe a draft generates from. It plays no part in plan legality or
execution. Its world is `godKeys` (the pool order), `storyNpcByBiome`,
`fieldNpcsByBiome`, `basketByGiver`, `rackKeepsakeByBiome` (a missing biome
keeps the held keepsake) and `seed`. A new route starts with an empty world.

The Advanced options are declared in `DRAFT_OPTIONS` with their kind, range or
choices, default and share-code tag, and each is saved only when it differs
from its default:

- `godBoonsByBiome`: the god boons planned per biome, defaulting by route and
  biome;
- `perGodCap`: the per-god cap, whose default is lower under Denial, so a
  stored value is absolute;
- `preferMidshops`: take each biome's mid-biome Shop over any boon door;
- `pursueTartarusGoal`: steer toward Tartarus Clockwork Goal doors, expecting
  fewer god boons there;
- `roomForcing`: `deadline`, `softened` or `game` (see steering);
- `purchasesPerBiome`, `retriesPerBiome` and `resourceRoomChance`;
- `fillerPriority`: an ordered list of filler kinds (`maxHealth`, `maxMagick`,
  `gold`, `pom`), each with an optional per-run `amount`.

`basketByGiver` maps each trait giver to its basket traits in that giver's
acquisition order; a Duo sits in exactly one of its gods' lists, which makes
that god its host.

The spec decodes tolerantly, unlike the rest of the project: unknown keys,
gods, NPCs, traits, keepsakes and biomes are dropped, duplicates keep their
first occurrence, a value of the wrong type takes its default (a missing spec
is the empty one), numbers clamp to their range and steps, and a stored default
is dropped. Records save in catalog biome order and entries for biomes off the
itinerary are kept. The basket keeps only known givers' traits they offer, a
trait listed twice stays in its first list (pool gods in pool order first),
lists save in catalog giver order and an empty list drops; a flat
`basketTraitKeys` is an unknown key, so such a basket loads empty. A filler
ranking keeps each known kind's first entry; an amount that is not a whole
number drops and one out of range clamps. Basket legality stays a draft-time
refusal.

The project codec, `ReplaceDraftSpec` and share codes use the same decode, so a
new option or a changed meaning needs no schema revision. The loadout and
itinerary are read from the project, not duplicated. `ReplaceDraftSpec`
replaces the spec as one ordinary history edit and preserves identity for a
structurally equal spec. Draft run state and results are not persisted.

## Spec Meaning and Refusals

The draft covers the route's planned biome prefix: targets, racks, caps and the
report stop at the last planned biome. The god pool's order is the order new
gods arrive: whenever the walk would author an offer from a god not yet
acquired this run, it uses the next unacquired pool god instead, so the run's
first Olympian pick is pool #1's. The basket's order across givers means
nothing. Only a god's next unheld trait may be taken from it, and a trait
waiting only on run state (an element threshold or a rarity count) is passed
over until that state holds. Only a Duo's host offers it, it counts toward the
host's per-god cap, and when the host's queue reaches it before its
prerequisites are held the host takes its next trait and returns to the Duo
once they are.

Caps are engine-owned and scale with the plan. The god boon cap sums each
planned biome's planned god boons, less one per biome under Forfeit; Hermes and
Hammer share one cap equal to the planned biome count, and each also keeps its
own cap. An over-budget basket is
refused, never trimmed. Static refusals also cover a basket order that places a
trait (never a Duo) above its own prerequisite, a second trait of a mutually
exclusive set (read from the catalog's `notEquippedTrait` requirements, such as
the Cast boons), and a pool #1 god whose first queued trait cannot be the run's
first pick (a core boon on a mature route, the route's first-run offer on Fresh
File). World options read route legality: Fresh File offers only gods its
acquisition requirements admit, with its first-run god required as pool #1, no
Hermes, Hammer, Selene, NPCs or racks, and a nullable loadout; a pool that
leaves a god unreachable is refused.

The loadout is input; the draft generates the starting reward, the biomes and
their rack equip results and the resource points. The starting keepsake's equip
result is input when the player set one: the walk takes it where it is possible
and the basket's trait guard admits it, otherwise it samples one, and the
report lists it met or unmet. The walk never takes a trait outside the basket
while a basket trait it would exclude is still to come, and fills a Travel Deal
refill from the refilled slot's options, as settlement reads it. A choice that
clearly contradicts the basket is refused: a Jeweled Pom trait in a basket
trait's slot, or an Experimental Hammer trait queued after another basket
Hammer or one past the Hammer or the Hermes and Hammer cap.

## Steering

Steering weights legal candidates and never changes legality. It reads every
room as the route declares it, route overlays included.

- **NPC windows.** A selected NPC's window, read generically from its encounter
  requirements (room-reward exclusions, depth window, room tags, the gap since
  the previous NPC, once per route), outranks a due trait: hosting rooms are
  favoured while the window is open and their door reward avoids the excluded
  types. A missed window is reported as a miss.
- **Pacing.** When a biome starts, each god trait due there gets a target room
  depth: sorted random draws, in schedule order (a Duo after its
  prerequisites), over a share of the biome's expected rooms (its latest forced
  depth; a Hub's required visits plus its entry rooms) that shrinks as the due
  traits crowd the biome's planned god boons. A god's pull is a weight, not a
  threshold: below a non-god reward's well before its target, the due weight at
  it and growing past it, so a trait can land early or a little late. An
  overdue trait is past its target from the biome's first room, one due in a
  later biome keeps the wanted weight, and a god room that comes up early still
  takes the trait. Hub board doors are authored at the due weight, since their
  visits come later.
- **One god boon door per exit.** Once another door of the exit holds a god
  boon (a boon reward, Mystery boon or Devotion trial), such rewards on this
  door are strongly damped, since every shown door draws from the bag whether
  taken or not.
- **Shop purchases.** The draft buys a boon or Mystery boon of a god that can
  take its next queued trait, and Hermes or a Hammer when due, at a soft pace
  of the spec's purchases per biome. The pace steepens when behind or when the
  boon entries left in the bags this biome's doors draw from (its base-store
  policy, else the stores its rooms declare) are nearly spent; it never forces
  or blocks a purchase, and gold is not modelled. At zero the draft never buys
  a god boon, while Hermes, Hammer and Dream boosts keep their own rules.
  Filler purchases do not count toward the pace.
- **Filler.** Non-boon rewards group into four filler kinds, Max Health, Max
  Magick, Gold and Pom, each covering every size variant (Pom includes the Pom
  Slice); every pickup counts one, at a door or in a Shop. Rank weights apply
  only to the ranked kinds still short of their per-run amount, so the kinds
  below move up as one finishes; a finished or unranked kind is plain filler.
  While a ranked kind is still short, a god with no basket trait left weighs
  below the top-ranked filler. Amounts are preferences, never draft targets.
- **Spare Shop purchases.** Once every slot of a Shop holds an item, so its
  boons are bought first, the draft spends the biome's spare purchases (its
  purchases per biome less those made there) on ranked Max Health, Max Magick
  and Pom still short of their amount, each a weighted pick; Shops sell no
  Gold. A mid-biome Shop keeps one spare purchase for the Preboss Shop, which
  may use them all. The reserve counts purchases, not gold.
- **Shop doors.** Without the midshop preference, a Preboss Shop door still
  takes the preferred-Shop weight when the boon bag runs low or a trait some
  god can take is past its target, and a mid-biome Shop door does once the
  door bags hold no boon. On a route whose save-file god history starts closed
  (Fresh File), a Shop stocks only gods already picked up, so a door offering
  a not-yet-met god with queued traits outranks a Shop door, midshop
  preference included.
- **Room forcing.** A new door rolls each legal room inside its declared depth
  window and places a hit first. The spec's room forcing picks the chance: the
  game's ramp toward the deadline, that ramp softened one step (the default),
  or nothing before the deadline; a window one depth wide keeps the game's rule
  under every setting. A door that can show a wanted story room keeps it
  instead, and an offered story room's door is always taken. Legality still
  only forces a room at its deadline.
- **Fountains and resources.** Fountain rooms only break ties between equal
  doors and make a wanted god's reward likelier. Resource points roll at the
  spec's resource room chance, preferring an element a waiting trait needs;
  Dream buys elemental boosts instead.
- **Exclusions.** Offer exclusions that hold in every branch stop the walk
  chasing that god or source for the biome rather than retrying it.
- **Encounters.** Each reached encounter phase where the engine offers the Fig
  Leaf skip rolls the native flat skip chance (luck ignored) and is skipped on
  a hit; uses, the one skip per biome and eligibility stay the engine's. An
  unskipped phase where the engine offers Gorgon's Athena trigger takes it,
  assuming the trigger condition met; the Athena offer that follows is authored
  like any trait offer. While the amulet is equipped (starting keepsake, or a
  rack keepsake for a later planned biome), Athena's traits join the basket
  under her one shared NPC cap.

A fixed corpus (`npm run test:draft-corpus`) measures these rules, including
the spread of basket traits' in-biome landing depths, the god boon rooms'
count, gaps and early share per biome, and the Shops entered per run; its
committed baseline records rates and medians, not plans.

## Share Codes

A share code carries what a player authors for a draft, so drafting a pasted
code gives the same plan: the route (and a Dream itinerary), the configured
prefix, the loadout choices the draft reads (weapon, aspect with its Hex tree,
keepsake with its chosen equip result, familiar, Vows and manual Arcana; none
on Fresh File), the ordered god pool and basket, NPC and rack picks, the
Advanced overrides that differ from their defaults and the seed. It leaves out
what the draft generates (the starting reward) and what sits outside the draft
(the Practice start and run modifiers), so a code reproduces the plan only when
those match.

The engine codec packs positions in catalog-ordered lists into base32 behind a
layout version and a fingerprint of those lists and the catalog facts that
shape the layout. The loadout and the draft world are positional; the basket
is its traits giver by giver, each with one more position naming which of its
givers lists it when more than one offers it (a Duo's host), and the
fingerprint covers each giver's traits. The stored Advanced options follow as
tagged entries keyed by their `DRAFT_OPTIONS` tag, and a reader skips an
unknown tag, so a new option needs no layout change. A code from another
layout, catalog or route is refused rather than decoded into other keys (a code
from an earlier layout as from an older planner); the loadout passes its
validation and the draft spec heals through the tolerant decode.

Codes are made on demand and never persisted, so they touch neither the project
schema nor the plan wire. Pasting installs the spec and loadout through
semantic commands as one history edit; a carried equip result is installed and
one the code lacks is left as it is.
