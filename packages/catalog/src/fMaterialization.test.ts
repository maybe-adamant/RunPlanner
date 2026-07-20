import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createShopPurchaseAddress,
  createTargetAddress,
  evaluateFCompleteness,
  LinearMaterializationContractError,
  materializeLinearBiome,
  semanticAddressKey,
  type CompleteFCompletenessResult,
  type FCompletenessResult,
  type LinearBiomePlan,
  type ProjectDocument,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const biome = createBiomeAddress('Underworld', 'F');
const startId = createOccurrenceId('f-start');
const firstCombatId = createOccurrenceId('f-combat-first');
const repeatedCombatId = createOccurrenceId('f-combat-repeated');
const deadShopId = createOccurrenceId('f-shop-dead');
const terminalShopId = createOccurrenceId('f-terminal-shop');
const terminalFreeId = createOccurrenceId('f-terminal-free');

function fPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[0];
  if (plan?.biomeKey !== 'F') {
    throw new Error('missing F fixture plan');
  }
  return plan;
}

function completeness(project: ProjectDocument): FCompletenessResult {
  return evaluateFCompleteness(catalog, biome, fPlan(project));
}

function complete(project: ProjectDocument): CompleteFCompletenessResult {
  const result = completeness(project);
  if (result.completion !== 'complete') {
    throw new Error(`fixture is incomplete: ${result.findings.map((finding) => finding.code)}`);
  }
  return result;
}

function emptyFProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'f-materialization',
    name: 'F Materialization',
    configuredBiomeCounts: { Underworld: 1 },
  });
}

function representativeProject(terminalPickedExitIndex: 1 | 2): ProjectDocument {
  let project = applyProjectCommand(emptyFProject(), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: startId,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, startId),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, startId),
    storeKey: 'MetaProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, startId, 1),
    occurrenceId: firstCombatId,
    gameName: 'F_Combat04',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, startId),
    exitIndex: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, firstCombatId),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, firstCombatId, 1),
    occurrenceId: repeatedCombatId,
    gameName: 'F_Combat04',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, firstCombatId, 2),
    occurrenceId: deadShopId,
    gameName: 'F_Shop01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, firstCombatId),
    exitIndex: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, repeatedCombatId),
    targetOccurrenceIds: [terminalShopId, terminalFreeId],
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, repeatedCombatId),
    exitIndex: terminalPickedExitIndex,
  });
  if (terminalPickedExitIndex === 1) {
    project = applyProjectCommand(project, catalog, {
      kind: 'SetShopPurchase',
      purchase: createShopPurchaseAddress(biome, terminalShopId, 'Boon'),
      purchased: true,
    });
  }
  return project;
}

function oneExitTerminalProject(): ProjectDocument {
  let project = applyProjectCommand(emptyFProject(), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: startId,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, startId),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, startId, 1),
    occurrenceId: firstCombatId,
    gameName: 'F_Combat01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, startId),
    exitIndex: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, firstCombatId),
    targetOccurrenceIds: [terminalShopId],
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, firstCombatId),
    exitIndex: 1,
  });
}

function singleTargetProject(gameName: string): ProjectDocument {
  let project = applyProjectCommand(emptyFProject(), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: startId,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, startId),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, startId, 1),
    occurrenceId: firstCombatId,
    gameName,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, startId),
    exitIndex: 1,
  });
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new Error(`missing fixture room ${gameName}`);
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, firstCombatId),
    targetOccurrenceIds: [terminalShopId, terminalFreeId].slice(0, room.exits.length),
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, firstCombatId),
    exitIndex: 1,
  });
}

