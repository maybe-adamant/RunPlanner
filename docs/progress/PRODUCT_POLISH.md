# Product Polish

## Purpose

This is the durable backlog for product correctness and presentation work found
while exercising the planner as a complete application. It preserves concrete
user-facing observations without turning them into design authority or a
temporary implementation plan.

Items are separated by disposition:

- **correctness** means the product cannot express or repair a supported state;
  stop ordinary polish and resolve it first;
- **polish** means the modeled workflow works but its presentation, vocabulary,
  or interaction shape should improve;
- **foundational** means the observation exposes a cross-cutting model decision
  that requires an audit and locked plan before implementation.

Completed work moves to the delivery record in `IMPLEMENTATION_PROGRESS.md`.
This file retains only enough completed context to explain the active backlog.

## Correctness Queue

No confirmed correctness defect is currently queued. If a supported product
stops working, pause the presentation backlog and address that defect first.

The unresolved reward-and-trait program is no longer a polish-queue item.
[`AUTHORED_REWARD_AND_TRAIT_DEFAULTS_AUDIT.md`](../audits/AUTHORED_REWARD_AND_TRAIT_DEFAULTS_AUDIT.md)
owns the durable decision, while
[`UNRESOLVED_REWARD_AND_TRAIT_AUTHORING_IMPLEMENTATION.md`](UNRESOLVED_REWARD_AND_TRAIT_AUTHORING_IMPLEMENTATION.md)
owns the remaining Gate C documentation and deletion closure. Shared reward
authorship landed in schema 42, and encounter-owned generated trait authorship
landed in schema 43. That closure is delivery work rather than a competing
polish slice.

## Presentation and Interaction Backlog

No previously recorded presentation item remains queued. New observations may
start a fresh polish iteration without inheriting already-resolved contact
points.

## Recently Completed Correctness

- Starting manual Arcana now obey the 30-Grasp baseline and Vow of Void's exact
  30/18/12/6/0 capacities. The restriction applies only to the initial board;
  Judgment, Circe, and other run-local activation remain outside the starting
  cap.
- Progressive reward projection now retains the exact acquisition-conversion
  frontier needed to author Artificer or Time Piece on supported minor pickups,
  including zero-target Nectar and blocked nested Pom cases.
- Authorable rewards, generated acquisition-trait children, Artificer
  replacements, and immediate Jeweled Pom / Experimental Hammer results now
  begin unresolved instead of installing catalog-first choices. Encounter and
  Gorgon trait results use the same unresolved-or-complete contract while
  retaining concrete encounter identity.
- The exact Forfeit sequence is repaired: an opening forfeited Boon may leave
  its trait child unresolved, and Artificer on the following minor reward still
  exposes and saves Boon, Hermes, and Hammer trait offers. Progressive clamping
  retains the source Artificer capability through the generated child, and
  transient trait drafts persist as complete command-safe values.

## Recently Completed Presentation

- Route Settings now gives Keepsake its own row, aligns Weapon and Aspect on
  the following row, and presents Fear in the game's four-column order with
  Vow of Rivals centered across two columns.
- Reward acquisition controls use player-facing outcome language for ordinary,
  Time Piece, and Artificer choices. A triggered Vow of Forfeit appears in that
  same outcome area as `Removed by Vow of Forfeit`; it remains automatic and
  suppresses the dormant acquisition children rather than exposing a no-op
  trait editor.
- Forfeit's automatic veto now records one reward outcome beside Time Piece
  and Artificer outcomes instead of retaining a separate Arcana/Fear event
  shape. The authored disposition remains the closed selectable
  `normal | timePiece | artificer` domain.
- Run State collapses Keepsakes, Arcana, and Fear by default. Keepsakes present
  the engine's exact biome-by-biome equip chronology and only active retained
  effects; Arcana omits redundant rarity/origin labels; Fear uses one vow per
  row instead of a dense joined sentence.

## Separate Final Feature Frontier

The remaining feature work is governed by the durable source audits for
Stygian Wells, Shrines of Hermes, and natural-resource element successes. Those
features are separate from this polish backlog and should receive their own
locked implementation plan after unresolved-authoring closure and the focused
product-polish disposition.
