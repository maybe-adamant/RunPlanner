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
      '28d3f36af35aa9cf3d3f2727b131766e8bab2a4d4d39d572ec8b6c429dd1c58b',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'e8de8e7ae5d5ff0619209c31d6b21f64066d68d7a379f322a1f699bdae500169',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'f9e1d6ba2e4fccafde022cbad0f727b66b2c39b0b320fd2b1f4ba3777bcae400',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'd729691787e90b9f139e86f41cd417dd62f6ef0bd9d203608000da0bfbc693d6',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '2266d48cd493c39a2b365ae5e982104ab6822e06a0b1e92882511710ae7f317c',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'c4ca7e1acf548ec4dde2897cb3f68e5d8d1e98b97238acfbe2355446ca5112e5',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'c6a8d4d2c34c864c00a0d5283d1e2d25bf56945d88c69100517ed66a52fcbc31',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'fc4c90f900ce1d7481ed978d8fae83c6bdc1fe9aa7d42b963071727b53e3f131',
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
      '2ad8867ca919c759af625c145ffd1f2897f04127c3e172f7526e4a07d21cfef1',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'c2fb6355678feae683d5e299708e47ecc7cf3ef167af73980acf49b9ae731720',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '52867d90ba3f8f8fb828e0dba6f0d236a2aaeeb652435000cfb92aada01c5aaa',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '218aa48478e8ab20761c29779d05c898cbd412d6f57b8cdc2e3ad6b910804f9b',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