describe('canonical F materialization', () => {
  it('requires a complete biome result at the public materialization boundary', () => {
    const incomplete = completeness(emptyFProject());

    expect(() =>
      materializeLinearBiome(catalog, biome, incomplete as unknown as CompleteFCompletenessResult),
    ).toThrowError(
      new LinearMaterializationContractError(
        'linear materialization requires a complete biome result',
      ),
    );
  });

  it('materializes addressed batches, repeated rooms, dormant peers, and a picked shop', () => {
    const snapshot = materializeLinearBiome(catalog, biome, complete(representativeProject(1)));

    expect(snapshot).toMatchObject({
      kind: 'LinearBiome',
      routeKey: 'Underworld',
      biomeKey: 'F',
      biomeState: {},
    });
    expect(snapshot.entryRooms).toHaveLength(1);
    expect(snapshot.entryRooms[0]).toMatchObject({
      gameName: 'F_Opening01',
      lifecycleProfileKey: 'StandardRewardRoom',
      entered: true,
      incomingReward: { resolvedStoreKey: 'RunProgress' },
    });

    expect(snapshot.batches).toHaveLength(2);
    expect(snapshot.batches[0]).toMatchObject({
      parent: { occurrenceId: startId, gameName: 'F_Opening01' },
      rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'MetaProgress' },
      pickedExitIndex: 1,
    });
    expect(semanticAddressKey(snapshot.batches[0]!.rewardStore.origin)).toBe(
      '["batchRewardStore","Underworld","F","f-start"]',
    );
    expect(snapshot.batches[0]!.targets[0]).toMatchObject({
      exit: {
        kind: 'available',
        index: 1,
        type: 'ErebusExitDoor',
        compatibilityPolicyKey: 'Unconstrained',
      },
      picked: true,
      continuation: 'continuesSpine',
      room: {
        occurrenceId: firstCombatId,
        gameName: 'F_Combat04',
        entered: true,
        incomingReward: { resolvedStoreKey: 'MetaProgress' },
      },
    });

    const repeated = snapshot.batches[1]!.targets[0]!;
    const deadShop = snapshot.batches[1]!.targets[1]!;
    expect(repeated.room.gameName).toBe('F_Combat04');
    expect(repeated.room.occurrenceId).not.toBe(firstCombatId);
    expect(semanticAddressKey(repeated.room.origin)).toBe(
      '["occurrence","Underworld","F","f-combat-repeated"]',
    );
    expect(deadShop).toMatchObject({
      picked: false,
      continuation: 'deadLeaf',
      room: {
        gameName: 'F_Shop01',
        entered: false,
        lifecycleProfileKey: 'WorldShopRoom',
        incomingReward: { producerKind: 'shop', resolvedStoreKey: 'RunProgress' },
      },
    });
    expect(deadShop.room).not.toHaveProperty('entryState');

    expect(snapshot.terminalEntry.targets).toHaveLength(2);
    const terminalShop = snapshot.terminalEntry.targets[0]!;
    const terminalFree = snapshot.terminalEntry.targets[1]!;
    expect(terminalShop).toMatchObject({
      picked: true,
      continuation: 'entersTerminal',
      room: {
        gameName: 'F_PreBoss01',
        entered: true,
        lifecycleProfileKey: 'TerminalWorldShopRoom',
        incomingReward: { producerKind: 'shop', resolvedStoreKey: 'RunProgress' },
        entryState: { kind: 'shop', profileKey: 'WorldShop' },
      },
    });
    expect(terminalShop.room.entryState?.offers.map((offer) => offer.offerKey)).toEqual([
      'Boon',
      'MajorNonBoon',
      'Minor',
    ]);
    expect(terminalShop.room.entryState?.offers[0]).toMatchObject({ purchased: true });
    expect(semanticAddressKey(terminalShop.room.entryState!.offers[0]!.purchaseOrigin)).toBe(
      '["shopPurchase","Underworld","F","f-terminal-shop","Boon"]',
    );
    expect(terminalFree).toMatchObject({
      picked: false,
      continuation: 'deadLeaf',
      room: {
        gameName: 'F_PreBoss01',
        entered: false,
        lifecycleProfileKey: 'TerminalRewardRoom',
        incomingReward: { producerKind: 'freeReward', resolvedStoreKey: 'RunProgress' },
      },
    });

    expect(snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'F_Boss01',
      'F_PostBoss01',
    ]);
    expect(snapshot.completionRooms.map((room) => semanticAddressKey(room.origin))).toEqual([
      '["completionRoom","Underworld","F","boss"]',
      '["completionRoom","Underworld","F","postboss"]',
    ]);
    expect(snapshot).not.toHaveProperty('validity');
    expect(snapshot).not.toHaveProperty('candidates');
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.batches)).toBe(true);
    expect(Object.isFrozen(snapshot.terminalEntry.targets)).toBe(true);
  });

  it('materializes a picked free terminal without dormant shop entry state', () => {
    const snapshot = materializeLinearBiome(catalog, biome, complete(representativeProject(2)));
    const shop = snapshot.terminalEntry.targets[0]!.room;
    const free = snapshot.terminalEntry.targets[1]!;

    expect(shop.entered).toBe(false);
    expect(shop).not.toHaveProperty('entryState');
    expect(free).toMatchObject({
      picked: true,
      continuation: 'entersTerminal',
      room: {
        entered: true,
        lifecycleProfileKey: 'TerminalRewardRoom',
        incomingReward: { producerKind: 'freeReward' },
      },
    });
  });

  it('derives one terminal target from a one-exit predecessor', () => {
    const snapshot = materializeLinearBiome(catalog, biome, complete(oneExitTerminalProject()));

    expect(snapshot.terminalEntry.predecessor).toMatchObject({
      occurrenceId: firstCombatId,
      gameName: 'F_Combat01',
    });
    expect(snapshot.terminalEntry.targets).toHaveLength(1);
    expect(snapshot.terminalEntry.targets[0]).toMatchObject({
      exit: { kind: 'available', index: 1 },
      picked: true,
      room: { lifecycleProfileKey: 'TerminalWorldShopRoom' },
    });
  });

  it.each([
    ['F_MiniBoss01', 'StandardRewardRoom', 'countedChoice'],
    ['F_Story01', 'StandardRewardRoom', 'fixed'],
    ['F_Reprieve01', 'StandardRewardRoom', 'countedChoice'],
    ['F_Shop01', 'WorldShopRoom', 'shop'],
  ] as const)(
    'dispatches the %s template through its concrete F room materializer',
    (gameName, lifecycleProfileKey, producerKind) => {
      const snapshot = materializeLinearBiome(
        catalog,
        biome,
        complete(singleTargetProject(gameName)),
      );
      const room = snapshot.batches[0]!.targets[0]!.room;

      expect(room).toMatchObject({
        gameName,
        entered: true,
        lifecycleProfileKey,
        incomingReward: { producerKind },
      });
      if (gameName === 'F_Shop01') {
        expect(room.entryState).toMatchObject({ kind: 'shop', profileKey: 'WorldShop' });
      }
    },
  );
});
