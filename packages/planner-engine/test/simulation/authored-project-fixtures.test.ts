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
      'f178ec2a0cfdcc2b5d9956174c11f354e2c076edbd0dbaa6eeb86d738b258593',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '78472ae57e4fc966390449c5338d2c13fcde9c4a5a7bf97a30733be1a4be4c8a',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'd20d9949813b417075549b4903369554ea8430db31908b1048d75ce8f6cba31f',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'f49bb4a549159a352aba0483877f2da77a292a025c212778a73a4278c5a41d4d',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'f98c2af7fc16cec1d351d27053e5a2d56774ee7cb5bfa448cab37e92233cb5d5',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '8a40f5648683e17d258ebefbe93f07a6ca3678fa88e062aab53f8676c195352c',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '0b4ef1bbbc5b0f21ee2f807a1772b0cd1f31f9dff12e8fb29b57e1eb6d4c2d8e',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '5eaeaa4ba32c38086f61f7b53a65dd2684b5d0f1bd398b83999f3cb5e92e4256',
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
      'caa0fe768d0690b423b7fe659361054746a98c8e7522b4d70aa2056dbdaa411d',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'f05f99bd620ce1f0363f1b89be3373e6b62efbb21faeda6a4cf9e5173374032c',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '30b81d9234dc9a5b40eed7360c92b3eb87501ecc477686a56c7eefe4f272bb4b',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '25ca23f50d3a06b828584ae43d5663fb921ace9951cfdf3c9a998b858347e9e8',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
