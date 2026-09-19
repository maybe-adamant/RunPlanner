import type { Catalog } from '../catalog-schema';

export type DreamItineraryIssueKind =
  'tooLong' | 'unknownBiome' | 'initialBiomeRequired' | 'duplicateBiome' | 'naturalSuccessor';

export interface DreamItineraryIssue {
  readonly index: number;
  readonly kind: DreamItineraryIssueKind;
  readonly biomeKey: string;
}

export interface DreamItineraryChoice {
  readonly biomeKey: string;
  readonly legal: boolean;
  readonly reason?: Extract<
    DreamItineraryIssueKind,
    'initialBiomeRequired' | 'duplicateBiome' | 'naturalSuccessor'
  >;
}

/**
 * The one public Dream itinerary policy. It assesses both an in-progress
 * creation prefix and a complete route admitted by the application.
 */
export interface DreamItineraryAssessment {
  readonly biomeCount: number;
  readonly itineraryBiomeKeys: readonly string[];
  readonly complete: boolean;
  readonly legal: boolean;
  readonly issues: readonly DreamItineraryIssue[];
  /** Next-choice domain for a valid incomplete prefix; empty when full or invalid. */
  readonly nextChoices: readonly DreamItineraryChoice[];
}

export function assessPublicDreamItinerary(
  catalog: Catalog,
  itineraryBiomeKeys: readonly string[],
): DreamItineraryAssessment {
  const route = catalog.routes.byKey.Dream;
  const declaration = route?.dreamItinerary;
  if (route === undefined || declaration === undefined) {
    throw new Error('catalog has no Dream itinerary declaration');
  }
  const issues: DreamItineraryIssue[] = [];
  const selected = new Set<string>();
  const allowedBiomeKeys = new Set([
    ...declaration.initialBiomeKeys,
    ...declaration.laterAdditionalBiomeKeys,
  ]);
  itineraryBiomeKeys.forEach((biomeKey, index) => {
    if (index >= declaration.biomeCount) {
      issues.push({ index, kind: 'tooLong', biomeKey });
      return;
    }
    if (!allowedBiomeKeys.has(biomeKey)) {
      issues.push({ index, kind: 'unknownBiome', biomeKey });
      return;
    }
    if (index === 0 && !declaration.initialBiomeKeys.includes(biomeKey)) {
      issues.push({ index, kind: 'initialBiomeRequired', biomeKey });
    }
    if (selected.has(biomeKey)) {
      issues.push({ index, kind: 'duplicateBiome', biomeKey });
    }
    const previousBiomeKey = itineraryBiomeKeys[index - 1];
    if (
      previousBiomeKey !== undefined &&
      declaration.naturalSuccessorByBiomeKey[previousBiomeKey] === biomeKey
    ) {
      issues.push({ index, kind: 'naturalSuccessor', biomeKey });
    }
    selected.add(biomeKey);
  });
  const prefixComplete = itineraryBiomeKeys.length >= declaration.biomeCount;
  const candidateKeys = [...allowedBiomeKeys];
  const previousBiomeKey = itineraryBiomeKeys.at(-1);
  const nextChoices =
    prefixComplete || issues.length > 0
      ? []
      : candidateKeys.map((biomeKey) => {
          if (itineraryBiomeKeys.length === 0 && !declaration.initialBiomeKeys.includes(biomeKey)) {
            return Object.freeze({
              biomeKey,
              legal: false,
              reason: 'initialBiomeRequired' as const,
            });
          }
          if (selected.has(biomeKey)) {
            return Object.freeze({ biomeKey, legal: false, reason: 'duplicateBiome' as const });
          }
          if (
            previousBiomeKey !== undefined &&
            declaration.naturalSuccessorByBiomeKey[previousBiomeKey] === biomeKey
          ) {
            return Object.freeze({ biomeKey, legal: false, reason: 'naturalSuccessor' as const });
          }
          return Object.freeze({ biomeKey, legal: true });
        });
  return Object.freeze({
    biomeCount: declaration.biomeCount,
    itineraryBiomeKeys: Object.freeze([...itineraryBiomeKeys]),
    complete: itineraryBiomeKeys.length === declaration.biomeCount,
    legal: itineraryBiomeKeys.length === declaration.biomeCount && issues.length === 0,
    issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    nextChoices: Object.freeze(nextChoices),
  });
}
