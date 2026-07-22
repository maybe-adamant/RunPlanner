import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createRewardWheelOfferAddress,
  type AuthoredBiomePlan,
  type ProjectDocument,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject } from '../../test/fixtures/underworldProject';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
} from '../../test/fixtures/surfaceProject';
import { createCandidateProjectionService } from './candidateProjection';

function requirePlan(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
): AuthoredBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey);
  if (plan === undefined) {
    throw new Error(`${routeKey}.${biomeKey} fixture is missing`);
  }
  return plan;
}

function requireOccurrence(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  gameName: string,
): RoomOccurrence {
  const occurrence = requirePlan(project, routeKey, biomeKey).topology?.occurrences.find(
    (candidate) => candidate.gameName === gameName,
  );
  if (occurrence === undefined) {
    throw new Error(`${routeKey}.${biomeKey} has no ${gameName} occurrence`);
  }
  return occurrence;
}

function requireCountedBinding(gameName: string): CountedRewardBinding {
  const binding = catalog.rooms.byKey[gameName]?.incomingReward;
  if (binding?.kind !== 'countedChoice') {
    throw new Error(`${gameName} has no counted incoming reward`);
  }
  return binding;
}

function requireIncomingOffer(occurrence: RoomOccurrence): ResolvedRewardOffer {
  if (occurrence.state.kind === 'counted' || occurrence.state.kind === 'ephyraCombat') {
    return occurrence.state.offer;
  }
  throw new Error(`${occurrence.gameName} has no editable incoming offer`);
}

