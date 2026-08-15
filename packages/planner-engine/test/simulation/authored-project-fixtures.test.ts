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
      '19d958d2f2bd07d10f4a8a71348d96fd72640e52189e3168c216cc3cce6e6878',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '934f300932a2e4f8be3c0f074e305c570797b087724514c65bb08fee6f0b62e9',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '7580167532ef07977f7877374288e238ec71923ba19a75c16dc9c902cd3e90a2',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '0291a020593d1bc3013eedb783af90e0239dd6aabfe08fd49b6b77b7b9106f50',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'deee18dec066c18f9a48292f896ff99f1f8359a3e151a92c92aca24ad226fe97',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'a7a88dac4b9eb8f680423aca829493b7c31453690aca2e2d3f00f94745028c6f',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'fbb6b3ef32f4931fa606c4d2bef500640bdb187d8d0d6146dc36365bd28d6026',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'd8eb28aff82c2fb27248e3c2ffc49c154d220b5ca35a30b1970ed55760f75ff4',
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
      '71fc3c2724a0bcdbcf35fb6a5356e16b45cf975ef806a6b04628b33fab52011d',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '21cce513aa87b8b9185613bfcf2aa2702e7e5f186321a76ddf337e5d3b909282',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '6e0dc10d85851c4f7d3dcb6f0d905d000e01fd8605f48268b242fdc18b053df4',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '14499ab06288d81e378dff3f115e92fad6fc3307e7f5986a99d89cedd6fdd8ea',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
