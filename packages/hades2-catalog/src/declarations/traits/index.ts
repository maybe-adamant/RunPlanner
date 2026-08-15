import type { RawTraitCatalogInput } from '../traits';
import { aphroditeGiver, aphroditeTraits } from './aphrodite';
import { arachneGiver, arachneTraits } from './arachne';
import { apolloGiver, apolloTraits } from './apollo';
import { aresGiver, aresTraits } from './ares';
import { artemisGiver, artemisTraits } from './artemis';
import { athenaGiver, athenaTraits } from './athena';
import { icarusGiver, icarusTraits } from './icarus';
import { demeterGiver, demeterTraits } from './demeter';
import { dionysusGiver, dionysusTraits } from './dionysus';
import { hadesGiver, hadesTraits } from './hades';
import { hephaestusGiver, hephaestusTraits } from './hephaestus';
import { heraGiver, heraTraits } from './hera';
import { hestiaGiver, hestiaTraits } from './hestia';
import { poseidonGiver, poseidonTraits } from './poseidon';
import { zeusGiver, zeusTraits } from './zeus';
import { hermesGiver, hermesTraits } from './hermes';
import { medeaGiver, medeaTraits } from './medea';
import { narcissusGiver, narcissusTraits } from './narcissus';
import { weaponUpgradeGiver, weaponUpgradeTraits } from './weapon-upgrade';
import { arcanaTraits } from './arcana';
import { circeGiver, circeTraits } from './circe';
import { echoGiver, echoTraits } from './echo';
import { infernalContractTraits } from './infernal-contract';

const weapons = [
  {
    key: 'WeaponStaffSwing',
    label: "Witch's Staff",
    aspectKeys: [
      'BaseStaffAspect',
      'StaffClearCastAspect',
      'StaffSelfHitAspect',
      'StaffRaiseDeadAspect',
    ],
    defaultAspectKey: 'BaseStaffAspect',
  },
  {
    key: 'WeaponDagger',
    label: 'Sister Blades',
    aspectKeys: [
      'DaggerBackstabAspect',
      'DaggerHomingThrowAspect',
      'DaggerBlockAspect',
      'DaggerTripleAspect',
    ],
    defaultAspectKey: 'DaggerBackstabAspect',
  },
  {
    key: 'WeaponAxe',
    label: 'Moonstone Axe',
    aspectKeys: [
      'AxeRecoveryAspect',
      'AxeArmCastAspect',
      'AxePerfectCriticalAspect',
      'AxeRallyAspect',
    ],
    defaultAspectKey: 'AxeRecoveryAspect',
  },
  {
    key: 'WeaponTorch',
    label: 'Umbral Flames',
    aspectKeys: [
      'TorchSpecialDurationAspect',
      'TorchSprintRecallAspect',
      'TorchDetonateAspect',
      'TorchAutofireAspect',
    ],
    defaultAspectKey: 'TorchSpecialDurationAspect',
  },
  {
    key: 'WeaponLob',
    label: 'Argent Skull',
    aspectKeys: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect', 'LobGunAspect'],
    defaultAspectKey: 'LobAmmoBoostAspect',
  },
  {
    key: 'WeaponSuit',
    label: 'Black Coat',
    aspectKeys: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect', 'SuitComboAspect'],
    defaultAspectKey: 'BaseSuitAspect',
  },
] as const;
const aspects = [
  { key: 'BaseStaffAspect', label: 'Aspect of Melinoë', weaponKey: 'WeaponStaffSwing' },
  { key: 'StaffClearCastAspect', label: 'Aspect of Circe', weaponKey: 'WeaponStaffSwing' },
  { key: 'StaffSelfHitAspect', label: 'Aspect of Momus', weaponKey: 'WeaponStaffSwing' },
  { key: 'StaffRaiseDeadAspect', label: 'Aspect of Anubis', weaponKey: 'WeaponStaffSwing' },
  { key: 'DaggerBackstabAspect', label: 'Aspect of Melinoë', weaponKey: 'WeaponDagger' },
  { key: 'DaggerHomingThrowAspect', label: 'Aspect of Pan', weaponKey: 'WeaponDagger' },
  { key: 'DaggerBlockAspect', label: 'Aspect of Artemis', weaponKey: 'WeaponDagger' },
  { key: 'DaggerTripleAspect', label: 'Aspect of the Morrigan', weaponKey: 'WeaponDagger' },
  { key: 'AxeRecoveryAspect', label: 'Aspect of Melinoë', weaponKey: 'WeaponAxe' },
  { key: 'AxeArmCastAspect', label: 'Aspect of Charon', weaponKey: 'WeaponAxe' },
  { key: 'AxePerfectCriticalAspect', label: 'Aspect of Thanatos', weaponKey: 'WeaponAxe' },
  { key: 'AxeRallyAspect', label: 'Aspect of Nergal', weaponKey: 'WeaponAxe' },
  { key: 'TorchSpecialDurationAspect', label: 'Aspect of Melinoë', weaponKey: 'WeaponTorch' },
  { key: 'TorchSprintRecallAspect', label: 'Aspect of Eos', weaponKey: 'WeaponTorch' },
  { key: 'TorchDetonateAspect', label: 'Aspect of Moros', weaponKey: 'WeaponTorch' },
  { key: 'TorchAutofireAspect', label: 'Aspect of Supay', weaponKey: 'WeaponTorch' },
  { key: 'LobAmmoBoostAspect', label: 'Aspect of Melinoë', weaponKey: 'WeaponLob' },
  { key: 'LobCloseAttackAspect', label: 'Aspect of Medea', weaponKey: 'WeaponLob' },
  { key: 'LobImpulseAspect', label: 'Aspect of Persephone', weaponKey: 'WeaponLob' },
  { key: 'LobGunAspect', label: 'Aspect of Hel', weaponKey: 'WeaponLob' },
  { key: 'BaseSuitAspect', label: 'Aspect of Melinoë', weaponKey: 'WeaponSuit' },
  { key: 'SuitMarkCritAspect', label: 'Aspect of Nyx', weaponKey: 'WeaponSuit' },
  { key: 'SuitHexAspect', label: 'Aspect of Selene', weaponKey: 'WeaponSuit' },
  { key: 'SuitComboAspect', label: 'Aspect of Shiva', weaponKey: 'WeaponSuit' },
] as const;
const traits = [
  ...arcanaTraits,
  ...circeTraits,
  ...echoTraits,
  ...infernalContractTraits,
  ...aphroditeTraits,
  ...arachneTraits,
  ...artemisTraits,
  ...athenaTraits,
  ...icarusTraits,
  ...apolloTraits,
  ...aresTraits,
  ...demeterTraits,
  ...dionysusTraits,
  ...hadesTraits,
  ...hephaestusTraits,
  ...heraTraits,
  ...hestiaTraits,
  ...poseidonTraits,
  ...zeusTraits,
  ...hermesTraits,
  ...medeaTraits,
  ...narcissusTraits,
  ...weaponUpgradeTraits,
] as const;

