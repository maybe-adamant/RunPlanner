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
      'ca3f491aac6e3d503e94a05da0604066ebd989877d4f45a9338cb22c955158e2',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '1eef24927e145962c7dcd8856d48379532d9a4ebea33e8a54979155be4b4e7b1',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '804e365fe086ad8672580b9a4a044a56d1301524748f70d7cc32b269cc005a27',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '6c04cc1211163c38aefab475431a1e156c5a69565f1128221f87039a778fafb3',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '5e79b389b791afb720f71cee8869ecac429f7a24a0e21d6360a316e1844d1a1c',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '9fb0e50f6e0e3b51cb0c201bed6454d7f217bbfc45b5d71b84ce399b63a4a875',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '4086eef6485e9580d8a8fcd76556e98135535a2fddeb589e1748bdaadfec1632',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '50ab2c7deac36e77428d034672ebd285ab5bde641d65802d370191b87f0c46ed',
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
      '6150f9201498ff4db018b81d392433d2e21ab39f62287ea1588d233ca44aa3f9',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'eefef90bfc13095e0d0d7139ef1be298cd8afdacd213dd1ae49c51d982429e91',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '3922aec7fabeffa1683f4de357f31e36b8f8f0aad3be84d224daa44e5c31c899',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '737545e3d974ba1ce1cd1f2ca86323b36786494accc36300d9d2832db799a440',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
