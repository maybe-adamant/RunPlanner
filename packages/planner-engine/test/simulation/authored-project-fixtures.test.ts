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
      '3afac254316b102e4effe1f69bc085306fefbf33e79e4b980513ffe346bf7964',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'eeb8e9005bc3da71eba9f300ef5bc59ebb8b8021af3617c22b14e7b0eec40b9f',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'ff9c2cd9ddb24aabfe1b31c1faaa423e8faa55175c05b42dce6fa647da54dd3a',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '93dce2119797bace833265eb4729440be2eebb93f29cd6a345eceb5b664126a1',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '9fe14d680ae55b532133dced8334cb360bba31a505635f08ca0723e9f0157461',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'b1a5661f40b4551aa7a15c99ff0ed5bd931a3decd7db87642e4836e76f4ee857',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '92f59153999d72b7cc3c9cabc7b0b9bd06b90be2a7b78b96fa95fde8df83ef84',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '9aa358357d95407dbbc42ef6f5e558e517ff3a8de05fd513f48d7dac75c7a45c',
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
      '7f3ed1daf57d4ee7313578c6f84c8001d5f6914ee9b4fc4dc7a45faf6538e8b3',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '032194bfc57ae9cfaa2e4383b83f4c0ca706e8200096d0d8fe8b28df8eb2bf39',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'b3a6a33ccc4a71f905c8ba00409a35656ae05fc9a47d982d8ea56f4d0c53e4f8',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'e110654876151423f383570acdead728b9822d6107791efa4501f7a2a53d5438',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
