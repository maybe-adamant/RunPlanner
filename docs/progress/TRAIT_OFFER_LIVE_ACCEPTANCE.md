# Trait offer generation-time live acceptance

## Status

Pending live acceptance, 2026-09-25. Automated closure of generation-time
trait offer evaluation and the Rejected three-option rule preceded in-game
verification. Source reading and engine tests do not establish these
obligations; do not record an in-game pass from a source probe.

The owner confirms each item from a live run in which no published plan
installs the observed screen, so the native offer is what appears, and
compares it with the planner's evaluation of the same authored route.
Delete this file once every item is confirmed and the follow-up below is
tracked elsewhere or done, or when the owner explicitly waives the remainder.

"Creation" below is the Chaos blessing that adds elements; "Favor" is the
Chaos blessing that adds rarity bonus. Either works for items that name one.

## Obligations

- [ ] **Fields, silent maturation.** Setup: a Chaos curse one encounter from
      maturing into Creation, entering a Fields room with a magick cage and a
      boon cage. Action: clear the magick cage first (the curse matures on
      that cage's encounter end), then open the boon. Native: the boon shows no
      Infusion that needs Creation's elements. Planner: such an Infusion in the
      authored boon offer is a trait finding and is absent from candidates.
- [ ] **Fields, rebuild at a screen.** Setup: as above, but cages hammer and
      boon. Action: take the hammer first, then open the boon. Native: the boon
      can show Creation-dependent Infusions. Planner: accepts them.
- [ ] **Fields, deferred regeneration.** Setup: Steady Growth due at the end
      of cage 1; a curse maturing into Creation at the end of cage 2; boon cage
      opened last. Action: clear cages 1 and 2, then open the boon. Native: the
      boon can show Creation-dependent Infusions. Planner: accepts them.
- [ ] **Ordinary room.** Setup: a curse maturing into Favor or Creation on the
      encounter of a boon-reward room. Action: clear the room, open its boon,
      then open the next room's boon. Native: the first boon reflects neither
      the bonus nor the elements; the next boon does. Planner: same split.
- [ ] **Rejected, short screen.** Setup: Rejected active and a god whose
      eligible pool yields only two options. Action: open the boon. Native:
      both rows are selectable, none blocked. Planner: no Rejected row is
      required; either selection completes.
- [ ] **Dream World Shop essence.** Setup: a Dream World Shop with an element
      essence and a god boon. Action: buy the essence, then the boon. Native:
      the boon shows no Infusion that the essence alone would enable.
      Planner: that Infusion is a trait finding and absent from candidates.
- [ ] **Mystery Box after an essence.** Setup: the same Dream shop with a
      Mystery Box instead of a boon. Action: buy the essence, then unwrap the
      box. Native: the hidden boon can show an Infusion the essence enables,
      because its loot is built at unwrap. Planner: accepts it.
- [ ] **Reward Reward Reward.** Setup: last reward a god boon; Echo offering
      Reward Reward Reward alongside a trait that changes eligibility. Action:
      take Reward Reward Reward and open the recreated boon. Native: its
      options reflect the state after the Echo screen closed. Planner:
      evaluates it against that post-screen state. No engine test covers this
      path; it is confirmed live only.

## Deferred follow-up

`traitMutationOccurrenceId` in
`packages/planner-engine/src/simulation/rewards/trait-settlement/coordinator.ts`
and `traitOfferRoomOccurrence` in
`packages/planner-engine/src/simulation/state/pending-trait-offers.ts` both map
a semantic address to its owning occurrence, with different case coverage
(`gorgonPhase`, acquisition entries and sites) and result shapes. Unify them
behind one owner once a timeline-dependency witness pins the cases where they
must agree.
