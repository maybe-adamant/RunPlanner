import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';
import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createEchoKeepsakeReplayAddress,
  createHubFountainAddress,
  createIncomingRewardAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createSteadyGrowthOutcomeAddress,
  createTranscendentEmbryoOutcomeAddress,
  roomActionKey,
  semanticAddressKey,
  type RoomActionReference,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { assembleExecutionProduct } from '@run-planner/engine/execution-plan';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import type { RoomLifecycleStructure } from '../../src/authored-project/room-actions/lifecycle-structure';
import {
  classifyTimelineDependencyEndpoint,
  roomTimelineDependencies,
  traitFenceDependencies,
} from '../../src/execution-plan/assembly/timeline-dependencies';
import type { ExecutionTimelineTransaction } from '../../src/execution-plan/model';
import type { CanonicalAuthoredRoom } from '../../src/simulation/materialization';
import type { RoomActionRow } from '../../src/simulation/room-actions';
import { EMPTY_PLANNER_TIMELINE_FACTS } from '../../src/simulation/timeline-facts';
import {
  traitMutationChainRole,
  type TraitMutationChainRole,
} from '../../src/simulation/traits/history/fold';
import type { TraitHistoryEvent } from '../../src/simulation/traits/history/model';
import { executionFixtures } from './support/execution-fixtures';

const biome = createBiomeAddress('Underworld', 'F');
const occurrenceId = createOccurrenceId('fence-room');
const otherOccurrenceId = createOccurrenceId('other-room');
const occurrence = createOccurrenceAddress(biome, occurrenceId);
const structure: RoomLifecycleStructure = {
  profileKey: 'Combat',
  activeEncounterSlotKeys: ['Encounter'],
  phases: [{ phaseKey: 'Encounter' }],
  points: [
    { kind: 'roomEntered', key: 'roomEntered' },
    { kind: 'encounterStart', key: 'encounterStart:Encounter', phaseKey: 'Encounter' },
    { kind: 'encounterEnd', key: 'encounterEnd:Encounter', phaseKey: 'Encounter' },
    { kind: 'outgoingGeneration', key: 'outgoingGeneration' },
  ],
};

type Kind = 'screen' | 'pickup' | 'native' | 'phialFountain' | RoomActionReference['kind'];

interface Action {
  readonly key: string;
  readonly kind: Kind;
  readonly window?: RoomActionRow['window'];
  readonly owner?: SemanticAddress;
}

const owner = (key: string) => createRoomActionAddress(biome, occurrenceId, key);
const afterCombat = { kind: 'standard', phase: 'afterCombat' } as const;

/** One room whose rows are the actions in rank order; screens, pickups and fences are transactions. */
function room(actions: readonly Action[], automatic: readonly SemanticAddress[] = []) {
  const ownerOf = (action: Action) => action.owner ?? owner(action.key);
  const rows = actions.map(
    (action, index): RoomActionRow =>
      ({
        reference: {
          kind:
            action.kind === 'screen' || action.kind === 'pickup'
              ? 'interactIncomingReward'
              : action.kind === 'native'
                ? 'completeFieldsCage'
                : action.kind === 'phialFountain'
                  ? 'useFountain'
                  : action.kind,
        },
        key: action.key,
        owner: ownerOf(action),
        participation: 'required',
        window: action.window ?? afterCombat,
        dependencies: [],
        rank: index + 1,
        stale: false,
        executable: true,
      }) as unknown as RoomActionRow,
  );
  const transactions = actions.flatMap((action): ExecutionTimelineTransaction[] => {
    const key = semanticAddressKey(ownerOf(action));
    const window = afterCombat;
    if (action.kind === 'screen' || action.kind === 'pickup')
      return [
        {
          kind: 'acquisition',
          owner: key,
          roles: [action.kind === 'screen' ? { role: 'self', traitOffer: {} } : { role: 'self' }],
          window,
        } as unknown as ExecutionTimelineTransaction,
      ];
    if (action.kind === 'useFountain' || action.kind === 'phialFountain')
      return [
        {
          kind: 'fountainUse',
          owner: key,
          interactionKey: 'fountain',
          window,
          ...(action.kind === 'phialFountain' ? { aromaticPhialTarget: 'ZeusWeaponBoon' } : {}),
        } as unknown as ExecutionTimelineTransaction,
      ];
    if (action.kind === 'interactKeepsakeRack')
      return [{ kind: 'keepsakeChange', owner: key, keepsakeKey: 'Keepsake', window }];
    if (action.kind === 'purchaseStygianWellOffer')
      return [
        {
          kind: 'itemEffect',
          owner: key,
          itemKey: 'TemporaryBoonRarityTrait',
          effect: 'yarn',
          extended: false,
          window,
        },
      ];
    return [];
  });
  return {
    room: {
      gameName: 'F_Combat01',
      occurrenceId,
      origin: occurrence,
      roomActionRoster: { lifecycleStructure: structure, rows },
    } as unknown as CanonicalAuthoredRoom,
    transactions: [
      ...transactions,
      ...automatic.map(
        (address) =>
          ({
            kind: 'automatic',
            owner: semanticAddressKey(address),
            window: { kind: 'encounterEnd', phaseKey: 'Encounter' },
          }) as unknown as ExecutionTimelineTransaction,
      ),
    ],
  };
}

