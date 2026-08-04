import type {
  RawEncounterDefinitionDeclaration,
  RawEncounterEnvelopeDeclaration,
  RawEncounterSetDeclaration,
} from '../types';

const roomReward = {
  kind: 'countedChoice',
  storeKeys: ['RunProgress', 'MetaProgress'],
  eligibleRewardTypes: [],
  ineligibleRewardTypes: [],
  producerLifecycleKey: 'RoomReward',
} as const;

function rewardWheel(key: string) {
  return {
    kind: 'rewardWheel' as const,
    key,
    reward: roomReward,
    defaultStoreKey: 'RunProgress',
    offerKeys: ['offer1', 'offer2'],
    offerCount: { min: 1, max: 2, defaultValue: 1 },
    picked: 'exactlyOne' as const,
  };
}

export const sharedEncounterEnvelopes = [
  { key: 'EmptyEncounter', slots: [] },
  {
    key: 'SingleEncounter',
    slots: [{ key: 'Encounter', activation: 'always' }],
  },
  {
    key: 'ShipEncounter',
    slots: [
      { key: 'Intro', activation: 'always' },
      {
        key: 'Combat1',
        activation: 'always',
        rewardAttachment: rewardWheel('wheel1'),
      },
      {
        key: 'Combat2',
        activation: 'templateControlled',
        activationRequirement: {
          kind: 'counterRange',
          axis: 'biomeEncounterDepth',
          range: { min: 2, max: 5 },
        },
        rewardAttachment: rewardWheel('wheel2'),
      },
    ],
  },
  {
    key: 'PEncounter',
    slots: [
      { key: 'Intro', activation: 'always' },
      { key: 'Combat', activation: 'always' },
    ],
  },
  {
    key: 'FieldsEncounter',
    slots: [
      { key: 'Passive', activation: 'always' },
      {
        key: 'Cage01',
        activation: 'templateControlled',
        rewardAttachment: { kind: 'localReward', groupKey: 'cages', slotKey: 'cage1' },
      },
      {
        key: 'Cage02',
        activation: 'templateControlled',
        rewardAttachment: { kind: 'localReward', groupKey: 'cages', slotKey: 'cage2' },
      },
      {
        key: 'Cage03',
        activation: 'templateControlled',
        rewardAttachment: { kind: 'localReward', groupKey: 'cages', slotKey: 'cage3' },
      },
    ],
  },
] as const satisfies readonly RawEncounterEnvelopeDeclaration[];

export const sharedEncounterDefinitions = [
  { key: 'Empty', label: 'Empty', kind: 'nonCombat', countsEncounterDepth: false },
  {
    key: 'HealthRestore',
    label: 'Health Restore',
    kind: 'nonCombat',
    countsEncounterDepth: false,
  },
  { key: 'Shop', label: 'Shop', kind: 'nonCombat', countsEncounterDepth: false },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const sharedEncounterSets = [] as const satisfies readonly RawEncounterSetDeclaration[];

/** Artemis route exclusion is permanently limited to its three concrete variants. */
export const artemisEncounterKeys = ['ArtemisCombatF', 'ArtemisCombatG', 'ArtemisCombatN'] as const;

export const heraclesEncounterKeys = [
  'HeraclesCombatN',
  'HeraclesCombatO',
  'HeraclesCombatP',
] as const;

export const icarusEncounterKeys = ['IcarusCombatO', 'IcarusCombatP'] as const;

export const athenaEncounterKeys = ['AthenaCombatP'] as const;

/** Nemesis route exclusion is permanently limited to its four combat variants. */
export const nemesisEncounterKeys = [
  'NemesisCombatF',
  'NemesisCombatG',
  'NemesisCombatH',
  'NemesisCombatI',
] as const;

/**
 * The supported field-NPC spacing identities. Later delivery
 * gates extend this exact list when they add their own declared combat encounters.
 */
export const supportedFieldNpcEncounterKeys = [
  ...artemisEncounterKeys,
  ...heraclesEncounterKeys,
  ...icarusEncounterKeys,
  ...athenaEncounterKeys,
  ...nemesisEncounterKeys,
] as const;

export const arachneEncounterKeys = ['ArachneCombatF', 'ArachneCombatG'] as const;

export const fieldNpcIncomingRewardExclusions = [
  'Boon',
  'SpellDrop',
  'Devotion',
  'HermesUpgrade',
  'WeaponUpgrade',
] as const;

export const artemisIncomingRewardExclusions = fieldNpcIncomingRewardExclusions;

export const heraclesIncomingRewardExclusions = ['Devotion'] as const;

export const arachneIncomingRewardExclusions = [
  ...fieldNpcIncomingRewardExclusions,
  'StackUpgrade',
  'TalentDrop',
] as const;

export const nemesisIncomingRewardExclusions = arachneIncomingRewardExclusions;
