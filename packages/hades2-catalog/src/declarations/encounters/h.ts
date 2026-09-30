import { generatedEncounterChoices } from './generated/policies';
import { notFreshFileRoute } from '../routes';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from './types';
import {
  introductionGate,
  nemesisEncounterKeys,
  nemesisIncomingRewardExclusions,
  supportedFieldNpcEncounterKeys,
} from './shared';

/** H introductions also require no earlier occurrence this run (EncounterData_Intro.lua). */
const notOccurred = (encounterKey: string): RequirementExpression => ({
  kind: 'encounterKeyCount',
  scope: 'route',
  encounterKeys: [encounterKey],
  range: { max: 0 },
});
const occurred = (encounterKey: string): RequirementExpression => ({
  kind: 'encounterKeyCount',
  scope: 'route',
  encounterKeys: [encounterKey],
  range: { min: 1 },
});

// Each H introduction inherits GeneratedH's flags; its three waves are fixed, so
// it has no generated suffix and no customization.
function hIntroduction(key: string, label: string, requirements: readonly RequirementExpression[]) {
  return {
    key,
    label,
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
    enemyTriggeredIntroduction: true,
    requirements: introductionGate(key, [notOccurred(key), ...requirements]),
  } as const satisfies RawEncounterDefinitionDeclaration;
}

export const hEncounterDefinitions = [
  {
    key: 'GeneratedH_Passive',
    customization: [generatedEncounterChoices.GeneratedH_Passive],
    label: 'Passive combat',
    kind: 'combat',
    countsEncounterDepth: false,
    hostsGorgon: true,
  },
  {
    key: 'GeneratedH_PassiveSmall',
    customization: [generatedEncounterChoices.GeneratedH_PassiveSmall],
    label: 'Small passive combat',
    kind: 'combat',
    countsEncounterDepth: false,
    hostsGorgon: true,
  },
  {
    key: 'GeneratedH',
    customization: [generatedEncounterChoices.GeneratedH],
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedH_Treant2',
    requirements: {
      kind: 'all',
      requirements: [
        { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } },
        {
          kind: 'encounterKeyCount',
          scope: 'route',
          encounterKeys: ['GeneratedH_Treant2'],
          range: { max: 0 },
        },
      ],
    },
    customization: [generatedEncounterChoices.GeneratedH_Treant2],
    label: 'Treant combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedH_Screamer2',
    requirements: {
      kind: 'all',
      requirements: [
        { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } },
        {
          kind: 'encounterKeyCount',
          scope: 'route',
          encounterKeys: ['GeneratedH_Screamer2'],
          range: { max: 0 },
        },
        // EncounterData_Generated.lua:384; every mature save has completed ScreamerIntro.
        {
          kind: 'any',
          requirements: [
            notFreshFileRoute,
            {
              kind: 'encounterCompletionCount',
              encounterKeys: ['ScreamerIntro'],
              range: { min: 1 },
            },
          ],
        },
      ],
    },
    customization: [generatedEncounterChoices.GeneratedH_Screamer2],
    label: 'Screamer combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  // EncounterData_Intro.lua:372: Mourner ×2; Mourner ×4 + BrokenHearted ×2; Mourner_Elite ×1.
  hIntroduction('MournerIntro', 'Mourner introduction', []),
  // :448: Lamia ×1 + BrokenHearted ×4; Lamia ×4 + BrokenHearted ×6; Lamia_Elite ×1 + BrokenHearted ×4.
  hIntroduction('LamiaIntro', 'Lamia introduction', []),
  // :534: Lovesick ×2; Lovesick ×4 + BrokenHearted ×5; Lovesick_Elite ×2.
  hIntroduction('LovesickIntro', 'Holeheart introduction', []),
  // :289: Lycanthrope ×1; Lycanthrope ×3; Lycanthrope_Elite ×1. Needs the three
  // other introductions to have occurred on the save (this route, on a fresh one).
  hIntroduction('LycanthropeIntro', 'Lycaon introduction', [
    occurred('MournerIntro'),
    occurred('LovesickIntro'),
    occurred('LamiaIntro'),
  ]),
  {
    key: 'NemesisCombatH',
    customization: [generatedEncounterChoices.NemesisCombatH],
    label: 'Nemesis combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
    npcPresentationKey: 'Nemesis',
    npcShoppingProtection: { family: 'Nemesis', roomWindow: 12 },
    requirements: {
      kind: 'all',
      requirements: [
        notFreshFileRoute,
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
    // EncounterEventsHMiniboss opens with SpawnRewardCagesMiniboss (EncounterSets.lua:464-466).
    createsIncomingRewardAtStart: true,
  },
  {
    key: 'MiniBossLamia',
    label: 'Lamia',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
    // EncounterEventsHMiniboss opens with SpawnRewardCagesMiniboss (EncounterSets.lua:464-466).
    createsIncomingRewardAtStart: true,
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
    // EncounterData_Unique.lua BridgeShop: inherits Shop; RequireRoomReward Shop.
    key: 'BridgeShop',
    label: 'Shop',
    kind: 'nonCombat',
    countsEncounterDepth: false,
    hostsNpcShoppingEvents: true,
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
      'MournerIntro',
      'LamiaIntro',
      'LovesickIntro',
      'LycanthropeIntro',
      'NemesisCombatH',
    ],
    defaultAuthoringProfileKey: 'GeneratedH',
    authoringProfiles: [
      { key: 'GeneratedH', encounterDefinitionKeys: ['GeneratedH'] },
      { key: 'GeneratedH_Treant2', encounterDefinitionKeys: ['GeneratedH_Treant2'] },
      { key: 'GeneratedH_Screamer2', encounterDefinitionKeys: ['GeneratedH_Screamer2'] },
      ...['MournerIntro', 'LamiaIntro', 'LovesickIntro', 'LycanthropeIntro'].map((key) => ({
        key,
        encounterDefinitionKeys: [key],
        routeKeys: ['FreshFile'],
      })),
      { key: 'NemesisCombatH', encounterDefinitionKeys: ['NemesisCombatH'] },
    ],
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
