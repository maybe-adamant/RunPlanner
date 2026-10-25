import {
  PROJECT_DOCUMENT_SCHEMA_REVISION,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
} from '../../../src/authored-project/model';
import { expandDiagnosticFrames } from '../../../src/execution-plan/codec/diagnostics';
import { fingerprint } from '../../../src/execution-plan/fingerprint';

/**
 * A committed execution fixture under the current schema pair. Fixtures keep the
 * pair they were generated under; the fingerprint covers the expanded contents
 * without the presentation-only display name.
 */
export function currentSchemaWire<T>(wire: T): T {
  const record = { ...(wire as Record<string, unknown>) };
  record.schemaVersion = PROJECT_DOCUMENT_SCHEMA_VERSION;
  record.schemaRevision = PROJECT_DOCUMENT_SCHEMA_REVISION;
  const body = expandDiagnosticFrames(record);
  delete body.planFingerprint;
  delete body.displayName;
  record.planFingerprint = fingerprint(body);
  return record as T;
}

const schemaStamp = /^( {2}"(?:schemaVersion|schemaRevision|planFingerprint)": ).*?(,?)$/gm;

/** Formatted fixture bytes with the schema pair and fingerprint lines masked. */
export function withoutSchemaStamp(bytes: string): string {
  return bytes.replace(schemaStamp, '$1*$2');
}
