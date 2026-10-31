import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { loadSurfaceNQuickBuckCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { nBiome, nOccurrenceIds } from '@run-planner/test-fixtures/surface';

import { createOccurrenceAddress } from '../../../src/authored-project/addresses';
import { hermesShrineDeliveryEntryKey } from '../../../src/authored-project/hermes-shrine-delivery';
import type { RoomActionReference } from '../../../src/authored-project/model';
import { roomActionKey } from '../../../src/authored-project/room-actions/state';
import { TRAVEL_DEAL_REFILL_ENTRY_KEY } from '../../../src/authored-project/shop';
import { resolveRoutePosition } from '../../../src/authored-project/route-context';
import { materializeAuthoredRoom } from '../../../src/simulation/materialization/rooms/assemble';

describe('materialized room-action roster', () => {
  it('names the source of a stale Travel Deal refill and Hermes delivery row', () => {
    const project = loadSurfaceNQuickBuckCheckpoint();
    const occurrence = project.route.biomes
      .find((candidate) => candidate.biomeKey === 'N')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === nOccurrenceIds.opening,
      );
    if (occurrence === undefined) throw new Error('N opening is missing');
    const travelDealRefill = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'roomExit',
      entryKey: TRAVEL_DEAL_REFILL_ENTRY_KEY,
    };
    const delivery = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'hermesShrineDelivery',
      entryKey: hermesShrineDeliveryEntryKey(
        createOccurrenceAddress(nBiome, nOccurrenceIds.opening),
        'initial:first',
      ),
    };
    // Neither source exists in an opening room, so both rows are retained but stale.
    const room = materializeAuthoredRoom({
      catalog,
      biome: nBiome,
      routePosition: resolveRoutePosition(catalog, project.route, 'N'),
      room: catalog.rooms.byKey[occurrence.gameName]!,
      occurrence: {
        ...occurrence,
        roomActions: {
          ...occurrence.roomActions,
          order: [...occurrence.roomActions.order, travelDealRefill, delivery],
        },
      },
      role: 'ordinary',
      entered: true,
      entry: true,
      loadout: project.route.loadout,
    });
    const row = (reference: RoomActionReference) =>
      room.roomActionRoster.rows.find((candidate) => candidate.key === roomActionKey(reference));
    expect(row(travelDealRefill)).toMatchObject({
      stale: true,
      sourceFamily: { kind: 'shopTravelDealRefill' },
    });
    expect(row(delivery)).toMatchObject({
      stale: true,
      sourceFamily: { kind: 'hermesShrineDelivery' },
    });
  });
});
