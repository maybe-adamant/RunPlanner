import type { Catalog } from '../../../../catalog-schema';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  semanticAddressKey,
} from '../../../../authored-project/addresses';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import {
  assessGorgonEligibility,
  attestGorgonBranchState,
  attestPendingGorgonRarity,
  expirePendingGorgon,
} from '../../../keepsakes';
import { selectedEncounterAuthoringProfileKey } from '../../../../authored-project/room-state/encounter-envelope';
import type { RewardBranchState } from '../../branch-primitives';
import type { GorgonPhaseCandidateSupport } from '../../model';

export interface GorgonStartedTransition {
  readonly branches: readonly RewardBranchState[];
  readonly candidate:
    { readonly key: string; readonly value: GorgonPhaseCandidateSupport } | undefined;
  readonly eligiblePhaseKey: string | undefined;
}

/** Evaluates the additive Gorgon appearance after Fig Leaf has settled. */
export function applyGorgonStartedTransition(inputs: {
  readonly catalog: Catalog;
  readonly event: Extract<HistoryEvent, { readonly kind: 'encounterStarted' }>;
  readonly room: CanonicalAuthoredRoom | undefined;
  readonly view: ProgressiveRoomHistoryViews | undefined;
  readonly branches: readonly RewardBranchState[];
  readonly evaluationBlocked: boolean;
}): GorgonStartedTransition {
  const { catalog, event, room, view } = inputs;
  const phase = room?.encounterPhases.find((candidate) => candidate.slotKey === event.phaseKey);
  const declaration = room === undefined ? undefined : catalog.rooms.byKey[room.gameName];
  if (room === undefined || phase === undefined || declaration === undefined || view === undefined)
    return Object.freeze({
      branches: inputs.branches,
      candidate: undefined,
      eligiblePhaseKey: undefined,
    });
  const status = attestGorgonBranchState(inputs.branches);
  const rarity = attestPendingGorgonRarity(inputs.branches);
  const selectedEncounterKey = selectedEncounterAuthoringProfileKey(
    catalog,
    declaration,
    room.encounters,
    event.phaseKey,
    semanticAddressKey(event.origin),
  );
  const effect = catalog.keepsakes.values.find(
    (keepsake) => keepsake.effect?.kind === 'gorgonAmulet',
  )?.effect;
  const origin = createEncounterPhaseAddress(
    createBiomeAddress(event.origin.routeKey, event.origin.biomeKey),
    { kind: 'occurrence', occurrenceId: room.occurrenceId },
    event.phaseKey,
  );
  const supported =
    !inputs.evaluationBlocked &&
    status === 'pending' &&
    effect?.kind === 'gorgonAmulet' &&
    view.preparation.ledgers.counters.biomeDepthCache >= effect.minimumBiomeDepth &&
    declaration.blocksGorgon === false &&
    phase.blocksGorgon === false &&
    selectedEncounterKey !== undefined &&
    catalog.encounterDefinitions.byKey[selectedEncounterKey]?.hostsGorgon === true &&
    event.execution === 'normal';
  const candidate = Object.freeze({
    key: semanticAddressKey(origin),
    value: Object.freeze({
      origin,
      supported,
      ...(rarity === undefined ? {} : { rarity }),
    }),
  });
  if (
    status === 'pending' &&
    effect?.kind === 'gorgonAmulet' &&
    selectedEncounterKey === effect.naturalEncounterKey
  )
    return Object.freeze({
      branches: Object.freeze(
        inputs.branches.map((branch) =>
          Object.freeze({ ...branch, keepsakes: expirePendingGorgon(branch.keepsakes) }),
        ),
      ),
      candidate,
      eligiblePhaseKey: undefined,
    });
  const eligible = assessGorgonEligibility({
    status,
    biomeDepthCache: view.preparation.ledgers.counters.biomeDepthCache,
    minimumBiomeDepth:
      effect?.kind === 'gorgonAmulet' ? effect.minimumBiomeDepth : Number.POSITIVE_INFINITY,
    roomBlocked: declaration.blocksGorgon === true,
    encounterBlocked:
      phase.blocksGorgon === true ||
      selectedEncounterKey === undefined ||
      catalog.encounterDefinitions.byKey[selectedEncounterKey]?.hostsGorgon !== true,
    figLeafSkipped: event.execution === 'skippedByFigLeaf',
    athenaTriggerConditionMet:
      room.encounters.gorgonResultByPhase?.[event.phaseKey]?.athenaTriggerConditionMet === true,
  });
  return Object.freeze({
    branches: inputs.branches,
    candidate,
    eligiblePhaseKey:
      eligible && !inputs.evaluationBlocked
        ? `${semanticAddressKey(event.origin)}::${event.phaseKey}`
        : undefined,
  });
}
