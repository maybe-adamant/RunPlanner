import { describe, expect, it } from 'vitest';
import { buildExecutionFixture, executionFixtures } from './support/execution-fixtures';

function fixture(name: string) {
  const entry = executionFixtures.find((candidate) => candidate.name === name);
  if (entry === undefined) throw new Error(`missing execution fixture ${name}`);
  return entry;
}

describe('execution obligations', () => {
  it('owes optional World Shop work only before leaving and required work before the exit unlocks', async () => {
    const { plan } = await buildExecutionFixture(fixture('surface-travel-deal-refill-anvil'));
    const checkpointsByKind = new Map<string, Set<string>>();
    for (const occurrence of plan.occurrences) {
      if (!('timeline' in occurrence) || occurrence.timeline === undefined) continue;
      const kindByOwner = new Map(
        occurrence.timeline.transactions.map((transaction) => [
          transaction.owner,
          transaction.kind,
        ]),
      );
      for (const obligation of occurrence.timeline.obligations) {
        const kind = kindByOwner.get(obligation.owner)!;
        const checkpoints = checkpointsByKind.get(kind) ?? new Set<string>();
        checkpoints.add(obligation.checkpoint);
        checkpointsByKind.set(kind, checkpoints);
      }
    }
    // Anvil transformations and Travel Deal refills follow optional Preboss Shop purchases.
    expect([...(checkpointsByKind.get('transformation') ?? [])]).toEqual(['roomExit']);
    expect([...(checkpointsByKind.get('travelDealRefill') ?? [])]).toEqual(['roomExit']);
    // The required fountain use still gates the exit.
    expect([...(checkpointsByKind.get('fountainUse') ?? [])]).toEqual(['exitUsable']);
  });
});
