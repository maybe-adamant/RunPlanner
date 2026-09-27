import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectHistoryCommand,
  createEncounterPhaseAddress,
  semanticAddressKey,
  createGorgonPhaseAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectHistory,
  createRouteAddress,
  createTraitOfferAddress,
  undoProjectHistory,
} from '../../../src/authored-project';
import { simulateProjectAssembly } from '../../../src/simulation';
import {
  loadUnderworldGorgonAthenaCheckpoint,
  loadUnderworldPersephoneCallingCardCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  loadSurfaceOrdinaryHexPathCheckpoint,
  loadSurfaceSeleneHexPathCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import { goldenFBiome, goldenGBiome } from '@run-planner/test-fixtures/underworld';
import { pBiome, pOccurrenceId } from '@run-planner/test-fixtures/surface';
import { compileEligibleProject, reloadProject } from '../support/authored-checkpoints';

it('exports the installed ordinary Hex and reached P Path allocation, then reloads its reward repair', () => {
  const saved = loadSurfaceOrdinaryHexPathCheckpoint();
  const occurrenceId = pOccurrenceId('P_Combat07', 4, 1);
  const p = simulateProjectAssembly(catalog, saved).evaluation.route.biomes.find(
    (biome) => biome.biomeKey === 'P',
  );
  if (p === undefined || !('rewards' in p)) throw new Error('ordinary Hex P evaluation is missing');
  expect(p.rewards.branches[0]?.state.hexProgress).toMatchObject({
    spellTraitKey: 'SpellPotionTrait',
    tree: {
      layoutKey: 'Lung',
      rareTalentKeys: ['DamageBuffTalent', 'ShieldTalent'],
      epicTalentKeys: ['ClearCastTalent'],
    },
    bankedPathPoints: 0,
    investedPathPoints: 3,
    talentDropsClosed: false,
  });
  expect(
    compileEligibleProject(saved)
      .occurrences.find((room) => room.id === occurrenceId)
      ?.timeline.transactions.find(
        (transaction) =>
          transaction.kind === 'acquisition' && transaction.reward.rewardType === 'TalentDrop',
      ),
  ).toBeDefined();
  const reward = createIncomingRewardAddress(pBiome, occurrenceId);
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceIncomingReward',
    reward,
    value: { rewardType: 'MaxManaDrop' },
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  const editedAssembly = simulateProjectAssembly(catalog, reloaded);
  expect(editedAssembly.evaluation.findings).toEqual([
    {
      code: 'rewardBagEntryUnavailable',
      severity: 'error',
      phase: 'rewardGeneration',
      origin: reward,
      evidence: { rewardType: 'MaxManaDrop', storeKey: 'RunProgress' },
    },
  ]);
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports Aspect of Selene Hex Path grants and reloads its tree edit', () => {
  const saved = loadSurfaceSeleneHexPathCheckpoint();
  const p = simulateProjectAssembly(catalog, saved).evaluation.route.biomes.find(
    (biome) => biome.biomeKey === 'P',
  );
  if (p === undefined || !('rewards' in p)) throw new Error('Selene Hex P evaluation is missing');
  expect(p.rewards.branches[0]?.state.hexProgress).toMatchObject({
    spellTraitKey: 'SpellMoonBeamTrait',
    tree: {
      layoutKey: 'Lung',
      rareTalentKeys: ['MoonBeamConsecutiveDamageTalent', 'MoonBeamDefenseTalent'],
      epicTalentKeys: ['MoonBeamTargetTalent'],
    },
    bankedPathPoints: 0,
    investedPathPoints: 6,
  });
  expect(compileEligibleProject(saved).startingLoadout).toMatchObject({
    weaponKey: 'WeaponSuit',
    aspectKey: 'SuitHexAspect',
    startingHex: {
      spellTraitKey: 'SpellMoonBeamTrait',
      layoutKey: 'Lung',
    },
  });
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceAspectHexTree',
    route: createRouteAddress('Surface'),
    value: {
      layoutKey: 'Maze',
      rareTalentKeys: [
        'MoonBeamPrimaryTalent',
        'MoonBeamConsecutiveDamageTalent',
        'MoonBeamDefenseTalent',
      ],
      epicTalentKeys: ['MoonBeamTargetTalent', 'MoonBeamExBeamBonusTalent'],
    },
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  const editedAssembly = simulateProjectAssembly(catalog, reloaded);
  expect(editedAssembly.evaluation.findings).toEqual([]);
  const editedP = editedAssembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'P');
  if (editedP === undefined || !('rewards' in editedP))
    throw new Error('edited Selene Hex P evaluation is missing');
  expect(editedP.rewards.branches[0]?.state.hexProgress).toMatchObject({
    tree: { layoutKey: 'Maze' },
    investedPathPoints: 6,
  });
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports Aspect of Persephone and Calling Card’s positive Apollo effects and reloads its exact edit', () => {
  const saved = loadUnderworldPersephoneCallingCardCheckpoint();
  const opening = createTraitOfferAddress(
    createIncomingRewardAddress(goldenFBiome, createOccurrenceId('golden-f-start')),
    'source',
  );
  const published = compileEligibleProject(saved);
  expect(published.startingLoadout).toMatchObject({
    weaponKey: 'WeaponLob',
    aspectKey: 'LobImpulseAspect',
  });
  const apollo = published.occurrences
    .find((occurrence) => occurrence.id === 'golden-f-start')
    ?.timeline.transactions.flatMap((transaction) =>
      transaction.kind === 'acquisition' ? transaction.roles : [],
    )
    .map((role) => role.traitOffer)
    .find((offer) => offer?.kind === 'traits' && offer.giver === 'Apollo');
  if (apollo?.kind !== 'traits') throw new Error('Persephone Apollo offer is missing');
  expect(apollo.options[0]).toMatchObject({
    key: 'ApolloWeaponBoon',
    baseRarity: 'Common',
    rarity: 'Rare',
    effectiveLevel: 6,
  });
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceTraitOffer',
    trait: opening,
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common', persephoneLevelBonus: 1 },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common', persephoneLevelBonus: 1 },
        { traitKey: 'ApolloCastBoon', rarity: 'Common', persephoneLevelBonus: 1 },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: ['option1'],
    },
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  const editedApollo = compileEligibleProject(reloaded)
    .occurrences.flatMap((occurrence) => occurrence.timeline.transactions)
    .flatMap((transaction) => (transaction.kind === 'acquisition' ? transaction.roles : []))
    .map((role) => role.traitOffer)
    .find((offer) => offer?.kind === 'traits' && offer.giver === 'Apollo');
  expect(
    editedApollo?.kind === 'traits' ? editedApollo.options[0]?.effectiveLevel : undefined,
  ).toBe(2);
  expect(undoProjectHistory(edited).present).toBe(saved);
});

