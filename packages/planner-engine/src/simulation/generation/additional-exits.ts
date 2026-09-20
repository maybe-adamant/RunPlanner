import type { BiomeLayout, Catalog, RoomDeclaration } from '../../catalog-schema';
import { evaluateRequirement } from '../../requirements/evaluator';
import { semanticAddressKey } from '../../authored-project/addresses';
import type { ProgressiveRoomHistoryViews } from '../history';
import type { RoomHistoryOrigin } from '../lifecycle';
import type { CanonicalAdditionalContinuation } from '../materialization';
import type { FindingRegionEntry } from '../finding-regions';
import type { SemanticFinding } from '../model';
import type {
  ChaosCandidateCapability,
  ZagreusContractCandidateCapability,
} from './candidate-artifacts';
import {
  BiomeRoomGenerationContractError,
  appendFinding,
  finding,
  generationDecisions,
  projectRoomGenerationRequirementContext,
} from './target-policy';
import type {
  BiomeGenerationHistory,
  BiomeGenerationSnapshot,
  CanonicalGenerationSource,
  TargetRewardRequirementFacts,
} from './target-policy';

interface AdditionalContinuationEntry {
  readonly continuation: CanonicalAdditionalContinuation;
  readonly parentOrigin: RoomHistoryOrigin;
}

/**
 * Assess one reached Chaos source. Authored continuation validation
 * and the candidate artifact use this same helper so the editor cannot expose
 * a source that the normal target evaluator would immediately reject.
 */
export function assessChaosPlacement(
  catalog: Catalog,
  layout: BiomeLayout,
  source: CanonicalGenerationSource,
  sourceDeclaration: RoomDeclaration,
  parentHistory: ProgressiveRoomHistoryViews | undefined,
  targetGameName: string | undefined,
  enteredBiomeCount: number,
  rewardFacts?: TargetRewardRequirementFacts,
  initialRewardLookups: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({}),
): ChaosCandidateCapability | undefined {
  if (parentHistory?.entry === undefined) return undefined;
  const declaration = sourceDeclaration.additionalExits.find(
    (
      candidate,
    ): candidate is Extract<RoomDeclaration['additionalExits'][number], { kind: 'chaos' }> =>
      candidate.kind === 'chaos' && candidate.key === 'chaos',
  );
  const host = layout.chaos;
  const failedConditions: string[] = [];
  if (declaration === undefined || !declaration.canSpawn || !declaration.canHost)
    failedConditions.push('sourceCapability');
  if (host === undefined || host.roomGameNames.length === 0) failedConditions.push('targetDomain');
  if (
    sourceDeclaration.secretPointAnchorCount !== undefined &&
    sourceDeclaration.secretPointAnchorCount <= 0
  )
    failedConditions.push('physicalCapability');
  if (
    declaration?.requirement !== undefined &&
    !evaluateRequirement(
      declaration.requirement,
      projectRoomGenerationRequirementContext(
        catalog,
        source,
        sourceDeclaration,
        parentHistory.entry,
        enteredBiomeCount,
        rewardFacts?.history,
        rewardFacts?.pendingSpellDrop,
        rewardFacts?.allSpellInvested,
        rewardFacts?.rewardLookups ?? initialRewardLookups,
      ),
    )
  ) {
    failedConditions.push('sourceRequirement');
  }
  const window = host?.offerSpacingWindow;
  if (window !== undefined) {
    const recentOrigins = new Set(
      parentHistory.entry.ledgers.roomAppearances
        .slice(0, -1)
        .slice(-window)
        .map((appearance) => semanticAddressKey(appearance.origin)),
    );
    const recentOffer = parentHistory.entry.ledgers.roomCreations.find(
      (creation) =>
        creation.source === 'additionalExit' &&
        creation.additionalOrigin.additionalExitKey === 'chaos' &&
        recentOrigins.has(semanticAddressKey(creation.parentOrigin)),
    );
    if (recentOffer !== undefined) failedConditions.push('offerSpacing');
  }
  if (targetGameName !== undefined && !host?.roomGameNames.includes(targetGameName)) {
    if (!failedConditions.includes('targetDomain')) failedConditions.push('targetDomain');
  }
  return Object.freeze({
    placementEligible: failedConditions.length === 0,
    failedConditions: Object.freeze(failedConditions),
  });
}

/** Assess the entry-consumed Contract cap at one reached Midshop source. */
export function assessZagreusContractPlacement(
  sourceDeclaration: RoomDeclaration,
  parentHistory: ProgressiveRoomHistoryViews | undefined,
): ZagreusContractCandidateCapability | undefined {
  if (parentHistory?.entry === undefined) return undefined;
  const declaration = sourceDeclaration.additionalExits.find(
    (
      candidate,
    ): candidate is Extract<
      RoomDeclaration['additionalExits'][number],
      { kind: 'zagreusContract' }
    > => candidate.kind === 'zagreusContract' && candidate.key === 'zagreusContract',
  );
  if (declaration === undefined) return undefined;
  const enteredContractCount = parentHistory.entry.ledgers.roomAppearances.filter(
    (appearance) => appearance.gameName === declaration.targetRoomGameName,
  ).length;
  return Object.freeze({
    placementEligible: enteredContractCount <= declaration.maxEnteredThisRoute,
    enteredContractCount,
    maximumEnteredThisRoute: declaration.maxEnteredThisRoute,
  });
}

