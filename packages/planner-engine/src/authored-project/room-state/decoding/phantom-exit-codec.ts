import type { Catalog, RoomDeclaration } from '../../../catalog-schema';
import type { PhantomExitState } from '../../model';
import { phantomExitDomainError } from '../../phantom-exit';
import { expectExactKeys, expectRecord, expectString, failProjectDocument } from '../../validation';

function nullableString(value: unknown, path: string): string | null {
  return value === null ? null : expectString(value, path);
}

export function decodePhantomExit(
  value: unknown,
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): PhantomExitState {
  const raw = expectRecord(value, path);
  expectExactKeys(raw, ['placeholderRoomGameName', 'rewardType'], path);
  const decoded = Object.freeze({
    placeholderRoomGameName: nullableString(
      raw.placeholderRoomGameName,
      `${path}.placeholderRoomGameName`,
    ),
    rewardType: nullableString(raw.rewardType, `${path}.rewardType`),
  });
  const error = phantomExitDomainError(catalog, room, decoded);
  if (error !== undefined) failProjectDocument(path, error);
  return decoded;
}
