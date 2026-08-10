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
      '5b1db46802898e3f87a18c171634d19b779aa47fae8d36227e54238f0591a4ca',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '7538addb1eaf40c0b78ce9a188cb3a223e29c85484689cb0f34eb4b59b0d731a',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '5b5473417be09bfe9e9c0cff71c51f92c15e74f8f7ff6344b74efdfee864703a',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '3976ac446079c95c5cab20d1d4a2c512807cf8356d1c7b884a809338f65a16d8',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '64b36693143cb117053401609930ab8473d1ec73eb691b345171971b529ae827',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '1ebb071f0c773a13ed457ec0d1ba1d97229fd34c59786d9ef7a739dff8da4a5d',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '9526949395131795b9cc5abe4a6c7f937f6c4daddc5e5fc4f436cd7579c736ef',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '2f714e56a13d1aec46c4fe83aa8de5ad2bda8cba9e36f678f82737d55e999df3',
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
      '1edac781527de9868a9381322008bc444372227de296a169e8b27bab070bfacc',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '1e4449764e492e456406c59972dd10a0f43bbc5a910848185a622d97ab6f1d4d',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'aab31016a9c7e11065927b0602fc699d3fa207dc582cc61549ec403120f191e2',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '7e10b07927d3ea1a41cb9184f6a8628670ab1cccd28ba411bd8657ab91e849d3',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
