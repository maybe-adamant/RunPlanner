import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createPostbossKeepsakeSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  simulateProject,
  startInstallationAt,
  type RunStateSnapshot,
  type StartPoint,
} from '@run-planner/engine/simulation';
import { dreamMixedHandoffProject } from '@run-planner/test-fixtures/dream';
import { surfaceShrineDeliveriesProject } from '@run-planner/test-fixtures/surface';
import {
  createGoldenFGHIProject,
  createGoldenFGHProject,
  goldenFBiome,
} from '@run-planner/test-fixtures/underworld';

import type { KeepsakeRank } from '../../src/catalog-schema';
import {
  advanceCurrentKeepsake,
  applyEchoSilkenSashReplay,
  applyKeepsakeReplacement,
  createKeepsakeState,
  gainSilkenSashDoorArmor,
  keepsakeRankForEquip,
  silkenSashArmorTransferredOnAdvance,
  silkenSashArmorTransferredOnReplacement,
} from '../../src/simulation/keepsakes/state';
import { evaluateBiomeRewardsAssemblyInternal } from '../../src/simulation/rewards/biome';
import { publicRewardBranch } from '../../src/simulation/rewards/branch-lifecycle';
import type { RewardBranch } from '../../src/simulation/rewards/model';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
} from '../../src/simulation/traits';
import {
  createTestArcanaFearState,
  initializeTestRewardBranchesForRoute,
} from '../support/arcana-fear';
import { ordinaryPositionFor } from '../support/route-position';

const sash = 'ArmorGainKeepsake';
const arcanaFear = createTestArcanaFearState();

describe('Silken Sash keepsake state', () => {
  it('starts at 30 and gains its rank’s door armor', () => {
    const start = createKeepsakeState(catalog, sash, arcanaFear);
    expect(start.silkenSash).toEqual({ origin: 'ordinary', rank: 'Epic', currentArmor: 30 });
    expect(gainSilkenSashDoorArmor(catalog, start).silkenSash?.currentArmor).toBe(34);
    const gain = (rank: KeepsakeRank) => {
      const equipped = applyKeepsakeReplacement(
        catalog,
        createKeepsakeState(catalog, 'ManaOverTimeRefundKeepsake', arcanaFear),
        sash,
        arcanaFear,
        rank,
      );
      expect(equipped.silkenSash).toEqual({ origin: 'ordinary', rank, currentArmor: 30 });
      return gainSilkenSashDoorArmor(catalog, equipped).silkenSash!.currentArmor - 30;
    };
    expect((['Common', 'Rare', 'Epic', 'Heroic'] as const).map(gain)).toEqual([2, 3, 4, 6]);
    const none = createKeepsakeState(catalog, 'ManaOverTimeRefundKeepsake', arcanaFear);
    expect(gainSilkenSashDoorArmor(catalog, none)).toBe(none);
  });

  it('transfers the leaving Sash’s armor and keeps an Echo copy across a swap', () => {
    const grown = gainSilkenSashDoorArmor(catalog, createKeepsakeState(catalog, sash, arcanaFear));
    const swapped = applyKeepsakeReplacement(catalog, grown, 'BonusMoneyKeepsake', arcanaFear);
    expect(swapped.silkenSash).toBeUndefined();
    expect(silkenSashArmorTransferredOnReplacement(grown, swapped)).toBe(34);

    const echo = applyEchoSilkenSashReplay(catalog, swapped, sash);
    expect(echo.silkenSash).toEqual({ origin: 'echo', rank: 'Common', currentArmor: 30 });
    const again = applyKeepsakeReplacement(catalog, echo, 'GoldifyKeepsake', arcanaFear);
    expect(again.silkenSash).toEqual(echo.silkenSash);
    expect(silkenSashArmorTransferredOnReplacement(echo, again)).toBe(0);
  });

  it('replays Echo’s Common copy only while no Sash is held', () => {
    const held = createKeepsakeState(catalog, sash, arcanaFear);
    expect(applyEchoSilkenSashReplay(catalog, held, sash)).toBe(held);
  });

  it('equips at Heroic from a rack while Cherished Heirloom is held', () => {
    const cherished = Object.freeze({
      ...createTraitHistoryState(),
      equippedTraits: Object.freeze({
        KeepsakeLevelBoon: Object.freeze({
          traitKey: 'KeepsakeLevelBoon',
          giverKey: 'Demeter',
          providerKind: 'olympian' as const,
          rarity: 'Duo' as const,
          sourceRole: 'selection',
        }),
      }),
    });
    const rank = keepsakeRankForEquip(catalog, sash, cherished);
    expect(rank).toBe('Heroic');
    const equipped = applyKeepsakeReplacement(
      catalog,
      createKeepsakeState(catalog, 'ManaOverTimeRefundKeepsake', arcanaFear),
      sash,
      arcanaFear,
      rank,
    );
    expect(equipped.silkenSash).toEqual({ origin: 'ordinary', rank: 'Heroic', currentArmor: 30 });
    expect(gainSilkenSashDoorArmor(catalog, equipped).silkenSash?.currentArmor).toBe(36);
  });

  it('advances with Cherished Heirloom to Heroic, keeping its armor and reporting the transfer', () => {
    const grown = gainSilkenSashDoorArmor(catalog, createKeepsakeState(catalog, sash, arcanaFear));
    expect(silkenSashArmorTransferredOnAdvance(catalog, grown)).toBe(34);
    const advanced = advanceCurrentKeepsake(catalog, grown, 1);
    expect(advanced.silkenSash).toEqual({ origin: 'ordinary', rank: 'Heroic', currentArmor: 34 });
    expect(gainSilkenSashDoorArmor(catalog, advanced).silkenSash?.currentArmor).toBe(40);

    const echoOnly = applyEchoSilkenSashReplay(
      catalog,
      createKeepsakeState(catalog, 'BonusMoneyKeepsake', arcanaFear),
      sash,
    );
    expect(silkenSashArmorTransferredOnAdvance(catalog, echoOnly)).toBe(0);
    expect(advanceCurrentKeepsake(catalog, echoOnly, 1).silkenSash).toEqual(echoOnly.silkenSash);
  });
});

