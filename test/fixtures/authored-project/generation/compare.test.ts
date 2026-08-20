import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { encodeProjectDocument } from '@run-planner/engine/authored-project';
import { checkpointManifestById } from '../checkpoints/manifest';
import { createCompleteFGProject as scopedCompleteFGProject } from '../routes/underworld';
import { createRepresentativeNProject as scopedRepresentativeNProject } from '../routes/surface';
import { generatedCheckpoints, generatedVariants } from './canonical';

const checkpointDirectory = resolve(process.cwd(), 'test/fixtures/authored-project/checkpoints');

describe('authored-project canonical generation', () => {
  it('matches every legacy canonical and derived variant byte-for-byte', () => {
    for (const generated of generatedCheckpoints) {
      const entry = checkpointManifestById[generated.id as keyof typeof checkpointManifestById];
      expect(entry).toBeDefined();
      expect(encodeProjectDocument(generated.project)).toBe(
        readFileSync(resolve(checkpointDirectory, `${generated.id}.runplanner.json`), 'utf8'),
      );
      expect(generated.provenance).toBe(entry!.provenance);
    }
    expect(generatedVariants).toHaveLength(5);
    const replacements = [
      scopedCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      scopedCompleteFGProject({ prebossSource: 'G_Combat14' }),
      scopedCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02', prebossSource: 'G_Combat14' }),
      scopedRepresentativeNProject({
        includePreboss: false,
        visitSlotKeys: ['combat05', 'miniBoss01', 'combat02'],
      }),
      scopedRepresentativeNProject({
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
    ];
    for (const [index, replacement] of replacements.entries()) {
      expect(encodeProjectDocument(replacement), generatedVariants[index]!.id).toBe(
        encodeProjectDocument(generatedVariants[index]!.project),
      );
    }
  });
});
