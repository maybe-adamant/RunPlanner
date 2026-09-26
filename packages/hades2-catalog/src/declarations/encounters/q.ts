import { generatedEncounterChoices } from './generated/policies';
import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from './types';

export const qEncounterDefinitions = [
  {
    key: 'GeneratedQ',
    customization: [generatedEncounterChoices.GeneratedQ],
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedQ_Islands',
    customization: [generatedEncounterChoices.GeneratedQ_Islands],
    label: 'Islands combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedQ_Large',
    customization: [generatedEncounterChoices.GeneratedQ_Large],
    label: 'Preboss combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'TyphonShop',
    hostsNpcShoppingEvents: true,
    label: 'Typhon shop',
    kind: 'nonCombat',
    countsEncounterDepth: false,
  },
  {
    key: 'MiniBossBrute',
    label: 'Brute',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
    blocksFigLeaf: true,
  },
  {
    key: 'MiniBossStalker',
    label: 'Stalker',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
    blocksFigLeaf: true,
  },
  {
    key: 'BossTyphonTail01',
    label: 'Typhon tail',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
    blocksFigLeaf: true,
  },
  {
    key: 'BossTyphonEye01',
    label: 'Typhon eye',
    kind: 'miniboss',
    countsEncounterDepth: false,
    blocksGorgon: true,
    blocksFigLeaf: true,
  },
  {
    key: 'BossTyphonHead01',
    label: 'Typhon',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
    customization: [
      {
        key: 'firstEggWave',
        label: 'First egg wave',
        selection: {
          kind: 'single',
          choices: [
            { key: 'polyps', label: '5 Polyp eggs', nativeId: 'TyphonHeadCastSummon01' },
            { key: 'eidolons', label: '3 Eidolon eggs', nativeId: 'TyphonHeadCastSummon03' },
          ],
        },
      },
      {
        key: 'secondEggWave',
        label: 'Second egg wave',
        selection: {
          kind: 'single',
          choices: [
            { key: 'horrors', label: '2 Horror eggs', nativeId: 'TyphonHeadCastSummon02' },
            { key: 'lurkers', label: '4 Lurker eggs', nativeId: 'TyphonHeadCastSummon05' },
          ],
        },
      },
    ],
  },
  {
    key: 'BossTyphonHead02',
    label: 'Typhon',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
    customization: [
      {
        key: 'secondEggWave',
        label: 'Second egg wave',
        selection: {
          kind: 'single',
          choices: [
            {
              key: 'erymanthianBoars',
              label: '2 Erymanthian Boar eggs',
              nativeId: 'TyphonHeadCastSummonBoar',
            },
            {
              key: 'skyDracons',
              label: '2 Sky-Dracon eggs',
              nativeId: 'TyphonHeadCastSummonDragon',
            },
          ],
        },
      },
    ],
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const qEncounterSets = [] as const satisfies readonly RawEncounterSetDeclaration[];
