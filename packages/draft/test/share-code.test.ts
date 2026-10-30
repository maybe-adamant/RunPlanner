import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectHistoryCommands,
  createProjectDocument,
  createProjectHistory,
  decodeDraftShareCode,
  draftShareCommands,
  encodeDraftShareCode,
  projectDraftShareInputs,
  type DraftShareInputs,
} from '@run-planner/engine/authored-project';
import { draftProject, type DraftSpec } from '../src';

const project = (routeKey: string) =>
  createProjectDocument(catalog, { projectId: 'share', routeKey, configuredBiomeCount: 0 });

const decoded = (code: string) => {
  const result = decodeDraftShareCode(catalog, code);
  if (!result.ok) throw new Error(`refused ${result.refusal}`);
  return result.inputs;
};

describe('draft share codes', () => {
  it('drafts the same plan from a decoded code', () => {
    const inputs: DraftShareInputs = {
      ...projectDraftShareInputs(project('Underworld')),
      configuredBiomeCount: 1,
      draft: {
        godKeys: ['Zeus', 'Apollo', 'Hestia'],
        storyNpcByBiome: {},
        fieldNpcsByBiome: {},
        basketByGiver: { Zeus: ['ZeusWeaponBoon'] },
        rackKeepsakeByBiome: {},
        seed: 1,
      },
    };
    const draftOf = (source: DraftShareInputs) => {
      const history = applyProjectHistoryCommands(
        createProjectHistory(project(source.routeKey)),
        catalog,
        draftShareCommands(catalog, project(source.routeKey), source),
      );
      const { aspectHexTree: _hex, ...loadout } = source.loadout;
      void _hex;
      const spec: DraftSpec = {
        loadout,
        world: {
          godKeys: source.draft.godKeys,
          storyNpcByBiome: source.draft.storyNpcByBiome,
          fieldNpcsByBiome: source.draft.fieldNpcsByBiome,
        },
        basketByGiver: source.draft.basketByGiver,
        rackKeepsakeKeys: [null, null, null],
      };
      const result = draftProject(catalog, history.present, spec, source.draft.seed);
      if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
      return result.project;
    };
    const code = encodeDraftShareCode(catalog, inputs);
    expect(draftOf(decoded(code))).toEqual(draftOf(inputs));
  });
});
