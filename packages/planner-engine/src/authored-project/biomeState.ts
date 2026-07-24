import type { AuthoredFieldDescriptor, LinearBiomeLayout } from '../catalog-schema';
import type { AuthoredBiomeState, AuthoredFieldValue } from './model';
import {
  expectBoolean,
  expectExactKeys,
  expectRecord,
  expectString,
  failProjectDocument,
} from './validation';

function decodeFieldValue(
  value: unknown,
  descriptor: AuthoredFieldDescriptor,
  path: string,
): AuthoredFieldValue {
  switch (descriptor.kind) {
    case 'boolean':
      return expectBoolean(value, path);
    case 'boundedInteger':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        failProjectDocument(path, 'must be an integer');
      }
      if (value < descriptor.min || value > descriptor.max) {
        failProjectDocument(path, `must be between ${descriptor.min} and ${descriptor.max}`);
      }
      return value;
    case 'enum': {
      const decoded = expectString(value, path);
      if (!descriptor.values.includes(decoded)) {
        failProjectDocument(path, `must be one of ${descriptor.values.join(', ')}`);
      }
      return decoded;
    }
  }
}

export function createDefaultBiomeState(layout: LinearBiomeLayout): AuthoredBiomeState {
  return Object.freeze(
    Object.fromEntries(
      layout.fields.map((descriptor) => [descriptor.key, descriptor.defaultValue]),
    ),
  );
}

export function decodeBiomeState(
  value: unknown,
  layout: LinearBiomeLayout,
  path: string,
): AuthoredBiomeState {
  const state = expectRecord(value, path);
  expectExactKeys(
    state,
    layout.fields.map((descriptor) => descriptor.key),
    path,
  );
  return Object.freeze(
    Object.fromEntries(
      layout.fields.map((descriptor) => [
        descriptor.key,
        decodeFieldValue(state[descriptor.key], descriptor, `${path}.${descriptor.key}`),
      ]),
    ),
  );
}
