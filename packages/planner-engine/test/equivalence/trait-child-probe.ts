import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';

import type { BiomeRewardEvaluationAssembly } from '../../src/simulation/rewards/biome/publication';

/** Every biome chronology product evaluated since the last reset, in call order. */
const recorded: BiomeRewardEvaluationAssembly[] = [];

export function recordChronology(assembly: BiomeRewardEvaluationAssembly): void {
  recorded.push(assembly);
}

export function resetChronologyRecording(): void {
  recorded.length = 0;
}

function addressesIn(product: unknown): readonly SemanticAddress[] {
  const found = new Map<string, SemanticAddress>();
  const seen = new Set<object>();
  const walk = (value: unknown) => {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (
      typeof (value as { readonly kind?: unknown }).kind === 'string' &&
      'routeKey' in value &&
      'biomeKey' in value
    ) {
      try {
        const address = value as SemanticAddress;
        found.set(semanticAddressKey(address), address);
      } catch {
        // A product record that only resembles an address carries no checkpoint.
      }
    }
    for (const child of Object.values(value)) walk(child);
  };
  walk(product);
  return [...found.entries()].sort(([left], [right]) => (left < right ? -1 : 1)).map(([, a]) => a);
}

/**
 * The trait-child settlement checkpoints of every recorded chronology call:
 * per settled child, its branch count and the owners of its attached Run
 * State snapshots in attachment order.
 */
export function traitChildSettlementRecords(): readonly unknown[] {
  return recorded.map((assembly) => ({
    biomeKey: assembly.simulation.biomeKey,
    children: addressesIn(assembly.simulation).flatMap((address) => {
      const settlement = assembly.traitChildSettlementCheckpoints.at(address);
      return settlement === undefined
        ? []
        : [
            {
              child: semanticAddressKey(address),
              branchCount: settlement.branches.length,
              snapshotOwners: settlement.runStateSnapshots.map((snapshot) =>
                semanticAddressKey(snapshot.owner),
              ),
            },
          ];
    }),
  }));
}
