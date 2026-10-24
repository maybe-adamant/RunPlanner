# Draft Depth Pacing

Status: locked 2026-10-24. Base commit: `bae14574d`.

## Objective

Drafts vary more inside a biome. Today every basket trait due in a biome is
chased from the biome's first room, so short drafts (one or two biomes) take
their traits, and a ready Duo, at the earliest rooms every time. Basket traits
should arrive at varied depths, guided by how much is left to do, accepting a
small rise in misses that rerolls and retries absorb.

## Model

1. **Target depths.** When a biome starts, the walk gives each basket trait due
   in that biome a target depth inside the biome's expected length. Targets are
   spread by the count of traits against the room capacity left, with random
   jitter, so the spacing is guidance rather than a fixed every-N-rooms pattern.
   A Duo gets its target after its prerequisites' targets.
2. **Soft pull.** A god's steering pull for a trait grows smoothly with the
   distance past the trait's target depth: little before it, the existing pull
   around it, more as the biome's end nears. The pull is a weight, not a
   threshold, so a trait can land before its target or slightly after.
3. **Crowding.** When many traits remain for the capacity left, targets
   compress and the pull ramps sooner; a light basket spreads out.
4. **Offers.** A god's room that comes up before its trait's target may still
   take the trait when offered; pacing changes where the walk goes, not what it
   accepts.
5. **Duo.** The 33/66/100 Duo ramp and the final-biome rule are removed; the
   Duo follows the same pacing as any trait.
6. **Randomness** comes from the walk's seeded streams, so a seed redrafts the
   same plan.

## Ownership

Planner engine, `simulation/draft/` only (schedule, steering, walk,
trait-offers). No catalog, schema, share-code or app change.

## Measurement

- The draft corpus: mean god-met, Duo-met and story-met may move only slightly
  (owner: some drafts may fail; the overall average should barely move).
- A diversity witness added to the corpus summary: the spread of the depth at
  which basket traits land within their biome (per spec), before and after.
- Short specs (prefix 1–2) are the main target; long specs should keep today's
  per-biome spread.

## Gates

1. Implement pacing and Duo removal; corpus delta and diversity witness;
   tuning of the jitter and ramp by trial.
2. Closure: tests at the owners, the draft steering doc, delete this plan.

## Non-goals

- New Advanced options for pacing.
- Changing which traits are chosen or their per-god order.
