import {
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import type {
  WorkspaceInspectorDestination,
  WorkspaceNode,
  WorkspaceRewardControl,
  WorkspaceRoomPickerControl,
} from '../contract';
import {
  appendUniqueFocusDestinations,
  appendUniqueRewardControls,
  appendUniqueRoomControls,
  appendUniqueWorkspaceNodes,
} from './assembly-products';
import type {
  WorkspaceBatchInteractionRequirement,
  WorkspaceFrontierInteractionRequirement,
  WorkspaceHubInteractionRequirement,
  WorkspaceOccurrenceInteractionRequirement,
  WorkspaceStartInteractionRequirement,
  WorkspaceTakeoverInteractionRequirement,
  WorkspaceTopologyRemovalInteractionRequirement,
} from '../interactions/interaction-requirements';
import {
  appendUniqueBatchInteractionRequirements,
  appendUniqueFrontierInteractionRequirements,
  appendUniqueHubInteractionRequirements,
  appendUniqueOccurrenceInteractionRequirements,
  appendUniqueStartInteractionRequirements,
  appendUniqueTakeoverInteractionRequirements,
  appendUniqueTopologyRemovalInteractionRequirements,
} from '../interactions/interaction-requirements';

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
  return Object.freeze({
    address,
    kind: 'targetRoomPicker' as const,
    target: Object.freeze({ kind: 'missing' as const }),
  });
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

function completionNode(key: string): WorkspaceNode {
  const biome = createBiomeAddress('Underworld', 'F');
  return Object.freeze({
    gameName: 'F_Boss01',
    key,
    kind: 'completion' as const,
    label: 'Synthetic completion',
    marker: Object.freeze({
      address: biome,
      assessment: 'unassessed' as const,
      findingCount: 0,
      focusKey: semanticAddressKey(biome),
    }),
    role: 'boss',
  }) as WorkspaceNode;
}

function shipInteractionRequirement(): WorkspaceOccurrenceInteractionRequirement {
  const owner = createOccurrenceAddress(
    createBiomeAddress('Underworld', 'F'),
    createOccurrenceId('duplicate-ship-interaction'),
  );
  return Object.freeze({
    encounterCount: 2,
    encounterCountChoices: Object.freeze([
      Object.freeze({ label: 'Intro + 1 combat', value: 2 as const }),
      Object.freeze({ label: 'Intro + 2 combats', value: 3 as const }),
    ]),
    kind: 'shipCombat' as const,
    owner,
    wheels: Object.freeze([]),
  });
}

function batchInteractionRequirement(): WorkspaceBatchInteractionRequirement {
  const biome = createBiomeAddress('Underworld', 'F');
  const owner = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('duplicate-batch-interaction'),
  });
  return Object.freeze({
    exitSelection: Object.freeze({
      owner: createExitSelectionAddress(biome, owner.source),
      targets: Object.freeze([]),
    }),
    kind: 'batchControls' as const,
    owner,
  });
}

function hubInteractionRequirement(): WorkspaceHubInteractionRequirement {
  const biome = createBiomeAddress('Surface', 'N');
  const owner = createHubDecisionAddress(biome, 'duplicate-hub-interaction');
  return Object.freeze({
    kind: 'hubControls' as const,
    owner,
    slots: Object.freeze([
      Object.freeze({
        choices: Object.freeze([
          Object.freeze({ label: 'Closed', value: false }),
          Object.freeze({ label: 'Open', value: true }),
        ]),
        owner: createHubSlotAddress(biome, owner.hubKey, 'combat01'),
        selected: false as const,
      }),
    ]),
    visits: Object.freeze([]),
  });
}

function topologyRemovalInteractionRequirement(): WorkspaceTopologyRemovalInteractionRequirement {
  const owner = createBiomeAddress('Surface', 'N');
  return Object.freeze({
    kind: 'topologyRemovals' as const,
    owner,
    removals: Object.freeze([
      Object.freeze({
        command: Object.freeze({ kind: 'ClearTopology' as const, biome: owner }),
        key: semanticAddressKey(owner),
        owner,
      }),
    ]),
  });
}

function startInteractionRequirement(): WorkspaceStartInteractionRequirement {
  return Object.freeze({
    kind: 'start' as const,
    owner: createBiomeAddress('Underworld', 'F'),
    start: Object.freeze({
      gameNames: Object.freeze(['F_Opening01']) as readonly [string, ...string[]],
      kind: 'choice' as const,
    }),
  });
}

function takeoverInteractionRequirement(): WorkspaceTakeoverInteractionRequirement {
  const owner = createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('duplicate-takeover-interaction'),
  });
  return Object.freeze({
    action: 'create' as const,
    existingTargets: Object.freeze([]),
    gameNames: Object.freeze(['F_PreBoss01']) as readonly [string, ...string[]],
    kind: 'takeoverBatch' as const,
    owner,
    presentation: 'candidate' as const,
  });
}

