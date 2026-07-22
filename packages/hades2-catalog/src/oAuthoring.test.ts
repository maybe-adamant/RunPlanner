import {
  applyProjectCommand,
  createBiomeAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  semanticAddressKey,
  type LinearBiomePlan,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const oBiome = createBiomeAddress('Surface', 'O');

function createOProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'o-authored-fixture',
    name: 'O Authored Fixture',
    configuredBiomeCounts: { Surface: 2 },
  });
}

function oPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.biomeKey === 'O');
  if (plan?.kind !== 'LinearBiome') {
    throw new Error('fixture has no O plan');
  }
  return plan;
}

function startO(project: ProjectDocument): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: oBiome,
    occurrenceId: createOccurrenceId('o-intro'),
    gameName: 'O_Intro',
  });
}

function appendRoom(
  project: ProjectDocument,
  parentOccurrenceId: OccurrenceId,
  occurrenceId: OccurrenceId,
  gameName: string,
): ProjectDocument {
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(oBiome, parentOccurrenceId),
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(oBiome, parentOccurrenceId, 1),
    occurrenceId,
    gameName,
  });
  return applyProjectCommand(next, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(oBiome, parentOccurrenceId),
    exitIndex: 1,
  });
}

function occurrence(project: ProjectDocument, occurrenceId: OccurrenceId) {
  const value = oPlan(project).topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (value === undefined) {
    throw new Error(`missing occurrence ${occurrenceId}`);
  }
  return value;
}

