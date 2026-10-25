# Draft Filler Priority

Status: locked 2026-10-25. Base commit: `ee72925dc`.

## Objective

Let the player rank the non-boon rewards a draft takes when no boon target is
served. Today every filler reward weighs 1 and is picked at random, a god with
nothing left to give still outweighs any filler, and Shops never buy filler.

## Model

1. **Filler kinds.** Four kinds, each covering all its variants: Max Health,
   Max Magick, Gold, and Pom (Pom of Power variants and Pom Slice). Before
   coding, the executor lists the exact catalog reward types and Shop options
   in each kind from the catalog (in particular whether `Currency` is gold and
   Pom Slice's key) and reports the list; it is confirmed before gate 1 lands.
   Path of Stars and every other filler stay unranked.
2. **Option.** A new Advanced draft option `fillerPriority`: an ordered subset
   of the four kinds, declared in `DRAFT_OPTIONS` with its own share-code tag
   and decoded tolerantly (unknown or repeated kinds dropped). Empty is the
   default and keeps today's behaviour exactly.
3. **Door rewards.** A ranked kind weighs more the higher its rank; unranked
   filler keeps weight 1. The weight enters through `offerWeight`, so door
   choice and Shop slot weights follow it.
4. **Targets met.** Only while the list is non-empty, a god with nothing left
   to take weighs below the top-ranked filler, so a finished basket stops
   pulling useless boons.
5. **Shop filler.** Shop filler is Max Health, Max Magick and Pom from the
   list. Boons are bought first at every Shop. A biome's spare purchases are
   its purchase budget minus purchases already made in it. At a mid-biome Shop
   filler may use spare purchases beyond one, which stays reserved for the
   Preboss Shop; at the Preboss Shop filler may use all of them. Each filler
   buy is a weighted pick from the ranked kinds the Shop offers. The reserve
   counts purchases, not gold; gold legality stays with the simulation.
6. **No schema revision.** The option is a draft-recipe key; no fixture,
   checkpoint or equivalence change.

## Ownership

- **Planner engine:** option declaration and decode, share-code tag, filler
  kind mapping, `offerWeight` rank weights and the idle-god rule, the Shop
  purchase rule (`buyWanted`).
- **Planner application:** the Advanced tab control — the four kinds clicked
  in order with order numbers and the shared gold reset button, like the god
  pool.

## Gates

1. **Engine:** items 1–6, tests at their owners (decode healing in
   `draft-spec.test.ts`, share-code round trip, steering weights, Shop rule).
   Corpus: the baseline must not move with the list empty; add two or three
   corpus specs with a list set and report how often filler is taken at doors
   and in Shops, and the target-met cost if any.
2. **Application:** the Advanced control; owner checks the shape before tests.
3. **Closure:** docs (draft spec option, draft steering), corpus baseline with
   the new specs, delete this plan.

## Non-goals

- Path of Stars, Armor, healing, elements or any other filler kind.
- Gold-aware Shop reserves.
- Changing drafts whose list is empty.
