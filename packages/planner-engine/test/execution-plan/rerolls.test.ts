import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createHubRerollAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  rerollSettlementForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
  type ExecutionPlan,
} from '@run-planner/engine/execution-plan';
import {
  loadUnderworldFGCheckpoint,
  loadUnderworldFStygianWellCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import {
  firstSupportedReroll,
  withArcana,
  withGoldenUnderworldJudgments,
  withGuessedRerolledScreens,
  withJudgment,
} from '../support/rerolls';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  surfaceNORerollsProject,
  underworldFRarifiedScreenRerollProject,
} from './support/rerolls-fixture';
import { currentSchemaWire } from './support/current-schema-wire';
import doorRerollsFixture from './fixtures/underworld-f-rerolls.execution.json';
import fieldsFixture from './fixtures/underworld-fghi.execution.json';
import surfaceRerollsFixture from './fixtures/surface-no-rerolls.execution.json';
import rarifiedScreenFixture from './fixtures/underworld-f-rarified-screen-reroll.execution.json';

const g = createBiomeAddress('Underworld', 'G');
const gSource = 'golden-g-b1-e1';
const reroll = createRoomActionAddress(g, gSource as never, JSON.stringify(['reroll', 'r1']));

function occurrence(project: ProjectDocument, id: string, biomeIndex: number) {
  return project.route.biomes[biomeIndex]!.topology!.occurrences.find(
    (room) => room.occurrenceId === id,
  )!;
}

function planOf(project: ProjectDocument): ExecutionPlan {
  const assembly = simulateProjectAssembly(catalog, project);
  expect(assembly.evaluation.status).toBe('valid');
  return compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
}

/** The golden route with one G door press; holding the card makes both Judgments due. */
function rerolledProject(): ProjectDocument {
  const project = withGoldenUnderworldJudgments(
    withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
  );
  return applyProjectCommand(project, catalog, {
    kind: 'InsertReroll',
    occurrence: createOccurrenceAddress(g, gSource as never),
    target: { kind: 'door', exitKey: 'exit2', occurrenceId: 'golden-g-b2-e2' as never },
    reward: { rewardType: 'GiftDrop' },
    index: occurrence(project, gSource, 1).roomActions.order.length,
  });
}

