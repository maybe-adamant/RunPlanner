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

export const fEncounterDefinitions = [
  {
    key: 'OpeningGeneratedF',
    label: 'Opening combat',
    kind: 'combat',
    countsEncounterDepth: true,
  },
  { key: 'GeneratedF', label: 'Combat', kind: 'combat', countsEncounterDepth: true },
  {
    key: 'ArtemisCombatF',
    label: 'Artemis combat',
    kind: 'combat',
    countsEncounterDepth: true,
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
    key: 'ArachneCombatF',
    label: 'Arachne cocoon',
    kind: 'combat',
    countsEncounterDepth: false,
    npcPresentationKey: 'Arachne',
    requirements: {
      kind: 'all',
      requirements: [
        { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4, max: 8 } },
        {
          kind: 'currentRoomRewardExcludes',
          rewardTypes: arachneIncomingRewardExclusions,
        },
        {
          kind: 'encounterKeyCount',
          scope: 'biome',
          encounterKeys: ['ArachneCombatF'],
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
    key: 'NemesisCombatF',
    label: 'Nemesis combat',
    kind: 'combat',
    countsEncounterDepth: true,
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
    key: 'Story_Arachne_01',
    label: 'Arachne story',
    kind: 'story',
    countsEncounterDepth: false,
  },
  {
    key: 'MiniBossTreant',
    label: 'Treant',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  {
    key: 'MiniBossFogEmitter',
    label: 'Fog emitter',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  {
    key: 'MiniBossAssassin',
    label: 'Assassin',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  { key: 'BossHecate01', label: 'Hecate', kind: 'boss', countsEncounterDepth: false },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const fEncounterSets = [
  {
    key: 'FEncountersDefault',
    encounterDefinitionKeys: ['GeneratedF', 'ArtemisCombatF', 'ArachneCombatF', 'NemesisCombatF'],
    defaultEncounterDefinitionKey: 'GeneratedF',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
