# Biome Simulation Cache Plan

Status: locked. Base commit: `42d816649`.

## Objective

Simulating a project reuses each completed biome whose inputs are unchanged,
so an edit re-simulates only the edited biome and the biomes after it. Editor
edits and the planned draft generator both get faster with no change to their
callers. Results are byte-identical to an uncached simulation.

## Current state

- `applyProjectCommand` ends with `decodeProjectDocument(...)`
  (`authored-project/commands/dispatch.ts:383`). The decoder rebuilds every
  biome plan, the route and the loadout (`codec.ts:273-348`), so no authored
  object survives an edit by identity. Undo and Redo keep identity.
- The route walk is `evaluateRouteAssembly` (`simulation/evaluation/project.ts`
  ~107-384). Each biome is `evaluateBiomeAssembly(catalog, routeKey, plan,
context)` (`biome-evaluation.ts:427`), returning a frozen
  `{ evaluation, candidateArtifacts }`.
- Biomes pass a frozen `ProgressiveSeed` (`progressive/biome.ts:77-81`) built
  from the previous biome's history and reward branches.
- A biome also reads `routePosition` (route and itinerary), the loadout,
  `forcedChaosOccurrenceKeys` (route-wide, reads earlier biomes) and the
  resource placements and findings (route-wide, read later biomes too).
- Existing caches sit inside a biome's walk (engine) or above the whole
  project (application); none keys on a biome evaluation.

## Design

- **Identity-preserving decode.** `decodeProjectDocument` returns an
  already-decoded, frozen biome plan unchanged when it was decoded for the
  same catalog and the same starting reward, attested by a WeakSet of decoded
  plans like the existing assembly attestation. The loadout and route are
  reused the same way when unchanged. Commands already share untouched plans,
  so untouched biomes now survive an edit by identity.
- **Biome cache** inside `evaluateRouteAssembly`, in memory per process.
  - First tier, by identity: the predecessor biome's evaluation (or, for the
    first biome, the catalog plus the route-start inputs), in a WeakMap so
    entries die with their predecessor.
  - Second tier: the biome plan by identity, the loadout by identity, the
    route position, the sorted forced-Chaos keys of this biome's occurrences,
    and this biome's slice of the resource placements and findings.
  - It stores the complete frozen `{ evaluation, candidateArtifacts }`.
  - No invalidation to manage: a changed input misses, a miss produces a new
    evaluation, and every later biome then misses on identity.
- The Hub alternative and predecessor-replay paths keep forced Chaos explicit
  in the key so they never collide with the project walk.

## Gates

1. **Identity-preserving decode.** Decoder change, its attestation and tests:
   an edit in one biome keeps every other biome plan, the route and the
   loadout identical; a changed starting reward re-decodes; corpus
   equivalence is unchanged.
2. **Biome cache.** The cache, its key and tests:
   - every corpus project simulates identically with the cache on and off;
   - an edit in biome k reuses biomes before k and re-simulates k onwards;
   - a forced-Chaos or resource change in another biome re-simulates the
     biomes it affects.

   Measure `test:performance:compare`, the route pre-walk cost (resource
   authoring, forced Chaos) separately, and the draft spike walk time.

3. **Closure.** Revise the caching paragraph of
   `SIMULATION_AND_VALIDATION.md` (~98-101), record measurements in the commit
   message, and retire this plan.

## Primary tests

- Engine: decoder identity tests at the codec owner; cache on and off
  equivalence over the corpus; reuse and miss cases per key part.
- `npm run test:equivalence` stays byte-identical.

## Non-goals

- Reusing biomes after an edited one when its end state is unchanged (needs a
  state digest).
- Caching the route pre-walk, unless measurement shows it dominates.
- Cross-session or on-disk caching.
