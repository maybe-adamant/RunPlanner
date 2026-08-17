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
      '6b1cc6f6b28388ad4aa9c4d7d62cf866386a1882774c20b833d14068bab97965',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'bc900e3f5ebc4fdc556736a0b583b4155b383bcbe379ed2dc658eb99f147aa1c',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '57b489157a53f7ea5ddf53ea6a266795f7435ab9c7f831bd1dfe54d6d8a249ee',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'd8418ed881906183da38fc2cf73f6296b241978881982292d9286ced9936c179',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'afce10cdf578327aec69b2a12871ec7b0dd011c43115ee3e6920196de8d735d6',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'd0a90621ef472a8d0c4d3844db3333e4c093f7093092feb860fb64bea7abfbf2',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '6bf1ac2f53a06643f49d614cf04f6d4bf1496f7c8f3606267269e9d1def54594',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'd358eebf281d024ed16ed94afb052f7376a053b97136c4a843a80ccf7dbec489',
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
      'f1a155cf25620b88e0df9d5e2f5f69324873598ca1b56cb7d8f91e981525f28c',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '4a5ff19ca7c1fe9d884f5f9fad7b2c5027045fb7c5f82db9b235840c139d7eba',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'b24a8543aca4755f5876ea810e2126db1da1ce0b79ae7f0922f5472a8c2e1cb8',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'a3e98021a2fca69ac16060b30109ec6727a9490a91127be2483c953cc2104b2b',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