it('exports the reached Epic Gorgon Athena child and reloads its condition edit', () => {
  const saved = loadUnderworldGorgonAthenaCheckpoint();
  const occurrenceId = createOccurrenceId('golden-g-b1-e1');
  const g = simulateProjectAssembly(catalog, saved).evaluation.route.biomes.find(
    (biome) => biome.biomeKey === 'G',
  );
  if (g === undefined || !('rewards' in g)) throw new Error('Gorgon G evaluation is missing');
  expect(g.rewards.branches[0]?.state.keepsakes.gorgon).toEqual({ status: 'consumed' });
  expect(g.rewards.selectedTraitOffers).toContainEqual(
    expect.objectContaining({ acquisitionRole: 'gorgonAthena', reached: true }),
  );
  const phase = createEncounterPhaseAddress(
    goldenGBiome,
    { kind: 'occurrence', occurrenceId },
    'Encounter',
  );
  expect(
    compileEligibleProject(saved)
      .occurrences.find((room) => room.id === occurrenceId)
      ?.timeline.transactions.find(
        (transaction) =>
          transaction.kind === 'encounterInteraction' &&
          transaction.resolution?.kind === 'traitOffer',
      ),
  ).toMatchObject({
    owner: semanticAddressKey(createGorgonPhaseAddress(phase)),
    resolution: {
      offer: {
        giver: 'Athena',
        selected: 'option1',
        options: [
          { key: 'InvulnerabilityDashBoon', rarity: 'Epic' },
          { key: 'RetaliateInvulnerabilityBoon', rarity: 'Epic' },
          { key: 'FocusLastStandBoon', rarity: 'Epic' },
        ],
      },
    },
  });
  const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
    kind: 'ReplaceGorgonDeathDefianceCondition',
    phase,
    value: false,
  });
  const reloaded = reloadProject(edited.present);
  expect(reloaded).toEqual(edited.present);
  expect(simulateProjectAssembly(catalog, reloaded).evaluation.findings).toEqual([]);
  expect(
    compileEligibleProject(reloaded)
      .occurrences.find((room) => room.id === occurrenceId)
      ?.timeline.transactions.find(
        (transaction) =>
          transaction.kind === 'encounterInteraction' &&
          transaction.resolution?.kind === 'traitOffer',
      ),
  ).toBeUndefined();
  expect(undoProjectHistory(edited).present).toBe(saved);
});
