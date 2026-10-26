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
/** A clocked pickup producer's inputs at one encounter end. */
export interface TimedEffectContact {
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
  owner: OccurrenceAddress,
  phaseKey: string,
  sequence: number,
  branches: readonly RewardBranchState[],
  advances: boolean,
  deferred = false,
): TimedEffectContact {
  return Object.freeze({
    owner,
    phaseKey,
    sequence,
    deferred,
    cohorts: Object.freeze(
      branches.map((branch) => {
        if (!advances) return Object.freeze([]);
        const history = branch.state.traitHistory;
        return Object.freeze(
          Object.values(history.equippedTraits).flatMap((trait) => {
            const disposition = catalog.traits.byKey[trait.traitKey]?.selectedDisposition;
            if (
              trait.acquisitionIdentity === undefined ||
              disposition?.kind !== 'producePickups' ||
              disposition.clock === undefined
            )
              return [];
            const identity = trait.acquisitionIdentity;
            return [
              Object.freeze({
                source: JSON.stringify([trait.traitKey, sourceIdentity(history, identity)]),
                acquisitionIdentity: identity,
                cycle: history.events.filter(
                  (event) =>
                    event.kind === 'pickupProducerProgress' &&
                    event.acquisitionIdentity === identity &&
                    event.matured,
                ).length,
                progress: trait.pickupProducerProgress ?? 0,
                ...(trait.pickupProducerInterval === undefined
                  ? {}
                  : { interval: trait.pickupProducerInterval }),
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
        .map(({ source, cycle, progress, interval }) => ({ source, cycle, progress, interval }))
        .sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0)),
    ),
  );
  return signatures.every((value) => value === signatures[0])
    ? JSON.stringify([contact.deferred, signatures[0]])
    : undefined;
}
