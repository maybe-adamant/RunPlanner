import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

const biomeContracts = [
  {
    biomeKey: 'F',
    routeKey: 'Underworld',
    start: { kind: 'authoredChoice', roomGameNames: ['F_Opening01', 'F_Opening02', 'F_Opening03'] },
    progression: {
      kind: 'generated',
      policy: 'eligibilityDriven',
      batch: 'standard',
      bounds: null,
    },
    completion: ['F_Boss01', 'F_PostBoss01'],
  },
  {
    biomeKey: 'G',
    routeKey: 'Underworld',
    start: { kind: 'fixedAuthored', roomGameName: 'G_Intro' },
    progression: {
      kind: 'generated',
      policy: 'eligibilityDriven',
      batch: 'standard',
      bounds: null,
    },
    completion: ['G_Boss01', 'G_PostBoss01'],
  },
  {
    biomeKey: 'H',
    routeKey: 'Underworld',
    start: { kind: 'fixedAuthored', roomGameName: 'H_Intro' },
    progression: {
      kind: 'generated',
      policy: 'eligibilityDriven',
      batch: 'fields',
      bounds: null,
    },
    completion: ['H_Boss01', 'H_PostBoss01'],
  },
  {
    biomeKey: 'I',
    routeKey: 'Underworld',
    start: { kind: 'fixedAuthored', roomGameName: 'I_Intro' },
    progression: {
      kind: 'generated',
      policy: 'eligibilityDriven',
      batch: 'clockwork',
      bounds: null,
    },
    completion: ['I_Boss01'],
  },
  {
    biomeKey: 'N',
    routeKey: 'Surface',
    start: { kind: 'fixedAuthored', roomGameName: 'N_Opening01' },
    progression: { kind: 'hub' },
    completion: ['N_Boss01', 'N_PostBoss01'],
  },
  {
    biomeKey: 'O',
    routeKey: 'Surface',
    start: { kind: 'fixedAuthored', roomGameName: 'O_Intro' },
    progression: {
      kind: 'generated',
      policy: 'eligibilityDriven',
      batch: 'standard',
      bounds: null,
    },
    completion: ['O_Boss01', 'O_PostBoss01'],
  },
  {
    biomeKey: 'P',
    routeKey: 'Surface',
    start: { kind: 'fixedAuthored', roomGameName: 'P_Intro' },
    progression: {
      kind: 'generated',
      policy: 'eligibilityDriven',
      batch: 'standard',
      bounds: null,
    },
    completion: ['P_Boss01', 'P_PostBoss01'],
  },
  {
    biomeKey: 'Q',
    routeKey: 'Surface',
    start: { kind: 'fixedAuthored', roomGameName: 'Q_Intro' },
    progression: { kind: 'generated', policy: 'staged', batch: 'standard', bounds: null },
    completion: ['Q_Boss01'],
  },
] as const;

const roomCounts = [
  ['F', 35, 35],
  ['G', 31, 31],
  ['H', 23, 23],
  ['I', 32, 32],
  ['N', 48, 47],
  ['O', 26, 26],
  ['P', 28, 28],
  ['Q', 24, 24],
] as const;

const prebossPolicies = [
  ['F_PreBoss01', 'takeOverNormalDoors', 'counted'],
  ['G_PreBoss01', 'takeOverNormalDoors', 'counted'],
  ['H_PreBoss01', 'takeOverNormalDoors', 'counted'],
  ['I_PreBoss02', 'retainNormalPeers', undefined],
  ['N_PreBoss01', 'takeOverNormalDoors', 'none'],
  ['O_PreBoss01', 'takeOverNormalDoors', 'none'],
  ['P_PreBoss01', 'takeOverNormalDoors', 'counted'],
  ['Q_PreBoss01', 'takeOverNormalDoors', 'none'],
] as const;

