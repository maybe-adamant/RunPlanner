// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { WorkspaceRoomMap } from '@planner/projections/structured-workspace';
import { RoomMapColumn, type RoomMapStage } from '@planner/ui/editor/biome/room-map/RoomMapColumn';
import { RoomMapHighlightScope } from '@planner/ui/editor/biome/room-map/RoomMapHighlightScope';
import type { RoomMapPlacements } from '@planner/ui/editor/biome/room-map/RoomMapPoints';

afterEach(cleanup);

const map: WorkspaceRoomMap = {
  doors: [],
  sideDoors: [],
  entries: [],
  anchors: [],
  chaosPoints: [],
  fieldsCagePoints: [],
  fieldsOptionalPoints: [],
  shopItems: [
    { id: 561332, x: 7243, y: 8271, offerKey: 'Boon' },
    { id: 561333, x: 7046, y: 8371, offerKey: 'Heal' },
    { id: 561334, x: 6876, y: 8461, offerKey: 'Unset' },
  ],
  contractPedestal: { id: 776332, x: 6726, y: 8668 },
};

const placements: Omit<RoomMapPlacements, 'preview'> = {
  entryEligible: [],
  entryNumbers: new Map(),
  anchors: new Map(),
  anchorNumbers: new Map(),
  fieldsPoints: new Map(),
  // The Major item is bought and the Unset slot holds nothing yet: neither stands.
  shopItems: new Map([['Heal', { label: 'Healing' }]]),
  contractPedestal: { label: 'Pom of Power' },
};

function ShopMap({ stage }: { readonly stage: RoomMapStage }) {
  return (
    <RoomMapHighlightScope scope="shop">
      <RoomMapColumn
        gameName="F_PreBoss01"
        map={map}
        placements={placements}
        roomIdentity="shop"
        shop
        stage={stage}
        title="Preboss"
      />
    </RoomMapHighlightScope>
  );
}

const stockMarkers = () =>
  within(screen.getByRole('region', { name: 'Preboss map' }))
    .getAllByRole('img')
    .filter((marker) => marker.dataset.point === 'stock')
    .map((marker) => marker.getAttribute('aria-label'));

describe('room map Shop stock', () => {
  it('stands each standing item plainly on its point, marked Shop or Contract where both stand', () => {
    render(<ShopMap stage="summary" />);
    expect(stockMarkers()).toEqual(['Healing · Shop', 'Pom of Power · Contract']);
    // Neither has a key of its own.
    expect(screen.queryByRole('list', { name: 'Map key' })).toBeNull();
  });
});
