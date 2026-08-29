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
import { seleneGiver, seleneTraits } from './selene';
import { hexes } from './hexes';
import { chaosBlessings, chaosCurses, chaosGiver, chaosTraits } from './chaos';

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
  {
    key: 'LobImpulseAspect',
    label: 'Aspect of Persephone',
    weaponKey: 'WeaponLob',
    traitOfferLevelBonus: {
      maximumBonus: 5,
      upgradedMaximumBonus: 8,
      upgradeTraitKey: 'WeaponUpgradeBoon',
    },
  },
  { key: 'LobGunAspect', label: 'Aspect of Hel', weaponKey: 'WeaponLob' },
  { key: 'BaseSuitAspect', label: 'Aspect of Melinoë', weaponKey: 'WeaponSuit' },
  { key: 'SuitMarkCritAspect', label: 'Aspect of Nyx', weaponKey: 'WeaponSuit' },
  {
    key: 'SuitHexAspect',
    label: 'Aspect of Selene',
    weaponKey: 'WeaponSuit',
    startingTrait: { traitKey: 'SpellMoonBeamTrait', giverKey: 'SpellDrop' },
  },
  { key: 'SuitComboAspect', label: 'Aspect of Shiva', weaponKey: 'WeaponSuit' },
] as const;
const traits = [
  ...arcanaTraits,
  ...circeTraits,
  ...echoTraits,
  ...infernalContractTraits,
  ...seleneTraits,
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
  ...chaosTraits,
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
  seleneGiver,
  chaosGiver,
] as const;

const traitAcquisitionProviders = [
  ['Aphrodite', 'Aphrodite'],
  ['AphroditeUpgrade', 'Aphrodite'],
  ['Arachne', 'Arachne'],
  ['ArachneUpgrade', 'Arachne'],
  ['Artemis', 'Artemis'],
  ['ArtemisUpgrade', 'Artemis'],
  ['Athena', 'Athena'],
  ['AthenaUpgrade', 'Athena'],
  ['Icarus', 'Icarus'],
  ['IcarusUpgrade', 'Icarus'],
  ['Apollo', 'Apollo'],
  ['ApolloUpgrade', 'Apollo'],
  ['Ares', 'Ares'],
  ['AresUpgrade', 'Ares'],
  ['Demeter', 'Demeter'],
  ['DemeterUpgrade', 'Demeter'],
  ['Dionysus', 'Dionysus'],
  ['DionysusUpgrade', 'Dionysus'],
  ['Hades', 'Hades'],
  ['HadesUpgrade', 'Hades'],
  ['Hephaestus', 'Hephaestus'],
  ['HephaestusUpgrade', 'Hephaestus'],
  ['Hera', 'Hera'],
  ['HeraUpgrade', 'Hera'],
  ['Hestia', 'Hestia'],
  ['HestiaUpgrade', 'Hestia'],
  ['Poseidon', 'Poseidon'],
  ['PoseidonUpgrade', 'Poseidon'],
  ['Zeus', 'Zeus'],
  ['ZeusUpgrade', 'Zeus'],
  ['Hermes', 'Hermes'],
  ['HermesUpgrade', 'Hermes'],
  ['Medea', 'Medea'],
  ['MedeaUpgrade', 'Medea'],
  ['Narcissus', 'Narcissus'],
  ['NarcissusUpgrade', 'Narcissus'],
  ['Circe', 'Circe'],
  ['CirceUpgrade', 'Circe'],
  ['Echo', 'Echo'],
  ['EchoUpgrade', 'Echo'],
  ['WeaponUpgrade', 'WeaponUpgrade'],
  ['SpellDrop', 'SpellDrop'],
] as const satisfies readonly (readonly [string, string])[];

export const traitCatalogInput: RawTraitCatalogInput = {
  weapons,
  aspects,
  traits,
  hexes,
  givers,
  traitAcquisitionProviders: traitAcquisitionProviders.map(([gameName, giverKey]) => ({
    gameName,
    giverKey,
  })),
  boonRarityBases: {
    olympian: { Rare: 0.1, Epic: 0.05, Duo: 0.12, Legendary: 0.1 },
    hermes: { Rare: 0.06, Epic: 0.03, Duo: 0, Legendary: 0.01 },
  },
  boonReplacementChance: 0.1,
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
    'SummonHeraTalent',
    'TimeSlowDemeterTalent',
    'TransformAphroditeTalent',
  ],
  chaos: { curses: chaosCurses, blessings: chaosBlessings },
};
