import type { Catalog } from '../../../../catalog-schema';
import {
  createAdditionalExitAddress,
  createBiomeAddress,
  createRoomFeatureAddress,
  createRoomRunStateCheckpointAddress,
  type OccurrenceAddress,
} from '../../../../authored-project/addresses';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { ownerRegion, type FindingChronology } from '../../../finding-regions';
import { createTraitHistoryState } from '../../../traits';
import {
  assessStygianWell,
  assessStygianWellPlacement,
  priorThreeRoomShopPresence,
  type StygianWellCandidateContext,
} from '../../../stygian-well';
import {
  assessHermesShrine,
  assessHermesShrinePlacement,
  priorTwoSurfaceShopPresence,
  type HermesShrineCandidateContext,
} from '../../../hermes-shrine';
import { assessPurgingPool, type PurgingPoolAssessment } from '../../../purging-pool';
import { createRewardFacts, createdPeerGameNames } from '../../facts';
import type { RewardBranchState } from '../../branch-primitives';
import { advanceRewardBranches } from '../../branch-lifecycle';
import { rewardFinding } from '../../findings';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { LifecycleFinding } from './types';

export interface RoomEnteredTransition {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly LifecycleFinding[];
  readonly purgingPoolAssessment?: {
    readonly origin: OccurrenceAddress;
    readonly assessments: readonly PurgingPoolAssessment[];
  };
  readonly hermesShrineAssessment?: {
    readonly origin: OccurrenceAddress;
    readonly assessments: readonly HermesShrineCandidateContext[];
  };
  readonly stygianWellAssessment?: {
    readonly origin: OccurrenceAddress;
    readonly assessments: readonly StygianWellCandidateContext[];
  };
  readonly runStateCheckpoint?: {
    readonly owner: ReturnType<typeof createRoomRunStateCheckpointAddress>;
    readonly room: CanonicalAuthoredRoom;
    readonly view: ProgressiveRoomHistoryViews['entry'];
  };
}

