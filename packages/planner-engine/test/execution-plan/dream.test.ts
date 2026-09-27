import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  simulateProjectAssembly,
  createPreparedProjectCandidateSession,
} from '../../src/simulation';
import {
  applyProjectHistoryCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  createTargetAddress,
  decodeProjectDocument,
  echoLastRewardPickupEntryKey,
  encodeProjectDocument,
  semanticAddressKey,
  undoProjectHistory,
} from '../../src/authored-project';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
} from '../../src/execution-plan';
import {
  loadDreamHeraArtificerEchoCheckpoint,
  loadDreamMixedHandoffCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/dream';

it('publishes the saved Dream mixed-handoff route through the strict execution codec', () => {
  const assembly = simulateProjectAssembly(catalog, loadDreamMixedHandoffCheckpoint());
  expect(assembly.evaluation.findings).toEqual([]);
  const candidates = createPreparedProjectCandidateSession(catalog, assembly);
  const n = createBiomeAddress('Dream', 'N');
  const nStart = assembly.project.route.biomes.find((biome) => biome.biomeKey === 'N')!.topology!
    .startOccurrenceId;
  const nTarget = createTargetAddress(n, { kind: 'occurrence', occurrenceId: nStart }, 'prehub');
  const nBiomeEvaluation = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'N');
  if (nBiomeEvaluation === undefined || !('rewards' in nBiomeEvaluation)) {
    throw new Error('Dream N did not reach reward evaluation');
  }
  expect(
    nBiomeEvaluation.rewards.targetHistory.find(
      (checkpoint) => semanticAddressKey(checkpoint.origin) === semanticAddressKey(nTarget),
    )?.states[0]!.rewardLookups.hubRewardLookup,
  ).toEqual([]);
  expect(
    candidates.evaluate({
      kind: 'roomTarget',
      target: nTarget,
      gameName: 'N_PreHub01',
    }),
  ).toMatchObject({ result: { pressure: { biomeDepthCache: 2, selectedPossible: true } } });
  const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
  expect(plan.routeKey).toBe('Dream');
  expect(plan.extent.biomeKeys).toEqual(['Q', 'F', 'N']);
  expect(
    plan.occurrences
      .filter((room) => room.resumeBoundary === 'postbossEntry')
      .map((room) => room.gameName),
  ).toEqual(['Dream_PostBoss01', 'Dream_PostBoss02', 'Dream_PostBoss03']);
  for (const gameName of ['F_Opening02', 'N_Opening01']) {
    const room = plan.occurrences.find((room) => room.gameName === gameName);
    expect(room?.overview.encounterPhases).toEqual([
      { slotKey: 'Encounter', encounterKey: 'OpeningEmpty', kind: 'nonCombat' },
    ]);
    expect(room?.overview.incomingReward).toBeUndefined();
  }
  expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  const wire = JSON.parse(encodeExecutionPlan(plan));
  for (const biomeKeys of [[], ['Q', 'Q'], ['Unknown'], ['Q', 'F', 'N', 'H', 'O']]) {
    expect(() => decodeExecutionPlan({ ...wire, extent: { ...wire.extent, biomeKeys } })).toThrow();
  }
  for (const routeKey of ['Surface', 'Underworld']) {
    expect(() => decodeExecutionPlan({ ...wire, routeKey })).toThrow();
  }
});

