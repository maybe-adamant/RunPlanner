import type { Catalog } from '../../../../catalog-schema';
import type { ResolvedRoutePosition } from '../../../../authored-project/route-context';
import type { RouteLoadout } from '../../../../authored-project/model';
import {
  createBiomeAddress,
  createEchoKeepsakeReplayAddress,
  createKeepsakeEquipResultAddress,
  semanticAddressKey,
} from '../../../../authored-project/addresses';
import { ownerRegion } from '../../../finding-regions';
import { replaceSimulationTraitHistory } from '../../../state/transitions';
import { foldTraitHistoryEvents } from '../../../traits/history/fold';
import {
  assessExperimentalHammerEquipResult,
  applyEchoFigurineReplay,
  applyEchoConcaveStoneReplay,
  assessTranscendentEmbryoBlessing,
} from '../../../keepsakes/trait-effects';
import { applyEchoFigLeafReplay } from '../../../keepsakes/encounter-effects';
import {
  applyEchoLionFangReplay,
  applyEchoMaxStatKeepsakeReplay,
  applyEchoSilkenSashReplay,
  keepsakeHeld,
} from '../../../keepsakes/state';
import {
  applyEchoCallingCardReplay,
  applyEchoTimePieceReplay,
  applyEchoOlympianRewardPressureReplay,
} from '../../../keepsakes/reward-effects';
import {
  applyExperimentalHammerEquipResult,
  applyOlympianRewardPressureEquip,
  applyMoonBeamEquip,
  applyTranscendentEmbryoEquipResult,
} from '../../../keepsakes/branch-transitions';
import type { KeepsakeEquipResultCandidateCapability } from '../../../keepsakes/candidate-artifacts';
import { EMPTY_PLANNER_TIMELINE_FACTS, type PlannerTimelineFacts } from '../../../timeline-facts';
import type { BiomeRewardSimulation } from '../../model';
import type { RewardBranchState } from '../../branch-primitives';
import { rewardFinding } from '../../findings';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import type { LifecycleFinding } from './types';

export interface EchoKeepsakeReplayTransition {
  readonly branch: RewardBranchState | undefined;
  readonly keepsakeEquipResultCandidates: readonly {
    readonly key: string;
    readonly candidate: KeepsakeEquipResultCandidateCapability;
  }[];
  readonly findings: readonly LifecycleFinding[];
  readonly timelineFacts: PlannerTimelineFacts;
  readonly outcome: BiomeRewardSimulation['volatileEchoKeepsakeReplay'];
}

/**
 * At biome start, Echo replays the keepsake her gift captured. Equip results
 * that need an authored choice publish a candidate and report a missing or
 * unavailable result instead of replaying.
 */
