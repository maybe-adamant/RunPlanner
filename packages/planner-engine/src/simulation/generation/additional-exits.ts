import type {
  BiomeDepthCeilingRefusal,
  ChaosGateHostRefusal,
  ChaosGateRefusal,
  RequirementUnmetRefusal,
  RouteExcludedRefusal,
  ZagreusContractRefusal,
} from '../room-feature-refusals';
import type { BiomeLayout, Catalog, RoomDeclaration } from '../../catalog-schema';
import { chaosGateSpawnPointIndices } from '../../authored-project/chaos-gate-position';
import {
  evaluateRequirement,
  type RequirementEvaluationContext,
} from '../../requirements/evaluator';
import type { RequirementExpression } from '../../requirements/model';
import { semanticAddressKey } from '../../authored-project/addresses';
import type { ProgressiveRoomHistoryViews } from '../history';
import { priorHostEntryRooms } from '../history/facts';
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
  assertGenerationRequirement,
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

type ChaosExitDeclaration = Extract<
  RoomDeclaration['additionalExits'][number],
  { readonly kind: 'chaos' }
>;

function chaosExitOf(source: RoomDeclaration | undefined): ChaosExitDeclaration | undefined {
  return source?.additionalExits.find(
    (candidate): candidate is ChaosExitDeclaration =>
      candidate.kind === 'chaos' && candidate.key === 'chaos',
  );
}

/**
 * Why a source room never holds a natural Chaos gate, by declarations alone:
 * it declares no spawnable gate, its map has no `SecretPoint`, or its biome
 * has no Chaos room (or not `targetGameName`).
 */
export function chaosGateHostRefusals(
  layout: BiomeLayout | undefined,
  source: RoomDeclaration | undefined,
  targetGameName?: string,
): readonly ChaosGateHostRefusal[] {
  const declaration = chaosExitOf(source);
  const host = layout?.chaos;
  const refusals: ChaosGateHostRefusal[] = [];
  if (declaration === undefined || !declaration.canSpawn || !declaration.canHost)
    refusals.push(Object.freeze({ reason: 'notHost' as const }));
  if (
    host === undefined ||
    host.roomGameNames.length === 0 ||
    (targetGameName !== undefined && !host.roomGameNames.includes(targetGameName))
  )
    refusals.push(Object.freeze({ reason: 'targetDomain' as const }));
  if (source?.secretPointAnchorCount !== undefined && source.secretPointAnchorCount <= 0)
    refusals.push(Object.freeze({ reason: 'physicalCapability' as const }));
  return Object.freeze(refusals);
}

/** Whether a room in this biome can ever offer a natural Chaos gate, by its declarations. */
export function chaosGateHosted(catalog: Catalog, biomeKey: string, gameName: string): boolean {
  return (
    chaosGateHostRefusals(catalog.biomeLayouts.byKey[biomeKey], catalog.rooms.byKey[gameName])
      .length === 0
  );
}

/** A requirement that reads nothing but the route. */
function routeOnlyRequirement(requirement: RequirementExpression): boolean {
  switch (requirement.kind) {
    case 'routeKeyEquals':
      return true;
    case 'not':
      return routeOnlyRequirement(requirement.requirement);
    case 'all':
    case 'any':
      return requirement.requirements.every(routeOnlyRequirement);
    default:
      return false;
  }
}

/**
 * The rule each failing part of a source's door requirement states: a route
 * the door never opens on (the planner's stand-in for save progression such
 * as `ChaosUnlocked`), a biome-depth ceiling, else the requirement by its
 * game name.
 */
function sourceRequirementRefusals(
  requirement: RequirementExpression,
  context: RequirementEvaluationContext,
  named: RequirementUnmetRefusal['requirement'],
): readonly (RouteExcludedRefusal | BiomeDepthCeilingRefusal | RequirementUnmetRefusal)[] {
  const parts = requirement.kind === 'all' ? requirement.requirements : [requirement];
  const refusals = parts
    .filter((part) => !evaluateRequirement(part, context))
    .map((part) => {
      if (routeOnlyRequirement(part)) return { reason: 'routeExcluded' as const };
      const depth = context.counters.biomeDepthCache;
      if (
        part.kind === 'counterRange' &&
        part.axis === 'biomeDepthCache' &&
        part.range.max !== undefined &&
        depth > part.range.max
      )
        return {
          reason: 'biomeDepthCeiling' as const,
          biomeDepthCache: depth,
          maximumBiomeDepth: part.range.max,
        };
      return { reason: 'requirementUnmet' as const, requirement: named };
    });
  return Object.freeze(
    [...new Map(refusals.map((refusal) => [JSON.stringify(refusal), refusal])).values()].map(
      (refusal) => Object.freeze(refusal),
    ),
  );
}

/**
 * Assess one reached source that hosts natural Chaos gates: its declared
 * requirement and the offer spacing. Authored continuation validation and
 * the candidate artifact use this same helper so the editor cannot expose a
 * source that the normal target evaluator would immediately reject.
 */