describe('reroll publication', () => {
  it('keeps the first draw on the door and publishes the press in order', () => {
    const project = rerolledProject();
    const plan = planOf(project);
    const sourcePlan = plan.occurrences.find((candidate) => candidate.id === gSource)!;
    expect(sourcePlan.rerolls).toEqual([
      {
        owner: semanticAddressKey(reroll),
        target: { kind: 'door', exitKey: 'exit2' },
        reward: expect.objectContaining({ rewardType: 'GiftDrop' }),
      },
    ]);
    expect(
      sourcePlan.roomGuide.find((row) => row.key === JSON.stringify(['reroll', 'r1']))?.description
        .kind,
    ).toBe('reroll');
    const firstDraw = occurrence(project, 'golden-g-b2-e2', 1).state;
    expect(
      sourcePlan.doors.kind === 'batch'
        ? sourcePlan.doors.targets.find((door) => door.exitKey === 'exit2')?.reward?.rewardType
        : undefined,
    ).toBe(firstDraw.kind === 'counted' ? firstDraw.reward?.offer.rewardType : undefined);
    // The planned pool at the room's entry pays for the press.
    const settled = rerollSettlementForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, project),
      reroll,
    );
    expect(sourcePlan.rerollPoolAtEntry).toBe(settled!.poolRemainingAfter! + 1);
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  });

  it('publishes Hub board presses of every stay in authored order', () => {
    const n = createBiomeAddress('Surface', 'N');
    const hub = { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' } as const;
    // combat03 is never entered; one press in the first stay, one after the third visit.
    const rewards: ResolvedRewardOffer[] = [];
    const project = [1, 5].reduce(
      (current, index) => {
        const inserted = applyProjectCommand(current, catalog, {
          kind: 'InsertHubReroll',
          hub,
          hubSlotKey: 'combat03',
          reward: { rewardType: 'MaxHealthDropBig' },
          index,
        });
        const reroll = createHubRerollAddress(n, 'hub', `r${rewards.length + 1}`);
        const reward = firstSupportedReroll(inserted, reroll, 'HubRewards');
        rewards.push(reward);
        return applyProjectCommand(inserted, catalog, {
          kind: 'ReplaceHubRerollReward',
          reroll,
          reward,
        });
      },
      withJudgment(
        withArcana(loadSurfaceNProject(), ['DoorReroll']),
        'N',
        'surface-n-preboss:boss',
        ['ScreenReroll', 'TradeOff', 'StartingGold', 'HealthRegen', 'BonusDodge'],
      ),
    );
    const assembly = simulateProjectAssembly(catalog, project);
    const later = createHubRerollAddress(n, 'hub', 'r2');
    expect(rerollSettlementForProjectEvaluationAssembly(assembly, later)).toMatchObject({
      poolRemainingAfter: 1,
    });
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({ assembly, catalog }),
    });
    const published = plan.occurrences.flatMap((entry) =>
      entry.overview.hub === undefined ? [] : [entry.overview.hub],
    );
    expect(published).toHaveLength(1);
    expect(published[0]!.rerolls).toEqual([
      {
        owner: semanticAddressKey(createHubRerollAddress(n, 'hub', 'r1')),
        slotKey: 'combat03',
        reward: expect.objectContaining({ rewardType: rewards[0]!.rewardType }),
      },
      {
        owner: semanticAddressKey(later),
        slotKey: 'combat03',
        reward: expect.objectContaining({ rewardType: rewards[1]!.rewardType }),
      },
    ]);
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  });

  it('keeps the first draw on a ship wheel and acquires the picked offer from its last press', () => {
    const project = surfaceNORerollsProject();
    const plan = planOf(project);
    const ship = plan.occurrences.find((room) => room.id === 'surface-o-combat04')!;
    const [press] = ship.rerolls!;
    // The Ship room is entered with the pool its press then spends.
    const settled = rerollSettlementForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, project),
      createRoomActionAddress(
        createBiomeAddress('Surface', 'O'),
        'surface-o-combat04' as never,
        JSON.stringify(['reroll', 'r1']),
      ),
    );
    expect(ship.rerollPoolAtEntry).toBe(settled!.poolRemainingAfter! + 1);
    // Every selected room, Ship rooms included, publishes its entry pool.
    const byId = new Map(plan.occurrences.map((room) => [room.id, room]));
    expect(
      plan.selectedOccurrenceIds.filter((id) => byId.get(id)?.rerollPoolAtEntry === undefined),
    ).toEqual([]);
    expect(press!.target).toEqual({ kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer1' });
    const [wheel] = ship.overview.rewardWheels!;
    expect(wheel!.pickedOfferKey).toBe('offer1');
    expect(wheel!.offers[0]!.reward).not.toEqual(press!.reward);
    expect(
      ship.timeline.transactions.find(
        (transaction) =>
          transaction.kind === 'acquisition' && transaction.window.kind === 'shipPostCombat',
      ),
    ).toMatchObject({ reward: press!.reward });
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  });

  it('publishes no reroll field while the plan authors none', () => {
    const plan = planOf(
      withGoldenUnderworldJudgments(withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll'])),
    );
    for (const room of plan.occurrences) {
      expect(room).not.toHaveProperty('rerolls');
      expect(room).not.toHaveProperty('rerollPoolAtEntry');
    }
    expect(JSON.stringify(plan)).not.toContain('rerollCount');
  });

  it('decodes reroll fields strictly', () => {
    const encoded = JSON.parse(encodeExecutionPlan(planOf(rerolledProject()))) as {
      occurrences: Record<string, unknown>[];
    };
    const decodeWith = (edit: (room: Record<string, unknown>) => void) => {
      const copy = structuredClone(encoded);
      edit(copy.occurrences.find((room) => room.id === gSource)!);
      return () => decodeExecutionPlan(copy);
    };
    const press = (room: Record<string, unknown>) =>
      (room.rerolls as Record<string, unknown>[])[0]!;
    expect(
      decodeWith((room) => {
        room.rerollPoolAtEntry = 1.5;
      }),
    ).toThrow('rerollPoolAtEntry');
    expect(
      decodeWith((room) => {
        room.rerollPoolAtEntry = '3';
      }),
    ).toThrow('rerollPoolAtEntry');
    expect(
      decodeWith((room) => {
        room.rerolls = [];
      }),
    ).toThrow('rerolls');
    expect(
      decodeWith((room) => {
        press(room).extra = true;
      }),
    ).toThrow('extra');
    expect(
      decodeWith((room) => {
        press(room).target = { kind: 'hub', exitKey: 'exit2' };
      }),
    ).toThrow('target');
    expect(
      decodeWith((room) => {
        press(room).target = { kind: 'cage', exitKey: 'exit2' };
      }),
    ).toThrow('cageIndex');
    expect(
      decodeWith((room) => {
        delete press(room).reward;
      }),
    ).toThrow('reward');
  });
});

