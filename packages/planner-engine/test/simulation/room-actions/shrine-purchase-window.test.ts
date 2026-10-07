import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createRoomActionAddress,
  createShopOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  roomActionKey,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import {
  loadSurfaceNOHermesShrineDeliveryCheckpoint,
  loadSurfaceNShrineSideRoomDeliveryCheckpoint,
  loadSurfaceShrineTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  nLocalOccurrenceId,
  qBiome,
  qOccurrenceIds,
  surfaceShrineDeliveriesProject,
} from '@run-planner/test-fixtures/surface';
import {
  roomLifecycleWindowOrdinal,
  type RoomLifecycleStructure,
} from '../../../src/authored-project/room-actions/lifecycle-structure';
import type {
  CanonicalAuthoredRoom,
  CanonicalBiome,
  MaterializedBiomePrefix,
} from '../../../src/simulation/materialization';

const sideRoomId = nLocalOccurrenceId('combat11', 'sideDoor1');
const nPostbossId = 'surface-n-preboss:postboss';
const oShrineId = 'surface-o-combat07';

function rooms(prefix: CanonicalBiome | MaterializedBiomePrefix): CanonicalAuthoredRoom[] {
  const found: CanonicalAuthoredRoom[] = prefix.entryRoom === undefined ? [] : [prefix.entryRoom];
  for (const decision of prefix.decisions) {
    if (decision.kind === 'batch') {
      found.push(...decision.targets.map((target) => target.room));
      found.push(...decision.additional.map((target) => target.room));
    } else {
      for (const visit of decision.visits)
        found.push(visit.target.room, ...visit.enteredLocalRooms);
    }
  }
  found.push(...(prefix.fixedRoomLinks ?? []).map((link) => link.target));
  return found;
}

function evaluatedRoom(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  const biome = simulateProject(catalog, project).route?.biomes.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  const prefix =
    biome === undefined
      ? undefined
      : 'snapshot' in biome
        ? biome.snapshot
        : 'assessmentPrefix' in biome && biome.assessmentPrefix !== undefined
          ? biome.assessmentPrefix
          : 'materializedPrefix' in biome
            ? biome.materializedPrefix
            : undefined;
  const room =
    prefix === undefined
      ? undefined
      : rooms(prefix).find((candidate) => candidate.occurrenceId === occurrenceId);
  if (room === undefined) throw new Error(`${occurrenceId} was not evaluated`);
  return room;
}

/** Timeline labels: boundaries in brackets, actions by kind. */
function timeline(room: CanonicalAuthoredRoom): readonly string[] {
  return room.roomLifecycleTimeline.entries.map((entry) =>
    entry.kind === 'boundary'
      ? `[${entry.boundary.kind}]`
      : entry.kind === 'action'
        ? entry.action.reference.kind
        : entry.effect,
  );
}

function reorder(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
  order: (current: readonly RoomActionReference[]) => readonly RoomActionReference[],
): ProjectDocument {
  const encoded = JSON.parse(encodeProjectDocument(project)) as {
    route: {
      biomes: {
        biomeKey: string;
        topology: {
          occurrences: {
            occurrenceId: string;
            roomActions: { order: RoomActionReference[] };
          }[];
        };
      }[];
    };
  };
  const occurrence = encoded.route.biomes
    .find((biome) => biome.biomeKey === biomeKey)
    ?.topology.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) throw new Error(`${occurrenceId} is not authored`);
  occurrence.roomActions.order = [...order(occurrence.roomActions.order)];
  return decodeProjectDocument(encoded, catalog);
}

describe('post-outgoing window without outgoing generation', () => {
  const sideRoom: RoomLifecycleStructure = {
    profileKey: 'EphyraSideRoom',
    activeEncounterSlotKeys: ['Encounter'],
    phases: [{ phaseKey: 'Encounter' }],
    points: [
      { kind: 'roomEntered', key: 'roomEntered' },
      { kind: 'encounterStart', key: 'encounterStart:Encounter', phaseKey: 'Encounter' },
      { kind: 'encounterEnd', key: 'encounterEnd:Encounter', phaseKey: 'Encounter' },
      { kind: 'cleanup', key: 'cleanup' },
    ],
  };
  const postboss: RoomLifecycleStructure = {
    profileKey: 'PostBossRoom',
    activeEncounterSlotKeys: [],
    phases: [],
    points: [
      { kind: 'roomEntered', key: 'roomEntered' },
      { kind: 'cleanup', key: 'cleanup' },
    ],
  };

  it.each([
    ['side room', sideRoom],
    ['Postboss', postboss],
  ])('follows the %s afterCombat work', (_, structure) => {
    expect(roomLifecycleWindowOrdinal(structure, { kind: 'postOutgoing' })).toBeGreaterThan(
      roomLifecycleWindowOrdinal(structure, { kind: 'standard', phase: 'afterCombat' }),
    );
  });
});

