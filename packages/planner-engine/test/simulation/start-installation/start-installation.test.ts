import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import {
  simulateProject,
  startInstallationAt,
  type CompleteValidBiomeProjectEvaluation,
  type StartInstallation,
  type StartPoint,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { dreamMixedHandoffProject } from '@run-planner/test-fixtures/dream';
import {
  loadSurfaceNOPQProject,
  surfaceSeleneHexPathProject,
} from '@run-planner/test-fixtures/surface';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';

import { beginBiomeSimulationState } from '../../../src/simulation/rewards/branch-lifecycle';
import { projectStartInstallation } from '../../../src/simulation/start-installation/projection';
import type { SimulationState } from '../../../src/simulation/state/model';

function evaluated(project: ProjectDocument) {
  const evaluation = simulateProject(catalog, project);
  expect(evaluation.status).toBe('valid');
  const biome = (biomeKey: string) =>
    evaluation.route.biomes.find(
      (candidate): candidate is CompleteValidBiomeProjectEvaluation =>
        candidate.biomeKey === biomeKey,
    )!;
  const install = (startPoint: StartPoint) =>
    startInstallationAt(catalog, project, evaluation, startPoint);
  const installed = (startPoint: StartPoint): StartInstallation => {
    const result = install(startPoint);
    if (result.availability !== 'available') throw new Error(JSON.stringify(result.reason));
    return result.installation;
  };
  return { biome, install, installed };
}

const golden = evaluated(createGoldenFGHIProject());
const dream = evaluated(dreamMixedHandoffProject());

describe('mid-run start installation', () => {
  it('installs an Opening from its predecessor terminal state with post-reset biome records', () => {
    const installation = golden.installed({ biomeKey: 'G', kind: 'opening' });
    const f = golden.biome('F');
    const [terminal] = f.rewards.branches.map((branch) => branch.state);
    expect(Object.keys(terminal!.rewardHistory.biomeUseRecord).length).toBeGreaterThan(0);
    expect(installation).toMatchObject({
      startRoomGameName: 'G_Intro',
      route: { routeKey: 'Underworld', enteredBiomes: 1, visitedBiomeKeys: ['F'] },
      biomeRecords: { form: 'postReset', biomeUseRecord: {}, lootBiomeRecord: {} },
      runRecords: {
        useRecord: terminal!.rewardHistory.useRecord,
        lootTypeHistory: terminal!.rewardHistory.lootTypeHistory,
      },
    });
    expect(installation.startOccurrence).toBeUndefined();
    const counters = f.history.afterTransition.ledgers.counters;
    expect(installation.counters).toMatchObject({
      roomHistoryOrdinal: counters.roomHistoryOrdinal,
      runDepthCache: counters.roomHistoryOrdinal + 1,
      routeEncounterDepth: counters.routeEncounterDepth,
      biomeDepthCache: 0,
      biomeEncounterDepth: 0,
    });
    expect(installation.roomHistory).toHaveLength(counters.roomHistoryOrdinal);
    expect(installation.roomHistory[0]).toEqual({ gameName: 'F_Opening01', nextRoomSet: true });
    expect(installation.roomHistory.at(-1)).toEqual({
      gameName: 'F_PostBoss01',
      nextRoomSet: true,
    });
    expect(installation.roomHistory.filter((record) => record.nextRoomSet)).toHaveLength(2);
    expect(installation.traits.map((trait) => trait.traitKey)).toEqual(
      Object.keys(terminal!.traitHistory.equippedTraits).sort(),
    );
    expect(installation.keepsake).toMatchObject({
      currentKey: terminal!.keepsakes.currentKey,
      usedKeys: terminal!.keepsakes.history.map((entry) => entry.key),
      removedKeys: terminal!.keepsakes.removedKeys,
    });
    expect(installation.equipment).toMatchObject({
      aspectPerfect: false,
      familiarStackMultiplier: 1,
    });
  });

  it('installs a Preboss from its captured start state with current biome records', () => {
    const installation = golden.installed({ biomeKey: 'G', kind: 'preboss' });
    const capture = golden.biome('G').rewards.prebossStartState!;
    const [state] = capture.states;
    expect(installation).toMatchObject({
      startOccurrence: capture.owner,
      startRoomGameName: 'G_PreBoss01',
      route: { enteredBiomes: 2, visitedBiomeKeys: ['F', 'G'] },
      biomeRecords: {
        form: 'current',
        biomeUseRecord: state!.rewardHistory.biomeUseRecord,
        lootBiomeRecord: state!.rewardHistory.lootBiomeRecord,
      },
    });
    expect(installation.roomHistory).toHaveLength(installation.counters.roomHistoryOrdinal);
    expect(installation.roomHistory.at(-1)?.gameName).not.toBe('G_PreBoss01');
    expect(golden.installed({ biomeKey: 'I', kind: 'preboss' }).counters.clockwork).toMatchObject({
      goalsRemaining: 0,
    });
  });

  it('stubs Hub restores in the room history of a Hub-sourced Preboss', () => {
    const installation = evaluated(loadSurfaceNOPQProject()).installed({
      biomeKey: 'N',
      kind: 'preboss',
    });
    expect(installation.startRoomGameName).toBe('N_PreBoss01');
    expect(installation.roomHistory).toHaveLength(installation.counters.roomHistoryOrdinal);
    expect(installation.roomHistory.at(-1)?.gameName).toBe('N_Hub');
    expect(installation.roomHistory.filter((record) => record.gameName === 'N_Hub').length).toBe(7);
  });

  it('publishes the Dream itinerary prefix the start has visited', () => {
    expect(dream.installed({ biomeKey: 'N', kind: 'opening' }).route).toEqual({
      routeKey: 'Dream',
      enteredBiomes: 2,
      visitedBiomeKeys: ['Q', 'F'],
    });
    const preboss = dream.installed({ biomeKey: 'N', kind: 'preboss' });
    expect(preboss.route).toEqual({
      routeKey: 'Dream',
      enteredBiomes: 3,
      visitedBiomeKeys: ['Q', 'F', 'N'],
    });
    expect(
      preboss.roomHistory.filter((record) => record.nextRoomSet).map((record) => record.gameName),
    ).toEqual(['Dream_PostBoss01', 'F_Opening02', 'Dream_PostBoss02', 'N_Opening01']);
  });

  it('marks the loadout grants native StartNewRun installs itself', () => {
    const installation = evaluated(surfaceSeleneHexPathProject()).installed({
      biomeKey: 'O',
      kind: 'opening',
    });
    expect(installation.equipment.aspectKey).toBe('SuitHexAspect');
    expect(installation.traits.filter((trait) => trait.grantedByRunStart === true)).toEqual([
      expect.objectContaining({ traitKey: 'SpellMoonBeamTrait' }),
    ]);
  });

  it('is unavailable where no mid-run start state exists', () => {
    expect(golden.install({ biomeKey: 'F', kind: 'opening' }).availability).toBe('unavailable');
    expect(golden.install({ biomeKey: 'F', kind: 'opening' })).toMatchObject({
      reason: { kind: 'routeStart' },
    });
    expect(golden.install({ biomeKey: 'N', kind: 'preboss' })).toMatchObject({
      reason: { kind: 'notOnItinerary' },
    });
    // The Dream itinerary continues past the authored prefix.
    expect(dream.install({ biomeKey: 'H', kind: 'opening' })).toMatchObject({
      reason: { kind: 'notReached' },
    });
  });

  describe('branch agreement', () => {
    const startPoint: StartPoint = { biomeKey: 'G', kind: 'preboss' };
    const base = golden.installed(startPoint);
    const [state] = golden.biome('G').rewards.prebossStartState!.states;
    const project = (states: readonly SimulationState[], kind: StartPoint['kind'] = 'preboss') =>
      projectStartInstallation(catalog, {
        startPoint: { biomeKey: 'G', kind },
        startRoomGameName: base.startRoomGameName,
        states,
        roomHistory: base.roomHistory,
        visitedBiomeKeys: base.route.visitedBiomeKeys,
      });
    const withRewardHistory = (patch: Partial<SimulationState['rewardHistory']>): SimulationState =>
      Object.freeze({
        ...state!,
        rewardHistory: Object.freeze({ ...state!.rewardHistory, ...patch }),
      });
    /** Another branch that recorded one fewer use of an existing key. */
    const oneFewer = (record: Readonly<Record<string, number>>) => {
      const [key, count] = Object.entries(record).find(([, value]) => value > 1)!;
      return Object.freeze({ ...record, [key]: count - 1 });
    };
    const wellInstance = (itemKey: string, clock: 'rooms' | 'encounters', remainingUses: number) =>
      Object.freeze({
        itemKey,
        traitKey: itemKey,
        clock,
        remainingUses,
        source: Object.freeze({
          occurrence: golden.biome('G').rewards.prebossStartState!.owner,
          generationKey: 'initial:healing' as const,
        }),
      });

    it('omits only the reward stores that differ by branch', () => {
      const [ranged, ...exact] = base.rewardStores.stores;
      const drawn = ranged!.remainingEntryCounts.findIndex((count) => count > 0);
      // Another branch drew one more of an entry the store still holds.
      const counts = ranged!.remainingEntryCounts.map((count, index) =>
        index === drawn ? count - 1 : count,
      );
      const other = Object.freeze({
        ...state!,
        bags: Object.freeze({
          ...state!.bags,
          [ranged!.storeKey]: { ...state!.bags[ranged!.storeKey]!, remainingEntryCounts: counts },
        }),
      });
      const result = project([state!, other]);
      expect(result).toMatchObject({
        availability: 'available',
        installation: {
          rewardStores: { stores: exact, omittedStoreKeys: [ranged!.storeKey] },
        },
      });
    });

    it('is unavailable when a run-wide family differs by branch', () => {
      const other = withRewardHistory({ useRecord: oneFewer(state!.rewardHistory.useRecord) });
      expect(project([state!, other])).toEqual({
        availability: 'unavailable',
        reason: { kind: 'branchesDisagree', families: ['runRecords'] },
      });
    });

    it('compares records by content, not by key order', () => {
      const reordered = withRewardHistory({
        useRecord: Object.freeze(
          Object.fromEntries(Object.entries(state!.rewardHistory.useRecord).reverse()),
        ),
      });
      expect(project([state!, reordered]).availability).toBe('available');
    });

    it('compares unordered collections by content, not by acquisition order', () => {
      const equipped = Object.entries(state!.traitHistory.equippedTraits);
      expect(equipped.length).toBeGreaterThan(1);
      const holding = (instances: readonly ReturnType<typeof wellInstance>[]) =>
        Object.freeze({ ...state!.stygianWell, timedInstances: Object.freeze(instances) });
      const first = Object.freeze({
        ...state!,
        stygianWell: holding([
          wellInstance('TemporaryDoorHealTrait', 'rooms', 3),
          wellInstance('TemporaryImprovedCastTrait', 'encounters', 2),
        ]),
      });
      const reordered = Object.freeze({
        ...state!,
        traitHistory: Object.freeze({
          ...state!.traitHistory,
          equippedTraits: Object.freeze(Object.fromEntries([...equipped].reverse())),
        }),
        stygianWell: holding([
          wellInstance('TemporaryImprovedCastTrait', 'encounters', 2),
          wellInstance('TemporaryDoorHealTrait', 'rooms', 3),
        ]),
      });
      const result = project([first, reordered]);
      expect(result.availability).toBe('available');
      if (result.availability !== 'available') return;
      expect(result.installation.traits.map((trait) => trait.traitKey)).toEqual(
        equipped.map(([traitKey]) => traitKey).sort(),
      );
      // Installed without the planner's purchase provenance.
      expect(result.installation.stygianWell.timedInstances).toEqual([
        {
          itemKey: 'TemporaryDoorHealTrait',
          traitKey: 'TemporaryDoorHealTrait',
          clock: 'rooms',
          remainingUses: 3,
        },
        {
          itemKey: 'TemporaryImprovedCastTrait',
          traitKey: 'TemporaryImprovedCastTrait',
          clock: 'encounters',
          remainingUses: 2,
        },
      ]);
    });

    it('requires biome records to agree only where they are installed', () => {
      const other = withRewardHistory({
        biomeUseRecord: oneFewer(state!.rewardHistory.biomeUseRecord),
      });
      expect(project([state!, other])).toMatchObject({
        reason: { kind: 'branchesDisagree', families: ['biomeRecords'] },
      });
      // An Opening installs the native biome-start reset of each branch.
      expect(project([state!, other].map(beginBiomeSimulationState), 'opening').availability).toBe(
        'available',
      );
    });
  });

  describe('held keepsakes and max-stat grants', () => {
    const startPoint: StartPoint = { biomeKey: 'G', kind: 'preboss' };
    const base = golden.installed(startPoint);
    const [state] = golden.biome('G').rewards.prebossStartState!.states;
    const wheel = 'ManaOverTimeRefundKeepsake';
    const installed = (
      keepsakes: Partial<SimulationState['keepsakes']>,
      echo?: { readonly captured: string; readonly replays: number },
    ): StartInstallation => {
      const traitHistory =
        echo === undefined
          ? state!.traitHistory
          : Object.freeze({
              ...state!.traitHistory,
              equippedTraits: Object.freeze({
                ...state!.traitHistory.equippedTraits,
                EchoRepeatKeepsakeBoon: Object.freeze({
                  traitKey: 'EchoRepeatKeepsakeBoon',
                  giverKey: 'Echo',
                  providerKind: 'npc',
                  sourceRole: 'npc',
                  echoRepeatedKeepsakeKey: echo.captured,
                  echoKeepsakeReplayCount: echo.replays,
                }),
              }),
            });
      const result = projectStartInstallation(catalog, {
        startPoint,
        startRoomGameName: base.startRoomGameName,
        states: [
          Object.freeze({
            ...state!,
            traitHistory: traitHistory as SimulationState['traitHistory'],
            keepsakes: Object.freeze({ ...state!.keepsakes, ...keepsakes }),
          }),
        ],
        roomHistory: base.roomHistory,
        visitedBiomeKeys: base.route.visitedBiomeKeys,
      });
      if (result.availability !== 'available') throw new Error(JSON.stringify(result.reason));
      return result.installation;
    };
    const keepsakeGrants = (installation: StartInstallation) =>
      installation.maxStats.grants.filter((grant) => grant.source.kind === 'keepsake');

    it('holds the slotted keepsake, kept Permanent keepsakes and no replaced or spent ones', () => {
      const installation = installed({
        currentKey: 'BonusMoneyKeepsake',
        discordantBell: { rank: 'Rare', multiplier: 1.2 },
        jeweledPom: {
          grantedTraitKey: 'HadesCastBoon',
          active: false,
          levels: 4,
          acquisitionIdentity: 'pom',
        },
        retained: [{ key: 'RarifyKeepsake', rank: 'Epic' }],
        callingCard: { remainingCharges: 3 },
        // A Time Piece swapped with no uses and a replaced Gorgon are gone.
        timePiece: { remainingCharges: 0 },
        gorgon: { status: 'expired' },
      });
      expect(installation.keepsake.held).toEqual([
        { key: 'BonusMoneyKeepsake', rank: 'Epic', slotted: true },
        { key: 'EscalatingKeepsake', rank: 'Rare', slotted: false },
        { key: 'HadesAndPersephoneKeepsake', rank: 'Heroic', slotted: false },
        { key: 'RarifyKeepsake', rank: 'Epic', slotted: false },
      ]);
    });

    it('holds Echo’s Common copy once replayed, but not a spent Figurine', () => {
      expect(
        installed({ currentKey: 'BonusMoneyKeepsake' }, { captured: wheel, replays: 1 }).keepsake
          .held,
      ).toContainEqual({ key: wheel, rank: 'Common', slotted: false });
      const figurine = 'BossMetaUpgradeKeepsake';
      const spent = installed(
        {
          currentKey: 'BonusMoneyKeepsake',
          figurine: { origin: 'echo', status: 'consumed', rarity: 'Common' },
        },
        { captured: figurine, replays: 2 },
      );
      expect(spent.keepsake.held.map((row) => row.key)).toEqual(['BonusMoneyKeepsake']);
    });

    it('leaves the slotted Silver Wheel’s own grant to its equip and publishes earlier grants', () => {
      const pickups = state!.rewardHistory.maxStatGains;
      const slotted = installed({ currentKey: wheel, maxManaGrants: { [wheel]: [100] } });
      expect(keepsakeGrants(slotted)).toEqual([]);
      expect(slotted.maxStats.grants).toContainEqual({
        source: { kind: 'pickups' },
        maxHealth: pickups.maxHealth,
        maxMana: pickups.maxMana,
      });
      const swapped = installed({
        currentKey: 'BonusMoneyKeepsake',
        maxManaGrants: { [wheel]: [100, 50] },
      });
      expect(
        keepsakeGrants(swapped)
          .map((grant) => grant.maxMana)
          .sort((a, b) => a - b),
      ).toEqual([50, 100]);
      expect(() => installed({ currentKey: wheel, maxManaGrants: { [wheel]: [50] } })).toThrow(
        /equip amount/,
      );
    });
  });
});
