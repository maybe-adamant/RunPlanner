// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { loadNemesisPomSeaStarCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  prepareLegalPomTraitOffers,
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures/shared';
import {
  createRepresentativeNOPQShopTraitProject,
  pBiome,
  pOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';

afterEach(cleanup);

function seaStarCheckboxes(): HTMLInputElement[] {
  return within(screen.getByRole('region', { name: 'Room Timeline' })).queryAllByRole('checkbox', {
    name: /^Sea Star procced for /,
  }) as HTMLInputElement[];
}

describe('Pickup outcome controls', () => {
  it('shows Sea Star where the equipped Sea Star supports a proc', () => {
    renderOccurrenceWorkbench(
      loadNemesisPomSeaStarCheckpoint(),
      'Underworld',
      'F',
      occurrenceById(createOccurrenceId('golden-f-b5-e1')),
    );
    openRoomTab('Room Timeline');
    const [seaStar, ...others] = seaStarCheckboxes();
    expect(others).toHaveLength(0);
    expect(seaStar?.checked).toBe(true);
    expect(seaStar?.disabled).toBe(false);
  });

  it('keeps an authored proc visible and editable after its support is gone', () => {
    const shopId = pOccurrenceIds.prebossShop;
    const offer = createShopOfferAddress(pBiome, shopId, 'Minor');
    const acquisition = createAcquisitionRoleAddress(offer, 'self');
    let project = applyProjectCommand(createRepresentativeNOPQShopTraitProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'StackUpgrade' },
    });
    project = replaceTestShopOfferActions(
      project,
      catalog,
      createOccurrenceAddress(pBiome, shopId),
      ['Minor'],
    );
    project = prepareLegalPomTraitOffers(project).project;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSeaStarResult',
      acquisition,
      procced: true,
    });
    expect(
      simulateProject(catalog, project).findings.some(
        (finding) =>
          finding.code === 'seaStarDuplicationUnavailable' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(acquisition),
      ),
    ).toBe(true);
    renderOccurrenceWorkbench(project, 'Surface', 'P', occurrenceById(shopId));
    openRoomTab('Room Timeline');
    const [seaStar] = seaStarCheckboxes();
    expect(seaStar?.checked).toBe(true);
    expect(seaStar?.disabled).toBe(false);
    expect(seaStar?.closest('label')?.hasAttribute('title')).toBe(false);
  });
});