describe('Shrine purchases after the doors open', () => {
  it('ranks a side-room purchase after its reward and after Doors open', () => {
    const room = evaluatedRoom(loadSurfaceNShrineSideRoomDeliveryCheckpoint(), 'N', sideRoomId);
    expect(room.roomActionRoster.issues).toEqual([]);
    expect(timeline(room)).toEqual([
      '[roomEntered]',
      '[encounterStart]',
      '[encounterEnd]',
      'interactIncomingReward',
      '[cleanup]',
      'purchaseHermesShrineOffer',
    ]);
  });

  it('reports a saved side-room purchase ranked before its reward as out of order', () => {
    const saved = reorder(
      loadSurfaceNShrineSideRoomDeliveryCheckpoint(),
      'N',
      sideRoomId,
      (order) => [...order].reverse(),
    );
    const purchase = createRoomActionAddress(
      { kind: 'biome', routeKey: 'Surface', biomeKey: 'N' },
      sideRoomId,
      roomActionKey({
        kind: 'purchaseHermesShrineOffer',
        generationKey: 'initial:secondLeft',
        rushed: false,
      }),
    );
    expect(simulateProject(catalog, saved).findings).toContainEqual(
      expect.objectContaining({
        code: 'roomActionOrderUnavailable',
        origin: purchase,
        evidence: expect.objectContaining({ reason: 'window' }),
      }),
    );
  });

  it('ranks Postboss purchases after the fountain and Doors open', () => {
    const project = loadSurfaceShrineTravelDealCheckpoint();
    expect(timeline(evaluatedRoom(project, 'N', nPostbossId))).toEqual([
      '[roomEntered]',
      'useFountain',
      '[cleanup]',
      'purchaseHermesShrineOffer',
      'purchaseHermesShrineOffer',
      'interactAcquisitionEntry',
    ]);
    const beforeFountain = reorder(project, 'N', nPostbossId, (order) => [
      ...order.slice(1, 2),
      order[0]!,
      ...order.slice(2),
    ]);
    expect(evaluatedRoom(beforeFountain, 'N', nPostbossId).roomActionRoster.issues).toContainEqual(
      expect.objectContaining({ kind: 'window', reference: { kind: 'useFountain' } }),
    );
  });

  it('renders an O Ship rushed purchase after Doors open without moving exit usability', () => {
    const room = evaluatedRoom(loadSurfaceNOHermesShrineDeliveryCheckpoint(), 'O', oShrineId);
    expect(timeline(room).slice(-5)).toEqual([
      'interactWheelReward',
      '[cleanup]',
      'purchaseHermesShrineOffer',
      'purchaseHermesShrineOffer',
      'interactAcquisitionEntry',
    ]);
    const wheelRewardRank = room.roomActionRoster.rows.find(
      (row) => row.reference.kind === 'interactWheelReward',
    )?.rank;
    expect(
      room.roomActionRoster.checkpoints.find((entry) => entry.checkpointKey === 'exitUsable')
        ?.afterRank,
    ).toBe(wheelRewardRank);
    expect(
      room.roomActionRoster.rows
        .filter((row) => row.reference.kind === 'purchaseHermesShrineOffer')
        .map((row) => row.participation),
    ).toEqual(['optional', 'optional']);
  });
});

describe('Preboss World Shop purchases and flushed deliveries', () => {
  it('lets a flushed delivery pickup come before or after a Shop purchase', () => {
    const purchased = applyProjectCommand(surfaceShrineDeliveriesProject(), catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: createShopOfferAddress(qBiome, qOccurrenceIds.preboss, 'MixedProgress1'),
      purchased: true,
    });
    const order = (project: ProjectDocument) =>
      project.route.biomes
        .find((biome) => biome.biomeKey === 'Q')
        ?.topology?.occurrences.find((room) => room.occurrenceId === qOccurrenceIds.preboss)
        ?.roomActions.order ?? [];
    const delivery = order(purchased).find(
      (reference) => reference.kind === 'interactAcquisitionEntry',
    );
    if (delivery === undefined) throw new Error('Q Preboss lost its flushed delivery');
    const moved = applyProjectCommand(purchased, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(qBiome, qOccurrenceIds.preboss, roomActionKey(delivery)),
      toIndex: order(purchased).findIndex((reference) => reference === delivery) === 0 ? 1 : 0,
    });
    const kinds = (project: ProjectDocument) => order(project).map((reference) => reference.kind);
    expect(new Set([kinds(purchased).join(), kinds(moved).join()])).toEqual(
      new Set([
        'interactAcquisitionEntry,interactShopOffer',
        'interactShopOffer,interactAcquisitionEntry',
      ]),
    );
    for (const project of [purchased, moved]) {
      const room = evaluatedRoom(project, 'Q', qOccurrenceIds.preboss);
      expect(room.roomActionRoster.issues).toEqual([]);
      expect(
        room.roomActionRoster.rows.find((row) => row.reference.kind === 'interactAcquisitionEntry')
          ?.participation,
      ).toBe('required');
    }
  });
});
