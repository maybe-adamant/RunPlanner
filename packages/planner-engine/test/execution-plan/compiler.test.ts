import { describe, expect, it } from 'vitest';

import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createEncounterPhaseAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  createTranscendentEmbryoOutcomeAddress,
} from '../../src/authored-project';
import { simulateProjectAssembly } from '../../src/simulation';
import {
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
  ExecutionCompilerError,
  ExecutionPlanCodecError,
} from '../../src/execution-plan';
import positiveFixture from './fixtures/f-opening.execution.json';
import fgFixture from './fixtures/fg.execution.json';
import malformedFixture from './fixtures/malformed.execution.json';
import unsupportedFixture from './fixtures/unsupported.execution.json';

function fOnlyProject(project = createCompleteFGProject()) {
  return Object.freeze({
    ...project,
    route: Object.freeze({
      ...project.route,
      biomes: Object.freeze(project.route.biomes.slice(0, 1)),
    }),
  });
}

function narcissusSelectedProject() {
  let project = createCompleteFGProject();
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === 'G')
    ?.topology?.occurrences.find((room) => room.gameName === 'G_Story01');
  if (occurrence === undefined) throw new Error('Golden G project lacks Narcissus');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenGBiome,
        { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
        'Encounter',
      ),
      'selection',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Narcissus',
      options: [{ traitKey: 'NarcissusA' }, { traitKey: 'NarcissusB' }, { traitKey: 'NarcissusC' }],
      selectedOptionKey: 'option1',
    },
  });
  return project;
}

function fixtureClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fAutomaticOutcomeProject() {
  let project = createCompleteFGProject();
  const selection = createRouteStartKeepsakeSelectionAddress('Underworld');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection,
    keepsakeKey: 'RandomBlessingKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTranscendentEmbryoEquipResult',
    result: createKeepsakeEquipResultAddress(selection, 'transcendentEmbryo'),
    value: { blessingKey: 'ChaosWeaponBlessing' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTranscendentEmbryoTransformation',
    outcome: createTranscendentEmbryoOutcomeAddress(
      createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(7, 1)),
      'Encounter',
    ),
    blessingKey: 'ChaosElementalBlessing',
  });
  const growthReward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(6, 1));
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: growthReward,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(growthReward, 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Demeter',
      options: [
        { traitKey: 'BoonGrowthBoon', rarity: 'Epic' },
        { traitKey: 'ReserveManaHitShieldBoon', rarity: 'Epic' },
        { traitKey: 'PlantHealthBoon', rarity: 'Epic' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  const frontier = simulateProjectAssembly(catalog, fOnlyProject(project));
  const missing = frontier.evaluation.findings.find(
    (finding) => finding.code === 'steadyGrowthOutcomeMissing',
  )?.origin;
  if (missing?.kind !== 'steadyGrowthOutcome')
    throw new Error('automatic outcome fixture did not reach Steady Growth');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceSteadyGrowthTarget',
    outcome: missing,
    targetTraitKey: 'ApolloWeaponBoon',
  });
  return fOnlyProject(project);
}

