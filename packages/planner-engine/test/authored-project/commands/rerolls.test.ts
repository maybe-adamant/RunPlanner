import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectCommand,
  type ProjectDocument,
  type RerollRoomAction,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  loadUnderworldFGCheckpoint,
  loadUnderworldFStygianWellCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import { withArcana } from '../../support/rerolls';

const f = createBiomeAddress('Underworld', 'F');
const source = 'golden-f-b2-e1';
const target = 'golden-f-b3-e2';
const owner = createIncomingRewardAddress(f, target as never);

function occurrence(project: ProjectDocument, id: string) {
  return project.route.biomes[0]!.topology!.occurrences.find((room) => room.occurrenceId === id)!;
}

function rerollIds(project: ProjectDocument): readonly string[] {
  return occurrence(project, source).roomActions.order.flatMap((reference) =>
    reference.kind === 'reroll' ? [(reference as RerollRoomAction).rerollId] : [],
  );
}

function insertReroll(project: ProjectDocument, reward: ResolvedRewardOffer): ProjectCommand {
  return {
    kind: 'InsertReroll',
    occurrence: createOccurrenceAddress(f, source as never),
    target: { kind: 'door', exitKey: 'exit2', occurrenceId: target as never },
    reward,
    index: occurrence(project, source).roomActions.order.length,
  };
}

const removeReroll = (rerollId: string): ProjectCommand => ({
  kind: 'RemoveRoomAction',
  action: createRoomActionAddress(f, source as never, JSON.stringify(['reroll', rerollId])),
});

const zeus: ResolvedRewardOffer = {
  rewardType: 'Boon',
  payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
};

