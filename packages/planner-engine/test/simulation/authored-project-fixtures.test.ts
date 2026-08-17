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
      'daef6ba5344e9501efd6d55ddb2eef7952b94d21aee3e86fcef29afa58eea60b',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '4ea55b67828236e7709acb44b0aaf0a53b335e17cf9fee5de6316bf2c6da82bd',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'eec8cd4ce28b550fdb6a8a925242a3682e4ea6bd3fc5b6bbb55dd2c412d0acca',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '1a3892f7de863a6328be6ba7ee0a8475364ea49aa841ea84e3edb7809a2788d9',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'ca139bfbc900cb416a022fb52077087f944f3981670d7f414a24b0ee81f291d0',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '08d41ada43fc9955fda4b5e41f7b7012b74cf2e864b0b3b4d9fb59aed7d07ccd',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '7b22fc92bd0db393b82b35c1ac177f5c05deaeced1b01346e9bd4bba67c75963',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'aaf7fbcbac9ec3dbf6fb8010853dec30b3b5144db5b799cde437db6d05083dc9',
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
      'bb24e1f0269d36e58384b58a45896e15fbdfabe5b0e1f0bba0651a0c151e47f3',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '6e2fd953edd6380ae29dd517616cf4eda8d8ee02e884bd1c2ad8bf1546449b49',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '24b86c40c1f1a96798b66c59baaaaea4469dbba0c87278ab15e878eb5614226a',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '82ccb35c9c62075645f34b2b9f8f1838e2c1af914f1e282876430dabb5b387df',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
