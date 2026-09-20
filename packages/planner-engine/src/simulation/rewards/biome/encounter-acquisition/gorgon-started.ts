import type { BoonRarityOverride, Catalog, TraitRarity } from '../../../../catalog-schema';
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
  attestPendingGorgonRarityLevel,
  expirePendingGorgon,
  gorgonSourceRarityOverride,
} from '../../../keepsakes/encounter-effects';
import { deriveBoonRarityLedger } from '../../../traits/rarity';
import {
  boonRarityFactsForOffer,
  offerGenerationAdjustedGiverSource,
} from '../../../traits/offers';

import type { RewardBranchState } from '../../branch-primitives';
import type { GorgonPhaseCandidateSupport } from '../../model';

export interface GorgonStartedTransition {
  readonly branches: readonly RewardBranchState[];
  readonly candidate:
    { readonly key: string; readonly value: GorgonPhaseCandidateSupport } | undefined;
  readonly eligiblePhaseKey: string | undefined;
}

export function resolveGorgonCandidateRarity(inputs: {
  readonly catalog: Catalog;
  readonly branches: readonly RewardBranchState[];
  readonly providerKey: string;
  readonly rarityLevel: NonNullable<GorgonPhaseCandidateSupport['rarityLevel']>;
  readonly roomOverride: BoonRarityOverride | undefined;
}): TraitRarity | undefined {
  const sourceOverride = gorgonSourceRarityOverride(inputs.rarityLevel);
  const suppressTemporaryBoonRarity = inputs.rarityLevel > 1;
  const rarities = inputs.branches.map((branch) => {
    const context = offerGenerationAdjustedGiverSource(
      inputs.catalog,
      branch.state,
      inputs.providerKey,
      {
        resolvedProviderKey: inputs.providerKey,
        boonRarityItemOverride: sourceOverride,
        ...(inputs.roomOverride === undefined
          ? {}
          : { boonRarityRoomOverride: inputs.roomOverride }),
        ...(suppressTemporaryBoonRarity ? { suppressTemporaryBoonRarity: true } : {}),
      },
    );
    const facts = boonRarityFactsForOffer(inputs.catalog, branch.state, context);
    return (
      context.freshRarityOverride ??
      (facts === undefined
        ? undefined
        : deriveBoonRarityLedger(facts, ['Common', 'Rare', 'Epic', 'Heroic'])
            .possibleFreshRarities[0])
    );
  });
  const first = rarities[0];
  if (rarities.some((rarity) => rarity !== first))
    throw new Error('Gorgon rarity frontier is divergent');
  return first;
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
  const rarityLevel = attestPendingGorgonRarityLevel(inputs.branches);
  const definition = catalog.encounterDefinitions.byKey[event.encounterKey]!;
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
    definition.blocksGorgon === false &&
    definition.hostsGorgon === true &&
    event.execution === 'normal';
  const sourceOverride =
    rarityLevel === undefined ? undefined : gorgonSourceRarityOverride(rarityLevel);
  const rarity =
    effect?.kind !== 'gorgonAmulet' || rarityLevel === undefined
      ? undefined
      : resolveGorgonCandidateRarity({
          catalog,
          branches: inputs.branches,
          providerKey: effect.providerKey,
          rarityLevel,
          roomOverride: declaration.boonRarityOverride,
        });
  const candidate = Object.freeze({
    key: semanticAddressKey(origin),
    value: Object.freeze({
      origin,
      supported,
      ...(rarityLevel === undefined ? {} : { rarityLevel }),
      ...(rarity === undefined ? {} : { rarity }),
      ...(sourceOverride === undefined ? {} : { boonRarityItemOverride: sourceOverride }),
      ...(rarityLevel !== undefined && rarityLevel > 1
        ? { suppressTemporaryBoonRarity: true }
        : {}),
    }),
  });
  if (
    status === 'pending' &&
    effect?.kind === 'gorgonAmulet' &&
    event.encounterKey === effect.naturalEncounterKey
  )
    return Object.freeze({
      branches: Object.freeze(
        inputs.branches.map((branch) =>
          Object.freeze({
            ...branch,
            state: Object.freeze({
              ...branch.state,
              keepsakes: expirePendingGorgon(branch.state.keepsakes),
            }),
          }),
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
    encounterBlocked: definition.blocksGorgon === true || definition.hostsGorgon !== true,
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
