/// <reference types="node" />

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  createCompleteFGProject,
  createGoldenFGHProject,
  createGoldenFGHIProject,
  createRepresentativeNOProject,
  createRepresentativeNOPProject,
  createRepresentativeNOPQProject,
  createRepresentativeNProject,
  nFixedOccurrenceIds,
  nOccurrenceIds,
  nVisitSlotKeys,
} from '@run-planner/test-fixtures';

function authoredDocumentDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

describe('canonical authored-project fixtures', () => {
  it.each([
    [
      'Underworld F/G default',
      () => createCompleteFGProject(),
      '3b03a2ef7d7a9049fe414cf3151b6a647ad826b3f7ef68be9194132a54a80597',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '9e0cb423290b8b07b471224e92fbd5899b93339cc2182afe29f22c8ebc4c3454',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'e16973d3d673cd7e1724179374c60b311ecfc501fbff1fce309b7fc3f5c14196',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '049a6b88861d25445a871117516adc2ba8401b8c2505e29804f5900d34471be5',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '9fb3512ea28e4d66059abc94d98ddd2c2e3ce8b64130f3706af1dd49655912f1',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'dcdbe40f28e90a0ac84edbee76cb1ecec08713ffe44244c38c8c624ab038b026',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'b1d0d78ad958429a2d6f96c995feae7f8523ba823e825033f3494f0112547ab0',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '9dc8c61fe3e1dfc25fd8afdca2b395a9daaa6cfad901d14d3e516bf8c9325bc8',
    ],
    [
      'Surface N alternate open Hub slot',
      () =>
        createRepresentativeNProject({
          openSlotKeys: [
            'combat11',
            'combat10',
            'combat09',
            'combat05',
            'story',
            'combat02',
            'combat01',
            'miniBoss01',
            'combat23',
          ],
          visitSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'story'],
        }),
      'd6faf422a6ed00bbd3eecb0724787f6280908d114a66938f05c52b2d9a15cb98',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'c1949ffc0df17f0efd54f912edf8e380a75c1f1cb21f27f336207c34ffdc3418',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'fdb91469e927911aede044f56eebbc89abb05f708025b418ffbb1b674f7f634c',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '96f16cfda81869752d645e4ee8dbe8360e94dfcaa6025b8e8021cd649c3c7ab1',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
