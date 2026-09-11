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
import {
  beginBiomeKeepsakeState,
  createKeepsakeState,
  applyTranscendentEmbryoEquipResult,
} from '../keepsakes';
import { attachTraitHistory, createTraitHistoryState, recordAspectStartingTrait } from '../traits';
import { mergeEquivalentRewardBranches, type RewardBranchState } from './branch-primitives';
import type { RewardBranch } from './model';
import { installHexTree, maybeAddGodSent } from '../hex-progress';
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
        Object.freeze({ ...branch, history: beginCurrentRoomRewardHistory(branch.history) }),
        historySequence,
      ),
    ),
  );
}

export function initializeRewardBranches(
  initialBranches?: readonly RewardBranch[],
  initialArcanaFear?: ArcanaFearState,
  catalog?: Catalog,
  startingKeepsakeKey?: string,
  startingKeepsakeEquipResults?: AuthoredKeepsakeEquipResults,
  routeKey?: string,
  loadout?: {
    readonly weaponKey: string;
    readonly aspectKey: string;
    readonly aspectHexTree?: import('../../authored-project/traits').AuthoredHexTreeConfiguration;
  },
): readonly RewardBranchState[] {
  if (initialBranches === undefined) {
    if (
      initialArcanaFear === undefined ||
      catalog === undefined ||
      startingKeepsakeKey === undefined
    )
      throw new Error('initial branch state is required');
    const branch = Object.freeze({
      bags: Object.freeze({}),
      rewardPriorities: Object.freeze([]),
      hexProgress: Object.freeze({ bankedPathPoints: 0, investedPathPoints: 0 }),
      history: createRewardHistoryState(),
      events: Object.freeze([]),
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
      processedThroughHistorySequence: 0,
      traitHistory: createTraitHistoryState(),
      traitEvaluations: Object.freeze([]),
      arcanaFear: initialArcanaFear,
      keepsakes: createKeepsakeState(catalog, startingKeepsakeKey, initialArcanaFear),
    });
    const initialWithHex =
      loadout?.aspectKey === 'SuitHexAspect' && loadout.aspectHexTree !== undefined
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
        createRouteStartKeepsakeSelectionAddress(routeKey ?? 'route'),
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
              createRouteStartKeepsakeSelectionAddress(routeKey ?? 'route'),
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
        createRouteStartKeepsakeSelectionAddress(routeKey ?? 'route'),
        'experimentalHammer',
      ),
      0,
      loadout ?? { weaponKey: '', aspectKey: '' },
    );
    const traitHistory = recordAspectStartingTrait(
      catalog,
      initialized.traitHistory ?? createTraitHistoryState(),
      createRouteStartKeepsakeSelectionAddress(routeKey ?? 'route'),
      loadout ?? { aspectKey: '' },
    );
    const withGodSent = maybeAddGodSent(catalog, initialized);
    return Object.freeze([
      traitHistory === withGodSent.traitHistory
        ? withGodSent
        : Object.freeze({
            ...withGodSent,
            history: attachTraitHistory(withGodSent.history, traitHistory),
            traitHistory,
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
        bags: branch.bags,
        rewardPriorities: branch.rewardPriorities,
        hexProgress: branch.hexProgress,
        history: beginBiomeRewardHistory(branch.history),
        events: Object.freeze([]),
        pendingShops: Object.freeze({}),
        pendingHermesShrineDeliveries: branch.pendingHermesShrineDeliveries ?? Object.freeze({}),
        stygianWell:
          branch.stygianWell ??
          Object.freeze({
            sparkUses: 0,
            yarnUses: 0,
            hymnUses: 0,
            discountUses: Object.freeze([]),
            emptySlotUses: Object.freeze([]),
            extendedUses: 0,
          }),
        processedThroughHistorySequence: 0,
        traitHistory: branch.traitHistory ?? createTraitHistoryState(),
        traitEvaluations: Object.freeze([]),
        arcanaFear: beginBiomeArcanaFearState(branch.arcanaFear),
        keepsakes: beginBiomeKeepsakeState(branch.keepsakes),
      }),
    ),
  );
}

export function publicRewardBranch(branch: RewardBranchState): RewardBranch {
  return Object.freeze({
    bags: branch.bags,
    rewardPriorities: branch.rewardPriorities,
    hexProgress: branch.hexProgress,
    history: branch.history,
    events: branch.events,
    processedThroughHistorySequence: branch.processedThroughHistorySequence,
    ...(branch.traitHistory === undefined ? {} : { traitHistory: branch.traitHistory }),
    arcanaFear: branch.arcanaFear,
    keepsakes: branch.keepsakes,
    ...(Object.keys(branch.pendingHermesShrineDeliveries).length === 0
      ? {}
      : { pendingHermesShrineDeliveries: branch.pendingHermesShrineDeliveries }),
    ...(branch.stygianWell.sparkUses === 0 &&
    branch.stygianWell.yarnUses === 0 &&
    branch.stygianWell.hymnUses === 0 &&
    branch.stygianWell.extendedUses === 0 &&
    branch.stygianWell.discountUses.length === 0 &&
    branch.stygianWell.emptySlotUses.length === 0
      ? {}
      : { stygianWell: branch.stygianWell }),
  });
}
