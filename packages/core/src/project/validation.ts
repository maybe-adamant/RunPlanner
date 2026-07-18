type UnknownRecord = Record<string, unknown>;

export class ProjectDocumentContractError extends Error {
  readonly path: string;
  readonly detail: string;

  constructor(path: string, detail: string) {
    super(`${path}: ${detail}`);
    this.name = 'ProjectDocumentContractError';
    this.path = path;
    this.detail = detail;
  }
}

export function failProjectDocument(path: string, detail: string): never {
  throw new ProjectDocumentContractError(path, detail);
}

export function expectRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    failProjectDocument(path, 'must be an object');
  }
  return value as UnknownRecord;
}

export function expectExactKeys(value: UnknownRecord, keys: readonly string[], path: string): void {
  const allowedKeys = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      failProjectDocument(`${path}.${key}`, 'is not a project document field');
    }
  }
}

export function expectArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    failProjectDocument(path, 'must be an array');
  }
  return value;
}

export function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    failProjectDocument(path, 'must be a string');
  }
  return value;
}

export function expectNonBlankString(value: unknown, path: string): string {
  const stringValue = expectString(value, path);
  if (stringValue.trim().length === 0) {
    failProjectDocument(path, 'must not be blank');
  }
  return stringValue;
}

export function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    failProjectDocument(path, 'must be a boolean');
  }
  return value;
}

export function expectPositiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    failProjectDocument(path, 'must be a positive integer');
  }
  return value;
}