export function applyRoomEnteredTransition(
  catalog: Catalog,
  event: Extract<HistoryEvent, { readonly kind: 'roomEntered' }>,
  room: CanonicalAuthoredRoom | undefined,
  roomView: ProgressiveRoomHistoryViews | undefined,
  chaosGateSourceOccurrenceIds: ReadonlySet<string>,
  ixionGeneratedChaosSourceOccurrenceIds: ReadonlySet<string>,
  branches: readonly RewardBranchState[],
  findingChronology: FindingChronology,
  enteredBiomeCount: number,
  alreadyAssessed: {
    readonly purgingPool: boolean;
    readonly hermesShrine: boolean;
    readonly stygianWell: boolean;
  },
): RoomEnteredTransition {
  let next = advanceRewardBranches(branches, event.sequence);
  const findings: LifecycleFinding[] = [];
  if (room !== undefined) {
    const declaration = catalog.rooms.byKey[room.gameName];
    const chaosDeclaration = declaration?.additionalExits.find(
      (exit) => exit.kind === 'chaos' && exit.canHost,
    );
    const capable = chaosDeclaration !== undefined;
    const chaosGate = chaosGateSourceOccurrenceIds.has(room.occurrenceId);
    const ixionGeneratedChaos = ixionGeneratedChaosSourceOccurrenceIds.has(room.occurrenceId);
    const ixionPending = next.some((branch) => branch.stygianWell.sparkUses > 0);
    const forcedChaos = capable && ixionPending && chaosGate;
    if (capable && ixionPending && !chaosGate)
      findings.push(
        Object.freeze({
          finding: rewardFinding(
            'ixionChaosMissing',
            createAdditionalExitAddress(
              createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
              room.origin.occurrenceId,
              chaosDeclaration!.key,
            ),
            { gameName: room.gameName },
          ),
          region: ownerRegion(room.origin),
          chronology: findingChronology,
        }),
      );
    if (ixionGeneratedChaos && !ixionPending)
      findings.push(
        Object.freeze({
          finding: rewardFinding(
            'ixionChaosUnavailable',
            createAdditionalExitAddress(
              createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
              room.origin.occurrenceId,
              'chaos',
            ),
            { gameName: room.gameName },
          ),
          region: ownerRegion(room.origin),
          chronology: findingChronology,
        }),
      );
    if (forcedChaos)
      next = Object.freeze(
        next.map((branch) =>
          Object.freeze({
            ...branch,
            stygianWell:
              branch.stygianWell.sparkUses === 0
                ? branch.stygianWell
                : Object.freeze({
                    ...branch.stygianWell,
                    sparkUses: branch.stygianWell.sparkUses - 1,
                  }),
          }),
        ),
      );
  }
  if (
    room !== undefined &&
    room.lifecycleProfileKey !== 'ShipCombatRoom' &&
    roomView?.entry === undefined
  )
    throw new BiomeRewardSimulationContractError(
      `${room.gameName} has no room-entry Run State view`,
    );
  const checkpoint =
    room !== undefined && room.lifecycleProfileKey !== 'ShipCombatRoom'
      ? Object.freeze({
          owner: createRoomRunStateCheckpointAddress(room.origin, { kind: 'roomEntered' }),
          room,
          view: roomView!.entry,
        })
      : undefined;
  let purgingPoolAssessment: RoomEnteredTransition['purgingPoolAssessment'];
  let hermesShrineAssessment: RoomEnteredTransition['hermesShrineAssessment'];
  let stygianWellAssessment: RoomEnteredTransition['stygianWellAssessment'];
  if (room !== undefined && room.purgingPool?.interacted === true && !alreadyAssessed.purgingPool) {
    const assessments = Object.freeze(
      next.map((branch) =>
        assessPurgingPool(
          catalog,
          room.purgingPool!,
          (branch.traitHistory ?? createTraitHistoryState()).equippedTraits,
        ),
      ),
    );
    purgingPoolAssessment = Object.freeze({ origin: room.origin, assessments });
    for (const assessment of assessments) {
      for (const finding of assessment.findings)
        findings.push(
          Object.freeze({
            finding: rewardFinding(
              finding.code,
              finding.slotKey === undefined
                ? createRoomFeatureAddress(room.origin, { kind: 'purgingPoolInventory' })
                : createRoomFeatureAddress(room.origin, {
                    kind: 'purgingPoolOffer',
                    slotKey: finding.slotKey,
                  }),
              {
                ...finding.evidence,
                ...(finding.slotKey === undefined ? {} : { slotKey: finding.slotKey }),
              },
            ),
            region: ownerRegion(room.origin),
            chronology: findingChronology,
          }),
        );
    }
  }
  if (room !== undefined && !alreadyAssessed.hermesShrine) {
    const declaration = catalog.rooms.byKey[room.gameName];
    const entry = roomView?.entry;
    if (declaration === undefined || entry === undefined)
      throw new BiomeRewardSimulationContractError(`${room.gameName} has no Shrine entry frontier`);
    if (declaration.surfaceShop !== undefined || room.hermesShrine !== undefined) {
      const priorEnteredShrineFlags = priorTwoSurfaceShopPresence(entry.ledgers.roomAppearances);
      const assessments = Object.freeze(
        next.map((branch) =>
          room.hermesShrine === undefined
            ? Object.freeze({
                placement: assessHermesShrinePlacement(declaration, priorEnteredShrineFlags),
                inventory: undefined,
              })
            : Object.freeze({
                placement: assessHermesShrinePlacement(declaration, priorEnteredShrineFlags),
                inventory: assessHermesShrine(
                  catalog,
                  declaration,
                  room.hermesShrine,
                  createRewardFacts({
                    catalog,
                    currentRoom: room,
                    sourceDeclaration: declaration,
                    view: entry,
                    history: branch.history,
                    enteredBiomeCount,
                    currentBatchRoomGameNames: createdPeerGameNames(
                      catalog,
                      entry,
                      room.origin,
                      'generatedTarget',
                    ),
                    pendingSpellDrop: Object.values(branch.pendingHermesShrineDeliveries).some(
                      (delivery) => delivery.rewardType === 'SpellDrop',
                    ),
                    fail: (detail) => {
                      throw new BiomeRewardSimulationContractError(detail);
                    },
                  }).requirements,
                  priorEnteredShrineFlags,
                ),
              }),
        ),
      );
      hermesShrineAssessment = Object.freeze({ origin: room.origin, assessments });
      for (const assessment of assessments) {
        if (assessment.inventory === undefined && assessment.placement.forced) {
          for (const slotKey of ['first', 'secondLeft', 'secondRight'] as const)
            findings.push(
              Object.freeze({
                finding: rewardFinding(
                  'hermesShrineInventoryMissing',
                  createRoomFeatureAddress(room.origin, {
                    kind: 'hermesShrineOffer',
                    generationKey: `initial:${slotKey}`,
                  }),
                  { slotKey },
                ),
                region: ownerRegion(room.origin),
                chronology: findingChronology,
              }),
            );
        }
        if (assessment.inventory !== undefined && !assessment.placement.eligible)
          findings.push(
            Object.freeze({
              finding: rewardFinding(
                'hermesShrinePlacementUnavailable',
                createRoomFeatureAddress(room.origin, { kind: 'hermesShrinePresence' }),
                { priorShrineCount: assessment.placement.priorShrineCount },
              ),
              region: ownerRegion(room.origin),
              chronology: findingChronology,
            }),
          );
        for (const issue of assessment.inventory?.inventoryIssues ?? []) {
          const code =
            issue.kind === 'missing'
              ? 'hermesShrineInventoryMissing'
              : issue.kind === 'wrongGroup'
                ? 'hermesShrineInventoryWrongGroup'
                : issue.kind === 'duplicateSecondGroup'
                  ? 'hermesShrineInventoryDuplicate'
                  : 'hermesShrineInventoryRequirement';
          findings.push(
            Object.freeze({
              finding: rewardFinding(
                code,
                'slotKey' in issue
                  ? createRoomFeatureAddress(room.origin, {
                      kind: 'hermesShrineOffer',
                      generationKey: `initial:${issue.slotKey}`,
                    })
                  : createRoomFeatureAddress(room.origin, { kind: 'hermesShrineInventory' }),
                'slotKey' in issue ? { slotKey: issue.slotKey } : {},
              ),
              region: ownerRegion(room.origin),
              chronology: findingChronology,
            }),
          );
        }
      }
    }
  }
  if (room !== undefined && !alreadyAssessed.stygianWell) {
    const declaration = catalog.rooms.byKey[room.gameName];
    if (declaration?.roomShop !== undefined || room.stygianWell !== undefined) {
      const entry = roomView?.entry;
      if (entry === undefined)
        throw new BiomeRewardSimulationContractError(`${room.gameName} has no Well entry frontier`);
      const priorEnteredWellFlags = priorThreeRoomShopPresence(entry.ledgers.roomAppearances);
      const firstPurchaseGenerationKey = room.roomActions.order.find(
        (action) => action.kind === 'purchaseStygianWellOffer',
      )?.generationKey;
      const assessments: readonly StygianWellCandidateContext[] = Object.freeze(
        next.map((branch) =>
          room.stygianWell === undefined
            ? Object.freeze({
                placement: assessStygianWellPlacement(declaration, priorEnteredWellFlags),
              })
            : Object.freeze({
                placement: assessStygianWellPlacement(declaration, priorEnteredWellFlags),
                inventory: assessStygianWell(
                  catalog,
                  declaration,
                  room.stygianWell,
                  branch.stygianWell,
                  branch.traitHistory,
                  priorEnteredWellFlags,
                  firstPurchaseGenerationKey,
                  branch.traitHistory?.equippedTraits.RestockBoon !== undefined,
                ),
              }),
        ),
      );
      stygianWellAssessment = Object.freeze({
        origin: room.origin,
        assessments,
      });
      for (const assessment of assessments) {
        if (assessment.inventory !== undefined && !assessment.placement.eligible)
          findings.push(
            Object.freeze({
              finding: rewardFinding(
                'stygianWellPlacementUnavailable',
                createRoomFeatureAddress(room.origin, { kind: 'stygianWellPresence' }),
                { priorWellCount: assessment.placement.priorWellCount },
              ),
              region: ownerRegion(room.origin),
              chronology: findingChronology,
            }),
          );
        for (const issue of assessment.inventory?.issues ?? []) {
          const code =
            issue.kind === 'missing'
              ? 'stygianWellMissing'
              : issue.kind === 'wrongGroup'
                ? 'stygianWellWrongGroup'
                : issue.kind === 'duplicate'
                  ? 'stygianWellDuplicate'
                  : issue.kind.startsWith('refill')
                    ? 'stygianWellTravelDealRefillUnavailable'
                    : 'stygianWellTwistInvalid';
          const origin =
            issue.kind === 'duplicate'
              ? createRoomFeatureAddress(room.origin, { kind: 'stygianWellInventory' })
              : issue.kind.startsWith('refill')
                ? createRoomFeatureAddress(room.origin, {
                    kind: 'stygianWellOffer',
                    generationKey: 'travelDealRefill',
                  })
                : issue.kind.startsWith('twist')
                  ? createRoomFeatureAddress(room.origin, {
                      kind: 'stygianWellTwist',
                      generationKey: issue.generationKey,
                    })
                  : createRoomFeatureAddress(room.origin, {
                      kind: 'stygianWellOffer',
                      generationKey: issue.generationKey,
                    });
          findings.push(
            Object.freeze({
              finding: rewardFinding(code, origin, { reason: issue.kind }),
              region: ownerRegion(room.origin),
              chronology: findingChronology,
            }),
          );
        }
      }
    }
  }
  return Object.freeze({
    branches: next,
    findings: Object.freeze(findings),
    ...(purgingPoolAssessment === undefined ? {} : { purgingPoolAssessment }),
    ...(hermesShrineAssessment === undefined ? {} : { hermesShrineAssessment }),
    ...(stygianWellAssessment === undefined ? {} : { stygianWellAssessment }),
    ...(checkpoint === undefined ? {} : { runStateCheckpoint: checkpoint }),
  });
}