it('publishes the user-authored H Hera results and actual Echo Last Reward replay', () => {
  const saved = loadDreamHeraArtificerEchoCheckpoint();
  const assembly = simulateProjectAssembly(catalog, saved);
  expect(assembly.evaluation.findings).toEqual([]);
  expect(assembly.evaluation.route.summary.eligibleForExecutionPlan).toBe(true);
  const h = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'H');
  if (h === undefined || !('rewards' in h)) throw new Error('Dream H reward evaluation is missing');
  const fieldsExit = h.rewards.runStateSnapshots.find(
    (snapshot) =>
      snapshot.owner.kind === 'roomRunStateCheckpoint' &&
      snapshot.owner.occurrenceId === 'a6b19a5f-d499-48d1-ae59-30aed524f968' &&
      snapshot.checkpoint === 'beforeRoomExit',
  );
  expect(Object.keys(fieldsExit?.traits.equippedTraits ?? {}).sort()).toEqual(
    [
      'HeraWeaponBoon',
      'DamageSharePotencyBoon',
      'OmegaHeraProjectileBoon',
      'AllElementalBoon',
      'ElementalOlympianDamageBoon',
      'ElementalRallyBoon',
      'ElementalDodgeBoon',
      'ElementalHealthBoon',
      'HeraCastBoon',
    ].sort(),
  );
  const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
  expect(plan.extent).toEqual({
    kind: 'configuredPrefix',
    biomeKeys: ['H'],
    terminalBiomeKey: 'H',
  });
  const fields = plan.occurrences.find(
    (occurrence) => occurrence.id === 'a6b19a5f-d499-48d1-ae59-30aed524f968',
  );
  const allTogether = fields?.timeline.transactions.find(
    (transaction) =>
      transaction.kind === 'acquisition' &&
      transaction.roles.some(
        (role) =>
          role.traitOffer?.kind === 'traits' &&
          role.traitOffer.options.some((option) => option.key === 'AllElementalBoon'),
      ),
  );
  expect(allTogether).toMatchObject({ kind: 'acquisition' });
  if (allTogether?.kind !== 'acquisition') {
    throw new Error('Dream H All Together acquisition is missing');
  }
  const allTogetherRole = allTogether.roles.find(
    (role) =>
      role.traitOffer?.kind === 'traits' &&
      role.traitOffer.options.some((option) => option.key === 'AllElementalBoon'),
  );
  expect(allTogetherRole?.producer).toMatchObject({ kind: 'artificerReplacement' });
  const allTogetherOption =
    allTogetherRole?.traitOffer?.kind === 'traits'
      ? allTogetherRole.traitOffer.options.find((option) => option.key === 'AllElementalBoon')
      : undefined;
  expect(allTogetherOption).toMatchObject({
    allTogetherResult: {
      earth: 'ElementalOlympianDamageBoon',
      fire: 'ElementalRallyBoon',
      air: 'ElementalDodgeBoon',
      water: 'ElementalHealthBoon',
    },
    concaveStoneResult: { kind: 'proc', optionKey: 'option2' },
  });
  const bridge = plan.occurrences.find(
    (occurrence) => occurrence.id === '78369aea-a352-409f-9ab6-0694e96e0339',
  );
  expect(bridge?.timeline.transactions).toContainEqual(
    expect.objectContaining({
      kind: 'acquisition',
      reward: expect.objectContaining({ rewardType: 'MaxManaDrop' }),
      roles: [
        expect.objectContaining({
          producer: expect.objectContaining({ kind: 'echoLastReward', sourceRole: 'self' }),
          lifecyclePoint: 'echoReplay',
        }),
      ],
    }),
  );
});

it('repairs a reloaded Echo replay entry and preserves Undo for the saved H route', () => {
  const saved = loadDreamHeraArtificerEchoCheckpoint();
  const h = createBiomeAddress('Dream', 'H');
  const bridge = createOccurrenceAddress(
    h,
    createOccurrenceId('78369aea-a352-409f-9ab6-0694e96e0339'),
  );
  const entry = createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(bridge, 'roomExit'),
    echoLastRewardPickupEntryKey('Encounter', 'Story_Echo_01', 'option1'),
  );
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceAcquisitionEntryOffer',
    entry,
    value: { rewardType: 'WeaponUpgrade' },
  });
  const reloaded = decodeProjectDocument(
    JSON.parse(encodeProjectDocument(edited.present)),
    catalog,
  );
  expect(reloaded).toEqual(edited.present);
  expect(simulateProjectAssembly(catalog, reloaded).evaluation.findings).toContainEqual({
    code: 'rewardSourceUnavailable',
    severity: 'error',
    phase: 'rewardGeneration',
    origin: entry,
    evidence: { reason: 'retainedSourceMismatch', rewardType: 'MaxManaDrop' },
  });
  expect(undoProjectHistory(edited).present).toBe(saved);
});
