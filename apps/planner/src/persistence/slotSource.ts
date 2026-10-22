/** The planner-owned file beside a sent slot: the saved project and the options it was sent with. */
export const SLOT_SOURCE_FORMAT = 'run-planner-slot-source';
export const SLOT_SOURCE_FORMAT_VERSION = 1;

export interface SlotSource {
  /** The plan's name stored by a planner whose projects had none: the saved file's stem. */
  readonly displayName?: string;
  /** Whether internal-stage run modifiers took part in the compile. */
  readonly internalRunModifiers: boolean;
  /** The saved project document as JSON text. */
  readonly projectJson: string;
}

export function encodeSlotSource(source: SlotSource): string {
  return JSON.stringify({
    format: SLOT_SOURCE_FORMAT,
    formatVersion: SLOT_SOURCE_FORMAT_VERSION,
    ...(source.displayName === undefined ? {} : { displayName: source.displayName }),
    internalRunModifiers: source.internalRunModifiers,
    project: JSON.parse(source.projectJson) as unknown,
  });
}

/** Decodes a stored source exactly; rejects with a reason for anything else. */
export function decodeSlotSource(json: string): SlotSource {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error('The slot source is not valid JSON.');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('The slot source must be an object.');
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set([
    'format',
    'formatVersion',
    'displayName',
    'internalRunModifiers',
    'project',
  ]);
  if (
    Object.keys(record).some((key) => !allowed.has(key)) ||
    record.format !== SLOT_SOURCE_FORMAT ||
    record.formatVersion !== SLOT_SOURCE_FORMAT_VERSION ||
    typeof record.internalRunModifiers !== 'boolean' ||
    (record.displayName !== undefined && typeof record.displayName !== 'string') ||
    typeof record.project !== 'object' ||
    record.project === null ||
    Array.isArray(record.project)
  ) {
    throw new Error('The slot source is not a run-planner-slot-source file.');
  }
  return Object.freeze({
    ...(record.displayName === undefined ? {} : { displayName: record.displayName }),
    internalRunModifiers: record.internalRunModifiers,
    projectJson: JSON.stringify(record.project),
  });
}
