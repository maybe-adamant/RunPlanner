import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import type { WorkspaceRewardControl, WorkspaceRoomPickerControl } from './contract';
import { appendUniqueRewardControls, appendUniqueRoomControls } from './projector';

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
});
