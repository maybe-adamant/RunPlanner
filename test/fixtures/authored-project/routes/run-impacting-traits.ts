import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  type AuthoredTraitOfferTraits,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

import { loadSurfaceNCheckpoint } from '../checkpoints/surface';
import { nBiome, nOccurrenceId, nOccurrenceIds } from './surface';

function replaceBoon(
  project: ProjectDocument,
  occurrenceId: ReturnType<typeof nOccurrenceId>,
  source: string,
  offer: AuthoredTraitOfferTraits,
): ProjectDocument {
  const reward = createIncomingRewardAddress(nBiome, occurrenceId);
  const withReward = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source } },
  });
  return applyProjectCommand(withReward, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(reward, 'source'),
    value: offer,
  });
}

function replaceDirectTrait(
  project: ProjectDocument,
  occurrenceId: ReturnType<typeof nOccurrenceId>,
  rewardType: string,
  offer: AuthoredTraitOfferTraits,
): ProjectDocument {
  const reward = createIncomingRewardAddress(nBiome, occurrenceId);
  const withReward = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward,
    value: { rewardType },
  });
  return applyProjectCommand(withReward, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(reward, 'self'),
    value: offer,
  });
}

function replaceUnvisitedBoonSource(
  project: ProjectDocument,
  occurrenceId: ReturnType<typeof nOccurrenceId>,
  source: string,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, occurrenceId),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source } },
  });
}

function replaceExistingSourceOffer(
  project: ProjectDocument,
  occurrenceId: ReturnType<typeof nOccurrenceId>,
  offer: AuthoredTraitOfferTraits,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(nBiome, occurrenceId), 'source'),
    value: offer,
  });
}

function traitOffer(value: AuthoredTraitOfferTraits): AuthoredTraitOfferTraits {
  return Object.freeze({ ...value, options: Object.freeze(value.options) });
}

const aresRareCoreOffer = traitOffer({
  kind: 'traits' as const,
  giverKey: 'Ares',
  options: Object.freeze([
    { traitKey: 'AresSpecialBoon', rarity: 'Rare' as const },
    { traitKey: 'AresCastBoon', rarity: 'Rare' as const },
    { traitKey: 'AresSprintBoon', rarity: 'Rare' as const },
  ]),
  selectedOptionKey: 'option3' as const,
});