function additionalContinuationEntries(
  snapshot: BiomeGenerationSnapshot,
): readonly AdditionalContinuationEntry[] {
  const entries = new Map<string, AdditionalContinuationEntry>();
  for (const decision of generationDecisions(snapshot)) {
    if (decision.kind !== 'batch' || decision.parent.origin.kind !== 'occurrence') continue;
    for (const continuation of decision.additional) {
      entries.set(
        semanticAddressKey(continuation.origin),
        Object.freeze({ continuation, parentOrigin: decision.parent.origin }),
      );
    }
  }
  if (snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision') {
    for (const continuation of snapshot.frontier.additional) {
      entries.set(
        semanticAddressKey(continuation.origin),
        Object.freeze({ continuation, parentOrigin: snapshot.frontier.parent.origin }),
      );
    }
  }
  return Object.freeze([...entries.values()]);
}

/**
 * A Zagreus door may exist unpicked indefinitely, but its Midshop creation
 * checkpoint is still where a later door learns whether an earlier entered
 * C_Boss has consumed the route allowance. Use the parent Midshop entry view:
 * it precedes this door's C room and therefore never counts the current
 * selection, while the seeded route history includes every earlier contract.
 */
export function evaluateAdditionalContinuationEntries(
  catalog: Catalog,
  snapshot: BiomeGenerationSnapshot,
  history: BiomeGenerationHistory,
  rooms: ReadonlyMap<string, CanonicalGenerationSource>,
  findings: SemanticFinding[],
  findingRegions: FindingRegionEntry[],
  enteredBiomeCount = 0,
  forcedChaosOccurrenceKeys: ReadonlySet<string> = new Set(),
  rewardFactsBySource: ReadonlyMap<string, TargetRewardRequirementFacts> = new Map(),
  initialRewardLookups: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({}),
): void {
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (layout === undefined) {
    throw new BiomeRoomGenerationContractError(`catalog lost ${snapshot.biomeKey} layout`);
  }
  for (const { continuation, parentOrigin } of additionalContinuationEntries(snapshot)) {
    const source = rooms.get(semanticAddressKey(parentOrigin));
    const sourceDeclaration =
      source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
    const parentHistory = history.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(parentOrigin),
    );
    if (continuation.key === 'chaos') {
      if (source === undefined || parentHistory?.entry === undefined) continue;
      const forced = forcedChaosOccurrenceKeys.has(semanticAddressKey(parentOrigin));
      const declaration = sourceDeclaration?.additionalExits.find(
        (
          candidate,
        ): candidate is Extract<
          (typeof sourceDeclaration.additionalExits)[number],
          { readonly kind: 'chaos' }
        > => candidate.kind === 'chaos' && candidate.key === 'chaos',
      );
      const host = layout.chaos;
      const failedConditions: string[] = [];
      if (declaration === undefined) failedConditions.push('sourceCapability');
      if (host === undefined || !host.roomGameNames.includes(continuation.room.gameName)) {
        failedConditions.push('targetDomain');
      }
      if (!forced && sourceDeclaration !== undefined) {
        const capability = assessChaosPlacement(
          catalog,
          layout,
          source,
          sourceDeclaration,
          parentHistory,
          continuation.room.gameName,
          enteredBiomeCount,
          rewardFactsBySource.get(semanticAddressKey(parentOrigin)),
          initialRewardLookups,
        );
        for (const condition of capability?.failedConditions ?? []) {
          if (!failedConditions.includes(condition)) failedConditions.push(condition);
        }
      }
      const window = forced ? undefined : layout.chaos?.offerSpacingWindow;
      if (failedConditions.length > 0) {
        appendFinding(
          findings,
          findingRegions,
          finding('targetRoomUnavailable', continuation.origin, {
            kind: continuation.key,
            sourceGameName: source.gameName,
            chaosRoomGameName: continuation.room.gameName,
            offerSpacingWindow: window ?? null,
            failedConditions: Object.freeze(failedConditions),
          }),
        );
      }
      continue;
    }
    if (continuation.key !== 'zagreusContract') continue;
    const declaration = sourceDeclaration?.additionalExits.find(
      (
        candidate,
      ): candidate is Extract<
        (typeof sourceDeclaration.additionalExits)[number],
        { readonly kind: 'zagreusContract' }
      > => candidate.kind === 'zagreusContract' && candidate.key === continuation.key,
    );
    if (
      source === undefined ||
      sourceDeclaration === undefined ||
      declaration === undefined ||
      declaration.targetRoomGameName !== continuation.room.gameName
    ) {
      throw new BiomeRoomGenerationContractError(
        `${semanticAddressKey(continuation.origin)} lost its declared Midshop contract source`,
      );
    }
    // An authored later Midshop may be retained beyond an incomplete or
    // invalid prefix. Its declaration remains structurally valid, but its
    // entry-time cap checkpoint is not yet assessable.
    if (parentHistory?.entry === undefined) continue;
    const contractCapability = assessZagreusContractPlacement(sourceDeclaration, parentHistory);
    const priorEnteredContractCount = contractCapability?.enteredContractCount ?? 0;
    if (contractCapability?.placementEligible === false) {
      appendFinding(
        findings,
        findingRegions,
        finding('targetRoomUnavailable', continuation.origin, {
          kind: 'zagreusContract',
          sourceGameName: source.gameName,
          contractRoomGameName: continuation.room.gameName,
          priorEnteredContractCount,
          maximumEnteredThisRoute: declaration.maxEnteredThisRoute,
          failedConditions: Object.freeze(['enteredContractCap']),
        }),
      );
    }
  }
}
