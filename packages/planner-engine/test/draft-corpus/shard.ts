import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DRAFT_CORPUS_SPEC_COUNT, draftCorpusEntry } from './corpus';
import { measureDraft } from './measure';
import { draftCorpusRunsDirectory } from './paths';

export const DRAFT_CORPUS_SHARDS = 8;

/** Drafts every seed of this shard's specs; the first seed is drafted twice to witness determinism. */
export function draftCorpusShard(shard: number): void {
  const indexes = Array.from({ length: DRAFT_CORPUS_SPEC_COUNT }, (_, index) => index).filter(
    (index) => index % DRAFT_CORPUS_SHARDS === shard,
  );
  for (const specIndex of indexes) {
    const entry = draftCorpusEntry(specIndex);
    describe(entry.name, () => {
      it.each(entry.seeds.map((seed, position) => [seed, position] as const))(
        'seed %i',
        (seed, position) => {
          const run = measureDraft(entry, specIndex, seed);
          if (position === 0)
            expect(measureDraft(entry, specIndex, seed).digest, 'redrafted plan digest').toBe(
              run.digest,
            );
          mkdirSync(draftCorpusRunsDirectory, { recursive: true });
          writeFileSync(
            join(draftCorpusRunsDirectory, `${specIndex}-${seed}.json`),
            JSON.stringify(run),
          );
        },
      );
    });
  }
}