describe('producer-resolved reward type domains', () => {
  it('resolves F, G, H, and I producers without a binding-union fallback', () => {
    const project = createGoldenFGHIProject(catalog);
    const service = createCandidateProjectionService(catalog, (candidate) =>
      simulateProject(catalog, candidate),
    );

    for (const [biomeKey, gameName] of [
      ['F', 'F_Combat03'],
      ['G', 'G_Combat01'],
    ] as const) {
      const occurrence = requireOccurrence(project, 'Underworld', biomeKey, gameName);
      const domain = service.countedRewardTypes(
        project,
        {
          kind: 'incomingReward',
          address: createIncomingRewardAddress(
            createBiomeAddress('Underworld', biomeKey),
            occurrence.occurrenceId,
          ),
        },
        requireCountedBinding(gameName),
        requireIncomingOffer(occurrence).rewardType,
      );
      expect(domain).toContain('MaxHealthDrop');
      expect(domain).not.toContain('MetaCurrencyDrop');
    }

    const hOccurrence = requireOccurrence(project, 'Underworld', 'H', 'H_Combat02');
    const hRoom = catalog.rooms.byKey.H_Combat02;
    const cages = hRoom?.localChildren.find(
      (descriptor) => descriptor.kind === 'boundedRewardSlots' && descriptor.key === 'cages',
    );
    if (cages?.kind !== 'boundedRewardSlots' || hOccurrence.state.kind !== 'fieldsCombat') {
      throw new Error('H cage fixture is missing');
    }
    const hDomain = service.countedRewardTypes(
      project,
      {
        kind: 'localReward',
        address: createLocalRewardAddress(
          createBiomeAddress('Underworld', 'H'),
          hOccurrence.occurrenceId,
          'cages',
          'cage1',
        ),
      },
      cages.reward,
      hOccurrence.state.cages.cage1!.rewardType,
    );
    expect(hDomain).toContain('MaxHealthDrop');
    expect(hDomain).not.toContain('Devotion');
    expect(hDomain).not.toContain('MetaCurrencyDrop');

    const iOccurrence = requireOccurrence(project, 'Underworld', 'I', 'I_Combat03');
    const iDomain = service.countedRewardTypes(
      project,
      {
        kind: 'incomingReward',
        address: createIncomingRewardAddress(
          createBiomeAddress('Underworld', 'I'),
          iOccurrence.occurrenceId,
        ),
      },
      requireCountedBinding('I_Combat03'),
      requireIncomingOffer(iOccurrence).rewardType,
    );
    expect(iDomain).toContain('RoomMoneyTripleDrop');
    expect(iDomain).not.toContain('Boon');
    expect(iDomain).not.toContain('MetaCurrencyDrop');
  });

  it('resolves N, O, P, and Q producer families and keeps shop groups separate', () => {
    const project = createRepresentativeNOPQProject();
    const service = createCandidateProjectionService(catalog, (candidate) =>
      simulateProject(catalog, candidate),
    );

    const nOccurrence = requireOccurrence(project, 'Surface', 'N', 'N_Combat05');
    const nDomain = service.countedRewardTypes(
      project,
      {
        kind: 'incomingReward',
        address: createIncomingRewardAddress(nBiome, nOccurrence.occurrenceId),
      },
      requireCountedBinding('N_Combat05'),
      requireIncomingOffer(nOccurrence).rewardType,
    );
    expect(nDomain).toContain('MaxHealthDropBig');
    expect(nDomain).not.toContain('MetaCurrencyDrop');

    if (nOccurrence.state.kind !== 'ephyraCombat') {
      throw new Error('N side-room fixture is missing');
    }
    const nParentRoom = catalog.rooms.byKey.N_Combat05;
    const nSideDescriptor = nParentRoom?.localChildren.find(
      (descriptor) => descriptor.kind === 'fixedRoomSlots' && descriptor.key === 'sideRooms',
    );
    const nSideSlot =
      nSideDescriptor?.kind === 'fixedRoomSlots' ? nSideDescriptor.slots[0] : undefined;
    const nSideBinding =
      nSideSlot === undefined
        ? undefined
        : catalog.rooms.byKey[nSideSlot.roomGameName]?.incomingReward;
    const nSideState = nOccurrence.state.sideRooms.sideDoor1;
    if (nSideBinding?.kind !== 'countedChoice' || nSideState === undefined) {
      throw new Error('N side-door reward producer is missing');
    }
    const nSideDomain = service.countedRewardTypes(
      project,
      {
        kind: 'localReward',
        address: createLocalRewardAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
      },
      nSideBinding,
      nSideState.offer.rewardType,
    );
    expect(nSideDomain).toContain('MaxManaDropSmall');
    expect(nSideDomain).toContain('MetaCurrencyDrop');
    expect(nSideDomain).not.toContain('Boon');

    const oOccurrence = requireOccurrence(project, 'Surface', 'O', 'O_Combat04');
    const oProfile =
      catalog.encounterProfiles.byKey[catalog.rooms.byKey.O_Combat04!.encounterProfileKey];
    const wheel = oProfile?.phases.find((phase) => phase.offerPoint?.key === 'wheel1')?.offerPoint;
    if (
      wheel?.kind !== 'rewardWheel' ||
      oOccurrence.state.kind !== 'shipCombat' ||
      oOccurrence.state.wheels.wheel1 === undefined
    ) {
      throw new Error('O wheel fixture is missing');
    }
    const oWheelState = oOccurrence.state.wheels.wheel1;
    const oDomain = service.countedRewardTypes(
      project,
      {
        kind: 'rewardWheelOffer',
        address: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer1'),
      },
      wheel.reward,
      oWheelState.offers.offer1!.rewardType,
    );
    expect(oDomain).toContain('MaxHealthDrop');
    expect(oDomain).not.toContain('MetaCurrencyDrop');

    for (const [biomeKey, gameName, included, excluded] of [
      ['P', 'P_Combat03', 'MaxHealthDrop', 'MetaCurrencyDrop'],
      ['Q', 'Q_MiniBoss02', 'TalentBigDrop', 'MaxHealthDrop'],
    ] as const) {
      const occurrence = requireOccurrence(project, 'Surface', biomeKey, gameName);
      const domain = service.countedRewardTypes(
        project,
        {
          kind: 'incomingReward',
          address: createIncomingRewardAddress(
            createBiomeAddress('Surface', biomeKey),
            occurrence.occurrenceId,
          ),
        },
        requireCountedBinding(gameName),
        requireIncomingOffer(occurrence).rewardType,
      );
      expect(domain).toContain(included);
      expect(domain).not.toContain(excluded);
    }

    const worldShop = catalog.rewards.shops.byKey.WorldShop;
    expect(worldShop?.groups.byKey.Boon?.rewardTypes).toContain('RandomLoot');
    expect(worldShop?.groups.byKey.Boon?.rewardTypes).not.toContain('MaxHealthDrop');
    expect(worldShop?.groups.byKey.MajorNonBoon?.rewardTypes).toContain('MaxHealthDrop');
    expect(worldShop?.groups.byKey.MajorNonBoon?.rewardTypes).not.toContain('RandomLoot');
  });
});