describe('execution plan compiler', () => {
  it('projects the complete-valid F opening into an execution-only artifact', () => {
    const project = fOnlyProject();
    const plan = compileExecutionPlan({
      assembly: simulateProjectAssembly(
        // The fixture and compiler both use the catalog composed by the app.
        // Importing it here keeps this test at the engine boundary.
        catalog,
        project,
      ),
    });

    expect(plan).toMatchObject({
      format: 'run-planner-execution',
      protocolVersion: 6,
      routeKey: 'Underworld',
      extent: { kind: 'configuredPrefix', biomeKeys: ['F'], terminalBiomeKey: 'F' },
    });
    expect(plan.rooms[0]).toMatchObject({
      id: 'golden-f-start',
      biomeKey: 'F',
      gameName: 'F_Opening01',
      contents: {
        incomingReward: {
          rewardType: 'Boon',
          producerLifecycleKey: 'RoomReward',
          resolvedStoreKey: 'RunProgress',
          source: 'ApolloUpgrade',
        },
      },
      entered: true,
      trace: [
        { kind: 'roomEntered' },
        {
          kind: 'acquireReward',
          roles: [
            {
              role: 'source',
              traitOffer: { kind: 'traits', giver: 'Apollo', selected: 'option1' },
            },
          ],
        },
        { kind: 'encounterStart', phase: 'Encounter' },
        { kind: 'encounterEnd', phase: 'Encounter' },
        { kind: 'cleanup' },
        { kind: 'beforeRoomExit' },
      ],
      outgoing: {
        targets: [{ exitKey: 'exit1', index: 1, type: 'ErebusExitDoor', picked: true }],
        selectedExitKey: 'exit1',
      },
    });
    expect(plan.planFingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
    expect(decodeExecutionPlan(positiveFixture)).toEqual(plan);
  });

  it('projects the selected Narcissus descriptor at its encounter interaction', () => {
    const assembly = simulateProjectAssembly(catalog, narcissusSelectedProject());
    const g = assembly.evaluation.route?.biomes.find((biome) => biome.biomeKey === 'G');
    if (g === undefined || !('rewards' in g)) throw new Error('G reward assembly missing');
    const narcissus = g.rewards.selectedTraitOffers.find(
      (candidate) => candidate.offer.giverKey === 'Narcissus',
    );
    expect(narcissus).toBeDefined();
    // Keep the canonical address visible in a failure: this is the exact
    // producer/consumer contract the execution trace must join.
    expect(narcissus?.address).toEqual(
      createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenGBiome,
          { kind: 'occurrence', occurrenceId: goldenGOccurrenceId(3, 1) },
          'Encounter',
        ),
        'selection',
      ),
    );
    const plan = compileExecutionPlan({ assembly });
    const interaction = plan.rooms
      .flatMap((room) => room.trace)
      .find((step) => step.kind === 'encounterInteraction' && step.resolution !== undefined);
    expect(interaction).toMatchObject({
      kind: 'encounterInteraction',
      resolution: {
        kind: 'traitOffer',
        offer: { giver: 'Narcissus', selected: 'option1' },
      },
    });
  });

  it('requires the complete run-state diagnostic surface', () => {
    const missingKeepsakes = fixtureClone(positiveFixture) as {
      rooms: { trace: { runState: Record<string, unknown> }[] }[];
    };
    delete missingKeepsakes.rooms[0]!.trace[0]!.runState.keepsakes;
    expect(() => decodeExecutionPlan(missingKeepsakes)).toThrow(ExecutionPlanCodecError);

    const missingPriorities = fixtureClone(positiveFixture) as {
      rooms: { trace: { runState: Record<string, unknown> }[] }[];
    };
    delete missingPriorities.rooms[0]!.trace[0]!.runState.rewardPriorities;
    expect(() => decodeExecutionPlan(missingPriorities)).toThrow(ExecutionPlanCodecError);

    const missingHex = fixtureClone(positiveFixture) as {
      rooms: { trace: { runState: Record<string, unknown> }[] }[];
    };
    delete missingHex.rooms[0]!.trace[0]!.runState.hexProgress;
    expect(() => decodeExecutionPlan(missingHex)).toThrow(ExecutionPlanCodecError);

    const missingArtificer = fixtureClone(positiveFixture) as {
      rooms: { trace: { runState: Record<string, unknown> }[] }[];
    };
    delete missingArtificer.rooms[0]!.trace[0]!.runState.artificer;
    expect(() => decodeExecutionPlan(missingArtificer)).toThrow(ExecutionPlanCodecError);

    const duplicatePriorities = fixtureClone(positiveFixture) as {
      rooms: { trace: { runState: { rewardPriorities: string[] } }[] }[];
    };
    duplicatePriorities.rooms[0]!.trace[0]!.runState.rewardPriorities = ['Boon', 'Boon'];
    const decodedPriorities = decodeExecutionPlan(duplicatePriorities).rooms[0]!.trace[0]!;
    if (decodedPriorities.kind !== 'roomEntered') throw new Error('fixture lacks entry checkpoint');
    expect(decodedPriorities.runState.rewardPriorities).toEqual(['Boon', 'Boon']);
  });

  it('keeps additional continuations distinct and closes exactly one selected continuation', () => {
    // Route-detour/Stygian Well suites own real Ixion topology policy. This
    // codec witness covers only the v5 execution-wire translation boundary.
    type MutableRoom = {
      id: string;
      owner: string;
      biomeKey: string;
      gameName: string;
      entered: boolean;
      trace: unknown[];
      outgoing: {
        owner: string;
        kind: string;
        additional?: {
          kind: string;
          key: string;
          owner: string;
          room: { id: string; biomeKey: string; gameName: string };
          picked: boolean;
        }[];
        [key: string]: unknown;
      };
    };
    const plan = fixtureClone(positiveFixture) as unknown as { rooms: MutableRoom[] };
    const sourceRoom = plan.rooms[0];
    const templateRoom = plan.rooms[1];
    if (sourceRoom === undefined || templateRoom === undefined)
      throw new Error('fixture lacks codec rooms');
    const outgoing = sourceRoom.outgoing;
    const chaosRoom = fixtureClone(templateRoom);
    chaosRoom.id = 'codec-chaos-room';
    chaosRoom.owner = '["occurrence","Underworld","F","codec-chaos-room"]';
    chaosRoom.gameName = 'Chaos_01';
    chaosRoom.entered = false;
    chaosRoom.trace = [];
    chaosRoom.outgoing = { owner: chaosRoom.owner, kind: 'terminal' };
    plan.rooms.push(chaosRoom);
    outgoing.additional = [
      {
        kind: 'chaos',
        key: 'chaos',
        owner: '["additionalExit","Underworld","F","golden-f-start","chaos"]',
        room: { id: chaosRoom.id, biomeKey: 'F', gameName: chaosRoom.gameName },
        picked: false,
      },
    ];
    expect(decodeExecutionPlan(plan).rooms[0]!.outgoing).toMatchObject({
      additional: [{ key: 'chaos' }],
    });
    const additional = outgoing.additional[0];
    if (additional === undefined) throw new Error('fixture lacks additional exit');
    additional.picked = true;
    expect(() => decodeExecutionPlan(plan)).toThrow(ExecutionPlanCodecError);
    additional.picked = false;
    delete outgoing.additional;
    expect(() => decodeExecutionPlan(plan)).toThrow(ExecutionPlanCodecError);
  });

  it('accepts repeated Chaos curse identities and decimal selected operands', () => {
    type MutableTrace = {
      kind: string;
      roles?: { traitOffer?: Record<string, unknown> }[];
    };
    const plan = fixtureClone(positiveFixture) as unknown as {
      rooms: { trace: MutableTrace[] }[];
    };
    const role = plan.rooms[0]!.trace.find((step) => step.kind === 'acquireReward')?.roles?.[0];
    if (role === undefined) throw new Error('fixture lacks an acquisition role');
    role.traitOffer = {
      kind: 'chaos',
      giver: 'Chaos',
      curseOptions: [
        { curseKey: 'ChaosSpeedCurse', requirementCount: 3 },
        { curseKey: 'ChaosSpeedCurse', requirementCount: 4 },
        { curseKey: 'ChaosStunCurse', requirementCount: 5 },
      ],
      selected: 'option1',
      selectedCurseValues: { speedMultiplier: 0.45 },
      blessingKey: 'ChaosExSpeedBlessing',
      rarity: 'Rare',
      blessingValues: { weaponSpeed: 0.82, propertySpeed: 0.83 },
    };
    expect(() => decodeExecutionPlan(plan)).not.toThrow();
  });

  it('closes Shop Travel Deal and room-object trace records against their contents', () => {
    const malformedTravelDeal = fixtureClone(positiveFixture) as {
      rooms: { contents: { shop?: Record<string, unknown> } }[];
    };
    const shop = malformedTravelDeal.rooms.find((room) => room.contents.shop !== undefined)
      ?.contents.shop;
    if (shop === undefined) throw new Error('fixture lacks World Shop');
    shop.travelDealRefill = {
      sourceOfferKey: 'not-a-slot',
      slotIndex: 0,
      optionKey: 'RoomRewardHealDrop',
      reward: { rewardType: 'MajorNonBoon', producerLifecycleKey: 'Shop' },
    };
    expect(() => decodeExecutionPlan(malformedTravelDeal)).toThrow(ExecutionPlanCodecError);

    const malformedShopPurchase = fixtureClone(positiveFixture) as {
      rooms: {
        owner: string;
        contents: {
          shop?: { offers: { offerKey: string; rewardType: string }[] };
        };
        trace: unknown[];
      }[];
    };
    const shopRoom = malformedShopPurchase.rooms.find((room) => room.contents.shop !== undefined);
    const shopOffer = shopRoom?.contents.shop?.offers[0];
    if (shopRoom === undefined || shopOffer === undefined)
      throw new Error('fixture lacks World Shop offer');
    shopRoom.trace.splice(-1, 0, {
      id: 'bad-shop-purchase',
      kind: 'worldShopPurchase',
      owner: shopRoom.owner,
      offerKey: shopOffer.offerKey,
      rewardType: `${shopOffer.rewardType}:wrong`,
    });
    expect(() => decodeExecutionPlan(malformedShopPurchase)).toThrow(ExecutionPlanCodecError);

    const malformedWellTrace = fixtureClone(positiveFixture) as {
      rooms: { trace: unknown[] }[];
    };
    malformedWellTrace.rooms[0]!.trace.splice(1, 0, {
      id: 'bad-well',
      kind: 'stygianWellPurchase',
      owner: '["roomAction","Underworld","F","golden-f-start","bad"]',
      generationKey: 'initial:healing',
      offerKey: 'HealDropRange',
    });
    expect(() => decodeExecutionPlan(malformedWellTrace)).toThrow(ExecutionPlanCodecError);

    const malformedFountainOwner = fixtureClone(positiveFixture) as {
      rooms: { trace: { kind: string; owner: string }[] }[];
    };
    const fountain = malformedFountainOwner.rooms
      .flatMap((room) => room.trace)
      .find((step) => step.kind === 'fountainUse');
    if (fountain === undefined) throw new Error('fixture lacks fountain use');
    fountain.owner = fountain.owner.replace('[\\"useFountain\\"]', '[\\"interactKeepsakeRack\\"]');
    expect(() => decodeExecutionPlan(malformedFountainOwner)).toThrow(ExecutionPlanCodecError);
  });

  it('decodes only an exact successful resource outcome', () => {
    const withResource = fixtureClone(positiveFixture) as {
      rooms: { contents: Record<string, unknown> }[];
    };
    withResource.rooms[0]!.contents.resources = [
      {
        acquisitionRole: 'resource:FireEssence',
        grantedTraitKey: 'FireEssence',
        contributions: { Fire: 1 },
      },
    ];
    expect(decodeExecutionPlan(withResource).rooms[0]!.contents.resources).toEqual([
      {
        acquisitionRole: 'resource:FireEssence',
        grantedTraitKey: 'FireEssence',
        contributions: { Fire: 1 },
      },
    ]);
    (
      withResource.rooms[0]!.contents.resources as { acquisitionRole: string }[]
    )[0]!.acquisitionRole = 'resource:AirEssence';
    expect(() => decodeExecutionPlan(withResource)).toThrow(ExecutionPlanCodecError);
  });

  it('admits only the configured complete-valid F/G prefix', () => {
    const plan = compileExecutionPlan({
      assembly: simulateProjectAssembly(catalog, createCompleteFGProject()),
    });
    expect(plan.extent.biomeKeys).toEqual(['F', 'G']);
  });

  it('emits the resolved Rivals Boss room with its declaration-fixed encounter', () => {
    const rivals = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 2,
    });
    const plan = compileExecutionPlan({ assembly: simulateProjectAssembly(catalog, rivals) });
    expect(plan.rooms.find((room) => room.gameName === 'G_Boss02')).toMatchObject({
      contents: { encounterPhases: [{ slotKey: 'Encounter', encounterKey: 'BossScylla02' }] },
    });
  });

  it('projects a complete F/G prefix through peer and fixed links', () => {
    const project = createCompleteFGProject();
    const fg = Object.freeze({
      ...project,
      route: Object.freeze({
        ...project.route,
        biomes: Object.freeze(project.route.biomes.slice(0, 2)),
      }),
    });
    const plan = compileExecutionPlan({ assembly: simulateProjectAssembly(catalog, fg) });
    expect(plan.extent).toEqual({
      kind: 'configuredPrefix',
      biomeKeys: ['F', 'G'],
      terminalBiomeKey: 'G',
    });
    expect(plan.rooms.length).toBeGreaterThan(23);
    expect(plan.rooms.some((room) => room.entered && room.gameName === 'G_Intro')).toBe(true);
    const fTwoExit = plan.rooms.find(
      (room) =>
        room.biomeKey === 'F' &&
        room.outgoing.kind === 'batch' &&
        room.outgoing.targets.length === 2,
    );
    expect(fTwoExit?.outgoing).toMatchObject({
      kind: 'batch',
      targets: [
        { index: 1, picked: true },
        { index: 2, picked: false },
      ],
    });
    const gThreeExit = plan.rooms.find(
      (room) =>
        room.biomeKey === 'G' &&
        room.outgoing.kind === 'batch' &&
        room.outgoing.targets.length === 3,
    );
    expect(gThreeExit?.outgoing).toMatchObject({
      kind: 'batch',
      targets: [{ index: 1 }, { index: 2 }, { index: 3 }],
    });
    expect(plan.rooms.filter((room) => room.gameName === 'F_PreBoss01')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entered: false,
          contents: expect.objectContaining({
            incomingReward: expect.objectContaining({ rewardType: 'StackUpgrade' }),
          }),
        }),
      ]),
    );
    expect(
      plan.rooms
        .filter(
          (room) =>
            room.biomeKey === 'F' &&
            room.outgoing.kind === 'fixed' &&
            room.outgoing.target.biomeKey === 'G',
        )
        .map((room) => room.gameName),
    ).toEqual(['F_PostBoss01']);
    for (const room of plan.rooms.filter((candidate) => candidate.entered)) {
      const entry = room.trace[0];
      const exit = room.trace.at(-1);
      expect(entry).toMatchObject({ kind: 'roomEntered' });
      expect(exit).toMatchObject({ kind: 'beforeRoomExit' });
      expect(entry !== undefined && 'runState' in entry ? entry.runState : undefined).toBeDefined();
      expect(exit !== undefined && 'runState' in exit ? exit.runState : undefined).toBeDefined();
    }
    expect(decodeExecutionPlan(fgFixture)).toEqual(plan);
  });

  it('projects reached automatic outcomes at their encounter-end owners', () => {
    const plan = compileExecutionPlan({
      assembly: simulateProjectAssembly(catalog, fAutomaticOutcomeProject()),
    });
    expect(plan.rooms.flatMap((room) => room.trace)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'transcendentEmbryo',
          source: 'ChaosWeaponBlessing',
          target: 'ChaosElementalBlessing',
          rarity: 'Epic',
        }),
        expect.objectContaining({
          kind: 'steadyGrowth',
          source: 'BoonGrowthBoon',
          target: 'ApolloWeaponBoon',
        }),
      ]),
    );
  });

  it('requires the simulator-owned exact assembly at the compiler boundary', () => {
    const assembly = simulateProjectAssembly(catalog, fOnlyProject());
    expect(() =>
      compileExecutionPlan({
        assembly: { project: assembly.project, evaluation: assembly.evaluation },
      }),
    ).toThrow(/was not produced by this simulator execution/);
  });

  it('rejects malformed and unsupported wire values at the codec boundary', () => {
    expect(() => decodeExecutionPlan(malformedFixture)).toThrow(ExecutionPlanCodecError);
    expect(() => decodeExecutionPlan(unsupportedFixture)).toThrow(
      /unsupported execution protocol version/,
    );
    const plan = compileExecutionPlan({
      assembly: simulateProjectAssembly(catalog, fOnlyProject()),
    });
    expect(() => decodeExecutionPlan({ ...plan, protocolVersion: 1 })).toThrow(
      /unsupported execution protocol version/,
    );
    expect(() => decodeExecutionPlan({ ...plan, catalogVersion: 'old-catalog' })).toThrow(
      /unsupported execution catalog version/,
    );
    expect(() => decodeExecutionPlan({ ...plan, planFingerprint: 'not-a-fingerprint' })).toThrow(
      /planFingerprint/,
    );
    const opening = plan.rooms[0];
    if (opening === undefined || opening.outgoing.kind !== 'batch')
      throw new Error('opening batch is missing');
    const target = opening.outgoing.targets[0];
    if (target === undefined) throw new Error('opening target is missing');
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            outgoing: { ...opening.outgoing, targets: [{ ...target, index: '1' }] },
          },
        ],
      }),
    ).toThrow(/index/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            outgoing: { ...opening.outgoing, targets: [{ ...target, index: 17 }] },
          },
        ],
      }),
    ).toThrow(/index/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            outgoing: { ...opening.outgoing, targets: [{ ...target, picked: 1 }] },
          },
        ],
      }),
    ).toThrow(/picked/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            outgoing: { ...opening.outgoing, selectedExitKey: 'missing' },
          },
        ],
      }),
    ).toThrow(/select exactly one picked target/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            outgoing: {
              ...opening.outgoing,
              targets: [{ ...target, picked: false }],
            },
          },
        ],
      }),
    ).toThrow(/select exactly one picked target/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [{ ...plan.rooms[0], trace: [] }],
      }),
    ).toThrow(/trace/);
    // Lua applies the same 64-step cap before it inspects lifecycle shape.
    // Keep the producer decoder from accepting a plan the executor refuses.
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [{ ...plan.rooms[0], trace: Array.from({ length: 65 }, () => opening.trace[0]!) }],
      }),
    ).toThrow(/trace/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...plan.rooms[0],
            trace: [{ ...opening.trace[0], owner: 'another-owner' }],
          },
        ],
      }),
    ).toThrow(/owner mismatch/);

    const entry = opening.trace.find((step) => step.kind === 'roomEntered');
    const acquisition = opening.trace.find((step) => step.kind === 'acquireReward');
    const encounterStart = opening.trace.find((step) => step.kind === 'encounterStart');
    if (
      entry?.kind !== 'roomEntered' ||
      acquisition?.kind !== 'acquireReward' ||
      encounterStart?.kind !== 'encounterStart'
    )
      throw new Error('opening trace is missing Gate C witnesses');
    const acquisitionRole = acquisition.roles[0];
    if (acquisitionRole?.traitOffer?.kind !== 'traits')
      throw new Error('opening acquisition is missing its ordinary trait offer');

    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === entry
                ? { ...entry, runState: { ...entry.runState, internalState: true } }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/unknown field internalState/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === entry
                ? { ...entry, runState: { ...entry.runState, owner: 'another-checkpoint' } }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/runState owner mismatch/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === acquisition
                ? {
                    ...acquisition,
                    roles: [{ ...acquisitionRole, internalRole: true }],
                  }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/unknown field internalRole/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === acquisition
                ? {
                    ...acquisition,
                    roles: [
                      {
                        ...acquisitionRole,
                        traitOffer: {
                          ...acquisitionRole.traitOffer,
                          selected: 'option4',
                        },
                      },
                    ],
                  }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/selected must identify a declared option/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === acquisition
                ? { ...acquisition, producerLifecycleKey: 'differentLifecycle' }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/must match reward provenance/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === encounterStart ? { ...encounterStart, phase: 'UnknownPhase' } : step,
            ),
          },
        ],
      }),
    ).toThrow(/declared encounter phase/);
    const differentSource = '["incomingReward","Underworld","F","another-occurrence"]';
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === acquisition
                ? {
                    ...acquisition,
                    owner: JSON.stringify([
                      'acquisitionRole',
                      'Underworld',
                      'F',
                      differentSource,
                      acquisitionRole.role,
                    ]),
                    sourceOwner: differentSource,
                  }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/does not belong to this room/);
    if (acquisitionRole.settlement === undefined)
      throw new Error('opening acquisition is missing settlement provenance');
    const wrongEntry = JSON.stringify([
      'acquisitionEntry',
      'Underworld',
      'F',
      acquisitionRole.settlement.site,
      'wrong-role',
    ]);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === acquisition
                ? {
                    ...acquisition,
                    roles: [
                      {
                        ...acquisitionRole,
                        settlement: { ...acquisitionRole.settlement, entry: wrongEntry },
                      },
                    ],
                  }
                : step,
            ),
          },
        ],
      }),
    ).toThrow(/entry does not match its site and role/);
    expect(() =>
      decodeExecutionPlan({
        ...plan,
        rooms: [
          {
            ...opening,
            trace: opening.trace.map((step) =>
              step === encounterStart ? { ...encounterStart, flags: [] } : step,
            ),
          },
        ],
      }),
    ).toThrow(/unknown field flags/);
    expect(ExecutionCompilerError).toBeDefined();
  });
});
