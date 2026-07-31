import { catalog } from '@run-planner/hades2-catalog';
import {
  createShopPurchaseAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceIds,
} from '../../../../test/fixtures/surfaceProject';
import { createCandidateSessionFactory } from '../../candidateProjection';
import { createContextualOptionResolver } from '../../contextualOptions';
import { createContextualPickerProjection } from '../../contextualPicker';
import { createRewardPickerProjection } from '../../rewardPicker';
import { createStructuredWorkspaceProjection } from '../projector';
import { assertWorkspaceInteractionClosure } from './interaction-closure';

const projection = createStructuredWorkspaceProjection(catalog, {
  candidateSessions: createCandidateSessionFactory(catalog),
  contextualPicker: createContextualPickerProjection(createContextualOptionResolver(catalog)),
  rewardPicker: createRewardPickerProjection(
    catalog,
    createContextualPickerProjection(createContextualOptionResolver(catalog)),
  ),
});

describe('workspace interaction closure', () => {
  it('rejects a missing exact bound interaction while retaining the public optional leaf argument', () => {
    const project = createRepresentativeNOPQProject();
    const projected = projection.project(project, simulateProject(catalog, project));
    const purchase = createShopPurchaseAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon');
    const interactions = {
      ...projected.interactions,
      shopPurchases: new Map(projected.interactions.shopPurchases),
    };
    interactions.shopPurchases.delete(semanticAddressKey(purchase));

    expect(() =>
      assertWorkspaceInteractionClosure(projected.routes, new Map(), new Map(), interactions),
    ).toThrow(/Shop purchase .* has no exact workspace interaction/);
  });
});