const roomFacts = [
  ['F_Opening01', 'F', 'Opening', 1],
  ['F_Opening02', 'F', 'Opening', 1],
  ['F_Combat01', 'F', 'Combat', 1],
  ['F_Combat02', 'F', 'Combat', 2],
  ['F_MiniBoss01', 'F', 'Miniboss', 1],
  ['F_PreBoss01', 'F', 'Preboss', 1],
  ['G_Intro', 'G', 'Intro', 1],
  ['G_Combat01', 'G', 'Combat', 2],
  ['G_Combat02', 'G', 'Combat', 3],
  ['G_MiniBoss01', 'G', 'Miniboss', 2],
  ['G_PreBoss01', 'G', 'Preboss', 1],
  ['H_Intro', 'H', 'Intro', 1],
  ['H_Combat01', 'H', 'Combat', 1],
  ['H_Combat02', 'H', 'Combat', 2],
  ['H_MiniBoss01', 'H', 'Miniboss', 2],
  ['H_PreBoss01', 'H', 'Preboss', 1],
  ['I_Intro', 'I', 'Intro', 1],
  ['I_Combat01', 'I', 'Combat', 2],
  ['I_Combat02', 'I', 'Combat', 1],
  ['I_MiniBoss01', 'I', 'Miniboss', 2],
  ['I_PreBoss02', 'I', 'Preboss', 1],
  ['N_Opening01', 'N', 'Opening', 1],
  ['N_PreHub01', 'N', 'PreHub', 1],
  ['N_Combat01', 'N', 'Combat', 1],
  ['N_PreBoss01', 'N', 'Preboss', 1],
  ['N_Boss01', 'N', 'Boss', 1],
  ['O_Intro', 'O', 'Intro', 1],
  ['O_Combat01', 'O', 'Combat', 1],
  ['O_Combat02', 'O', 'Combat', 1],
  ['O_MiniBoss01', 'O', 'Miniboss', 1],
  ['O_PreBoss01', 'O', 'Preboss', 1],
  ['P_Intro', 'P', 'Intro', 2],
  ['P_Combat01', 'P', 'Combat', 2],
  ['P_Combat02', 'P', 'Combat', 2],
  ['P_MiniBoss01', 'P', 'Miniboss', 2],
  ['P_PreBoss01', 'P', 'Preboss', 1],
  ['Q_Intro', 'Q', 'Intro', 1],
  ['Q_Combat01', 'Q', 'Combat', 1],
  ['Q_Combat03', 'Q', 'Combat', 2],
  ['Q_MiniBoss02', 'Q', 'Miniboss', 1],
  ['Q_PreBoss01', 'Q', 'Preboss', 1],
] as const;

describe('biome layout declarations', () => {
  it.each(biomeContracts)(
    '$biomeKey completion declarations stay biome-local and authored',
    (fixture) => {
      for (const gameName of fixture.completion) {
        expect(catalog.rooms.byKey[gameName]).toMatchObject({
          roomSetKey: fixture.biomeKey,
          mode: { kind: 'authored' },
        });
      }
    },
  );

  it.each(biomeContracts)(
    '$biomeKey keeps its declared start and progression envelope',
    (fixture) => {
      const layout = catalog.biomeLayouts.byKey[fixture.biomeKey];
      expect(layout?.start).toEqual(fixture.start);
      expect(layout?.completion.bossRoomGameName).toBe(fixture.completion[0]);
      expect(layout?.progression.kind).toBe(fixture.progression.kind);
      if (fixture.progression.kind === 'generated' && layout?.progression.kind === 'generated') {
        expect(layout.progression.progressionPolicy.kind).toBe(fixture.progression.policy);
        expect(layout.progression.batchPolicy.kind).toBe(fixture.progression.batch);
        expect(layout.progression).not.toHaveProperty('bounds');
        expect(fixture.progression.bounds).toBeNull();
      }
    },
  );

  it.each(roomCounts)(
    '%s keeps its declared room and authored-room totals',
    (biomeKey, total, authored) => {
      const rooms = catalog.rooms.values.filter((room) => room.roomSetKey === biomeKey);
      expect(rooms).toHaveLength(total);
      expect(rooms.filter((room) => room.mode.kind === 'authored')).toHaveLength(authored);
    },
  );

  it.each(prebossPolicies)(
    '%s keeps its shared Preboss batch contract',
    (gameName, kind, remainingKind) => {
      const policy = catalog.rooms.byKey[gameName]?.prebossBatchPolicy;
      expect(policy?.kind).toBe(kind);
      if (remainingKind !== undefined && policy?.kind === 'takeOverNormalDoors') {
        expect(policy.remainingOffers.kind).toBe(remainingKind);
      }
    },
  );

  it.each(roomFacts)(
    '%s preserves its concrete room kind and physical exit count',
    (gameName, biomeKey, kind, exitCount) => {
      const room = catalog.rooms.byKey[gameName];
      expect(room).toMatchObject({
        roomSetKey: biomeKey,
        kind,
        mode: { kind: 'authored' },
      });
      expect(room?.exits).toHaveLength(exitCount);
      expect(room?.exits.map((exit) => exit.index)).toEqual(
        Array.from({ length: exitCount }, (_, index) => index + 1),
      );
    },
  );
});
