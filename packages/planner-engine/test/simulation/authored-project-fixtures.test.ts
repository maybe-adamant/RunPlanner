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
      '4b7aa91c3aeead10259d47c6c0ef233d8e1b571b65eac8a67d34b509b86c065d',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '0e5cac3601e0d4ccda67b5041248c34cb55087398938138d478e820220747af3',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '62da163899789241e179351fe46dd856dd21ce14aa69c6c842e29c92b6e2557e',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'dc7e3ce588a3763b30941502c8ea3560bfdce54c135e401c926e3fb59fbd271a',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '9aaea3f3b5bf0550ffafaf5b8462df687dbc67ad0bd9cef5545692a8b3ae67fd',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'd7f6af7e05317a7dffc0a8a84e4b768970bbd46251eeca1e0d4945017f5a7a2e',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '8b36aac2673f1c8f2aae402d206ad04f774a1a8c58eeb5ecd0e129d960e8ac7b',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'b45a3707e95faec7c73971dccfc27ca073b506a810519f927f66a09f3b88459a',
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
      '3a0aaaa7e03c40734b9e04073a79103ac7b2c124217b569b028852315890ebaf',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'a4eca062eef7b5e49213e6ca252072497fc7d0cbe8cc6e30790e360b6d1cd3f8',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '209dea5444d26c6eb977587006cdb5b71ad10c64148548ccf17ec16b01af5361',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '4bb7fb9bbebe2c1ec0c9839613337dec84fec78bf4ed95cd9e4ab1e8f58511d8',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
