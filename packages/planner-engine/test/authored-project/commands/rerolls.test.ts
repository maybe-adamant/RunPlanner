import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createFountainRarityOutcomeAddress,
  createHubFountainAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createProjectHistory,
  createRewardWheelOfferAddress,
  createRoomActionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  hubActionOrderRefusal,
  rerolledRecordOf,
  rerolledRewardOf,
  purgingPoolRollTraitKey,
  roomActionKey,
  stygianWellGenerationItemKey,
  undoProjectHistory,
  type HubAction,
  type ProjectCommand,
  type ProjectDocument,
  type RerollRoomAction,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  loadNemesisFieldsCheckpoint,
  loadUnderworldFGCheckpoint,
  loadUnderworldFStygianWellCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { hubVisitActions } from '@run-planner/test-fixtures/shared';
import {
  loadSurfaceNOProject,
  loadSurfaceNProject,
  nVisitSlotKeys,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { withArcana } from '../../support/rerolls';

const f = createBiomeAddress('Underworld', 'F');
const source = 'golden-f-b2-e1';
const target = 'golden-f-b3-e2';
const owner = createIncomingRewardAddress(f, target as never);

function occurrence(project: ProjectDocument, id: string) {
  return project.route.biomes[0]!.topology!.occurrences.find((room) => room.occurrenceId === id)!;
}

/** The reward the target room acquires after its door's presses, and that item's outcomes. */
function effective(project: ProjectDocument) {
  return rerolledRewardOf(occurrence(project, target), owner);
}

function rerollIds(project: ProjectDocument): readonly string[] {
  return occurrence(project, source).roomActions.order.flatMap((reference) =>
    reference.kind === 'reroll' ? [(reference as RerollRoomAction).rerollId] : [],
  );
}

/** Appends a press of the target's door; without a reward its result is unset. */
function insertReroll(project: ProjectDocument, reward?: ResolvedRewardOffer): ProjectCommand {
  return {
    kind: 'InsertReroll',
    occurrence: createOccurrenceAddress(f, source as never),
    target: { kind: 'door', exitKey: 'exit2', occurrenceId: target as never },
    ...(reward === undefined ? {} : { reward }),
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
  it('follow the effective press while unauthored and leave with the last reroll', () => {
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    project = applyProjectCommand(
      project,
      catalog,
      insertReroll(project, { rewardType: 'StackUpgrade' }),
    );
    expect(effective(project)?.offer).toEqual({ rewardType: 'StackUpgrade' });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRerollReward',
      action: createRoomActionAddress(f, source as never, JSON.stringify(['reroll', 'r1'])),
      reward: { rewardType: 'RoomMoneyDrop' },
    });
    expect(effective(project)?.offer).toEqual({ rewardType: 'RoomMoneyDrop' });
    project = applyProjectCommand(project, catalog, removeReroll('r1'));
    expect(occurrence(project, target).rerolledIncomingReward).toBeUndefined();
  });

  it('keep a set press item while a later press is unset, and follow each edit of the pair', () => {
    const base = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    const apply = (project: ProjectDocument, command: ProjectCommand) =>
      applyProjectCommand(project, catalog, command);
    const setPress = (rerollId: string, reward: ResolvedRewardOffer): ProjectCommand => ({
      kind: 'ReplaceRerollReward',
      action: createRoomActionAddress(f, source as never, JSON.stringify(['reroll', rerollId])),
      reward,
    });
    const record = (project: ProjectDocument) => occurrence(project, target).rerolledIncomingReward;
    const stack = { rewardType: 'StackUpgrade' } as const;
    // An unset first press holds a null result and no outcomes, then takes them once set.
    const unsetOnly = apply(base, insertReroll(base));
    expect(record(unsetOnly)).toEqual({ results: { r1: null }, pressId: 'r1' });
    expect(effective(unsetOnly)).toBeUndefined();
    expect(effective(apply(unsetOnly, setPress('r1', zeus)))?.offer).toEqual(zeus);

    const first = apply(base, insertReroll(base, zeus));
    const pair = apply(first, insertReroll(first));
    // The unset press leaves the set one's item and its outcomes in place.
    expect(record(pair)).toMatchObject({ results: { r1: zeus, r2: null }, pressId: 'r1' });
    expect(effective(pair)).toEqual(effective(first));
    // Setting it replaces the item with its own.
    const bothSet = apply(pair, setPress('r2', stack));
    expect(record(bothSet)).toMatchObject({ results: { r1: zeus, r2: stack }, pressId: 'r2' });
    expect(effective(bothSet)?.offer).toEqual(stack);
    expect(record(apply(bothSet, removeReroll('r1')))).toMatchObject({
      results: { r2: stack },
      pressId: 'r2',
    });
    // Removing the set press leaves only the unset one: no item, no outcomes.
    const unsetLeft = apply(pair, removeReroll('r1'));
    expect(record(unsetLeft)).toEqual({ results: { r2: null }, pressId: 'r2' });
    expect(effective(unsetLeft)).toBeUndefined();
    // Removing the unset press leaves the set one as it was.
    expect(record(apply(pair, removeReroll('r2')))).toEqual(record(first));
    // A saved pair decodes as it was.
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(pair)), catalog)).toEqual(pair);
  });

  it('hold each press result on the item, with the press its outcomes belong to, strictly', () => {
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    project = applyProjectCommand(project, catalog, insertReroll(project, zeus));
    expect(occurrence(project, source).roomActions.order.at(-1)).toEqual({
      kind: 'reroll',
      rerollId: 'r1',
      target: { kind: 'door', exitKey: 'exit2', occurrenceId: target },
    });
    expect(occurrence(project, target).rerolledIncomingReward).toMatchObject({
      results: { r1: zeus },
      pressId: 'r1',
    });
    const encode = () =>
      JSON.parse(encodeProjectDocument(project)) as {
        route: { biomes: { topology: { occurrences: Record<string, unknown>[] } }[] };
      };
    const rerolledOf = (encoded: ReturnType<typeof encode>) =>
      encoded.route.biomes[0]!.topology.occurrences.find((entry) => entry.occurrenceId === target)!
        .rerolledIncomingReward as Record<string, unknown>;
    const pressOf = (encoded: ReturnType<typeof encode>) =>
      (
        encoded.route.biomes[0]!.topology.occurrences.find(
          (entry) => entry.occurrenceId === source,
        )!.roomActions as { order: Record<string, unknown>[] }
      ).order.at(-1)!;
    expect(decodeProjectDocument(encode() as never, catalog)).toEqual(project);
    const refused = (change: (encoded: ReturnType<typeof encode>) => void, detail: string) => {
      const encoded = encode();
      change(encoded);
      expect(() => decodeProjectDocument(encoded as never, catalog)).toThrow(detail);
    };
    refused((encoded) => (rerolledOf(encoded).pressId = ''), 'pressId');
    refused((encoded) => (rerolledOf(encoded).pressId = 'r2'), 'must name one of its results');
    refused((encoded) => delete rerolledOf(encoded).acquisition, 'must hold its outcomes');
    refused(
      (encoded) => ((rerolledOf(encoded).acquisition as Record<string, unknown>).offer = zeus),
      'is its press result',
    );
    refused(
      (encoded) => (rerolledOf(encoded).results = { r1: zeus, r2: zeus }),
      'which no press of it names',
    );
    refused((encoded) => (rerolledOf(encoded).results = {}), 'must name a press');
    refused((encoded) => (pressOf(encoded).reward = zeus), 'reward');
    // A press its target holds no result for is refused, while its door's room stands.
    refused(
      (encoded) =>
        delete encoded.route.biomes[0]!.topology.occurrences.find(
          (entry) => entry.occurrenceId === target,
        )!.rerolledIncomingReward,
      'has no result on its target',
    );
  });

  it('go with their last press, and reset when their press draws another reward in place', () => {
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
    expect(effective(project)?.traitOffersByAcquisitionRole.source).toMatchObject({
      giverKey: 'Zeus',
    });
    // The first draw keeps its own payload while rerolled.
    expect(occurrence(project, target).state).toEqual(
      occurrence(loadUnderworldFGCheckpoint(), target).state,
    );
    const hera: ResolvedRewardOffer = {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'HeraUpgrade' },
    };
    const redrawn = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRerollReward',
      action: createRoomActionAddress(f, source as never, JSON.stringify(['reroll', 'r1'])),
      reward: hera,
    });
    expect(occurrence(redrawn, target).rerolledIncomingReward).toMatchObject({
      results: { r1: hera },
      pressId: 'r1',
    });
    expect(effective(redrawn)?.traitOffersByAcquisitionRole.source).toBeNull();
    const removed = applyProjectCommand(project, catalog, removeReroll('r1'));
    expect(occurrence(removed, target).rerolledIncomingReward).toBeUndefined();
  });
});