function withSash(project: ProjectDocument): ProjectDocument {
  const routeKey = project.route?.routeKey;
  if (routeKey === undefined) throw new Error('missing route');
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress(routeKey),
    keepsakeKey: sash,
  });
}

function evaluated(project: ProjectDocument) {
  const evaluation = simulateProject(catalog, project);
  const biome = (biomeKey: string) => {
    const result = evaluation.route.biomes.find((candidate) => candidate.biomeKey === biomeKey);
    if (result?.authoring !== 'complete' || result.validity !== 'valid')
      throw new Error(`${biomeKey} did not evaluate validly`);
    return result;
  };
  const entered = (biomeKey: string, occurrenceId: string): RunStateSnapshot => {
    const snapshot = biome(biomeKey).rewards.runStateSnapshots.find(
      (candidate) =>
        candidate.checkpoint === 'roomEntered' &&
        semanticAddressKey(candidate.owner).includes(`"${occurrenceId}"`),
    );
    if (snapshot === undefined) throw new Error(`${occurrenceId} has no entry Run State`);
    return snapshot;
  };
  const terminal = (biomeKey: string) => biome(biomeKey).rewards.branches.map((b) => b.state);
  return { evaluation, project, biome, entered, terminal };
}

describe('Silken Sash on an authored route', () => {
  const surface = evaluated(withSash(surfaceShrineDeliveriesProject()));

  it('gains on each door into a first visit, never on returns or into the route’s first room', () => {
    const n = surface.biome('N');
    const events = n.history.events;
    const entries = events.filter((event) => event.kind === 'roomEntered');
    expect(events.some((event) => event.kind === 'roomRestored')).toBe(true);
    const firstId = n.snapshot.entryRoom.origin.occurrenceId;
    expect(surface.entered('N', firstId).keepsakes.silkenSash?.currentArmor).toBe(30);
    // Every N entry after the first, and the door into O, gains Epic's 4.
    const [nTerminal] = surface.terminal('N');
    expect(nTerminal!.keepsakes.silkenSash?.currentArmor).toBe(30 + 4 * entries.length);
    const oFirst = surface.biome('O').snapshot.entryRoom.origin.occurrenceId;
    expect(surface.entered('O', oFirst).keepsakes.silkenSash).toEqual(
      nTerminal!.keepsakes.silkenSash,
    );
  });

  it('gains entering a Dream run’s first biome through the Dream_Intro door', () => {
    const dream = evaluated(withSash(dreamMixedHandoffProject()));
    const first = dream.evaluation.route.biomes[0]!;
    const firstId = dream.biome(first.biomeKey).snapshot.entryRoom.origin.occurrenceId;
    expect(dream.entered(first.biomeKey, firstId).keepsakes.silkenSash?.currentArmor).toBe(34);
  });

  it('moves the Sash’s armor into item armor at a rack swap, and starts a racked Sash at 30', () => {
    const rack = createPostbossKeepsakeSelectionAddress(
      createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-preboss-shop:postboss')),
    );
    const swappedAway = evaluated(
      applyProjectCommand(withSash(createGoldenFGHProject()), catalog, {
        kind: 'ReplacePostbossKeepsake',
        selection: rack,
        keepsakeKey: 'BonusMoneyKeepsake',
      }),
    );
    const atRack = swappedAway.entered('F', 'golden-f-preboss-shop:postboss').keepsakes.silkenSash;
    expect(atRack?.currentArmor).toBeGreaterThan(30);
    for (const state of swappedAway.terminal('F')) {
      expect(state.keepsakes.silkenSash).toBeUndefined();
      expect(state.rewardHistory.itemArmor).toBe(atRack!.currentArmor);
    }

    const swappedIn = evaluated(
      applyProjectCommand(createGoldenFGHProject(), catalog, {
        kind: 'ReplacePostbossKeepsake',
        selection: rack,
        keepsakeKey: sash,
      }),
    );
    const gFirst = swappedIn.biome('G').snapshot.entryRoom.origin.occurrenceId;
    expect(swappedIn.entered('G', gFirst).keepsakes.silkenSash).toEqual({
      origin: 'ordinary',
      rank: 'Epic',
      currentArmor: 34,
    });
  });

  it('installs the armor a Practice start enters with at an Opening, Preboss and Boss', () => {
    const golden = evaluated(withSash(createGoldenFGHIProject()));
    const installed = (startPoint: StartPoint) => {
      const result = startInstallationAt(catalog, golden.project, golden.evaluation, startPoint);
      if (result.availability !== 'available') throw new Error(JSON.stringify(result.reason));
      return result.installation;
    };
    const opening = installed({ biomeKey: 'G', kind: 'opening' });
    const gFirst = golden.biome('G').snapshot.entryRoom.origin.occurrenceId;
    expect(opening.keepsake.silkenSash).toEqual(golden.entered('G', gFirst).keepsakes.silkenSash);
    for (const kind of ['preboss', 'boss'] as const) {
      const installation = installed({ biomeKey: 'G', kind });
      const start = installation.startOccurrence;
      if (start?.kind !== 'occurrence') throw new Error(`G ${kind} has no start occurrence`);
      expect(installation.keepsake.silkenSash, kind).toEqual(
        golden.entered('G', start.occurrenceId).keepsakes.silkenSash,
      );
    }
    const boss = installed({ biomeKey: 'G', kind: 'boss' }).keepsake.silkenSash!;
    const preboss = installed({ biomeKey: 'G', kind: 'preboss' }).keepsake.silkenSash!;
    expect(boss.currentArmor - preboss.currentArmor).toBe(4);
    expect(opening.keepsake.held).toContainEqual({ key: sash, rank: 'Epic', slotted: true });
  });
});

