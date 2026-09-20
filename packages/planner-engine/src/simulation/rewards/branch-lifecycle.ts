import type { Catalog } from '../../catalog-schema';

import {
  createKeepsakeEquipResultAddress,
  createRouteStartKeepsakeSelectionAddress,
} from '../../authored-project/addresses';
import type { AuthoredKeepsakeEquipResults } from '../../authored-project/model';

import {
  beginBiomeRewardHistory,
  beginCurrentRoomRewardHistory,
  createRewardHistoryState,
} from '../../reward-kernel';

import type { ArcanaFearState } from '../arcana-fear';
import { beginBiomeArcanaFearState } from '../arcana-fear';
import { beginBiomeKeepsakeState, createKeepsakeState } from '../keepsakes/state';
import { applyTranscendentEmbryoEquipResult } from '../keepsakes/branch-transitions';
import { createTraitHistoryState, recordAspectStartingTrait } from '../traits';
import { mergeEquivalentRewardBranches, type RewardBranchState } from './branch-primitives';
import type { RewardBranch } from './model';
import { installHexTree, maybeAddGodSent } from '../hex-progress';
import { createEmptyRewardLookups, type SimulationState } from '../state/model';
import { replaceSimulationTraitHistory } from '../state/transitions';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import type { HistoryStateView } from '../history';
import {
  applyExperimentalHammerEquipResult,
  applyJeweledPomEquipResult,
  applyMoonBeamEquip,
  applyOlympianRewardPressureEquip,
} from '../keepsakes/branch-transitions';

export function advanceRewardBranch(
  branch: RewardBranchState,
  historySequence: number,
): RewardBranchState {
  return branch.processedThroughHistorySequence >= historySequence
    ? branch
    : Object.freeze({ ...branch, processedThroughHistorySequence: historySequence });
}

export function advanceRewardBranches(
  branches: readonly RewardBranchState[],
  historySequence: number,
): readonly RewardBranchState[] {
  return Object.freeze(branches.map((branch) => advanceRewardBranch(branch, historySequence)));
}

export function beginRewardRoom(
  branches: readonly RewardBranchState[],
  historySequence: number,
): readonly RewardBranchState[] {
  return Object.freeze(
    branches.map((branch) =>
      advanceRewardBranch(
        Object.freeze({
          ...branch,
          state: Object.freeze({
            ...branch.state,
            rewardHistory: beginCurrentRoomRewardHistory(branch.state.rewardHistory),
          }),
        }),
        historySequence,
      ),
    ),
  );
}

