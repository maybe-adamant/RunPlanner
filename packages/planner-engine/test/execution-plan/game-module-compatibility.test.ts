import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  PROJECT_DOCUMENT_SCHEMA_REVISION,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
} from '../../src/authored-project/model';
import { EXECUTION_CATALOG_VERSION, EXECUTION_PLAN_FORMAT } from '../../src/execution-plan';

const moduleSource = join(dirname(fileURLToPath(import.meta.url)), '../../../../game-module/src');

function decoderConstant(source: string, name: string): string | number | undefined {
  const match = new RegExp(`^ {4}${name} = (?:"([^"]*)"|(\\d+)),$`, 'm').exec(source);
  if (match === null) return undefined;
  return match[1] ?? Number(match[2]);
}

describe('game module compatibility', () => {
  it('admits exactly the plan header the planner compiles', () => {
    const header = {
      format: EXECUTION_PLAN_FORMAT,
      catalogVersion: EXECUTION_CATALOG_VERSION,
      schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
      schemaRevision: PROJECT_DOCUMENT_SCHEMA_REVISION,
    };
    expect(EXECUTION_CATALOG_VERSION).toBe(catalog.version);
    expect(
      JSON.parse(readFileSync(join(moduleSource, 'execution-compatibility.json'), 'utf8')),
    ).toEqual(header);
    const decoder = readFileSync(join(moduleSource, 'mods/protocol/decoder.lua'), 'utf8');
    expect({
      format: decoderConstant(decoder, 'FORMAT'),
      catalogVersion: decoderConstant(decoder, 'CATALOG_VERSION'),
      schemaVersion: decoderConstant(decoder, 'SCHEMA_VERSION'),
      schemaRevision: decoderConstant(decoder, 'SCHEMA_REVISION'),
    }).toEqual(header);
  });
});
