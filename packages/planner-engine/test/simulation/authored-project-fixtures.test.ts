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
      '73ce85ba1428122284b460ea36a8239f1a61797b5f9204d6f5a5546ea8b4dae6',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'f37b08a1d730ccc356b7c2b7d4510ce80bf12de594ffdcdc7b27618e3f1b9457',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '510c430a5bc8eab41f5d49ae97f122450f6abe5511572f4718f8efad5457727f',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '3dafacba4804a81cf09d517c97034251c27a5713c09530fba6336059c064030d',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '9fac1ef03c97ff89c14fbbab5e4070df11189a35048b48513faaf9a12db294b8',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'bb6f76535f50a4b005b321a4c5695b751632c92d274a3d42c9b67ea0d2bacc63',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '483e7e8e46bca26e11d01904430eb3620afabddfd196598f75e01b5f046fd416',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'eef86c8dc1836ef19500bc35cdcc4414dc8d7655485d998a2763fe7f514268f8',
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
      '894e30846481c6a08aacfab5d4e5f7bca4fb5913644c6769853c94bd5a2e152c',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '20e874955db1737d427701f31a11199352035b8b378bc110b644416ada47708c',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '1cb707ed192d8b4fa97b11708f665857fa96be35920291b9e812dc323bd4660d',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'bf0faa4261ff8a786f29d44b3fd1fee9c6a1ea4233f678b545fa1649cab8e7ff',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
