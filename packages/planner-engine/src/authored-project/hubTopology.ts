import type { Catalog, FixedAuthoredSlotDescriptor, HubBiomeLayout } from '../catalog-schema';
import type {
  FixedAuthoredRoomReference,
  HubBiomeTopology,
  HubTargetReference,
  OccurrenceId,
  RoomOccurrence,
} from './model';
import { decodeRoomState, type RoomOccurrenceRole } from './roomState';
import {
  expectArray,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  failProjectDocument,
} from './validation';

interface RawOccurrence {
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
  readonly state: unknown;
  readonly path: string;
}

function occurrenceId(value: unknown, path: string): OccurrenceId {
  return expectNonBlankString(value, path) as OccurrenceId;
}

function fixedDescriptors(
  layout: HubBiomeLayout,
  path: string,
): readonly FixedAuthoredSlotDescriptor[] {
  if (layout.entries.some((entry) => entry.kind !== 'fixedAuthoredSlot')) {
    failProjectDocument(path, `${layout.biomeKey} Hub entries must be fixed authored slots`);
  }
  if (layout.terminal.kind !== 'fixedAuthoredSlot') {
    failProjectDocument(path, `${layout.biomeKey} Hub terminal must be a fixed authored slot`);
  }
  return [...(layout.entries as readonly FixedAuthoredSlotDescriptor[]), layout.terminal];
}

