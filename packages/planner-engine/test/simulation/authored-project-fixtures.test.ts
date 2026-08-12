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
      '689f6249c36fc3d92f7cafebe289c5c459397d2bc633194e10e564ce39501e78',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'c30f2e34af6d529155b2774f55bc95fbbe72a8f6621a251cae1e386df609c754',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '0c218446f9b21245588dbf9fb73b65234089f64d8d0a4c8511860edae1566646',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '27faba2cba25290b2c0eb4ff76c234d52713c66fb7a9d16225d7b93c7c81cebd',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'd74693f3ecf5718e4a94e7f3bb4cc958146e2cd06151db5f86a16d24462ad7d3',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '47f9d16884cc92bc209cb15b664a08451fd719a21ed18ed1b1cacb4b49c928f0',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'f96f58c05ebe4ad016ca9d70e5d9d26c5311da20d5804aa2594cb6432558ab0b',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'e7538102d2d2d29fd16b819de924f5c49d46a06ccddea03ce877f617e95c37b7',
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
      '5ab92712b2c58bf8ceb6b667d14eca71619ef1822d569c8d133345bb5282e21b',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'f60f5b2f40dbfb4ca54115c77278f76b92f47a4051f8cfdbf811581e86c55fc1',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '642711ffbbd9bf985a3a713421002c8ac6446338e61ccdb18c418ad12fb46753',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '4dcb861285b297b7f35da998d10ac9c449b1ca68a9818ce56b48ca206d30a4d6',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
