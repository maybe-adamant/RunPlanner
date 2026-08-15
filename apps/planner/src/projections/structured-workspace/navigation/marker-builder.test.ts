import {
  createAllTogetherSetAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createTraitOfferAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createWorkspaceBiomeMarkerDestinationBuilder } from './marker-builder';

const biome = createBiomeAddress('Underworld', 'F');

function builder() {
  return createWorkspaceBiomeMarkerDestinationBuilder({
    assessmentFor: () => 'unassessed',
    biome,
    findingCountFor: () => 0,
    routeKey: biome.routeKey,
  });
}

describe('structured workspace marker destination builder', () => {
  it('keeps registration private while emitting first-registration destinations', () => {
    const value = builder();
    const address = createIncomingRewardAddress(biome, createOccurrenceId('first-registration'));
    const first = value.emitter.marker(address, 'first-node');
    const duplicate = value.emitter.marker(address, 'later-node');

    expect('destinations' in value.emitter).toBe(false);
    expect(first).toEqual(duplicate);
    expect(value.destinations().get(first.focusKey)?.nodeKey).toBe('first-node');
  });

  it('redirects exact owners without exposing accumulated registrations to emitters', () => {
    const value = builder();
    const reward = value.emitter.marker(
      createIncomingRewardAddress(biome, createOccurrenceId('redirected-reward')),
    );
    const hub = value.emitter.marker(biome, 'hub-node');

    value.emitter.redirect([reward], 'decision-node');
    value.emitter.redirectTo(reward, hub, 'hub-node');

    const destination = value.destinations().get(reward.focusKey);
    expect(destination).toMatchObject({
      focusAddress: hub.address,
      focusKey: hub.focusKey,
      nodeKey: 'hub-node',
      ownerAddress: reward.address,
    });
  });

  it('preserves the transient trait-dialog target when a nested owner redirects to the Hub board', () => {
    const value = builder();
    const reward = createIncomingRewardAddress(
      biome,
      createOccurrenceId('redirected-trait-reward'),
    );
    const trait = value.emitter.marker(createTraitOfferAddress(reward, 'chosenSource'));
    const hub = value.emitter.marker(biome, 'hub-node');

    value.emitter.redirectTo(trait, hub, 'hub-node');

    expect(value.destinations().get(trait.focusKey)).toMatchObject({
      focusAddress: hub.address,
      focusKey: hub.focusKey,
      nodeKey: 'hub-node',
      ownerAddress: trait.address,
      traitDialogTarget: trait.address,
    });
  });

  it('routes an exact All Together child through its containing trait dialog', () => {
    const value = builder();
    const reward = createIncomingRewardAddress(
      biome,
      createOccurrenceId('all-together-finding-reward'),
    );
    const trait = createTraitOfferAddress(reward, 'source');
    const set = createAllTogetherSetAddress(trait, 'option1', 'earth');
    const marker = value.emitter.marker(set, 'reward-node');

    expect(value.destinations().get(marker.focusKey)).toMatchObject({
      focusAddress: set,
      focusKey: semanticAddressKey(set),
      nodeKey: 'reward-node',
      ownerAddress: set,
      traitDialogTarget: trait,
    });
  });

  it('returns snapshots so one family cannot observe later family emissions', () => {
    const value = builder();
    const first = value.emitter.marker(
      createIncomingRewardAddress(biome, createOccurrenceId('first-family')),
    );
    const beforeLaterFamily = value.destinations();
    const later = value.emitter.marker(
      createIncomingRewardAddress(biome, createOccurrenceId('later-family')),
    );

    expect(beforeLaterFamily.has(later.focusKey)).toBe(false);
    expect(value.destinations().has(first.focusKey)).toBe(true);
    expect(value.destinations().has(later.focusKey)).toBe(true);
    expect(semanticAddressKey(first.address)).not.toBe(semanticAddressKey(later.address));
  });
});
