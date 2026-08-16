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
      '4e254bf77e94b050cea6c54c117edae981890769243d27e404f37fe2b1456a5b',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '8e86597a7e70278986888c1942540f1cecf33941446f7693e950af8233078354',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '038321a722afdd6676b95d470185b3f15cc89739a3f621f7589b72223f60e5dd',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'ba4b0031176e221296e44eacd3b24ce1ff4af1a0cd71a4458cff59cf36a38000',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '719943b98cfe5f4f9f76279abde9f1852f9835f566eabe987fe0d02e64625d58',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '1bbd1a572b390b9fe89ff2866d4ad3e78de63177e12154fe69fe2296fa6fe2dd',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '47d740ba46e240f376c3d27f04693a693dc4a3ffe7dfe036beaab4e26c213115',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'c51e8ac3634bc6b68af9e42d7b4987f3ed0cd17d2f8e130b194daeccc53e81b0',
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
      'c38d8271d163264f789773604f9bf639775e59412156e7043df65ac5b7e9cfa6',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '6cfe0ecc4470da3df83c4bd340a73a5bcc6d8d1727d69a8ca0aa344ce12aa2b3',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '14f44db9f304012e1590eb81d5c93dbed01c892ad93c0af86fcb7e05d6cde289',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'e502bd7b372291c34880452ee5a7477cd704bcae27ea8fe07bc3cd39879606f9',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
