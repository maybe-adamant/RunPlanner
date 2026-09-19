import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createRouteAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createLocalVisitSlotAddress,
  createProjectDocument,
  createShopOfferAddress,
  createStartingRewardAddress,
  createTargetAddress,
  createTraitOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { loadSurfaceNCheckpoint } from '../checkpoints/surface';
import { authorLegalTraitOffers, authorLegalPomResolutions } from '../shared';

const qBiome = createBiomeAddress('Dream', 'Q');

/**
 * A command-authored public Dream itinerary. Only Q is configured for this
 * execution witness; F and N remain later legal Dream selections exercised
 * by the native cursor witness.
 */
export function dreamMixedPrefixProject(): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId: 'execution-dream-q-f-n-h',
    routeKey: 'Dream',
    itineraryBiomeKeys: ['Q', 'F', 'N', 'H'],
    configuredBiomeCount: 1,
  });
  const qStart = project.route.biomes[0]!.topology!.startOccurrenceId;
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingReward',
    reward: createStartingRewardAddress('Dream'),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(qBiome, qStart), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  for (const [sourceOccurrenceId, targets] of [
    [qStart, [['dream-q-foyer', 'Q_Combat10']]],
    ['dream-q-foyer', [['dream-q-first-fork', 'Q_Combat03']]],
    [
      'dream-q-first-fork',
      [
        ['dream-q-first-miniboss', 'Q_MiniBoss02'],
        ['dream-q-first-miniboss-peer', 'Q_MiniBoss05'],
      ],
    ],
    ['dream-q-first-miniboss', [['dream-q-ordinary', 'Q_Combat01']]],
    ['dream-q-ordinary', [['dream-q-second-fork', 'Q_Combat12']]],
    [
      'dream-q-second-fork',
      [
        ['dream-q-second-miniboss', 'Q_MiniBoss03'],
        ['dream-q-second-miniboss-peer', 'Q_MiniBoss04'],
      ],
    ],
  ] as const) {
    const decision = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId(sourceOccurrenceId),
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    for (const [index, [occurrenceId, gameName]] of targets.entries()) {
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(qBiome, decision.source, `exit${index + 1}`),
        occurrenceId: createOccurrenceId(occurrenceId),
        gameName,
      });
    }
    if (targets.length > 1) {
      project = applyProjectCommand(project, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(qBiome, decision.source),
        value: { kind: 'normal', exitKey: 'exit1' },
      });
    }
  }
  for (const [occurrenceId, source, giverKey, options] of [
    [
      'dream-q-first-miniboss',
      'AresUpgrade',
      'Ares',
      ['AresWeaponBoon', 'AresSpecialBoon', 'AresManaBoon'],
    ],
    [
      'dream-q-first-miniboss-peer',
      'ApolloUpgrade',
      'Apollo',
      ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon'],
    ],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(qBiome, createOccurrenceId(occurrenceId)),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createIncomingRewardAddress(qBiome, createOccurrenceId(occurrenceId)),
        'source',
      ),
      value: {
        kind: 'traits',
        giverKey,
        options: [
          { traitKey: options[0], rarity: 'Rare' },
          { traitKey: options[1], rarity: 'Rare' },
          { traitKey: options[2], rarity: 'Rare' },
        ],
        selectedOptionKey: 'option1',
      },
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(qBiome, createOccurrenceId('dream-q-second-miniboss')),
    value: { rewardType: 'WeaponUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(qBiome, createOccurrenceId('dream-q-second-miniboss')),
      'self',
    ),
    value: {
      kind: 'traits',
      giverKey: 'WeaponUpgrade',
      options: [
        { traitKey: 'StaffDoubleAttackTrait' },
        { traitKey: 'StaffLongAttackTrait' },
        { traitKey: 'StaffDashAttackTrait' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(qBiome, createOccurrenceId('dream-q-second-miniboss-peer')),
    value: { rewardType: 'StackUpgradeTriple' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('dream-q-second-miniboss'),
    }),
    gameName: 'Q_PreBoss01',
    targetOccurrenceIds: { exit1: createOccurrenceId('dream-q-preboss') },
  });
  for (const [offerKey, optionKey, offer] of [
    ['MixedProgress1', 'MaxHealthDrop', { rewardType: 'MaxHealthDrop' }],
    ['MixedProgress2', 'MaxManaDrop', { rewardType: 'MaxManaDrop' }],
    [
      'LargeSurvival',
      'RandomLoot',
      { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    ],
    ['Survival', 'RoomRewardHealDrop', { rewardType: 'RoomRewardHealDrop' }],
    [
      'PremiumProgress',
      'RandomLoot',
      { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    ],
    ['MetaProgress', 'ElementalBoost', { rewardType: 'ElementalBoost' }],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOfferOption',
      offer: createShopOfferAddress(qBiome, createOccurrenceId('dream-q-preboss'), offerKey),
      value: { optionKey, offer },
    });
  }
  for (const [offerKey, giverKey, options] of [
    ['LargeSurvival', 'Apollo', ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon']],
    ['PremiumProgress', 'Zeus', ['ZeusManaBoltBoon', 'BoltRetaliateBoon', 'FocusLightningBoon']],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createShopOfferAddress(qBiome, createOccurrenceId('dream-q-preboss'), offerKey),
        'source',
      ),
      value: {
        kind: 'traits',
        giverKey,
        options: [
          { traitKey: options[0], rarity: 'Common' },
          { traitKey: options[1], rarity: 'Common' },
          { traitKey: options[2], rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
  }
  return project;
}

/** Replay existing route topology choices through Dream commands, never copy
 * ordinary occurrence payloads or simulation history into the Dream route. */
export function dreamMixedHandoffProject(): ProjectDocument {
  let project = applyProjectCommand(dreamMixedPrefixProject(), catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Dream'),
    configuredBiomeCount: 3,
  });
  const f = createBiomeAddress('Dream', 'F');
  let source = { kind: 'occurrence' as const, occurrenceId: createOccurrenceId('dream-f-start') };
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: f,
    occurrenceId: source.occurrenceId,
    gameName: 'F_Opening02',
  });
  const boon = (god: string): ResolvedRewardOffer => ({
    rewardType: 'Boon',
    payload: { kind: 'BoonSource', source: `${god}Upgrade` },
  });
  const batches: readonly [string, readonly [string, ResolvedRewardOffer][]][] = [
    ['MetaProgress', [['F_Combat02', { rewardType: 'MetaCurrencyBigDrop' }]]],
    [
      'RunProgress',
      [
        ['F_Combat03', boon('Zeus')],
        ['F_Combat03', { rewardType: 'MaxHealthDrop' }],
      ],
    ],
    [
      'RunProgress',
      [
        ['F_Combat04', { rewardType: 'MaxHealthDrop' }],
        ['F_Combat04', { rewardType: 'MaxManaDrop' }],
      ],
    ],
    [
      'RunProgress',
      [
        ['F_Combat07', { rewardType: 'StackUpgrade' }],
        ['F_Combat08', { rewardType: 'RoomMoneyDrop' }],
      ],
    ],
    [
      'RunProgress',
      [
        ['F_MiniBoss01', boon('Hera')],
        ['F_MiniBoss02', boon('Apollo')],
      ],
    ],
    ['MetaProgress', [['F_Combat06', { rewardType: 'MetaCardPointsCommonBigDrop' }]]],
    [
      'RunProgress',
      [
        ['F_Combat11', { rewardType: 'MaxManaDrop' }],
        ['F_Combat11', { rewardType: 'StackUpgrade' }],
      ],
    ],
    [
      'RunProgress',
      [
        ['F_Combat12', { rewardType: 'HermesUpgrade' }],
        ['F_Combat12', { rewardType: 'SpellDrop' }],
      ],
    ],
    [
      'MetaProgress',
      [
        ['F_Combat14', { rewardType: 'MetaCardPointsCommonBigDrop' }],
        ['F_Combat14', { rewardType: 'GiftDrop' }],
      ],
    ],
    [
      'MetaProgress',
      [
        ['F_Combat15', { rewardType: 'MetaCurrencyBigDrop' }],
        ['F_Combat15', { rewardType: 'MetaCardPointsCommonBigDrop' }],
      ],
    ],
  ];
  for (const [index, [storeKey, targets]] of batches.entries()) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(f, source),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(f, source),
      storeKey,
    });
    for (const [targetIndex, [gameName, value]] of targets.entries()) {
      const occurrenceId = createOccurrenceId(`dream-f-${index + 1}-${targetIndex + 1}`);
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(f, source, `exit${targetIndex + 1}`),
        occurrenceId,
        gameName,
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(f, occurrenceId),
        value,
      });
    }
    if (targets.length > 1) {
      project = applyProjectCommand(project, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(f, source),
        value: { kind: 'normal', exitKey: 'exit1' },
      });
    }
    source = { kind: 'occurrence', occurrenceId: createOccurrenceId(`dream-f-${index + 1}-1`) };
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(f, source),
    gameName: 'F_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('dream-f-shop'),
      exit2: createOccurrenceId('dream-f-free'),
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(f, source),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(f, createOccurrenceId('dream-f-free')),
    value: { rewardType: 'MaxHealthDrop' },
  });
  const n = createBiomeAddress('Dream', 'N');
  const nBlueprint = loadSurfaceNCheckpoint().route.biomes[0]!.topology!;
  const nStart = project.route.biomes.find((biome) => biome.biomeKey === 'N')!.topology!
    .startOccurrenceId;
  const openingSource = { kind: 'occurrence' as const, occurrenceId: nStart };
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(n, openingSource),
  });
  const prehubId = createOccurrenceId('dream-n-prehub');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(n, openingSource, 'prehub'),
    occurrenceId: prehubId,
    gameName: 'N_PreHub01',
  });
  const hub = createHubDecisionAddress(n, 'hub');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(n, prehubId),
    value: { rewardType: 'StackUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(n, { kind: 'occurrence', occurrenceId: prehubId }),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceWithHubDecision',
    hub,
    decision: createExitDecisionAddress(n, { kind: 'occurrence', occurrenceId: prehubId }),
  });
  const board = nBlueprint.decisions.find((decision) => decision.kind === 'hub')!;
  if (board.kind !== 'hub') throw new Error('N fixture has no hub');
  for (const target of board.openTargets) {
    const local = nBlueprint.decisions.find(
      (decision) =>
        decision.kind === 'localVisit' && decision.sourceOccurrenceId === target.occurrenceId,
    );
    const localTargets = local?.kind === 'localVisit' ? local.targetsBySlot : {};
    project = applyProjectCommand(project, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(n, 'hub', target.hubSlotKey),
      occurrenceId: target.occurrenceId,
      localOccurrenceIdsBySlot: Object.fromEntries(
        Object.entries(localTargets).map(([key, value]) => [key, value.occurrenceId]),
      ),
    });
    const original = nBlueprint.occurrences.find(
      (row) => row.occurrenceId === target.occurrenceId,
    )!;
    if ('reward' in original.state && original.state.reward?.offer) {
      const offer = original.state.reward.offer;
      const sources: Record<string, string> = {
        combat11: 'Ares',
        combat10: 'Zeus',
        miniBoss01: 'Hera',
        combat23: 'Apollo',
        combat03: 'Zeus',
      };
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(n, target.occurrenceId),
        value: sources[target.hubSlotKey] === undefined ? offer : boon(sources[target.hubSlotKey]!),
      });
    }
    for (const key of Object.keys(localTargets)) {
      project = applyProjectCommand(project, catalog, {
        kind: 'SetLocalVisitGeneration',
        slot: createLocalVisitSlotAddress(n, target.occurrenceId, 'sideRooms', key),
        generation: localTargets[key]!.generation,
      });
      if (localTargets[key]!.generation === 'generated') {
        const side = nBlueprint.occurrences.find(
          (row) => row.occurrenceId === localTargets[key]!.occurrenceId,
        )!;
        if ('reward' in side.state && side.state.reward?.offer) {
          project = applyProjectCommand(project, catalog, {
            kind: 'ReplaceIncomingReward',
            reward: createIncomingRewardAddress(n, side.occurrenceId),
            value: side.state.reward.offer,
          });
        }
      }
    }
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHubVisitOrder',
    hub,
    hubSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'combat01'],
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(n, { kind: 'hubDecision', decisionKey: 'hub' }),
    gameName: 'N_PreBoss01',
    targetOccurrenceIds: { preboss: createOccurrenceId('dream-n-preboss') },
  });
  for (const [offerKey, optionKey, offer] of [
    [
      'Boon',
      'RandomLoot',
      { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    ],
    ['MajorNonBoon', 'MaxHealthDrop', { rewardType: 'MaxHealthDrop' }],
    ['Minor', 'MaxManaDrop', { rewardType: 'MaxManaDrop' }],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOfferOption',
      offer: createShopOfferAddress(n, createOccurrenceId('dream-n-preboss'), offerKey),
      value: { optionKey, offer },
    });
  }
  for (let pass = 0; pass < 16; pass += 1) {
    const settled = authorLegalPomResolutions(authorLegalTraitOffers(project));
    if (settled === project) return project;
    project = settled;
  }
  throw new Error('Dream fixture trait/Pom settlement did not converge');
}