const apolloRareCoreOffer = traitOffer({
  kind: 'traits' as const,
  giverKey: 'Apollo',
  options: Object.freeze([
    { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' as const },
    { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' as const },
    { traitKey: 'ApolloCastBoon', rarity: 'Rare' as const },
  ]),
  selectedOptionKey: 'option2' as const,
});

const poseidonRarePassiveOffer = traitOffer({
  kind: 'traits' as const,
  giverKey: 'Poseidon',
  options: Object.freeze([
    { traitKey: 'EncounterStartOffenseBuffBoon', rarity: 'Rare' as const },
    { traitKey: 'FocusDamageShaveBoon', rarity: 'Rare' as const },
    { traitKey: 'PoseidonStatusBoon', rarity: 'Rare' as const },
  ]),
  selectedOptionKey: 'option1' as const,
});

const poseidonCoreOffer = traitOffer({
  kind: 'traits' as const,
  giverKey: 'Poseidon',
  options: Object.freeze([
    { traitKey: 'PoseidonWeaponBoon', rarity: 'Common' as const },
    { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' as const },
    { traitKey: 'PoseidonCastBoon', rarity: 'Common' as const },
  ]),
  selectedOptionKey: 'option1' as const,
});

const demeterCoreOffer = traitOffer({
  kind: 'traits' as const,
  giverKey: 'Demeter',
  options: Object.freeze([
    { traitKey: 'DemeterSpecialBoon', rarity: 'Common' as const },
    { traitKey: 'DemeterCastBoon', rarity: 'Common' as const },
    { traitKey: 'DemeterSprintBoon', rarity: 'Common' as const },
  ]),
  selectedOptionKey: 'option1' as const,
});

const steadyGrowthOffer = traitOffer({
  kind: 'traits' as const,
  giverKey: 'Demeter',
  options: Object.freeze([
    { traitKey: 'BoonGrowthBoon', rarity: 'Epic' as const },
    { traitKey: 'ReserveManaHitShieldBoon', rarity: 'Epic' as const },
    { traitKey: 'PlantHealthBoon', rarity: 'Epic' as const },
  ]),
  selectedOptionKey: 'option1' as const,
});

const naturalPrerequisiteOffer = traitOffer({
  kind: 'traits' as const,
  giverKey: 'Demeter',
  options: Object.freeze([
    { traitKey: 'PlantHealthBoon', rarity: 'Common' as const },
    { traitKey: 'ReserveManaHitShieldBoon', rarity: 'Common' as const },
    { traitKey: 'CastNovaBoon', rarity: 'Common' as const },
  ]),
  selectedOptionKey: 'option1' as const,
});

export function createSurfaceNNaturalSelectionFrontier(): ProjectDocument {
  let project = loadSurfaceNCheckpoint();
  project = replaceBoon(project, nOccurrenceIds.opening, 'PoseidonUpgrade', poseidonCoreOffer);
  project = replaceBoon(project, nOccurrenceIds.preHub, 'DemeterUpgrade', demeterCoreOffer);
  project = replaceExistingSourceOffer(project, nOccurrenceId('combat11'), aresRareCoreOffer);
  project = replaceBoon(
    project,
    nOccurrenceId('combat23'),
    'PoseidonUpgrade',
    poseidonRarePassiveOffer,
  );
  project = replaceUnvisitedBoonSource(project, nOccurrenceId('combat10'), 'ApolloUpgrade');
  project = replaceBoon(
    project,
    nOccurrenceId('combat05'),
    'DemeterUpgrade',
    naturalPrerequisiteOffer,
  );
  project = replaceBoon(project, nOccurrenceId('miniBoss01'), 'DemeterUpgrade', {
    kind: 'traits',
    giverKey: 'Demeter',
    options: [
      { traitKey: 'GoodStuffBoon', rarity: 'Duo' },
      { traitKey: 'DemeterCastBoon', rarity: 'Rare' },
      { traitKey: 'ReserveManaHitShieldBoon', rarity: 'Rare' },
    ],
    selectedOptionKey: 'option1',
  });
  return project;
}

export function createSurfaceNQueensRansomCheckpoint(): ProjectDocument {
  let project = loadSurfaceNCheckpoint();
  project = replaceBoon(project, nOccurrenceIds.opening, 'ZeusUpgrade', {
    kind: 'traits',
    giverKey: 'Zeus',
    options: [
      { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
      { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
      { traitKey: 'ZeusCastBoon', rarity: 'Common' },
    ],
    selectedOptionKey: 'option1',
  });
  project = replaceBoon(project, nOccurrenceIds.preHub, 'HeraUpgrade', {
    kind: 'traits',
    giverKey: 'Hera',
    options: [
      { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
      { traitKey: 'HeraCastBoon', rarity: 'Common' },
      { traitKey: 'HeraSprintBoon', rarity: 'Common' },
    ],
    selectedOptionKey: 'option1',
  });
  project = replaceExistingSourceOffer(project, nOccurrenceId('combat11'), aresRareCoreOffer);
  project = replaceExistingSourceOffer(project, nOccurrenceId('combat23'), apolloRareCoreOffer);
  project = replaceUnvisitedBoonSource(project, nOccurrenceId('combat10'), 'ZeusUpgrade');
  project = replaceBoon(project, nOccurrenceId('combat05'), 'ZeusUpgrade', {
    kind: 'traits',
    giverKey: 'Zeus',
    options: [
      { traitKey: 'ZeusCastBoon', rarity: 'Common' },
      { traitKey: 'ZeusManaBoon', rarity: 'Common' },
      { traitKey: 'ZeusSprintBoon', rarity: 'Common' },
    ],
    selectedOptionKey: 'option1',
  });
  project = replaceBoon(project, nOccurrenceId('miniBoss01'), 'HeraUpgrade', {
    kind: 'traits',
    giverKey: 'Hera',
    options: [
      { traitKey: 'SuperSacrificeBoonHera', rarity: 'Duo' },
      { traitKey: 'HeraCastBoon', rarity: 'Rare' },
      { traitKey: 'HeraSprintBoon', rarity: 'Rare' },
    ],
    selectedOptionKey: 'option1',
  });
  return project;
}

export function createSurfaceNSteadyGrowthFrontier(): ProjectDocument {
  let project = replaceBoon(
    loadSurfaceNCheckpoint(),
    nOccurrenceIds.preHub,
    'DemeterUpgrade',
    steadyGrowthOffer,
  );
  project = replaceExistingSourceOffer(project, nOccurrenceId('combat11'), aresRareCoreOffer);
  project = replaceUnvisitedBoonSource(project, nOccurrenceId('combat10'), 'DemeterUpgrade');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceSteadyGrowthTarget',
    outcome: createSteadyGrowthOutcomeAddress(
      createOccurrenceAddress(nBiome, nOccurrenceId('miniBoss01')),
      'Encounter',
    ),
    targetTraitKey: 'ApolloWeaponBoon',
  });
  return project;
}

export function createSurfaceNQuickBuckCheckpoint(): ProjectDocument {
  return replaceDirectTrait(loadSurfaceNCheckpoint(), nOccurrenceIds.opening, 'HermesUpgrade', {
    kind: 'traits',
    giverKey: 'Hermes',
    options: [
      { traitKey: 'MoneyMultiplierBoon', rarity: 'Common' },
      { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
      { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
    ],
    selectedOptionKey: 'option1',
  });
}

export function createSurfaceNBuriedTreasureCheckpoint(): ProjectDocument {
  return replaceBoon(loadSurfaceNCheckpoint(), nOccurrenceIds.preHub, 'PoseidonUpgrade', {
    kind: 'traits',
    giverKey: 'Poseidon',
    options: [
      { traitKey: 'RoomRewardBonusBoon', rarity: 'Common' },
      { traitKey: 'PoseidonWeaponBoon', rarity: 'Common' },
      { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' },
    ],
    selectedOptionKey: 'option1',
  });
}
