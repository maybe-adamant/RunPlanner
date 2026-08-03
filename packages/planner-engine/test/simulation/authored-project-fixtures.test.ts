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
      'd291b385d4c5761befb41966950eb26f1f04acca48af901bd9eeef9190073bc7',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '896edfcbd8ecd3c7f950fd29eb3c72b8da5e116bfcd2c37c726118e3aac0903f',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '4aec33e150b79edac2eb43785893e9b2f41c07bcc09fe10e1896df8ba9a2b91e',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '2d9427d033068f9bc2f9b321a6e0f3b114e1a7e1a85e184d4d3b2f49c936baa6',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'b76e57a6c916cbb5f02f57e2077d5c3b60c9e401be8bb6772d8d7d0ea118c40a',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'c7897c7c9a239c3af575203e28d841c8cdc3895fe83fe8c21ae1ea99ab3e94cd',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '11c237111c4024a0209de0dec0a68449c4a57e8ff50027007f874db9ae9e2e0a',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '0cfdaae582b31990d2991f63515099f219054d19148dad5eb48134ee34e89603',
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
      '4a04016855af4642ddfdd2aa8373b2cea75ed509029a6bb3e84251c6c6904a2a',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'e1085d942025ccc9945d73258f038a9aecea9fb4328dc46eb31ec66d9ffc8b1e',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '88512f3f29d9edccc0c742041da8e132cb5f0486b3bd22ccc6f901262623e4e8',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'f0c9c80f453ae3c95da711b8bf28abbc7ddafe4a9cbd6c88ac885b294aeeedf9',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