describe('reroll target decoding', () => {
  type WireRoom = Record<string, unknown> & { readonly id: string };
  /** Decodes a fixture after editing one room, re-stamped so only the edit can fail. */
  function decodeEdited(fixture: unknown, roomId: string, edit: (room: WireRoom) => void) {
    const copy = structuredClone(fixture) as { occurrences: WireRoom[] };
    edit(copy.occurrences.find((room) => room.id === roomId)!);
    return () => decodeExecutionPlan(currentSchemaWire(copy));
  }
  const press = (room: WireRoom) => (room.rerolls as Record<string, unknown>[])[0]!;
  const unpublished = 'must name a published target';

  it('rejects a door press whose exit is not a published door of its room', () => {
    const roomId = 'golden-f-b2-e1';
    expect(decodeEdited(doorRerollsFixture, roomId, () => undefined)).not.toThrow();
    expect(
      decodeEdited(doorRerollsFixture, roomId, (room) => {
        press(room).target = { kind: 'door', exitKey: 'exit9' };
      }),
    ).toThrow(unpublished);
  });

  it("accepts a cage press only within its door's published cage rewards", () => {
    const cage =
      (cageIndex: number, exitKey = 'exit1') =>
      (room: WireRoom) => {
        const doors = room.doors as { targets: { cageRewards?: unknown[] }[] };
        room.rerolls = [
          {
            owner: JSON.stringify(['roomAction', 'Underworld', 'H', room.id, '["reroll","r1"]']),
            target: { kind: 'cage', exitKey, cageIndex },
            reward: doors.targets[0]!.cageRewards![0],
          },
        ];
      };
    expect(decodeEdited(fieldsFixture, 'golden-h-combat02', cage(2))).not.toThrow();
    expect(decodeEdited(fieldsFixture, 'golden-h-combat02', cage(3))).toThrow(unpublished);
    expect(decodeEdited(fieldsFixture, 'golden-h-combat02', cage(1, 'exit9'))).toThrow(unpublished);
    // A door without cage rewards publishes no cage to press.
    expect(
      decodeEdited(doorRerollsFixture, 'golden-f-b2-e1', (room) => {
        press(room).target = { kind: 'cage', exitKey: 'exit2', cageIndex: 1 };
      }),
    ).toThrow(unpublished);
  });

  it('rejects a wheel press that names no published offer of its wheel', () => {
    const roomId = 'surface-o-combat04';
    expect(decodeEdited(surfaceRerollsFixture, roomId, () => undefined)).not.toThrow();
    expect(
      decodeEdited(surfaceRerollsFixture, roomId, (room) => {
        press(room).target = { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer9' };
      }),
    ).toThrow(unpublished);
    expect(
      decodeEdited(surfaceRerollsFixture, roomId, (room) => {
        press(room).target = { kind: 'wheelOffer', wheelKey: 'wheel9', offerKey: 'offer1' };
      }),
    ).toThrow(unpublished);
  });

  it('rejects a Hub press whose slot is not a Hub slot', () => {
    expect(
      decodeEdited(surfaceRerollsFixture, 'surface-n-prehub', (room) => {
        const hub = (room.overview as { hub: { rerolls: Record<string, unknown>[] } }).hub;
        hub.rerolls[0]!.slotKey = 'combat99';
      }),
    ).toThrow('slotKey must name a Hub slot');
  });
});

describe('Well and Pool roll publication', () => {
  const f = createBiomeAddress('Underworld', 'F');
  const postboss = 'golden-f-preboss-shop:postboss';
  const room = createOccurrenceAddress(f, postboss as never);
  const action = (key: unknown[]) =>
    createRoomActionAddress(f, postboss as never, JSON.stringify(key));

  function rolledProject(): ProjectDocument {
    let project = withJudgment(
      withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
      'F',
      'golden-f-preboss-shop:boss',
      ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
    );
    const end = () => occurrence(project, postboss, 0).roomActions.order.length;
    const apply = (command: Parameters<typeof applyProjectCommand>[2]) => {
      project = applyProjectCommand(project, catalog, command);
    };
    apply({ kind: 'InsertStygianWellReroll', occurrence: room, index: end() });
    apply({
      kind: 'ReplaceStygianWellRollOffer',
      action: action(['rerollStygianWell', 'r1']),
      slotKey: 'healing',
      itemKey: 'HealDropRange',
    });
    apply({
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'r1:healing',
      purchased: true,
    });
    apply({ kind: 'InsertPurgingPoolReroll', occurrence: room, index: end() });
    apply({
      kind: 'ReplacePurgingPoolRollSlot',
      action: action(['rerollPurgingPool', 'r1']),
      slotKey: 'middle',
      traitKey: 'HeraCastBoon',
    });
    const sale = { kind: 'sellPurgingPoolTrait', slotKey: 'middle', rollKey: 'r1' } as const;
    apply({
      kind: 'InsertRoomAction',
      action: action(['sellPurgingPoolTrait', 'middle', 'r1']),
      reference: sale,
      index: end(),
    });
    return project;
  }

  it("names a reroll's slot as the Travel Deal source when the first purchase follows a reroll", () => {
    let project = withJudgment(
      withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
      'F',
      'golden-f-preboss-shop:boss',
      ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
    );
    const apply = (command: Parameters<typeof applyProjectCommand>[2]) => {
      project = applyProjectCommand(project, catalog, command);
    };
    for (const generationKey of [
      'travelDealRefill',
      'initial:secondRight',
      'initial:secondLeft',
    ] as const)
      apply({ kind: 'SetStygianWellPurchase', occurrence: room, generationKey, purchased: false });
    apply({
      kind: 'InsertStygianWellReroll',
      occurrence: room,
      index: occurrence(project, postboss, 0).roomActions.order.length,
    });
    apply({
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'r1:secondLeft',
      purchased: true,
      itemKey: 'TemporaryBoonRarityTrait',
    });
    apply({
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'travelDealRefill',
      purchased: true,
    });
    const plan = planOf(project);
    const refill = plan.occurrences
      .find((candidate) => candidate.id === postboss)!
      .timeline.transactions.find((transaction) => transaction.kind === 'travelDealRefill');
    expect(refill).toMatchObject({
      refill: { carrier: 'stygianWell', source: { generationKey: 'r1:secondLeft' } },
    });
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  });

  it('publishes each roll in action order and the purchases and sales naming them', () => {
    const plan = planOf(rolledProject());
    const roomPlan = plan.occurrences.find((candidate) => candidate.id === postboss)!;
    expect(roomPlan.overview.stygianWell?.rerolls).toEqual([
      { rollKey: 'r1', offers: [{ generationKey: 'r1:healing', offerKey: 'HealDropRange' }] },
    ]);
    expect(roomPlan.overview.purgingPool?.rerolls).toEqual([
      { rollKey: 'r1', traits: [{ slotKey: 'middle', traitKey: 'HeraCastBoon' }] },
    ]);
    const guide = roomPlan.roomGuide.map((row) => row.description);
    expect(guide).toContainEqual({ kind: 'rerollStygianWell', rollKey: 'r1' });
    expect(guide).toContainEqual({ kind: 'rerollPurgingPool', rollKey: 'r1' });
    expect(guide).toContainEqual(
      expect.objectContaining({ kind: 'purchaseStygianWellOffer', generationKey: 'r1:healing' }),
    );
    expect(guide).toContainEqual({
      kind: 'sellPurgingPoolTrait',
      slotKey: 'middle',
      rollKey: 'r1',
      traitKey: 'HeraCastBoon',
    });
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  });
});

describe('rerolled screen publication', () => {
  const f = createBiomeAddress('Underworld', 'F');
  const source = 'golden-f-b2-e1';

  function rerolledScreenProject(): ProjectDocument {
    // The screen card is held from the start, so the F Judgment draws the door card instead.
    const project = withJudgment(
      withJudgment(
        withArcana(loadUnderworldFGCheckpoint(), ['ScreenReroll']),
        'F',
        'golden-f-preboss-shop:boss',
        ['DoorReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
      ),
      'G',
      'golden-g-preboss-shop:boss',
      ['LowManaDamageBonus', 'CastCount', 'SorceryRegenUpgrade', 'CastBuff', 'BonusHealth'],
    );
    const zeus = occurrence(project, source, 0);
    const offers =
      zeus.state.kind === 'counted' ? zeus.state.reward?.traitOffersByAcquisitionRole : undefined;
    const [role, offer] = Object.entries(offers ?? {})[0]!;
    if (offer === null || offer === undefined) throw new Error('fixture lacks a Zeus screen');
    const trait = {
      kind: 'traitOffer',
      routeKey: 'Underworld',
      biomeKey: 'F',
      owner: createIncomingRewardAddress(f, source as never),
      acquisitionRole: role,
    } as const;
    return applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: withGuessedRerolledScreens(project, trait, offer, 2),
    });
  }

  /** Every published object holding rerolled screens. */
  function screenOwners(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) return value.flatMap(screenOwners);
    if (value === null || typeof value !== 'object') return [];
    const record = value as Record<string, unknown>;
    return [
      ...(Object.hasOwn(record, 'rerolledScreens') ? [record] : []),
      ...Object.values(record).flatMap(screenOwners),
    ];
  }

  it('publishes each earlier screen, oldest first, on the final trait screen', () => {
    const plan = planOf(rerolledScreenProject());
    const [offer] = screenOwners(plan);
    expect(offer).toMatchObject({ kind: 'traits', giver: 'Zeus' });
    const screens = offer!.rerolledScreens as { options: { key: string; rarity?: string }[] }[];
    expect(screens).toHaveLength(2);
    for (const screen of screens) expect(screen.options).toHaveLength(3);
    // Each row carries its installed level, as the final rows do.
    expect(screens[0]!.options.every((option) => 'effectiveLevel' in option)).toBe(true);
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  });

  it("publishes a rerolled-away row's rolled rarity beside the rarity its Rarify click reached", () => {
    const plan = planOf(underworldFRarifiedScreenRerollProject());
    const [offer] = screenOwners(plan);
    expect(offer).toMatchObject({ kind: 'traits', giver: 'Apollo' });
    const screens = offer!.rerolledScreens as {
      options: { key: string; baseRarity?: string; rarity?: string }[];
    }[];
    expect(screens.map((screen) => screen.options.map((option) => option.baseRarity))).toEqual([
      [undefined, 'Common', undefined],
      [undefined, undefined, undefined],
    ]);
    expect(screens[0]!.options.map((option) => option.rarity)).toEqual([
      'Common',
      'Rare',
      'Common',
    ]);
    // The menu reads the keepsake's use when the screen opens, before any screen's click.
    expect(offer!.expectation).toMatchObject({ rarifyUses: 1 });
    expect(screenOwners(rarifiedScreenFixture)).toHaveLength(1);
  });

  it('decodes a rerolled row rarity strictly', () => {
    const encoded = JSON.parse(
      encodeExecutionPlan(planOf(underworldFRarifiedScreenRerollProject())),
    ) as unknown;
    const decodeWith = (edit: (option: Record<string, unknown>) => void) => {
      const copy = structuredClone(encoded);
      const screens = screenOwners(copy)[0]!.rerolledScreens as {
        options: Record<string, unknown>[];
      }[];
      edit(screens[0]!.options[1]!);
      return () => decodeExecutionPlan(copy);
    };
    expect(decodeWith(() => undefined)).not.toThrow();
    expect(
      decodeWith((option) => {
        option.baseRarity = 3;
      }),
    ).toThrow('baseRarity');
    expect(
      decodeWith((option) => {
        delete option.rarity;
      }),
    ).toThrow('baseRarity needs the rarity');
  });

  it('decodes rerolled screens strictly', () => {
    const encoded = JSON.parse(encodeExecutionPlan(planOf(rerolledScreenProject()))) as unknown;
    const decodeWith = (edit: (offer: Record<string, unknown>) => void) => {
      const copy = structuredClone(encoded);
      edit(screenOwners(copy)[0]!);
      return () => decodeExecutionPlan(copy);
    };
    const first = (offer: Record<string, unknown>) =>
      (offer.rerolledScreens as Record<string, unknown>[])[0]!;
    expect(decodeWith(() => undefined)).not.toThrow();
    expect(
      decodeWith((offer) => {
        offer.rerolledScreens = [];
      }),
    ).toThrow('rerolledScreens');
    expect(
      decodeWith((offer) => {
        first(offer).extra = true;
      }),
    ).toThrow('extra');
    expect(
      decodeWith((offer) => {
        first(offer).rejected = 'option4';
      }),
    ).toThrow('rejected');
    expect(
      decodeWith((offer) => {
        offer.rerollCount = 2;
      }),
    ).toThrow('rerollCount');
  });
});
