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
      '7e86ffc180c44043e7993c396137031a257274aa21aff7f8d6c6c80ad807d233',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'f54b063851e9b03db571038403be5d4b142d890ad3154bbebc41f7b26c564cca',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'e44537205edf28807901400283e7986a015788db061151d07220a86d20f4fc8c',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'f34929960957864addfe048e0ac5a9c43413fa1abba0ba50f55793fd081b04d4',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '4f2615b410c776c0b3b683f49490d08d300e75e0a52e1a7f3f4bd5003a9b7277',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'ac6f000d295e0678c4219f5de71736e7a290909436486c99eeb07f2f7fa9886c',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'edc537d2579364651222946001afb42b4cb6707d68483d0a1065840a6a565c3d',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'a5cb2a321c59d68954e071fd192a9e8fb07f127cfc25aaa773339713435b2c4e',
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
      '717d1c278def5d81f42e81cced3e80e6a2b83ef6ef01e792a7933ba9c3c7f5a3',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'a7da1f1b7534f6d6145187a37d9530c92a079a6f9d88a58d3a3a92e927a99a7c',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'fbd8fad5ee34404b901ff76056e7fe92239231e8dd5fe317d3779f2fc33d265b',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '6104ef793db13ce9de06fa18d07c858d4eed843a50cc12c967c196d9cb223c49',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
