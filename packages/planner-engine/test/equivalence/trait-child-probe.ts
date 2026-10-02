import {
  createTraitOfferAddress,
  semanticAddressKey,
  type SemanticAddress,
  type TraitOfferOwnerAddress,
} from '@run-planner/engine/authored-project';

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
    // A trait history record names its offer by owner and acquisition role.
    const { owner, acquisitionRole } = value as {
      readonly owner?: unknown;
      readonly acquisitionRole?: unknown;
    };
    if (typeof owner === 'object' && owner !== null && typeof acquisitionRole === 'string') {
      try {
        const address = createTraitOfferAddress(owner as TraitOfferOwnerAddress, acquisitionRole);
        found.set(semanticAddressKey(address), address);
      } catch {
        // Not every owner/role record belongs to a trait offer.
      }
    }
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
    const children =
      value instanceof Map
        ? [...value.keys(), ...value.values()]
        : value instanceof Set
          ? [...value]
          : Object.values(value);
    for (const child of children) walk(child);
  };
  walk(product);
  return [...found.entries()].sort(([left], [right]) => (left < right ? -1 : 1)).map(([, a]) => a);
}

/**
 * The trait-child settlement checkpoints of every recorded chronology call:
 * per settled child, its branch count and the owners of its attached Run
 * State snapshots in attachment order. Children are looked up by every
 * address in the recorded products and the project evaluation.
 */
export function traitChildSettlementRecords(evaluation: unknown): readonly unknown[] {
  const evaluationAddresses = addressesIn(evaluation);
  return recorded.map((assembly) => ({
    biomeKey: assembly.simulation.biomeKey,
    children: addressesIn([
      assembly.simulation,
      assembly.findingRegions,
      evaluationAddresses,
    ]).flatMap((address) => {
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
