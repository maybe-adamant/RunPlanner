# Rerolls, Contract pedestal and Ephyra return door live acceptance

Requires a current planner and an installed game module of the same schema
pair, and a complete-valid plan sent and set to play next. Door, wheel, cage
and Hub rerolls need The Enchantress equipped; screen, Well and Pool rerolls
need The Champions; The Fates adds rerolls to the pool. Automated protocol and
hook coverage is not live verification; the owner confirms or waives each
check.

## Reroll pool

- [ ] Start a run whose plan spends rerolls. On entering the first room, and
      on every later room entry, `NumRerolls` equals the plan's Run State
      rerolls left, and no `reroll-pool` mismatch is reported.
- [ ] Start the same plan as a Practice start at a later room. The start room
      opens with the plan's rerolls left for that room.

## Door, wheel and cage rerolls

- [ ] Plan a door reroll after a room's doors unlock. Pressing reroll on that
      door shows the planned new reward; entering through it gives that
      reward, and the run stays synchronized.
- [ ] Plan two rerolls of different doors in one room in a set order. Each
      press shows its planned reward; at exit the doors' rewards and the
      stores match the plan.
- [ ] Plan a ship-wheel offer reroll in an O room. Pressing reroll on that
      offer shows the planned reward, picking the wheel acquires the planned
      offer, and the run stays synchronized.
- [ ] After a wheel reroll, reach a later door or wheel that draws from the
      same store. It offers the planned reward, showing the rerolled draw
      consumed its store entry.
- [ ] Plan a reroll of a door into a Fields room, naming one cage. Pressing
      reroll on that door changes the named cage's reward to the planned one;
      the other cages keep theirs.
- [ ] Press reroll on a door the plan does not reroll. The module reports a
      `reroll` mismatch and the game continues natively.

## Hub board rerolls

- [ ] Plan a board-door reroll before the first Hub visit. Pressing reroll on
      that door shows the planned reward, and entering it later gives that
      reward.
- [ ] Plan a board-door reroll in a later Hub stay, after at least one visit.
      On returning to the Hub, the unentered doors show their persisted
      offers; pressing reroll on the planned door shows its planned reward,
      and later stays keep the rerolled reward.

## Stygian Well and Pool of Purging

- [ ] Plan a Well reroll before any purchase, then buy a planned slot of the
      rerolled stock. The reroll shows the planned pinned items, unpinned
      slots show native items, and the purchase acquires the planned item.
- [ ] Plan a Well purchase, then a reroll, then a purchase. After the reroll,
      the slot bought before it stays blank and the other slots show the
      rerolled stock.
- [ ] With Travel Deal held, buy first, then reroll the Well. The first
      purchase's restocked slot is not blanked by the reroll and stays on
      offer.
- [ ] Plan a Pool reroll, then a sale from the rerolled list. The reroll shows
      the planned traits, and the sale removes the planned trait.
- [ ] Reach a Well and a Pool the plan marks present with every initial slot
      blank and no actions. Each shows its native stock, using it is not
      steered, and the run stays synchronized.

## Hermes Shrine delay

- [ ] Plan a Shrine whose three items have different delays, buy one without
      rushing it, and leave the others unbought. The bought item arrives after
      its own planned delay, and the run stays synchronized.
- [ ] At the same Shrine, check each unbought item's shown delay. Every
      stocked item takes its planned delay, the default included, whether
      bought or not.
- [ ] Rush an item whose delay is not the default. It is delivered in the
      Shrine room, ignoring its delay.

## Screen rerolls

- [ ] Plan two rerolls of an Olympian boon screen. The screen opens with the
      first planned earlier screen, the first reroll shows the second, the
      second reroll shows the final rows, and the planned pick is acquired.
- [ ] Repeat with a Chaos screen and a Pom of Power screen. Each screen shows
      its planned rows (Chaos curses; Pom targets) in order, and the final
      pick matches.
- [ ] Plan a reroll of a Fallback Gold screen (for example under Denial). The
      Gold screen shows first and the reroll installs the planned screen; a
      Gold final screen after a rerolled earlier screen also installs.
- [ ] Press reroll once more than the plan on a rerolled screen. The module
      reports a `screen-reroll` mismatch and the game continues natively.

## Contract pedestal

- [ ] Plan a run holding Infernal Contract that reaches an F, G, H or P
      Preboss in its boon form with the pedestal item set. The pedestal spawns
      with the planned item beside the boon; collecting it matches the plan.
- [ ] Reach a Preboss in its Shop form with the pedestal item set. The
      pedestal spawns with the planned item, the Shop keeps its planned
      inventory, and collecting the item does not trigger Travel Deal.

## Ephyra hidden return door

- [ ] Clear an N combat room whose plan pins the hidden return door's
      placeholder and reward. Later side-door and Hub draws from the same
      stores match the plan, showing the hidden draw happened as planned.
- [ ] Clear an N Mini-Boss room whose hidden door's placeholder is an N combat
      room. The draw comes from HubRewards; the next draws match the plan.
- [ ] Clear an N side room whose hidden door draws from the side-room store.
      A later side door from the same store offers the planned reward.
- [ ] If observable, plan a hidden-door draw that consumes a reward priority
      (for example a forced first Boon). The next draw from that store no
      longer takes the priority, as planned.
