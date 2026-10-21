# Draft Share Codes

Status: locked 2026-10-21. Base commit: `4ae3e7349`.

## Objective

A player copies a short code from the Draft panel and another player pastes it
to get the same draft inputs. Drafting the pasted inputs gives the same plan,
since the draft is deterministic from its spec, loadout and seed.

## Model

- The code carries what a player authors for a draft: route, configured
  prefix ("Plan up to"), the full loadout (weapon, aspect, keepsake, familiar,
  vows, arcana), the ordered god pool, the ordered basket, NPC picks, Hermes and
  Hammer counts, the Advanced overrides that differ from their defaults, and
  the seed. It carries no attempt number or other generator detail.
- Encoding: positions in catalog-ordered lists, packed into bits, printed as
  base32. Short wins over stability.
- The code starts with its own layout version and a fingerprint hashed from the
  ordered key lists it indexes. A code with another layout version or
  fingerprint is refused with a message, never decoded into other keys.
- The code is generated on the fly and never persisted: no `schemaVersion` or
  `schemaRevision` change and no plan-wire change.
- Pasting replaces the draft spec and the whole loadout as one undoable edit.

## Ownership

- **Planner engine:** the pure codec, in its own module beside the draft spec
  codec, reusing the draft spec and loadout validation. Not part of the project
  codec.
- **Planner application:** copy and paste controls next to Reroll and Draft;
  paste applies the decoded inputs through semantic commands as one history
  entry. Auto-drafting after paste is a later step.

## Gates

1. **Engine codec.** Round-trip tests, wrong-version and wrong-fingerprint
   refusals, and a test that drafting a decoded code yields the original plan.
   `test:engine`.
2. **Application.** Copy and paste next to Reroll and Draft; screenshots for
   owner approval before UI tests; then `test:planner`, `test:product`.
3. **Closure.** Promote the durable rules to the draft design documentation,
   add live checks if any, delete this plan.

## Non-goals

- auto-drafting a pasted code;
- codes that survive catalog list changes;
- sharing whole plans.
