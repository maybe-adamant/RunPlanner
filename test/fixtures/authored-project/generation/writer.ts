import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { encodeProjectDocument } from '@run-planner/engine/authored-project';
import { generatedCheckpoints } from './canonical';

export const checkpointDirectory = resolve(
  process.cwd(),
  'test/fixtures/authored-project/checkpoints',
);

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function checkpointPath(id: string): string {
  return resolve(checkpointDirectory, `${id}.runplanner.json`);
}

function writeManifestDigests(): void {
  const manifestPath = resolve(checkpointDirectory, 'manifest.ts');
  let source = readFileSync(manifestPath, 'utf8');
  for (const generated of generatedCheckpoints) {
    const digest = sha256(encodeProjectDocument(generated.project));
    source = source.replace(
      new RegExp(`(id: '${generated.id}'[\\s\\S]*?sha256: ')[0-9a-f]+(')`),
      `$1${digest}$2`,
    );
  }
  writeFileSync(manifestPath, source);
}

/** Explicit generation-only writer. It never imports checkpoint loaders. */
export function writeCanonicalCheckpoints(): void {
  for (const generated of generatedCheckpoints) {
    writeFileSync(checkpointPath(generated.id), encodeProjectDocument(generated.project));
  }
  writeManifestDigests();
}
