import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from '../types';
import {
  arachneEncounterKeys,
  arachneIncomingRewardExclusions,
  artemisEncounterKeys,
  artemisIncomingRewardExclusions,
  nemesisEncounterKeys,
  nemesisIncomingRewardExclusions,
  supportedFieldNpcEncounterKeys,
} from './shared';

export const gEncounterDefinitions = [
  {
    key: 'GeneratedG',
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'ArtemisCombatG',
    label: 'Artemis combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
    npcPresentationKey: 'Artemis',
    traitOfferProducer: { kind: 'traitOffer', giverKey: 'Artemis' },
    requirements: {
      kind: 'all',
      requirements: [
        { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } },
        {
          kind: 'currentRoomRewardExcludes',
          rewardTypes: artemisIncomingRewardExclusions,
        },
        {
          kind: 'encounterKeyCount',
          scope: 'route',
          encounterKeys: artemisEncounterKeys,
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
    key: 'ArachneCombatG',
    label: 'Arachne cocoon',
    kind: 'combat',
    countsEncounterDepth: false,
    blocksGorgon: true,
    npcPresentationKey: 'Arachne',
    requirements: {
      kind: 'all',
      requirements: [
        {
          kind: 'currentRoomRewardExcludes',
          rewardTypes: arachneIncomingRewardExclusions,
        },
        {
          kind: 'encounterKeyCount',
          scope: 'biome',
          encounterKeys: ['ArachneCombatG'],
          range: { max: 0 },
        },
        {
          kind: 'previousRoomEncounterKeyCount',
          encounterKeys: arachneEncounterKeys,
          roomWindow: 5,
          range: { max: 0 },
        },
      ],
    },
  },
  {
    key: 'NemesisCombatG',
    label: 'Nemesis combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
    npcPresentationKey: 'Nemesis',
    requirements: {
      kind: 'all',
      requirements: [
        { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } },
        {
          kind: 'currentRoomRewardExcludes',
          rewardTypes: nemesisIncomingRewardExclusions,
        },
        {
          kind: 'encounterKeyCount',
          scope: 'route',
          encounterKeys: nemesisEncounterKeys,
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
    key: 'Story_Narcissus_01',
    label: 'Narcissus story',
    kind: 'story',
    countsEncounterDepth: false,
    traitOfferProducer: { kind: 'traitOffer', giverKey: 'Narcissus' },
  },
  {
    key: 'MiniBossWaterUnit',
    label: 'Water unit',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'MiniBossCrawler',
    label: 'Crawler',
    kind: 'miniboss',
    countsEncounterDepth: false,
    blocksGorgon: true,
    blocksFigLeaf: true,
  },
  {
    key: 'MiniBossJellyfish',
    label: 'Jellyfish',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'BossScylla01',
    label: 'Scylla',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
  },
  {
    key: 'BossScylla02',
    label: 'Scylla',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const gEncounterSets = [
  {
    key: 'GEncountersDefault',
    encounterDefinitionKeys: [
      'GeneratedG',
      'ArtemisCombatG',
      'ArachneCombatG',
      'NemesisCombatG',
      'NemesisRandomEvent',
    ],
    defaultAuthoringProfileKey: 'GeneratedG',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
