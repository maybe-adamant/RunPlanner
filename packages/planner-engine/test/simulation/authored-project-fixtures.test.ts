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
      'ca96bdcd61131728de5e7268cfeb9fcc3c4464ea52fa3da8a832b084081268d1',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'f55617e9bc4767c1afdb7c152631cb04afd062b533867a6ceb2b070390f52161',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '75d043ceb81deb5806df14ac369064423b0ad283b531265625f1c8245aff12bc',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '7a79359e47c79a5cf61c9002b46f11c1bab6397c8b18ff34547073df31e0d45b',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '8666bd661f712c096c00ca119f3bf52fb40449104b7f2a3a8027ecaa8fa10058',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '6e13b71617d0fbc96d4fb39999b924ab8bdb3fca4585fe9b5d6c9228f7e4cc46',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '501d07ce4040c9897baaccdfc8952804929e85d9b1039491bc87dcdbc4d4540f',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'ff09d529a6ac8adec6b37d86f0d80dc2534df3d8e5b6adc3a15c90ab610c8fd8',
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
      'c897c24cdedae1524debe62d87733d53172cc268bcf42d928cbe0d6eb02f86d7',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '303e67c9ff027226fae82b2c58ebf45fd78857a407bb53dca6e84a848ef87fe0',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '0023a01967013485f03ce0d790135ae9fb864c229602305c8c54fde415a9bb29',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'a6e7cb5e4ff50d6c5119b47abee315e516738a8826044e6d30e47bf339d5eaf3',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