export function assessChaosPlacement(
  layout: BiomeLayout,
  source: CanonicalGenerationSource,
  sourceDeclaration: RoomDeclaration,
  parentHistory: ProgressiveRoomHistoryViews | undefined,
  enteredBiomeCount: number,
  rewardFacts?: TargetRewardRequirementFacts,
  initialRewardLookups: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({}),
): ChaosCandidateCapability | undefined {
  if (parentHistory?.entry === undefined) return undefined;
  const declaration = chaosExitOf(sourceDeclaration);
  const refusals: ChaosGateRefusal[] = [];
  if (declaration?.requirement !== undefined) {
    assertGenerationRequirement(declaration.requirement);
    refusals.push(
      ...sourceRequirementRefusals(
        declaration.requirement,
        projectRoomGenerationRequirementContext(
          source,
          sourceDeclaration,
          parentHistory.entry,
          enteredBiomeCount,
          rewardFacts?.history,
          rewardFacts?.pendingSpellDrop,
          rewardFacts?.allSpellInvested,
          rewardFacts?.rewardLookups ?? initialRewardLookups,
        ),
        'SecretDoorRequirements',
      ),
    );
  }
  const window = layout.chaos?.offerSpacingWindow;
  if (window !== undefined) {
    const barred = priorHostEntryRooms(parentHistory.entry.ledgers.roomAppearances, window);
    const recentOrigins = new Set(
      barred.map((appearance) => semanticAddressKey(appearance.origin)),
    );
    const recentOffer = parentHistory.entry.ledgers.roomCreations.find(
      (creation) =>
        creation.source === 'additionalExit' &&
        creation.additionalOrigin.additionalExitKey === 'chaos' &&
        recentOrigins.has(semanticAddressKey(creation.parentOrigin)),
    );
    if (recentOffer !== undefined)
      refusals.push(Object.freeze({ reason: 'offerSpacing' as const, rooms: window - 1 }));
  }
  return Object.freeze({
    placementEligible: refusals.length === 0,
    refusals: Object.freeze(refusals),
  });
}

/** Assess the source requirement and entry-consumed Contract cap at one reached Midshop. */
export function assessZagreusContractPlacement(
  source: CanonicalGenerationSource,
  sourceDeclaration: RoomDeclaration,
  parentHistory: ProgressiveRoomHistoryViews | undefined,
  enteredBiomeCount: number,
  rewardFacts?: TargetRewardRequirementFacts,
  initialRewardLookups: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({}),
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
  const refusals: ZagreusContractRefusal[] = [];
  if (declaration.requirement !== undefined) {
    assertGenerationRequirement(declaration.requirement);
    for (const refusal of sourceRequirementRefusals(
      declaration.requirement,
      projectRoomGenerationRequirementContext(
        source,
        sourceDeclaration,
        parentHistory.entry,
        enteredBiomeCount,
        rewardFacts?.history,
        rewardFacts?.pendingSpellDrop,
        rewardFacts?.allSpellInvested,
        rewardFacts?.rewardLookups ?? initialRewardLookups,
      ),
      'ZagreusContractRequirement',
    ))
      // A Contract door has no biome-depth bound; any other part is its named requirement.
      refusals.push(
        refusal.reason === 'biomeDepthCeiling'
          ? Object.freeze({
              reason: 'requirementUnmet' as const,
              requirement: 'ZagreusContractRequirement' as const,
            })
          : refusal,
      );
  }
  if (enteredContractCount > declaration.maxEnteredThisRoute)
    refusals.push(
      Object.freeze({
        reason: 'capReached' as const,
        per: 'route' as const,
        count: enteredContractCount,
        maximum: declaration.maxEnteredThisRoute,
      }),
    );
  return Object.freeze({
    placementEligible: refusals.length === 0,
    refusals: Object.freeze(refusals),
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
      const refusals: (ChaosGateHostRefusal | ChaosGateRefusal)[] = [];
      if (
        continuation.spawnPointIndex !== undefined &&
        (sourceDeclaration === undefined ||
          !chaosGateSpawnPointIndices(sourceDeclaration).includes(continuation.spawnPointIndex))
      ) {
        appendFinding(
          findings,
          findingRegions,
          finding('targetRoomUnavailable', continuation.origin, {
            kind: 'chaos',
            sourceGameName: source.gameName,
            spawnPointIndex: continuation.spawnPointIndex,
            secretPointAnchorCount: sourceDeclaration?.secretPointAnchorCount ?? 0,
            failedConditions: Object.freeze(['spawnPointIndex']),
          }),
        );
      }
      // A forced gate needs only a declared gate leading to a Chaos room of this biome.
      const hostRefusals = chaosGateHostRefusals(
        layout,
        sourceDeclaration,
        continuation.room.gameName,
      );
      refusals.push(
        ...(forced
          ? hostRefusals.filter(
              (refusal) =>
                refusal.reason === 'targetDomain' ||
                (refusal.reason === 'notHost' && chaosExitOf(sourceDeclaration) === undefined),
            )
          : hostRefusals),
      );
      if (!forced && sourceDeclaration !== undefined) {
        const capability = assessChaosPlacement(
          layout,
          source,
          sourceDeclaration,
          parentHistory,
          enteredBiomeCount,
          rewardFactsBySource.get(semanticAddressKey(parentOrigin)),
          initialRewardLookups,
        );
        refusals.push(...(capability?.refusals ?? []));
      }
      const window = forced ? undefined : layout.chaos?.offerSpacingWindow;
      if (refusals.length > 0) {
        appendFinding(
          findings,
          findingRegions,
          finding('targetRoomUnavailable', continuation.origin, {
            kind: continuation.key,
            sourceGameName: source.gameName,
            chaosRoomGameName: continuation.room.gameName,
            offerSpacingWindow: window ?? null,
            refusals: Object.freeze(refusals),
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
    const contractCapability = assessZagreusContractPlacement(
      source,
      sourceDeclaration,
      parentHistory,
      enteredBiomeCount,
      rewardFactsBySource.get(semanticAddressKey(parentOrigin)),
      initialRewardLookups,
    );
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
          refusals: contractCapability.refusals,
        }),
      );
    }
  }
}
