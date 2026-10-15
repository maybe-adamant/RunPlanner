import { describe, expect, it } from 'vitest';

import {
  encodeProjectDocument,
  parseProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_REVISION,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
} from '@run-planner/engine/authored-project';
import { assembleExecutionProduct, compileExecutionPlan } from '@run-planner/engine/execution-plan';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';

import { equivalenceCorpus } from './corpus';

/**
 * Corpus projects that do not compile by design, with the route status that
 * stops them: `incomplete` stops at an unresolved required choice; `invalid`
 * is a deliberate invalidity witness.
 */
const notCompiling: Readonly<Record<string, 'incomplete' | 'invalid'>> = {
  'checkpoint/underworld-f-midshop-pom-frontier': 'incomplete',
  'checkpoint/surface-n-natural-selection-frontier': 'incomplete',
  'checkpoint/surface-n-steady-growth-frontier': 'incomplete',
  'checkpoint/surface-n-buried-treasure': 'invalid',
  'checkpoint/surface-n-shrine-side-room-delivery': 'incomplete',
  'checkpoint/surface-p-steady-growth-shrine-frontier': 'incomplete',
  'checkpoint/surface-n-entry-frontier': 'incomplete',
  'checkpoint/surface-n-entry-frontier-resolved': 'incomplete',
  'checkpoint/surface-n-complete-hub-frontier': 'incomplete',
  'checkpoint/surface-n-partial-hub': 'incomplete',
  'checkpoint/surface-n-ten-open-invalid': 'incomplete',
  'checkpoint/natural-chaos-unresolved-trial': 'incomplete',
  'checkpoint/nemesis-f-pom-sea-star': 'incomplete',
  'underworld/createFConversionFrontierProject(GiftDrop)': 'incomplete',
  'underworld/createFConversionFrontierProject(MetaCurrencyDrop)': 'incomplete',
  'underworld/createFConversionFrontierProject(MetaCardPointsCommonDrop)': 'incomplete',
  'underworld/createFInvalidLaterConversionProject': 'invalid',
  'underworld/createFMidshopUnresolvedBlindBoxBeforePomProject': 'incomplete',
  'underworld/loadUnderworldFMidshopPomFrontierProject': 'incomplete',
  'underworld/createGContractAvailabilityProject(true)': 'invalid',
  'underworld/createGContractAvailabilityProject(false)': 'invalid',
  'underworld/echoHammerReplayMissing': 'incomplete',
  'underworld/hammerBridgeRoute': 'incomplete',
  'underworld/fPoolSaleCleared': 'incomplete',
  'underworld/echoReplayUnresolvedHammer': 'incomplete',
  'surface/createSurfaceNShrineSideRoomDeliveryCheckpoint': 'incomplete',
  'surface/createSurfaceNUnresolvedBossHermesDeliveryCheckpoint': 'incomplete',
  'fresh-file/createFreshFileFirstSequence': 'incomplete',
  'fresh-file/createMatureCombat01Sequence': 'incomplete',
  'fresh-file/createFreshFileGeneratedComposition': 'invalid',
  'fresh-file/withNewHFieldsRoom(min)': 'incomplete',
  'fresh-file/withNewHFieldsRoom(max)': 'incomplete',
  'fresh-file/withRetainedFreshFilePostboss(all)': 'invalid',
  'fresh-file/withRetainedFreshFilePostboss(emptyPool)': 'invalid',
  'fresh-file/withRetainedFreshFileIntroCustomization': 'invalid',
  'fresh-file/hFieldsIssues/00': 'incomplete',
  'fresh-file/hFieldsIssues/01': 'incomplete',
  'fresh-file/hFieldsIssues/02': 'incomplete',
  'fresh-file/hFieldsIssues/03': 'incomplete',
  'fresh-file/hFieldsIssues/04': 'incomplete',
  'fresh-file/frontier/00': 'incomplete',
};

const version = `${PROJECT_DOCUMENT_SCHEMA_VERSION}.${PROJECT_DOCUMENT_SCHEMA_REVISION}`;
const corpus = equivalenceCorpus();

describe(`checked-in projects under schema ${version}`, () => {
  it('lists only corpus projects as not compiling', () => {
    const names = new Set(corpus.map((entry) => entry.name));
    expect(Object.keys(notCompiling).filter((name) => !names.has(name))).toEqual([]);
  });

  it.each(corpus.map((entry) => [entry.name, entry] as const))('%s', (name, entry) => {
    // Saved and reopened at the current version, as a sent project's file would be.
    const project = parseProjectDocument(encodeProjectDocument(entry.project()), entry.catalog);
    const assembly = simulateProjectAssembly(entry.catalog, project);
    const status = assembly.evaluation.route.status;
    const expected = notCompiling[name];
    if (expected !== undefined) {
      if (status === 'valid')
        throw new Error(`${name} is now valid; remove it from the not-compiling list.`);
      if (status !== expected)
        throw new Error(
          `${name} changed from ${expected} to ${status} under schema ${version}. ` +
            'A change that can invalidate a saved project needs a minor bump (schemaRevision).',
        );
      return;
    }
    try {
      compileExecutionPlan({
        product: assembleExecutionProduct({ assembly, catalog: entry.catalog }),
      });
    } catch (error) {
      throw new Error(
        `${name} no longer compiles under schema ${version} (route ${status}): ${String(error)}. ` +
          'A project that compiled under a version must compile under the same version; ' +
          'the likely cause is a missing minor bump (schemaRevision).',
        { cause: error },
      );
    }
  });
});
