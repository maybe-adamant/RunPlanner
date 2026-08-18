import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createProjectDocument,
  createProjectHistory,
  createRoomActionAddress,
  redoProjectHistory,
  roomActionKey,
  undoProjectHistory,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';

const biome = createBiomeAddress('Underworld', 'F');
const occurrenceId = createOccurrenceId('room-actions-start');
const reward: RoomActionReference = {
  kind: 'interactIncomingReward',
  producerPoint: 'roomRewardPickup',
  acquisitionRole: 'source',
};
const invented: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'invented' };

function action(reference: RoomActionReference) {
  return createRoomActionAddress(biome, occurrenceId, roomActionKey(reference));
}

function project(): ProjectDocument {
  const initial = applyProjectCommand(
    createProjectDocument(catalog, {
      projectId: 'room-actions',
      name: 'Room Actions',
      configuredBiomeCounts: { Underworld: 1 },
    }),
    catalog,
    {
      kind: 'CreateStart',
      biome,
      occurrenceId,
      gameName: 'F_Opening01',
    },
  );
  return applyProjectCommand(initial, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, occurrenceId),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
}

function occurrence(document: ProjectDocument) {
  const value = document.routes[0]?.biomes[0]?.topology?.occurrences[0];
  if (value === undefined) throw new Error('missing F start occurrence');
  return value;
}

describe('room-action commands', () => {
  it('inserts and removes an exact active reference without rewriting occurrence payload', () => {
    const initial = project();
    const original = occurrence(initial);
    let document = applyProjectCommand(initial, catalog, {
      kind: 'InsertRoomAction',
      action: action(reward),
      reference: reward,
      index: 0,
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'RemoveRoomAction',
      action: action(reward),
    });

    const edited = occurrence(document);
    expect(edited.roomActions.order).toEqual([]);
    expect(edited.state).toEqual(original.state);
    expect(edited.encounters).toEqual(original.encounters);
    expect(edited.additionalExits).toEqual(original.additionalExits);
  });

  it('rejects mismatched references, duplicates, unknown rows, and invalid indices', () => {
    const initial = project();
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'InsertRoomAction',
        action: action(invented),
        reference: reward,
        index: 0,
      }),
    ).toThrow('reference does not match');
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'InsertRoomAction',
        action: action(invented),
        reference: invented,
        index: 0,
      }),
    ).toThrow('room action is not active for this occurrence');
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'InsertRoomAction',
        action: action(reward),
        reference: reward,
        index: 1,
      }),
    ).toThrow('index must be an integer from 0 through 0');

    const inserted = applyProjectCommand(initial, catalog, {
      kind: 'InsertRoomAction',
      action: action(reward),
      reference: reward,
      index: 0,
    });
    expect(() =>
      applyProjectCommand(inserted, catalog, {
        kind: 'InsertRoomAction',
        action: action(reward),
        reference: reward,
        index: 1,
      }),
    ).toThrow('already ordered');
    expect(() =>
      applyProjectCommand(inserted, catalog, {
        kind: 'RemoveRoomAction',
        action: action(invented),
      }),
    ).toThrow('not ordered');
    expect(() =>
      applyProjectCommand(inserted, catalog, {
        kind: 'MoveRoomAction',
        action: action(reward),
        toIndex: 1,
      }),
    ).toThrow('toIndex must be an integer from 0 through 0');
  });

  it('records each effective order edit as one semantic history entry', () => {
    const initial = createProjectHistory(project());
    const inserted = applyProjectHistoryCommand(initial, catalog, {
      kind: 'InsertRoomAction',
      action: action(reward),
      reference: reward,
      index: 0,
    });
    const removed = applyProjectHistoryCommand(inserted, catalog, {
      kind: 'RemoveRoomAction',
      action: action(reward),
    });

    expect(removed.past).toHaveLength(2);
    expect(occurrence(removed.present).roomActions.order).toEqual([]);
    const undone = undoProjectHistory(removed);
    expect(undone.present).toBe(inserted.present);
    expect(redoProjectHistory(undone).present).toBe(removed.present);
  });

  it('keeps an Artificer replacement payload dormant while rejecting raw insertion until its source role reactivates', () => {
    const source = createIncomingRewardAddress(biome, occurrenceId);
    const acquisition = createAcquisitionRoleAddress(source, 'source');
    const site = artificerAcquisitionSite(createOccurrenceAddress(biome, occurrenceId), source);
    const siteKey = acquisitionSiteStorageKey(site);
    const entryKey = artificerReplacementEntryKey(source, 'source');
    const replacement: RoomActionReference = {
      kind: 'interactAcquisitionEntry',
      siteKey,
      entryKey,
    };
    let active = applyProjectCommand(project(), catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'artificer' },
    });
    active = applyProjectCommand(active, catalog, {
      kind: 'InsertRoomAction',
      action: action(replacement),
      reference: replacement,
      index: 0,
    });
    let dormant = applyProjectCommand(active, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'normal' },
    });
    expect(occurrence(dormant).acquisitionSites?.[siteKey]?.pickupEntries).toHaveProperty(
      entryKey,
      null,
    );
    dormant = applyProjectCommand(dormant, catalog, {
      kind: 'RemoveRoomAction',
      action: action(replacement),
    });
    expect(() =>
      applyProjectCommand(dormant, catalog, {
        kind: 'InsertRoomAction',
        action: action(replacement),
        reference: replacement,
        index: 0,
      }),
    ).toThrow('room action is not active for this occurrence');

    const restored = applyProjectCommand(dormant, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'artificer' },
    });
    expect(() =>
      applyProjectCommand(restored, catalog, {
        kind: 'InsertRoomAction',
        action: action(replacement),
        reference: replacement,
        index: 0,
      }),
    ).not.toThrow();
    expect(occurrence(restored).acquisitionSites?.[siteKey]?.pickupEntries).toHaveProperty(
      entryKey,
      null,
    );
  });

  it('preserves authored chronology when room identity is replaced', () => {
    const inserted = applyProjectCommand(project(), catalog, {
      kind: 'InsertRoomAction',
      action: action(reward),
      reference: reward,
      index: 0,
    });
    const replaced = applyProjectCommand(inserted, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, occurrenceId),
      gameName: 'F_Opening02',
    });

    expect(occurrence(replaced).roomActions.order).toEqual([reward]);
  });
});