export function initializeRewardBranches(
  initialBranches: readonly RewardBranch[] | undefined,
  initialArcanaFear: ArcanaFearState | undefined,
  catalog: Catalog,
  startingKeepsakeKey: string,
  startingKeepsakeEquipResults: AuthoredKeepsakeEquipResults | undefined,
  routeKey: string,
  loadout: {
    readonly weaponKey: string;
    readonly aspectKey: string;
    readonly aspectHexTree?: import('../../authored-project/traits/state').AuthoredHexTreeConfiguration;
  },
  reached: {
    readonly routePosition: ResolvedRoutePosition;
    readonly historyView: HistoryStateView;
  },
): readonly RewardBranchState[] {
  if (initialBranches === undefined) {
    if (
      initialArcanaFear === undefined ||
      catalog === undefined ||
      startingKeepsakeKey === undefined
    )
      throw new Error('initial branch state is required');
    const state: SimulationState = Object.freeze({
      equipment: Object.freeze({
        weaponKey: loadout.weaponKey,
        aspectKey: loadout.aspectKey,
      }),
      reached: Object.freeze(reached),
      bags: Object.freeze({}),
      rewardPriorities: Object.freeze([]),
      hexProgress: Object.freeze({ bankedPathPoints: 0, investedPathPoints: 0 }),
      rewardHistory: createRewardHistoryState(),
      traitHistory: createTraitHistoryState(),
      arcanaFear: initialArcanaFear,
      keepsakes: createKeepsakeState(catalog, startingKeepsakeKey, initialArcanaFear),
      pendingShops: Object.freeze({}),
      pendingHermesShrineDeliveries: Object.freeze({}),
      stygianWell: Object.freeze({
        sparkUses: 0,
        yarnUses: 0,
        hymnUses: 0,
        discountUses: Object.freeze([]),
        emptySlotUses: Object.freeze([]),
        extendedUses: 0,
      }),
      rewardLookups: createEmptyRewardLookups(catalog),
    });
    const branch = Object.freeze({
      state,
      events: Object.freeze([]),
      pendingShopContinuations: Object.freeze({}),
      processedThroughHistorySequence: 0,
      traitEvaluations: Object.freeze([]),
    });
    const initialWithHex =
      loadout.aspectKey === 'SuitHexAspect' && loadout.aspectHexTree !== undefined
        ? installHexTree(catalog, branch, 'SpellMoonBeamTrait', loadout.aspectHexTree)
        : branch;
    const pressured = applyMoonBeamEquip(
      catalog,
      applyOlympianRewardPressureEquip(catalog, initialWithHex, startingKeepsakeKey),
      startingKeepsakeKey,
      catalog.keepsakes.byKey[startingKeepsakeKey]?.rank,
    );
    const pomApplied = applyJeweledPomEquipResult(
      catalog,
      pressured,
      startingKeepsakeKey,
      startingKeepsakeEquipResults,
      createKeepsakeEquipResultAddress(
        createRouteStartKeepsakeSelectionAddress(routeKey),
        'jeweledPom',
      ),
      0,
    );
    const embryoApplied =
      startingKeepsakeKey === 'RandomBlessingKeepsake' &&
      startingKeepsakeEquipResults?.transcendentEmbryo !== undefined
        ? applyTranscendentEmbryoEquipResult(
            catalog,
            pomApplied,
            startingKeepsakeKey,
            startingKeepsakeEquipResults.transcendentEmbryo,
            createKeepsakeEquipResultAddress(
              createRouteStartKeepsakeSelectionAddress(routeKey),
              'transcendentEmbryo',
            ),
            0,
            'ordinary',
            catalog.keepsakes.byKey[startingKeepsakeKey]?.rank ?? 'Epic',
            loadout,
          )
        : pomApplied;
    const initialized = applyExperimentalHammerEquipResult(
      catalog,
      embryoApplied,
      startingKeepsakeKey,
      startingKeepsakeEquipResults,
      createKeepsakeEquipResultAddress(
        createRouteStartKeepsakeSelectionAddress(routeKey),
        'experimentalHammer',
      ),
      0,
      loadout,
    );
    const traitHistory = recordAspectStartingTrait(
      catalog,
      initialized.state.traitHistory,
      createRouteStartKeepsakeSelectionAddress(routeKey),
      loadout,
    );
    const withGodSent = maybeAddGodSent(catalog, initialized);
    return Object.freeze([
      traitHistory === withGodSent.state.traitHistory
        ? withGodSent
        : Object.freeze({
            ...withGodSent,
            state: replaceSimulationTraitHistory(withGodSent.state, traitHistory),
          }),
    ]);
  }
  // A completed predecessor publishes every concrete path that reached its
  // frontier. Begin-biome resets can erase the last forward distinction
  // between several of those paths, so canonicalize only after applying every
  // reset. This keeps distinct bags and persistent run state while preventing
  // historical path multiplicity from multiplying the successor chronology.
  return mergeEquivalentRewardBranches(
    initialBranches.map((branch) =>
      Object.freeze({
        state: Object.freeze({
          ...branch.state,
          reached: Object.freeze(reached),
          rewardHistory: beginBiomeRewardHistory(branch.state.rewardHistory),
          pendingShops: Object.freeze({}),
          arcanaFear: beginBiomeArcanaFearState(branch.state.arcanaFear),
          keepsakes: beginBiomeKeepsakeState(branch.state.keepsakes),
        }),
        events: Object.freeze([]),
        pendingShopContinuations: Object.freeze({}),
        processedThroughHistorySequence: 0,
        traitEvaluations: Object.freeze([]),
      }),
    ),
  );
}

export function publicRewardBranch(branch: RewardBranchState): RewardBranch {
  return Object.freeze({
    state: branch.state,
    events: branch.events,
    processedThroughHistorySequence: branch.processedThroughHistorySequence,
  });
}
