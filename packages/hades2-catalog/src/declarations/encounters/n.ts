import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from '../types';
import {
  artemisEncounterKeys,
  artemisIncomingRewardExclusions,
  heraclesEncounterKeys,
  heraclesIncomingRewardExclusions,
  supportedFieldNpcEncounterKeys,
} from './shared';

export const nEncounterDefinitions = [
  {
    key: 'OpeningGeneratedN',
    label: 'Opening combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'PreHubGeneratedN',
    label: 'Pre-Hub combat',
    kind: 'combat',
    countsEncounterDepth: false,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedN',
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'ArtemisCombatN',
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
    key: 'HeraclesCombatN',
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
    key: 'GeneratedN_Smaller',
    label: 'Small combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedN_Bigger',
    label: 'Large combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedNSubRoom',
    label: 'Side-room combat',
    kind: 'combat',
    countsEncounterDepth: false,
    hostsGorgon: true,
    canEncounterSkip: true,
    blocksFigLeaf: true,
  },
  {
    key: 'GeneratedNSubRoom_Bigger',
    label: 'Large side-room combat',
    kind: 'combat',
    countsEncounterDepth: false,
    hostsGorgon: true,
    canEncounterSkip: true,
    blocksFigLeaf: true,
  },
  {
    key: 'MiniBossSatyrCrossbow',
    label: 'Satyr crossbow',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'MiniBossBoar',
    label: 'Boar',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'Story_Medea_01',
    label: 'Medea story',
    kind: 'story',
    countsEncounterDepth: false,
    npcPresentationKey: 'Medea',
    traitOfferProducer: { kind: 'traitOffer', giverKey: 'Medea' },
  },
  {
    key: 'BossPolyphemus01',
    label: 'Polyphemus',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const nEncounterSets = [
  {
    key: 'NEncountersDefault',
    encounterDefinitionKeys: ['GeneratedN', 'ArtemisCombatN', 'HeraclesCombatN'],
    defaultEncounterDefinitionKey: 'GeneratedN',
  },
  {
    key: 'NEncountersSmaller',
    encounterDefinitionKeys: ['GeneratedN_Smaller', 'ArtemisCombatN', 'HeraclesCombatN'],
    defaultEncounterDefinitionKey: 'GeneratedN_Smaller',
  },
  {
    key: 'NEncountersBigger',
    encounterDefinitionKeys: ['GeneratedN_Bigger', 'ArtemisCombatN', 'HeraclesCombatN'],
    defaultEncounterDefinitionKey: 'GeneratedN_Bigger',
  },
  {
    key: 'NEncountersSubRoom',
    encounterDefinitionKeys: ['GeneratedNSubRoom', 'GeneratedNSubRoom_Bigger'],
    defaultEncounterDefinitionKey: 'GeneratedNSubRoom',
  },
  {
    key: 'NEncountersSubRoomLight',
    encounterDefinitionKeys: ['GeneratedNSubRoom', 'Empty'],
    defaultEncounterDefinitionKey: 'GeneratedNSubRoom',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
