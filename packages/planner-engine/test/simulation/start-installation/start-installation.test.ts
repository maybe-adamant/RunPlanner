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
  surfaceShrineDeliveriesProject,
} from '@run-planner/test-fixtures/surface';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';

import { projectStartInstallation } from '../../../src/simulation/start-installation/projection';
import type { SimulationState } from '../../../src/simulation/state/model';
import { reachedFrontier } from '../../support/reward-frontier';

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
    const [terminal] = reachedFrontier(f.rewards).map((branch) => branch.state);
    expect(Object.keys(terminal!.rewardHistory.biomeUseRecord).length).toBeGreaterThan(0);
    expect(installation).toMatchObject({
      startRoomGameName: 'G_Intro',
      route: { routeKey: 'Underworld', enteredBiomes: 1, visitedBiomeKeys: ['F'] },
      biomeRecords: { form: 'postReset', biomeUseRecord: {} },
      runRecords: {
        useRecord: terminal!.rewardHistory.useRecord,
        lootTypeHistory: terminal!.rewardHistory.lootTypeHistory,
      },
    });
    expect(installation.startOccurrence).toBeUndefined();
    const counters = f.history.afterTransition.ledgers.counters;
    expect(installation.counters).toMatchObject({
      roomHistoryOrdinal: counters.roomHistoryOrdinal,
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
    const capture = golden.biome('G').rewards.midBiomeStartStates!.preboss!;
    const state = capture.state;
    expect(installation).toMatchObject({
      startOccurrence: capture.owner,
      startRoomGameName: 'G_PreBoss01',
      route: { enteredBiomes: 2, visitedBiomeKeys: ['F', 'G'] },
      biomeRecords: {
        form: 'current',
        biomeUseRecord: state!.rewardHistory.biomeUseRecord,
      },
    });
    expect(installation.roomHistory).toHaveLength(installation.counters.roomHistoryOrdinal);
    expect(installation.roomHistory.at(-1)?.gameName).not.toBe('G_PreBoss01');
    expect(golden.installed({ biomeKey: 'I', kind: 'preboss' }).counters.clockwork).toMatchObject({
      goalsRemaining: 0,
    });
  });

  const nopq = evaluated(loadSurfaceNOPQProject());

  it.each([
    ['a generated biome', golden, 'G'],
    ['Mourning Fields', golden, 'H'],
    ['Ephyra', nopq, 'N'],
  ] as const)('installs a Boss in %s from the state after its Preboss', (_, route, biomeKey) => {
    const preboss = route.installed({ biomeKey, kind: 'preboss' });
    const boss = route.installed({ biomeKey, kind: 'boss' });
    const capture = route.biome(biomeKey).rewards.midBiomeStartStates!.boss!;
    expect(boss).toMatchObject({
      startOccurrence: capture.owner,
      startRoomGameName: capture.gameName,
      route: preboss.route,
      biomeRecords: { form: 'current' },
    });
    // The Preboss departs with one room-history record and no encounter.
    expect(boss.roomHistory).toEqual([
      ...preboss.roomHistory,
      { gameName: preboss.startRoomGameName, nextRoomSet: false },
    ]);
    expect(boss.counters).toMatchObject({
      roomHistoryOrdinal: preboss.counters.roomHistoryOrdinal + 1,
      routeEncounterDepth: preboss.counters.routeEncounterDepth,
      biomeDepthCache: preboss.counters.biomeDepthCache + 1,
    });
  });

  it('installs Clockwork counters at an I Preboss only', () => {
    const boss = golden.installed({ biomeKey: 'I', kind: 'boss' });
    expect(boss.startRoomGameName).toBe('I_Boss01');
    expect(boss.counters).not.toHaveProperty('clockwork');
  });

  it('stubs Hub restores in the room history of a Hub-sourced Preboss', () => {
    const installation = nopq.installed({ biomeKey: 'N', kind: 'preboss' });
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

  it('installs the item armor held at each start point', () => {
    // An O Hermes delivery hands over one Armor before O's Preboss.
    const shrine = evaluated(surfaceShrineDeliveriesProject());
    expect(
      (['opening', 'preboss', 'boss'] as const).map(
        (kind) => shrine.installed({ biomeKey: 'O', kind }).itemArmor,
      ),
    ).toEqual([0, 20, 20]);
    expect(shrine.installed({ biomeKey: 'P', kind: 'opening' }).itemArmor).toBe(20);
    expect(golden.installed({ biomeKey: 'G', kind: 'opening' }).itemArmor).toBe(0);
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

  describe('held keepsakes and max-stat grants', () => {
    const startPoint: StartPoint = { biomeKey: 'G', kind: 'preboss' };
    const base = golden.installed(startPoint);
    const state = golden.biome('G').rewards.midBiomeStartStates!.preboss!.state;
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
        state: Object.freeze({
          ...state!,
          traitHistory: traitHistory as SimulationState['traitHistory'],
          keepsakes: Object.freeze({ ...state!.keepsakes, ...keepsakes }),
        }),
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

    it('holds Echo’s recorded Common copy, but not a spent Figurine', () => {
      expect(
        installed({ currentKey: 'BonusMoneyKeepsake', echoCopyKey: wheel }).keepsake.held,
      ).toContainEqual({ key: wheel, rank: 'Common', slotted: false });
      expect(
        installed(
          { currentKey: 'BonusMoneyKeepsake' },
          { captured: wheel, replays: 1 },
        ).keepsake.held.map((row) => row.key),
      ).toEqual(['BonusMoneyKeepsake']);
      const figurine = 'BossMetaUpgradeKeepsake';
      const spent = installed({
        currentKey: 'BonusMoneyKeepsake',
        echoCopyKey: figurine,
        figurine: { origin: 'echo', status: 'consumed', rarity: 'Common' },
      });
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
