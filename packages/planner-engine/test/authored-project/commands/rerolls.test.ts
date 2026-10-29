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
  hubActionOrderRefusal,
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
    // Clearing the order would drop the reroll, so the same answer refuses a reset.
    expect(hubActionOrderRefusal(hub, [])).toBe('rerollsChanged');
    expect(hubActionOrderRefusal(hub, [...hub.actions.slice(1), hub.actions[0]!])).toBeUndefined();
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
    const pool = insert(twice, 'InsertPurgingPoolReroll');
    expect(occurrence(pool, room.occurrenceId).roomActions.order.at(-1)).toEqual({
      kind: 'rerollPurgingPool',
      rerollId: 'r1',
      traitKeyBySlot: {},
    });
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

describe('screen rerolls', () => {
  it('copy the final Pom screen on a reroll, author it and remove it; the final keeps its pick', () => {
    const pom = createLevelResolutionAddress(
      createIncomingRewardAddress(f, 'golden-f-b4-e1' as never),
      'self',
    );
    const project = loadUnderworldFGCheckpoint();
    const resolution = (document: ProjectDocument) => {
      const state = occurrence(document, 'golden-f-b4-e1').state;
      return state.kind === 'counted'
        ? state.reward?.levelResolutionsByAcquisitionRole?.self
        : undefined;
    };
    const chosen = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: pom,
      value: {
        kind: 'choice',
        offeredTraitKeys: ['ApolloWeaponBoon', 'ZeusSpecialBoon'],
        selectedTraitKey: 'ApolloWeaponBoon',
      },
    });
    const twice = [1, 2].reduce(
      (document) =>
        applyProjectCommand(document, catalog, {
          kind: 'InsertLevelScreenReroll',
          levelResolution: pom,
        }),
      chosen,
    );
    expect(resolution(twice)).toEqual({
      kind: 'choice',
      offeredTraitKeys: ['ApolloWeaponBoon', 'ZeusSpecialBoon'],
      selectedTraitKey: 'ApolloWeaponBoon',
      rerolledScreens: [
        { offeredTraitKeys: ['ApolloWeaponBoon', 'ZeusSpecialBoon'] },
        { offeredTraitKeys: ['ApolloWeaponBoon', 'ZeusSpecialBoon'] },
      ],
    });
    const authored = applyProjectCommand(twice, catalog, {
      kind: 'ReplaceRerolledLevelScreen',
      levelResolution: pom,
      index: 0,
      value: { offeredTraitKeys: ['ZeusSpecialBoon'] },
    });
    const reselected = applyProjectCommand(authored, catalog, {
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
      rerolledScreens: [
        { offeredTraitKeys: ['ZeusSpecialBoon'] },
        { offeredTraitKeys: ['ApolloWeaponBoon', 'ZeusSpecialBoon'] },
      ],
    });
    const removed = applyProjectCommand(reselected, catalog, {
      kind: 'RemoveLevelScreenReroll',
      levelResolution: pom,
    });
    expect(resolution(removed)).toMatchObject({
      rerolledScreens: [{ offeredTraitKeys: ['ZeusSpecialBoon'] }],
    });
    expect(
      resolution(
        applyProjectCommand(removed, catalog, {
          kind: 'RemoveLevelScreenReroll',
          levelResolution: pom,
        }),
      ),
    ).not.toHaveProperty('rerolledScreens');
    expect(() =>
      applyProjectCommand(chosen, catalog, {
        kind: 'RemoveLevelScreenReroll',
        levelResolution: pom,
      }),
    ).toThrow('the screen has no reroll');
    expect(() =>
      applyProjectCommand(twice, catalog, {
        kind: 'ReplaceRerolledLevelScreen',
        levelResolution: pom,
        index: 2,
        value: null,
      }),
    ).toThrow('no rerolled screen 2');
    expect(() =>
      applyProjectCommand(twice, catalog, {
        kind: 'ReplaceRerolledLevelScreen',
        levelResolution: pom,
        index: 0,
        value: { offeredTraitKeys: ['ZeusSpecialBoon', 'ZeusSpecialBoon'] },
      }),
    ).toThrow('must be distinct');
  });

  it("move the final Rarify clicks with its rows on a reroll and keep each screen's own clicks", () => {
    const project = withArcana(loadUnderworldFGCheckpoint(), ['ScreenReroll']);
    const zeus = occurrence(project, source).state;
    const offers = zeus.kind === 'counted' ? zeus.reward?.traitOffersByAcquisitionRole : undefined;
    const [role, offer] = Object.entries(offers ?? {})[0]!;
    if (offer?.kind !== 'traits') throw new Error('fixture lacks an authored Zeus screen');
    const trait = {
      kind: 'traitOffer',
      routeKey: 'Underworld',
      biomeKey: 'F',
      owner: createIncomingRewardAddress(f, source as never),
      acquisitionRole: role,
    } as const;
    const current = (document: ProjectDocument) => {
      const state = occurrence(document, source).state;
      const value =
        state.kind === 'counted' ? state.reward?.traitOffersByAcquisitionRole[role] : undefined;
      if (value?.kind !== 'traits') throw new Error('expected a trait offer');
      return value;
    };
    const clicked = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: { ...offer, rarificationActions: ['option2', 'option2'] },
    });
    const rerolled = applyProjectCommand(clicked, catalog, {
      kind: 'InsertTraitScreenReroll',
      trait,
    });
    // The earlier screen is the same native screen: its clicks leave with its rows.
    expect(current(rerolled).rarificationActions).toEqual([]);
    expect(current(rerolled).rerolledScreens?.[0]?.rarificationActions).toEqual([
      'option2',
      'option2',
    ]);
    // An earlier screen without clicks stores none, so the reroll copies no empty list.
    const twice = applyProjectCommand(rerolled, catalog, {
      kind: 'InsertTraitScreenReroll',
      trait,
    });
    expect(current(twice).rerolledScreens?.[1]).not.toHaveProperty('rarificationActions');
    // Editing the final screen keeps every earlier screen's clicks.
    const reselected = applyProjectCommand(twice, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: { ...current(twice), selectedOptionKey: 'option2', rarificationActions: ['option1'] },
    });
    expect(current(reselected).rerolledScreens?.[0]?.rarificationActions).toEqual([
      'option2',
      'option2',
    ]);
    // A replaced earlier screen holds exactly the clicks it is given.
    const screen = current(reselected).rerolledScreens![1]!;
    const replaced = applyProjectCommand(reselected, catalog, {
      kind: 'ReplaceRerolledTraitScreen',
      trait,
      index: 1,
      value: { ...screen, rarificationActions: ['option3'] },
    });
    expect(current(replaced).rerolledScreens?.[1]?.rarificationActions).toEqual(['option3']);
    expect(
      current(decodeProjectDocument(JSON.parse(encodeProjectDocument(replaced)), catalog)),
    ).toEqual(current(replaced));
    expect(() =>
      applyProjectCommand(reselected, catalog, {
        kind: 'ReplaceRerolledTraitScreen',
        trait,
        index: 1,
        value: { ...screen, rarificationActions: ['option4' as never] },
      }),
    ).toThrow('rarification actions must name trait offer option rows');
    // Removing the newest reroll drops its screen and the clicks made on it.
    const removed = applyProjectCommand(replaced, catalog, {
      kind: 'RemoveTraitScreenReroll',
      trait,
    });
    expect(current(removed).rerolledScreens).toHaveLength(1);
    expect(current(removed).rarificationActions).toEqual(['option1']);
  });

  it('decode earlier-screen Rarify clicks strictly', () => {
    const project = withArcana(loadUnderworldFGCheckpoint(), ['ScreenReroll']);
    const zeus = occurrence(project, source).state;
    const offers = zeus.kind === 'counted' ? zeus.reward?.traitOffersByAcquisitionRole : undefined;
    const [role, offer] = Object.entries(offers ?? {})[0]!;
    if (offer?.kind !== 'traits') throw new Error('fixture lacks an authored Zeus screen');
    const rerolled = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: {
        kind: 'traitOffer',
        routeKey: 'Underworld',
        biomeKey: 'F',
        owner: createIncomingRewardAddress(f, source as never),
        acquisitionRole: role,
      },
      value: {
        ...offer,
        rerolledScreens: [
          {
            options: offer.options.map(({ traitKey, rarity }) => ({
              traitKey,
              ...(rarity === undefined ? {} : { rarity }),
            })),
            rarificationActions: ['option1'],
          },
        ],
      },
    });
    const withScreen = (edit: (screen: Record<string, unknown>) => void) => {
      const raw = JSON.parse(encodeProjectDocument(rerolled));
      const room = raw.route.biomes[0].topology.occurrences.find(
        (candidate: { occurrenceId: string }) => candidate.occurrenceId === source,
      );
      edit(room.state.reward.traitOffersByAcquisitionRole[role].rerolledScreens[0]);
      return () => decodeProjectDocument(raw, catalog);
    };
    expect(withScreen(() => undefined)).not.toThrow();
    expect(
      withScreen((screen) => {
        screen.rarificationActions = [];
      }),
    ).toThrow('must hold at least one click');
    expect(
      withScreen((screen) => {
        screen.rarificationActions = ['option4'];
      }),
    ).toThrow('must name an option row');
    expect(
      withScreen((screen) => {
        screen.rarifications = ['option1'];
      }),
    ).toThrow();
  });
});