describe('O authored topology', () => {
  it('switches batch store authority at ShipCombat boundaries', () => {
    const combat = createOccurrenceId('o-combat');
    const reprieve = createOccurrenceId('o-reprieve');
    let project = appendRoom(
      startO(createOProject()),
      createOccurrenceId('o-intro'),
      combat,
      'O_Combat01',
    );

    expect(oPlan(project).topology?.continuations[0]).toMatchObject({
      rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
    });

    project = appendRoom(project, combat, reprieve, 'O_Reprieve01');
    expect(oPlan(project).topology?.continuations[1]).toMatchObject({
      rewardStore: { kind: 'sourceOfferPoint' },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(oBiome, reprieve),
    });
    expect(oPlan(project).topology?.continuations[2]).toMatchObject({
      rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, reprieve),
      gameName: 'O_Combat02',
    });
    expect(oPlan(project).topology?.continuations[2]).toMatchObject({
      rewardStore: { kind: 'sourceOfferPoint' },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, reprieve),
      gameName: 'O_Reprieve01',
    });
    expect(oPlan(project).topology?.continuations[2]).toMatchObject({
      rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('owns complete wheel state and retains dormant second-wheel authorship', () => {
    const combat = createOccurrenceId('o-wheel-combat');
    let project = appendRoom(
      startO(createOProject()),
      createOccurrenceId('o-intro'),
      combat,
      'O_Combat03',
    );
    const wheel2 = createRewardWheelAddress(oBiome, combat, 'wheel2');

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, combat),
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel: wheel2,
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: wheel2,
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, combat, 'wheel2', 'offer2'),
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelPicked',
      wheel: wheel2,
      pickedOfferIndex: 2,
    });

    expect(occurrence(project, combat).state).toMatchObject({
      kind: 'shipCombat',
      encounterCount: 3,
      wheels: {
        wheel2: {
          storeKey: 'MetaProgress',
          offerCount: 2,
          offers: { offer2: { rewardType: 'MetaCurrencyDrop' } },
          pickedOfferIndex: 2,
        },
      },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, combat),
      encounterCount: 2,
    });
    expect(occurrence(project, combat).state).toMatchObject({
      kind: 'shipCombat',
      encounterCount: 2,
      wheels: {
        wheel2: {
          storeKey: 'MetaProgress',
          offerCount: 2,
          offers: { offer2: { rewardType: 'MetaCurrencyDrop' } },
          pickedOfferIndex: 2,
        },
      },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel: wheel2,
      offerCount: 1,
    });
    expect(occurrence(project, combat).state).toMatchObject({
      kind: 'shipCombat',
      wheels: {
        wheel2: {
          offerCount: 1,
          offers: { offer2: { rewardType: 'MetaCurrencyDrop' } },
          pickedOfferIndex: 1,
        },
      },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('rejects wheel edits outside the declaration contract', () => {
    const combat = createOccurrenceId('o-invalid-wheel-combat');
    const project = appendRoom(
      startO(createOProject()),
      createOccurrenceId('o-intro'),
      combat,
      'O_Combat04',
    );

    for (const command of [
      {
        kind: 'ReplaceRewardWheelOfferCount' as const,
        wheel: createRewardWheelAddress(oBiome, combat, 'wheel1'),
        offerCount: 3,
      },
      {
        kind: 'ReplaceRewardWheelStore' as const,
        wheel: createRewardWheelAddress(oBiome, combat, 'wheel1'),
        storeKey: 'UnknownStore',
      },
      {
        kind: 'ReplaceRewardWheelPicked' as const,
        wheel: createRewardWheelAddress(oBiome, combat, 'wheel1'),
        pickedOfferIndex: 2,
      },
      {
        kind: 'ReplaceRewardWheelOffer' as const,
        offer: createRewardWheelOfferAddress(oBiome, combat, 'wheel1', 'offer3'),
        value: {
          rewardType: 'Boon' as const,
          payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' },
        },
      },
    ]) {
      expect(() => applyProjectCommand(project, catalog, command)).toThrowError(
        ProjectCommandContractError,
      );
    }
  });

  it('replaces fixed Devotion payloads without changing their reward type', () => {
    const devotion = createOccurrenceId('o-devotion');
    let project = appendRoom(
      startO(createOProject()),
      createOccurrenceId('o-intro'),
      devotion,
      'O_Devotion01',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(oBiome, devotion),
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'HeraUpgrade',
          spurnedSource: 'PoseidonUpgrade',
        },
      },
    });

    expect(occurrence(project, devotion).state).toEqual({
      kind: 'fixed',
      payload: {
        kind: 'DevotionPair',
        chosenSource: 'HeraUpgrade',
        spurnedSource: 'PoseidonUpgrade',
      },
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(oBiome, devotion),
        value: { rewardType: 'Story' },
      }),
    ).toThrowError(ProjectCommandContractError);
  });

  it('authors a single entered direct preboss occurrence', () => {
    const roomIds = Array.from({ length: 6 }, (_, index) =>
      createOccurrenceId(`o-batch-${index + 1}`),
    );
    let project = startO(createOProject());
    let parent = createOccurrenceId('o-intro');
    for (const [index, roomId] of roomIds.entries()) {
      project = appendRoom(
        project,
        parent,
        roomId,
        `O_Combat${String(index + 1).padStart(2, '0')}`,
      );
      parent = roomId;
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTerminalTransition',
      continuation: createContinuationAddress(oBiome, parent),
      targetOccurrenceIds: [createOccurrenceId('o-preboss')],
    });

    expect(oPlan(project).topology?.continuations.at(-1)).toEqual({
      kind: 'terminal',
      parentOccurrenceId: parent,
      rewardStore: { kind: 'sourceOfferPoint' },
      targets: [{ exitIndex: 1, occurrenceId: createOccurrenceId('o-preboss') }],
      pickedExitIndex: 1,
    });
    expect(occurrence(project, createOccurrenceId('o-preboss'))).toMatchObject({
      gameName: 'O_PreBoss01',
      state: { kind: 'shop', shop: expect.any(Object) },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    const malformed = JSON.parse(encodeProjectDocument(project));
    malformed.routes[1].biomes[1].topology.continuations.at(-1).pickedExitIndex = null;
    expect(() => decodeProjectDocument(malformed, catalog)).toThrowError(
      ProjectDocumentContractError,
    );
    const missingStore = JSON.parse(encodeProjectDocument(project));
    delete missingStore.routes[1].biomes[1].topology.continuations.at(-1).rewardStore;
    expect(() => decodeProjectDocument(missingStore, catalog)).toThrowError(
      ProjectDocumentContractError,
    );
  });

  it('rejects malformed source authority and keys wheel addresses canonically', () => {
    const combat = createOccurrenceId('o-codec-combat');
    const project = appendRoom(
      startO(createOProject()),
      createOccurrenceId('o-intro'),
      combat,
      'O_Combat05',
    );
    const withBatch = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(oBiome, combat),
    });
    const encoded = JSON.parse(encodeProjectDocument(withBatch));
    encoded.routes[1].biomes[1].topology.continuations[1].rewardStore = {
      kind: 'authoredBaseStore',
      baseRewardStoreKey: 'RunProgress',
    };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrowError(
      ProjectDocumentContractError,
    );

    expect(semanticAddressKey(createRewardWheelAddress(oBiome, combat, 'wheel1'))).toBe(
      '["rewardWheel","Surface","O","o-codec-combat","wheel1"]',
    );
    expect(
      semanticAddressKey(createRewardWheelOfferAddress(oBiome, combat, 'wheel1', 'offer2')),
    ).toBe('["rewardWheelOffer","Surface","O","o-codec-combat","wheel1","offer2"]');
  });
});