export function decodeHubBiomeTopology(
  value: unknown,
  catalog: Catalog,
  layout: HubBiomeLayout,
  path: string,
): HubBiomeTopology {
  const topology = expectRecord(value, path);
  expectExactKeys(topology, ['occurrences', 'fixedRooms', 'openTargets', 'visitOrder'], path);

  const rawOccurrences = expectArray(topology.occurrences, `${path}.occurrences`);
  const occurrenceById = new Map<OccurrenceId, RawOccurrence>();
  for (const [index, rawValue] of rawOccurrences.entries()) {
    const occurrencePath = `${path}.occurrences[${index}]`;
    const rawOccurrence = expectRecord(rawValue, occurrencePath);
    expectExactKeys(rawOccurrence, ['occurrenceId', 'gameName', 'state'], occurrencePath);
    const id = occurrenceId(rawOccurrence.occurrenceId, `${occurrencePath}.occurrenceId`);
    if (occurrenceById.has(id)) {
      failProjectDocument(`${occurrencePath}.occurrenceId`, `duplicates occurrence ${id}`);
    }
    occurrenceById.set(id, {
      occurrenceId: id,
      gameName: expectNonBlankString(rawOccurrence.gameName, `${occurrencePath}.gameName`),
      state: rawOccurrence.state,
      path: occurrencePath,
    });
  }

  const requiredFixed = fixedDescriptors(layout, path);
  if (layout.terminal.kind !== 'fixedAuthoredSlot') {
    failProjectDocument(path, `${layout.biomeKey} Hub terminal must be a fixed authored slot`);
  }
  const terminalSlotKey = layout.terminal.slotKey;
  const fixedByKey = new Map<string, FixedAuthoredRoomReference>();
  const fixedPathByKey = new Map<string, string>();
  for (const [index, rawValue] of expectArray(
    topology.fixedRooms,
    `${path}.fixedRooms`,
  ).entries()) {
    const fixedPath = `${path}.fixedRooms[${index}]`;
    const rawFixed = expectRecord(rawValue, fixedPath);
    expectExactKeys(rawFixed, ['fixedSlotKey', 'occurrenceId'], fixedPath);
    const fixedSlotKey = expectNonBlankString(rawFixed.fixedSlotKey, `${fixedPath}.fixedSlotKey`);
    if (!requiredFixed.some((descriptor) => descriptor.slotKey === fixedSlotKey)) {
      failProjectDocument(`${fixedPath}.fixedSlotKey`, `unknown fixed slot ${fixedSlotKey}`);
    }
    if (fixedByKey.has(fixedSlotKey)) {
      failProjectDocument(`${fixedPath}.fixedSlotKey`, `duplicates fixed slot ${fixedSlotKey}`);
    }
    const id = occurrenceId(rawFixed.occurrenceId, `${fixedPath}.occurrenceId`);
    if (!occurrenceById.has(id)) {
      failProjectDocument(`${fixedPath}.occurrenceId`, `unknown occurrence ${id}`);
    }
    fixedByKey.set(fixedSlotKey, Object.freeze({ fixedSlotKey, occurrenceId: id }));
    fixedPathByKey.set(fixedSlotKey, fixedPath);
  }
  const fixedRooms = requiredFixed.map((descriptor) => {
    const fixed = fixedByKey.get(descriptor.slotKey);
    if (fixed === undefined) {
      failProjectDocument(
        `${path}.fixedRooms`,
        `missing fixed authored slot ${descriptor.slotKey}`,
      );
    }
    return fixed;
  });

  const hubSlotByKey = new Map(layout.hub.slots.map((slot) => [slot.slotKey, slot]));
  const openByKey = new Map<string, HubTargetReference>();
  const openPathByKey = new Map<string, string>();
  const rawOpenTargets = expectArray(topology.openTargets, `${path}.openTargets`);
  if (rawOpenTargets.length > layout.hub.openCount.max) {
    failProjectDocument(
      `${path}.openTargets`,
      `exceeds ${layout.hub.openCount.max} open Hub targets`,
    );
  }
  for (const [index, rawValue] of rawOpenTargets.entries()) {
    const targetPath = `${path}.openTargets[${index}]`;
    const rawTarget = expectRecord(rawValue, targetPath);
    expectExactKeys(rawTarget, ['hubSlotKey', 'occurrenceId'], targetPath);
    const hubSlotKey = expectNonBlankString(rawTarget.hubSlotKey, `${targetPath}.hubSlotKey`);
    if (!hubSlotByKey.has(hubSlotKey)) {
      failProjectDocument(`${targetPath}.hubSlotKey`, `unknown Hub slot ${hubSlotKey}`);
    }
    if (openByKey.has(hubSlotKey)) {
      failProjectDocument(`${targetPath}.hubSlotKey`, `duplicates open Hub slot ${hubSlotKey}`);
    }
    const id = occurrenceId(rawTarget.occurrenceId, `${targetPath}.occurrenceId`);
    if (!occurrenceById.has(id)) {
      failProjectDocument(`${targetPath}.occurrenceId`, `unknown occurrence ${id}`);
    }
    openByKey.set(hubSlotKey, Object.freeze({ hubSlotKey, occurrenceId: id }));
    openPathByKey.set(hubSlotKey, targetPath);
  }
  const openTargets = layout.hub.slots.flatMap((slot) => {
    const target = openByKey.get(slot.slotKey);
    return target === undefined ? [] : [target];
  });

  const visitOrder = expectArray(topology.visitOrder, `${path}.visitOrder`).map((value, index) =>
    expectNonBlankString(value, `${path}.visitOrder[${index}]`),
  );
  if (visitOrder.length > layout.hub.requiredVisits) {
    failProjectDocument(`${path}.visitOrder`, `exceeds ${layout.hub.requiredVisits} Hub visits`);
  }
  const visited = new Set<string>();
  for (const [index, hubSlotKey] of visitOrder.entries()) {
    if (!openByKey.has(hubSlotKey)) {
      failProjectDocument(`${path}.visitOrder[${index}]`, `${hubSlotKey} is not an open Hub slot`);
    }
    if (visited.has(hubSlotKey)) {
      failProjectDocument(`${path}.visitOrder[${index}]`, `duplicates Hub visit ${hubSlotKey}`);
    }
    visited.add(hubSlotKey);
  }

  const ownerByOccurrence = new Map<
    OccurrenceId,
    { readonly role: RoomOccurrenceRole; readonly entryActive: boolean; readonly gameName: string }
  >();
  for (const descriptor of requiredFixed) {
    const reference = fixedByKey.get(descriptor.slotKey);
    if (reference === undefined) {
      failProjectDocument(path, `missing normalized fixed Hub slot ${descriptor.slotKey}`);
    }
    if (ownerByOccurrence.has(reference.occurrenceId)) {
      failProjectDocument(
        `${fixedPathByKey.get(descriptor.slotKey)}.occurrenceId`,
        `occurrence ${reference.occurrenceId} has multiple structural owners`,
      );
    }
    ownerByOccurrence.set(reference.occurrenceId, {
      role: descriptor.slotKey === terminalSlotKey ? 'terminalShop' : 'ordinary',
      entryActive: true,
      gameName: descriptor.roomGameName,
    });
  }
  for (const slot of layout.hub.slots) {
    const reference = openByKey.get(slot.slotKey);
    if (reference === undefined) {
      continue;
    }
    if (ownerByOccurrence.has(reference.occurrenceId)) {
      failProjectDocument(
        `${openPathByKey.get(slot.slotKey)}.occurrenceId`,
        `occurrence ${reference.occurrenceId} has multiple structural owners`,
      );
    }
    ownerByOccurrence.set(reference.occurrenceId, {
      role: 'ordinary',
      entryActive: visited.has(slot.slotKey),
      gameName: slot.roomGameName,
    });
  }
  if (ownerByOccurrence.size !== occurrenceById.size) {
    const unreferenced = [...occurrenceById.values()].find(
      (occurrence) => !ownerByOccurrence.has(occurrence.occurrenceId),
    );
    if (unreferenced !== undefined) {
      failProjectDocument(
        unreferenced.path,
        `occurrence ${unreferenced.occurrenceId} is not referenced by Hub topology`,
      );
    }
  }

  const orderedIds = [
    ...fixedRooms.map((reference) => reference.occurrenceId),
    ...openTargets.map((reference) => reference.occurrenceId),
  ];
  const occurrences = orderedIds.map((id): RoomOccurrence => {
    const raw = occurrenceById.get(id);
    const owner = ownerByOccurrence.get(id);
    if (raw === undefined || owner === undefined) {
      failProjectDocument(path, `missing normalized Hub occurrence ${id}`);
    }
    if (raw.gameName !== owner.gameName) {
      failProjectDocument(
        `${raw.path}.gameName`,
        `fixed slot requires ${owner.gameName}, received ${raw.gameName}`,
      );
    }
    const room = catalog.rooms.byKey[raw.gameName];
    if (room === undefined) {
      failProjectDocument(`${raw.path}.gameName`, `unknown room ${raw.gameName}`);
    }
    if (room.biomeKey !== layout.biomeKey || room.mode.kind !== 'authored') {
      failProjectDocument(
        `${raw.path}.gameName`,
        `${raw.gameName} is not an authored ${layout.biomeKey} room`,
      );
    }
    return Object.freeze({
      occurrenceId: id,
      gameName: raw.gameName,
      state: decodeRoomState(
        raw.state,
        catalog,
        room,
        { role: owner.role, entryActive: owner.entryActive },
        `${raw.path}.state`,
      ),
    });
  });

  return Object.freeze({
    occurrences: Object.freeze(occurrences),
    fixedRooms: Object.freeze(fixedRooms),
    openTargets: Object.freeze(openTargets),
    visitOrder: Object.freeze(visitOrder),
  });
}
