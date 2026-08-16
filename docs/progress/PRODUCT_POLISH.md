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

## Active Foundational Audit

### Unselected authorable rewards and trait offers

The implementation-free
[`AUTHORED_REWARD_AND_TRAIT_DEFAULTS_AUDIT.md`](../audits/AUTHORED_REWARD_AND_TRAIT_DEFAULTS_AUDIT.md)
now covers rewards and generated trait offers together. A separately reviewed
implementation plan is the next step.

Current room and derived-reward construction frequently inserts a complete
concrete default before the player has authored a choice. When that arbitrary
default is context-invalid, simulation may block before publishing the editor,
candidate, or finding destination needed to repair it. The same failure class
has appeared after room-structure changes and in generated reward children.

A concrete reproduction is an F `Combat 08` Ashes pickup changed to Artificer:
the generated replacement silently starts as Apollo, but the route already has
or has banned the relevant Apollo traits. The invalid generated trait child is
retained by simulation, yet workspace projection cannot construct its repair
surface and throws while registering the exact finding destination.

The audit establishes one general unresolved-state distinction for every
authorable reward and generated trait-offer insertion site:

```text
never authored                -> unselected and incomplete
authored, then made invalid   -> selected, retained, and repairable
declaration-fixed game reward -> concrete without player selection
```

The completed audit covers ordinary room rewards, local and Fields pickups,
reward wheels, player-authored Shop inventory, Artificer replacements, Travel
Deal refills, Echo Gold duplicates, Infernal Contract rewards, Echo replay
children, and provider-owned trait offers. It rejects using the first candidate
as implicit authored intent.

## Correctness Queue

No additional confirmed correctness defect is currently queued outside the
foundational reward-default audit. If a supported product stops working, pause
the presentation backlog and address that defect first.

The progressive acquisition frontier correction immediately preceding this
tracker restored Artificer and Time Piece controls for supported Nectar, Ashes,
and Bones pickups even when an ordinary nested Pom child is empty or invalid.
That fix preserves only the exact reached acquisition ancestor; it does not
publish controls beyond the evaluated prefix.

## Presentation and Interaction Backlog

### Route loadout

- Align Weapon and Aspect. Prefer either `Keepsake` followed by
  `Weapon | Aspect`, or one `Keepsake | Weapon | Aspect` row; choose after a
  quick visual comparison rather than preserving the current split alignment.
- Lay out Fear in the same five-row order as the game:

  ```text
  Pain   | Grit   | Ward   | Frenzy
  Hordes | Menace | Return | Fangs
  Scars  | Debt   | Shadow | Forfeit
  Time   | Void   | Hubris | Denial
                Rival
  ```

  Rival is centered and spans two visual slots.

### Acquisition disposition and Forfeit

- Improve the shared ordinary / Time Piece / Artificer presentation. Avoid
  exposing internal `self` and `source` vocabulary; make the source pickup,
  chosen disposition, generated replacement, and later pickup chronology easy
  to read as one workflow.
- Integrate Vow of Forfeit into that same status language. When it triggers,
  show that the reward was removed or transformed into an Onion by Forfeit,
  and suppress trait editing for the vetoed acquisition. Do not present it as a
  selectable disposition because the Vow outcome is automatic.
- Retain exact authored repair controls when an upstream edit makes a formerly
  valid acquisition disposition invalid.

### Run State

- Replace the full active/inactive keepsake inventory with a compact equipped
  keepsake chronology by biome, such as Jeweled Pom followed by Time Piece.
- Remove redundant Arcana `Epic`, `Manual`, and `Automatic` labels where the
  section and board presentation already communicate those facts.
- Add visual separation between Fear vows rather than rendering them as one
  dense line.
- Make Keepsakes, Arcana, and Fear collapsed or inspectable summaries by
  default instead of fully expanding all details.

## Recently Completed Correctness

- Starting manual Arcana now obey the 30-Grasp baseline and Vow of Void's exact
  30/18/12/6/0 capacities. The restriction applies only to the initial board;
  Judgment, Circe, and other run-local activation remain outside the starting
  cap.
- Progressive reward projection now retains the exact acquisition-conversion
  frontier needed to author Artificer or Time Piece on supported minor pickups,
  including zero-target Nectar and blocked nested Pom cases.

## Separate Final Feature Frontier

The remaining feature work is governed by the durable source audits for
Stygian Wells, Shrines of Hermes, and natural-resource element successes. Those
features are separate from this polish backlog and should receive their own
locked implementation plan after the reward-default audit and focused product
polish disposition.