export function applyEchoKeepsakeReplayTransition(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  routePosition: ResolvedRoutePosition,
  routeLoadout: RouteLoadout,
  before: RewardBranchState | undefined,
  biomeStartSequence: number,
): EchoKeepsakeReplayTransition {
  const echoKeepsakeReplay = createEchoKeepsakeReplayAddress(
    createBiomeAddress(snapshot.routeKey, snapshot.biomeKey),
  );
  const echoHammerResult = createKeepsakeEquipResultAddress(
    echoKeepsakeReplay,
    'experimentalHammer',
  );
  const echoEmbryoResult = createKeepsakeEquipResultAddress(
    echoKeepsakeReplay,
    'transcendentEmbryo',
  );
  const keepsakeEquipResultCandidates: {
    readonly key: string;
    readonly candidate: KeepsakeEquipResultCandidateCapability;
  }[] = [];
  const findings: LifecycleFinding[] = [];
  const addFinding = (finding: ReturnType<typeof rewardFinding>): void => {
    findings.push(
      Object.freeze({
        finding,
        region: ownerRegion(echoKeepsakeReplay),
        chronology: Object.freeze({
          kind: 'history' as const,
          sequence: biomeStartSequence,
          boundary: 'at' as const,
        }),
      }),
    );
  };
  let replayed = false;
  let outcome: BiomeRewardSimulation['volatileEchoKeepsakeReplay'];
  let branch = before;
  const gift = before?.state.traitHistory.equippedTraits.EchoRepeatKeepsakeBoon;
  const giftState =
    gift?.echoRepeatedKeepsakeKey === undefined || gift.acquisitionIdentity === undefined
      ? undefined
      : Object.freeze({
          capturedKeepsakeKey: gift.echoRepeatedKeepsakeKey,
          acquisitionIdentity: gift.acquisitionIdentity,
          replayCount: gift.echoKeepsakeReplayCount ?? 0,
        });
  if (before !== undefined && giftState !== undefined) {
    const declaration = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey];
    if (declaration?.echoGift.availability !== 'eligible')
      throw new BiomeRewardSimulationContractError(
        `Echo captured ineligible keepsake ${giftState.capturedKeepsakeKey}`,
      );
    const replayEffect = declaration.echoGift.effect;
    // A held keepsake gets no copy; a held Permanent Calling Card or Time Piece
    // gets Common charges instead (RoomLogic.lua:1218-1242).
    const permanent = replayEffect.kind === 'callingCard' || replayEffect.kind === 'timePiece';
    const held = (branch: RewardBranchState) =>
      keepsakeHeld(catalog, branch.state.keepsakes, giftState.capturedKeepsakeKey);
    const recordReplay = (branch: RewardBranchState): RewardBranchState => {
      const before = branch.state.traitHistory;
      const state =
        permanent && held(branch)
          ? branch.state
          : Object.freeze({
              ...branch.state,
              keepsakes: Object.freeze({
                ...branch.state.keepsakes,
                echoCopyKey: giftState.capturedKeepsakeKey,
              }),
            });
      const traitHistory = foldTraitHistoryEvents(catalog, [
        ...before.events,
        Object.freeze({
          kind: 'echoKeepsakeReplay' as const,
          owner: echoKeepsakeReplay,
          acquisitionRole: 'echoKeepsakeReplay' as const,
          sequence: biomeStartSequence,
          acquisitionPoint: 'biomeStart' as const,
          traitKey: 'EchoRepeatKeepsakeBoon' as const,
          acquisitionIdentity: giftState.acquisitionIdentity,
          capturedKeepsakeKey: giftState.capturedKeepsakeKey,
        }),
      ]);
      return Object.freeze({
        ...branch,
        state: replaceSimulationTraitHistory(state, traitHistory),
      });
    };
    const start = before;
    // A held keepsake other than a Permanent one gets no copy at all.
    const replays = permanent || !held(start);
    /** Applies a keepsake-state replay, recording it only when the state changed. */
    const replayKeepsakes = (
      apply: (
        keepsakes: RewardBranchState['state']['keepsakes'],
      ) => RewardBranchState['state']['keepsakes'],
      equip: (branch: RewardBranchState) => RewardBranchState = (branch) => branch,
    ): RewardBranchState => {
      const keepsakes = apply(start.state.keepsakes);
      return keepsakes === start.state.keepsakes
        ? start
        : recordReplay(
            equip(Object.freeze({ ...start, state: Object.freeze({ ...start.state, keepsakes }) })),
          );
    };
    const withKeepsakes = (keepsakes: RewardBranchState['state']['keepsakes']): RewardBranchState =>
      Object.freeze({ ...start, state: Object.freeze({ ...start.state, keepsakes }) });
    if (!replays) {
      branch = start;
    } else if (replayEffect.kind === 'modeledNeutral') {
      branch = recordReplay(start);
    } else if (replayEffect.kind === 'figLeaf' && giftState.replayCount === 0) {
      branch = recordReplay(withKeepsakes(applyEchoFigLeafReplay(start.state.keepsakes)));
    } else if (replayEffect.kind === 'crystalFigurine') {
      // Echo can recreate the captured keepsake's Common Figurine source at
      // the start of every biome once the previous source has been consumed.
      // The keepsake state owns the no-duplicate and consumed-source rules;
      // this boundary only records the replay event when it changes the state.
      branch = replayKeepsakes((keepsakes) =>
        applyEchoFigurineReplay(catalog, keepsakes, giftState.capturedKeepsakeKey),
      );
    } else if (replayEffect.kind === 'concaveStone') {
      branch = replayKeepsakes((keepsakes) =>
        applyEchoConcaveStoneReplay(catalog, keepsakes, giftState.capturedKeepsakeKey),
      );
    } else if (replayEffect.kind === 'olympianRewardPressure') {
      branch = replayKeepsakes(
        (keepsakes) =>
          applyEchoOlympianRewardPressureReplay(catalog, keepsakes, giftState.capturedKeepsakeKey),
        (changed) =>
          applyOlympianRewardPressureEquip(catalog, changed, giftState.capturedKeepsakeKey),
      );
    } else if (
      replayEffect.kind === 'moonBeam' &&
      giftState.replayCount === 0 &&
      start.state.keepsakes.currentKey !== giftState.capturedKeepsakeKey
    ) {
      const precedingPostbossWasBigPath =
        routePosition.previousPostbossRoomGameName === 'H_PostBoss01' ||
        routePosition.previousPostbossRoomGameName === 'P_PostBoss01';
      branch = recordReplay(
        applyMoonBeamEquip(
          catalog,
          start,
          giftState.capturedKeepsakeKey,
          'Common',
          precedingPostbossWasBigPath,
        ),
      );
    } else if (
      (replayEffect.kind === 'maxManaGrant' || replayEffect.kind === 'maxHealthCap') &&
      giftState.replayCount === 0 &&
      start.state.keepsakes.currentKey !== giftState.capturedKeepsakeKey
    ) {
      branch = recordReplay(
        withKeepsakes(
          applyEchoMaxStatKeepsakeReplay(
            catalog,
            start.state.keepsakes,
            giftState.capturedKeepsakeKey,
          ),
        ),
      );
    } else if (
      replayEffect.kind === 'transcendentEmbryo' &&
      giftState.replayCount === 0 &&
      start.state.keepsakes.transcendentEmbryo === undefined
    ) {
      const effect = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey]?.effect;
      if (effect?.kind !== 'transcendentEmbryo')
        throw new BiomeRewardSimulationContractError(
          'Echo Transcendent Embryo replay has no rank data',
        );
      keepsakeEquipResultCandidates.push({
        key: semanticAddressKey(echoEmbryoResult),
        candidate: Object.freeze({
          state: start.state,
          transcendentEmbryoRarity: effect.blessingRarityByRank.Common,
        }),
      });
      const authored = snapshot.echoKeepsakeReplayResults?.transcendentEmbryo;
      if (authored === undefined) {
        addFinding(
          rewardFinding('keepsakeEquipResultMissing', echoEmbryoResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
        );
      } else if (
        !assessTranscendentEmbryoBlessing(
          catalog,
          authored,
          start.state.traitHistory,
          effect.blessingRarityByRank.Common,
          { ...routeLoadout, routeKey: echoEmbryoResult.routeKey },
        ).legal
      ) {
        addFinding(
          rewardFinding('keepsakeEquipResultUnavailable', echoEmbryoResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
        );
      } else {
        branch = recordReplay(
          applyTranscendentEmbryoEquipResult(
            catalog,
            start,
            giftState.capturedKeepsakeKey,
            authored,
            snapshot.echoKeepsakeReplayResults?.transcendentEmbryoTransformations,
            echoEmbryoResult,
            biomeStartSequence,
            'echo',
            'Common',
            routeLoadout,
          ),
        );
        outcome = Object.freeze({
          capturedKeepsakeKey: giftState.capturedKeepsakeKey,
          result: Object.freeze({
            kind: 'transcendentEmbryo' as const,
            value: Object.freeze({
              blessingKey: authored.blessingKey,
              blessingValues: Object.freeze({ ...authored.blessingValues }),
            }),
          }),
        });
        replayed = true;
      }
    } else if (
      replayEffect.kind === 'experimentalHammer' &&
      giftState.replayCount === 0 &&
      start.state.keepsakes.currentKey !== giftState.capturedKeepsakeKey
    ) {
      keepsakeEquipResultCandidates.push({
        key: semanticAddressKey(echoHammerResult),
        candidate: Object.freeze({ state: start.state }),
      });
      const authored = snapshot.echoKeepsakeReplayResults?.experimentalHammer;
      if (authored === undefined) {
        addFinding(
          rewardFinding('keepsakeEquipResultMissing', echoHammerResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
        );
      } else if (!assessExperimentalHammerEquipResult(catalog, authored, start.state).legal) {
        addFinding(
          rewardFinding('keepsakeEquipResultUnavailable', echoHammerResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
        );
      } else {
        branch = recordReplay(
          applyExperimentalHammerEquipResult(
            catalog,
            start,
            giftState.capturedKeepsakeKey,
            snapshot.echoKeepsakeReplayResults,
            echoHammerResult,
            biomeStartSequence,
            'Common',
          ),
        );
        outcome = Object.freeze({
          capturedKeepsakeKey: giftState.capturedKeepsakeKey,
          result: Object.freeze({
            kind: 'experimentalHammer' as const,
            value: Object.freeze({ ...authored }),
          }),
        });
        replayed = true;
      }
    } else if (replayEffect.kind === 'lionFang') {
      branch = replayKeepsakes((keepsakes) =>
        applyEchoLionFangReplay(catalog, keepsakes, giftState.capturedKeepsakeKey),
      );
    } else if (replayEffect.kind === 'silkenSash') {
      branch = replayKeepsakes((keepsakes) =>
        applyEchoSilkenSashReplay(catalog, keepsakes, giftState.capturedKeepsakeKey),
      );
    } else if (replayEffect.kind === 'callingCard') {
      const charges = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey]?.effect;
      if (charges?.kind !== 'callingCard')
        throw new BiomeRewardSimulationContractError('Echo Calling Card replay has no rank data');
      branch = recordReplay(
        withKeepsakes(
          applyEchoCallingCardReplay(
            start.state.keepsakes,
            charges.rarificationChargesByRank.Common,
          ),
        ),
      );
    } else if (replayEffect.kind === 'timePiece') {
      const charges = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey]?.effect;
      if (charges?.kind !== 'timePiece')
        throw new BiomeRewardSimulationContractError('Echo Time Piece replay has no rank data');
      branch = recordReplay(
        withKeepsakes(
          applyEchoTimePieceReplay(start.state.keepsakes, charges.conversionChargesByRank.Common),
        ),
      );
    }
  }
  return Object.freeze({
    branch,
    keepsakeEquipResultCandidates: Object.freeze(keepsakeEquipResultCandidates),
    findings: Object.freeze(findings),
    timelineFacts: replayed
      ? Object.freeze({
          nodes: Object.freeze([Object.freeze({ owner: echoKeepsakeReplay, included: true })]),
          dependencies: Object.freeze([]),
        })
      : EMPTY_PLANNER_TIMELINE_FACTS,
    outcome,
  });
}
