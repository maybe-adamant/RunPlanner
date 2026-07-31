import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import type { WorkspaceRewardControl } from './contract';
import { appendUniqueRewardControls } from './projector';

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
});