describe('presses and the item they redrew', () => {
  const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
  const settled = (project: ProjectDocument, command: ProjectCommand) =>
    settleProjectEdit({ catalog, before: evaluate(project), command, evaluate });
  const replaceRoom = (
    biome: ReturnType<typeof createBiomeAddress>,
    occurrenceId: string,
    gameName: string,
  ): ProjectCommand => ({
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(biome, occurrenceId as never),
    gameName,
  });
  const roundTrip = (project: ProjectDocument) =>
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );

  it('go with a door reward a replacement does not keep, announced in their room', () => {
    const base = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    const pressed = applyProjectCommand(base, catalog, insertReroll(base, zeus));
    // A miniboss room cannot draw the first draw (MaxManaDrop): the item goes, and its press.
    const replaced = settled(pressed, replaceRoom(f, target, 'F_MiniBoss01'));
    const project = replaced.assembly.project;
    expect(replaced.fault).toBeUndefined();
    expect(rerollIds(project)).toEqual([]);
    expect(occurrence(project, target).rerolledIncomingReward).toBeUndefined();
    expect(replaced.removedStaleActions).toEqual([
      {
        occurrence: createOccurrenceAddress(f, source as never),
        actions: [{ kind: 'reroll', rerollId: 'r1', target: expect.anything() }],
      },
    ]);
    roundTrip(project);
  });

  it('keep their record through a replacement that keeps the door reward', () => {
    const base = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    let pressed = applyProjectCommand(base, catalog, insertReroll(base, zeus));
    pressed = applyProjectCommand(pressed, catalog, {
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
    const record = occurrence(pressed, target).rerolledIncomingReward;
    // F_Combat05 draws both the first draw and the press's Boon: the item and its pick stay.
    const kept = applyProjectCommand(pressed, catalog, replaceRoom(f, target, 'F_Combat05'));
    expect(occurrence(kept, target).gameName).toBe('F_Combat05');
    expect(rerollIds(kept)).toEqual(['r1']);
    expect(occurrence(kept, target).rerolledIncomingReward).toEqual(record);
    roundTrip(kept);

    // F_Combat01 keeps the first draw but never draws Darkness: the press stays, its item
    // holds no outcomes.
    const darkness: ResolvedRewardOffer = { rewardType: 'MetaCurrencyDrop' };
    const drawn = applyProjectCommand(base, catalog, insertReroll(base, darkness));
    expect(occurrence(drawn, target).rerolledIncomingReward?.acquisition).toBeDefined();
    const undrawn = applyProjectCommand(drawn, catalog, replaceRoom(f, target, 'F_Combat01'));
    expect(rerollIds(undrawn)).toEqual(['r1']);
    expect(occurrence(undrawn, target).rerolledIncomingReward).toEqual({
      results: { r1: darkness },
      pressId: 'r1',
    });
    roundTrip(undrawn);
  });

  it('go with a Fields cage whose room was replaced away from Fields and back', () => {
    const h = createBiomeAddress('Underworld', 'H');
    const from = 'golden-h-miniboss01';
    const fields = 'golden-h-combat05';
    const base = withArcana(loadNemesisFieldsCheckpoint(), ['DoorReroll']);
    const roomIn = (project: ProjectDocument, id: string) =>
      project.route.biomes
        .find((plan) => plan.biomeKey === 'H')!
        .topology!.occurrences.find((room) => room.occurrenceId === id)!;
    const presses = (project: ProjectDocument) =>
      roomIn(project, from).roomActions.order.filter((action) => action.kind === 'reroll');
    const cage = createLocalRewardAddress(h, fields as never, 'cages', 'cage1');
    const pressed = applyProjectCommand(base, catalog, {
      kind: 'InsertReroll',
      occurrence: createOccurrenceAddress(h, from as never),
      target: { kind: 'cage', exitKey: 'exit1', occurrenceId: fields as never, slotKey: 'cage1' },
      reward: { rewardType: 'RoomMoneyDrop' },
      index: roomIn(base, from).roomActions.order.length,
    });
    expect(rerolledRecordOf(roomIn(pressed, fields), cage)?.results).toEqual({
      r1: { rewardType: 'RoomMoneyDrop' },
    });
    // Away from Fields the room holds no cage: the press redraws nothing and holds no result.
    const away = applyProjectCommand(pressed, catalog, replaceRoom(h, fields, 'H_MiniBoss01'));
    expect(presses(away)).toHaveLength(1);
    roundTrip(away);
    // Back in Fields the cage's first draw is new: the press's item is gone, and the press.
    const back = applyProjectCommand(away, catalog, replaceRoom(h, fields, 'H_Combat05'));
    expect(presses(back)).toEqual([]);
    expect(rerolledRecordOf(roomIn(back, fields), cage)).toBeUndefined();
    roundTrip(back);
  });

  it('keep a wheel press and its result until the walk drops its unplayed wheel', () => {
    const o = createBiomeAddress('Surface', 'O');
    const ship = oOccurrenceIds.combat04;
    const roomIn = (project: ProjectDocument) =>
      project.route.biomes
        .find((plan) => plan.biomeKey === 'O')!
        .topology!.occurrences.find((room) => room.occurrenceId === ship)!;
    const presses = (project: ProjectDocument) =>
      roomIn(project).roomActions.order.filter((action) => action.kind === 'reroll');
    const offer = createRewardWheelOfferAddress(o, ship, 'wheel2', 'offer1');
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(o, ship),
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertReroll',
      occurrence: createOccurrenceAddress(o, ship),
      target: { kind: 'wheelOffer', wheelKey: 'wheel2', offerKey: 'offer1' },
      reward: { rewardType: 'MaxManaDrop' },
      index: roomIn(project).roomActions.order.length,
    });
    const lower: ProjectCommand = {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(o, ship),
      encounterCount: 2,
    };
    // The wheel's state stays, so the press keeps its result there.
    const lowered = applyProjectCommand(project, catalog, lower);
    expect(presses(lowered)).toHaveLength(1);
    expect(rerolledRecordOf(roomIn(lowered), offer)?.results).toEqual({
      r1: { rewardType: 'MaxManaDrop' },
    });
    roundTrip(lowered);
    // Settled, the press goes with the wheel the room no longer plays, and its result with it.
    const walked = settled(project, lower);
    expect(walked.fault).toBeUndefined();
    expect(presses(walked.assembly.project)).toEqual([]);
    expect(rerolledRecordOf(roomIn(walked.assembly.project), offer)).toBeUndefined();
    roundTrip(walked.assembly.project);
  });

  it("go with their Hub slot's door, announced at the Hub", () => {
    const n = createBiomeAddress('Surface', 'N');
    const hub = { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' } as const;
    // A slot closes only before its visit.
    const unvisited = applyProjectCommand(
      withArcana(loadSurfaceNProject(), ['DoorReroll']),
      catalog,
      { kind: 'ResetHubVisits', hub },
    );
    const pressed = applyProjectCommand(unvisited, catalog, {
      kind: 'InsertHubReroll',
      hub,
      hubSlotKey: 'combat05',
      reward: { rewardType: 'MaxHealthDrop' },
      index: 0,
    });
    const closed = settled(pressed, {
      kind: 'CloseHubSlot',
      slot: createHubSlotAddress(n, 'hub', 'combat05'),
    });
    expect(closed.fault).toBeUndefined();
    expect(closed.removedHubRerolls).toEqual([
      { hub, rerolls: [{ kind: 'reroll', rerollId: 'r1', hubSlotKey: 'combat05' }] },
    ]);
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
    // Clearing the order would drop the reroll; resetting the visits is its own command.
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
      rerolledRewardOf(
        project.route.biomes[0]!.topology!.occurrences.find(
          (room) => room.occurrenceId === combat09.occurrenceId,
        )!,
        combat09,
      )?.offer;
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

describe('Hub visit reset', () => {
  const n = createBiomeAddress('Surface', 'N');
  const hub = { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' } as const;
  const hubOf = (project: ProjectDocument) => {
    const decision = project.route.biomes[0]!.topology!.decisions.find(
      (candidate) => candidate.kind === 'hub',
    );
    if (decision?.kind !== 'hub') throw new Error('Surface N has no Hub');
    return decision;
  };
  const rerolled = (project: ProjectDocument, slot: string) =>
    rerolledRewardOf(
      project.route.biomes[0]!.topology!.occurrences.find(
        (room) => room.occurrenceId === `surface-n-${slot}`,
      )!,
      createIncomingRewardAddress(n, `surface-n-${slot}` as never),
    )?.offer;
  const press = (hubSlotKey: string, reward: ResolvedRewardOffer, index: number) =>
    ({ kind: 'InsertHubReroll', hub, hubSlotKey, reward, index }) as const;

  it('clears the visits with every later stay and its presses in one undoable edit', () => {
    // Visits with the fountain used after the third, carrying a Phial target.
    const visited = applyProjectCommand(
      applyProjectCommand(withArcana(loadSurfaceNProject(), ['DoorReroll']), catalog, {
        kind: 'ReplaceHubActionOrder',
        hub,
        actions: hubVisitActions(nVisitSlotKeys, 3),
      }),
      catalog,
      {
        kind: 'ReplaceFountainRarityTarget',
        outcome: createFountainRarityOutcomeAddress(createHubFountainAddress(n, 'hub')),
        targetTraitKey: 'ApolloWeaponBoon',
      },
    );
    // combat09 is pressed at the first entry and again after the third visit; combat03,
    // never visited, after the fifth.
    const project = [
      press('combat09', { rewardType: 'MaxHealthDropBig' }, 0),
      press('combat09', { rewardType: 'MaxManaDropBig' }, 4),
      press('combat03', { rewardType: 'MaxHealthDropBig' }, 8),
    ].reduce((document, command) => applyProjectCommand(document, catalog, command), visited);
    expect(hubOf(project).actions.map((action) => action.kind)).toEqual([
      'reroll',
      'roomVisit',
      'roomVisit',
      'roomVisit',
      'reroll',
      'useFountain',
      'roomVisit',
      'roomVisit',
      'reroll',
      'roomVisit',
    ]);
    expect(rerolled(project, 'combat09')).toEqual({ rewardType: 'MaxManaDropBig' });

    const history = applyProjectHistoryCommand(createProjectHistory(project), catalog, {
      kind: 'ResetHubVisits',
      hub,
    });
    const reset = history.present;
    expect(hubOf(reset).actions).toEqual<readonly HubAction[]>([
      hubOf(project).actions[0]!,
      { kind: 'useFountain' },
    ]);
    expect(hubOf(reset).fountainRarityResult).toEqual({ targetTraitKey: 'ApolloWeaponBoon' });
    expect(hubOf(reset).openTargets).toEqual(hubOf(project).openTargets);
    // The entry press is the last one left on combat09; combat03 has none.
    expect(rerolled(reset, 'combat09')).toEqual({ rewardType: 'MaxHealthDropBig' });
    expect(rerolled(reset, 'combat03')).toBeUndefined();
    expect(undoProjectHistory(history).present).toBe(project);
    expect(applyProjectCommand(reset, catalog, { kind: 'ResetHubVisits', hub })).toBe(reset);
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

  it("never reuse a removed reroll's id while its purchase or sale stays authored", () => {
    const rerolled = insert(
      insert(loadUnderworldFStygianWellCheckpoint(), 'InsertStygianWellReroll'),
      'InsertPurgingPoolReroll',
    );
    const remove = (project: ProjectDocument, reference: RoomActionReference) =>
      applyProjectCommand(project, catalog, {
        kind: 'RemoveRoomAction',
        action: createRoomActionAddress(f, room.occurrenceId, roomActionKey(reference)),
      });
    const action = (reference: RoomActionReference) =>
      createRoomActionAddress(f, room.occurrenceId, roomActionKey(reference));
    const pinned = applyProjectCommand(rerolled, catalog, {
      kind: 'ReplaceStygianWellRollOffer',
      action: action({ kind: 'rerollStygianWell', rerollId: 'r1' }),
      slotKey: 'healing',
      itemKey: 'ArmorBoostStore',
    });
    const bought = applyProjectCommand(pinned, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'r1:healing',
      purchased: true,
    });
    const sale = { kind: 'sellPurgingPoolTrait', slotKey: 'left', rollKey: 'r1' } as const;
    const sold = applyProjectCommand(
      applyProjectCommand(bought, catalog, {
        kind: 'ReplacePurgingPoolRollSlot',
        action: action({ kind: 'rerollPurgingPool', rerollId: 'r1' }),
        slotKey: 'left',
        traitKey: Object.keys(catalog.traits.byKey)[0]!,
      }),
      catalog,
      {
        kind: 'InsertRoomAction',
        action: action(sale),
        reference: sale,
        index: occurrence(bought, room.occurrenceId).roomActions.order.length,
      },
    );
    const removed = remove(remove(sold, { kind: 'rerollStygianWell', rerollId: 'r1' }), {
      kind: 'rerollPurgingPool',
      rerollId: 'r1',
    });
    // Removing a reroll takes the purchases and sales of its list with it.
    expect(
      occurrence(removed, room.occurrenceId).roomActions.order.filter(
        (reference) =>
          (reference.kind === 'purchaseStygianWellOffer' &&
            reference.generationKey === 'r1:healing') ||
          (reference.kind === 'sellPurgingPoolTrait' && reference.rollKey === 'r1'),
      ),
    ).toEqual([]);
    // A saved plan may still hold them without their rerolls.
    const raw = JSON.parse(encodeProjectDocument(sold));
    for (const plan of raw.route.biomes)
      for (const candidate of plan.topology?.occurrences ?? []) {
        if (candidate.occurrenceId !== room.occurrenceId) continue;
        candidate.roomActions.order = candidate.roomActions.order.filter(
          (reference: RoomActionReference) =>
            reference.kind !== 'rerollStygianWell' && reference.kind !== 'rerollPurgingPool',
        );
        delete candidate.stygianWell.rerollOfferKeyBySlot;
        delete candidate.purgingPool.rerollTraitKeyBySlot;
      }
    const orphaned = decodeProjectDocument(raw, catalog);
    const again = insert(insert(orphaned, 'InsertStygianWellReroll'), 'InsertPurgingPoolReroll');
    const after = occurrence(again, room.occurrenceId);
    expect(after.roomActions.order.slice(-2)).toEqual([
      { kind: 'rerollStygianWell', rerollId: 'r2' },
      { kind: 'rerollPurgingPool', rerollId: 'r2' },
    ]);
    // The orphaned purchase and sale still name no present roll.
    expect(stygianWellGenerationItemKey(after, 'r1:healing')).toBeUndefined();
    expect(purgingPoolRollTraitKey(after, 'r1', 'left')).toBeUndefined();
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
