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
  shopItems: new Map([
    [
      'Boon',
      {
        slotLabel: 'Major',
        label: 'Zeus Boon',
        purchased: true,
        refill: { label: 'Centaur Heart' },
      },
    ],
    ['Heal', { slotLabel: 'Minor', label: 'Healing', purchased: false }],
    ['Unset', { slotLabel: 'Minor 2', purchased: false }],
  ]),
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

const shopMarkers = () =>
  within(screen.getByRole('region', { name: 'Preboss map' }))
    .getAllByRole('img')
    .filter((marker) => marker.dataset.point === 'shop' || marker.dataset.point === 'pedestal')
    .map((marker) => marker.getAttribute('aria-label'));

describe('room map Shop stock', () => {
  it('stands each item on its point, the bought one ringed once the purchases are made', () => {
    render(<ShopMap stage="summary" />);
    expect(shopMarkers()).toEqual([
      'Zeus Boon · Bought · Refilled with Centaur Heart',
      'Healing',
      'Minor 2',
      'Pom of Power',
    ]);
    expect(screen.getByRole('img', { name: /^Zeus Boon/ }).dataset.taken).toBe('true');
    expect(
      within(screen.getByRole('list', { name: 'Map key' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Shop item', 'Contract pedestal']);
  });

  it('shows no purchase before the room is played', () => {
    render(<ShopMap stage="open" />);
    expect(shopMarkers()[0]).toBe('Zeus Boon · Refilled with Centaur Heart');
  });
});
