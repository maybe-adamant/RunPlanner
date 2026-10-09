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
import { applyEchoLionFangReplay, applyEchoMaxStatKeepsakeReplay } from '../../../keepsakes/state';
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
  readonly branches: readonly RewardBranchState[];
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
  branchesBefore: readonly RewardBranchState[],
  biomeStartSequence: number,
): EchoKeepsakeReplayTransition {
  let branches = branchesBefore;
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
  const giftStates = branches.map((branch) => {
    const gift = branch.state.traitHistory.equippedTraits.EchoRepeatKeepsakeBoon;
    return gift?.echoRepeatedKeepsakeKey === undefined || gift.acquisitionIdentity === undefined
      ? undefined
      : Object.freeze({
          capturedKeepsakeKey: gift.echoRepeatedKeepsakeKey,
          acquisitionIdentity: gift.acquisitionIdentity,
          replayCount: gift.echoKeepsakeReplayCount ?? 0,
        });
  });
  if (giftStates.some((state) => JSON.stringify(state) !== JSON.stringify(giftStates[0])))
    throw new BiomeRewardSimulationContractError(
      'Echo keepsake replay frontier is divergent across surviving branches',
    );
  const giftState = giftStates[0];
  if (giftState !== undefined) {
    const declaration = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey];
    if (declaration?.echoGift.availability !== 'eligible')
      throw new BiomeRewardSimulationContractError(
        `Echo captured ineligible keepsake ${giftState.capturedKeepsakeKey}`,
      );
    const replayEffect = declaration.echoGift.effect;
    if (
      replayEffect.kind === 'experimentalHammer' &&
      new Set(branches.map((branch) => branch.state.keepsakes.currentKey)).size !== 1
    )
      throw new BiomeRewardSimulationContractError(
        'Echo Experimental Hammer replay frontier has divergent current keepsakes',
      );
    const recordReplay = (branch: RewardBranchState): RewardBranchState => {
      const before = branch.state.traitHistory;
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
        state: replaceSimulationTraitHistory(branch.state, traitHistory),
      });
    };
    if (replayEffect.kind === 'figLeaf' && giftState.replayCount === 0) {
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            Object.freeze({
              ...branch,
              state: Object.freeze({
                ...branch.state,
                keepsakes: applyEchoFigLeafReplay(branch.state.keepsakes),
              }),
            }),
          ),
        ),
      );
    } else if (replayEffect.kind === 'crystalFigurine') {
      // Echo can recreate the captured keepsake's Common Figurine source at
      // the start of every biome once the previous source has been consumed.
      // The keepsake state owns the no-duplicate and consumed-source rules;
      // this boundary only records the replay event for branches it changes.
      const replayedBranches = branches.map((branch) => {
        const keepsakes = applyEchoFigurineReplay(
          catalog,
          branch.state.keepsakes,
          giftState.capturedKeepsakeKey,
        );
        return keepsakes === branch.state.keepsakes
          ? branch
          : recordReplay(
              Object.freeze({
                ...branch,
                state: Object.freeze({ ...branch.state, keepsakes: keepsakes }),
              }),
            );
      });
      branches = Object.freeze(replayedBranches);
    } else if (replayEffect.kind === 'concaveStone') {
      const replayedBranches = branches.map((branch) => {
        const keepsakes = applyEchoConcaveStoneReplay(
          catalog,
          branch.state.keepsakes,
          giftState.capturedKeepsakeKey,
        );
        return keepsakes === branch.state.keepsakes
          ? branch
          : recordReplay(
              Object.freeze({
                ...branch,
                state: Object.freeze({ ...branch.state, keepsakes: keepsakes }),
              }),
            );
      });
      branches = Object.freeze(replayedBranches);
    } else if (replayEffect.kind === 'olympianRewardPressure') {
      const replayedBranches = branches.map((branch) => {
        const keepsakes = applyEchoOlympianRewardPressureReplay(
          catalog,
          branch.state.keepsakes,
          giftState.capturedKeepsakeKey,
        );
        return keepsakes === branch.state.keepsakes
          ? branch
          : recordReplay(
              applyOlympianRewardPressureEquip(
                catalog,
                Object.freeze({
                  ...branch,
                  state: Object.freeze({ ...branch.state, keepsakes: keepsakes }),
                }),
                giftState.capturedKeepsakeKey,
              ),
            );
      });
      branches = Object.freeze(replayedBranches);
    } else if (
      replayEffect.kind === 'moonBeam' &&
      giftState.replayCount === 0 &&
      branches[0]?.state.keepsakes.currentKey !== giftState.capturedKeepsakeKey
    ) {
      const precedingPostbossWasBigPath =
        routePosition.previousPostbossRoomGameName === 'H_PostBoss01' ||
        routePosition.previousPostbossRoomGameName === 'P_PostBoss01';
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            applyMoonBeamEquip(
              catalog,
              branch,
              giftState.capturedKeepsakeKey,
              'Common',
              precedingPostbossWasBigPath,
            ),
          ),
        ),
      );
    } else if (
      (replayEffect.kind === 'maxManaGrant' || replayEffect.kind === 'maxHealthCap') &&
      giftState.replayCount === 0 &&
      branches[0]?.state.keepsakes.currentKey !== giftState.capturedKeepsakeKey
    ) {
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            Object.freeze({
              ...branch,
              state: Object.freeze({
                ...branch.state,
                keepsakes: applyEchoMaxStatKeepsakeReplay(
                  catalog,
                  branch.state.keepsakes,
                  giftState.capturedKeepsakeKey,
                ),
              }),
            }),
          ),
        ),
      );
    } else if (
      replayEffect.kind === 'transcendentEmbryo' &&
      giftState.replayCount === 0 &&
      branches.every((branch) => branch.state.keepsakes.transcendentEmbryo === undefined)
    ) {
      const effect = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey]?.effect;
      if (effect?.kind !== 'transcendentEmbryo')
        throw new BiomeRewardSimulationContractError(
          'Echo Transcendent Embryo replay has no rank data',
        );
      keepsakeEquipResultCandidates.push({
        key: semanticAddressKey(echoEmbryoResult),
        candidate: Object.freeze({
          frontiers: Object.freeze(
            branches.map((branch) =>
              Object.freeze({
                state: branch.state,
                transcendentEmbryoRarity: effect.blessingRarityByRank.Common,
              }),
            ),
          ),
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
        branches.some(
          (branch) =>
            !assessTranscendentEmbryoBlessing(
              catalog,
              authored,
              branch.state.traitHistory,
              effect.blessingRarityByRank.Common,
              { ...routeLoadout, routeKey: echoEmbryoResult.routeKey },
            ).legal,
        )
      ) {
        addFinding(
          rewardFinding('keepsakeEquipResultUnavailable', echoEmbryoResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
        );
      } else {
        branches = Object.freeze(
          branches.map((branch) =>
            recordReplay(
              applyTranscendentEmbryoEquipResult(
                catalog,
                branch,
                giftState.capturedKeepsakeKey,
                authored,
                echoEmbryoResult,
                biomeStartSequence,
                'echo',
                'Common',
                routeLoadout,
              ),
            ),
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
      branches[0]?.state.keepsakes.currentKey !== giftState.capturedKeepsakeKey
    ) {
      keepsakeEquipResultCandidates.push({
        key: semanticAddressKey(echoHammerResult),
        candidate: Object.freeze({
          frontiers: Object.freeze(
            branches.map((branch) => Object.freeze({ state: branch.state })),
          ),
        }),
      });
      const authored = snapshot.echoKeepsakeReplayResults?.experimentalHammer;
      if (authored === undefined) {
        addFinding(
          rewardFinding('keepsakeEquipResultMissing', echoHammerResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
        );
      } else if (
        branches.some(
          (branch) => !assessExperimentalHammerEquipResult(catalog, authored, branch.state).legal,
        )
      ) {
        addFinding(
          rewardFinding('keepsakeEquipResultUnavailable', echoHammerResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
        );
      } else {
        branches = Object.freeze(
          branches.map((branch) =>
            recordReplay(
              applyExperimentalHammerEquipResult(
                catalog,
                branch,
                giftState.capturedKeepsakeKey,
                snapshot.echoKeepsakeReplayResults,
                echoHammerResult,
                biomeStartSequence,
                'Common',
              ),
            ),
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
      branches = Object.freeze(
        branches.map((branch) => {
          const keepsakes = applyEchoLionFangReplay(
            catalog,
            branch.state.keepsakes,
            giftState.capturedKeepsakeKey,
          );
          return keepsakes === branch.state.keepsakes
            ? branch
            : recordReplay(
                Object.freeze({ ...branch, state: Object.freeze({ ...branch.state, keepsakes }) }),
              );
        }),
      );
    } else if (replayEffect.kind === 'callingCard') {
      const charges = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey]?.effect;
      if (charges?.kind !== 'callingCard')
        throw new BiomeRewardSimulationContractError('Echo Calling Card replay has no rank data');
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            Object.freeze({
              ...branch,
              state: Object.freeze({
                ...branch.state,
                keepsakes: applyEchoCallingCardReplay(
                  branch.state.keepsakes,
                  charges.rarificationChargesByRank.Common,
                ),
              }),
            }),
          ),
        ),
      );
    } else if (replayEffect.kind === 'timePiece') {
      const charges = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey]?.effect;
      if (charges?.kind !== 'timePiece')
        throw new BiomeRewardSimulationContractError('Echo Time Piece replay has no rank data');
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            Object.freeze({
              ...branch,
              state: Object.freeze({
                ...branch.state,
                keepsakes: applyEchoTimePieceReplay(
                  branch.state.keepsakes,
                  charges.conversionChargesByRank.Common,
                ),
              }),
            }),
          ),
        ),
      );
    }
  }
  return Object.freeze({
    branches,
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
