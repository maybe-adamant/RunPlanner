import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from '../types';
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
  },
  { key: 'GeneratedO', label: 'Ship combat', kind: 'combat', countsEncounterDepth: true },
  {
    key: 'HeraclesCombatO',
    label: 'Heracles combat',
    kind: 'combat',
    countsEncounterDepth: true,
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
    npcPresentationKey: 'Icarus',
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
  },
  {
    key: 'MiniBossCaptain',
    label: 'Captain',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  {
    key: 'Story_Circe_01',
    label: 'Circe story',
    kind: 'story',
    countsEncounterDepth: false,
  },
  {
    key: 'DevotionTestO',
    label: 'Devotion combat',
    kind: 'combat',
    countsEncounterDepth: true,
  },
  { key: 'BossEris01', label: 'Eris', kind: 'boss', countsEncounterDepth: false },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const oEncounterSets = [
  {
    key: 'OEncountersIntros',
    encounterDefinitionKeys: ['GeneratedO_Intro01', 'HeraclesCombatO'],
    defaultEncounterDefinitionKey: 'GeneratedO_Intro01',
  },
  {
    key: 'OEncountersDefault',
    encounterDefinitionKeys: ['GeneratedO', 'IcarusCombatO'],
    defaultEncounterDefinitionKey: 'GeneratedO',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
