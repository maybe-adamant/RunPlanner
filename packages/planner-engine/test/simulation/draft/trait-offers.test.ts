import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import type { DraftSpec } from '../../../src/simulation';
import {
  DraftTraitOffers,
  type DraftTraitOfferContext,
} from '../../../src/simulation/draft/trait-offers';
import { draftSteeringFor } from '../../support/draft-walk';

const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
void _startingReward;
const base = createProjectDocument(catalog, {
  projectId: 't',
  routeKey: 'Underworld',
  configuredBiomeCount: 4,
});

/** Trait allowance for sources other than a trait offer, over the base project's start. */
function allowance(basketByGiver: DraftSpec['basketByGiver']) {
  const spec: DraftSpec = {
    loadout,
    world: {
      godKeys: ['Zeus', 'Hestia', 'Ares', 'Demeter'],
      storyNpcByBiome: { I: 'Hades' },
      fieldNpcsByBiome: {},
    },
    basketByGiver,
    rackKeepsakeKeys: [null, null, null],
  };
  const steering = draftSteeringFor(base, spec);
  const unused = () => {
    throw new Error('not used by trait allowance');
  };
  const offers = new DraftTraitOffers({
    catalog,
    spec,
    steering,
    hooked: new Set(),
    project: () => base,
    evaluate: unused,
    startingOutcome: unused,
    apply: unused,
    shuffle: (values) => [...values],
    fail: unused,
  } satisfies DraftTraitOfferContext);
  return (traitKey: string) => offers.traitAllowed(traitKey, steering.progress());
}

describe('draft trait allowance', () => {
  it('never takes a trait that would keep a basket trait still to come from being offered', () => {
    const hestiaCast = allowance({ Hestia: ['CastProjectileBoon'] });
    for (const traitKey of [
      'HadesCastProjectileBoon',
      'CastAnywhereBoon',
      'CastLobBoon',
      'SelfCastBoon',
    ])
      expect(hestiaCast(traitKey), traitKey).toBe(false);
    expect(hestiaCast('ZeusWeaponBoon')).toBe(true);
    const hadesCast = allowance({ Hades: ['HadesCastProjectileBoon'] });
    expect(hadesCast('CastProjectileBoon')).toBe(false);
    expect(allowance({})('CastProjectileBoon')).toBe(true);
  });
});
