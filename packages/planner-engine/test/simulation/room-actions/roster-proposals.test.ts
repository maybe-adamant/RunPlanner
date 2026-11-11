import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

import { roomActionKey } from '@run-planner/engine/authored-project';
import type { RoomActionPlacementBlocker } from '../../../src/authored-project/room-actions/order-assessment';
import type { RoomActionProposal, RoomActionRow } from '../../../src/simulation/room-actions/model';
import {
  assertLifecycleSnapshot,
  byRoomVariant,
  compactActionKey,
  corpusAssemblies,
  corpusRooms,
  roomLabel,
  setUnique,
  type RoomWitness,
} from '../../support/lifecycle-snapshots';

const snapshotPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'roster-proposals.snapshot.json',
);

function blockerText(row: RoomActionRow, blocker: RoomActionPlacementBlocker): string {
  const subject = roomActionKey(blocker.reference);
  const prefix = subject === row.key ? '' : `${compactActionKey(subject)} `;
  switch (blocker.kind) {
    case 'dependency': {
      const dependency = blocker.dependency;
      const target =
        dependency.kind === 'afterAction'
          ? compactActionKey(roomActionKey(dependency.action))
          : dependency.checkpointKey;
      return `${prefix}${dependency.kind} ${target}${blocker.checkpointUnavailable === true ? ' unavailable' : ''}`;
    }
    case 'window':
      return `${prefix}window after ${compactActionKey(roomActionKey(blocker.precedingAction))}`;
    case 'requiredFirst':
      return `${prefix}requiredFirst ${compactActionKey(roomActionKey(blocker.requiredAction))}`;
  }
}

/** Each blocked index list, grouped by the identical blockers it shows. */
function blockedText(
  row: RoomActionRow,
  kind: string,
  proposals: readonly RoomActionProposal[],
): readonly string[] {
  const byBlockers = new Map<string, number[]>();
  for (const proposal of proposals) {
    if (proposal.structurallyAuthorable) continue;
    const blockers = proposal.blockers.map((blocker) => blockerText(row, blocker)).join(', ');
    const indexes = byBlockers.get(blockers) ?? [];
    indexes.push(proposal.toIndex!);
    byBlockers.set(blockers, indexes);
  }
  return [...byBlockers].map(
    ([blockers, indexes]) => `${kind} blocked ${indexes.join(',')}: ${blockers || '-'}`,
  );
}

/**
 * One row's line: rank, participation and scope, the indices each proposal
 * kind may author, the canonical restore, and every blocked index with its
 * blockers.
 */
function rowLine(row: RoomActionRow, proposals: readonly RoomActionProposal[]): string {
  const keys = new Set([
    row.key,
    ...(row.itemReference === undefined ? [] : [roomActionKey(row.itemReference)]),
  ]);
  const own = proposals.filter((proposal) => keys.has(roomActionKey(proposal.reference)));
  const parts = [
    `#${row.rank ?? '-'} ${row.participation}`,
    ...(row.requiredScope === undefined ? [] : [`scope ${row.requiredScope}`]),
    ...(row.stale ? ['stale'] : []),
    ...(row.itemReplaced === true ? ['replaced'] : []),
  ];
  for (const kind of ['insert', 'move'] as const) {
    const ofKind = own.filter((proposal) => proposal.kind === kind);
    if (ofKind.length === 0) continue;
    const authorable = ofKind.filter((proposal) => proposal.structurallyAuthorable);
    parts.push(`${kind} ${authorable.map((proposal) => proposal.toIndex).join(',') || '-'}`);
    const canonical = ofKind.find((proposal) => proposal.canonical === true);
    if (canonical !== undefined) parts.push(`canonical ${canonical.toIndex}`);
    parts.push(...blockedText(row, kind, ofKind));
  }
  for (const proposal of own)
    if (proposal.kind === 'remove' || proposal.kind === 'unplace')
      parts.push(proposal.structurallyAuthorable ? proposal.kind : `${proposal.kind} blocked`);
  return parts.join(' | ');
}

describe('room action roster proposals', () => {
  it('match the checked-in snapshot for every corpus row', async () => {
    const witnesses: RoomWitness<{ readonly rows: Record<string, string> }>[] = [];
    for (const { entry, assembly } of corpusAssemblies()) {
      for (const room of corpusRooms(assembly)) {
        const roster = room.roomActionRoster;
        if (roster.rows.length === 0) continue;
        const rows: Record<string, string> = {};
        for (const row of roster.rows)
          setUnique(rows, compactActionKey(row.key), rowLine(row, roster.proposals));
        witnesses.push({
          entry: entry.name,
          room: roomLabel(room.origin, room.gameName),
          content: { rows },
        });
      }
    }
    await assertLifecycleSnapshot(snapshotPath, byRoomVariant(witnesses));
  });
});
