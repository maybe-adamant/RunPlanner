import type { AuthoredFieldDescriptor, BiomeLayout } from '../catalog-schema';
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
): AuthoredFieldValue | null {
  if (value === null) {
    if (descriptor.initialization.kind !== 'required') {
      failProjectDocument(path, 'must use its declared default');
    }
    return null;
  }
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

export function createInitialBiomeState(layout: BiomeLayout): AuthoredBiomeState {
  return Object.freeze(
    Object.fromEntries(
      layout.fields.map((descriptor) => [
        descriptor.key,
        descriptor.initialization.kind === 'required' ? null : descriptor.initialization.value,
      ]),
    ),
  );
}

export function decodeBiomeState(
  value: unknown,
  layout: BiomeLayout,
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

export function replaceBiomeStateField(
  state: AuthoredBiomeState,
  layout: BiomeLayout,
  fieldKey: string,
  value: AuthoredFieldValue,
  path: string,
): AuthoredBiomeState {
  const descriptor = layout.fields.find((candidate) => candidate.key === fieldKey);
  if (descriptor === undefined) {
    failProjectDocument(path, `unknown biome field ${fieldKey}`);
  }
  const decoded = decodeFieldValue(value, descriptor, path);
  return state[fieldKey] === decoded ? state : Object.freeze({ ...state, [fieldKey]: decoded });
}
