import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createRewardWheelAddress,
  type AuthoredBiomePlan,
  type ProjectDocument,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject } from '@run-planner/test-fixtures';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
  pBiome,
  qBiome,
} from '@run-planner/test-fixtures';
import { createCandidateSessionFactory } from './candidateProjection';

function plan(project: ProjectDocument, routeKey: string, biomeKey: string): AuthoredBiomePlan {
  const value = project.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey);
  if (value === undefined) throw new Error(`${routeKey}.${biomeKey} fixture is missing`);
  return value;
}

function occurrence(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  gameName: string,
): RoomOccurrence {
  const value = plan(project, routeKey, biomeKey).topology?.occurrences.find(
    (candidate) => candidate.gameName === gameName,
  );
  if (value === undefined) throw new Error(`${gameName} occurrence is missing`);
  return value;
}

function countedBinding(gameName: string): CountedRewardBinding {
  const binding = catalog.rooms.byKey[gameName]?.incomingReward;
  if (binding?.kind !== 'countedChoice') throw new Error(`${gameName} has no counted binding`);
  return binding;
}

function incomingOffer(value: RoomOccurrence): ResolvedRewardOffer {
  if (value.state.kind === 'counted' || value.state.kind === 'ephyraCombat')
    return value.state.offer;
  throw new Error(`${value.gameName} has no counted incoming offer`);
}

describe('producer-resolved reward type domains', () => {
  it('uses the materialized declaration-owned store for F through I', () => {
    const project = createGoldenFGHIProject();
    const session = createCandidateSessionFactory(catalog).bind(
      simulateProjectAssembly(catalog, project),
    );
    for (const [biomeKey, gameName, expected] of [
      ['F', 'F_Combat03', 'MaxHealthDrop'],
      ['G', 'G_Combat01', 'Boon'],
      ['I', 'I_Combat03', 'RoomMoneyTripleDrop'],
    ] as const) {
      const room = occurrence(project, 'Underworld', biomeKey, gameName);
      const domain = session.countedRewardTypes(
        {
          kind: 'incomingReward',
          address: createIncomingRewardAddress(
            createBiomeAddress('Underworld', biomeKey),
            room.occurrenceId,
          ),
        },
        countedBinding(gameName),
        incomingOffer(room).rewardType,
      );
      expect(domain).toContain(expected);
      expect(domain).not.toContain('MetaCurrencyDrop');
    }

    const h = occurrence(project, 'Underworld', 'H', 'H_Combat02');
    const declaration = catalog.rooms.byKey.H_Combat02?.localChildren.find(
      (child) => child.kind === 'boundedRewardSlots',
    );
    if (h.state.kind !== 'fieldsCombat' || declaration?.kind !== 'boundedRewardSlots') {
      throw new Error('H Fields cage fixture is missing');
    }
    const domain = session.countedRewardTypes(
      {
        kind: 'localReward',
        address: createLocalRewardAddress(
          createBiomeAddress('Underworld', 'H'),
          h.occurrenceId,
          declaration.key,
          'cage1',
        ),
      },
      declaration.reward,
      h.state.cages.cage1!.rewardType,
    );
    expect(domain).toContain('MaxHealthDrop');
    expect(domain).not.toContain('Devotion');
  });

  it('uses the current normalized producer state for N through Q', () => {
    const project = createRepresentativeNOPQProject();
    const session = createCandidateSessionFactory(catalog).bind(
      simulateProjectAssembly(catalog, project),
    );
    const n = occurrence(project, 'Surface', 'N', 'N_Combat05');
    const nDomain = session.countedRewardTypes(
      { kind: 'incomingReward', address: createIncomingRewardAddress(nBiome, n.occurrenceId) },
      countedBinding('N_Combat05'),
      incomingOffer(n).rewardType,
    );
    expect(nDomain).toContain('MaxHealthDropBig');
    expect(nDomain).not.toContain('MetaCurrencyDrop');

    if (n.state.kind !== 'ephyraCombat') throw new Error('N Ephyra fixture is missing');
    const sideRoom = catalog.rooms.byKey.N_Combat05?.localChildren.find(
      (child) => child.kind === 'fixedRoomSlots',
    );
    const slot = sideRoom?.kind === 'fixedRoomSlots' ? sideRoom.slots[0] : undefined;
    const sideDeclaration = slot === undefined ? undefined : catalog.rooms.byKey[slot.roomGameName];
    if (
      sideRoom?.kind !== 'fixedRoomSlots' ||
      sideDeclaration?.incomingReward.kind !== 'countedChoice' ||
      slot === undefined
    ) {
      throw new Error('N side-room declaration is missing');
    }
    const localDomain = session.countedRewardTypes(
      {
        kind: 'localReward',
        address: createLocalRewardAddress(nBiome, n.occurrenceId, sideRoom.key, slot.slotKey),
      },
      sideDeclaration.incomingReward,
      n.state.sideRooms[slot.slotKey]!.offer.rewardType,
    );
    expect(localDomain).toContain(n.state.sideRooms[slot.slotKey]!.offer.rewardType);

    for (const [biome, room, expected] of [
      [pBiome, occurrence(project, 'Surface', 'P', 'P_Combat03'), 'MaxHealthDrop'],
      [qBiome, occurrence(project, 'Surface', 'Q', 'Q_MiniBoss02'), 'Boon'],
    ] as const) {
      const domain = session.countedRewardTypes(
        { kind: 'incomingReward', address: createIncomingRewardAddress(biome, room.occurrenceId) },
        countedBinding(room.gameName),
        incomingOffer(room).rewardType,
      );
      expect(domain).toContain(expected);
    }
    const oWheel = session.rewardWheelStores(
      createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1'),
      ['RunProgress', 'MetaProgress'],
    );
    expect(oWheel.map((option) => option.evaluation.kind)).toEqual([
      'rewardWheelStore',
      'rewardWheelStore',
    ]);
    void nOccurrenceId;
  });
});