const edge = (from: string, after: string) => ({ owner: owner(from), afterOwner: owner(after) });

describe('trait fence dependencies', () => {
  it.each(['phialFountain', 'interactKeepsakeRack'] as const)(
    'orders a %s after the latest screen ranked before it and before the earliest after it',
    (kind) => {
      const { room: fenceRoom, transactions } = room([
        { key: 'first', kind: 'screen' },
        { key: 'latest', kind: 'screen' },
        { key: 'gold', kind: 'pickup' },
        { key: 'fence', kind },
        { key: 'earliest', kind: 'screen' },
        { key: 'last', kind: 'screen' },
      ]);
      expect(traitFenceDependencies(fenceRoom, transactions)).toEqual([
        edge('fence', 'latest'),
        edge('earliest', 'fence'),
      ]);
    },
  );

  it('orders a fence against its neighbours by rank across lifecycle windows', () => {
    const { room: fenceRoom, transactions } = room([
      { key: 'before', kind: 'screen', window: { kind: 'standard', phase: 'beforeCombat' } },
      { key: 'fence', kind: 'interactKeepsakeRack' },
      { key: 'after', kind: 'screen', window: { kind: 'postOutgoing' } },
    ]);
    expect(traitFenceDependencies(fenceRoom, transactions)).toEqual([
      edge('fence', 'before'),
      edge('after', 'fence'),
    ]);
  });

  it('publishes no fence edge for a plain Fountain, a Well purchase or an untransacted fence', () => {
    for (const kind of [
      'useFountain',
      'purchaseStygianWellOffer',
      'sellPurgingPoolTrait',
      'interactEris',
      'purchaseHermesShrineOffer',
    ] as const) {
      const { room: fenceRoom, transactions } = room([
        { key: 'before', kind: 'screen' },
        { key: 'fence', kind },
        { key: 'after', kind: 'screen' },
      ]);
      expect(traitFenceDependencies(fenceRoom, transactions)).toEqual([]);
    }
  });

  it('adds a fence edge only when the published edges do not already imply it', () => {
    const { room: fenceRoom, transactions } = room([
      { key: 'before', kind: 'screen' },
      { key: 'fence', kind: 'phialFountain' },
      { key: 'after', kind: 'screen' },
    ]);
    const facts = {
      nodes: [],
      dependencies: [edge('after', 'fence'), edge('fence', 'before')],
    };
    expect(roomTimelineDependencies(fenceRoom, facts, transactions, occurrenceId)).toEqual(
      facts.dependencies,
    );
    expect(
      roomTimelineDependencies(fenceRoom, EMPTY_PLANNER_TIMELINE_FACTS, transactions, occurrenceId),
    ).toEqual([edge('fence', 'before'), edge('after', 'fence')]);
  });
});

