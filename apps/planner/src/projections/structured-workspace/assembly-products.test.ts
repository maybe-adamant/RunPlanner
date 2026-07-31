import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import type {
  WorkspaceInspectorDestination,
  WorkspaceRewardControl,
  WorkspaceRoomPickerControl,
} from './contract';
import {
  appendUniqueFocusDestinations,
  appendUniqueRewardControls,
  appendUniqueRoomControls,
} from './projector';

function explicitControl(occurrenceKey: string): WorkspaceRewardControl {
  const address = createIncomingRewardAddress(
    createBiomeAddress('Underworld', 'F'),
    createOccurrenceId(occurrenceKey),
  );
  return Object.freeze({
    kind: 'explicitReward' as const,
    marker: Object.freeze({
      address,
      assessment: 'unassessed' as const,
      findingCount: 0,
      focusKey: semanticAddressKey(address),
    }),
    offer: Object.freeze({ rewardType: 'MaxHealthDrop' }),
    owner: Object.freeze({ kind: 'incomingReward' as const, address }),
    rewardTypes: Object.freeze(['MaxHealthDrop']),
  });
}

function targetRoomControl(): WorkspaceRoomPickerControl {
  const biome = createBiomeAddress('Underworld', 'F');
  const address = createTargetAddress(
    biome,
    { kind: 'occurrence', occurrenceId: createOccurrenceId('duplicate-room-control-source') },
    'exit1',
  );
  return Object.freeze({ address, kind: 'targetRoomPicker' as const });
}

function redirectedRewardFocusDestination(): WorkspaceInspectorDestination {
  const biome = createBiomeAddress('Underworld', 'F');
  const ownerAddress = createIncomingRewardAddress(
    biome,
    createOccurrenceId('redirected-focus-reward'),
  );
  return Object.freeze({
    biomeKey: biome.biomeKey,
    focusAddress: biome,
    focusKey: semanticAddressKey(biome),
    nodeKey: `hub:${semanticAddressKey(biome)}`,
    ownerAddress,
    region: 'structure',
    routeKey: biome.routeKey,
  });
}

describe('structured workspace assembly products', () => {
  it('rejects duplicate semantic owners while composing returned reward controls', () => {
    const control = explicitControl('duplicate-reward-control');
    const controls = new Map<string, WorkspaceRewardControl>();

    appendUniqueRewardControls(controls, [control]);

    expect(controls.get(semanticAddressKey(control.owner.address))).toBe(control);
    expect(() => appendUniqueRewardControls(controls, [control])).toThrow(
      `${semanticAddressKey(control.owner.address)} has multiple projected reward controls`,
    );
  });

  it('rejects duplicate semantic owners while composing returned room controls', () => {
    const control = targetRoomControl();
    const controls = new Map<string, WorkspaceRoomPickerControl>();

    appendUniqueRoomControls(controls, [control]);

    expect(controls.get(semanticAddressKey(control.address))).toBe(control);
    expect(() => appendUniqueRoomControls(controls, [control])).toThrow(
      `${semanticAddressKey(control.address)} has multiple projected room controls`,
    );
  });

  it('validates and composes returned focus destinations by their semantic owner', () => {
    const destination = redirectedRewardFocusDestination();
    const ownerKey = semanticAddressKey(destination.ownerAddress);
    const destinations = new Map<string, WorkspaceInspectorDestination>();

    appendUniqueFocusDestinations(destinations, [[ownerKey, destination]]);

    expect(destination.focusKey).not.toBe(ownerKey);
    expect(destinations.get(ownerKey)).toBe(destination);
    expect(() => appendUniqueFocusDestinations(destinations, [[ownerKey, destination]])).toThrow(
      `${ownerKey} has multiple projected focus destinations`,
    );
    expect(() =>
      appendUniqueFocusDestinations(new Map(), [['wrong-focus-owner', destination]]),
    ).toThrow(
      `wrong-focus-owner focus destination key does not match its semantic owner ${ownerKey}`,
    );
  });
});
