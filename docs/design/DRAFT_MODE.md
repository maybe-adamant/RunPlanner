# Draft Mode

Draft Mode fills a route with a random plan inside a user-described world. The
Draft package (`packages/draft`) owns all of it: the spec's world options,
static basket legality with its caps and refusals, the search and its biome
walk, the encounter post pass and the report. It is a downstream consumer of
the engine: it authors through the engine's declared authoring session,
candidates and queries, while the persisted spec and its share code stay in the
engine's authored model. The application only runs it in a worker and applies
the result as one `ReplaceRoute`. Option ranges and defaults live in the
engine's `DRAFT_OPTIONS`; steering weights live in the Draft package's steering
code. This document owns their meaning.

## Best-Effort Contract

The walk is driven by the route's next blocking finding and authors each
decision from an engine domain or candidate query through edit settlement,
including every selected-trait child; it never computes game legality. It
takes a candidate only when the engine reports it supported with no findings,
except the trait screen a pickup opens at its own site (a Mystery boon's god
boon screen), which the walk authors next. Its own
rules are draft policy, not legality: monotonic acquisition, the god pool,
draft-illegal traits (the Ransoms and the replaying Echo choices), the per-slot
basket claim, the basket's exclusive sets and the planner caps. A trait whose
offer needs a missing Death Defiance, which no plan can know the player has
(the catalog's Death Defiance offer dependence), appears on a drafted trait
screen only as the selected row of a basket trait, never as another row.

The contract is best effort with no compromise on validity: a drafted project
always has zero findings, and the report lists each basket trait, story and
field NPC and rack keepsake as met or unmet. After a biome's first success that
misses a target there, it retries up to the spec's retries per biome and keeps
the best. A biome that dead-ends retries only itself; attempt counts alone bound
the search, so a seed drafts the same project on every machine. Every reached
encounter is made deterministic from the same seed: the walk customizes each
room's encounters as it leaves the room, so a later Shop's gold reads the
rosters the plan keeps, and the encounter post pass customizes the rest and
places the biome's Aetos wave.

Draft collects in the order things appear in the room, never batched where the
walk stands: each required pickup is placed at the earliest point the engine's
live room offers it (where it spawns, or where its cage unlocks), in spawn
order, before the room's next interaction. A Fields cage's rewards are
collected before the next cage is unlocked, a Hermes delivery where it
arrives, and a Gold Gold Gold duplicate right after the purchase that spawns
it. A pickup whose earlier acquisition would leave a later row invalid waits
where the walk stands instead. Other required actions are placed by the
engine's next required placement, except that when the live room offers
several Fields cage unlocks there, the walk unlocks the cage whose stored point
is nearest where it stands: the room's entry, then the last cage it unlocked.
A flip mirrors the whole room, so it changes no distance.

Ephyra's Hub opens its doors as before. At its first visit the walk draws the
visits it will take, the required count, with the steering weights, then walks
the Hub's map: from where Melinoë enters the Hub, or the door of the room she
last returned from, it takes the nearest of the drawn visits and the fountain
(at the fountain's own spot) still to come. Only a selected field NPC unmet so
far changes this: a drawn visit that can host it goes first while its window
is open, and waits for the other stops while it is not. A side room returns
through its main room, so it moves nothing. Board rewards are drawn when the
doors open, so the order changes when rewards are taken, not which exist; the
walk still steers each visit's choices once the order is set.

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
- `spending`: `none`, `careful`, `normal` (the default) or `greedy` (see
  steering);
- `retriesPerBiome` and `resourceRoomChance`;
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

Caps are Draft-owned and scale with the plan. The god boon cap sums each
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

A basket pick the world or loadout never offers is unavailable: its giver, or a
Duo's other god, is outside the world, it is draft-illegal, or it is a Hammer
for another weapon or Aspect. Editing the world or loadout keeps such picks,
and they refuse the draft like any other; Draft names them, even while the
world itself is refused (an emptied god pool), so the player can remove them
all in one edit. Refusals that depend on the other picks or their
order (caps, slots, prerequisites, the first pick, requirements) are left for
the player to resolve.

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
- **Shop purchases.** A planned purchase the player cannot afford desyncs the
  run, so the draft buys only what the engine's gold ledger says the gold held
  covers: judged against the balance before the purchase, after every earlier
  planned purchase, the chance it covers the price must reach one floor shared
  by every style. The spending style sets how readily the draft buys beyond
  that: `none` buys nothing; Careful buys only wanted items and keeps the
  largest cushion of spare mean gold after each; Normal also buys ranked filler
  still short of its amount with a smaller cushion; Greedy buys any Shop filler
  it can afford, spending down to the floor, and leans further toward plain
  mid-biome Shop doors (see Shop doors). Wanted items, a boon or Mystery boon of a god that can
  take its next queued trait, Hermes or a Hammer when due and a Dream boost of
  a wanted element, need half the style's cushion. A wanted item that falls
  short first takes back the run's earlier filler purchases, latest first,
  until it clears, and is left only when no filler is left to take back; a
  take-back that would add a finding is skipped. The draft builds forward, so
  each purchase is judged against the purchases before it. A purchase the
  ledger cannot reach until a choice it or an earlier purchase opens is made,
  such as a Mystery boon's god boon screen, is judged once the next steps make
  it, and taken back if they do not soon. A Contract pedestal's free item is
  collected whenever wanted.
- **Filler.** Non-boon rewards group into four filler kinds, Max Health, Max
  Magick, Gold and Pom, each covering every size variant (Pom includes the Pom
  Slice); every pickup counts one, at a door or in a Shop. Rank weights apply
  only to the ranked kinds still short of their per-run amount, so the kinds
  below move up as one finishes; a finished or unranked kind is plain filler.
  While a ranked kind is still short, a god with no basket trait left weighs
  below the top-ranked filler. Amounts are preferences, never draft targets.
- **Shop stock.** Settlement stocks a Shop the walk enters; the draft then
  replaces each slot, in slot order, with its steered pick among the items the
  inventory admits beside the stocked peers, then buys, and steers a Travel
  Deal item the same way once a purchase restocks it.
  Shops the plan entered before the draft are left as they are.
- **Shop filler.** Once every slot of a Shop is steered, so its wanted items
  are bought first, the draft buys the Max Health, Max Magick and Pom its style
  takes (ranked kinds still short of their amount, or under Greedy any of them,
  ranked kinds first), each a weighted pick bought when its gold clears the
  floor and the full cushion; Shops sell no Gold.
- **Shop doors.** Without the midshop preference, a Preboss Shop door still
  takes the preferred-Shop weight when the boon bag runs low (the boon entries
  left in the bags this biome's doors draw from: its base-store policy, else
  the stores its rooms declare) or a trait some god can take is past its
  target, and a mid-biome Shop door does once the door bags hold no boon;
  neither applies when the draft spends nothing. Otherwise a mid-biome Shop
  door weighs 1.5 against a plain door's 1, times 1.5 under Greedy. On a route
  whose save-file god history starts closed (Fresh File), a Shop stocks only
  gods already picked up, so a door offering a not-yet-met god with queued
  traits outranks a Shop door, midshop preference included.
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
- **Trait drops.** Quick Buck's gold and Buried Treasure's pickups are
  optional, but players take them, so the draft picks each up at the first
  point the room allows after the boon that grants it.
- **Exclusions.** An offer exclusion stops the walk
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
count, gaps and early share per biome, the Shops entered per run and the gold
the Shop purchases spend; its committed baseline records rates and medians,
not plans.

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