describe('timeline dependency classification', () => {
  const { room: classifiedRoom, transactions } = room([
    { key: 'cage', kind: 'native' },
    { key: 'eris', kind: 'interactEris' },
    { key: 'screen', kind: 'screen' },
  ]);
  const owners = new Set(transactions.map((transaction) => transaction.owner));
  const classify = (address: SemanticAddress, entryOccurrenceId: string = otherOccurrenceId) =>
    classifyTimelineDependencyEndpoint(classifiedRoom, address, owners, entryOccurrenceId);
  const refillPurchase = owner(
    roomActionKey({ kind: 'purchaseStygianWellOffer', generationKey: 'travelDealRefill' }),
  );

  it('classifies every endpoint the room publishes or the game orders', () => {
    expect(classify(owner('screen'))).toBe('transaction');
    expect(classify(owner('cage'))).toBe('nativeAction');
    expect(classify(owner('eris'))).toBe('untransactedFence');
    expect(classify(refillPurchase)).toBe('nativeAction');
    expect(classify(createRoomActionAddress(biome, otherOccurrenceId, 'screen'))).toBe('otherRoom');
    expect(classify(createHubFountainAddress(biome, 'hub'))).toBe('otherRoom');
    expect(
      classify(
        createKeepsakeEquipResultAddress(
          createRouteStartKeepsakeSelectionAddress('Underworld'),
          'transcendentEmbryo',
        ),
      ),
    ).toBe('otherRoom');
    expect(classify(createEchoKeepsakeReplayAddress(biome))).toBe('otherRoom');
  });

  it('rejects an owner of the room that is neither a transaction nor a room action', () => {
    for (const address of [
      occurrence,
      owner('unranked'),
      createSteadyGrowthOutcomeAddress(occurrence, 'Encounter'),
    ])
      expect(() => classify(address)).toThrow(
        expect.objectContaining({ code: 'executionCoverageMissing' }),
      );
    expect(() => classify(createEchoKeepsakeReplayAddress(biome), occurrenceId)).toThrow(
      expect.objectContaining({ code: 'executionCoverageMissing' }),
    );
  });

  it('drops classified non-transaction edges and keeps transaction edges', () => {
    expect(
      roomTimelineDependencies(
        classifiedRoom,
        {
          nodes: [],
          dependencies: [
            edge('screen', 'cage'),
            edge('screen', 'eris'),
            { owner: owner('screen'), afterOwner: refillPurchase },
          ],
        },
        transactions,
        occurrenceId,
      ),
    ).toEqual([]);
  });
});

describe('natively ordered trait mutations', () => {
  const steadyGrowth = createSteadyGrowthOutcomeAddress(occurrence, 'Encounter');
  const embryo = createTranscendentEmbryoOutcomeAddress(occurrence, 'Encounter');
  const reward = createIncomingRewardAddress(biome, occurrenceId);
  const chosen = createAcquisitionRoleAddress(reward, 'chosenSource');
  const spurned = createAcquisitionRoleAddress(reward, 'spurnedSource');

  it('publishes an automatic outcome edge only where the screen can open before it', () => {
    const { room: automaticRoom, transactions } = room(
      [
        { key: 'cage', kind: 'screen', window: { kind: 'encounterEnd', phaseKey: 'Encounter' } },
        { key: 'reward', kind: 'screen' },
      ],
      [steadyGrowth, embryo],
    );
    const dependencies = [
      { owner: owner('cage'), afterOwner: steadyGrowth },
      { owner: owner('reward'), afterOwner: steadyGrowth },
      { owner: owner('reward'), afterOwner: embryo },
    ];
    expect(
      roomTimelineDependencies(automaticRoom, { nodes: [], dependencies }, transactions, 'x'),
    ).toEqual([dependencies[0]]);
  });

  it('leaves Devotion’s spurned boon unordered after the chosen one', () => {
    const { room: devotionRoom, transactions } = room([
      {
        key: 'chosen',
        kind: 'screen',
        owner: chosen,
        window: { kind: 'standard', phase: 'beforeCombat' },
      },
      { key: 'spurned', kind: 'screen', owner: spurned },
    ]);
    expect(
      roomTimelineDependencies(
        devotionRoom,
        { nodes: [], dependencies: [{ owner: spurned, afterOwner: chosen }] },
        transactions,
        'x',
      ),
    ).toEqual([]);
  });

  it('classifies every trait-history event for a later screen’s chain', () => {
    const roles: Record<TraitHistoryEvent['kind'], TraitMutationChainRole> = {
      traitOffer: 'chained',
      concaveStoneSecondary: 'native',
      levelMutation: 'chained',
      steadyGrowthProgress: 'none',
      roomsPerUpgradeGrowthProgress: 'none',
      pickupProducerProgress: 'none',
      roomDecayProgress: 'none',
      rarityMutation: 'chained',
      rarityBlock: 'none',
      elementContribution: 'chained',
      directTraitGrant: 'native',
      traitRemoval: 'chained',
      anvilTransformation: 'chained',
      echoKeepsakeReplay: 'none',
      chaosPair: 'chained',
      directChaosBlessing: 'chained',
      directChaosBlessingRemoval: 'chained',
      chaosClock: 'native',
    };
    const event = (kind: TraitHistoryEvent['kind'], acquisitionRole = 'self') =>
      ({ kind, acquisitionRole }) as unknown as TraitHistoryEvent;
    for (const [kind, role] of Object.entries(roles))
      expect(traitMutationChainRole(event(kind as TraitHistoryEvent['kind']))).toBe(role);
    expect(traitMutationChainRole(event('elementContribution', 'resource:Ore'))).toBe('native');
    for (const [role, expected] of [
      ['experimentalHammerExpiry', 'native'],
      ['roomDecay', 'native'],
      ['echoShopDuplicateConsumed', 'native'],
      ['purgingPoolSale', 'chained'],
      ['nemesisTraitTrade', 'chained'],
      ['jeweledPomCleanup', 'chained'],
      ['source', 'chained'],
    ] as const)
      expect(traitMutationChainRole(event('traitRemoval', role))).toBe(expected);
  });
});