function frontierInteractionRequirement(): WorkspaceFrontierInteractionRequirement {
  const owner = createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('duplicate-frontier-interaction'),
  });
  return Object.freeze({
    capabilities: Object.freeze({ structural: 'createBatch' as const, takeover: true as const }),
    kind: 'exitFrontier' as const,
    owner,
    structural: Object.freeze({ action: 'createBatch' as const }),
  });
}

describe('structured workspace assembly products', () => {
  it('rejects duplicate structural node keys while composing semantic families', () => {
    const node = completionNode('duplicate-node');
    const nodes: WorkspaceNode[] = [];

    appendUniqueWorkspaceNodes(nodes, [node]);

    expect(nodes).toEqual([node]);
    expect(() => appendUniqueWorkspaceNodes(nodes, [node])).toThrow(
      'duplicate-node has multiple projected workspace nodes',
    );
  });

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

  it('rejects duplicate occurrence interaction packages by kind and semantic owner', () => {
    const requirement = shipInteractionRequirement();
    const identity = `shipCombat:${semanticAddressKey(requirement.owner)}`;
    const requirements = new Map<string, WorkspaceOccurrenceInteractionRequirement>();

    appendUniqueOccurrenceInteractionRequirements(requirements, [requirement]);

    expect(requirements.get(identity)).toBe(requirement);
    expect(() =>
      appendUniqueOccurrenceInteractionRequirements(requirements, [requirement]),
    ).toThrow(`${identity} has multiple projected occurrence interaction requirements`);
  });

  it('rejects duplicate batch interaction packages by kind and semantic owner', () => {
    const requirement = batchInteractionRequirement();
    const identity = `batchControls:${semanticAddressKey(requirement.owner)}`;
    const requirements = new Map<string, WorkspaceBatchInteractionRequirement>();

    appendUniqueBatchInteractionRequirements(requirements, [requirement]);

    expect(requirements.get(identity)).toBe(requirement);
    expect(() => appendUniqueBatchInteractionRequirements(requirements, [requirement])).toThrow(
      `${identity} has multiple projected batch interaction requirements`,
    );
  });

  it('rejects duplicate Hub interaction packages by kind and semantic owner', () => {
    const requirement = hubInteractionRequirement();
    const identity = `hubControls:${semanticAddressKey(requirement.owner)}`;
    const requirements = new Map<string, WorkspaceHubInteractionRequirement>();

    appendUniqueHubInteractionRequirements(requirements, [requirement]);

    expect(requirements.get(identity)).toBe(requirement);
    expect(() => appendUniqueHubInteractionRequirements(requirements, [requirement])).toThrow(
      `${identity} has multiple projected Hub interaction requirements`,
    );
  });

  it('rejects duplicate topology-removal packages by kind and biome owner', () => {
    const requirement = topologyRemovalInteractionRequirement();
    const identity = `topologyRemovals:${semanticAddressKey(requirement.owner)}`;
    const requirements = new Map<string, WorkspaceTopologyRemovalInteractionRequirement>();

    appendUniqueTopologyRemovalInteractionRequirements(requirements, [requirement]);

    expect(requirements.get(identity)).toBe(requirement);
    expect(() =>
      appendUniqueTopologyRemovalInteractionRequirements(requirements, [requirement]),
    ).toThrow(`${identity} has multiple projected topology-removal interaction requirements`);
  });

  it('rejects duplicate start requirements by kind and biome owner', () => {
    const requirement = startInteractionRequirement();
    const identity = `start:${semanticAddressKey(requirement.owner)}`;
    const requirements = new Map<string, WorkspaceStartInteractionRequirement>();

    appendUniqueStartInteractionRequirements(requirements, [requirement]);

    expect(requirements.get(identity)).toBe(requirement);
    expect(() => appendUniqueStartInteractionRequirements(requirements, [requirement])).toThrow(
      `${identity} has multiple projected start interaction requirements`,
    );
  });

  it('rejects duplicate takeover requirements by kind and decision owner', () => {
    const requirement = takeoverInteractionRequirement();
    const identity = `takeoverBatch:${semanticAddressKey(requirement.owner)}`;
    const requirements = new Map<string, WorkspaceTakeoverInteractionRequirement>();

    appendUniqueTakeoverInteractionRequirements(requirements, [requirement]);

    expect(requirements.get(identity)).toBe(requirement);
    expect(() => appendUniqueTakeoverInteractionRequirements(requirements, [requirement])).toThrow(
      `${identity} has multiple projected takeover interaction requirements`,
    );
  });

  it('rejects duplicate frontier requirements by kind and semantic owner', () => {
    const requirement = frontierInteractionRequirement();
    const identity = `exitFrontier:${semanticAddressKey(requirement.owner)}`;
    const requirements = new Map<string, WorkspaceFrontierInteractionRequirement>();

    appendUniqueFrontierInteractionRequirements(requirements, [requirement]);

    expect(requirements.get(identity)).toBe(requirement);
    expect(() => appendUniqueFrontierInteractionRequirements(requirements, [requirement])).toThrow(
      `${identity} has multiple projected frontier interaction requirements`,
    );
  });
});