const givers = [
  aphroditeGiver,
  arachneGiver,
  artemisGiver,
  athenaGiver,
  icarusGiver,
  apolloGiver,
  aresGiver,
  demeterGiver,
  dionysusGiver,
  hadesGiver,
  hephaestusGiver,
  heraGiver,
  hestiaGiver,
  poseidonGiver,
  zeusGiver,
  hermesGiver,
  medeaGiver,
  narcissusGiver,
  circeGiver,
  echoGiver,
  weaponUpgradeGiver,
] as const;

export const traitCatalogInput: RawTraitCatalogInput = {
  weapons,
  aspects,
  traits,
  givers,
  echoLastRunBoon: {
    sources: [
      { giverKey: 'Aphrodite', lootHistorySource: 'AphroditeUpgrade' },
      { giverKey: 'Apollo', lootHistorySource: 'ApolloUpgrade' },
      { giverKey: 'Ares', lootHistorySource: 'AresUpgrade' },
      { giverKey: 'Demeter', lootHistorySource: 'DemeterUpgrade' },
      { giverKey: 'Hephaestus', lootHistorySource: 'HephaestusUpgrade' },
      { giverKey: 'Hera', lootHistorySource: 'HeraUpgrade' },
      { giverKey: 'Hestia', lootHistorySource: 'HestiaUpgrade' },
      { giverKey: 'Poseidon', lootHistorySource: 'PoseidonUpgrade' },
      { giverKey: 'Zeus', lootHistorySource: 'ZeusUpgrade' },
      { giverKey: 'Hermes', lootHistorySource: 'HermesUpgrade' },
      { giverKey: 'Artemis' },
      { giverKey: 'Athena' },
      { giverKey: 'Dionysus' },
    ],
    excludedTraitKeys: [],
  },
  offerContexts: [
    { key: 'devotionNoDuo', kind: 'rewardRarityBlock', blockedRarity: 'Duo' },
    { key: 'blockGiftBoons', kind: 'roomFlag', roomFlag: 'BlockGiftBoons' },
    {
      key: 'deathDefianceConditionMet',
      kind: 'authoredCondition',
      authoredCondition: 'deathDefianceConditionMet',
    },
    {
      key: 'circeRemovableFearVow',
      kind: 'authoredCondition',
      authoredCondition: 'circeRemovableFearVow',
    },
  ],
  deferredTraitKeys: [
    'LaserApolloTalent',
    'LeapHephaestusTalent',
    'MeteorHestiaTalent',
    'MoonBeamAresTalent',
    'PolymorphZeusTalent',
    'PotionPoseidonTalent',
    'SpellLaserTrait',
    'SpellLeapTrait',
    'SpellMeteorTrait',
    'SpellMoonBeamTrait',
    'SpellPolymorphTrait',
    'SpellSummonTrait',
    'SpellTransformTrait',
    'SummonHeraTalent',
    'TimeSlowDemeterTalent',
    'TransformAphroditeTalent',
  ],
};