describe('published trait screen dependencies', () => {
  const fixture = (name: string) => {
    const entry = executionFixtures.find((candidate) => candidate.name === name);
    if (entry === undefined) throw new Error(`missing execution fixture ${name}`);
    const assembly = simulateProjectAssembly(catalog, entry.project());
    return { assembly, product: assembleExecutionProduct({ assembly, catalog }) };
  };
  const occurrenceNamed = (product: ReturnType<typeof fixture>['product'], gameName: string) => {
    const found = product.occurrences.find((candidate) => candidate.gameName === gameName);
    if (found === undefined) throw new Error(`missing ${gameName}`);
    return found;
  };
  const ownerOf = (
    entry: ReturnType<typeof occurrenceNamed>,
    kind: ExecutionTimelineTransaction['kind'],
  ) => entry.timeline.transactions.find((transaction) => transaction.kind === kind)?.owner;

  it('fences the Postboss rack against its screens but never a plain Fountain', () => {
    const { product } = fixture('surface-trait-fences');
    const postboss = occurrenceNamed(product, 'O_PostBoss01');
    const delivery = ownerOf(postboss, 'acquisition');
    const fountain = ownerOf(postboss, 'fountainUse');
    expect(postboss.timeline.dependencies).toContainEqual({
      owner: delivery,
      afterOwner: ownerOf(postboss, 'keepsakeChange'),
    });
    expect(
      postboss.timeline.dependencies.filter(
        (dependency) => dependency.owner === fountain || dependency.afterOwner === fountain,
      ),
    ).toEqual([]);
    const reprieve = occurrenceNamed(product, 'O_Reprieve01');
    expect(reprieve.timeline.dependencies).toEqual([]);
  });

  it("publishes no edge after an automatic outcome or Devotion's chosen boon", () => {
    const { assembly, product } = fixture('surface-scheduled-lifecycle');
    const facts = assembly.evaluation.route.biomes.flatMap((entry) =>
      'rewards' in entry ? entry.rewards.timelineFacts.dependencies : [],
    );
    expect(facts.filter(({ afterOwner }) => afterOwner.kind === 'occurrence')).toEqual([]);
    const automatic = new Set(
      product.occurrences.flatMap((entry) =>
        entry.timeline.transactions.flatMap((transaction) =>
          transaction.kind === 'automatic' ? [transaction.owner] : [],
        ),
      ),
    );
    expect(automatic.size).toBeGreaterThan(0);
    expect(
      product.occurrences
        .flatMap((entry) => entry.timeline.dependencies)
        .filter((dependency) => automatic.has(dependency.afterOwner)),
    ).toEqual([]);
    expect(
      occurrenceNamed(fixture('surface-nopq').product, 'O_Devotion01').timeline.dependencies,
    ).toEqual([]);
  });

  it('publishes a room whose Experimental Hammer expires before a later screen', () => {
    const hammerCatalog = createCatalog({
      ...declarations,
      keepsakes: declarations.keepsakes.map((keepsake) =>
        keepsake.key === 'TempHammerKeepsake' && keepsake.effect?.kind === 'experimentalHammer'
          ? {
              ...keepsake,
              effect: {
                ...keepsake.effect,
                qualifyingEncounterUsesByRank: { Common: 3, Rare: 3, Epic: 3, Heroic: 3 },
              },
            }
          : keepsake,
      ),
    });
    const selection = createRouteStartKeepsakeSelectionAddress('Underworld');
    let project = applyProjectCommand(createCompleteFGProject(), hammerCatalog, {
      kind: 'ReplaceStartingKeepsake',
      selection,
      keepsakeKey: 'TempHammerKeepsake',
    });
    project = applyProjectCommand(project, hammerCatalog, {
      kind: 'ReplaceExperimentalHammerEquipResult',
      result: createKeepsakeEquipResultAddress(selection, 'experimentalHammer'),
      value: { kind: 'selected', traitKey: 'StaffJumpSpecialTrait' },
    });
    const product = assembleExecutionProduct({
      assembly: simulateProjectAssembly(hammerCatalog, project),
      catalog: hammerCatalog,
    });
    expect(occurrenceNamed(product, 'F_Combat03').timeline.transactions.length).toBeGreaterThan(0);
  });
});