describe('Silken Sash at a biome start', () => {
  it('enters the next biome with Echo’s fresh Common copy after the ordinary Sash was racked away', () => {
    const rack = createPostbossKeepsakeSelectionAddress(
      createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-preboss-shop:postboss')),
    );
    const project = applyProjectCommand(withSash(createGoldenFGHProject()), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: rack,
      keepsakeKey: 'GoldifyKeepsake',
    });
    const route = evaluated(project);
    const loadout = project.route!.loadout;
    // Echo's Gift captured the Sash before F.
    const gift = foldTraitHistoryEvents(catalog, [
      Object.freeze({
        kind: 'traitOffer' as const,
        owner: createEncounterPhaseAddress(
          createBiomeAddress('Underworld', 'F'),
          { kind: 'occurrence', occurrenceId: createOccurrenceId('sash-echo-gift') },
          'Encounter',
        ),
        acquisitionRole: 'selection',
        sequence: -1,
        giverKey: 'Echo',
        options: Object.freeze([{ traitKey: 'EchoRepeatKeepsakeBoon' }] as const),
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'encounterCompleted',
        acquisitionIdentity: 'sash-echo-gift',
        echoRepeatedKeepsakeKey: sash,
      }),
    ]);
    const start = initializeTestRewardBranchesForRoute(undefined, arcanaFear, catalog, sash)[0]!;
    const seeded = publicRewardBranch(
      Object.freeze({
        ...start,
        state: Object.freeze({
          ...start.state,
          rewardHistory: attachTraitHistory(start.state.rewardHistory, gift),
          traitHistory: gift,
        }),
      }),
    );
    const replay = (biomeKey: 'F' | 'G', branches: readonly RewardBranch[]) => {
      const biome = route.biome(biomeKey);
      return evaluateBiomeRewardsAssemblyInternal(
        catalog,
        biome.snapshot,
        biome.history,
        ordinaryPositionFor(catalog, biome.snapshot),
        loadout,
        branches,
      ).simulation;
    };
    const f = replay('F', [seeded]);
    const [fTerminal] = f.branches;
    expect(fTerminal!.state.keepsakes.silkenSash).toBeUndefined();
    expect(fTerminal!.state.rewardHistory.itemArmor).toBeGreaterThan(30);
    const g = replay('G', f.branches);
    const gFirst = route.biome('G').snapshot.entryRoom.origin.occurrenceId;
    const entry = g.runStateSnapshots.find(
      (snapshot) =>
        snapshot.checkpoint === 'roomEntered' &&
        semanticAddressKey(snapshot.owner).includes(`"${gFirst}"`),
    );
    expect(entry?.keepsakes.silkenSash).toEqual({
      origin: 'echo',
      rank: 'Common',
      currentArmor: 30,
    });
  });
});
