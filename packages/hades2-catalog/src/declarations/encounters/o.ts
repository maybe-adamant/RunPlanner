import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from './types';
import {
  fieldNpcIncomingRewardExclusions,
  heraclesEncounterKeys,
  heraclesIncomingRewardExclusions,
  icarusEncounterKeys,
  supportedFieldNpcEncounterKeys,
} from './shared';

export const oEncounterDefinitions = [
  {
    key: 'GeneratedO_Intro01',
    label: 'Ship intro',
    kind: 'combat',
    countsEncounterDepth: false,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedO',
    label: 'Ship combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'HeraclesCombatO',
    label: 'Heracles combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
    npcPresentationKey: 'Heracles',
    requirements: {
      kind: 'all',
      requirements: [
        {
          kind: 'currentRoomRewardExcludes',
          rewardTypes: heraclesIncomingRewardExclusions,
        },
        {
          kind: 'encounterKeyCount',
          scope: 'route',
          encounterKeys: heraclesEncounterKeys,
          range: { max: 0 },
        },
        {
          kind: 'previousRoomEncounterKeyCount',
          encounterKeys: heraclesEncounterKeys,
          roomWindow: 20,
          range: { max: 0 },
        },
        {
          kind: 'previousRoomEncounterKeyCount',
          encounterKeys: supportedFieldNpcEncounterKeys,
          roomWindow: 6,
          range: { max: 0 },
        },
      ],
    },
  },
  {
    key: 'IcarusCombatO',
    label: 'Icarus combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
    npcPresentationKey: 'Icarus',
    traitOfferProducer: { kind: 'traitOffer', giverKey: 'Icarus' },
    requirements: {
      kind: 'all',
      requirements: [
        { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 3 } },
        {
          kind: 'currentRoomRewardExcludes',
          rewardTypes: fieldNpcIncomingRewardExclusions,
        },
        {
          kind: 'encounterKeyCount',
          scope: 'route',
          encounterKeys: icarusEncounterKeys,
          range: { max: 0 },
        },
        {
          kind: 'previousRoomEncounterKeyCount',
          encounterKeys: supportedFieldNpcEncounterKeys,
          roomWindow: 6,
          range: { max: 0 },
        },
      ],
    },
  },
  {
    key: 'MiniBossCharybdis',
    label: 'Charybdis',
    kind: 'miniboss',
    countsEncounterDepth: false,
    blocksGorgon: true,
    blocksFigLeaf: true,
  },
  {
    key: 'MiniBossCaptain',
    label: 'Captain',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
    blocksFigLeaf: true,
  },
  {
    key: 'Story_Circe_01',
    label: 'Circe story',
    kind: 'story',
    countsEncounterDepth: false,
    traitOfferProducer: { kind: 'traitOffer', giverKey: 'Circe' },
  },
  {
    key: 'DevotionTestO',
    label: 'Devotion combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
  },
  {
    key: 'BossEris01',
    label: 'Eris',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
    customization: [
      {
        key: 'earlySummons',
        label: 'Early summons',
        selection: {
          kind: 'orderedPrefix',
          choices: [
            { key: 'harpy', label: 'Harpy Talon', nativeId: 'ErisSummon01' },
            { key: 'drunk', label: 'Boozer', nativeId: 'ErisSummon02' },
          ],
          maximumLength: 2,
        },
      },
      {
        key: 'lateSummons',
        label: 'Late summons',
        selection: {
          kind: 'orderedPrefix',
          choices: [
            { key: 'stickler', label: 'Stickler', nativeId: 'ErisSummon03' },
            { key: 'swab', label: 'Anchor', nativeId: 'ErisSummon04' },
          ],
          maximumLength: 2,
        },
      },
    ],
  },
  {
    key: 'BossEris02',
    label: 'Eris',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
    customization: [
      {
        key: 'earlySummons',
        label: 'Early summons',
        selection: {
          kind: 'orderedPrefix',
          choices: [
            { key: 'harpy', label: 'Elite Harpy Talon', nativeId: 'ErisEMSummonHarpy' },
            { key: 'swab', label: 'Elite Anchor', nativeId: 'ErisEMSummonSwab' },
            { key: 'jellyfish', label: 'Hellifishie', nativeId: 'ErisEMSummonJellyfish' },
            { key: 'turtle', label: 'Shellback', nativeId: 'ErisEMSummonTurtle' },
          ],
          maximumLength: 2,
        },
      },
      {
        key: 'lateSummons',
        label: 'Late summons',
        selection: {
          kind: 'orderedPrefix',
          choices: [
            { key: 'fishmanRanged', label: 'Hippo', nativeId: 'ErisEMSummonFishmanRanged' },
            { key: 'fishmanMelee', label: 'Lurker', nativeId: 'ErisEMSummonFishmanMelee' },
            { key: 'fishSwarmer', label: 'Pinhead', nativeId: 'ErisEMSummonFishSwarmer' },
            { key: 'automaton', label: 'Automaton', nativeId: 'ErisEMSummonAutomaton' },
          ],
          maximumLength: 2,
        },
      },
    ],
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const oEncounterSets = [
  {
    key: 'OEncountersIntros',
    encounterDefinitionKeys: ['GeneratedO_Intro01', 'HeraclesCombatO'],
    defaultAuthoringProfileKey: 'GeneratedO_Intro01',
  },
  {
    key: 'OEncountersDefault',
    encounterDefinitionKeys: ['GeneratedO', 'IcarusCombatO'],
    defaultAuthoringProfileKey: 'GeneratedO',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
