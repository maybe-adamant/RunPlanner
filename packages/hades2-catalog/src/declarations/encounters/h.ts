import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from './types';
import {
  nemesisEncounterKeys,
  nemesisIncomingRewardExclusions,
  supportedFieldNpcEncounterKeys,
} from './shared';

export const hEncounterDefinitions = [
  {
    key: 'GeneratedH_Passive',
    label: 'Passive combat',
    kind: 'combat',
    countsEncounterDepth: false,
    hostsGorgon: true,
  },
  {
    key: 'GeneratedH_PassiveSmall',
    label: 'Small passive combat',
    kind: 'combat',
    countsEncounterDepth: false,
    hostsGorgon: true,
  },
  {
    key: 'GeneratedH',
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedH_Treant2',
    label: 'Treant combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedH_Screamer2',
    label: 'Screamer combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'NemesisCombatH',
    label: 'Nemesis combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
    npcPresentationKey: 'Nemesis',
    requirements: {
      kind: 'all',
      requirements: [
        { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 1 } },
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
    key: 'MiniBossVampire',
    label: 'Vampire',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'MiniBossLamia',
    label: 'Lamia',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'Story_Echo_01',
    label: 'Echo story',
    kind: 'story',
    countsEncounterDepth: false,
    npcPresentationKey: 'Echo',
    traitOfferProducer: { kind: 'traitOffer', giverKey: 'Echo' },
  },
  {
    key: 'BossInfestedCerberus01',
    label: 'Cerberus',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
    customization: [
      {
        key: 'howl',
        label: 'Howl summons',
        selection: {
          kind: 'single',
          choices: [
            {
              key: 'smallShades',
              label: 'Small corrupted shades',
              nativeId: 'InfestedCerberusHowlSummonShadeSmall',
            },
            {
              key: 'mediumShades',
              label: 'Medium corrupted shades',
              nativeId: 'InfestedCerberusHowlSummonShadeMedium',
            },
            {
              key: 'largeShades',
              label: 'Large corrupted shades',
              nativeId: 'InfestedCerberusHowlSummonShadeLarge',
            },
          ],
        },
      },
      {
        key: 'burrow',
        label: 'Burrow intermission',
        selection: {
          kind: 'single',
          choices: [
            { key: 'lamias', label: 'Elite Lamias', nativeId: 'CerberusSpawns01' },
            { key: 'lycaons', label: 'Elite Lycaons', nativeId: 'CerberusSpawns02' },
            { key: 'mourners', label: 'Elite Mourners', nativeId: 'CerberusSpawns03' },
            { key: 'holehearts', label: 'Elite Holehearts', nativeId: 'CerberusSpawns04' },
            {
              key: 'blightShadesAndFog',
              label: 'Elite Blight-Shades and fog',
              nativeId: 'CerberusSpawns05',
            },
          ],
        },
      },
    ],
  },
  {
    key: 'BossInfestedCerberus02',
    label: 'Cerberus',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
    customization: [
      {
        key: 'howl',
        label: 'Howl summons',
        selection: {
          kind: 'single',
          choices: [
            {
              key: 'smallShades',
              label: 'Elite small corrupted shades',
              nativeId: 'InfestedCerberusHowlSummonShadeSmallElite',
            },
            {
              key: 'mediumShades',
              label: 'Elite medium corrupted shades',
              nativeId: 'InfestedCerberusHowlSummonShadeMediumElite',
            },
            {
              key: 'largeShades',
              label: 'Elite large corrupted shades',
              nativeId: 'InfestedCerberusHowlSummonShadeLargeElite',
            },
          ],
        },
      },
      {
        key: 'burrow',
        label: 'Burrow intermission',
        selection: {
          kind: 'single',
          choices: [
            { key: 'burnFlingers', label: 'Elite Burn-Flingers', nativeId: 'CerberusEMSpawns01' },
            { key: 'waveMakers', label: 'Elite Wave-Makers', nativeId: 'CerberusEMSpawns02' },
            {
              key: 'infernoBombers',
              label: 'Elite Inferno-Bombers',
              nativeId: 'CerberusEMSpawns03',
            },
            { key: 'slamDancers', label: 'Elite Slam-Dancers', nativeId: 'CerberusEMSpawns04' },
          ],
        },
      },
    ],
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const hEncounterSets = [
  {
    key: 'HEncountersDefault',
    encounterDefinitionKeys: [
      'GeneratedH',
      'GeneratedH_Treant2',
      'GeneratedH_Screamer2',
      'NemesisCombatH',
    ],
    defaultAuthoringProfileKey: 'GeneratedH',
  },
  {
    key: 'HEncountersPassive',
    encounterDefinitionKeys: ['GeneratedH_Passive', 'NemesisRandomEvent'],
    defaultAuthoringProfileKey: 'GeneratedH_Passive',
  },
  {
    key: 'HEncountersPassiveSmall',
    encounterDefinitionKeys: ['GeneratedH_PassiveSmall', 'NemesisRandomEvent'],
    defaultAuthoringProfileKey: 'GeneratedH_PassiveSmall',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
