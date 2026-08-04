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
      bounds: [10, 20],
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
      bounds: [7, 21],
    },
    completion: ['G_Boss01', 'G_PostBoss01'],
  },
  {
    biomeKey: 'H',
    routeKey: 'Underworld',
    start: { kind: 'fixedAuthored', roomGameName: 'H_Intro' },
    progression: { kind: 'generated', policy: 'fixedCount', batch: 'fields', bounds: [4, 7] },
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
      bounds: [13, 23],
    },
    completion: ['I_Boss01', 'I_PostBoss01'],
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
    progression: { kind: 'generated', policy: 'fixedCount', batch: 'standard', bounds: [6, 6] },
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
      bounds: [8, 16],
    },
    completion: ['P_Boss01', 'P_PostBoss01'],
  },
  {
    biomeKey: 'Q',
    routeKey: 'Surface',
    start: { kind: 'fixedAuthored', roomGameName: 'Q_Intro' },
    progression: { kind: 'generated', policy: 'staged', batch: 'standard', bounds: [6, 8] },
    completion: ['Q_Boss01'],
  },
] as const;

const roomCounts = [
  ['F', 34, 32],
  ['G', 30, 28],
  ['H', 22, 20],
  ['I', 32, 30],
  ['N', 47, 44],
  ['O', 25, 23],
  ['P', 28, 26],
  ['Q', 23, 22],
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

const normalizedBiomeSnapshotHashes = [
  ['F', 'e75ca55e687fbe32'],
  ['G', '1ab56f3398abf494'],
  ['H', '757558455fdd5c55'],
  ['I', '9bac20136a7a73fa'],
  ['N', '2ca1a767c4a6e83d'],
  ['O', '0c62f7808fac97b9'],
  ['P', '62ca8238e7e55585'],
  ['Q', 'c12b7024220a9c39'],
] as const;

function normalizedBiomeSnapshot(biomeKey: string) {
  const rooms = catalog.rooms.values.filter((room) => room.biomeKey === biomeKey);
  const encounterEnvelopeKeys = [...new Set(rooms.map((room) => room.encounterEnvelopeKey))];
  const encounterSetKeys: string[] = [];
  const encounterDefinitionKeys: string[] = [];
  for (const room of rooms) {
    for (const binding of room.encounterSlotBindings) {
      if (binding.kind === 'fixed') {
        if (!encounterDefinitionKeys.includes(binding.encounterDefinitionKey)) {
          encounterDefinitionKeys.push(binding.encounterDefinitionKey);
        }
        continue;
      }
      if (!encounterSetKeys.includes(binding.encounterSetKey)) {
        encounterSetKeys.push(binding.encounterSetKey);
      }
      const encounterSet = catalog.encounterSets.byKey[binding.encounterSetKey];
      for (const encounterDefinitionKey of encounterSet?.encounterDefinitionKeys ?? []) {
        if (!encounterDefinitionKeys.includes(encounterDefinitionKey)) {
          encounterDefinitionKeys.push(encounterDefinitionKey);
        }
      }
    }
  }
  const exitTypeKeys = [...new Set(rooms.flatMap((room) => room.exits.map((exit) => exit.type)))];
  const exitCompatibilityPolicyKeys = [
    ...new Set(
      exitTypeKeys.map(
        (exitTypeKey) => catalog.exitTypes.byKey[exitTypeKey]?.compatibilityPolicyKey,
      ),
    ),
  ].filter((key): key is string => key !== undefined);
  return {
    layout: catalog.biomeLayouts.byKey[biomeKey],
    rooms,
    encounterEnvelopes: encounterEnvelopeKeys.map((key) => catalog.encounterEnvelopes.byKey[key]),
    encounterDefinitions: encounterDefinitionKeys.map(
      (key) => catalog.encounterDefinitions.byKey[key],
    ),
    encounterSets: encounterSetKeys.map((key) => catalog.encounterSets.byKey[key]),
    exitTypes: exitTypeKeys.map((key) => catalog.exitTypes.byKey[key]),
    exitCompatibilityPolicies: exitCompatibilityPolicyKeys.map(
      (key) => catalog.exitCompatibilityPolicies.byKey[key],
    ),
  };
}

function snapshotHash(value: unknown): string {
  const serialized = JSON.stringify(value);
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= BigInt(serialized.charCodeAt(index));
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

describe('catalog regression coverage retained through unified decisions', () => {
  it.each(biomeContracts)(
    '$biomeKey keeps its declared start and progression envelope',
    (fixture) => {
      const layout = catalog.biomeLayouts.byKey[fixture.biomeKey];
      expect(layout?.start).toEqual(fixture.start);
      expect(layout?.completion.rooms.map((room) => room.roomGameName)).toEqual(fixture.completion);
      expect(layout?.progression.kind).toBe(fixture.progression.kind);
      if (fixture.progression.kind === 'generated' && layout?.progression.kind === 'generated') {
        expect(layout.progression.progressionPolicy.kind).toBe(fixture.progression.policy);
        expect(layout.progression.batchPolicy.kind).toBe(fixture.progression.batch);
        expect([
          layout.progression.bounds.maxBatches,
          layout.progression.bounds.maxTargets,
        ]).toEqual(fixture.progression.bounds);
      }
    },
  );

  it.each(biomeContracts)(
    '$biomeKey completion declarations stay biome-local and derived',
    (fixture) => {
      for (const gameName of fixture.completion) {
        expect(catalog.rooms.byKey[gameName]).toMatchObject({
          biomeKey: fixture.biomeKey,
          mode: { kind: 'derived', classification: 'completion' },
        });
      }
    },
  );

  it.each(roomCounts)(
    '%s keeps its declared room and authored-room totals',
    (biomeKey, total, authored) => {
      const rooms = catalog.rooms.values.filter((room) => room.biomeKey === biomeKey);
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
        biomeKey,
        kind,
        mode:
          kind === 'Boss'
            ? { kind: 'derived', classification: 'completion' }
            : { kind: 'authored' },
      });
      expect(room?.exits).toHaveLength(exitCount);
      expect(room?.exits.map((exit) => exit.index)).toEqual(
        Array.from({ length: exitCount }, (_, index) => index + 1),
      );
    },
  );

  it.each(normalizedBiomeSnapshotHashes)(
    '%s keeps an exact normalized declaration snapshot',
    (biomeKey, expectedHash) => {
      // This snapshot includes every normalized room, its reward binding,
      // eligibility/force/counter/cap fields, local children and exits, plus
      // the layout, encounter envelopes, slot bindings, definitions, sets,
      // and exit compatibility it references.
      expect(snapshotHash(normalizedBiomeSnapshot(biomeKey))).toBe(expectedHash);
    },
  );
});
