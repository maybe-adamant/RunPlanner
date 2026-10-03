import type { Catalog } from '../../../catalog-schema';
import { semanticAddressKey, type OccurrenceAddress } from '../../../authored-project/addresses';
import type { RewardBranchState } from '../branch-primitives';
import type { TraitHistoryState } from '../../traits/history/model';

export interface TimedEffectSourceContact {
  readonly source: string;
  readonly acquisitionIdentity?: string;
  readonly cycle: number;
  readonly progress: number;
  readonly interval?: number;
}
export interface TimedEffectContact {
  readonly effect: 'steadyGrowth' | 'transcendentEmbryo' | 'clockedPickup';
  readonly owner: OccurrenceAddress;
  readonly phaseKey: string;
  readonly sequence: number;
  readonly deferred: boolean;
  /** Every input cohort participates, including those without an equipped source. */
  readonly cohorts: readonly (readonly TimedEffectSourceContact[])[];
}

function sourceIdentity(history: TraitHistoryState, identity: string): string {
  const acquisitions = history.events.filter(
    (event) =>
      event.kind === 'traitOffer' ||
      event.kind === 'concaveStoneSecondary' ||
      event.kind === 'directChaosBlessing',
  );
  const index = acquisitions.findIndex((event) => event.acquisitionIdentity === identity);
  const event = acquisitions[index];
  if (event === undefined) return identity;
  const owner = semanticAddressKey(event.owner);
  const ordinal = acquisitions
    .slice(0, index)
    .filter(
      (prior) =>
        semanticAddressKey(prior.owner) === owner &&
        prior.acquisitionRole === event.acquisitionRole,
    ).length;
  return JSON.stringify([owner, event.acquisitionRole, ordinal]);
}

/** Record the actual inputs at an effect owner's advancement seam, without advancing a clock. */
export function timedEffectContact(
  catalog: Catalog,
  effect: TimedEffectContact['effect'],
  owner: OccurrenceAddress,
  phaseKey: string,
  sequence: number,
  branches: readonly RewardBranchState[],
  advances: boolean,
  deferred = false,
): TimedEffectContact {
  return Object.freeze({
    effect,
    owner,
    phaseKey,
    sequence,
    deferred,
    cohorts: Object.freeze(
      branches.map((branch) => {
        if (!advances) return Object.freeze([]);
        const history = branch.state.traitHistory;
        if (effect === 'transcendentEmbryo') {
          const source = branch.state.keepsakes.transcendentEmbryo;
          const equippedAt = history.events.findLastIndex(
            (event) =>
              event.kind === 'directChaosBlessing' &&
              event.acquisitionRole !== 'transcendentEmbryoTransformation',
          );
          const equipped = history.events[equippedAt];
          return Object.freeze(
            source === undefined
              ? []
              : [
                  Object.freeze({
                    source: JSON.stringify([
                      source.origin,
                      source.rarity,
                      sourceIdentity(
                        history,
                        equipped?.kind === 'directChaosBlessing'
                          ? equipped.acquisitionIdentity
                          : source.markedBlessingAcquisitionIdentity,
                      ),
                    ]),
                    cycle: history.events
                      .slice(equippedAt + 1)
                      .filter(
                        (event) =>
                          event.kind === 'directChaosBlessing' &&
                          event.acquisitionRole === 'transcendentEmbryoTransformation',
                      ).length,
                    progress: source.progress,
                  }),
                ],
          );
        }
        return Object.freeze(
          Object.values(history.equippedTraits).flatMap((trait) => {
            const disposition = catalog.traits.byKey[trait.traitKey]?.selectedDisposition;
            if (
              trait.acquisitionIdentity === undefined ||
              (effect === 'steadyGrowth'
                ? disposition?.kind !== 'steadyGrowth'
                : disposition?.kind !== 'producePickups' || disposition.clock === undefined)
            )
              return [];
            const progress =
              (effect === 'steadyGrowth'
                ? trait.steadyGrowthProgress
                : trait.pickupProducerProgress) ?? 0;
            const identity = trait.acquisitionIdentity;
            const events = history.events.filter(
              (event) =>
                (effect === 'steadyGrowth'
                  ? event.kind === 'steadyGrowthProgress'
                  : event.kind === 'pickupProducerProgress') &&
                'acquisitionIdentity' in event &&
                event.acquisitionIdentity === identity,
            );
            return [
              Object.freeze({
                source: JSON.stringify([trait.traitKey, sourceIdentity(history, identity)]),
                acquisitionIdentity: identity,
                cycle: events.filter(
                  (event) =>
                    (event.kind === 'steadyGrowthProgress' && event.newProgress === 0) ||
                    (event.kind === 'pickupProducerProgress' && event.matured),
                ).length,
                progress,
                interval:
                  effect === 'clockedPickup'
                    ? trait.pickupProducerInterval
                    : disposition?.kind === 'steadyGrowth' && trait.rarity !== undefined
                      ? Object.entries(disposition.intervalsByRarity).find(
                          ([rarity]) => rarity === trait.rarity,
                        )?.[1]
                      : undefined,
              }),
            ];
          }),
        );
      }),
    ),
  });
}

/** Mixed cohorts deliberately retain unknown correspondence. */
export function agreedTimedEffectContact(
  contact: TimedEffectContact | undefined,
  acquisitionIdentity?: string,
): string | undefined {
  if (contact === undefined || contact.cohorts.length === 0) return undefined;
  const signatures = contact.cohorts.map((cohort) =>
    JSON.stringify(
      cohort
        .filter(
          (source) =>
            acquisitionIdentity === undefined || source.acquisitionIdentity === acquisitionIdentity,
        )
        .map(({ acquisitionIdentity: _identity, ...source }) => source)
        .sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0)),
    ),
  );
  return signatures.every((value) => value === signatures[0])
    ? JSON.stringify([contact.deferred, signatures[0]])
    : undefined;
}