describe('reroll room actions', () => {
  it('give each press the lowest free identity and keep the others', () => {
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    project = applyProjectCommand(
      project,
      catalog,
      insertReroll(project, { rewardType: 'RoomMoneyDrop' }),
    );
    project = applyProjectCommand(
      project,
      catalog,
      insertReroll(project, { rewardType: 'RoomMoneyDrop' }),
    );
    project = applyProjectCommand(project, catalog, removeReroll('r1'));
    expect(rerollIds(project)).toEqual(['r2']);
    project = applyProjectCommand(
      project,
      catalog,
      insertReroll(project, { rewardType: 'RoomMoneyDrop' }),
    );
    expect(rerollIds(project)).toEqual(['r2', 'r1']);
  });

  it('refuse a target that is not a door, cage or wheel offer of the room', () => {
    const project = loadUnderworldFGCheckpoint();
    expect(() =>
      applyProjectCommand(project, catalog, {
        ...insertReroll(project, { rewardType: 'RoomMoneyDrop' }),
        target: { kind: 'door', exitKey: 'exit9', occurrenceId: target as never },
      } as ProjectCommand),
    ).toThrow('names no door of this room');
    expect(() =>
      applyProjectCommand(project, catalog, {
        ...insertReroll(project, { rewardType: 'RoomMoneyDrop' }),
        target: { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer1' },
      } as ProjectCommand),
    ).toThrow('names no wheel offer of this room');
  });
});

describe('rerolled rewards', () => {
  it('follow the effective offer while unauthored and leave with the last reroll', () => {
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    project = applyProjectCommand(
      project,
      catalog,
      insertReroll(project, { rewardType: 'StackUpgrade' }),
    );
    expect(occurrence(project, target).rerolledIncomingReward?.offer).toEqual({
      rewardType: 'StackUpgrade',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRerollReward',
      action: createRoomActionAddress(f, source as never, JSON.stringify(['reroll', 'r1'])),
      reward: { rewardType: 'RoomMoneyDrop' },
    });
    expect(occurrence(project, target).rerolledIncomingReward?.offer).toEqual({
      rewardType: 'RoomMoneyDrop',
    });
    project = applyProjectCommand(project, catalog, removeReroll('r1'));
    expect(occurrence(project, target).rerolledIncomingReward).toBeUndefined();
  });

  it('keep an authored acquisition when its reroll leaves, until it is dropped', () => {
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    project = applyProjectCommand(project, catalog, insertReroll(project, zeus));
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: {
        kind: 'traitOffer',
        routeKey: 'Underworld',
        biomeKey: 'F',
        owner,
        acquisitionRole: 'source',
      },
      value: {
        kind: 'traits',
        giverKey: 'Zeus',
        options: [
          { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
          { traitKey: 'ZeusCastBoon', rarity: 'Common' },
          { traitKey: 'ZeusSprintBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    });
    const authored = occurrence(project, target).rerolledIncomingReward;
    expect(authored?.traitOffersByAcquisitionRole.source).toMatchObject({ giverKey: 'Zeus' });
    // The first draw keeps its own payload while rerolled.
    expect(occurrence(project, target).state).toEqual(
      occurrence(loadUnderworldFGCheckpoint(), target).state,
    );

    const dormant = applyProjectCommand(project, catalog, removeReroll('r1'));
    expect(occurrence(dormant, target).rerolledIncomingReward).toEqual(authored);
    expect(() =>
      applyProjectCommand(dormant, catalog, { kind: 'AdoptRerolledReward', owner }),
    ).toThrow('owner has no reroll');
    const dropped = applyProjectCommand(dormant, catalog, { kind: 'DropRerolledReward', owner });
    expect(occurrence(dropped, target).rerolledIncomingReward).toBeUndefined();
    expect(applyProjectCommand(dropped, catalog, { kind: 'DropRerolledReward', owner })).toBe(
      dropped,
    );
  });

  it('adopt the effective offer explicitly', () => {
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    project = applyProjectCommand(
      project,
      catalog,
      insertReroll(project, { rewardType: 'RoomMoneyDrop' }),
    );
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      route: { biomes: { topology: { occurrences: Record<string, unknown>[] } }[] };
    };
    const room = encoded.route.biomes[0]!.topology.occurrences.find(
      (entry) => entry.occurrenceId === target,
    )!;
    (room.rerolledIncomingReward as { offer: unknown }).offer = { rewardType: 'MaxManaDrop' };
    const mismatched = decodeProjectDocument(encoded as never, catalog);
    expect(occurrence(mismatched, target).rerolledIncomingReward?.offer).toEqual({
      rewardType: 'MaxManaDrop',
    });
    const adopted = applyProjectCommand(mismatched, catalog, {
      kind: 'AdoptRerolledReward',
      owner,
    });
    expect(occurrence(adopted, target).rerolledIncomingReward).toEqual(
      occurrence(project, target).rerolledIncomingReward,
    );
    expect(applyProjectCommand(adopted, catalog, { kind: 'AdoptRerolledReward', owner })).toBe(
      adopted,
    );
  });
});

describe('Hub rerolls', () => {
  it('stay in the Hub order when it is replaced', () => {
    const project = applyProjectCommand(
      withArcana(loadSurfaceNProject(), ['DoorReroll']),
      catalog,
      {
        kind: 'InsertHubReroll',
        hub: { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' },
        hubSlotKey: 'combat05',
        reward: { rewardType: 'MaxHealthDrop' },
        index: 0,
      },
    );
    const hub = project.route.biomes[0]!.topology!.decisions.find(
      (decision) => decision.kind === 'hub',
    );
    if (hub?.kind !== 'hub') throw new Error('Surface N has no Hub');
    expect(hub.actions[0]).toMatchObject({ kind: 'reroll', rerollId: 'r1' });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceHubActionOrder',
        hub: { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' },
        actions: hub.actions.slice(1),
      }),
    ).toThrow('Hub action order must keep its rerolls');
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceHubActionOrder',
        hub: { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' },
        actions: [{ ...hub.actions[0]!, rerollId: 'r2' } as never, ...hub.actions.slice(1)],
      }),
    ).toThrow('Hub action order must keep its rerolls');
  });

  it("follow the slot's last press before its visit when the order changes", () => {
    const n = createBiomeAddress('Surface', 'N');
    const hub = { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' } as const;
    const hubActions = (project: ProjectDocument) => {
      const decision = project.route.biomes[0]!.topology!.decisions.find(
        (candidate) => candidate.kind === 'hub',
      );
      if (decision?.kind !== 'hub') throw new Error('Surface N has no Hub');
      return decision.actions;
    };
    // combat09 is the sixth visit; one press in the first stay and one in the fourth.
    const pressed = [
      { index: 0, reward: { rewardType: 'MaxHealthDropBig' } },
      { index: 5, reward: { rewardType: 'MaxManaDropBig' } },
    ].reduce(
      (project, { index, reward }) =>
        applyProjectCommand(project, catalog, {
          kind: 'InsertHubReroll',
          hub,
          hubSlotKey: 'combat09',
          reward,
          index,
        }),
      withArcana(loadSurfaceNProject(), ['DoorReroll']),
    );
    const combat09 = createIncomingRewardAddress(n, 'surface-n-combat09' as never);
    const rerolled = (project: ProjectDocument) =>
      project.route.biomes[0]!.topology!.occurrences.find(
        (room) => room.occurrenceId === combat09.occurrenceId,
      )!.rerolledIncomingReward?.offer;
    expect(rerolled(pressed)).toEqual({ rewardType: 'MaxManaDropBig' });
    // Moving the later press after the visit leaves the earlier one effective.
    const actions = hubActions(pressed);
    const later = actions.findIndex(
      (action) => action.kind === 'reroll' && action.rerollId === 'r2',
    );
    const moved = applyProjectCommand(pressed, catalog, {
      kind: 'ReplaceHubActionOrder',
      hub,
      actions: [...actions.slice(0, later), ...actions.slice(later + 1), actions[later]!],
    });
    expect(rerolled(moved)).toEqual({ rewardType: 'MaxHealthDropBig' });
    // And back before it, the later press is effective again.
    expect(
      rerolled(
        applyProjectCommand(moved, catalog, { kind: 'ReplaceHubActionOrder', hub, actions }),
      ),
    ).toEqual({ rewardType: 'MaxManaDropBig' });
  });
});

describe('Well and Pool rerolls', () => {
  const room = createOccurrenceAddress(f, 'golden-f-preboss-shop:postboss' as never);
  const insert = (
    project: ReturnType<typeof loadUnderworldFStygianWellCheckpoint>,
    kind: 'InsertStygianWellReroll' | 'InsertPurgingPoolReroll',
  ) =>
    applyProjectCommand(project, catalog, {
      kind,
      occurrence: room,
      index: occurrence(project, room.occurrenceId).roomActions.order.length,
    });

  it('allocate separate smallest-free ids per feature and need an interacted feature', () => {
    const project = loadUnderworldFStygianWellCheckpoint();
    const twice = insert(insert(project, 'InsertStygianWellReroll'), 'InsertStygianWellReroll');
    expect(
      occurrence(twice, room.occurrenceId)
        .roomActions.order.filter((action) => action.kind === 'rerollStygianWell')
        .map((action) => (action.kind === 'rerollStygianWell' ? action.rerollId : '')),
    ).toEqual(['r1', 'r2']);
    expect(() => insert(project, 'InsertPurgingPoolReroll')).toThrow(
      'Purging Pool is not being interacted with',
    );
    const pool = insert(
      applyProjectCommand(twice, catalog, {
        kind: 'SetPurgingPoolInteraction',
        occurrence: room,
        interacted: true,
      }),
      'InsertPurgingPoolReroll',
    );
    expect(occurrence(pool, room.occurrenceId).roomActions.order.at(-1)).toEqual({
      kind: 'rerollPurgingPool',
      rerollId: 'r1',
      traitKeyBySlot: {},
    });
    // Turning the Pool off drops its rerolls with its sales.
    const off = applyProjectCommand(pool, catalog, {
      kind: 'SetPurgingPoolInteraction',
      occurrence: room,
      interacted: false,
    });
    expect(
      occurrence(off, room.occurrenceId).roomActions.order.some(
        (action) => action.kind === 'rerollPurgingPool',
      ),
    ).toBe(false);
    expect(() =>
      applyProjectCommand(twice, catalog, {
        kind: 'ReplaceStygianWellRollOffer',
        action: createRoomActionAddress(
          f,
          room.occurrenceId,
          JSON.stringify(['rerollStygianWell', 'r3']),
        ),
        slotKey: 'healing',
        itemKey: 'ArmorBoostStore',
      }),
    ).toThrow('room action is not an ordered Well or Pool reroll');
  });
});

describe('screen reroll counts', () => {
  it('keep a Pom count through a later choice edit', () => {
    const pom = createLevelResolutionAddress(
      createIncomingRewardAddress(f, 'golden-f-b4-e1' as never),
      'self',
    );
    const project = loadUnderworldFGCheckpoint();
    const counted = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: pom,
      value: {
        kind: 'choice',
        offeredTraitKeys: ['ApolloWeaponBoon', 'ZeusSpecialBoon'],
        selectedTraitKey: 'ApolloWeaponBoon',
        rerollCount: 2,
      },
    });
    const resolution = (document: ProjectDocument) => {
      const state = occurrence(document, 'golden-f-b4-e1').state;
      return state.kind === 'counted'
        ? state.reward?.levelResolutionsByAcquisitionRole?.self
        : undefined;
    };
    expect(resolution(counted)).toMatchObject({ rerollCount: 2 });
    const reselected = applyProjectCommand(counted, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: pom,
      value: {
        kind: 'choice',
        offeredTraitKeys: ['ApolloWeaponBoon', 'ZeusSpecialBoon'],
        selectedTraitKey: 'ZeusSpecialBoon',
      },
    });
    expect(resolution(reselected)).toMatchObject({
      selectedTraitKey: 'ZeusSpecialBoon',
      rerollCount: 2,
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceLevelResolution',
        levelResolution: pom,
        value: {
          kind: 'choice',
          offeredTraitKeys: ['ApolloWeaponBoon', 'ZeusSpecialBoon'],
          selectedTraitKey: 'ApolloWeaponBoon',
          rerollCount: -1,
        },
      }),
    ).toThrow('screen reroll count must be a non-negative integer');
  });
});
